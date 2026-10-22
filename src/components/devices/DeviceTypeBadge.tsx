import React from 'react';
import { Badge } from '../common/Badge';
import { Sprout, Sliders } from 'lucide-react';
import type { DeviceType } from '../../types';

export interface DeviceTypeBadgeProps {
  type: DeviceType;
}

export const DeviceTypeBadge: React.FC<DeviceTypeBadgeProps> = ({ type }) => {
  if (type === 'sensor') {
    return (
      <Badge variant="green" size="sm">
        <span className="flex items-center gap-1">
          <Sprout className="w-3.5 h-3.5 text-nature-600" />
          <span>Soil Sensor</span>
        </span>
      </Badge>
    );
  }

  return (
    <Badge variant="blue" size="sm">
      <span className="flex items-center gap-1">
        <Sliders className="w-3.5 h-3.5 text-water-600" />
        <span>Gate Actuator</span>
      </span>
    </Badge>
  );
};
