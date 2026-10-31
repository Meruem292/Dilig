#include <Arduino.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <Wire.h>
#include <esp_task_wdt.h>
#include <time.h>

#include "firmware_config.h"
#include "tls_root_ca.h"

#if __has_include("secrets.h")
#include "secrets.h"
#else
#define DILIG_WIFI_SSID ""
#define DILIG_WIFI_PASSWORD ""
#define DILIG_FIREBASE_PROJECT_ID ""
#define DILIG_FIREBASE_API_KEY ""
#endif

namespace {

constexpr size_t DEVICE_ID_CAPACITY = 32;
constexpr size_t FIRESTORE_ID_CAPACITY = 128;
constexpr size_t GATE_NAME_CAPACITY = 32;
constexpr size_t ERROR_CAPACITY = 64;

enum class CommandAction : uint8_t { Open, Close };
enum class PhysicalState : uint8_t { Unknown, Open, Closed, Moving, Error };

struct MotorCommand {
  CommandAction action;
  char commandId[FIRESTORE_ID_CAPACITY];
};

struct MotorResult {
  char commandId[FIRESTORE_ID_CAPACITY];
  PhysicalState state;
  bool success;
  char error[ERROR_CAPACITY];
};

struct PhysicalSnapshot {
  PhysicalState state;
};

struct UiStatus {
  bool wifiConnected;
  bool registered;
  bool assigned;
  char gateName[GATE_NAME_CAPACITY];
};

struct DeviceBinding {
  char userId[FIRESTORE_ID_CAPACITY];
  char deviceDocId[FIRESTORE_ID_CAPACITY];
  char gateId[FIRESTORE_ID_CAPACITY];
  bool registered;
  bool assigned;
};

struct GateSnapshot {
  char name[GATE_NAME_CAPACITY];
  char pendingCommandId[FIRESTORE_ID_CAPACITY];
  PhysicalState reportedState;
};

struct CommandSnapshot {
  char id[FIRESTORE_ID_CAPACITY];
  CommandAction action;
  char status[16];
};

class DebouncedLimit {
 public:
  explicit DebouncedLimit(const uint8_t pin) : pin_(pin) {}

  void begin() {
    pinMode(pin_, INPUT_PULLUP);
    raw_ = digitalRead(pin_);
    stable_ = raw_;
    changedAtMs_ = millis();
  }

  void update(const uint32_t now) {
    const uint8_t reading = digitalRead(pin_);
    if (reading != raw_) {
      raw_ = reading;
      changedAtMs_ = now;
    }
    if (stable_ != raw_ && now - changedAtMs_ >= config::LIMIT_DEBOUNCE_MS) {
      stable_ = raw_;
    }
  }

  bool triggered() const { return stable_ == config::LIMIT_TRIGGERED_LEVEL; }

 private:
  uint8_t pin_;
  uint8_t raw_ = LOW;
  uint8_t stable_ = LOW;
  uint32_t changedAtMs_ = 0;
};

char g_deviceId[DEVICE_ID_CAPACITY] = {};
QueueHandle_t g_commandQueue = nullptr;
QueueHandle_t g_resultQueue = nullptr;
QueueHandle_t g_physicalQueue = nullptr;
QueueHandle_t g_uiQueue = nullptr;

Adafruit_SSD1306 g_display(config::OLED_WIDTH, config::OLED_HEIGHT, &Wire, -1);
bool g_displayAvailable = false;

const char* physicalStateName(const PhysicalState state) {
  switch (state) {
    case PhysicalState::Open:
      return "OPEN";
    case PhysicalState::Closed:
      return "CLOSED";
    case PhysicalState::Moving:
      return "MOVING";
    case PhysicalState::Error:
      return "ERROR";
    case PhysicalState::Unknown:
    default:
      return "UNKNOWN";
  }
}

PhysicalState parsePhysicalState(const char* value) {
  if (strcmp(value, "open") == 0) return PhysicalState::Open;
  if (strcmp(value, "closed") == 0) return PhysicalState::Closed;
  if (strcmp(value, "moving") == 0) return PhysicalState::Moving;
  if (strcmp(value, "error") == 0) return PhysicalState::Error;
  return PhysicalState::Unknown;
}

const char* firestoreState(const PhysicalState state) {
  switch (state) {
    case PhysicalState::Open:
      return "open";
    case PhysicalState::Closed:
      return "closed";
    case PhysicalState::Moving:
      return "moving";
    case PhysicalState::Error:
      return "error";
    default:
      return "unknown";
  }
}

void buildDeviceId() {
  const uint64_t chipId = ESP.getEfuseMac() & 0x0000FFFFFFFFFFFFULL;
  snprintf(
      g_deviceId,
      sizeof(g_deviceId),
      "DILIG-ACT-%012llX",
      static_cast<unsigned long long>(chipId));
}

bool configurationPresent() {
  return strlen(DILIG_WIFI_SSID) > 0 &&
         strlen(DILIG_FIREBASE_PROJECT_ID) > 0 &&
         strlen(DILIG_FIREBASE_API_KEY) > 0 &&
         strcmp(DILIG_FIREBASE_API_KEY, "YOUR_FIREBASE_WEB_API_KEY") != 0;
}

int64_t epochMs() {
  return static_cast<int64_t>(time(nullptr)) * 1000LL +
         static_cast<int64_t>(millis() % 1000UL);
}

void stopMotor() {
  digitalWrite(config::RELAY_OPEN_PIN, config::RELAY_OFF_LEVEL);
  digitalWrite(config::RELAY_CLOSE_PIN, config::RELAY_OFF_LEVEL);
}

void driveMotor(const CommandAction action) {
  // Always de-energize both channels before selecting one direction.
  stopMotor();
  if (action == CommandAction::Open) {
    digitalWrite(config::RELAY_OPEN_PIN, config::RELAY_ON_LEVEL);
  } else {
    digitalWrite(config::RELAY_CLOSE_PIN, config::RELAY_ON_LEVEL);
  }
}

PhysicalState derivePhysicalState(
    const bool openTriggered,
    const bool closedTriggered,
    const bool moving) {
  if (openTriggered && closedTriggered) return PhysicalState::Error;
  if (moving) return PhysicalState::Moving;
  if (openTriggered) return PhysicalState::Open;
  if (closedTriggered) return PhysicalState::Closed;
  return PhysicalState::Unknown;
}

void publishPhysicalState(const PhysicalState state) {
  const PhysicalSnapshot snapshot{state};
  xQueueOverwrite(g_physicalQueue, &snapshot);
}

void publishMotorResult(
    const MotorCommand& command,
    const bool success,
    const PhysicalState state,
    const char* error) {
  MotorResult result{};
  strlcpy(result.commandId, command.commandId, sizeof(result.commandId));
  result.state = state;
  result.success = success;
  strlcpy(result.error, error, sizeof(result.error));
  xQueueSend(g_resultQueue, &result, 0);
}

void renderDisplay(
    const PhysicalState physicalState,
    const CommandAction activeAction,
    const bool moving,
    const UiStatus& ui) {
  if (!g_displayAvailable) return;

  g_display.clearDisplay();
  g_display.setTextColor(SSD1306_WHITE);
  g_display.setTextSize(1);
  g_display.setCursor(0, 0);
  g_display.println(F("DILIG GATE ACT"));
  g_display.println(F("ID DILIG-ACT-"));
  g_display.println(g_deviceId + strlen("DILIG-ACT-"));
  g_display.print(F("Gate: "));
  g_display.println(ui.assigned ? ui.gateName : "UNASSIGNED");
  g_display.print(F("State: "));
  g_display.println(physicalStateName(physicalState));
  g_display.print(ui.wifiConnected ? F("WiFi OK ") : F("WiFi -- "));
  if (!ui.registered) {
    g_display.println(F("REGISTER ID"));
  } else if (moving) {
    g_display.println(activeAction == CommandAction::Open ? F("OPENING") : F("CLOSING"));
  } else {
    g_display.println(F("READY"));
  }
  g_display.display();
}

bool getJson(const char* url, JsonDocument& document, int& httpCode) {
  WiFiClientSecure client;
  client.setCACert(GOOGLE_TRUST_SERVICES_ROOT_R4);
  HTTPClient http;
  http.setConnectTimeout(config::HTTP_TIMEOUT_MS);
  http.setTimeout(config::HTTP_TIMEOUT_MS);
  if (!http.begin(client, url)) {
    httpCode = -2;
    return false;
  }
  httpCode = http.GET();
  if (httpCode != HTTP_CODE_OK) {
    http.end();
    return false;
  }
  const DeserializationError error = deserializeJson(document, http.getStream());
  http.end();
  if (error) {
    Serial.printf("[cloud] JSON parse failed: %s\n", error.c_str());
    httpCode = -4;
    return false;
  }
  return true;
}

bool sendJson(
    const char* method,
    const char* url,
    const char* payload,
    const size_t payloadLength,
    int& httpCode) {
  WiFiClientSecure client;
  client.setCACert(GOOGLE_TRUST_SERVICES_ROOT_R4);
  HTTPClient http;
  http.setConnectTimeout(config::HTTP_TIMEOUT_MS);
  http.setTimeout(config::HTTP_TIMEOUT_MS);
  if (!http.begin(client, url)) {
    httpCode = -2;
    return false;
  }
  http.addHeader(F("Content-Type"), F("application/json"));
  httpCode = http.sendRequest(
      method,
      reinterpret_cast<uint8_t*>(const_cast<char*>(payload)),
      payloadLength);
  http.end();
  return httpCode >= 200 && httpCode < 300;
}

bool resolveBinding(DeviceBinding& binding, int& httpCode) {
  char url[512] = {};
  snprintf(
      url,
      sizeof(url),
      "https://firestore.googleapis.com/v1/projects/%s/databases/(default)/documents/deviceRegistry/%s?key=%s",
      DILIG_FIREBASE_PROJECT_ID,
      g_deviceId,
      DILIG_FIREBASE_API_KEY);

  JsonDocument registry;
  if (!getJson(url, registry, httpCode)) return false;

  const char* registeredId = registry["fields"]["deviceId"]["stringValue"] | "";
  const char* type = registry["fields"]["type"]["stringValue"] | "";
  const char* userId = registry["fields"]["userId"]["stringValue"] | "";
  const char* deviceDocId = registry["fields"]["deviceDocId"]["stringValue"] | "";
  if (strcmp(registeredId, g_deviceId) != 0 || strcmp(type, "actuator") != 0 ||
      strlen(userId) == 0 || strlen(deviceDocId) == 0 ||
      strlen(userId) >= sizeof(binding.userId) ||
      strlen(deviceDocId) >= sizeof(binding.deviceDocId)) {
    httpCode = -5;
    return false;
  }

  strlcpy(binding.userId, userId, sizeof(binding.userId));
  strlcpy(binding.deviceDocId, deviceDocId, sizeof(binding.deviceDocId));
  binding.registered = true;

  snprintf(
      url,
      sizeof(url),
      "https://firestore.googleapis.com/v1/projects/%s/databases/(default)/documents/users/%s/devices/%s?key=%s",
      DILIG_FIREBASE_PROJECT_ID,
      binding.userId,
      binding.deviceDocId,
      DILIG_FIREBASE_API_KEY);
  JsonDocument device;
  if (!getJson(url, device, httpCode)) return false;

  const char* assignedGateId = device["fields"]["assignedGateId"]["stringValue"] | "";
  binding.assigned = strlen(assignedGateId) > 0 &&
                     strlen(assignedGateId) < sizeof(binding.gateId);
  if (binding.assigned) {
    strlcpy(binding.gateId, assignedGateId, sizeof(binding.gateId));
  } else {
    binding.gateId[0] = '\0';
  }
  return true;
}

bool sendHeartbeat(const DeviceBinding& binding, int& httpCode) {
  char url[768] = {};
  snprintf(
      url,
      sizeof(url),
      "https://firestore.googleapis.com/v1/projects/%s/databases/(default)/documents/users/%s/devices/%s"
      "?updateMask.fieldPaths=status&updateMask.fieldPaths=lastSeenAt&updateMask.fieldPaths=updatedAt&key=%s",
      DILIG_FIREBASE_PROJECT_ID,
      binding.userId,
      binding.deviceDocId,
      DILIG_FIREBASE_API_KEY);
  const int64_t now = epochMs();
  char payload[384] = {};
  const int length = snprintf(
      payload,
      sizeof(payload),
      "{\"fields\":{\"status\":{\"stringValue\":\"online\"},"
      "\"lastSeenAt\":{\"integerValue\":\"%lld\"},"
      "\"updatedAt\":{\"integerValue\":\"%lld\"}}}",
      static_cast<long long>(now),
      static_cast<long long>(now));
  return length > 0 && static_cast<size_t>(length) < sizeof(payload) &&
         sendJson("PATCH", url, payload, static_cast<size_t>(length), httpCode);
}

bool fetchGate(const DeviceBinding& binding, GateSnapshot& gate, int& httpCode) {
  char url[640] = {};
  snprintf(
      url,
      sizeof(url),
      "https://firestore.googleapis.com/v1/projects/%s/databases/(default)/documents/users/%s/gates/%s?key=%s",
      DILIG_FIREBASE_PROJECT_ID,
      binding.userId,
      binding.gateId,
      DILIG_FIREBASE_API_KEY);
  JsonDocument document;
  if (!getJson(url, document, httpCode)) return false;
  const char* actuatorId = document["fields"]["actuatorDeviceId"]["stringValue"] | "";
  if (strcmp(actuatorId, g_deviceId) != 0) {
    httpCode = HTTP_CODE_FORBIDDEN;
    return false;
  }
  strlcpy(gate.name, document["fields"]["name"]["stringValue"] | "Gate", sizeof(gate.name));
  strlcpy(
      gate.pendingCommandId,
      document["fields"]["pendingCommandId"]["stringValue"] | "",
      sizeof(gate.pendingCommandId));
  gate.reportedState = parsePhysicalState(
      document["fields"]["reportedState"]["stringValue"] | "unknown");
  return true;
}

bool fetchCommand(
    const DeviceBinding& binding,
    const char* commandId,
    CommandSnapshot& command,
    int& httpCode) {
  char url[768] = {};
  snprintf(
      url,
      sizeof(url),
      "https://firestore.googleapis.com/v1/projects/%s/databases/(default)/documents/users/%s/gates/%s/commands/%s?key=%s",
      DILIG_FIREBASE_PROJECT_ID,
      binding.userId,
      binding.gateId,
      commandId,
      DILIG_FIREBASE_API_KEY);
  JsonDocument document;
  if (!getJson(url, document, httpCode)) return false;
  const char* actuatorId = document["fields"]["actuatorDeviceId"]["stringValue"] | "";
  const char* action = document["fields"]["command"]["stringValue"] | "";
  if (strcmp(actuatorId, g_deviceId) != 0 ||
      (strcmp(action, "OPEN") != 0 && strcmp(action, "CLOSE") != 0)) {
    httpCode = HTTP_CODE_FORBIDDEN;
    return false;
  }
  strlcpy(command.id, commandId, sizeof(command.id));
  strlcpy(command.status, document["fields"]["status"]["stringValue"] | "", sizeof(command.status));
  command.action = strcmp(action, "OPEN") == 0 ? CommandAction::Open : CommandAction::Close;
  return true;
}

bool markCommandExecuting(
    const DeviceBinding& binding,
    const char* commandId,
    int& httpCode) {
  char url[768] = {};
  snprintf(
      url,
      sizeof(url),
      "https://firestore.googleapis.com/v1/projects/%s/databases/(default)/documents/users/%s/gates/%s/commands/%s"
      "?updateMask.fieldPaths=status&key=%s",
      DILIG_FIREBASE_PROJECT_ID,
      binding.userId,
      binding.gateId,
      commandId,
      DILIG_FIREBASE_API_KEY);
  constexpr char payload[] = "{\"fields\":{\"status\":{\"stringValue\":\"executing\"}}}";
  return sendJson("PATCH", url, payload, strlen(payload), httpCode);
}

bool reportPosition(
    const DeviceBinding& binding,
    const PhysicalState state,
    int& httpCode) {
  if (state != PhysicalState::Open && state != PhysicalState::Closed &&
      state != PhysicalState::Error) {
    return true;
  }
  char url[768] = {};
  snprintf(
      url,
      sizeof(url),
      "https://firestore.googleapis.com/v1/projects/%s/databases/(default)/documents/users/%s/gates/%s"
      "?updateMask.fieldPaths=reportedState&updateMask.fieldPaths=updatedAt&key=%s",
      DILIG_FIREBASE_PROJECT_ID,
      binding.userId,
      binding.gateId,
      DILIG_FIREBASE_API_KEY);
  const int64_t now = epochMs();
  char payload[320] = {};
  const int length = snprintf(
      payload,
      sizeof(payload),
      "{\"fields\":{\"reportedState\":{\"stringValue\":\"%s\"},"
      "\"updatedAt\":{\"integerValue\":\"%lld\"}}}",
      firestoreState(state),
      static_cast<long long>(now));
  return length > 0 && static_cast<size_t>(length) < sizeof(payload) &&
         sendJson("PATCH", url, payload, static_cast<size_t>(length), httpCode);
}

bool commitMotorResult(
    const DeviceBinding& binding,
    const MotorResult& result,
    int& httpCode) {
  char url[384] = {};
  snprintf(
      url,
      sizeof(url),
      "https://firestore.googleapis.com/v1/projects/%s/databases/(default)/documents:commit?key=%s",
      DILIG_FIREBASE_PROJECT_ID,
      DILIG_FIREBASE_API_KEY);
  const int64_t now = epochMs();
  const char* commandStatus = result.success ? "succeeded" : "failed";
  const char* gateState = result.success ? firestoreState(result.state) : "error";
  char errorField[160] = {};
  if (result.success) {
    strlcpy(errorField, "{\"nullValue\":null}", sizeof(errorField));
  } else {
    snprintf(
        errorField,
        sizeof(errorField),
        "{\"stringValue\":\"%s\"}",
        strlen(result.error) > 0 ? result.error : "Actuator safety stop");
  }
  char payload[2600] = {};
  const int length = snprintf(
      payload,
      sizeof(payload),
      "{\"writes\":["
      "{\"update\":{\"name\":\"projects/%s/databases/(default)/documents/users/%s/gates/%s/commands/%s\","
      "\"fields\":{\"status\":{\"stringValue\":\"%s\"},"
      "\"completedAt\":{\"integerValue\":\"%lld\"},"
      "\"errorMessage\":%s}},"
      "\"updateMask\":{\"fieldPaths\":[\"status\",\"completedAt\",\"errorMessage\"]}},"
      "{\"update\":{\"name\":\"projects/%s/databases/(default)/documents/users/%s/gates/%s\","
      "\"fields\":{\"reportedState\":{\"stringValue\":\"%s\"},"
      "\"pendingCommandId\":{\"nullValue\":null},"
      "\"updatedAt\":{\"integerValue\":\"%lld\"}}},"
      "\"updateMask\":{\"fieldPaths\":[\"reportedState\",\"pendingCommandId\",\"updatedAt\"]}}]}",
      DILIG_FIREBASE_PROJECT_ID,
      binding.userId,
      binding.gateId,
      result.commandId,
      commandStatus,
      static_cast<long long>(now),
      errorField,
      DILIG_FIREBASE_PROJECT_ID,
      binding.userId,
      binding.gateId,
      gateState,
      static_cast<long long>(now));
  return length > 0 && static_cast<size_t>(length) < sizeof(payload) &&
         sendJson("POST", url, payload, static_cast<size_t>(length), httpCode);
}

void motorTask(void*) {
  esp_task_wdt_add(nullptr);
  digitalWrite(config::RELAY_OPEN_PIN, config::RELAY_OFF_LEVEL);
  digitalWrite(config::RELAY_CLOSE_PIN, config::RELAY_OFF_LEVEL);
  pinMode(config::RELAY_OPEN_PIN, OUTPUT);
  pinMode(config::RELAY_CLOSE_PIN, OUTPUT);
  stopMotor();

  DebouncedLimit openLimit(config::LIMIT_OPEN_PIN);
  DebouncedLimit closedLimit(config::LIMIT_CLOSED_PIN);
  openLimit.begin();
  closedLimit.begin();

  MotorCommand activeCommand{};
  bool moving = false;
  uint32_t motionStartedMs = 0;
  uint32_t lastDisplayMs = 0;
  uint32_t lastStackLogMs = 0;
  CommandAction activeAction = CommandAction::Open;
  PhysicalState lastPublishedState = PhysicalState::Unknown;
  UiStatus ui{};

  for (;;) {
    const uint32_t now = millis();
    openLimit.update(now);
    closedLimit.update(now);
    const bool openTriggered = openLimit.triggered();
    const bool closedTriggered = closedLimit.triggered();

    UiStatus incomingUi{};
    while (xQueueReceive(g_uiQueue, &incomingUi, 0) == pdTRUE) ui = incomingUi;

    if (!moving) {
      MotorCommand command{};
      if (xQueueReceive(g_commandQueue, &command, 0) == pdTRUE) {
        activeCommand = command;
        activeAction = command.action;
        if (openTriggered && closedTriggered) {
          stopMotor();
          publishMotorResult(command, false, PhysicalState::Error, "Conflicting limit switches");
        } else if ((command.action == CommandAction::Open && openTriggered) ||
                   (command.action == CommandAction::Close && closedTriggered)) {
          stopMotor();
          publishMotorResult(
              command,
              true,
              command.action == CommandAction::Open ? PhysicalState::Open : PhysicalState::Closed,
              "");
        } else {
          driveMotor(command.action);
          moving = true;
          motionStartedMs = now;
          Serial.printf(
              "[motor] %s command started\n",
              command.action == CommandAction::Open ? "OPEN" : "CLOSE");
        }
      }
    } else {
      const bool targetReached =
          (activeAction == CommandAction::Open && openTriggered) ||
          (activeAction == CommandAction::Close && closedTriggered);
      if (openTriggered && closedTriggered) {
        stopMotor();
        moving = false;
        publishMotorResult(activeCommand, false, PhysicalState::Error, "Conflicting limit switches");
      } else if (targetReached) {
        stopMotor();
        moving = false;
        publishMotorResult(
            activeCommand,
            true,
            activeAction == CommandAction::Open ? PhysicalState::Open : PhysicalState::Closed,
            "");
      } else if (now - motionStartedMs >= config::MAX_MOTOR_TRAVEL_MS) {
        stopMotor();
        moving = false;
        publishMotorResult(activeCommand, false, PhysicalState::Error, "Motor travel timeout");
      }
    }

    const PhysicalState physicalState = derivePhysicalState(openTriggered, closedTriggered, moving);
    if (physicalState != lastPublishedState) {
      publishPhysicalState(physicalState);
      lastPublishedState = physicalState;
    }
    if (now - lastDisplayMs >= config::DISPLAY_REFRESH_INTERVAL_MS) {
      renderDisplay(physicalState, activeAction, moving, ui);
      lastDisplayMs = now;
    }
    if (now - lastStackLogMs >= 60000) {
      Serial.printf(
          "[health] motor stack headroom=%u, heap=%u\n",
          static_cast<unsigned>(uxTaskGetStackHighWaterMark(nullptr)),
          static_cast<unsigned>(ESP.getFreeHeap()));
      lastStackLogMs = now;
    }
    esp_task_wdt_reset();
    vTaskDelay(pdMS_TO_TICKS(10));
  }
}

void cloudTask(void*) {
  esp_task_wdt_add(nullptr);
  if (!configurationPresent()) {
    Serial.println(F("[config] create secrets.h with Wi-Fi and Firebase Web API key"));
    for (;;) {
      esp_task_wdt_reset();
      vTaskDelay(pdMS_TO_TICKS(1000));
    }
  }

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.persistent(false);

  DeviceBinding binding{};
  UiStatus ui{};
  PhysicalState physicalState = PhysicalState::Unknown;
  PhysicalState lastReportedPosition = PhysicalState::Unknown;
  MotorResult pendingResult{};
  bool hasPendingResult = false;
  bool commandInFlight = false;
  uint32_t lastWifiAttemptMs = 0;
  uint32_t lastBindingAttemptMs = 0;
  uint32_t lastHeartbeatMs = 0;
  uint32_t lastGatePollMs = 0;
  bool timeSyncStarted = false;

  for (;;) {
    const uint32_t now = millis();
    const bool wifiConnected = WiFi.status() == WL_CONNECTED;
    ui.wifiConnected = wifiConnected;

    PhysicalSnapshot physical{};
    while (xQueueReceive(g_physicalQueue, &physical, 0) == pdTRUE) {
      physicalState = physical.state;
    }
    if (!hasPendingResult && xQueueReceive(g_resultQueue, &pendingResult, 0) == pdTRUE) {
      hasPendingResult = true;
    }

    if (!wifiConnected &&
        (lastWifiAttemptMs == 0 || now - lastWifiAttemptMs >= config::WIFI_RECONNECT_INTERVAL_MS)) {
      WiFi.begin(DILIG_WIFI_SSID, DILIG_WIFI_PASSWORD);
      lastWifiAttemptMs = now;
      // Keep the gate/owner snapshot stable until an active motor result has
      // been committed. Re-resolving mid-travel could otherwise target a gate
      // that an administrator reassigned while the actuator was moving.
      if (!commandInFlight && !hasPendingResult) binding = DeviceBinding{};
    }
    if (wifiConnected && !timeSyncStarted) {
      configTime(0, 0, "pool.ntp.org", "time.google.com");
      timeSyncStarted = true;
    }
    const bool clockValid = time(nullptr) >= 1700000000;

    int httpCode = 0;
    if (wifiConnected && clockValid && !commandInFlight && !hasPendingResult &&
        (!binding.registered || now - lastBindingAttemptMs >= config::HEARTBEAT_INTERVAL_MS)) {
      esp_task_wdt_reset();
      if (!resolveBinding(binding, httpCode)) {
        if (httpCode == HTTP_CODE_NOT_FOUND) binding = DeviceBinding{};
      }
      esp_task_wdt_reset();
      lastBindingAttemptMs = millis();
      ui.registered = binding.registered;
      ui.assigned = binding.assigned;
      if (!binding.assigned) ui.gateName[0] = '\0';
    }

    if (binding.registered && wifiConnected && clockValid &&
        (lastHeartbeatMs == 0 || now - lastHeartbeatMs >= config::HEARTBEAT_INTERVAL_MS)) {
      esp_task_wdt_reset();
      sendHeartbeat(binding, httpCode);
      esp_task_wdt_reset();
      lastHeartbeatMs = millis();
    }

    if (hasPendingResult && binding.assigned && wifiConnected && clockValid) {
      esp_task_wdt_reset();
      if (commitMotorResult(binding, pendingResult, httpCode)) {
        Serial.printf("[cloud] command %s completed\n", pendingResult.commandId);
        hasPendingResult = false;
        commandInFlight = false;
        lastReportedPosition = pendingResult.success ? pendingResult.state : PhysicalState::Error;
      }
      esp_task_wdt_reset();
    }

    if (!hasPendingResult && binding.assigned && wifiConnected && clockValid &&
        (lastGatePollMs == 0 || now - lastGatePollMs >= config::GATE_POLL_INTERVAL_MS)) {
      GateSnapshot gate{};
      esp_task_wdt_reset();
      if (fetchGate(binding, gate, httpCode)) {
        strlcpy(ui.gateName, gate.name, sizeof(ui.gateName));
        ui.assigned = true;

        if (!commandInFlight && strlen(gate.pendingCommandId) > 0) {
          CommandSnapshot command{};
          esp_task_wdt_reset();
          if (fetchCommand(binding, gate.pendingCommandId, command, httpCode)) {
            if (strcmp(command.status, "pending") == 0) {
              esp_task_wdt_reset();
              if (markCommandExecuting(binding, command.id, httpCode)) {
                MotorCommand motorCommand{};
                motorCommand.action = command.action;
                strlcpy(motorCommand.commandId, command.id, sizeof(motorCommand.commandId));
                if (xQueueSend(g_commandQueue, &motorCommand, 0) == pdTRUE) {
                  commandInFlight = true;
                }
              }
              esp_task_wdt_reset();
            } else if (strcmp(command.status, "executing") == 0) {
              MotorResult restartFailure{};
              strlcpy(restartFailure.commandId, command.id, sizeof(restartFailure.commandId));
              restartFailure.state = PhysicalState::Error;
              restartFailure.success = false;
              strlcpy(
                  restartFailure.error,
                  "Controller restarted during movement",
                  sizeof(restartFailure.error));
              pendingResult = restartFailure;
              hasPendingResult = true;
              commandInFlight = true;
            }
          }
        } else if (!commandInFlight && strlen(gate.pendingCommandId) == 0 &&
                   physicalState != PhysicalState::Unknown &&
                   physicalState != PhysicalState::Moving &&
                   physicalState != lastReportedPosition) {
          esp_task_wdt_reset();
          if (reportPosition(binding, physicalState, httpCode)) {
            lastReportedPosition = physicalState;
          }
          esp_task_wdt_reset();
        }
      } else if (httpCode == HTTP_CODE_FORBIDDEN || httpCode == HTTP_CODE_NOT_FOUND) {
        binding.assigned = false;
        ui.assigned = false;
      }
      esp_task_wdt_reset();
      lastGatePollMs = millis();
    }

    xQueueOverwrite(g_uiQueue, &ui);
    esp_task_wdt_reset();
    vTaskDelay(pdMS_TO_TICKS(100));
  }
}

}  // namespace

void setup() {
  Serial.begin(115200);
  buildDeviceId();
  Serial.println();
  Serial.println(F("DILIG gate actuator starting"));
  Serial.printf("Device ID: %s\n", g_deviceId);

  // Relays are forced off before either task can run.
  digitalWrite(config::RELAY_OPEN_PIN, config::RELAY_OFF_LEVEL);
  digitalWrite(config::RELAY_CLOSE_PIN, config::RELAY_OFF_LEVEL);
  pinMode(config::RELAY_OPEN_PIN, OUTPUT);
  pinMode(config::RELAY_CLOSE_PIN, OUTPUT);
  stopMotor();

  Wire.begin(config::OLED_SDA_PIN, config::OLED_SCL_PIN);
  g_displayAvailable = g_display.begin(SSD1306_SWITCHCAPVCC, config::OLED_I2C_ADDRESS);
  if (!g_displayAvailable) {
    Serial.println(F("[oled] SSD1306 not detected; continuing without display"));
  }

  g_commandQueue = xQueueCreate(1, sizeof(MotorCommand));
  g_resultQueue = xQueueCreate(2, sizeof(MotorResult));
  g_physicalQueue = xQueueCreate(1, sizeof(PhysicalSnapshot));
  g_uiQueue = xQueueCreate(1, sizeof(UiStatus));
  if (g_commandQueue == nullptr || g_resultQueue == nullptr ||
      g_physicalQueue == nullptr || g_uiQueue == nullptr) {
    stopMotor();
    ESP.restart();
  }

  esp_task_wdt_init(config::WATCHDOG_TIMEOUT_SECONDS, true);
  const BaseType_t motorCreated = xTaskCreatePinnedToCore(
      motorTask,
      "motor",
      config::MOTOR_TASK_STACK_BYTES,
      nullptr,
      config::MOTOR_TASK_PRIORITY,
      nullptr,
      1);
  const BaseType_t cloudCreated = xTaskCreatePinnedToCore(
      cloudTask,
      "cloud",
      config::CLOUD_TASK_STACK_BYTES,
      nullptr,
      config::CLOUD_TASK_PRIORITY,
      nullptr,
      0);
  if (motorCreated != pdPASS || cloudCreated != pdPASS) {
    stopMotor();
    ESP.restart();
  }
}

void loop() {
  vTaskDelay(pdMS_TO_TICKS(1000));
}

