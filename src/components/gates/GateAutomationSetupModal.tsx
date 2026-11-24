import React, { useState } from 'react';
import { Droplet, Info, Thermometer } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import type { Device, Gate } from '../../types';

interface GateAutomationSetupModalProps {
  isOpen: boolean;
  gate: Gate;
  sensor: Device;
  defaultMoistureThreshold: number;
  onClose: () => void;
  onSave: (temperatureThresholdC: number, moistureThresholdPercent: number) => Promise<void>;
}

export const GateAutomationSetupModal: React.FC<GateAutomationSetupModalProps> = ({
  isOpen,
  gate,
  sensor,
  defaultMoistureThreshold,
  onClose,
  onSave,
}) => {
  const [temperature, setTemperature] = useState(
    sensor.automationConfig?.temperatureThresholdC ?? 20
  );
  const [moisture, setMoisture] = useState(
    sensor.automationConfig?.moistureThresholdPercent ?? defaultMoistureThreshold
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!Number.isFinite(temperature) || temperature < -20 || temperature > 60) {
      setError('Temperature threshold must be between -20°C and 60°C.');
      return;
    }
    if (!Number.isFinite(moisture) || moisture < 0 || moisture > 100) {
      setError('Moisture threshold must be between 0% and 100%.');
      return;
    }
    setIsSaving(true);
    try {
      await onSave(temperature, moisture);
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message || 'Could not enable Automatic mode.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Set up Automatic mode"
      description={`${gate.name} will respond to readings from ${sensor.name}.`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">{error}</div>}
        <div className="flex gap-2 rounded-xl border border-water-200 bg-water-50 p-3 text-xs leading-relaxed text-water-950">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-water-700" />
          <p>
            The gate closes after two low readings. It reopens after temperature and moisture both recover beyond the safety margin. These thresholds are shared by gates linked to this sensor.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5 text-xs font-bold uppercase tracking-wider text-charcoal">
            <span className="flex items-center gap-1.5"><Thermometer className="h-4 w-4" /> Close below</span>
            <div className="relative">
              <input type="number" min="-20" max="60" step="0.5" value={temperature} onChange={(event) => setTemperature(Number(event.target.value))} className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 pr-10 text-sm font-semibold normal-case tracking-normal focus:outline-none focus:ring-2 focus:ring-nature-500" />
              <span className="absolute right-3 top-2.5 text-sm text-slate-500">°C</span>
            </div>
          </label>
          <label className="space-y-1.5 text-xs font-bold uppercase tracking-wider text-charcoal">
            <span className="flex items-center gap-1.5"><Droplet className="h-4 w-4" /> Close below</span>
            <div className="relative">
              <input type="number" min="0" max="100" step="1" value={moisture} onChange={(event) => setMoisture(Number(event.target.value))} className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 pr-10 text-sm font-semibold normal-case tracking-normal focus:outline-none focus:ring-2 focus:ring-nature-500" />
              <span className="absolute right-3 top-2.5 text-sm text-slate-500">%</span>
            </div>
          </label>
        </div>
        <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4">
          <Button type="button" variant="outline" size="md" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button type="submit" variant="primary" size="md" isLoading={isSaving}>Enable Automatic</Button>
        </div>
      </form>
    </Modal>
  );
};
