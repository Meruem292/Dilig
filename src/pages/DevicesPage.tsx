import React, { useState } from 'react';
import { DeviceCard } from '../components/devices/DeviceCard';
import { Button } from '../components/common/Button';
import { EmptyState } from '../components/common/EmptyState';
import { Plus, Cpu, Sprout, Sliders, Search, Info } from 'lucide-react';
import type { Device, Gate } from '../types';

export interface DevicesPageProps {
  devices: Device[];
  gates: Gate[];
  onAddDevice: () => void;
  onUpdateDeviceName: (device: Device, newName: string) => Promise<void>;
  onDeleteDevice: (device: Device) => Promise<void>;
}

export const DevicesPage: React.FC<DevicesPageProps> = ({
  devices,
  gates,
  onAddDevice,
  onUpdateDeviceName,
  onDeleteDevice,
}) => {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'sensor' | 'actuator'>('all');

  const getAssignedGate = (deviceId: string) => {
    return gates.find((g) => g.actuatorDeviceId === deviceId || g.sensorDeviceId === deviceId) || null;
  };

  const filteredDevices = devices.filter((device) => {
    const matchesSearch =
      device.name.toLowerCase().includes(search.toLowerCase()) ||
      device.deviceId.toLowerCase().includes(search.toLowerCase());

    if (filterType === 'all') return matchesSearch;
    return matchesSearch && device.type === filterType;
  });

  return (
    <div className="space-y-6 animate-in fade-in-0 duration-150">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-charcoal">
            Hardware Devices
          </h1>
          <p className="text-xs sm:text-sm text-charcoal-muted mt-0.5">
            Manage your registered soil sensors and irrigation gate actuators.
          </p>
        </div>

        <Button
          type="button"
          variant="primary"
          size="md"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={onAddDevice}
        >
          Register Device
        </Button>
      </div>

      {/* Explanation Banner */}
      <div className="p-3.5 rounded-2xl bg-slate-100/70 border border-slate-200 text-xs text-charcoal flex items-start gap-2.5">
        <Info className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong>Device Types:</strong> <strong>Soil Sensors</strong> report soil moisture & temperature. <strong>Gate Actuators</strong> control physical motor relays. Each gate can have one actuator assigned.
        </div>
      </div>

      {/* Filter and Search Bar */}
      {devices.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search devices by name or hardware ID..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-nature-500 text-sm text-charcoal bg-white"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                filterType === 'all'
                  ? 'bg-slate-800 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              All Devices ({devices.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('sensor')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1 ${
                filterType === 'sensor'
                  ? 'bg-nature-700 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Sprout className="w-3.5 h-3.5" />
              <span>Sensors</span>
            </button>
            <button
              type="button"
              onClick={() => setFilterType('actuator')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1 ${
                filterType === 'actuator'
                  ? 'bg-water-700 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Actuators</span>
            </button>
          </div>
        </div>
      )}

      {/* Device Cards Grid */}
      {devices.length === 0 ? (
        <EmptyState
          icon={<Cpu className="w-8 h-8 text-nature-600" />}
          title="No Devices Registered Yet"
          description="Register your hardware soil sensor or gate actuator device ID to start collecting data and controlling irrigation."
          actionLabel="Register First Device"
          onAction={onAddDevice}
        />
      ) : filteredDevices.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
          <p className="text-sm text-charcoal-muted font-medium">
            No devices matched your search or filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredDevices.map((device) => (
            <DeviceCard
              key={device.id}
              device={device}
              assignedGate={getAssignedGate(device.deviceId)}
              onUpdateName={onUpdateDeviceName}
              onDelete={onDeleteDevice}
            />
          ))}
        </div>
      )}
    </div>
  );
};
