import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Sprout, Sliders } from 'lucide-react';
import type { DeviceType } from '../../types';

export interface DeviceFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { deviceId: string; name: string; type: DeviceType }) => Promise<void>;
}

export const DeviceFormModal: React.FC<DeviceFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [type, setType] = useState<DeviceType>('sensor');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please provide a descriptive name for your device.');
      return;
    }

    if (!deviceId.trim()) {
      setError('Please enter the unique Device ID printed on your hardware.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        deviceId: deviceId.trim().toUpperCase(),
        type,
      });
      setName('');
      setDeviceId('');
      setType('sensor');
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to register device.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Register New Device"
      description="Connect a physical soil sensor or irrigation gate actuator."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs sm:text-sm font-medium">
            {error}
          </div>
        )}

        {/* 1. Device Name */}
        <div>
          <label htmlFor="dev-name" className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1.5">
            1. Device Friendly Name <span className="text-red-500">*</span>
          </label>
          <input
            id="dev-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Field 1 Soil Probe, Main Canal Motor"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-nature-500 text-sm text-charcoal"
          />
        </div>

        {/* 2. Device ID */}
        <div>
          <label htmlFor="dev-id" className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1.5">
            2. Unique Device ID (from hardware) <span className="text-red-500">*</span>
          </label>
          <input
            id="dev-id"
            type="text"
            required
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            placeholder="e.g. ESP32-SN01 or ACT-GATE-01"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-nature-500 text-sm font-mono text-charcoal uppercase"
          />
          <p className="text-[11px] text-charcoal-muted mt-1">
            This identifier is configured on your microcontroller firmware or equipment label.
          </p>
        </div>

        {/* 3. Device Type */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1.5">
            3. Device Type <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setType('sensor')}
              className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                type === 'sensor'
                  ? 'border-nature-500 bg-nature-50/80 ring-2 ring-nature-500/20'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div
                  className={`p-1.5 rounded-lg ${
                    type === 'sensor' ? 'bg-nature-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <Sprout className="w-4 h-4" />
                </div>
                <span className="text-sm font-bold text-charcoal">Soil Sensor</span>
              </div>
              <p className="text-[11px] text-charcoal-muted leading-tight">
                Measures soil moisture & temperature. Cannot control gates.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setType('actuator')}
              className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                type === 'actuator'
                  ? 'border-water-500 bg-water-50/80 ring-2 ring-water-500/20'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div
                  className={`p-1.5 rounded-lg ${
                    type === 'actuator' ? 'bg-water-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <Sliders className="w-4 h-4" />
                </div>
                <span className="text-sm font-bold text-charcoal">Gate Actuator</span>
              </div>
              <p className="text-[11px] text-charcoal-muted leading-tight">
                Motor / relay controller that opens and closes physical water gates.
              </p>
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
          <Button type="button" variant="outline" size="md" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="md" isLoading={isSubmitting}>
            Register Device
          </Button>
        </div>
      </form>
    </Modal>
  );
};
