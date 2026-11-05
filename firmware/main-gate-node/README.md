# Main Gate — Relay Firmware

This is the **main-gate** ESP32 project. It uses the same DILIG web commands
and OLED as the other devices, but drives one relay:

- **Open**: relay on
- **Close**: relay off

Register the generated DILIG-MAIN ID in the web app as an **actuator**, then
assign it to a gate.

## Default wiring

| ESP32 pin | Connect to |
|---|---|
| GPIO 25 | Relay IN |
| GPIO 21 | OLED SDA |
| GPIO 22 | OLED SCL |
| 3.3V / GND | OLED power |

The relay default is active-low. Edit include/firmware_config.h if your relay
is active-high. This firmware reports the electrical output state; it does not
claim to verify physical gate position because it has no limit switch.

## Flash

Copy include/secrets.example.h to include/secrets.h, enter Wi-Fi/Firebase
values, then open this folder in PlatformIO and press Upload.

