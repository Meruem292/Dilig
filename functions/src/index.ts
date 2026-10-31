import * as functions from 'firebase-functions';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

initializeApp();
const db = getFirestore();

const normalizeDeviceId = (value: unknown): string =>
  typeof value === 'string' ? value.trim().toUpperCase() : '';

/**
 * 1. Telemetry Webhook Endpoint for Physical Soil Sensors
 * ESP32 / Arduino devices POST JSON:
 * {
 *   "deviceId": "DILIG-SEN-A1B2C3D4E5F6",
 *   "soilTemperatureC": 26.4,
 *   "soilMoisturePercent": 48.2
 * }
 * The device ID is resolved through /deviceRegistry; firmware does not store a
 * Firebase user ID. Device authentication is intentionally not enabled.
 */
export const recordTelemetry = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
    return;
  }

  const { soilTemperatureC, soilMoisturePercent } = req.body;
  const deviceId = normalizeDeviceId(req.body.deviceId);

  if (!deviceId) {
    res.status(400).json({ error: 'Missing deviceId.' });
    return;
  }

  if (typeof soilMoisturePercent !== 'number' || soilMoisturePercent < 0 || soilMoisturePercent > 100) {
    res.status(400).json({ error: 'Invalid soilMoisturePercent (must be 0 to 100).' });
    return;
  }

  if (typeof soilTemperatureC !== 'number' || soilTemperatureC < -40 || soilTemperatureC > 85) {
    res.status(400).json({ error: 'Invalid soilTemperatureC.' });
    return;
  }

  try {
    // 1. Resolve the owning account from the globally unique hardware ID.
    const registrySnapshot = await db.collection('deviceRegistry').doc(deviceId).get();
    if (!registrySnapshot.exists) {
      res.status(404).json({ error: `Device ${deviceId} is not registered in DILIG.` });
      return;
    }

    const registry = registrySnapshot.data();
    if (!registry || registry.type !== 'sensor' || !registry.userId || !registry.deviceDocId) {
      res.status(409).json({ error: `Device ${deviceId} is not registered as a soil sensor.` });
      return;
    }

    const deviceRef = db.collection('users').doc(registry.userId).collection('devices').doc(registry.deviceDocId);
    const deviceSnapshot = await deviceRef.get();
    if (!deviceSnapshot.exists || deviceSnapshot.data()?.deviceId !== deviceId) {
      res.status(409).json({ error: `Device registry for ${deviceId} is stale. Register the device again.` });
      return;
    }

    const now = Date.now();

    const readingData = {
      deviceId,
      soilTemperatureC,
      soilMoisturePercent,
      recordedAt: now,
    };

    // 2. Overwrite one deterministic reading document to avoid unbounded storage.
    const batch = db.batch();
    batch.set(deviceRef.collection('readings').doc('latest'), readingData);

    // 3. Update device heartbeat and latest reading cache atomically.
    batch.update(deviceRef, {
      status: 'online',
      lastSeenAt: now,
      latestReading: readingData,
      updatedAt: now,
    });
    await batch.commit();

    res.status(200).json({ success: true, deviceId, timestamp: now });
  } catch (error: any) {
    console.error('Error saving telemetry:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

/**
 * 2. Actuator Poll / Fetch Pending Command Endpoint
 * Actuators GET: /getPendingCommand?userId=...&deviceId=...
 */
export const getPendingCommand = functions.https.onRequest(async (req, res) => {
  const { userId, deviceId } = req.query;

  if (!userId || !deviceId) {
    res.status(400).json({ error: 'Missing userId or deviceId parameter.' });
    return;
  }

  try {
    // 1. Update actuator heartbeat
    const devicesRef = db.collection('users').doc(userId as string).collection('devices');
    const devQuery = await devicesRef.where('deviceId', '==', deviceId).limit(1).get();
    const now = Date.now();

    if (!devQuery.empty) {
      await devQuery.docs[0].ref.update({
        status: 'online',
        lastSeenAt: now,
      });
    }

    // 2. Find gate assigned to this actuator
    const gatesRef = db.collection('users').doc(userId as string).collection('gates');
    const gateQuery = await gatesRef.where('actuatorDeviceId', '==', deviceId).limit(1).get();

    if (gateQuery.empty) {
      res.status(200).json({ command: null, message: 'No gate assigned to this actuator.' });
      return;
    }

    const gateDoc = gateQuery.docs[0];

    // 3. Check for pending commands
    const commandsRef = gateDoc.ref.collection('commands');
    const pendingCmds = await commandsRef
      .where('status', '==', 'pending')
      .orderBy('requestedAt', 'desc')
      .limit(1)
      .get();

    if (pendingCmds.empty) {
      res.status(200).json({ command: null });
      return;
    }

    const cmdDoc = pendingCmds.docs[0];
    const cmdData = cmdDoc.data();

    // Mark as executing
    await cmdDoc.ref.update({ status: 'executing' });

    res.status(200).json({
      commandId: cmdDoc.id,
      gateId: gateDoc.id,
      action: cmdData.command, // "OPEN" | "CLOSE"
      requestedAt: cmdData.requestedAt,
    });
  } catch (error: any) {
    console.error('Error in getPendingCommand:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

/**
 * 3. Actuator Report Execution Completion Endpoint
 * Actuator POST JSON:
 * {
 *   "userId": "FIREBASE_USER_ID",
 *   "gateId": "GATE_DOC_ID",
 *   "commandId": "CMD_DOC_ID",
 *   "reportedState": "open" | "closed" | "error",
 *   "success": true
 * }
 */
export const reportGateExecution = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
    return;
  }

  const { userId, gateId, commandId, reportedState, success, errorMessage } = req.body;

  if (!userId || !gateId || !commandId || !reportedState) {
    res.status(400).json({ error: 'Missing required parameters.' });
    return;
  }

  try {
    const gateRef = db.collection('users').doc(userId).collection('gates').doc(gateId);
    const cmdRef = gateRef.collection('commands').doc(commandId);
    const now = Date.now();

    // 1. Update Command Document
    await cmdRef.update({
      status: success ? 'succeeded' : 'failed',
      completedAt: now,
      errorMessage: errorMessage || null,
    });

    // 2. Update Gate Document with the actuator's actual physical position
    await gateRef.update({
      reportedState,
      pendingCommandId: null,
      updatedAt: now,
    });

    res.status(200).json({ success: true, timestamp: now });
  } catch (error: any) {
    console.error('Error reporting gate execution:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});
