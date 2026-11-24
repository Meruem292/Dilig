import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type {
  Device,
  Gate,
  Quadrant,
  QuadrantColor,
  QuadrantEdge,
  QuadrantPlacement,
} from '../types';

const validateCoordinate = (value: number) =>
  Number.isFinite(value) && value >= 0 && value <= 1;

export const subscribeToUserQuadrants = (
  userId: string,
  onUpdate: (quadrants: Quadrant[]) => void,
  onError?: (error: Error) => void
): (() => void) => {
  if (!db) return () => {};
  const quadrantsQuery = query(
    collection(db, 'users', userId, 'quadrants'),
    orderBy('createdAt', 'asc')
  );
  return onSnapshot(
    quadrantsQuery,
    (snapshot) => {
      onUpdate(snapshot.docs.map((item) => {
        const data = item.data();
        return {
          id: item.id,
          name: data.name || 'Unnamed Quadrant',
          description: data.description || '',
          color: data.color || 'green',
          createdAt: data.createdAt || Date.now(),
          updatedAt: data.updatedAt || Date.now(),
        } as Quadrant;
      }));
    },
    (error) => onError?.(error)
  );
};

export const createQuadrant = async (
  userId: string,
  input: { name: string; description?: string; color: QuadrantColor }
): Promise<string> => {
  if (!db) throw new Error('Firestore is not initialized.');
  const name = input.name.trim();
  if (!name) throw new Error('Quadrant name is required.');
  const now = Date.now();
  const result = await addDoc(collection(db, 'users', userId, 'quadrants'), {
    name,
    description: input.description?.trim() || '',
    color: input.color,
    createdAt: now,
    updatedAt: now,
  });
  return result.id;
};

export const updateQuadrant = async (
  userId: string,
  quadrantId: string,
  input: { name: string; description?: string; color: QuadrantColor }
): Promise<void> => {
  if (!db) throw new Error('Firestore is not initialized.');
  const name = input.name.trim();
  if (!name) throw new Error('Quadrant name is required.');
  await updateDoc(doc(db, 'users', userId, 'quadrants', quadrantId), {
    name,
    description: input.description?.trim() || '',
    color: input.color,
    updatedAt: Date.now(),
  });
};

export const deleteQuadrant = async (
  userId: string,
  quadrantId: string,
  gates: Gate[],
  devices: Device[]
): Promise<void> => {
  if (!db) throw new Error('Firestore is not initialized.');
  const batch = writeBatch(db);
  for (const gate of gates.filter((item) => item.quadrantPlacement?.quadrantId === quadrantId)) {
    batch.update(doc(db, 'users', userId, 'gates', gate.id), {
      quadrantPlacement: null,
      updatedAt: Date.now(),
    });
  }
  for (const device of devices.filter((item) => item.quadrantPlacement?.quadrantId === quadrantId)) {
    batch.update(doc(db, 'users', userId, 'devices', device.id), {
      quadrantPlacement: null,
      updatedAt: Date.now(),
    });
  }
  batch.delete(doc(db, 'users', userId, 'quadrants', quadrantId));
  await batch.commit();
};

export const updateGatePlacement = async (
  userId: string,
  gateId: string,
  placement: QuadrantPlacement | null
): Promise<void> => {
  if (!db) throw new Error('Firestore is not initialized.');
  if (placement && (
    !validateCoordinate(placement.x) ||
    !validateCoordinate(placement.y) ||
    !(['north', 'east', 'south', 'west'] as QuadrantEdge[]).includes(placement.edge as QuadrantEdge)
  )) throw new Error('Invalid gate placement.');
  await updateDoc(doc(db, 'users', userId, 'gates', gateId), {
    quadrantPlacement: placement,
    updatedAt: Date.now(),
  });
};

export const updateSensorPlacement = async (
  userId: string,
  deviceId: string,
  placement: QuadrantPlacement | null
): Promise<void> => {
  if (!db) throw new Error('Firestore is not initialized.');
  if (placement && (!validateCoordinate(placement.x) || !validateCoordinate(placement.y))) {
    throw new Error('Invalid sensor placement.');
  }
  await updateDoc(doc(db, 'users', userId, 'devices', deviceId), {
    quadrantPlacement: placement,
    updatedAt: Date.now(),
  });
};
