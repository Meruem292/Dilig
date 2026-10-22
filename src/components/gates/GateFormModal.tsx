import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import type { Gate, Device } from '../../types';

export interface GateFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    description?: string;
    location?: string;
    actuatorDeviceId?: string | null;
    sensorDeviceId?: string | null;
  }) => Promise<void>;
  gateToEdit?: Gate | null;
  devices: Device[];
  allGates: Gate[];
}

export const GateFormModal: React.FC<GateFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  gateToEdit,
  devices,
  allGates,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [actuatorDeviceId, setActuatorDeviceId] = useState<string>('');
  const [sensorDeviceId, setSensorDeviceId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (gateToEdit) {
      setName(gateToEdit.name || '');
      setDescription(gateToEdit.description || '');
      setLocation(gateToEdit.location || '');
      setActuatorDeviceId(gateToEdit.actuatorDeviceId || '');
      setSensorDeviceId(gateToEdit.sensorDeviceId || '');
    } else {
      setName('');
      setDescription('');
      setLocation('');
      setActuatorDeviceId('');
      setSensorDeviceId('');
    }
    setError(null);
  }, [gateToEdit, isOpen]);

  // Filter devices by type
  const actuatorDevices = devices.filter((d) => d.type === 'actuator');
  const sensorDevices = devices.filter((d) => d.type === 'sensor');

  // Find actuators already assigned to OTHER gates
  const isActuatorAssignedElsewhere = (deviceId: string) => {
    return allGates.some(
      (g) => g.actuatorDeviceId === deviceId && (!gateToEdit || g.id !== gateToEdit.id)
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please enter a gate name.');
      return;
    }

    if (actuatorDeviceId && isActuatorAssignedElsewhere(actuatorDeviceId)) {
      setError('Selected actuator is already assigned to another gate.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        actuatorDeviceId: actuatorDeviceId || null,
        sensorDeviceId: sensorDeviceId || null,
      });
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to save gate.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={gateToEdit ? 'Edit Irrigation Gate' : 'Add New Irrigation Gate'}
      description="Manage gate identity and assign physical control devices."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs sm:text-sm font-medium">
            {error}
          </div>
        )}

        {/* Gate Name */}
        <div>
          <label htmlFor="gate-name" className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1.5">
            Gate Name <span className="text-red-500">*</span>
          </label>
          <input
            id="gate-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Main Canal Gate, North Field"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-nature-500 text-sm text-charcoal"
          />
        </div>

        {/* Location / Field */}
        <div>
          <label htmlFor="gate-location" className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1.5">
            Field / Location (Optional)
          </label>
          <input
            id="gate-location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Sector 2, Rice Paddy West"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-nature-500 text-sm text-charcoal"
          />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="gate-desc" className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1.5">
            Description or Notes (Optional)
          </label>
          <textarea
            id="gate-desc"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Controls inflow from the primary reservoir channel."
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-nature-500 text-sm text-charcoal resize-none"
          />
        </div>

        {/* Assigned Actuator Device */}
        <div>
          <label htmlFor="gate-actuator" className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1.5">
            Assign Actuator Device
          </label>
          <select
            id="gate-actuator"
            value={actuatorDeviceId}
            onChange={(e) => setActuatorDeviceId(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-nature-500 text-sm text-charcoal bg-white"
          >
            <option value="">— No actuator assigned (Monitoring only) —</option>
            {actuatorDevices.map((dev) => {
              const assigned = isActuatorAssignedElsewhere(dev.deviceId);
              return (
                <option key={dev.id} value={dev.deviceId} disabled={assigned}>
                  {dev.name} ({dev.deviceId}) {assigned ? '— [Already Assigned]' : ''}
                </option>
              );
            })}
          </select>
          <p className="text-[11px] text-charcoal-muted mt-1">
            Only actuator devices can physically open or close water gates. One actuator per gate.
          </p>
        </div>

        {/* Assigned Soil Sensor Device */}
        <div>
          <label htmlFor="gate-sensor" className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1.5">
            Link Soil Sensor (Optional)
          </label>
          <select
            id="gate-sensor"
            value={sensorDeviceId}
            onChange={(e) => setSensorDeviceId(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-nature-500 text-sm text-charcoal bg-white"
          >
            <option value="">— No sensor linked —</option>
            {sensorDevices.map((dev) => (
              <option key={dev.id} value={dev.deviceId}>
                {dev.name} ({dev.deviceId})
              </option>
            ))}
          </select>
          <p className="text-[11px] text-charcoal-muted mt-1">
            Links soil telemetry from this sensor to the gate's field section.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
          <Button type="button" variant="outline" size="md" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="md" isLoading={isSubmitting}>
            {gateToEdit ? 'Save Changes' : 'Create Gate'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
