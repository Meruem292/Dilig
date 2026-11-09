# Main Gate — BTS7960 Firmware

This is the **main-gate** ESP32 project. It uses the same DILIG web commands
and OLED as the other devices, but drives a BTS7960 H-bridge:

- **Open**: LPWM on GPIO 19, RPWM held at zero
- **Close**: RPWM on GPIO 18, LPWM held at zero
- **Stop**: both PWM channels return to zero

Register the generated DILIG-MAIN ID in the web app as an **actuator**, then
assign it to a gate.

## Default wiring

| ESP32 pin | Connect to |
|---|---|
| GPIO 18 | BTS7960 RPWM |
| GPIO 19 | BTS7960 LPWM |
| GPIO 21 | OLED SDA |
| GPIO 22 | OLED SCL |
| 3.3V / GND | OLED power |

Tie BTS7960 R_EN and L_EN HIGH as required by your module, and connect the
ESP32, driver logic supply, and motor-supply grounds together. The motor must
use its own correctly rated power supply.

The default PWM duty is 220/255 with a 500 ms soft-start ramp. The motor stops
after 45 seconds for either direction. Change BTS7960_TRAVEL_MS in
include/firmware_config.h if the measured travel time changes.

This two-wire setup has no physical limit-switch feedback. The reported Open
or Closed state means the configured timed movement completed. Add hardware
end-stop switches before unattended field installation.

## Flash

Copy include/secrets.example.h to include/secrets.h, enter Wi-Fi/Firebase
values, then open this folder in PlatformIO and press Upload.

