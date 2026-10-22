import React, { useState } from 'react';
import { Card } from './Card';
import { AlertCircle, Copy, Check, ExternalLink, Terminal } from 'lucide-react';

export const FirebaseSetupNotice: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const envTemplate = `VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(envTemplate);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="max-w-2xl mx-auto my-8 px-4">
      <Card className="border-amber-200 bg-amber-50/50">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-amber-100 text-amber-800 rounded-2xl flex-shrink-0">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg sm:text-xl font-bold text-amber-950 mb-1">
              Firebase Connection Required
            </h2>
            <p className="text-sm text-amber-900 leading-relaxed mb-4">
              <strong>Dilig</strong> requires a real Firebase backend for farmer authentication, soil telemetry, and gate control. To connect your app, configure your credentials in a <code className="bg-amber-100/80 px-1.5 py-0.5 rounded text-amber-950 font-mono text-xs">.env</code> file.
            </p>

            <div className="space-y-3 mb-4 text-xs sm:text-sm text-charcoal">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-nature-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                  1
                </span>
                <span>
                  Go to the{' '}
                  <a
                    href="https://console.firebase.google.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-water-700 underline font-semibold inline-flex items-center gap-1"
                  >
                    Firebase Console <ExternalLink className="w-3 h-3" />
                  </a>{' '}
                  and open your project.
                </span>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-nature-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                  2
                </span>
                <span>
                  Enable <strong>Authentication</strong> (Email/Password) and <strong>Cloud Firestore</strong> database.
                </span>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-nature-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                  3
                </span>
                <span>
                  Go to <strong>Project Settings</strong> &rarr; <strong>General</strong> &rarr; <strong>Your Apps</strong> &rarr; Web app, and copy the config into a <code className="bg-amber-100/80 px-1.5 py-0.5 rounded text-amber-950 font-mono text-xs">.env</code> file in this folder:
                </span>
              </div>
            </div>

            <div className="relative bg-slate-900 rounded-xl p-3.5 font-mono text-xs text-slate-200 overflow-x-auto shadow-inner mb-4">
              <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-slate-700">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5" /> .env
                </span>
                <button
                  onClick={copyToClipboard}
                  className="text-slate-300 hover:text-white flex items-center gap-1 bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded text-xs transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-nature-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy Template'}
                </button>
              </div>
              <pre className="text-slate-300 whitespace-pre leading-relaxed">{envTemplate}</pre>
            </div>

            <p className="text-xs text-slate-500">
              After creating <code className="bg-slate-100 px-1 py-0.5 rounded">.env</code>, restart the development server with <code className="bg-slate-100 px-1 py-0.5 rounded">npm run dev</code>.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};
