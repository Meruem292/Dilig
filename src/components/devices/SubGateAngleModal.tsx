import React, { useState } from 'react';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { AlertTriangle, LockKeyhole, RotateCw } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useAuth } from '../../context/AuthContext';
import type { Device } from '../../types';

const DEFAULT_OPEN_ANGLE = 110;
const DEFAULT_CLOSE_ANGLE = 0;

export interface SubGateAngleModalProps {
  isOpen: boolean;
  device: Device;
  onClose: () => void;
  onSave: (device: Device, openAngle: number, closeAngle: number) => Promise<void>;
}

export const SubGateAngleModal: React.FC<SubGateAngleModalProps> = ({
  isOpen,
  device,
  onClose,
  onSave,
}) => {
  const { currentUser, friendlyError } = useAuth();
  const [openAngle, setOpenAngle] = useState(device.servoOpenAngle ?? DEFAULT_OPEN_ANGLE);
  const [closeAngle, setCloseAngle] = useState(device.servoCloseAngle ?? DEFAULT_CLOSE_ANGLE);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const validAngles =
    Number.isInteger(openAngle) &&
    Number.isInteger(closeAngle) &&
    openAngle >= 0 &&
    openAngle <= 180 &&
    closeAngle >= 0 &&
    closeAngle <= 180 &&
    openAngle !== closeAngle;
  const confirmed = confirmation.trim().toUpperCase() === device.deviceId.toUpperCase();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!currentUser?.email) {
      setError('Your signed-in account does not support password confirmation.');
      return;
    }
    if (!validAngles) {
      setError('Use two different whole-number angles from 0° to 180°.');
      return;
    }
    if (!confirmed) {
      setError('Type the complete device ID exactly as shown.');
      return;
    }

    setIsSaving(true);
    try {
      const credential = EmailAuthProvider.credential(currentUser.email, password);
      await reauthenticateWithCredential(currentUser, credential);
      await currentUser.getIdToken(true);
      await onSave(device, openAngle, closeAngle);
      onClose();
    } catch (saveError) {
      setError(friendlyError(saveError));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSaving ? () => {} : onClose}
      title="Protected Servo Angles"
      description={`Calibrate the endpoints for ${device.name}.`}
      maxWidth="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-950">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
          <p className="leading-relaxed">
            Incorrect endpoints can force the servo against the linkage. Adjust a few degrees at a
            time while watching the sub gate, with power isolation within reach.
          </p>
        </div>

        <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <legend className="sr-only">Servo endpoint angles</legend>
          {[
            { label: 'Open angle', value: openAngle, setValue: setOpenAngle },
            { label: 'Close angle', value: closeAngle, setValue: setCloseAngle },
          ].map(({ label, value, setValue }) => (
            <label key={label} className="space-y-1.5 text-sm font-semibold text-charcoal">
              <span className="flex items-center gap-1.5">
                <RotateCw className="h-4 w-4 text-slate-500" />
                {label}
              </span>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={180}
                  step={1}
                  value={value}
                  onChange={(event) => setValue(Number(event.target.value))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 pr-20 tabular-nums text-charcoal focus:outline-none focus:ring-2 focus:ring-nature-500"
                  required
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-500">
                  degrees
                </span>
              </div>
            </label>
          ))}
        </fieldset>

        <p className="text-xs leading-relaxed text-slate-600">
          Open may be higher or lower than Close, so reversed servo mounting is supported.
        </p>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-charcoal">
            <LockKeyhole className="h-4 w-4 text-slate-600" />
            Security confirmation
          </div>
          <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
            <span>Type device ID: <span className="font-mono">{device.deviceId}</span></span>
            <input
              type="text"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-mono text-sm uppercase text-charcoal focus:outline-none focus:ring-2 focus:ring-nature-500"
              required
            />
          </label>
          <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
            <span>Current account password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-charcoal focus:outline-none focus:ring-2 focus:ring-nature-500"
              required
            />
          </label>
        </div>

        {error && (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="danger"
            isLoading={isSaving}
            disabled={!validAngles || !confirmed || password.length === 0}
          >
            Verify and Save Angles
          </Button>
        </div>
      </form>
    </Modal>
  );
};
