#pragma once

#include <Arduino.h>

#ifndef DILIG_ACTUATOR_MODE
#define DILIG_ACTUATOR_MODE 1
#endif

namespace config {

// BTS7960 motor-driver control. Tie R_EN and L_EN HIGH on the module.
// OPEN drives RPWM; CLOSE drives LPWM. Swap the pins if direction is reversed.
constexpr uint8_t BTS7960_RPWM_PIN = 18;
constexpr uint8_t BTS7960_LPWM_PIN = 19;
constexpr uint8_t BTS7960_RPWM_CHANNEL = 0;
constexpr uint8_t BTS7960_LPWM_CHANNEL = 1;
constexpr uint32_t BTS7960_PWM_FREQUENCY_HZ = 20000;
constexpr uint8_t BTS7960_PWM_RESOLUTION_BITS = 8;
constexpr uint8_t BTS7960_PWM_DUTY = 220;  // 0-255; start below full power.
constexpr uint32_t BTS7960_RAMP_MS = 500;
// Timed travel is the only stop feedback in this two-wire configuration.
constexpr uint32_t BTS7960_TRAVEL_MS = 45000;
constexpr uint8_t OLED_SDA_PIN = 21;
constexpr uint8_t OLED_SCL_PIN = 22;
constexpr uint8_t OLED_I2C_ADDRESS = 0x3C;
constexpr uint8_t OLED_WIDTH = 128;
constexpr uint8_t OLED_HEIGHT = 64;
constexpr char DEVICE_ID_PREFIX[] = "DILIG-MAIN-";
constexpr uint32_t GATE_POLL_INTERVAL_MS = 500;
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
