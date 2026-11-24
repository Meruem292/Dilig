import React, { useState } from 'react';
import {
  Cpu,
  Droplet,
  Edit3,
  Map,
  MapPin,
  Move,
  Plus,
  Settings2,
  Thermometer,
  Trash2,
  Unlink,
} from 'lucide-react';
import { Button } from '../components/common/Button';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { EmptyState } from '../components/common/EmptyState';
import { Modal } from '../components/common/Modal';
import { GateStatusBadge } from '../components/gates/GateStatusBadge';
import { QuadrantCanvas, type SelectedMapItem } from '../components/quadrants/QuadrantCanvas';
import { QuadrantFormModal } from '../components/quadrants/QuadrantFormModal';
import { isDeviceOnline } from '../services/deviceService';
import { formatTimeAgo, isAutomationReadingStale } from '../services/telemetryService';
import type {
  Device,
  Gate,
  GateControlMode,
  Quadrant,
  QuadrantColor,
  QuadrantPlacement,
} from '../types';

interface QuadrantsPageProps {
  quadrants: Quadrant[];
  gates: Gate[];
  devices: Device[];
  onCreateQuadrant: (input: { name: string; description?: string; color: QuadrantColor }) => Promise<string>;
  onUpdateQuadrant: (quadrant: Quadrant, input: { name: string; description?: string; color: QuadrantColor }) => Promise<void>;
  onDeleteQuadrant: (quadrant: Quadrant) => Promise<void>;
  onMoveGate: (gate: Gate, placement: QuadrantPlacement | null) => Promise<void>;
  onMoveSensor: (sensor: Device, placement: QuadrantPlacement | null) => Promise<void>;
  onSetControlMode: (gate: Gate, mode: GateControlMode) => Promise<void>;
  onNavigateToGates: () => void;
}

type AddItemType = 'gate' | 'sensor' | null;

const defaultGatePlacement = (quadrantId: string, index: number): QuadrantPlacement => {
  const slots: QuadrantPlacement[] = [
    { quadrantId, x: 0.28, y: 0, edge: 'north' },
    { quadrantId, x: 1, y: 0.35, edge: 'east' },
    { quadrantId, x: 0.68, y: 1, edge: 'south' },
    { quadrantId, x: 0, y: 0.68, edge: 'west' },
    { quadrantId, x: 0.72, y: 0, edge: 'north' },
    { quadrantId, x: 1, y: 0.72, edge: 'east' },
    { quadrantId, x: 0.32, y: 1, edge: 'south' },
    { quadrantId, x: 0, y: 0.3, edge: 'west' },
  ];
  return slots[index % slots.length];
};

const defaultSensorPlacement = (quadrantId: string, index: number): QuadrantPlacement => ({
  quadrantId,
  x: 0.35 + (index % 3) * 0.15,
  y: 0.4 + (Math.floor(index / 3) % 2) * 0.2,
});

export const QuadrantsPage: React.FC<QuadrantsPageProps> = ({
  quadrants,
  gates,
  devices,
  onCreateQuadrant,
  onUpdateQuadrant,
  onDeleteQuadrant,
  onMoveGate,
  onMoveSensor,
  onSetControlMode,
  onNavigateToGates,
}) => {
  const [selectedQuadrantId, setSelectedQuadrantId] = useState<string | null>(quadrants[0]?.id ?? null);
  const [selectedItem, setSelectedItem] = useState<SelectedMapItem>(null);
  const [editMode, setEditMode] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Quadrant | null>(null);
  const [addType, setAddType] = useState<AddItemType>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [modeBusy, setModeBusy] = useState(false);

  const effectiveQuadrantId = quadrants.some((item) => item.id === selectedQuadrantId)
    ? selectedQuadrantId
    : quadrants[0]?.id ?? null;
  const selectedQuadrant = quadrants.find((item) => item.id === effectiveQuadrantId) ?? null;
  const sensors = devices.filter((device) => device.type === 'sensor');
  const quadrantGates = selectedQuadrant
    ? gates.filter((gate) => gate.quadrantPlacement?.quadrantId === selectedQuadrant.id)
    : [];
  const quadrantSensors = selectedQuadrant
    ? sensors.filter((sensor) => sensor.quadrantPlacement?.quadrantId === selectedQuadrant.id)
    : [];
  const availableGates = gates.filter((gate) => !gate.quadrantPlacement);
  const availableSensors = sensors.filter((sensor) => !sensor.quadrantPlacement);

  const selectedGate = selectedItem?.type === 'gate'
    ? gates.find((gate) => gate.id === selectedItem.id) ?? null
    : null;
  const selectedSensor = selectedItem?.type === 'sensor'
    ? sensors.find((sensor) => sensor.id === selectedItem.id) ?? null
    : null;
  const selectedGateActuator = selectedGate
    ? devices.find((device) => device.deviceId === selectedGate.actuatorDeviceId) ?? null
    : null;
  const selectedGateSensor = selectedGate
    ? sensors.find((sensor) => sensor.deviceId === selectedGate.sensorDeviceId) ?? null
    : null;

  const totals = {
    gates: quadrantGates.length,
    sensors: quadrantSensors.length,
    issues: quadrantGates.filter((gate) => gate.reportedState === 'error').length +
      quadrantSensors.filter((sensor) => !isDeviceOnline(sensor)).length,
  };

  const handleCreate = async (input: { name: string; description?: string; color: QuadrantColor }) => {
    const id = await onCreateQuadrant(input);
    setSelectedQuadrantId(id);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await onDeleteQuadrant(deleteTarget);
      setDeleteTarget(null);
      setSelectedItem(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddItem = async (type: Exclude<AddItemType, null>, id: string) => {
    if (!selectedQuadrant) return;
    if (type === 'gate') {
      const gate = gates.find((item) => item.id === id);
      if (gate) {
        await onMoveGate(gate, defaultGatePlacement(selectedQuadrant.id, quadrantGates.length));
        setSelectedItem({ type: 'gate', id: gate.id });
      }
    } else {
      const sensor = sensors.find((item) => item.id === id);
      if (sensor) {
        await onMoveSensor(sensor, defaultSensorPlacement(selectedQuadrant.id, quadrantSensors.length));
        setSelectedItem({ type: 'sensor', id: sensor.id });
      }
    }
    setAddType(null);
  };

  const handleMapMode = async (mode: GateControlMode) => {
    if (!selectedGate) return;
    setModeBusy(true);
    try {
      await onSetControlMode(selectedGate, mode);
    } finally {
      setModeBusy(false);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in-0 duration-150">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-charcoal sm:text-2xl">Field Quadrants</h1>
          <p className="mt-0.5 text-xs text-charcoal-muted sm:text-sm">See where every gate and soil sensor is located and recognize its live state.</p>
        </div>
        <Button type="button" variant="primary" size="md" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setFormMode('create')}>Add Quadrant</Button>
      </div>

      {quadrants.length === 0 ? (
        <EmptyState
          icon={<Map className="h-8 w-8 text-nature-700" />}
          title="Build Your First Field Map"
          description="Add a quadrant, then place your existing gates on its boundary and sensors inside the field."
          actionLabel="Add First Quadrant"
          onAction={() => setFormMode('create')}
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              {quadrants.map((quadrant) => (
                <button
                  key={quadrant.id}
                  type="button"
                  onClick={() => { setSelectedQuadrantId(quadrant.id); setSelectedItem(null); }}
                  className={`min-h-10 whitespace-nowrap rounded-xl px-3 text-sm font-semibold transition-colors ${
                    effectiveQuadrantId === quadrant.id ? 'bg-nature-700 text-white' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {quadrant.name}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {selectedQuadrant && (
                <>
                  <Button type="button" variant={editMode ? 'secondary' : 'outline'} size="sm" leftIcon={<Move className="h-4 w-4" />} onClick={() => setEditMode((value) => !value)}>{editMode ? 'Finish Layout' : 'Edit Layout'}</Button>
                  <button type="button" onClick={() => setFormMode('edit')} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-charcoal" aria-label="Edit quadrant"><Edit3 className="h-4 w-4" /></button>
                  <button type="button" onClick={() => setDeleteTarget(selectedQuadrant)} className="rounded-lg p-2 text-red-600 hover:bg-red-50" aria-label="Delete quadrant"><Trash2 className="h-4 w-4" /></button>
                </>
              )}
            </div>
          </div>

          {selectedQuadrant && (
            <>
              {editMode && (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <span className="mr-auto text-xs font-semibold text-amber-900">Drag gates around the field edge and sensors within the field.</span>
                  <Button type="button" variant="outline" size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setAddType('gate')} disabled={availableGates.length === 0}>Add Gate</Button>
                  <Button type="button" variant="outline" size="sm" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setAddType('sensor')} disabled={availableSensors.length === 0}>Add Sensor</Button>
                </div>
              )}

              <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <QuadrantCanvas
                  quadrant={selectedQuadrant}
                  gates={quadrantGates}
                  sensors={quadrantSensors}
                  editMode={editMode}
                  selectedItem={selectedItem}
                  onSelect={setSelectedItem}
                  onMoveGate={(gate, placement) => onMoveGate(gate, placement)}
                  onMoveSensor={(sensor, placement) => onMoveSensor(sensor, placement)}
                />

                <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card lg:sticky lg:top-20" aria-label="Selected map item">
                  {!selectedGate && !selectedSensor ? (
                    <div className="py-8 text-center">
                      <MapPin className="mx-auto h-8 w-8 text-slate-300" />
                      <h2 className="mt-3 text-sm font-bold text-charcoal">Select a map item</h2>
                      <p className="mt-1 text-xs leading-relaxed text-charcoal-muted">Choose a gate or sensor to inspect its live status.</p>
                      <div className="mt-4 flex justify-center gap-4 text-xs text-slate-500">
                        <span>{totals.gates} gates</span><span>{totals.sensors} sensors</span><span>{totals.issues} issues</span>
                      </div>
                    </div>
                  ) : selectedGate ? (
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-2">
                        <div><p className="text-[11px] font-bold uppercase tracking-wider text-water-700">Irrigation gate</p><h2 className="text-lg font-bold text-charcoal">{selectedGate.name}</h2></div>
                        <GateStatusBadge state={selectedGate.reportedState} size="sm" />
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between rounded-lg bg-slate-50 p-2"><span className="text-slate-500">Actuator</span><span className="font-semibold text-charcoal">{selectedGateActuator?.name || 'Not linked'}</span></div>
                        <div className="flex justify-between rounded-lg bg-slate-50 p-2"><span className="text-slate-500">Sensor</span><span className="font-semibold text-charcoal">{selectedGateSensor?.name || 'Not linked'}</span></div>
                      </div>
                      <div>
                        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-charcoal">Control mode</p>
                        <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1">
                          {(['manual', 'automatic'] as GateControlMode[]).map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => void handleMapMode(mode)}
                              disabled={modeBusy || selectedGate.reportedState === 'moving' || !selectedGateActuator || (mode === 'automatic' && !selectedGateSensor)}
                              aria-pressed={selectedGate.controlMode === mode}
                              className={`min-h-10 rounded-lg text-xs font-bold capitalize disabled:opacity-50 ${selectedGate.controlMode === mode ? mode === 'automatic' ? 'bg-nature-700 text-white' : 'bg-white text-charcoal shadow-subtle' : 'text-slate-500'}`}
                            >{mode}</button>
                          ))}
                        </div>
                      </div>
                      {editMode && <Button type="button" variant="outline" size="sm" leftIcon={<Unlink className="h-4 w-4" />} onClick={() => void onMoveGate(selectedGate, null)} className="w-full">Remove from Quadrant</Button>}
                      <Button type="button" variant="primary" size="md" rightIcon={<Settings2 className="h-4 w-4" />} onClick={onNavigateToGates} className="w-full">Manage on Gates Page</Button>
                    </div>
                  ) : selectedSensor ? (
                    <div className="space-y-4">
                      <div><p className="text-[11px] font-bold uppercase tracking-wider text-nature-700">Soil sensor</p><h2 className="text-lg font-bold text-charcoal">{selectedSensor.name}</h2><p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500"><span className={`h-2 w-2 rounded-full ${isDeviceOnline(selectedSensor) ? 'bg-nature-500' : 'bg-slate-400'}`} />{isDeviceOnline(selectedSensor) ? 'Online' : 'Offline'}</p></div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-xl bg-water-50 p-3"><Droplet className="h-4 w-4 text-water-700" /><p className="mt-2 text-lg font-extrabold text-water-900">{selectedSensor.latestReading ? `${selectedSensor.latestReading.soilMoisturePercent.toFixed(1)}%` : '--'}</p><p className="text-[10px] font-bold uppercase text-water-700">Moisture</p></div>
                        <div className="rounded-xl bg-nature-50 p-3"><Thermometer className="h-4 w-4 text-nature-700" /><p className="mt-2 text-lg font-extrabold text-nature-900">{selectedSensor.latestReading?.soilTemperatureC == null ? '--' : `${selectedSensor.latestReading.soilTemperatureC.toFixed(1)}°C`}</p><p className="text-[10px] font-bold uppercase text-nature-700">Temperature</p></div>
                      </div>
                      <div className="flex items-center justify-between rounded-lg bg-slate-50 p-2 text-xs"><span className="text-slate-500">Last reading</span><span className={`font-semibold ${isAutomationReadingStale(selectedSensor.latestReading?.recordedAt) ? 'text-amber-700' : 'text-charcoal'}`}>{formatTimeAgo(selectedSensor.latestReading?.recordedAt)}</span></div>
                      <div className="flex items-center justify-between rounded-lg bg-slate-50 p-2 text-xs"><span className="text-slate-500">Automatic gates</span><span className="font-semibold text-charcoal">{selectedSensor.automationConfig?.gateIds.length ?? 0}</span></div>
                      {editMode && <Button type="button" variant="outline" size="sm" leftIcon={<Unlink className="h-4 w-4" />} onClick={() => void onMoveSensor(selectedSensor, null)} className="w-full">Remove from Quadrant</Button>}
                    </div>
                  ) : null}
                </aside>
              </div>
            </>
          )}
        </>
      )}

      {formMode && (
        <QuadrantFormModal
          key={formMode === 'edit' ? selectedQuadrant?.id : 'new'}
          isOpen
          quadrant={formMode === 'edit' ? selectedQuadrant : null}
          onClose={() => setFormMode(null)}
          onSave={formMode === 'edit' && selectedQuadrant
            ? (input) => onUpdateQuadrant(selectedQuadrant, input)
            : handleCreate}
        />
      )}

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Field Quadrant?"
        message={`Delete "${deleteTarget?.name}"? Its gates and sensors will become unplaced, but no hardware or gate records will be deleted.`}
        confirmLabel="Delete Quadrant"
        variant="danger"
        isLoading={isDeleting}
      />

      {addType && (
        <Modal
          isOpen
          onClose={() => setAddType(null)}
          title={addType === 'gate' ? 'Place a Gate' : 'Place a Soil Sensor'}
          description="Choose an existing unplaced item. You can drag it into position afterward."
        >
          <div className="space-y-2">
            {(addType === 'gate' ? availableGates : availableSensors).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => void handleAddItem(addType, item.id)}
                className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-slate-200 px-3 text-left hover:border-nature-300 hover:bg-nature-50"
              >
                {addType === 'gate' ? <Settings2 className="h-5 w-5 text-water-700" /> : <Cpu className="h-5 w-5 text-nature-700" />}
                <span className="flex-1"><span className="block text-sm font-bold text-charcoal">{item.name}</span><span className="block text-[11px] text-slate-500">{'deviceId' in item ? item.deviceId : item.location || 'No location set'}</span></span>
                <Plus className="h-4 w-4 text-slate-400" />
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
};
