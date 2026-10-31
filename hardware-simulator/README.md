# Dilig Hardware Integration & Simulation Guide

This folder contains the communication specifications and virtual hardware runners for the **Dilig** smart irrigation system.

---

## 1. Quick Virtual Hardware Testing

If you do not have physical ESP32 or Arduino microcontrollers on hand, you can simulate real telemetry and motorized gate execution using the provided Node.js scripts.

### Prerequisites
1. Fill in your Firebase credentials in `.env` at the project root.
2. Run the Dilig web app (`npm run dev`) and sign in or create an account.
3. In Dilig:
   - Go to **Devices** &rarr; Register a Soil Sensor with ID `SEN-001`.
   - Go to **Devices** &rarr; Register a Gate Actuator with ID `ACT-001`.
   - Go to **Gates** &rarr; Create an irrigation gate (e.g. "North Field Gate") and assign `ACT-001` as the actuator.
4. Click your profile avatar in the header to view your **User ID (UID)**.

### Run Virtual Soil Sensor
```bash
npm run sim:sensor YOUR_USER_ID SEN-001
```
*This transmits realistic soil temperature (°C) and moisture (%) telemetry every 10 seconds. You will see the Home Dashboard soil cards update dynamically in real time.*

### Run Virtual Gate Actuator
```bash
npm run sim:actuator YOUR_USER_ID ACT-001
```
*This connects to your actuator device, transmits online heartbeats, and listens for Open/Close commands. When you click **Open Gate** in Dilig, the simulator receives the command, simulates a 3.5-second motor travel delay, and reports back that the gate has opened.*

---

## 2. Microcontroller Hardware Protocol (ESP32)

The physical sensor uses the Firestore REST API directly, which works on the Firebase Spark plan. It first reads `deviceRegistry/{deviceId}`, then atomically commits `readings/latest` and the device heartbeat to the resolved user's device document. Firestore rules limit unauthenticated hardware writes to those telemetry fields.

The physical sensor does not store a Firebase user ID. The user registers the OLED-displayed device ID in the DILIG web app, which creates the global registry binding.

### Optional legacy actuator webhook protocol

The following Cloud Function protocol remains as reference code and requires a Blaze-plan deployment. The current Node actuator simulator talks directly to Firestore and does not require these endpoints.

1. Actuator checks for pending command:
   `GET https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/getPendingCommand?userId=...&deviceId=ACT-001`
   Response:
   ```json
   {
     "commandId": "cmd_abc123",
     "gateId": "gate_xyz789",
     "action": "OPEN"
   }
   ```
2. Actuator energizes motor relay (e.g. H-bridge or 12V linear actuator) until limit switch triggers.
3. Actuator confirms physical execution:
   `POST https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/reportGateExecution`
   ```json
   {
     "userId": "YOUR_FIREBASE_UID",
     "gateId": "gate_xyz789",
     "commandId": "cmd_abc123",
     "reportedState": "open",
     "success": true
   }
   ```

---

## 3. ESP32 Sensor Firmware

The deployable PlatformIO firmware is in `firmware/sensor-node/`. It supports
the DS18B20, capacitive soil-moisture probe, SSD1306 OLED, dual-core FreeRTOS
task separation, watchdog recovery, calibration, and dynamic account routing.

## 4. ESP32 Gate Actuator Firmware

The deployable two-relay, dual-limit-switch, SSD1306 controller is in
`firmware/actuator-node/`. It uses direct Firestore REST communication on the
Spark plan and atomically confirms command completion with the physical gate state.
