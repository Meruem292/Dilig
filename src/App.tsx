import React, { useState, useEffect, useMemo } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { Layout } from './components/layout/Layout';
import type { NavTab } from './components/layout/BottomNav';
import { AuthPage } from './pages/AuthPage';
import { DashboardPage } from './pages/DashboardPage';
import { GatesPage } from './pages/GatesPage';
import { DevicesPage } from './pages/DevicesPage';
import { GateFormModal } from './components/gates/GateFormModal';
import { DeviceFormModal } from './components/devices/DeviceFormModal';
import { ProfileModal } from './components/settings/ProfileModal';
import { SoilThresholdModal } from './components/settings/SoilThresholdModal';
import { LoadingSpinner } from './components/common/LoadingSpinner';

import type { Gate, Device, SoilReading, CommandAction, DeviceType } from './types';
import { subscribeToUserDevices, addDevice, updateDeviceName, deleteDevice } from './services/deviceService';
import { subscribeToUserGates, createGate, updateGate, deleteGate } from './services/gateService';
import { sendGateCommand } from './services/commandService';
import { subscribeToDeviceReadings } from './services/telemetryService';

const MainApp: React.FC = () => {
  const { currentUser, userProfile, loading: authLoading } = useAuth();
  const { showSuccess, showError, showInfo } = useToast();

  const [currentTab, setCurrentTab] = useState<NavTab>('home');
  const [gates, setGates] = useState<Gate[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Latest Soil Telemetry
  const [latestReading, setLatestReading] = useState<SoilReading | null>(null);

  // Modals state
  const [isAddGateOpen, setIsAddGateOpen] = useState(false);
  const [gateToEdit, setGateToEdit] = useState<Gate | null>(null);
  const [isAddDeviceOpen, setIsAddDeviceOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isThresholdsOpen, setIsThresholdsOpen] = useState(false);

  // Real-time Firestore subscriptions for authenticated user
  useEffect(() => {
    if (!currentUser) {
      setGates([]);
      setDevices([]);
      setLatestReading(null);
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

    return () => {
      unsubDevices();
      unsubGates();
    };
  }, [currentUser]);

  // Find primary soil sensor device to display on home dashboard
  const primarySensorDevice = useMemo(() => {
    return devices.find((d) => d.type === 'sensor') || null;
  }, [devices]);

  // Subscribe to real-time readings from primary soil sensor
  useEffect(() => {
    if (!currentUser || !primarySensorDevice) {
      setLatestReading(null);
      return;
    }

    const unsubReadings = subscribeToDeviceReadings(
      currentUser.uid,
      primarySensorDevice.id,
      (reading) => {
        setLatestReading(reading);
      }
    );

    return () => {
      unsubReadings();
    };
  }, [currentUser, primarySensorDevice]);

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
      await deleteGate(currentUser.uid, gate.id, gate.actuatorDeviceId);
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
      await deleteDevice(currentUser.uid, device.id, device.assignedGateId);
      showSuccess('Device removed', `"${device.name}" removed from your account.`);
    } catch (err: unknown) {
      showError('Remove failed', (err as Error).message || 'Could not remove device.');
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
              onSendCommand={handleSendCommand}
              onNavigateToGates={() => setCurrentTab('gates')}
              onNavigateToDevices={() => setCurrentTab('devices')}
              onAddGate={() => {
                setGateToEdit(null);
                setIsAddGateOpen(true);
              }}
              onAddDevice={() => setIsAddDeviceOpen(true)}
              onConfigureThresholds={() => setIsThresholdsOpen(true)}
            />
          )}

          {currentTab === 'gates' && (
            <GatesPage
              gates={gates}
              devices={devices}
              onSendCommand={handleSendCommand}
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
