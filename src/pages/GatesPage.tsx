import React, { useState } from 'react';
import { GateCard } from '../components/gates/GateCard';
import { Button } from '../components/common/Button';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { EmptyState } from '../components/common/EmptyState';
import { Plus, Sliders, Search } from 'lucide-react';
import type { Gate, Device, CommandAction } from '../types';

export interface GatesPageProps {
  gates: Gate[];
  devices: Device[];
  onSendCommand: (gate: Gate, action: CommandAction) => Promise<void>;
  onAddGate: () => void;
  onEditGate: (gate: Gate) => void;
  onDeleteGate: (gate: Gate) => Promise<void>;
}

export const GatesPage: React.FC<GatesPageProps> = ({
  gates,
  devices,
  onSendCommand,
  onAddGate,
  onEditGate,
  onDeleteGate,
}) => {
  const [search, setSearch] = useState('');
  const [filterState, setFilterState] = useState<string>('all');
  const [gateToDelete, setGateToDelete] = useState<Gate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const getActuator = (deviceId?: string | null) => {
    if (!deviceId) return null;
    return devices.find((d) => d.deviceId === deviceId) || null;
  };

  const getSensor = (deviceId?: string | null) => {
    if (!deviceId) return null;
    return devices.find((d) => d.deviceId === deviceId) || null;
  };

  const filteredGates = gates.filter((gate) => {
    const matchesSearch =
      gate.name.toLowerCase().includes(search.toLowerCase()) ||
      (gate.location && gate.location.toLowerCase().includes(search.toLowerCase()));

    if (filterState === 'all') return matchesSearch;
    if (filterState === 'open') return matchesSearch && gate.reportedState === 'open';
    if (filterState === 'closed') return matchesSearch && gate.reportedState === 'closed';
    if (filterState === 'moving') return matchesSearch && gate.reportedState === 'moving';
    return matchesSearch;
  });

  const handleDeleteConfirm = async () => {
    if (!gateToDelete) return;
    setIsDeleting(true);
    try {
      await onDeleteGate(gateToDelete);
      setGateToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in-0 duration-150">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-charcoal">
            Irrigation Water Gates
          </h1>
          <p className="text-xs sm:text-sm text-charcoal-muted mt-0.5">
            Manage your canal gates, field valves, and motorized flow controls.
          </p>
        </div>

        <Button
          type="button"
          variant="primary"
          size="md"
          leftIcon={<Plus className="w-4 h-4" />}
          onClick={onAddGate}
        >
          Add New Gate
        </Button>
      </div>

      {/* Filter and Search Bar */}
      {gates.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search gates by name or location..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-nature-500 text-sm text-charcoal bg-white"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {['all', 'open', 'closed', 'moving'].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setFilterState(status)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize whitespace-nowrap transition-colors ${
                  filterState === status
                    ? 'bg-nature-700 text-white'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Gate Cards Grid */}
      {gates.length === 0 ? (
        <EmptyState
          icon={<Sliders className="w-8 h-8 text-water-600" />}
          title="No Irrigation Gates Configured"
          description="Add your first water gate to link actuators and control field water flow."
          actionLabel="Add Your First Gate"
          onAction={onAddGate}
        />
      ) : filteredGates.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
          <p className="text-sm text-charcoal-muted font-medium">
            No gates matched your search filter "{search}".
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredGates.map((gate) => (
            <GateCard
              key={gate.id}
              gate={gate}
              actuatorDevice={getActuator(gate.actuatorDeviceId)}
              sensorDevice={getSensor(gate.sensorDeviceId)}
              onSendCommand={onSendCommand}
              onEdit={onEditGate}
              onDelete={(g) => setGateToDelete(g)}
            />
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        isOpen={gateToDelete !== null}
        onClose={() => setGateToDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete Irrigation Gate?"
        message={`Are you sure you want to delete "${gateToDelete?.name}"? The assigned actuator will be unlinked and remain available in your account.`}
        confirmLabel="Yes, Delete Gate"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
};
