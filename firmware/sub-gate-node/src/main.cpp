// Declare framework dependencies here as well, so PlatformIO finds them while
// scanning the shared source below.
#include <ArduinoJson.h>
#include <ESP32Servo.h>
#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <Wire.h>

// Sub Gate firmware. Shared cloud code preserves the DILIG command contract.
#include "../../actuator-node/src/main.cpp"
