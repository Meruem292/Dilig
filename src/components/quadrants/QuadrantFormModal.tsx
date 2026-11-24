import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import type { Quadrant, QuadrantColor } from '../../types';

interface QuadrantFormModalProps {
  isOpen: boolean;
  quadrant?: Quadrant | null;
  onClose: () => void;
  onSave: (input: { name: string; description?: string; color: QuadrantColor }) => Promise<void>;
}

const colorOptions: Array<{ value: QuadrantColor; label: string; swatch: string }> = [
  { value: 'green', label: 'Rice green', swatch: 'bg-nature-600' },
  { value: 'blue', label: 'Water blue', swatch: 'bg-water-600' },
  { value: 'amber', label: 'Harvest amber', swatch: 'bg-amber-500' },
];

export const QuadrantFormModal: React.FC<QuadrantFormModalProps> = ({
  isOpen,
  quadrant,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(quadrant?.name ?? '');
  const [description, setDescription] = useState(quadrant?.description ?? '');
  const [color, setColor] = useState<QuadrantColor>(quadrant?.color ?? 'green');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setError('Enter a name for this quadrant.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await onSave({ name: name.trim(), description: description.trim(), color });
      onClose();
    } catch (err: unknown) {
      setError((err as Error).message || 'Could not save the quadrant.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={quadrant ? 'Edit Quadrant' : 'Add Field Quadrant'}
      description="Create a visual field area for your existing gates and sensors."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">{error}</div>}
        <label className="block text-xs font-bold uppercase tracking-wider text-charcoal">
          Quadrant name
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. North Rice Field"
            autoFocus
            className="mt-1.5 w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-medium normal-case tracking-normal focus:outline-none focus:ring-2 focus:ring-nature-500"
          />
        </label>
        <label className="block text-xs font-bold uppercase tracking-wider text-charcoal">
          Description <span className="font-medium text-slate-400">(optional)</span>
          <textarea
            rows={2}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What area does this quadrant represent?"
            className="mt-1.5 w-full resize-none rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-medium normal-case tracking-normal focus:outline-none focus:ring-2 focus:ring-nature-500"
          />
        </label>
        <fieldset>
          <legend className="mb-2 text-xs font-bold uppercase tracking-wider text-charcoal">Map accent</legend>
          <div className="grid grid-cols-3 gap-2">
            {colorOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setColor(option.value)}
                aria-pressed={color === option.value}
                className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-2 text-xs font-semibold transition-colors ${
                  color === option.value ? 'border-charcoal bg-slate-50 text-charcoal' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span className={`h-3 w-3 rounded-full ${option.swatch}`} />
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4">
          <Button type="button" variant="outline" size="md" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button type="submit" variant="primary" size="md" isLoading={isSaving}>{quadrant ? 'Save Changes' : 'Add Quadrant'}</Button>
        </div>
      </form>
    </Modal>
  );
};
