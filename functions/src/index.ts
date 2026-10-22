import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

/**
 * 1. Telemetry Webhook Endpoint for Physical Soil Sensors
 * ESP32 / Arduino devices POST JSON:
 * {
 *   "userId": "FIREBASE_USER_ID",
 *   "deviceId": "SEN-001",
 *   "apiKey": "OPTIONAL_DEVICE_SECRET",
 *   "soilTemperatureC": 26.4,
 *   "soilMoisturePercent": 48.2
 * }
 */
export const recordTelemetry = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
    return;
  }

  const { userId, deviceId, soilTemperatureC, soilMoisturePercent } = req.body;

  if (!userId || !deviceId) {
    res.status(400).json({ error: 'Missing userId or deviceId.' });
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
    // 1. Locate registered device in user's devices subcollection
    const devicesRef = db.collection('users').doc(userId).collection('devices');
    const devQuery = await devicesRef.where('deviceId', '==', deviceId).limit(1).get();

    if (devQuery.empty) {
      res.status(404).json({ error: `Device ${deviceId} is not registered under user ${userId}.` });
      return;
    }

    const deviceDoc = devQuery.docs[0];
    const now = Date.now();

    const readingData = {
      deviceId,
      soilTemperatureC,
      soilMoisturePercent,
      recordedAt: now,
    };

    // 2. Append to readings subcollection
    await deviceDoc.ref.collection('readings').add(readingData);

    // 3. Update device heartbeat and latest reading cache
    await deviceDoc.ref.update({
      status: 'online',
      lastSeenAt: now,
      latestReading: readingData,
      updatedAt: now,
    });

    res.status(200).json({ success: true, timestamp: now });
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
