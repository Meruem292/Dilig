import React, { useState } from 'react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { GateStatusBadge } from './GateStatusBadge';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { Sliders, Cpu, MapPin, Edit3, Trash2, ArrowUpRight, ArrowDownLeft, AlertTriangle } from 'lucide-react';
import type { Gate, Device, CommandAction } from '../../types';
import { isDeviceOnline } from '../../services/deviceService';

export interface GateCardProps {
  gate: Gate;
  actuatorDevice?: Device | null;
  sensorDevice?: Device | null;
  onSendCommand: (gate: Gate, action: CommandAction) => Promise<void>;
  onEdit?: (gate: Gate) => void;
  onDelete?: (gate: Gate) => void;
  compact?: boolean;
}

export const GateCard: React.FC<GateCardProps> = ({
  gate,
  actuatorDevice,
  sensorDevice,
  onSendCommand,
  onEdit,
  onDelete,
  compact = false,
}) => {
  const [confirmAction, setConfirmAction] = useState<CommandAction | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasActuator = Boolean(gate.actuatorDeviceId && actuatorDevice);
  const actuatorOnline = actuatorDevice ? isDeviceOnline(actuatorDevice) : false;
  const isMoving = gate.reportedState === 'moving';
  const isOpen = gate.reportedState === 'open';
  const isClosed = gate.reportedState === 'closed';

  const handleConfirm = async () => {
    if (!confirmAction) return;
    setIsSubmitting(true);
    try {
      await onSendCommand(gate, confirmAction);
      setConfirmAction(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-slate-200 hover:border-slate-300 transition-all flex flex-col justify-between">
      <div>
        {/* Header: Gate Name & Status Badge */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-base sm:text-lg font-bold text-charcoal truncate flex items-center gap-2">
              <Sliders className="w-4 h-4 text-water-600 flex-shrink-0" />
              <span>{gate.name}</span>
            </h3>
            {gate.location && (
              <p className="text-xs text-charcoal-muted flex items-center gap-1 mt-0.5 truncate">
                <MapPin className="w-3 h-3 text-slate-400 flex-shrink-0" />
                <span>{gate.location}</span>
              </p>
            )}
          </div>

          <div className="flex-shrink-0">
            <GateStatusBadge state={gate.reportedState} />
          </div>
        </div>

        {/* Description if present and not compact */}
        {!compact && gate.description && (
          <p className="text-xs text-slate-600 mb-3 bg-slate-50 p-2 rounded-xl border border-slate-100">
            {gate.description}
          </p>
        )}

        {/* Assigned Devices Info */}
        <div className="space-y-1.5 my-3 text-xs">
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
            <span className="text-slate-500 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-slate-400" />
              <span>Actuator:</span>
            </span>
            {hasActuator ? (
              <span className="font-semibold flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    actuatorOnline ? 'bg-nature-500' : 'bg-slate-400'
                  }`}
                />
                <span className="text-charcoal truncate max-w-[150px]">{actuatorDevice?.name}</span>
                <span className={`text-[10px] ${actuatorOnline ? 'text-nature-700' : 'text-slate-500'}`}>
                  ({actuatorOnline ? 'Online' : 'Offline'})
                </span>
              </span>
            ) : (
              <span className="text-amber-700 font-medium">None assigned</span>
            )}
          </div>

          {!compact && sensorDevice && (
            <div className="flex items-center justify-between p-2 rounded-xl bg-nature-50/50 border border-nature-100">
              <span className="text-nature-800 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-nature-600" />
                <span>Soil Sensor:</span>
              </span>
              <span className="font-semibold text-nature-950 truncate max-w-[150px]">
                {sensorDevice.name}
              </span>
            </div>
          )}
        </div>

        {/* Hardware Status Warnings */}
        {!hasActuator && (
          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>Assign an actuator device in edit settings to enable gate controls.</span>
          </div>
        )}

        {hasActuator && !actuatorOnline && (
          <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-xs flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-slate-500 flex-shrink-0" />
            <span>Actuator is offline. Turn on your gate controller to send commands.</span>
          </div>
        )}

        {isMoving && (
          <div className="p-2.5 rounded-xl bg-water-50 border border-water-200 text-water-900 text-xs flex items-center gap-2 mb-3 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-water-600" />
            <span>Command in progress: Waiting for actuator to confirm new position.</span>
          </div>
        )}
      </div>

      {/* Action Buttons: Large Open / Close Controls */}
      <div className="pt-3 border-t border-slate-100 mt-2">
        <div className="grid grid-cols-2 gap-2.5">
          <Button
            type="button"
            variant="primary"
            size="md"
            leftIcon={<ArrowUpRight className="w-4 h-4" />}
            onClick={() => setConfirmAction('OPEN')}
            disabled={!hasActuator || !actuatorOnline || isMoving || isOpen}
            className="w-full"
          >
            {isOpen ? 'Already Open' : 'Open Gate'}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="md"
            leftIcon={<ArrowDownLeft className="w-4 h-4" />}
            onClick={() => setConfirmAction('CLOSE')}
            disabled={!hasActuator || !actuatorOnline || isMoving || isClosed}
            className="w-full"
          >
            {isClosed ? 'Already Closed' : 'Close Gate'}
          </Button>
        </div>

        {/* Edit and Delete actions */}
        {!compact && (onEdit || onDelete) && (
          <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-slate-100/80">
            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(gate)}
                className="text-xs text-charcoal-muted hover:text-charcoal flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Details</span>
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(gate)}
                className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Gate</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Command Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleConfirm}
        title={confirmAction === 'OPEN' ? 'Open Irrigation Gate?' : 'Close Irrigation Gate?'}
        message={`Are you sure you want to ${
          confirmAction === 'OPEN' ? 'OPEN' : 'CLOSE'
        } "${gate.name}"? This command will be transmitted to the physical actuator device.`}
        confirmLabel={confirmAction === 'OPEN' ? 'Yes, Open Gate' : 'Yes, Close Gate'}
        variant={confirmAction === 'OPEN' ? 'primary' : 'secondary'}
        isLoading={isSubmitting}
      />
    </Card>
  );
};
