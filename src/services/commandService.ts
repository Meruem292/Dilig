import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { Gate, Device, CommandAction } from '../types';
import { isDeviceOnline } from './deviceService';

const COMMAND_TIMEOUT_MS = 75 * 1000; // 60s motor cutoff + network/reporting margin

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

  // Atomically reserve the gate and create its command so duplicate clients
  // cannot leave a command without a matching moving/pending gate state.
  const commandsRef = collection(db, 'users', userId, 'gates', gate.id, 'commands');
  const commandDoc = doc(commandsRef);
  const commandId = commandDoc.id;
  const gateRef = doc(db, 'users', userId, 'gates', gate.id);

  await runTransaction(db, async (transaction) => {
    const gateSnapshot = await transaction.get(gateRef);
    if (!gateSnapshot.exists()) {
      throw new Error('The selected gate no longer exists.');
    }

    const currentGate = gateSnapshot.data();
    if (currentGate.reportedState === 'moving' || currentGate.pendingCommandId) {
      throw new Error('A gate movement is already in progress. Please wait for it to complete.');
    }
    if (currentGate.actuatorDeviceId !== gate.actuatorDeviceId) {
      throw new Error('The gate actuator assignment changed. Refresh and try again.');
    }

    transaction.set(commandDoc, {
      gateId: gate.id,
      actuatorDeviceId: gate.actuatorDeviceId,
      command: action,
      status: 'pending',
      requestedAt: now,
      completedAt: null,
      errorMessage: null,
    });
    transaction.update(gateRef, {
      reportedState: 'moving',
      pendingCommandId: commandId,
      updatedAt: now,
    });
  });

  // Spark-plan fallback: expire the command while a user client remains open.
  // The actuator independently enforces its 60-second motor cutoff.
  const timeoutTimer = setTimeout(async () => {
    try {
      if (!db) return;
      await runTransaction(db, async (transaction) => {
        const [commandSnapshot, gateSnapshot] = await Promise.all([
          transaction.get(commandDoc),
          transaction.get(gateRef),
        ]);
        if (!commandSnapshot.exists() || !gateSnapshot.exists()) return;

        const status = commandSnapshot.data().status;
        if (status !== 'pending' && status !== 'executing') return;

        const completedAt = Date.now();
        transaction.update(commandDoc, {
          status: 'expired',
          errorMessage: 'Command timed out: Actuator did not confirm completion within 75 seconds.',
          completedAt,
        });

        if (gateSnapshot.data().pendingCommandId === commandId) {
          transaction.update(gateRef, {
            reportedState: 'error',
            pendingCommandId: null,
            updatedAt: completedAt,
          });
        }
      });
    } catch (err) {
      console.warn('Timeout handler error:', err);
    }
  }, COMMAND_TIMEOUT_MS);

  // Listen for completion or failure to clear the timeout.
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
