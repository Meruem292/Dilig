import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { SoilReading, SoilThresholds } from '../types';

const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

export type MoistureCondition = 'Dry' | 'Normal' | 'Wet' | 'Unknown';

export const classifyMoisture = (
  moisture: number | null | undefined,
  thresholds?: SoilThresholds
): { condition: MoistureCondition; label: string; badgeColor: string; textColor: string; bgColor: string } => {
  if (moisture === null || moisture === undefined || isNaN(moisture)) {
    return {
      condition: 'Unknown',
      label: 'No Reading',
      badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
      textColor: 'text-slate-600',
      bgColor: 'bg-slate-50',
    };
  }

  const dryMax = thresholds?.dryMoistureMax ?? 30;
  const wetMin = thresholds?.wetMoistureMin ?? 70;

  if (moisture < dryMax) {
    return {
      condition: 'Dry',
      label: 'Dry — Needs Water',
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
      textColor: 'text-amber-700',
      bgColor: 'bg-amber-50',
    };
  }

  if (moisture > wetMin) {
    return {
      condition: 'Wet',
      label: 'Wet — Sufficient Moisture',
      badgeColor: 'bg-water-100 text-water-800 border-water-300',
      textColor: 'text-water-700',
      bgColor: 'bg-water-50',
    };
  }

  return {
    condition: 'Normal',
    label: 'Normal — Optimal Condition',
    badgeColor: 'bg-nature-100 text-nature-800 border-nature-300',
    textColor: 'text-nature-700',
    bgColor: 'bg-nature-50',
  };
};

export const isReadingStale = (recordedAt: number | null | undefined): boolean => {
  if (!recordedAt) return true;
  return Date.now() - recordedAt > STALE_THRESHOLD_MS;
};

export const formatTimeAgo = (epochMs: number | null | undefined): string => {
  if (!epochMs) return 'Never';
  const diffSec = Math.floor((Date.now() - epochMs) / 1000);

  if (diffSec < 45) return 'Just now';
  if (diffSec < 90) return '1 minute ago';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} minutes ago`;
  if (diffSec < 7200) return '1 hour ago';
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hours ago`;
  return `${Math.floor(diffSec / 86400)} days ago`;
};

export const subscribeToDeviceReadings = (
  userId: string,
  deviceDocId: string,
  onUpdate: (reading: SoilReading | null) => void,
  onError?: (err: Error) => void
): (() => void) => {
  if (!db) return () => {};

  const readingsRef = collection(db, 'users', userId, 'devices', deviceDocId, 'readings');
  const q = query(readingsRef, orderBy('recordedAt', 'desc'), limit(1));

  return onSnapshot(
    q,
    (snapshot) => {
      if (snapshot.empty) {
        onUpdate(null);
        return;
      }
      const data = snapshot.docs[0].data();
      onUpdate({
        id: snapshot.docs[0].id,
        deviceId: data.deviceId,
        soilTemperatureC: data.soilTemperatureC,
        soilMoisturePercent: data.soilMoisturePercent,
        recordedAt: data.recordedAt || Date.now(),
      });
    },
    (err) => {
      console.warn('Error fetching device readings:', err);
      onError?.(err);
    }
  );
};
