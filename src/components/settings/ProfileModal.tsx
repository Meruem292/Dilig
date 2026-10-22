import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Mail, Shield, KeyRound, LogOut } from 'lucide-react';

export interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, userProfile, resetPassword, signOut } = useAuth();
  const { showSuccess, showError } = useToast();
  const [isSendingReset, setIsSendingReset] = useState(false);

  const handlePasswordReset = async () => {
    if (!currentUser?.email) return;
    setIsSendingReset(true);
    try {
      await resetPassword(currentUser.email);
      showSuccess('Password reset email sent', 'Please check your inbox to update your password.');
    } catch (err: unknown) {
      showError('Error', (err as Error).message || 'Could not send reset email.');
    } finally {
      setIsSendingReset(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      onClose();
      showSuccess('Signed out', 'You have been signed out.');
    } catch (err) {
      showError('Error signing out', 'Please try again.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Account Settings"
      description="Manage your account profile and security credentials."
    >
      <div className="space-y-4">
        {/* User Card */}
        <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
          <div className="w-12 h-12 rounded-full bg-nature-600 text-white flex items-center justify-center font-bold text-lg">
            {userProfile?.displayName ? userProfile.displayName.charAt(0).toUpperCase() : 'F'}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-base font-bold text-charcoal truncate">
              {userProfile?.displayName || 'Farmer Account'}
            </h4>
            <p className="text-xs text-charcoal-muted truncate flex items-center gap-1 mt-0.5">
              <Mail className="w-3 h-3 text-slate-400 flex-shrink-0" />
              <span>{currentUser?.email}</span>
            </p>
          </div>
        </div>

        {/* Security Options */}
        <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3">
          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-slate-400" />
            <span>Account Security</span>
          </h5>

          <p className="text-xs text-charcoal-muted leading-relaxed">
            Need to update your password? We will send a secure password reset link to your registered email address.
          </p>

          <Button
            type="button"
            variant="outline"
            size="sm"
            leftIcon={<KeyRound className="w-4 h-4 text-slate-600" />}
            onClick={handlePasswordReset}
            isLoading={isSendingReset}
            className="w-full sm:w-auto"
          >
            Send Password Reset Link
          </Button>
        </div>

        {/* Sign Out */}
        <div className="pt-2">
          <Button
            type="button"
            variant="danger"
            size="md"
            leftIcon={<LogOut className="w-4 h-4" />}
            onClick={handleSignOut}
            className="w-full"
          >
            Sign Out of Dilig
          </Button>
        </div>
      </div>
    </Modal>
  );
};
