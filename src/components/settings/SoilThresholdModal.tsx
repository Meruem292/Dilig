import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import type { SoilThresholds } from '../../types';

export interface SoilThresholdModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SoilThresholdModal: React.FC<SoilThresholdModalProps> = ({ isOpen, onClose }) => {
  const { userProfile, updateThresholds } = useAuth();
  const { showSuccess, showError } = useToast();

  const [dryMax, setDryMax] = useState<number>(30);
  const [wetMin, setWetMin] = useState<number>(70);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userProfile?.thresholds) {
      setDryMax(userProfile.thresholds.dryMoistureMax);
      setWetMin(userProfile.thresholds.wetMoistureMin);
    }
  }, [userProfile, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (dryMax >= wetMin) {
      setError('Dry moisture threshold must be lower than the Wet moisture threshold.');
      return;
    }

    if (dryMax < 5 || wetMin > 95) {
      setError('Thresholds must be between 5% and 95%.');
      return;
    }

    setIsSaving(true);
    try {
      const newThresholds: SoilThresholds = {
        dryMoistureMax: dryMax,
        wetMoistureMin: wetMin,
      };
      await updateThresholds(newThresholds);
      showSuccess('Thresholds updated', 'Your soil moisture classification rules have been saved.');
      onClose();
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Failed to update thresholds.';
      setError(msg);
      showError('Threshold update failed', msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Soil Moisture Thresholds"
      description="Customize when Dilig marks your field soil as Dry, Normal, or Wet."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs sm:text-sm font-medium">
            {error}
          </div>
        )}

        {/* Dry Threshold */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label htmlFor="dry-thresh" className="text-xs font-bold uppercase tracking-wider text-charcoal">
              Dry Soil Alert (Below %)
            </label>
            <span className="text-sm font-extrabold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
              {dryMax}%
            </span>
          </div>
          <input
            id="dry-thresh"
            type="range"
            min="5"
            max="50"
            step="1"
            value={dryMax}
            onChange={(e) => setDryMax(Number(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
          />
          <p className="text-[11px] text-charcoal-muted mt-1">
            Readings below {dryMax}% will be flagged as <strong>Dry (Needs Water)</strong>.
          </p>
        </div>

        {/* Wet Threshold */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label htmlFor="wet-thresh" className="text-xs font-bold uppercase tracking-wider text-charcoal">
              Wet / Saturated Soil (Above %)
            </label>
            <span className="text-sm font-extrabold text-water-600 bg-water-50 px-2 py-0.5 rounded-lg border border-water-200">
              {wetMin}%
            </span>
          </div>
          <input
            id="wet-thresh"
            type="range"
            min="50"
            max="95"
            step="1"
            value={wetMin}
            onChange={(e) => setWetMin(Number(e.target.value))}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-water-600"
          />
          <p className="text-[11px] text-charcoal-muted mt-1">
            Readings above {wetMin}% will be flagged as <strong>Wet (Sufficient Moisture)</strong>.
          </p>
        </div>

        {/* Live Visual Preview */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
          <p className="text-xs font-bold text-slate-600">Visual Range Guide:</p>
          <div className="flex h-3 rounded-full overflow-hidden text-[10px] font-bold text-white text-center">
            <div
              style={{ width: `${dryMax}%` }}
              className="bg-amber-500 flex items-center justify-center"
              title={`0% - ${dryMax}%: Dry`}
            />
            <div
              style={{ width: `${wetMin - dryMax}%` }}
              className="bg-nature-600 flex items-center justify-center"
              title={`${dryMax}% - ${wetMin}%: Normal`}
            />
            <div
              style={{ width: `${100 - wetMin}%` }}
              className="bg-water-600 flex items-center justify-center"
              title={`${wetMin}% - 100%: Wet`}
            />
          </div>
          <div className="flex justify-between text-[11px] text-charcoal-muted pt-1">
            <span className="text-amber-700 font-semibold">Dry (&lt;{dryMax}%)</span>
            <span className="text-nature-700 font-semibold">Normal ({dryMax}-{wetMin}%)</span>
            <span className="text-water-700 font-semibold">Wet (&gt;{wetMin}%)</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
          <Button type="button" variant="outline" size="md" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="md" isLoading={isSaving}>
            Save Thresholds
          </Button>
        </div>
      </form>
    </Modal>
  );
};
