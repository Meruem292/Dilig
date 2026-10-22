import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/common/Button';
import { FirebaseSetupNotice } from '../components/common/FirebaseSetupNotice';
import { Mail, Lock, User, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Logo } from '../components/common/Logo';

export const AuthPage: React.FC = () => {
  const { signIn, signUp, resetPassword, friendlyError, isConfigured } = useAuth();
  const { showSuccess, showError } = useToast();

  const [tab, setTab] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6">
        <div className="max-w-md mx-auto text-center mb-6">
          <Logo mode="responsive" size="xl" className="mb-4 justify-center" />
          <p className="text-sm text-charcoal-muted mt-1">Simple Smart Irrigation for Farmers</p>
        </div>
        <FirebaseSetupNotice />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      if (tab === 'signin') {
        await signIn(email, password);
        showSuccess('Welcome back!', 'Signed into your Dilig dashboard.');
      } else if (tab === 'signup') {
        await signUp(email, password, displayName);
        showSuccess('Account created!', 'Welcome to Dilig Smart Irrigation.');
      } else if (tab === 'forgot') {
        await resetPassword(email);
        showSuccess('Reset link sent', 'Check your email inbox for instructions.');
        setTab('signin');
      }
    } catch (err: unknown) {
      const msg = friendlyError(err);
      setErrorMsg(msg);
      showError('Authentication failed', msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-10 px-4 sm:px-6">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-6 flex flex-col items-center">
          <Logo mode="responsive" size="xl" className="mb-4 justify-center" />
          <p className="text-xs sm:text-sm text-charcoal-muted mt-1 font-medium">
            Simple Smart Irrigation Management
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-white py-6 sm:py-8 px-5 sm:px-8 shadow-card rounded-3xl border border-slate-200">
          {/* Navigation Tabs */}
          <div className="flex rounded-xl bg-slate-100 p-1 mb-6">
            <button
              type="button"
              onClick={() => {
                setTab('signin');
                setErrorMsg(null);
              }}
              className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${
                tab === 'signin'
                  ? 'bg-white text-charcoal shadow-subtle'
                  : 'text-slate-600 hover:text-charcoal'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('signup');
                setErrorMsg(null);
              }}
              className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${
                tab === 'signup'
                  ? 'bg-white text-charcoal shadow-subtle'
                  : 'text-slate-600 hover:text-charcoal'
              }`}
            >
              Create Account
            </button>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-900 rounded-xl text-xs sm:text-sm font-medium">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Display Name for Sign Up */}
            {tab === 'signup' && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1.5">
                  Your Full Name or Farm Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Farmer Juan or Green Valley Farm"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-nature-500 text-sm text-charcoal"
                  />
                </div>
              </div>
            )}

            {/* Email Address */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="farmer@example.com"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-nature-500 text-sm text-charcoal"
                />
              </div>
            </div>

            {/* Password */}
            {tab !== 'forgot' && (
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-charcoal">
                    Password
                  </label>
                  {tab === 'signin' && (
                    <button
                      type="button"
                      onClick={() => {
                        setTab('forgot');
                        setErrorMsg(null);
                      }}
                      className="text-xs text-water-700 hover:text-water-800 hover:underline font-semibold"
                    >
                      Forgot Password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-nature-500 text-sm text-charcoal"
                  />
                </div>
              </div>
            )}

            {tab === 'forgot' && (
              <p className="text-xs text-charcoal-muted leading-relaxed">
                Enter your email address and we'll send you a link to reset your password.
              </p>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isLoading}
              rightIcon={<ArrowRight className="w-4 h-4" />}
              className="w-full mt-2"
            >
              {tab === 'signin' && 'Sign In to Dashboard'}
              {tab === 'signup' && 'Create Farmer Account'}
              {tab === 'forgot' && 'Send Password Reset Link'}
            </Button>

            {tab === 'forgot' && (
              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setTab('signin');
                    setErrorMsg(null);
                  }}
                  className="text-xs text-slate-600 hover:text-charcoal font-semibold hover:underline"
                >
                  &larr; Back to Sign In
                </button>
              </div>
            )}
          </form>

          {/* Simple bullet points */}
          <div className="mt-6 pt-5 border-t border-slate-100 space-y-2 text-xs text-charcoal-muted">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-nature-600 flex-shrink-0" />
              <span>Real-time soil moisture and temperature monitoring</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-nature-600 flex-shrink-0" />
              <span>Direct confirmed control for water irrigation gates</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-nature-600 flex-shrink-0" />
              <span>Designed specifically for mobile phones and farmers</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
