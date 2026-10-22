import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  onSnapshot,
  orderBy,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Device, DeviceType } from '../types';

const HEARTBEAT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export const isDeviceOnline = (device: Device): boolean => {
  if (device.status === 'offline') return false;
  if (!device.lastSeenAt) return false;
  return Date.now() - device.lastSeenAt < HEARTBEAT_TIMEOUT_MS;
};

export const subscribeToUserDevices = (
  userId: string,
  onUpdate: (devices: Device[]) => void,
  onError?: (err: Error) => void
): (() => void) => {
  if (!db) return () => {};

  const devicesRef = collection(db, 'users', userId, 'devices');
  const q = query(devicesRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const devices: Device[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          deviceId: data.deviceId || '',
          name: data.name || '',
          type: data.type as DeviceType,
          status: data.status || 'unknown',
          lastSeenAt: data.lastSeenAt || null,
          createdAt: data.createdAt || Date.now(),
          updatedAt: data.updatedAt || Date.now(),
          assignedGateId: data.assignedGateId || null,
          latestReading: data.latestReading || null,
        };
      });
      onUpdate(devices);
    },
    (error) => {
      console.error('Error fetching devices:', error);
      onError?.(error);
    }
  );
};

export const addDevice = async (
  userId: string,
  input: { deviceId: string; name: string; type: DeviceType }
): Promise<string> => {
  if (!db) throw new Error('Firestore is not initialized.');

  const trimmedId = input.deviceId.trim().toUpperCase();
  const trimmedName = input.name.trim();

  if (!trimmedId) throw new Error('Device ID is required.');
  if (!trimmedName) throw new Error('Device Name is required.');

  // Check if deviceId already registered by user
  const devicesRef = collection(db, 'users', userId, 'devices');
  const existingQuery = query(devicesRef, where('deviceId', '==', trimmedId));
  const existingDocs = await getDocs(existingQuery);

  if (!existingDocs.empty) {
    throw new Error(`Device ID "${trimmedId}" is already registered in your account.`);
  }

  const now = Date.now();
  const newDevice = {
    deviceId: trimmedId,
    name: trimmedName,
    type: input.type,
    status: 'unknown',
    lastSeenAt: null,
    createdAt: now,
    updatedAt: now,
    assignedGateId: null,
  };

  const docRef = await addDoc(devicesRef, newDevice);
  return docRef.id;
};

export const updateDeviceName = async (
  userId: string,
  deviceDocId: string,
  newName: string
): Promise<void> => {
  if (!db) throw new Error('Firestore is not initialized.');
  const trimmedName = newName.trim();
  if (!trimmedName) throw new Error('Device Name cannot be empty.');

  const deviceDocRef = doc(db, 'users', userId, 'devices', deviceDocId);
  await updateDoc(deviceDocRef, {
    name: trimmedName,
    updatedAt: Date.now(),
  });
};

export const deleteDevice = async (
  userId: string,
  deviceDocId: string,
  assignedGateId?: string | null
): Promise<void> => {
  if (!db) throw new Error('Firestore is not initialized.');

  // If this device was assigned to a gate, unlink it first
  if (assignedGateId) {
    const gateDocRef = doc(db, 'users', userId, 'gates', assignedGateId);
    await updateDoc(gateDocRef, {
      actuatorDeviceId: null,
      updatedAt: Date.now(),
    }).catch(console.warn);
  }

  const deviceDocRef = doc(db, 'users', userId, 'devices', deviceDocId);
  await deleteDoc(deviceDocRef);
};
