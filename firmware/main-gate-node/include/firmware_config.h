#pragma once

#include <Arduino.h>

#ifndef DILIG_ACTUATOR_MODE
#define DILIG_ACTUATOR_MODE 1
#endif

namespace config {

// One active-low relay. OPEN energizes it; CLOSE releases it.
constexpr uint8_t RELAY_MAIN_PIN = 25;
constexpr uint8_t RELAY_ON_LEVEL = LOW;
constexpr uint8_t RELAY_OFF_LEVEL = HIGH;
constexpr uint8_t OLED_SDA_PIN = 21;
constexpr uint8_t OLED_SCL_PIN = 22;
constexpr uint8_t OLED_I2C_ADDRESS = 0x3C;
constexpr uint8_t OLED_WIDTH = 128;
constexpr uint8_t OLED_HEIGHT = 64;
constexpr char DEVICE_ID_PREFIX[] = "DILIG-MAIN-";
constexpr uint32_t GATE_POLL_INTERVAL_MS = 1000;
constexpr uint32_t HEARTBEAT_INTERVAL_MS = 15000;
constexpr uint32_t CLOUD_RETRY_INTERVAL_MS = 5000;
constexpr uint32_t WIFI_RECONNECT_INTERVAL_MS = 10000;
constexpr uint32_t DISPLAY_REFRESH_INTERVAL_MS = 250;
constexpr uint32_t HTTP_TIMEOUT_MS = 10000;
constexpr uint32_t WATCHDOG_TIMEOUT_SECONDS = 30;
constexpr uint32_t MOTOR_TASK_STACK_BYTES = 4096;
constexpr uint32_t CLOUD_TASK_STACK_BYTES = 8192;
constexpr UBaseType_t MOTOR_TASK_PRIORITY = 3;
constexpr UBaseType_t CLOUD_TASK_PRIORITY = 1;

}  // namespace config
