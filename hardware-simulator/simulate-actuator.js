/**
 * DILIG Hardware Simulation Tool: Virtual Gate Actuator
 * 
 * Usage:
 *   node hardware-simulator/simulate-actuator.js <userId> <actuatorDeviceId>
 * 
 * Example:
 *   node hardware-simulator/simulate-actuator.js YOUR_UID ACT-001
 */

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  onSnapshot,
} from 'firebase/firestore';
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
const actuatorDeviceId = args[1] || 'ACT-001';

if (!userId) {
  console.log('\x1b[33mUsage: node hardware-simulator/simulate-actuator.js <userId> [actuatorDeviceId]\x1b[0m');
  console.log('You can find your User ID in the Dilig Account Profile menu.');
  process.exit(1);
}

console.log(`\x1b[34m⚙️ Dilig Gate Actuator Simulator Starting...\x1b[0m`);
console.log(`User ID:   ${userId}`);
console.log(`Device ID: ${actuatorDeviceId}`);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  // 1. Locate actuator device
  const devicesRef = collection(db, 'users', userId, 'devices');
  const qDev = query(devicesRef, where('deviceId', '==', actuatorDeviceId));
  const snapDev = await getDocs(qDev);

  if (snapDev.empty) {
    console.error(`\x1b[31m[Error] Actuator with ID "${actuatorDeviceId}" not found under user ${userId}. Please register it in the app first.\x1b[0m`);
    process.exit(1);
  }

  const deviceDoc = snapDev.docs[0];
  console.log(`\x1b[36mConnected to actuator device: ${deviceDoc.data().name} (${deviceDoc.id})\x1b[0m`);

  // Heartbeat function
  const sendHeartbeat = async () => {
    try {
      await updateDoc(doc(db, 'users', userId, 'devices', deviceDoc.id), {
        status: 'online',
        lastSeenAt: Date.now(),
        updatedAt: Date.now(),
      });
      console.log(`[${new Date().toLocaleTimeString()}] Heartbeat transmitted: \x1b[32mOnline\x1b[0m`);
    } catch (err) {
      console.error('Heartbeat error:', err.message);
    }
  };

  await sendHeartbeat();
  setInterval(sendHeartbeat, 15000); // Heartbeat every 15s

  // 2. Find assigned gate
  const gatesRef = collection(db, 'users', userId, 'gates');
  const qGates = query(gatesRef, where('actuatorDeviceId', '==', actuatorDeviceId));

  console.log(`\x1b[33mListening for assigned gates and incoming Open/Close commands...\x1b[0m\n`);

  onSnapshot(qGates, (gatesSnapshot) => {
    if (gatesSnapshot.empty) {
      console.log(`[Notice] Actuator ${actuatorDeviceId} is currently not assigned to any gate. Assign it in the app.`);
      return;
    }

    gatesSnapshot.docs.forEach((gateDoc) => {
      const gateData = gateDoc.data();
      const gateId = gateDoc.id;

      // Listen to commands subcollection for this gate
      const commandsRef = collection(db, 'users', userId, 'gates', gateId, 'commands');
      const qCmd = query(commandsRef, where('status', '==', 'pending'));

      onSnapshot(qCmd, (cmdSnapshot) => {
        cmdSnapshot.docs.forEach(async (cmdDoc) => {
          const cmdData = cmdDoc.data();
          const targetState = cmdData.command === 'OPEN' ? 'open' : 'closed';

          console.log(`\n\x1b[35m[COMMAND RECEIVED] -> Request to ${cmdData.command} Gate "${gateData.name}" (Command ID: ${cmdDoc.id})\x1b[0m`);
          console.log(`Simulating mechanical motor operation (approx 3.5 seconds)...`);

          // Mark command as executing
          await updateDoc(cmdDoc.ref, { status: 'executing' }).catch(console.warn);

          // Simulate motor delay
          setTimeout(async () => {
            const now = Date.now();
            try {
              // 1. Mark command as succeeded
              await updateDoc(cmdDoc.ref, {
                status: 'succeeded',
                completedAt: now,
              });

              // 2. Update gate reported state to new position
              await updateDoc(doc(db, 'users', userId, 'gates', gateId), {
                reportedState: targetState,
                pendingCommandId: null,
                updatedAt: now,
              });

              console.log(`\x1b[32m[SUCCESS] Motor operation complete! Gate reportedState is now: "${targetState.toUpperCase()}".\x1b[0m\n`);
            } catch (err) {
              console.error('Error completing command:', err.message);
            }
          }, 3500);
        });
      });
    });
  });
}

run().catch(console.error);
