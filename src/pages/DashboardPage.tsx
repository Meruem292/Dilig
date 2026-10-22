import React, { useMemo } from 'react';
import { SoilConditionCard } from '../components/dashboard/SoilConditionCard';
import { DeviceSummaryCard } from '../components/dashboard/DeviceSummaryCard';
import { QuickGateList } from '../components/dashboard/QuickGateList';
import { Button } from '../components/common/Button';
import { Plus, Cpu } from 'lucide-react';
import type { Gate, Device, SoilReading, CommandAction, SoilThresholds } from '../types';
import { isDeviceOnline } from '../services/deviceService';

export interface DashboardPageProps {
  gates: Gate[];
  devices: Device[];
  latestReading: SoilReading | null;
  sensorDevice: Device | null;
  thresholds?: SoilThresholds;
  onSendCommand: (gate: Gate, action: CommandAction) => Promise<void>;
  onNavigateToGates: () => void;
  onNavigateToDevices: () => void;
  onAddGate: () => void;
  onAddDevice: () => void;
  onConfigureThresholds: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  gates,
  devices,
  latestReading,
  sensorDevice,
  thresholds,
  onSendCommand,
  onNavigateToGates,
  onNavigateToDevices,
  onAddGate,
  onAddDevice,
  onConfigureThresholds,
}) => {
  const { onlineCount, offlineCount } = useMemo(() => {
    let online = 0;
    let offline = 0;
    for (const d of devices) {
      if (isDeviceOnline(d)) {
        online++;
      } else {
        offline++;
      }
    }
    return { onlineCount: online, offlineCount: offline };
  }, [devices]);

  return (
    <div className="space-y-6 animate-in fade-in-0 duration-150">
      {/* Top Banner / Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-charcoal">
            Farm Overview
          </h1>
          <p className="text-xs sm:text-sm text-charcoal-muted mt-0.5">
            Monitor real-time soil health and control your water gates.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            leftIcon={<Cpu className="w-3.5 h-3.5" />}
            onClick={onAddDevice}
          >
            Add Device
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            onClick={onAddGate}
          >
            Add Gate
          </Button>
        </div>
      </div>

      {/* 1. What is the current soil condition? */}
      <section aria-labelledby="soil-condition-heading">
        <SoilConditionCard
          reading={latestReading}
          sensorName={sensorDevice?.name}
          thresholds={thresholds}
          onConfigureThresholds={onConfigureThresholds}
        />
      </section>

      {/* 2. Are my devices working? */}
      <section aria-labelledby="devices-summary-heading">
        <DeviceSummaryCard
          onlineCount={onlineCount}
          offlineCount={offlineCount}
          gatesCount={gates.length}
          onGoToDevices={onNavigateToDevices}
          onGoToGates={onNavigateToGates}
        />
      </section>

      {/* 3. Can I control my irrigation gates? */}
      <section aria-labelledby="gates-control-heading">
        <QuickGateList
          gates={gates}
          devices={devices}
          onSendCommand={onSendCommand}
          onViewAllGates={onNavigateToGates}
          onAddGate={onAddGate}
        />
      </section>
    </div>
  );
};
