#pragma once

#include <Arduino.h>

// 0 = two-relay reversing motor with limit switches (this project)
// 1 = single relay, OPEN energizes and CLOSE de-energizes
// 2 = 180-degree servo, OPEN = 180° and CLOSE = 0°
#ifndef DILIG_ACTUATOR_MODE
#define DILIG_ACTUATOR_MODE 0
#endif

namespace config {

constexpr uint8_t RELAY_OPEN_PIN = 25;
constexpr uint8_t RELAY_CLOSE_PIN = 26;
constexpr uint8_t LIMIT_OPEN_PIN = 32;
constexpr uint8_t LIMIT_CLOSED_PIN = 33;
constexpr uint8_t OLED_SDA_PIN = 21;
constexpr uint8_t OLED_SCL_PIN = 22;
constexpr uint8_t OLED_I2C_ADDRESS = 0x3C;
constexpr uint8_t OLED_WIDTH = 128;
constexpr uint8_t OLED_HEIGHT = 64;

// Common opto-isolated relay boards energize when their input is LOW.
constexpr uint8_t RELAY_ON_LEVEL = LOW;
constexpr uint8_t RELAY_OFF_LEVEL = HIGH;

constexpr char DEVICE_ID_PREFIX[] = "DILIG-ACT-";

// Fail-safe normally-closed switches connect GPIO to GND until the endpoint
// opens the circuit. A triggered or broken wire therefore reads HIGH.
constexpr uint8_t LIMIT_TRIGGERED_LEVEL = HIGH;
constexpr uint32_t LIMIT_DEBOUNCE_MS = 50;
constexpr uint32_t MAX_MOTOR_TRAVEL_MS = 60000;

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

