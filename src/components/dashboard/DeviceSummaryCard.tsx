import React from 'react';
import { Card } from '../common/Card';
import { Radio, AlertOctagon, Sliders } from 'lucide-react';

export interface DeviceSummaryCardProps {
  onlineCount: number;
  offlineCount: number;
  gatesCount: number;
  onGoToDevices: () => void;
  onGoToGates: () => void;
}

export const DeviceSummaryCard: React.FC<DeviceSummaryCardProps> = ({
  onlineCount,
  offlineCount,
  gatesCount,
  onGoToDevices,
  onGoToGates,
}) => {
  return (
    <Card className="border-slate-200">
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
        <h2 className="text-base sm:text-lg font-bold text-charcoal">
          System Overview
        </h2>
        <span className="text-xs text-charcoal-muted">Equipment Status</span>
      </div>

      <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
        {/* Online Devices */}
        <button
          onClick={onGoToDevices}
          className="p-3 sm:p-4 rounded-2xl bg-nature-50/70 border border-nature-200 text-left hover:bg-nature-50 transition-colors focus:outline-none focus:ring-2 focus:ring-nature-500"
        >
          <div className="flex items-center gap-1.5 text-nature-700 text-xs font-semibold mb-1">
            <Radio className="w-4 h-4 text-nature-600" />
            <span className="truncate">Online</span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-nature-950">
            {onlineCount}
          </div>
          <div className="text-[11px] text-nature-800/80 mt-0.5 truncate">
            Active in field
          </div>
        </button>

        {/* Offline Devices */}
        <button
          onClick={onGoToDevices}
          className="p-3 sm:p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left hover:bg-slate-100/70 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400"
        >
          <div className="flex items-center gap-1.5 text-slate-600 text-xs font-semibold mb-1">
            <AlertOctagon className="w-4 h-4 text-slate-500" />
            <span className="truncate">Offline</span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-800">
            {offlineCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 truncate">
            Needs attention
          </div>
        </button>

        {/* Registered Gates */}
        <button
          onClick={onGoToGates}
          className="p-3 sm:p-4 rounded-2xl bg-water-50/70 border border-water-200 text-left hover:bg-water-50 transition-colors focus:outline-none focus:ring-2 focus:ring-water-500"
        >
          <div className="flex items-center gap-1.5 text-water-700 text-xs font-semibold mb-1">
            <Sliders className="w-4 h-4 text-water-600" />
            <span className="truncate">Gates</span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-water-950">
            {gatesCount}
          </div>
          <div className="text-[11px] text-water-800/80 mt-0.5 truncate">
            Irrigation points
          </div>
        </button>
      </div>
    </Card>
  );
};
