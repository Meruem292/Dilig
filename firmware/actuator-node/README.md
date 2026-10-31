# DILIG ESP32 Gate Actuator

This firmware controls a reversible gate motor or linear actuator through an interlocked two-relay module. It resolves its DILIG account and assigned gate dynamically through Firestore REST, executes Open/Close commands, and reports only physically confirmed states.

Each ESP32 derives a stable ID from its factory MAC address:

```text
DILIG-ACT-A1B2C3D4E5F6
```

Register the exact OLED-displayed ID as a **Gate Actuator**, then assign that device to one gate in DILIG.

## Wiring

| Function | ESP32 DevKit V1 | Behavior |
|---|---:|---|
| Open relay input | GPIO 25 | Active LOW |
| Close relay input | GPIO 26 | Active LOW |
| Fully-open limit | GPIO 32 | Normally closed to GND; triggered HIGH |
| Fully-closed limit | GPIO 33 | Normally closed to GND; triggered HIGH |
| OLED SDA | GPIO 21 | SSD1306 I²C |
| OLED SCL | GPIO 22 | SSD1306 I²C |
| OLED address | `0x3C` | 128×64 |

Use an opto-isolated relay module or suitable motor driver. The ESP32 must never power the motor directly. The two relay contacts must be wired as a polarity-reversing circuit appropriate for the actuator voltage and current, with fusing and emergency isolation.

Normally-closed limit switches are intentionally fail-safe: a triggered switch or broken wire reads HIGH and prevents continued travel toward that endpoint. If both inputs read HIGH, firmware stops both relays and reports an error.

## Configure and flash

1. Deploy the latest Spark-compatible rules:
   ```bash
   firebase deploy --only firestore:rules,firestore:indexes
   ```
2. Copy `include/secrets.example.h` to `include/secrets.h`.
3. Set the Wi-Fi credentials and copy `VITE_FIREBASE_API_KEY` from the repository's `.env`.
4. Upload through PlatformIO and open Serial Monitor at 115200 baud.
5. Register the displayed `DILIG-ACT-...` ID as an actuator.
6. Create or edit a gate and assign the actuator.

## Safety state machine

- Both relay outputs are forced OFF before task startup and before either direction is energized.
- Only one direction can be active at a time.
- A command stops immediately at its target limit switch.
- A 60-second travel timeout stops the motor and reports `failed/error`.
- Contradictory limit inputs stop the motor and report `failed/error`.
- A watchdog resets stalled tasks; relay initialization returns both outputs to OFF after restart.
- A controller restart during an executing command marks that command failed instead of automatically restarting movement.

## Runtime architecture

- Core 1 owns the 10 ms motor/limit-switch state machine and OLED.
- Core 0 owns Wi-Fi, TLS, 15-second heartbeats, one-second gate polling, and Firestore REST commits.
- FreeRTOS queues pass commands and results between cores without sharing mutable motor state.
- The completion update changes the command and gate in one atomic Firestore commit.

With the network path linked, the firmware uses approximately 940 KB flash and 47 KB static RAM. Confirm Serial-reported stack headroom during physical testing.

