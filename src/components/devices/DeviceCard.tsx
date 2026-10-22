import React, { useState } from 'react';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { DeviceTypeBadge } from './DeviceTypeBadge';
import { ConfirmDialog } from '../common/ConfirmDialog';
import {
  Cpu,
  Clock,
  Edit3,
  Trash2,
  Sliders,
  Thermometer,
  Droplet,
  Check,
} from 'lucide-react';
import type { Device, Gate } from '../../types';
import { isDeviceOnline } from '../../services/deviceService';
import { formatTimeAgo } from '../../services/telemetryService';

export interface DeviceCardProps {
  device: Device;
  assignedGate?: Gate | null;
  onUpdateName: (device: Device, newName: string) => Promise<void>;
  onDelete: (device: Device) => Promise<void>;
}

export const DeviceCard: React.FC<DeviceCardProps> = ({
  device,
  assignedGate,
  onUpdateName,
  onDelete,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(device.name);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSavingName, setIsSavingName] = useState(false);

  const online = isDeviceOnline(device);

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editedName.trim() || editedName.trim() === device.name) {
      setIsEditing(false);
      return;
    }
    setIsSavingName(true);
    try {
      await onUpdateName(device, editedName.trim());
      setIsEditing(false);
    } finally {
      setIsSavingName(false);
    }
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      await onDelete(device);
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Card className="border-slate-200 hover:border-slate-300 transition-all flex flex-col justify-between">
      <div>
        {/* Header: Device Name & Type */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <form onSubmit={handleSaveName} className="flex items-center gap-1.5 mb-1">
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  className="px-2.5 py-1 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-nature-500 font-bold text-charcoal w-full max-w-[200px]"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={isSavingName}
                  className="p-1.5 bg-nature-600 text-white rounded-lg hover:bg-nature-700 transition-colors"
                  aria-label="Save device name"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </form>
            ) : (
              <h3 className="text-base sm:text-lg font-bold text-charcoal truncate flex items-center gap-2">
                <Cpu className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <span>{device.name}</span>
              </h3>
            )}

            <div className="flex items-center gap-2 mt-1">
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                {device.deviceId}
              </span>
              <DeviceTypeBadge type={device.type} />
            </div>
          </div>

          <div className="flex-shrink-0">
            {online ? (
              <Badge variant="green" size="sm" dot>
                Online
              </Badge>
            ) : (
              <Badge variant="gray" size="sm">
                Offline
              </Badge>
            )}
          </div>
        </div>

        {/* Device Stats / Details */}
        <div className="space-y-1.5 my-3 text-xs">
          {/* Last Communication Time */}
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-500 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Last Communication:</span>
            </span>
            <span className="font-semibold text-charcoal">
              {formatTimeAgo(device.lastSeenAt)}
            </span>
          </div>

          {/* Assigned Gate */}
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-500 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-slate-400" />
              <span>Assigned Gate:</span>
            </span>
            {assignedGate ? (
              <span className="font-semibold text-water-700 truncate max-w-[150px]">
                {assignedGate.name}
              </span>
            ) : (
              <span className="text-slate-400">Unassigned</span>
            )}
          </div>

          {/* Latest Sensor Reading if available */}
          {device.type === 'sensor' && device.latestReading && (
            <div className="p-2.5 rounded-xl bg-nature-50/60 border border-nature-100 text-nature-950 flex items-center justify-around">
              <div className="flex items-center gap-1.5">
                <Droplet className="w-4 h-4 text-water-600" />
                <span className="font-bold">{device.latestReading.soilMoisturePercent}%</span>
                <span className="text-slate-500 text-[11px]">Moisture</span>
              </div>
              <div className="h-4 w-px bg-slate-200" />
              <div className="flex items-center gap-1.5">
                <Thermometer className="w-4 h-4 text-nature-700" />
                <span className="font-bold">{device.latestReading.soilTemperatureC}°C</span>
                <span className="text-slate-500 text-[11px]">Temp</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-slate-100 mt-2">
        {!isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="text-xs text-charcoal-muted hover:text-charcoal flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Name</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-red-50 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Remove Device</span>
        </button>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteConfirm}
        title="Remove Hardware Device?"
        message={`Are you sure you want to remove "${device.name}" (${device.deviceId}) from your account? If this device is currently assigned to a gate, it will be unlinked.`}
        confirmLabel="Yes, Remove Device"
        variant="danger"
        isLoading={isDeleting}
      />
    </Card>
  );
};
