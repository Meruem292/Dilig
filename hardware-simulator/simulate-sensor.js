/**
 * DILIG Hardware Simulation Tool: Virtual Soil Sensor
 * 
 * Usage:
 *   node hardware-simulator/simulate-sensor.js <userId> <deviceId>
 * 
 * Example:
 *   node hardware-simulator/simulate-sensor.js YOUR_UID SEN-001
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, doc, updateDoc, query, where, getDocs } from 'firebase/firestore';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

if (!firebaseConfig.apiKey || firebaseConfig.apiKey === 'your_api_key_here') {
  console.error('\x1b[31m[Error] Please configure your .env file with real Firebase credentials first.\x1b[0m');
  process.exit(1);
}

const args = process.argv.slice(2);
const userId = args[0];
const deviceId = args[1] || 'SEN-001';

if (!userId) {
  console.log('\x1b[33mUsage: node hardware-simulator/simulate-sensor.js <userId> [deviceId]\x1b[0m');
  console.log('You can find your User ID in the Dilig Account Profile menu.');
  process.exit(1);
}

console.log(`\x1b[32m🌱 Dilig Soil Sensor Simulator Starting...\x1b[0m`);
console.log(`User ID:   ${userId}`);
console.log(`Device ID: ${deviceId}`);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  // 1. Locate device
  const devicesRef = collection(db, 'users', userId, 'devices');
  const q = query(devicesRef, where('deviceId', '==', deviceId));
  const snap = await getDocs(q);

  if (snap.empty) {
    console.error(`\x1b[31m[Error] Device with ID "${deviceId}" not found under user ${userId}. Please register it in the app first.\x1b[0m`);
    process.exit(1);
  }

  const deviceDoc = snap.docs[0];
  console.log(`\x1b[36mConnected to device: ${deviceDoc.data().name} (${deviceDoc.id})\x1b[0m`);

  let moisture = 45.0; // Starting moisture %
  let temp = 24.5;     // Starting temp °C

  console.log(`Broadcasting soil readings every 10 seconds. Press Ctrl+C to stop.\n`);

  const pushReading = async () => {
    // Subtle realistic fluctuation
    moisture = Math.max(15, Math.min(85, moisture + (Math.random() * 4 - 2)));
    temp = Math.max(18, Math.min(36, temp + (Math.random() * 0.8 - 0.4)));

    const roundedMoisture = Math.round(moisture * 10) / 10;
    const roundedTemp = Math.round(temp * 10) / 10;
    const now = Date.now();

    const reading = {
      deviceId,
      soilTemperatureC: roundedTemp,
      soilMoisturePercent: roundedMoisture,
      recordedAt: now,
    };

    try {
      // Add reading to subcollection
      const readingsRef = collection(db, 'users', userId, 'devices', deviceDoc.id, 'readings');
      await addDoc(readingsRef, reading);

      // Update device heartbeat and latest reading cache
      await updateDoc(doc(db, 'users', userId, 'devices', deviceDoc.id), {
        status: 'online',
        lastSeenAt: now,
        latestReading: reading,
        updatedAt: now,
      });

      console.log(`[${new Date().toLocaleTimeString()}] Telemetry Sent -> Moisture: \x1b[32m${roundedMoisture}%\x1b[0m, Temp: \x1b[34m${roundedTemp}°C\x1b[0m`);
    } catch (err) {
      console.error('\x1b[31mFailed to push reading:\x1b[0m', err.message);
    }
  };

  // Push immediate reading, then every 10s
  await pushReading();
  setInterval(pushReading, 10000);
}

run().catch(console.error);
