# Sub Gate — Servo Firmware

This is the **sub-gate** ESP32 project. It uses the same DILIG web commands
and OLED as the other devices:

- **Open**: servo moves smoothly to 110°
- **Close**: servo moves to 0°

Register the generated DILIG-SUB ID in the web app as an **actuator**, then
assign it to a gate.

## Default wiring

| ESP32 pin | Connect to |
|---|---|
| GPIO 18 | Servo signal |
| GPIO 21 | OLED SDA |
| GPIO 22 | OLED SCL |
| 3.3V / GND | OLED power |

Power the servo from a separate, stable 5V supply. Join that supply GND to
ESP32 GND. Do not power the servo from the ESP32 3.3V pin.

The tested motion profile uses a 500–2500 microsecond pulse range and moves one
degree every 15 ms. The firmware implements this without blocking cloud,
watchdog, or OLED processing. After registration, use **Set Angles** on the
device card to calibrate each Sub Gate independently from 0° to 180°. The
firmware validates the cloud values and falls back to 110° Open and 0° Closed
when configuration is missing or invalid.

## Flash

Copy include/secrets.example.h to include/secrets.h, enter Wi-Fi/Firebase
values, then open this folder in PlatformIO and press Upload.
