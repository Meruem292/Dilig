#pragma once

#include <Arduino.h>

#ifndef DILIG_ACTUATOR_MODE
#define DILIG_ACTUATOR_MODE 2
#endif

namespace config {

// Servo uses a separate stable 5V supply; its GND must join ESP32 GND.
constexpr uint8_t SERVO_PIN = 25;
constexpr uint8_t SERVO_CLOSED_ANGLE = 0;
constexpr uint8_t SERVO_OPEN_ANGLE = 180;
constexpr uint32_t SERVO_SETTLE_MS = 900;
constexpr uint8_t OLED_SDA_PIN = 21;
constexpr uint8_t OLED_SCL_PIN = 22;
constexpr uint8_t OLED_I2C_ADDRESS = 0x3C;
constexpr uint8_t OLED_WIDTH = 128;
constexpr uint8_t OLED_HEIGHT = 64;
constexpr char DEVICE_ID_PREFIX[] = "DILIG-SUB-";
constexpr uint32_t GATE_POLL_INTERVAL_MS = 1000;
constexpr uint32_t HEARTBEAT_INTERVAL_MS = 15000;
constexpr uint32_t CLOUD_RETRY_INTERVAL_MS = 5000;
constexpr uint32_t WIFI_RECONNECT_INTERVAL_MS = 10000;
constexpr uint32_t DISPLAY_REFRESH_INTERVAL_MS = 250;
constexpr uint32_t HTTP_TIMEOUT_MS = 10000;
constexpr uint32_t WATCHDOG_TIMEOUT_SECONDS = 30;
constexpr uint32_t MOTOR_TASK_STACK_BYTES = 4096;
// Firestore TLS + JSON parsing has deep mbedTLS call frames on ESP32.
constexpr uint32_t CLOUD_TASK_STACK_BYTES = 24576;
constexpr UBaseType_t MOTOR_TASK_PRIORITY = 3;
constexpr UBaseType_t CLOUD_TASK_PRIORITY = 1;

}  // namespace config
