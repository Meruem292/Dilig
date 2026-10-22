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
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Gate, GateReportedState } from '../types';

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
  await updateDoc(gateDocRef, {
    name: trimmedName,
    description: input.description?.trim() || '',
    location: input.location?.trim() || '',
    actuatorDeviceId: input.actuatorDeviceId || null,
    sensorDeviceId: input.sensorDeviceId || null,
    updatedAt: Date.now(),
  });

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
  actuatorDeviceId?: string | null
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

  const gateDocRef = doc(db, 'users', userId, 'gates', gateId);
  await deleteDoc(gateDocRef);
};
