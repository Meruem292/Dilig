import React from 'react';
import { Loader2 } from 'lucide-react';

export interface LoadingSpinnerProps {
  label?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ label = 'Loading...' }) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-nature-600" />
      <p className="text-sm text-charcoal-muted font-medium">{label}</p>
    </div>
  );
};
