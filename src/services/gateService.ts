import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  getDocs,
  where,
  onSnapshot,
  orderBy,
  arrayRemove,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Device, Gate, GateControlMode, GateReportedState } from '../types';

export const subscribeToUserGates = (
  userId: string,
  onUpdate: (gates: Gate[]) => void,
  onError?: (err: Error) => void
): (() => void) => {
  if (!db) return () => {};

  const gatesRef = collection(db, 'users', userId, 'gates');
  const q = query(gatesRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const gates: Gate[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          name: data.name || 'Unnamed Gate',
          description: data.description || '',
          location: data.location || '',
          actuatorDeviceId: data.actuatorDeviceId || null,
          sensorDeviceId: data.sensorDeviceId || null,
          reportedState: (data.reportedState as GateReportedState) || 'unknown',
          pendingCommandId: data.pendingCommandId || null,
          activeCommandSource: data.activeCommandSource || null,
          controlMode: data.controlMode === 'automatic' ||
            (!data.controlMode && data.automationConfig?.enabled)
            ? 'automatic'
            : 'manual',
          automationConfig: data.automationConfig || null,
          automationReading: data.automationReading || null,
          quadrantPlacement: data.quadrantPlacement || null,
          createdAt: data.createdAt || Date.now(),
          updatedAt: data.updatedAt || Date.now(),
        };
      });
      onUpdate(gates);
    },
    (error) => {
      console.error('Error fetching gates:', error);
      onError?.(error);
    }
  );
};

export const createGate = async (
  userId: string,
  input: {
    name: string;
    description?: string;
    location?: string;
    actuatorDeviceId?: string | null;
    sensorDeviceId?: string | null;
  }
): Promise<string> => {
  if (!db) throw new Error('Firestore is not initialized.');

  const trimmedName = input.name.trim();
  if (!trimmedName) throw new Error('Gate Name is required.');

  // If an actuator is chosen, verify it's not already assigned to another gate
  if (input.actuatorDeviceId) {
    const gatesRef = collection(db, 'users', userId, 'gates');
    const q = query(gatesRef, where('actuatorDeviceId', '==', input.actuatorDeviceId));
    const conflict = await getDocs(q);
    if (!conflict.empty) {
      throw new Error('This actuator is already assigned to another irrigation gate.');
    }
  }

  const now = Date.now();
  const newGate = {
    name: trimmedName,
    description: input.description?.trim() || '',
    location: input.location?.trim() || '',
    actuatorDeviceId: input.actuatorDeviceId || null,
    sensorDeviceId: input.sensorDeviceId || null,
    reportedState: 'unknown',
    pendingCommandId: null,
    activeCommandSource: null,
    controlMode: 'manual',
    automationConfig: null,
    automationReading: null,
    quadrantPlacement: null,
    createdAt: now,
    updatedAt: now,
  };

  const gatesRef = collection(db, 'users', userId, 'gates');
  const docRef = await addDoc(gatesRef, newGate);

  // Link device to gate if actuator selected
  if (input.actuatorDeviceId) {
    const devicesRef = collection(db, 'users', userId, 'devices');
    const devQuery = query(devicesRef, where('deviceId', '==', input.actuatorDeviceId));
    const devSnap = await getDocs(devQuery);
    if (!devSnap.empty) {
      await updateDoc(devSnap.docs[0].ref, { assignedGateId: docRef.id });
    }
  }

  return docRef.id;
};

export const setGateControlMode = async (
  userId: string,
  gate: Gate,
  sensor: Device | null,
  mode: GateControlMode
): Promise<void> => {
  if (!db) throw new Error('Firestore is not initialized.');
  if (gate.reportedState === 'moving' || gate.pendingCommandId) {
    throw new Error('Wait for the current gate movement to finish before changing modes.');
  }
  if (mode === 'automatic' && !gate.actuatorDeviceId) {
    throw new Error('Assign an actuator before enabling Automatic mode.');
  }
  if (mode === 'automatic' && (!gate.sensorDeviceId || !sensor)) {
    throw new Error('Link a soil sensor before enabling Automatic mode.');
  }

  const gateRef = doc(db, 'users', userId, 'gates', gate.id);
  const sensorRef = sensor ? doc(db, 'users', userId, 'devices', sensor.id) : null;
  await runTransaction(db, async (transaction) => {
    const gateSnapshot = await transaction.get(gateRef);
    if (!gateSnapshot.exists()) throw new Error('The selected gate no longer exists.');
    const currentGate = gateSnapshot.data();
    if (currentGate.reportedState === 'moving' || currentGate.pendingCommandId) {
      throw new Error('A gate movement is in progress. Try again when it finishes.');
    }

    if (mode === 'automatic') {
      if (!sensorRef || !sensor) throw new Error('Linked sensor was not found.');
      const sensorSnapshot = await transaction.get(sensorRef);
      if (!sensorSnapshot.exists()) throw new Error('Linked sensor was not found.');
      const config = sensorSnapshot.data().automationConfig;
      if (!config) throw new Error('AUTOMATION_SETUP_REQUIRED');
      const gateIds = [...new Set([...(config.gateIds || []), gate.id])];
      const now = Date.now();
      transaction.update(sensorRef, {
        'automationConfig.gateIds': gateIds,
        'automationConfig.updatedAt': now,
      });
      transaction.update(gateRef, {
        controlMode: 'automatic',
        automationConfig: {
          enabled: true,
          sensorDeviceId: sensor.deviceId,
          temperatureThresholdC: config.temperatureThresholdC,
          moistureThresholdPercent: config.moistureThresholdPercent,
          temperatureHysteresisC: 2,
          moistureHysteresisPercent: 5,
          updatedAt: now,
        },
        automationReading: null,
        updatedAt: now,
      });
      return;
    }

    const now = Date.now();
    if (sensorRef) {
      const sensorSnapshot = await transaction.get(sensorRef);
      if (sensorSnapshot.exists() && sensorSnapshot.data().automationConfig) {
        const config = sensorSnapshot.data().automationConfig;
        transaction.update(sensorRef, {
          'automationConfig.gateIds': (config.gateIds || []).filter((id: string) => id !== gate.id),
          'automationConfig.updatedAt': now,
        });
      }
    }
    transaction.update(gateRef, {
      controlMode: 'manual',
      automationConfig: null,
      automationReading: null,
      updatedAt: now,
    });
  });
};

export const updateGate = async (
  userId: string,
  gateId: string,
  input: {
    name: string;
    description?: string;
    location?: string;
    actuatorDeviceId?: string | null;
    sensorDeviceId?: string | null;
    oldActuatorDeviceId?: string | null;
    oldSensorDeviceId?: string | null;
  }
): Promise<void> => {
  if (!db) throw new Error('Firestore is not initialized.');

  const trimmedName = input.name.trim();
  if (!trimmedName) throw new Error('Gate Name is required.');

  // Check if actuator changed
  if (input.actuatorDeviceId && input.actuatorDeviceId !== input.oldActuatorDeviceId) {
    const gatesRef = collection(db, 'users', userId, 'gates');
    const q = query(gatesRef, where('actuatorDeviceId', '==', input.actuatorDeviceId));
    const conflict = await getDocs(q);
    const conflicting = conflict.docs.find((d) => d.id !== gateId);
    if (conflicting) {
      throw new Error('This actuator is already assigned to another irrigation gate.');
    }
  }

  const gateDocRef = doc(db, 'users', userId, 'gates', gateId);
  const assignmentsChanged =
    input.actuatorDeviceId !== input.oldActuatorDeviceId ||
    input.sensorDeviceId !== input.oldSensorDeviceId;
  await updateDoc(gateDocRef, {
    name: trimmedName,
    description: input.description?.trim() || '',
    location: input.location?.trim() || '',
    actuatorDeviceId: input.actuatorDeviceId || null,
    sensorDeviceId: input.sensorDeviceId || null,
    updatedAt: Date.now(),
    ...(assignmentsChanged ? { controlMode: 'manual', automationConfig: null, automationReading: null } : {}),
  });

  if (assignmentsChanged && input.oldSensorDeviceId) {
    const devicesRef = collection(db, 'users', userId, 'devices');
    const sensorQuery = query(devicesRef, where('deviceId', '==', input.oldSensorDeviceId));
    const sensorSnapshot = await getDocs(sensorQuery);
    if (!sensorSnapshot.empty) {
      await updateDoc(sensorSnapshot.docs[0].ref, {
        'automationConfig.gateIds': arrayRemove(gateId),
      }).catch(console.warn);
    }
  }

  // Re-link devices if actuator changed
  if (input.actuatorDeviceId !== input.oldActuatorDeviceId) {
    const devicesRef = collection(db, 'users', userId, 'devices');

    // Unlink old actuator
    if (input.oldActuatorDeviceId) {
      const oldQuery = query(devicesRef, where('deviceId', '==', input.oldActuatorDeviceId));
      const oldSnap = await getDocs(oldQuery);
      if (!oldSnap.empty) {
        await updateDoc(oldSnap.docs[0].ref, { assignedGateId: null }).catch(console.warn);
      }
    }

    // Link new actuator
    if (input.actuatorDeviceId) {
      const newQuery = query(devicesRef, where('deviceId', '==', input.actuatorDeviceId));
      const newSnap = await getDocs(newQuery);
      if (!newSnap.empty) {
        await updateDoc(newSnap.docs[0].ref, { assignedGateId: gateId }).catch(console.warn);
      }
    }
  }
};

export const deleteGate = async (
  userId: string,
  gateId: string,
  actuatorDeviceId?: string | null,
  sensorDeviceId?: string | null
): Promise<void> => {
  if (!db) throw new Error('Firestore is not initialized.');

  // Unlink assigned actuator
  if (actuatorDeviceId) {
    const devicesRef = collection(db, 'users', userId, 'devices');
    const q = query(devicesRef, where('deviceId', '==', actuatorDeviceId));
    const snap = await getDocs(q);
    if (!snap.empty) {
      await updateDoc(snap.docs[0].ref, { assignedGateId: null }).catch(console.warn);
    }
  }

  if (sensorDeviceId) {
    const devicesRef = collection(db, 'users', userId, 'devices');
    const q = query(devicesRef, where('deviceId', '==', sensorDeviceId));
    const snap = await getDocs(q);
    if (!snap.empty) {
      await updateDoc(snap.docs[0].ref, {
        'automationConfig.gateIds': arrayRemove(gateId),
      }).catch(console.warn);
    }
  }

  const gateDocRef = doc(db, 'users', userId, 'gates', gateId);
  await deleteDoc(gateDocRef);
};
