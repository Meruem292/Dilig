# DILIG — Simple Smart Irrigation Web App

**Dilig** is a clean, minimal, mobile-first web application designed for farmers to monitor soil conditions (temperature and moisture) and reliably control physical irrigation water gates.

Built with **React**, **TypeScript**, **Tailwind CSS**, and **Firebase (Authentication & Cloud Firestore)**.

---

## Features

- **Farmer-First Design**: Clean white background, natural green primary branding (`#16a34a`), water blue accents (`#0284c7`), high-contrast text, large buttons, and zero clutter.
- **Home Dashboard**:
  - Live **Soil Moisture (%)** and **Soil Temperature (°C)** with real-time freshness/staleness indicators.
  - Descriptive conditions (**Dry**, **Normal**, **Wet**) with customizable thresholds.
  - Device health overview (online/offline counts).
  - Quick gate cards with confirmed Open/Close controls.
- **Gate Management**:
  - Add, edit, and delete any number of irrigation gates.
  - Real-time reported state: **Open**, **Closed**, **Moving...**, **Error**, or **Unknown**.
  - Confirmed command dispatch with double-check modal.
  - Conflict prevention and timeout safety (no permanent pending states).
- **Device Management**:
  - Register **Soil Sensors** and **Gate Actuators** with unique device IDs.
  - Heartbeat tracking with online/offline indicators.
  - Strict role validation (sensors cannot control gates; actuators cannot be assigned to multiple gates).
- **Production Security Rules**:
  - Scoped data access under `users/{userId}`.
  - Prevents spoofed client execution reports.
  - Strict validation of temperature (-40°C to 85°C) and moisture (0% to 100%).
- **Hardware Integration & Simulator**:
  - Includes virtual ESP32 sensor and actuator simulators in `hardware-simulator/`.
  - Includes Firebase Cloud Functions in `functions/` for device webhooks.

---

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Firebase Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Open `.env` and fill in your Firebase Web App configuration from the [Firebase Console](https://console.firebase.google.com):
```env
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

> **Note**: If `.env` is unconfigured or credentials are missing, Dilig will cleanly display a **Firebase Setup Required** guide instead of crashing or showing fake data.

### 3. Run Development Server
```bash
npm run dev
```
Open your browser at `http://localhost:5173` (or the URL output in your terminal).

### 4. Build for Production
```bash
npm run build
```

---

## Firebase Setup & Security Rules

### 1. Enable Firebase Services
1. Go to [Firebase Console](https://console.firebase.google.com).
2. Enable **Authentication** &rarr; Sign-in method &rarr; **Email/Password**.
3. Enable **Cloud Firestore** in production mode.

### 2. Deploy Security Rules
Deploy `firestore.rules` and `firestore.indexes.json` using the Firebase CLI:
```bash
firebase deploy --only firestore:rules,firestore:indexes
```

---

## Testing with Virtual Hardware Simulators

You can test real dynamic behavior without physical microcontrollers:

1. Sign in to Dilig and register a sensor with ID `SEN-001` and an actuator with ID `ACT-001`.
2. Create a gate and assign `ACT-001`.
3. Open your account profile menu in Dilig to find your **User ID (UID)**.
4. In terminal 1, stream live sensor data:
   ```bash
   npm run sim:sensor YOUR_USER_ID SEN-001
   ```
5. In terminal 2, run the actuator listener:
   ```bash
   npm run sim:actuator YOUR_USER_ID ACT-001
   ```
6. Click **Open Gate** or **Close Gate** in Dilig. You will observe the real-time transition from `Moving...` to `Open` as the simulator executes the mechanical operation.

---

## Project Structure

```
DILIG/
├── .env.example               # Environment variables template
├── README.md                  # Project documentation
├── firestore.rules            # Firestore security rules
├── firestore.indexes.json     # Firestore composite indexes
├── functions/                 # Trusted Cloud Functions backend for devices
│   └── src/index.ts           # Telemetry & actuator webhook endpoints
├── hardware-simulator/        # Node.js virtual hardware runners
│   ├── simulate-sensor.js     # Live soil moisture/temp stream
│   ├── simulate-actuator.js   # Live gate motor execution simulator
│   └── README.md              # ESP32 C++ firmware guide
└── src/
    ├── config/firebase.ts     # Firebase modular initialization
    ├── context/               # AuthContext & ToastContext
    ├── services/              # Gate, Device, Command, and Telemetry services
    ├── components/
    │   ├── common/            # Button, Card, Badge, Modal, ConfirmDialog, etc.
    │   ├── layout/            # Header, Sidebar, BottomNav, Layout
    │   ├── dashboard/         # SoilConditionCard, DeviceSummaryCard, QuickGateList
    │   ├── gates/             # GateCard, GateFormModal, GateStatusBadge
    │   ├── devices/           # DeviceCard, DeviceFormModal, DeviceTypeBadge
    │   └── settings/          # ProfileModal, SoilThresholdModal
    └── pages/                 # AuthPage, DashboardPage, GatesPage, DevicesPage
```
