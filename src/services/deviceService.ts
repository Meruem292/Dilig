import {
  collection,
  deleteDoc,
  doc,
  updateDoc,
  query,
  onSnapshot,
  orderBy,
  runTransaction,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Device, DeviceType } from '../types';

const HEARTBEAT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const DEVICE_ID_PATTERN = /^[A-Z0-9][A-Z0-9_-]{2,63}$/;

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
          registryVersion: data.registryVersion || undefined,
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

/**
 * Backfills the global routing document for devices created before the
 * deviceRegistry collection existed. The transaction never takes ownership
 * of an ID that is already registered to another account or device.
 */
export const ensureDeviceRegistry = async (
  userId: string,
  device: Device
): Promise<void> => {
  if (!db) return;

  const hardwareId = device.deviceId.trim().toUpperCase();
  if (!DEVICE_ID_PATTERN.test(hardwareId)) {
    throw new Error(`Cannot repair invalid device ID "${device.deviceId}".`);
  }

  const deviceRef = doc(db, 'users', userId, 'devices', device.id);
  const registryRef = doc(db, 'deviceRegistry', hardwareId);

  await runTransaction(db, async (transaction) => {
    const registrySnapshot = await transaction.get(registryRef);

    if (registrySnapshot.exists()) {
      const registry = registrySnapshot.data();
      if (
        registry.userId !== userId ||
        registry.deviceDocId !== device.id ||
        registry.type !== device.type
      ) {
        throw new Error(`Device ID "${hardwareId}" is registered to another device.`);
      }
    } else {
      transaction.set(registryRef, {
        deviceId: hardwareId,
        userId,
        deviceDocId: device.id,
        type: device.type,
        createdAt: Date.now(),
      });
    }

    if (device.registryVersion !== 1) {
      transaction.update(deviceRef, {
        registryVersion: 1,
        updatedAt: Date.now(),
      });
    }
  });
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
  if (!DEVICE_ID_PATTERN.test(trimmedId)) {
    throw new Error('Device ID must be 3-64 characters using only letters, numbers, hyphens, or underscores.');
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
    registryVersion: 1,
  };

  const devicesRef = collection(db, 'users', userId, 'devices');
  const deviceRef = doc(devicesRef);
  const registryRef = doc(db, 'deviceRegistry', trimmedId);

  const batch = writeBatch(db);
  batch.set(deviceRef, newDevice);
  batch.set(registryRef, {
      deviceId: trimmedId,
      userId,
      deviceDocId: deviceRef.id,
      type: input.type,
      createdAt: now,
  });

  try {
    await batch.commit();
  } catch (error: unknown) {
    const firebaseCode = (error as { code?: string }).code;
    if (firebaseCode === 'permission-denied') {
      throw new Error(`Device ID "${trimmedId}" is already registered to an account.`);
    }
    throw error;
  }

  return deviceRef.id;
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
  device: Device
): Promise<void> => {
  if (!db) throw new Error('Firestore is not initialized.');

  // If this device was assigned to a gate, unlink it first
  if (device.assignedGateId) {
    const gateDocRef = doc(db, 'users', userId, 'gates', device.assignedGateId);
    await updateDoc(gateDocRef, {
      [device.type === 'actuator' ? 'actuatorDeviceId' : 'sensorDeviceId']: null,
      updatedAt: Date.now(),
    }).catch(console.warn);
  }

  const deviceDocRef = doc(db, 'users', userId, 'devices', device.id);

  // Devices created before the global registry feature have no registry entry.
  if (device.registryVersion !== 1) {
    await deleteDoc(deviceDocRef);
    return;
  }

  const registryRef = doc(db, 'deviceRegistry', device.deviceId.trim().toUpperCase());

  await runTransaction(db, async (transaction) => {
    const registrySnapshot = await transaction.get(registryRef);
    if (
      registrySnapshot.exists() &&
      registrySnapshot.data().userId === userId &&
      registrySnapshot.data().deviceDocId === device.id
    ) {
      transaction.delete(registryRef);
    }
    transaction.delete(deviceDocRef);
  });
};
