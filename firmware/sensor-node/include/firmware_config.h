#pragma once

#include <Arduino.h>

namespace config {

// Recommended ESP32 DevKit V1 wiring.
constexpr uint8_t DS18B20_PIN = 4;
constexpr uint8_t SOIL_SENSOR_PIN = 34;
constexpr uint8_t OLED_SDA_PIN = 21;
constexpr uint8_t OLED_SCL_PIN = 22;
constexpr uint8_t OLED_I2C_ADDRESS = 0x3C;
constexpr uint8_t OLED_WIDTH = 128;
constexpr uint8_t OLED_HEIGHT = 64;

// Calibrate these two values using the raw ADC values printed over Serial.
// A capacitive probe normally reads higher in dry soil and lower in wet soil.
constexpr uint16_t SOIL_RAW_DRY = 3000;
constexpr uint16_t SOIL_RAW_WET = 1300;
constexpr uint8_t SOIL_SAMPLE_COUNT = 16;

constexpr uint32_t TEMPERATURE_SAMPLE_INTERVAL_MS = 5000;
constexpr uint32_t DS18B20_CONVERSION_TIME_MS = 750;
constexpr uint32_t SOIL_SAMPLE_INTERVAL_MS = 2000;
constexpr uint32_t TELEMETRY_INTERVAL_MS = 30000;
constexpr uint32_t DISPLAY_REFRESH_INTERVAL_MS = 500;
constexpr uint32_t WIFI_RECONNECT_INTERVAL_MS = 10000;
constexpr uint32_t CLOUD_RETRY_INTERVAL_MS = 10000;
constexpr uint32_t HTTP_TIMEOUT_MS = 10000;
constexpr uint32_t WATCHDOG_TIMEOUT_SECONDS = 30;

constexpr uint32_t SENSOR_TASK_STACK_WORDS = 4096;
// TLS handshakes allocate deeply through mbedTLS. 6,144 words can overflow
// on an ESP32 Arduino 3.x build during the first Firestore request.
constexpr uint32_t CLOUD_TASK_STACK_WORDS = 12288;
constexpr UBaseType_t SENSOR_TASK_PRIORITY = 2;
constexpr UBaseType_t CLOUD_TASK_PRIORITY = 1;

}  // namespace config

