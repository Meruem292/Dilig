import React, { useMemo } from 'react';
import { SoilConditionCard } from '../components/dashboard/SoilConditionCard';
import { DeviceSummaryCard } from '../components/dashboard/DeviceSummaryCard';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { ArrowRight, Map, Sliders } from 'lucide-react';
import type { Gate, Device, SoilReading, SoilThresholds } from '../types';
import { isDeviceOnline } from '../services/deviceService';

export interface DashboardPageProps {
  gates: Gate[];
  devices: Device[];
  latestReading: SoilReading | null;
  sensorDevice: Device | null;
  thresholds?: SoilThresholds;
  onNavigateToGates: () => void;
  onNavigateToQuadrants: () => void;
  onNavigateToDevices: () => void;
  onConfigureThresholds: () => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  gates,
  devices,
  latestReading,
  sensorDevice,
  thresholds,
  onNavigateToGates,
  onNavigateToQuadrants,
  onNavigateToDevices,
  onConfigureThresholds,
}) => {
  const { onlineCount, offlineCount, openCount, closedCount, movingCount } = useMemo(() => {
    let online = 0;
    let offline = 0;
    for (const d of devices) {
      if (isDeviceOnline(d)) {
        online++;
      } else {
        offline++;
      }
    }
    return {
      onlineCount: online,
      offlineCount: offline,
      openCount: gates.filter((gate) => gate.reportedState === 'open').length,
      closedCount: gates.filter((gate) => gate.reportedState === 'closed').length,
      movingCount: gates.filter((gate) => gate.reportedState === 'moving').length,
    };
  }, [devices, gates]);

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

      {/* 3. Where are my gates and what state are they in? */}
      <section aria-labelledby="gates-control-heading">
        <Card className="border-slate-200">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="gates-control-heading" className="flex items-center gap-2 text-base font-bold text-charcoal sm:text-lg">
                <Sliders className="h-5 w-5 text-water-600" />
                Gate network at a glance
              </h2>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                <span><strong className="tabular-nums text-nature-700">{openCount}</strong> open</span>
                <span><strong className="tabular-nums text-slate-700">{closedCount}</strong> closed</span>
                <span><strong className="tabular-nums text-water-700">{movingCount}</strong> moving</span>
                <span><strong className="tabular-nums text-charcoal">{gates.length}</strong> total</span>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="primary" size="sm" leftIcon={<Map className="h-4 w-4" />} onClick={onNavigateToQuadrants}>
                Open Field Map
              </Button>
              <Button type="button" variant="outline" size="sm" rightIcon={<ArrowRight className="h-4 w-4" />} onClick={onNavigateToGates}>
                Manage Gates
              </Button>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
};
