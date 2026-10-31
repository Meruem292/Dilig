#include <Arduino.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <ArduinoJson.h>
#include <DallasTemperature.h>
#include <HTTPClient.h>
#include <OneWire.h>
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
constexpr size_t USER_ID_CAPACITY = 128;
constexpr size_t DOCUMENT_ID_CAPACITY = 128;

enum class CloudState : uint8_t {
  Waiting,
  Sent,
  Unregistered,
  Error,
};

struct TelemetrySample {
  char deviceId[DEVICE_ID_CAPACITY];
  float soilTemperatureC;
  float soilMoisturePercent;
  bool temperatureAvailable;
  uint16_t soilRaw;
  uint32_t sequence;
};

struct CloudResult {
  CloudState state;
  int16_t httpCode;
};

struct DeviceBinding {
  char userId[USER_ID_CAPACITY];
  char deviceDocId[DOCUMENT_ID_CAPACITY];
  bool resolved;
};

char g_deviceId[DEVICE_ID_CAPACITY] = {};
QueueHandle_t g_telemetryQueue = nullptr;
QueueHandle_t g_cloudResultQueue = nullptr;

OneWire g_oneWire(config::DS18B20_PIN);
DallasTemperature g_temperatureSensor(&g_oneWire);
Adafruit_SSD1306 g_display(
    config::OLED_WIDTH,
    config::OLED_HEIGHT,
    &Wire,
    -1);
bool g_displayAvailable = false;

void buildDeviceId() {
  const uint64_t chipId = ESP.getEfuseMac() & 0x0000FFFFFFFFFFFFULL;
  snprintf(
      g_deviceId,
      sizeof(g_deviceId),
      "DILIG-SEN-%012llX",
      static_cast<unsigned long long>(chipId));
}

bool configurationPresent() {
  return strlen(DILIG_WIFI_SSID) > 0 &&
         strlen(DILIG_FIREBASE_PROJECT_ID) > 0 &&
         strlen(DILIG_FIREBASE_API_KEY) > 0 &&
         strcmp(DILIG_FIREBASE_API_KEY, "YOUR_FIREBASE_WEB_API_KEY") != 0;
}

uint16_t readAveragedSoilAdc() {
  uint32_t total = 0;
  for (uint8_t index = 0; index < config::SOIL_SAMPLE_COUNT; ++index) {
    total += static_cast<uint16_t>(analogRead(config::SOIL_SENSOR_PIN));
  }
  return static_cast<uint16_t>(total / config::SOIL_SAMPLE_COUNT);
}

float soilRawToPercent(const uint16_t raw) {
  const float span = static_cast<float>(config::SOIL_RAW_DRY - config::SOIL_RAW_WET);
  if (span <= 0.0F) {
    return NAN;
  }

  const float percent =
      (static_cast<float>(config::SOIL_RAW_DRY) - static_cast<float>(raw)) * 100.0F / span;
  return constrain(percent, 0.0F, 100.0F);
}

bool validTemperature(const float temperatureC) {
  return isfinite(temperatureC) && temperatureC >= -40.0F && temperatureC <= 85.0F &&
         temperatureC != DEVICE_DISCONNECTED_C;
}

const char* cloudStateLabel(const CloudResult& result) {
  switch (result.state) {
    case CloudState::Sent:
      return "Cloud: OK";
    case CloudState::Unregistered:
      return "Cloud: REGISTER ID";
    case CloudState::Error:
      return "Cloud: ERROR";
    case CloudState::Waiting:
    default:
      return "Cloud: waiting";
  }
}

void renderDisplay(
    const float temperatureC,
    const float moisturePercent,
    const uint16_t soilRaw,
    const CloudResult& cloudResult) {
  if (!g_displayAvailable) {
    return;
  }

  g_display.clearDisplay();
  g_display.setTextColor(SSD1306_WHITE);
  g_display.setTextSize(1);
  g_display.setCursor(0, 0);
  g_display.println(F("DILIG SOIL SENSOR"));
  g_display.println(F("ID DILIG-SEN-"));
  g_display.println(g_deviceId + strlen("DILIG-SEN-"));

  g_display.print(F("Temp: "));
  if (validTemperature(temperatureC)) {
    g_display.print(temperatureC, 1);
    g_display.println(F(" C"));
  } else {
    g_display.println(F("sensor error"));
  }

  g_display.print(F("Moist: "));
  if (isfinite(moisturePercent)) {
    g_display.print(moisturePercent, 1);
    g_display.print(F("% "));
    g_display.println(soilRaw);
  } else {
    g_display.println(F("calibrate"));
  }

  g_display.print(WiFi.status() == WL_CONNECTED ? F("WiFi OK | ") : F("WiFi -- | "));
  g_display.println(cloudStateLabel(cloudResult) + strlen("Cloud: "));
  g_display.display();
}

void publishCloudResult(const CloudState state, const int httpCode) {
  const CloudResult result{state, static_cast<int16_t>(httpCode)};
  xQueueOverwrite(g_cloudResultQueue, &result);
}

bool resolveDeviceBinding(DeviceBinding& binding, int& httpCode) {
  char url[512] = {};
  const int urlLength = snprintf(
      url,
      sizeof(url),
      "https://firestore.googleapis.com/v1/projects/%s/databases/(default)/documents/"
      "deviceRegistry/%s?key=%s",
      DILIG_FIREBASE_PROJECT_ID,
      g_deviceId,
      DILIG_FIREBASE_API_KEY);

  if (urlLength <= 0 || static_cast<size_t>(urlLength) >= sizeof(url)) {
    httpCode = -1;
    return false;
  }

  WiFiClientSecure client;
  client.setCACert(GOOGLE_TRUST_SERVICES_ROOT_R4);

  HTTPClient http;
  http.setConnectTimeout(config::HTTP_TIMEOUT_MS);
  http.setTimeout(config::HTTP_TIMEOUT_MS);
  if (!http.begin(client, url)) {
    httpCode = -2;
    return false;
  }

  const char* responseHeaders[] = {"Content-Type"};
  http.collectHeaders(responseHeaders, 1);
  httpCode = http.GET();
  if (httpCode != HTTP_CODE_OK) {
    http.end();
    return false;
  }

  // Read the small exact-document response before parsing it. This avoids a
  // partially available/chunked stream being mistaken for malformed JSON.
  const String response = http.getString();
  const String contentType = http.header("Content-Type");
  JsonDocument document;
  const DeserializationError jsonError = deserializeJson(document, response);
  if (jsonError) {
    Serial.printf(
        "[cloud] registry JSON error: %s (content-type=%s, bytes=%u)\n",
        jsonError.c_str(),
        contentType.c_str(),
        static_cast<unsigned>(response.length()));
    http.end();
    httpCode = -4;
    return false;
  }

  const char* registeredDeviceId = document["fields"]["deviceId"]["stringValue"] | "";
  const char* userId = document["fields"]["userId"]["stringValue"] | "";
  const char* deviceDocId = document["fields"]["deviceDocId"]["stringValue"] | "";
  const char* deviceType = document["fields"]["type"]["stringValue"] | "";

  const bool validBinding = strcmp(registeredDeviceId, g_deviceId) == 0 &&
                            strcmp(deviceType, "sensor") == 0 &&
                            strlen(userId) > 0 &&
                            strlen(deviceDocId) > 0 &&
                            strlen(userId) < sizeof(binding.userId) &&
                            strlen(deviceDocId) < sizeof(binding.deviceDocId);
  if (validBinding) {
    strlcpy(binding.userId, userId, sizeof(binding.userId));
    strlcpy(binding.deviceDocId, deviceDocId, sizeof(binding.deviceDocId));
    binding.resolved = true;
  }

  http.end();
  if (!validBinding) {
    httpCode = -5;
  }
  return validBinding;
}

bool commitTelemetry(
    const TelemetrySample& sample,
    const DeviceBinding& binding,
    int& httpCode) {
  const int64_t timestampMs = static_cast<int64_t>(time(nullptr)) * 1000LL +
                              static_cast<int64_t>(millis() % 1000UL);

  char url[384] = {};
  const int urlLength = snprintf(
      url,
      sizeof(url),
      "https://firestore.googleapis.com/v1/projects/%s/databases/(default)/documents:commit?key=%s",
      DILIG_FIREBASE_PROJECT_ID,
      DILIG_FIREBASE_API_KEY);

  if (urlLength <= 0 || static_cast<size_t>(urlLength) >= sizeof(url)) {
    httpCode = -1;
    return false;
  }

  char temperatureValue[48] = {};
  if (sample.temperatureAvailable) {
    snprintf(
        temperatureValue,
        sizeof(temperatureValue),
        "\"doubleValue\":%.2f",
        static_cast<double>(sample.soilTemperatureC));
  } else {
    strlcpy(temperatureValue, "\"nullValue\":null", sizeof(temperatureValue));
  }

  char payload[2300] = {};
  const int payloadLength = snprintf(
      payload,
      sizeof(payload),
      "{\"writes\":["
      "{\"update\":{\"name\":\"projects/%s/databases/(default)/documents/users/%s/devices/%s/readings/latest\","
      "\"fields\":{"
      "\"deviceId\":{\"stringValue\":\"%s\"},"
      "\"soilTemperatureC\":{%s},"
      "\"soilMoisturePercent\":{\"doubleValue\":%.2f},"
      "\"recordedAt\":{\"integerValue\":\"%lld\"}}}},"
      "{\"update\":{\"name\":\"projects/%s/databases/(default)/documents/users/%s/devices/%s\","
      "\"fields\":{"
      "\"status\":{\"stringValue\":\"online\"},"
      "\"lastSeenAt\":{\"integerValue\":\"%lld\"},"
      "\"updatedAt\":{\"integerValue\":\"%lld\"},"
      "\"latestReading\":{\"mapValue\":{\"fields\":{"
      "\"deviceId\":{\"stringValue\":\"%s\"},"
      "\"soilTemperatureC\":{%s},"
      "\"soilMoisturePercent\":{\"doubleValue\":%.2f},"
      "\"recordedAt\":{\"integerValue\":\"%lld\"}}}}}},"
      "\"updateMask\":{\"fieldPaths\":[\"status\",\"lastSeenAt\",\"updatedAt\",\"latestReading\"]}}]}",
      DILIG_FIREBASE_PROJECT_ID,
      binding.userId,
      binding.deviceDocId,
      sample.deviceId,
      temperatureValue,
      static_cast<double>(sample.soilMoisturePercent),
      static_cast<long long>(timestampMs),
      DILIG_FIREBASE_PROJECT_ID,
      binding.userId,
      binding.deviceDocId,
      static_cast<long long>(timestampMs),
      static_cast<long long>(timestampMs),
      sample.deviceId,
      temperatureValue,
      static_cast<double>(sample.soilMoisturePercent),
      static_cast<long long>(timestampMs));

  if (payloadLength <= 0 || static_cast<size_t>(payloadLength) >= sizeof(payload)) {
    httpCode = -1;
    return false;
  }

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
  httpCode = http.POST(reinterpret_cast<uint8_t*>(payload), payloadLength);
  http.end();

  return httpCode >= 200 && httpCode < 300;
}

void sensorTask(void*) {
  esp_task_wdt_add(nullptr);

  analogReadResolution(12);
  analogSetPinAttenuation(config::SOIL_SENSOR_PIN, ADC_11db);

  g_temperatureSensor.begin();
  g_temperatureSensor.setResolution(12);
  g_temperatureSensor.setWaitForConversion(false);

  float temperatureC = NAN;
  float moisturePercent = NAN;
  uint16_t soilRaw = 0;
  bool temperaturePending = false;
  uint32_t temperatureRequestMs = 0;
  uint32_t lastTemperatureCycleMs = 0;
  uint32_t lastSoilSampleMs = 0;
  uint32_t lastTelemetryMs = 0;
  uint32_t lastDisplayMs = 0;
  uint32_t lastResourceReportMs = 0;
  uint32_t sequence = 0;
  CloudResult cloudResult{CloudState::Waiting, 0};

  for (;;) {
    const uint32_t now = millis();

    CloudResult incomingResult{};
    while (xQueueReceive(g_cloudResultQueue, &incomingResult, 0) == pdTRUE) {
      cloudResult = incomingResult;
    }

    if (!temperaturePending && now - lastTemperatureCycleMs >= config::TEMPERATURE_SAMPLE_INTERVAL_MS) {
      g_temperatureSensor.requestTemperatures();
      temperaturePending = true;
      temperatureRequestMs = now;
      lastTemperatureCycleMs = now;
    }

    if (temperaturePending && now - temperatureRequestMs >= config::DS18B20_CONVERSION_TIME_MS) {
      const float candidate = g_temperatureSensor.getTempCByIndex(0);
      temperatureC = validTemperature(candidate) ? candidate : NAN;
      temperaturePending = false;
    }

    if (now - lastSoilSampleMs >= config::SOIL_SAMPLE_INTERVAL_MS) {
      soilRaw = readAveragedSoilAdc();
      moisturePercent = soilRawToPercent(soilRaw);
      lastSoilSampleMs = now;

      Serial.printf(
          "[sensor] temperature=%.2f C, soilRaw=%u, moisture=%.1f%%\n",
          static_cast<double>(temperatureC),
          soilRaw,
          static_cast<double>(moisturePercent));
    }

    if (isfinite(moisturePercent) &&
        (lastTelemetryMs == 0 || now - lastTelemetryMs >= config::TELEMETRY_INTERVAL_MS)) {
      TelemetrySample sample{};
      strlcpy(sample.deviceId, g_deviceId, sizeof(sample.deviceId));
      sample.soilTemperatureC = temperatureC;
      sample.soilMoisturePercent = moisturePercent;
      sample.temperatureAvailable = validTemperature(temperatureC);
      sample.soilRaw = soilRaw;
      sample.sequence = ++sequence;
      xQueueOverwrite(g_telemetryQueue, &sample);
      lastTelemetryMs = now;
    }

    if (now - lastDisplayMs >= config::DISPLAY_REFRESH_INTERVAL_MS) {
      renderDisplay(temperatureC, moisturePercent, soilRaw, cloudResult);
      lastDisplayMs = now;
    }

    if (lastResourceReportMs == 0 || now - lastResourceReportMs >= 60000) {
      Serial.printf(
          "[health] sensor stack free: %lu bytes\n",
          static_cast<unsigned long>(uxTaskGetStackHighWaterMark(nullptr) * sizeof(StackType_t)));
      lastResourceReportMs = now;
    }

    esp_task_wdt_reset();
    vTaskDelay(pdMS_TO_TICKS(20));
  }
}

void cloudTask(void*) {
  esp_task_wdt_add(nullptr);

  if (!configurationPresent()) {
    publishCloudResult(CloudState::Error, -3);
    for (;;) {
      esp_task_wdt_reset();
      vTaskDelay(pdMS_TO_TICKS(1000));
    }
  }

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.persistent(false);
  // Keeps the station responsive while the cloud task is waiting for TLS or
  // NTP; sensor sampling remains isolated on Core 1.
  WiFi.setSleep(false);

  TelemetrySample pendingSample{};
  DeviceBinding binding{};
  bool hasPendingSample = false;
  bool wasWifiConnected = false;
  uint32_t lastWifiAttemptMs = 0;
  uint32_t lastCloudAttemptMs = 0;
  uint32_t lastResourceReportMs = 0;
  bool timeSyncStarted = false;

  for (;;) {
    TelemetrySample incomingSample{};
    while (xQueueReceive(g_telemetryQueue, &incomingSample, 0) == pdTRUE) {
      pendingSample = incomingSample;
      hasPendingSample = true;
    }

    const uint32_t now = millis();
    const bool wifiConnected = WiFi.status() == WL_CONNECTED;
    if (wifiConnected && !wasWifiConnected) {
      Serial.printf(
          "[wifi] connected, IP=%s, RSSI=%d dBm\n",
          WiFi.localIP().toString().c_str(),
          WiFi.RSSI());
    } else if (!wifiConnected && wasWifiConnected) {
      Serial.println(F("[wifi] connection lost; reconnecting"));
      binding.resolved = false;
    }
    wasWifiConnected = wifiConnected;

    if (!wifiConnected &&
        (lastWifiAttemptMs == 0 || now - lastWifiAttemptMs >= config::WIFI_RECONNECT_INTERVAL_MS)) {
      Serial.printf("[wifi] connecting to %s\n", DILIG_WIFI_SSID);
      WiFi.begin(DILIG_WIFI_SSID, DILIG_WIFI_PASSWORD);
      lastWifiAttemptMs = now;
    }

    if (wifiConnected && !timeSyncStarted) {
      configTime(0, 0, "pool.ntp.org", "time.google.com");
      timeSyncStarted = true;
      Serial.println(F("[time] NTP synchronization started"));
    }

    const bool clockValid = time(nullptr) >= 1700000000;

    if (hasPendingSample && wifiConnected && clockValid &&
        (lastCloudAttemptMs == 0 || now - lastCloudAttemptMs >= config::CLOUD_RETRY_INTERVAL_MS)) {
      esp_task_wdt_reset();
      int httpCode = 0;

      if (!binding.resolved) {
        if (!resolveDeviceBinding(binding, httpCode)) {
          lastCloudAttemptMs = millis();
          if (httpCode == HTTP_CODE_NOT_FOUND) {
            Serial.printf("[cloud] register %s in the DILIG web app\n", g_deviceId);
            publishCloudResult(CloudState::Unregistered, httpCode);
          } else {
            Serial.printf("[cloud] device lookup failed, HTTP %d\n", httpCode);
            publishCloudResult(CloudState::Error, httpCode);
          }
          esp_task_wdt_reset();
          vTaskDelay(pdMS_TO_TICKS(100));
          continue;
        }

        Serial.println(F("[cloud] device owner resolved from Firestore registry"));
      }

      const bool sent = commitTelemetry(pendingSample, binding, httpCode);
      lastCloudAttemptMs = millis();

      if (sent) {
        Serial.printf(
            "[cloud] telemetry #%lu sent, HTTP %d\n",
            static_cast<unsigned long>(pendingSample.sequence),
            httpCode);
        publishCloudResult(CloudState::Sent, httpCode);
        hasPendingSample = false;
      } else if (httpCode == HTTP_CODE_NOT_FOUND || httpCode == HTTP_CODE_FORBIDDEN) {
        binding.resolved = false;
        Serial.printf("[cloud] registration rejected, HTTP %d; resolving again\n", httpCode);
        publishCloudResult(CloudState::Unregistered, httpCode);
      } else {
        Serial.printf("[cloud] telemetry failed, HTTP %d; retrying latest sample\n", httpCode);
        publishCloudResult(CloudState::Error, httpCode);
      }
    }

    if (lastResourceReportMs == 0 || now - lastResourceReportMs >= 60000) {
      Serial.printf(
          "[health] cloud stack free: %lu bytes, heap: %u bytes\n",
          static_cast<unsigned long>(uxTaskGetStackHighWaterMark(nullptr) * sizeof(StackType_t)),
          ESP.getFreeHeap());
      lastResourceReportMs = now;
    }

    esp_task_wdt_reset();
    vTaskDelay(pdMS_TO_TICKS(100));
  }
}

}  // namespace

void setup() {
  Serial.begin(115200);
  buildDeviceId();

  Serial.println();
  Serial.println(F("DILIG soil sensor starting"));
  Serial.printf("Device ID: %s\n", g_deviceId);

  Wire.begin(config::OLED_SDA_PIN, config::OLED_SCL_PIN);
  g_displayAvailable = g_display.begin(SSD1306_SWITCHCAPVCC, config::OLED_I2C_ADDRESS);
  if (!g_displayAvailable) {
    Serial.println(F("[oled] SSD1306 not detected; continuing without display"));
  }

  if (!configurationPresent()) {
    Serial.println(F("[config] create include/secrets.h and set Wi-Fi plus Firebase Web API key"));
  }

  g_telemetryQueue = xQueueCreate(1, sizeof(TelemetrySample));
  g_cloudResultQueue = xQueueCreate(1, sizeof(CloudResult));
  if (g_telemetryQueue == nullptr || g_cloudResultQueue == nullptr) {
    Serial.println(F("[fatal] failed to allocate FreeRTOS queues"));
    ESP.restart();
  }

  esp_task_wdt_init(config::WATCHDOG_TIMEOUT_SECONDS, true);

  const BaseType_t sensorCreated = xTaskCreatePinnedToCore(
      sensorTask,
      "sensor",
      config::SENSOR_TASK_STACK_WORDS,
      nullptr,
      config::SENSOR_TASK_PRIORITY,
      nullptr,
      1);
  const BaseType_t cloudCreated = xTaskCreatePinnedToCore(
      cloudTask,
      "cloud",
      config::CLOUD_TASK_STACK_WORDS,
      nullptr,
      config::CLOUD_TASK_PRIORITY,
      nullptr,
      0);

  if (sensorCreated != pdPASS || cloudCreated != pdPASS) {
    Serial.println(F("[fatal] failed to create firmware tasks"));
    ESP.restart();
  }
}

void loop() {
  vTaskDelay(pdMS_TO_TICKS(1000));
}

