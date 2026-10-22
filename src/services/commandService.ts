import {
  collection,
  doc,
  addDoc,
  updateDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Gate, Device, CommandAction } from '../types';
import { isDeviceOnline } from './deviceService';

const COMMAND_TIMEOUT_MS = 35 * 1000; // 35 seconds timeout

export const sendGateCommand = async (
  userId: string,
  gate: Gate,
  actuatorDevice: Device | null,
  action: CommandAction
): Promise<string> => {
  if (!db) throw new Error('Database is not initialized.');

  if (!gate.actuatorDeviceId || !actuatorDevice) {
    throw new Error('This gate does not have an assigned actuator device.');
  }

  if (actuatorDevice.type !== 'actuator') {
    throw new Error('Assigned device is not a valid gate actuator.');
  }

  if (!isDeviceOnline(actuatorDevice)) {
    throw new Error(`Actuator "${actuatorDevice.name}" is currently offline. Cannot send command.`);
  }

  if (gate.reportedState === 'moving') {
    throw new Error('A gate movement is already in progress. Please wait for it to complete.');
  }

  const now = Date.now();

  // 1. Create Command in Firestore subcollection
  const commandsRef = collection(db, 'users', userId, 'gates', gate.id, 'commands');
  const commandDoc = await addDoc(commandsRef, {
    gateId: gate.id,
    actuatorDeviceId: gate.actuatorDeviceId,
    command: action,
    status: 'pending',
    requestedAt: now,
    completedAt: null,
    errorMessage: null,
  });

  const commandId = commandDoc.id;

  // 2. Update Gate to "moving" with pendingCommandId
  const gateRef = doc(db, 'users', userId, 'gates', gate.id);
  await updateDoc(gateRef, {
    reportedState: 'moving',
    pendingCommandId: commandId,
    updatedAt: now,
  });

  // 3. Start client-side timeout watcher to prevent infinite pending if actuator is unreachable
  const timeoutTimer = setTimeout(async () => {
    try {
      if (!db) return;
      const cmdRef = doc(db, 'users', userId, 'gates', gate.id, 'commands', commandId);
      await updateDoc(cmdRef, {
        status: 'expired',
        errorMessage: 'Command timed out: Actuator did not confirm completion within 35 seconds.',
        completedAt: Date.now(),
      });

      // Reset gate state to error/unknown
      await updateDoc(gateRef, {
        reportedState: 'error',
        pendingCommandId: null,
        updatedAt: Date.now(),
      });
    } catch (err) {
      console.warn('Timeout handler error:', err);
    }
  }, COMMAND_TIMEOUT_MS);

  // 4. Listen for completion or failure to clear the timeout
  const unsubscribe = onSnapshot(commandDoc, (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    if (data.status === 'succeeded' || data.status === 'failed' || data.status === 'expired') {
      clearTimeout(timeoutTimer);
      unsubscribe();
    }
  });

  return commandId;
};
