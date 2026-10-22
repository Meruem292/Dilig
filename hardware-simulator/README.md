# Dilig Hardware Integration & Simulation Guide

This folder contains the communication specifications and virtual hardware runners for the **Dilig** smart irrigation system.

---

## 1. Quick Virtual Hardware Testing

If you do not have physical ESP32 or Arduino microcontrollers on hand, you can simulate real telemetry and motorized gate execution using the provided Node.js scripts.

### Prerequisites
1. Fill in your Firebase credentials in `.env` at the project root.
2. Run the Dilig web app (`npm run dev`) and sign in or create an account.
3. In Dilig:
   - Go to **Devices** &rarr; Register a Soil Sensor with ID `SEN-001`.
   - Go to **Devices** &rarr; Register a Gate Actuator with ID `ACT-001`.
   - Go to **Gates** &rarr; Create an irrigation gate (e.g. "North Field Gate") and assign `ACT-001` as the actuator.
4. Click your profile avatar in the header to view your **User ID (UID)**.

### Run Virtual Soil Sensor
```bash
npm run sim:sensor YOUR_USER_ID SEN-001
```
*This transmits realistic soil temperature (°C) and moisture (%) telemetry every 10 seconds. You will see the Home Dashboard soil cards update dynamically in real time.*

### Run Virtual Gate Actuator
```bash
npm run sim:actuator YOUR_USER_ID ACT-001
```
*This connects to your actuator device, transmits online heartbeats, and listens for Open/Close commands. When you click **Open Gate** in Dilig, the simulator receives the command, simulates a 3.5-second motor travel delay, and reports back that the gate has opened.*

---

## 2. Microcontroller Hardware Protocol (ESP32 / ESP8266 / Arduino)

Dilig devices communicate via either:
1. **HTTP REST Webhooks** (via Firebase Cloud Functions in `functions/` or custom server)
2. **Direct Firestore Modular SDK / REST API**

### Sensor Telemetry Payload (HTTP POST)
Endpoint: `https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/recordTelemetry`

```json
{
  "userId": "YOUR_FIREBASE_UID",
  "deviceId": "SEN-001",
  "soilTemperatureC": 25.8,
  "soilMoisturePercent": 52.4
}
```

### Actuator Poll & Execution Protocol
1. Actuator checks for pending command:
   `GET https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/getPendingCommand?userId=...&deviceId=ACT-001`
   Response:
   ```json
   {
     "commandId": "cmd_abc123",
     "gateId": "gate_xyz789",
     "action": "OPEN"
   }
   ```
2. Actuator energizes motor relay (e.g. H-bridge or 12V linear actuator) until limit switch triggers.
3. Actuator confirms physical execution:
   `POST https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/reportGateExecution`
   ```json
   {
     "userId": "YOUR_FIREBASE_UID",
     "gateId": "gate_xyz789",
     "commandId": "cmd_abc123",
     "reportedState": "open",
     "success": true
   }
   ```

---

## 3. Sample ESP32 Arduino C++ Code (Soil Sensor)

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* webhookUrl = "https://YOUR_PROJECT.cloudfunctions.net/recordTelemetry";

const char* userId = "YOUR_FIREBASE_UID";
const char* deviceId = "SEN-001";
const int moisturePin = 34; // Analog pin for capacitive soil sensor

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected");
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    int rawValue = analogRead(moisturePin);
    // Calibration map: raw analog to 0 - 100% moisture
    float moisturePercent = map(rawValue, 3200, 1400, 0, 100);
    moisturePercent = constrain(moisturePercent, 0.0, 100.0);
    float tempC = 25.5; // From DS18B20 or thermistor

    HTTPClient http;
    http.begin(webhookUrl);
    http.addHeader("Content-Type", "application/json");

    StaticJsonDocument<200> doc;
    doc["userId"] = userId;
    doc["deviceId"] = deviceId;
    doc["soilTemperatureC"] = tempC;
    doc["soilMoisturePercent"] = moisturePercent;

    String requestBody;
    serializeJson(doc, requestBody);

    int httpCode = http.POST(requestBody);
    Serial.printf("Telemetry POST Result: %d\n", httpCode);
    http.end();
  }
  delay(30000); // Send every 30 seconds
}
```
