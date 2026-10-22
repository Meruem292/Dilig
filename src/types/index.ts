export type DeviceType = 'sensor' | 'actuator';

export type DeviceStatus = 'online' | 'offline' | 'unknown';

export type GateReportedState = 'open' | 'closed' | 'moving' | 'unknown' | 'error';

export type CommandAction = 'OPEN' | 'CLOSE';

export type CommandStatus = 'pending' | 'executing' | 'succeeded' | 'failed' | 'expired';

export interface SoilThresholds {
  dryMoistureMax: number;   // Below this is "Dry" (e.g. 30%)
  wetMoistureMin: number;   // Above this is "Wet" (e.g. 70%)
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName?: string | null;
  createdAt?: string;
  thresholds?: SoilThresholds;
}

export interface SoilReading {
  id?: string;
  deviceId: string;
  soilTemperatureC: number;
  soilMoisturePercent: number;
  recordedAt: number; // epoch ms for consistent serialization
}

export interface Device {
  id: string; // Firestore document ID
  deviceId: string; // Hardware ID string, e.g. ESP32-SN01
  name: string;
  type: DeviceType;
  status: DeviceStatus;
  lastSeenAt?: number | null; // epoch ms
  createdAt: number;
  updatedAt: number;
  assignedGateId?: string | null;
  latestReading?: SoilReading | null;
}

export interface Gate {
  id: string;
  name: string;
  description?: string;
  location?: string;
  actuatorDeviceId?: string | null;
  sensorDeviceId?: string | null;
  reportedState: GateReportedState;
  pendingCommandId?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface GateCommand {
  id: string;
  gateId: string;
  actuatorDeviceId: string;
  command: CommandAction;
  status: CommandStatus;
  requestedAt: number;
  completedAt?: number | null;
  errorMessage?: string | null;
}
