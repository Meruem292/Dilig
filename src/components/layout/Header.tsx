import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { User as UserIcon, LogOut, Settings, Wifi, WifiOff } from 'lucide-react';
import { Logo } from '../common/Logo';

export interface HeaderProps {
  onOpenProfile: () => void;
  onOpenThresholds: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenProfile, onOpenThresholds }) => {
  const { currentUser, userProfile, signOut } = useAuth();
  const { showSuccess, showError } = useToast();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      showSuccess('Signed out successfully', 'See you soon!');
    } catch (err) {
      showError('Sign out error', 'Could not sign out. Please try again.');
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Brand Logo: responsive between bigscreen and smallscreen */}
        <div className="flex items-center">
          <Logo mode="responsive" size="md" />
        </div>

        {/* Network & Profile Menu */}
        <div className="flex items-center gap-2">
          {/* Network indicator */}
          <div
            className={`hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
              isOnline
                ? 'bg-nature-50 text-nature-800 border-nature-200'
                : 'bg-red-50 text-red-800 border-red-200'
            }`}
            title={isOnline ? 'Internet connection active' : 'You are currently offline'}
          >
            {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span className="font-medium">{isOnline ? 'Online' : 'Offline'}</span>
          </div>

          {/* User profile dropdown */}
          {currentUser && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 p-1.5 pr-2.5 rounded-full border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-nature-500"
                aria-label="User account menu"
                aria-expanded={dropdownOpen}
              >
                <div className="w-7 h-7 rounded-full bg-nature-600 text-white flex items-center justify-center text-xs font-bold uppercase">
                  {userProfile?.displayName ? userProfile.displayName.charAt(0) : <UserIcon className="w-4 h-4" />}
                </div>
                <span className="text-xs font-semibold text-charcoal hidden sm:inline-block max-w-[120px] truncate">
                  {userProfile?.displayName || currentUser.email?.split('@')[0]}
                </span>
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl border border-slate-200 shadow-elevated py-1.5 z-50 animate-in fade-in-0 zoom-in-95 duration-100">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-xs text-charcoal-muted">Signed in as</p>
                    <p className="text-sm font-semibold text-charcoal truncate">{currentUser.email}</p>
                  </div>

                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      onOpenProfile();
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-charcoal hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                  >
                    <UserIcon className="w-4 h-4 text-slate-500" />
                    <span>Account Profile</span>
                  </button>

                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      onOpenThresholds();
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-charcoal hover:bg-slate-50 flex items-center gap-2.5 transition-colors"
                  >
                    <Settings className="w-4 h-4 text-slate-500" />
                    <span>Soil Thresholds</span>
                  </button>

                  <div className="border-t border-slate-100 my-1"></div>

                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      handleSignOut();
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2.5 transition-colors font-medium"
                  >
                    <LogOut className="w-4 h-4 text-red-600" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
