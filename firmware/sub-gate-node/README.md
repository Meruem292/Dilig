# Sub Gate — Servo Firmware

This is the **sub-gate** ESP32 project. It uses the same DILIG web commands
and OLED as the other devices:

- **Open**: servo moves to 180°
- **Close**: servo moves to 0°

Register the generated DILIG-SUB ID in the web app as an **actuator**, then
assign it to a gate.

## Default wiring

| ESP32 pin | Connect to |
|---|---|
| GPIO 25 | Servo signal |
| GPIO 21 | OLED SDA |
| GPIO 22 | OLED SCL |
| 3.3V / GND | OLED power |

Power the servo from a separate, stable 5V supply. Join that supply GND to
ESP32 GND. Do not power the servo from the ESP32 3.3V pin.

Set safe mechanical endpoints and settling time in
include/firmware_config.h before field use.

## Flash

Copy include/secrets.example.h to include/secrets.h, enter Wi-Fi/Firebase
values, then open this folder in PlatformIO and press Upload.
