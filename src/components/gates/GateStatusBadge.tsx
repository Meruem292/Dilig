import React from 'react';
import { Badge } from '../common/Badge';
import { CheckCircle2, Lock, Loader2, AlertCircle, HelpCircle } from 'lucide-react';
import type { GateReportedState } from '../../types';

export interface GateStatusBadgeProps {
  state: GateReportedState;
  size?: 'sm' | 'md';
}

export const GateStatusBadge: React.FC<GateStatusBadgeProps> = ({ state, size = 'md' }) => {
  switch (state) {
    case 'open':
      return (
        <Badge variant="green" size={size} dot>
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-nature-600" />
            <span>Open (Flowing)</span>
          </span>
        </Badge>
      );
    case 'closed':
      return (
        <Badge variant="gray" size={size}>
          <span className="flex items-center gap-1">
            <Lock className="w-3.5 h-3.5 text-slate-500" />
            <span>Closed</span>
          </span>
        </Badge>
      );
    case 'moving':
      return (
        <Badge variant="blue" size={size}>
          <span className="flex items-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-water-600" />
            <span>Moving...</span>
          </span>
        </Badge>
      );
    case 'error':
      return (
        <Badge variant="red" size={size}>
          <span className="flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 text-red-600" />
            <span>Actuator Error</span>
          </span>
        </Badge>
      );
    case 'unknown':
    default:
      return (
        <Badge variant="amber" size={size}>
          <span className="flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
            <span>Awaiting Signal</span>
          </span>
        </Badge>
      );
  }
};
