# DILIG ESP32 Soil Sensor Node

This firmware reads a DS18B20 soil-temperature probe and capacitive soil-moisture sensor, shows live status on an SSD1306 OLED, and publishes the latest reading to DILIG every 30 seconds.

Each board derives a stable, globally unique ID from its factory ESP32 MAC address:

```text
DILIG-SEN-A1B2C3D4E5F6
```

The ID appears on the OLED and Serial Monitor. Register that exact ID as a **Soil Sensor** in the DILIG web app. The firmware reads the registry through Firestore REST to resolve the owning user dynamically; it does not contain a Firebase UID and does not require Cloud Functions or the Blaze plan.

## Recommended wiring

| Module | Module pin | ESP32 DevKit V1 |
|---|---|---|
| DS18B20 | DATA | GPIO 4 |
| DS18B20 | VDD | 3.3 V |
| DS18B20 | GND | GND |
| Capacitive soil sensor | AO | GPIO 34 |
| Capacitive soil sensor | VCC | 3.3 V |
| Capacitive soil sensor | GND | GND |
| SSD1306 OLED | SDA | GPIO 21 |
| SSD1306 OLED | SCL | GPIO 22 |
| SSD1306 OLED | VCC | 3.3 V |
| SSD1306 OLED | GND | GND |

Install a **4.7 kΩ pull-up resistor** between the DS18B20 DATA pin and 3.3 V. The OLED is configured as 128×64 at I²C address `0x3C`. Do not feed GPIO 34 more than 3.3 V.

## Configure and flash

1. Install VS Code with PlatformIO.
2. Copy `include/secrets.example.h` to `include/secrets.h`.
3. Enter the Wi-Fi SSID and password.
4. Copy `VITE_FIREBASE_API_KEY` from the repository's `.env` into `DILIG_FIREBASE_API_KEY`. This public Web API key selects the Firebase project; it is not a device credential.
5. Deploy only the Spark-compatible Firestore configuration from the repository root:
   ```bash
   firebase deploy --only firestore:rules,firestore:indexes
   ```
6. Connect the ESP32 and run **PlatformIO: Upload**.
7. Open the Serial Monitor at 115200 baud.
8. Copy the displayed device ID into **DILIG → Devices → Register Device**, choose **Soil Sensor**, and save.

The OLED shows `REGISTER ID` while the server returns HTTP 404. After registration, the next upload changes the status to `Cloud: OK` and the dashboard receives the reading.

## Moisture calibration

The initial calibration constants are `3000` for dry and `1300` for wet. These are starting values, not universal sensor specifications.

1. Read `soilRaw` in the Serial Monitor with the clean probe held in air/dry soil.
2. Record the stable value as `SOIL_RAW_DRY` in `include/firmware_config.h`.
3. Place the probe in fully wet soil (not directly in water), wait for stabilization, and record `SOIL_RAW_WET`.
4. Rebuild and flash the firmware.

The firmware clamps the reported moisture to 0–100%. It rejects missing or invalid DS18B20 readings rather than uploading false temperature data.

## Runtime design

- Core 1 performs asynchronous DS18B20 conversion, averaged ADC sampling, and OLED updates.
- Core 0 owns Wi-Fi and blocking HTTPS work.
- A one-element FreeRTOS queue always retains only the newest telemetry sample.
- A 30-second task watchdog resets the ESP32 if either task stops making progress.
- Core 0 resolves `deviceId` through `deviceRegistry/{deviceId}` and submits an atomic Firestore REST commit for `readings/latest` plus the device heartbeat.
- HTTPS validates the Firestore certificate with Google Trust Services Root R1 after NTP time synchronization. No device credential is sent, as selected for this deployment.

## Security choice

This Spark-plan design intentionally permits a registered sensor ID to submit only its bounded temperature, moisture, heartbeat, and latest-reading fields. It cannot change the user's device name, type, gate assignments, profile, or other documents. Because device authentication is disabled, anyone who knows a registered device ID and the public Firebase Web API key could spoof sensor readings.

