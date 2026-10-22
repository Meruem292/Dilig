import React from 'react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { GateCard } from '../gates/GateCard';
import { Sliders, Plus, ArrowRight } from 'lucide-react';
import type { Gate, Device, CommandAction } from '../../types';

export interface QuickGateListProps {
  gates: Gate[];
  devices: Device[];
  onSendCommand: (gate: Gate, action: CommandAction) => Promise<void>;
  onViewAllGates: () => void;
  onAddGate: () => void;
}

export const QuickGateList: React.FC<QuickGateListProps> = ({
  gates,
  devices,
  onSendCommand,
  onViewAllGates,
  onAddGate,
}) => {
  // Take up to 3 gates for quick view
  const displayGates = gates.slice(0, 3);

  const getActuator = (deviceId?: string | null) => {
    if (!deviceId) return null;
    return devices.find((d) => d.deviceId === deviceId) || null;
  };

  const getSensor = (deviceId?: string | null) => {
    if (!deviceId) return null;
    return devices.find((d) => d.deviceId === deviceId) || null;
  };

  return (
    <Card className="border-slate-200">
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-charcoal flex items-center gap-2">
            <Sliders className="w-5 h-5 text-water-600" />
            <span>My Irrigation Gates</span>
          </h2>
          <p className="text-xs text-charcoal-muted mt-0.5">
            Quick status and gate controls
          </p>
        </div>

        {gates.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
            onClick={onViewAllGates}
            className="text-xs font-semibold text-water-700 hover:text-water-800"
          >
            View All Gates ({gates.length})
          </Button>
        )}
      </div>

      {gates.length === 0 ? (
        <div className="text-center py-6 px-4 bg-slate-50/70 rounded-2xl border border-dashed border-slate-200">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 shadow-subtle mb-3">
            <Sliders className="w-6 h-6 text-slate-400" />
          </div>
          <h3 className="text-sm sm:text-base font-bold text-charcoal mb-1">
            No Irrigation Gates Added Yet
          </h3>
          <p className="text-xs text-charcoal-muted max-w-sm mx-auto mb-4 leading-relaxed">
            Create an irrigation gate to start controlling your canal water gates or field valves.
          </p>
          <Button
            type="button"
            variant="primary"
            size="sm"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={onAddGate}
          >
            Add Your First Gate
          </Button>
        </div>
      ) : (
        <div className="space-y-3.5">
          {displayGates.map((gate) => (
            <GateCard
              key={gate.id}
              gate={gate}
              actuatorDevice={getActuator(gate.actuatorDeviceId)}
              sensorDevice={getSensor(gate.sensorDeviceId)}
              onSendCommand={onSendCommand}
              compact
            />
          ))}

          {gates.length > 3 && (
            <div className="text-center pt-2">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={onViewAllGates}
                className="w-full"
              >
                View All {gates.length} Irrigation Gates
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};
