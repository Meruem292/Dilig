import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { Layout } from './components/layout/Layout';
import type { NavTab } from './components/layout/BottomNav';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { GatesPage } from './pages/GatesPage';
import { DevicesPage } from './pages/DevicesPage';
import { QuadrantsPage } from './pages/QuadrantsPage';
import { GateFormModal } from './components/gates/GateFormModal';
import { DeviceFormModal } from './components/devices/DeviceFormModal';
import { ProfileModal } from './components/settings/ProfileModal';
import { SoilThresholdModal } from './components/settings/SoilThresholdModal';
import { LoadingSpinner } from './components/common/LoadingSpinner';
import { GateAutomationSetupModal } from './components/gates/GateAutomationSetupModal';

import type {
  Gate,
  Device,
  CommandAction,
  DeviceType,
  GateControlMode,
  Quadrant,
  QuadrantColor,
  QuadrantPlacement,
} from './types';
import {
  subscribeToUserDevices,
  addDevice,
  updateDeviceName,
  deleteDevice,
  ensureDeviceRegistry,
  updateMainGateTiming,
  updateSubGateAngles,
  updateSensorAutomation,
} from './services/deviceService';
import { subscribeToUserGates, createGate, updateGate, deleteGate, setGateControlMode } from './services/gateService';
import { sendGateCommand } from './services/commandService';
import {
  subscribeToUserQuadrants,
  createQuadrant,
  updateQuadrant,
  deleteQuadrant,
  updateGatePlacement,
  updateSensorPlacement,
} from './services/quadrantService';

const MainApp: React.FC = () => {
  const { currentUser, userProfile, loading: authLoading } = useAuth();
  const { showSuccess, showError, showInfo } = useToast();

  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const [gates, setGates] = useState<Gate[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [quadrants, setQuadrants] = useState<Quadrant[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const registryRepairs = useRef(new Set<string>());

  // Modals state
  const [isAddGateOpen, setIsAddGateOpen] = useState(false);
  const [gateToEdit, setGateToEdit] = useState<Gate | null>(null);
  const [isAddDeviceOpen, setIsAddDeviceOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isThresholdsOpen, setIsThresholdsOpen] = useState(false);
  const [automationGateToConfigure, setAutomationGateToConfigure] = useState<Gate | null>(null);

  // Real-time Firestore subscriptions for authenticated user
  useEffect(() => {
    if (!currentUser) {
      setGates([]);
      setDevices([]);
      setQuadrants([]);
      setDataLoading(false);
      return;
    }

    setDataLoading(true);

    // 1. Subscribe to User Devices
    const unsubDevices = subscribeToUserDevices(
      currentUser.uid,
      (fetchedDevices) => {
        setDevices(fetchedDevices);
        setDataLoading(false);
      },
      (err) => {
        showError('Device sync error', err.message);
        setDataLoading(false);
      }
    );

    // 2. Subscribe to User Gates
    const unsubGates = subscribeToUserGates(
      currentUser.uid,
      (fetchedGates) => {
        setGates(fetchedGates);
      },
      (err) => {
        showError('Gate sync error', err.message);
      }
    );

    const unsubQuadrants = subscribeToUserQuadrants(
      currentUser.uid,
      setQuadrants,
      (err) => showError('Field map sync error', err.message)
    );

    return () => {
      unsubDevices();
      unsubGates();
      unsubQuadrants();
    };
  }, [currentUser]);

  // Find primary soil sensor device to display on home dashboard
  const primarySensorDevice = useMemo(() => {
    return devices.find((d) => d.type === 'sensor') || null;
  }, [devices]);

  // The firmware updates latestReading atomically with the device heartbeat,
  // so this uses the same real-time snapshot that powers every device card.
  const latestReading = primarySensorDevice?.latestReading ?? null;

  // Devices created before deviceRegistry was introduced cannot route their
  // telemetry. Repair those records once, without claiming an ID owned by a
  // different account.
  useEffect(() => {
    if (!currentUser) return;

    for (const device of devices) {
      // New registrations create the device and registry atomically. The
      // realtime listener may expose the local pending device before that
      // batch reaches the server, so never start a competing registry-only
      // repair for records already using the current registry contract.
      if (device.registryVersion === 1) continue;

      const repairKey = `${currentUser.uid}/${device.id}`;
      if (registryRepairs.current.has(repairKey)) continue;

      registryRepairs.current.add(repairKey);
      void ensureDeviceRegistry(currentUser.uid, device).catch((error: unknown) => {
        registryRepairs.current.delete(repairKey);
        showError(
          'Device routing repair failed',
          (error as Error).message || 'Could not connect this device to live telemetry.'
        );
      });
    }
  }, [currentUser, devices, showError]);

  // Command execution handler
  const handleSendCommand = async (gate: Gate, action: CommandAction) => {
    if (!currentUser) return;
    const actuator = devices.find((d) => d.deviceId === gate.actuatorDeviceId) || null;

    try {
      await sendGateCommand(currentUser.uid, gate, actuator, action);
      showInfo(
        'Command transmitted',
        `Signal to ${action} "${gate.name}" sent to actuator. Waiting for execution confirmation.`
      );
    } catch (err: unknown) {
      showError('Command failed', (err as Error).message || 'Could not send gate command.');
      throw err;
    }
  };

  // Gate CRUD handlers
  const handleCreateOrUpdateGate = async (data: {
    name: string;
    description?: string;
    location?: string;
    actuatorDeviceId?: string | null;
    sensorDeviceId?: string | null;
  }) => {
    if (!currentUser) return;

    if (gateToEdit) {
      await updateGate(currentUser.uid, gateToEdit.id, {
        ...data,
        oldActuatorDeviceId: gateToEdit.actuatorDeviceId,
        oldSensorDeviceId: gateToEdit.sensorDeviceId,
      });
      showSuccess('Gate updated', `"${data.name}" has been updated.`);
      setGateToEdit(null);
    } else {
      await createGate(currentUser.uid, data);
      showSuccess('Gate created', `"${data.name}" added to your irrigation network.`);
    }
  };

  const handleDeleteGate = async (gate: Gate) => {
    if (!currentUser) return;
    try {
      await deleteGate(currentUser.uid, gate.id, gate.actuatorDeviceId, gate.sensorDeviceId);
      showSuccess('Gate deleted', `"${gate.name}" has been removed.`);
    } catch (err: unknown) {
      showError('Delete failed', (err as Error).message || 'Could not delete gate.');
    }
  };

  // Device CRUD handlers
  const handleRegisterDevice = async (data: {
    deviceId: string;
    name: string;
    type: DeviceType;
  }) => {
    if (!currentUser) return;
    await addDevice(currentUser.uid, data);
    showSuccess(
      'Device registered',
      `"${data.name}" (${data.deviceId}) is now connected to your account.`
    );
  };

  const handleUpdateDeviceName = async (device: Device, newName: string) => {
    if (!currentUser) return;
    try {
      await updateDeviceName(currentUser.uid, device.id, newName);
      showSuccess('Device renamed', `Device name changed to "${newName}".`);
    } catch (err: unknown) {
      showError('Update failed', (err as Error).message || 'Could not update device name.');
    }
  };

  const handleDeleteDevice = async (device: Device) => {
    if (!currentUser) return;
    try {
      await deleteDevice(currentUser.uid, device, gates);
      showSuccess('Device removed', `"${device.name}" removed from your account.`);
    } catch (err: unknown) {
      showError('Remove failed', (err as Error).message || 'Could not remove device.');
    }
  };

  const handleUpdateMainGateTiming = async (
    device: Device,
    openDurationMs: number,
    closeDurationMs: number
  ) => {
    if (!currentUser) return;
    try {
      await updateMainGateTiming(currentUser.uid, device.id, openDurationMs, closeDurationMs);
      showSuccess(
        'Gate timing updated',
        `${device.name} will open for ${openDurationMs / 1000}s and close for ${closeDurationMs / 1000}s.`
      );
    } catch (err: unknown) {
      showError('Timing update failed', (err as Error).message || 'Could not update gate timing.');
      throw err;
    }
  };

  const handleUpdateSubGateAngles = async (
    device: Device,
    openAngle: number,
    closeAngle: number
  ) => {
    if (!currentUser) return;
    try {
      await updateSubGateAngles(currentUser.uid, device.id, openAngle, closeAngle);
      showSuccess(
        'Servo angles updated',
        `${device.name} will open to ${openAngle}° and close to ${closeAngle}°.`
      );
    } catch (err: unknown) {
      showError('Angle update failed', (err as Error).message || 'Could not update servo angles.');
      throw err;
    }
  };

  const handleUpdateSensorAutomation = async (
    sensor: Device,
    temperatureThresholdC: number,
    moistureThresholdPercent: number,
    selectedGateIds: string[]
  ) => {
    if (!currentUser) return;
    try {
      await updateSensorAutomation(
        currentUser.uid,
        sensor,
        gates,
        temperatureThresholdC,
        moistureThresholdPercent,
        selectedGateIds
      );
      showSuccess(
        'Automatic gates updated',
        `${selectedGateIds.length} gate${selectedGateIds.length === 1 ? '' : 's'} will respond to ${sensor.name}.`
      );
    } catch (err: unknown) {
      showError('Automation update failed', (err as Error).message || 'Could not update automatic gates.');
      throw err;
    }
  };

  const handleSetControlMode = async (gate: Gate, mode: GateControlMode) => {
    if (!currentUser) return;
    const sensor = devices.find((device) => device.deviceId === gate.sensorDeviceId && device.type === 'sensor') || null;
    if (mode === 'automatic' && sensor && !sensor.automationConfig) {
      setAutomationGateToConfigure(gate);
      return;
    }
    try {
      await setGateControlMode(currentUser.uid, gate, sensor, mode);
      showSuccess(
        `${mode === 'automatic' ? 'Automatic' : 'Manual'} mode enabled`,
        `${gate.name} is now controlled in ${mode} mode.`
      );
    } catch (err: unknown) {
      const message = (err as Error).message || 'Could not change the gate control mode.';
      if (message === 'AUTOMATION_SETUP_REQUIRED') {
        setAutomationGateToConfigure(gate);
        return;
      }
      showError('Mode change failed', message);
      throw err;
    }
  };

  const handleConfigureGateAutomation = async (
    temperatureThresholdC: number,
    moistureThresholdPercent: number
  ) => {
    if (!currentUser || !automationGateToConfigure) return;
    const gate = automationGateToConfigure;
    const sensor = devices.find((device) => device.deviceId === gate.sensorDeviceId && device.type === 'sensor');
    if (!sensor) throw new Error('The linked sensor could not be found.');
    const selectedGateIds = [
      ...new Set([
        ...(sensor.automationConfig?.gateIds || []),
        ...gates.filter((item) => item.sensorDeviceId === sensor.deviceId && item.controlMode === 'automatic').map((item) => item.id),
        gate.id,
      ]),
    ];
    await handleUpdateSensorAutomation(
      sensor,
      temperatureThresholdC,
      moistureThresholdPercent,
      selectedGateIds
    );
  };

  const handleCreateQuadrant = async (input: { name: string; description?: string; color: QuadrantColor }) => {
    if (!currentUser) throw new Error('User is not authenticated.');
    try {
      const id = await createQuadrant(currentUser.uid, input);
      showSuccess('Quadrant added', `"${input.name}" is ready for gate and sensor placement.`);
      return id;
    } catch (err: unknown) {
      showError('Could not add quadrant', (err as Error).message || 'Try again.');
      throw err;
    }
  };

  const handleUpdateQuadrant = async (
    quadrant: Quadrant,
    input: { name: string; description?: string; color: QuadrantColor }
  ) => {
    if (!currentUser) return;
    await updateQuadrant(currentUser.uid, quadrant.id, input);
    showSuccess('Quadrant updated', `"${input.name}" has been saved.`);
  };

  const handleDeleteQuadrant = async (quadrant: Quadrant) => {
    if (!currentUser) return;
    await deleteQuadrant(currentUser.uid, quadrant.id, gates, devices);
    showSuccess('Quadrant deleted', 'Its gates and sensors are now unplaced.');
  };

  const handleMoveGate = async (gate: Gate, placement: QuadrantPlacement | null) => {
    if (!currentUser) return;
    try {
      await updateGatePlacement(currentUser.uid, gate.id, placement);
    } catch (err: unknown) {
      showError('Gate placement failed', (err as Error).message || 'Could not save the gate position.');
    }
  };

  const handleMoveSensor = async (sensor: Device, placement: QuadrantPlacement | null) => {
    if (!currentUser) return;
    try {
      await updateSensorPlacement(currentUser.uid, sensor.id, placement);
    } catch (err: unknown) {
      showError('Sensor placement failed', (err as Error).message || 'Could not save the sensor position.');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <LoadingSpinner label="Connecting to Dilig..." />
      </div>
    );
  }

  if (!currentUser) {
    return <AuthPage />;
  }

  return (
    <Layout
      currentTab={currentTab}
      onTabChange={setCurrentTab}
      gatesCount={gates.length}
      devicesCount={devices.length}
      onOpenProfile={() => setIsProfileOpen(true)}
      onOpenThresholds={() => setIsThresholdsOpen(true)}
    >
      {dataLoading ? (
        <div className="py-20 flex justify-center">
          <LoadingSpinner label="Loading farm telemetry and gates..." />
        </div>
      ) : (
        <>
          {currentTab === 'home' && (
            <DashboardPage
              gates={gates}
              devices={devices}
              latestReading={latestReading}
              sensorDevice={primarySensorDevice}
              thresholds={userProfile?.thresholds}
              onNavigateToGates={() => setCurrentTab('gates')}
              onNavigateToQuadrants={() => setCurrentTab('quadrants')}
              onNavigateToDevices={() => setCurrentTab('devices')}
              onConfigureThresholds={() => setIsThresholdsOpen(true)}
            />
          )}

          {currentTab === 'quadrants' && (
            <QuadrantsPage
              quadrants={quadrants}
              gates={gates}
              devices={devices}
              onCreateQuadrant={handleCreateQuadrant}
              onUpdateQuadrant={handleUpdateQuadrant}
              onDeleteQuadrant={handleDeleteQuadrant}
              onMoveGate={handleMoveGate}
              onMoveSensor={handleMoveSensor}
              onSetControlMode={handleSetControlMode}
              onNavigateToGates={() => setCurrentTab('gates')}
            />
          )}

          {currentTab === 'gates' && (
            <GatesPage
              gates={gates}
              devices={devices}
              onSendCommand={handleSendCommand}
              onSetControlMode={handleSetControlMode}
              onConfigureAutomation={setAutomationGateToConfigure}
              onAddGate={() => {
                setGateToEdit(null);
                setIsAddGateOpen(true);
              }}
              onEditGate={(gate) => {
                setGateToEdit(gate);
                setIsAddGateOpen(true);
              }}
              onDeleteGate={handleDeleteGate}
            />
          )}

          {currentTab === 'devices' && (
            <DevicesPage
              devices={devices}
              gates={gates}
              onAddDevice={() => setIsAddDeviceOpen(true)}
              onUpdateDeviceName={handleUpdateDeviceName}
              onDeleteDevice={handleDeleteDevice}
              onUpdateTiming={handleUpdateMainGateTiming}
              onUpdateServoAngles={handleUpdateSubGateAngles}
            />
          )}
        </>
      )}

      {/* Global Modals */}
      <GateFormModal
        isOpen={isAddGateOpen}
        onClose={() => {
          setIsAddGateOpen(false);
          setGateToEdit(null);
        }}
        onSubmit={handleCreateOrUpdateGate}
        gateToEdit={gateToEdit}
        devices={devices}
        allGates={gates}
      />

      <DeviceFormModal
        isOpen={isAddDeviceOpen}
        onClose={() => setIsAddDeviceOpen(false)}
        onSubmit={handleRegisterDevice}
      />

      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />

      <SoilThresholdModal
        isOpen={isThresholdsOpen}
        onClose={() => setIsThresholdsOpen(false)}
      />

      {automationGateToConfigure && (() => {
        const sensor = devices.find((device) =>
          device.type === 'sensor' && device.deviceId === automationGateToConfigure.sensorDeviceId
        );
        return sensor ? (
          <GateAutomationSetupModal
            key={`${automationGateToConfigure.id}-${sensor.id}`}
            isOpen
            gate={automationGateToConfigure}
            sensor={sensor}
            defaultMoistureThreshold={userProfile?.thresholds?.dryMoistureMax ?? 30}
            onClose={() => setAutomationGateToConfigure(null)}
            onSave={handleConfigureGateAutomation}
          />
        ) : null;
      })()}
    </Layout>
  );
};

export function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
