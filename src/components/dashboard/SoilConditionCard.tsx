import React from 'react';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { Thermometer, Droplet, Clock, CheckCircle2 } from 'lucide-react';
import type { SoilReading, SoilThresholds } from '../../types';
import { classifyMoisture, isReadingStale, formatTimeAgo } from '../../services/telemetryService';

export interface SoilConditionCardProps {
  reading: SoilReading | null;
  sensorName?: string;
  thresholds?: SoilThresholds;
  onConfigureThresholds?: () => void;
}

export const SoilConditionCard: React.FC<SoilConditionCardProps> = ({
  reading,
  sensorName,
  thresholds,
  onConfigureThresholds,
}) => {
  const hasData = reading !== null && typeof reading.soilMoisturePercent === 'number';
  const moisturePercent = hasData ? Math.min(100, Math.max(0, Math.round(reading.soilMoisturePercent))) : null;
  const tempC = hasData && typeof reading.soilTemperatureC === 'number' ? Math.round(reading.soilTemperatureC * 10) / 10 : null;
  const stale = hasData ? isReadingStale(reading.recordedAt) : false;
  const classification = classifyMoisture(moisturePercent, thresholds);

  return (
    <Card className="overflow-hidden border-slate-200">
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-charcoal flex items-center gap-2">
            Soil Condition
          </h2>
          <p className="text-xs text-charcoal-muted mt-0.5">
            {sensorName ? `Reporting from: ${sensorName}` : 'Latest field soil telemetry'}
          </p>
        </div>

        {hasData ? (
          <div className="flex items-center gap-1.5">
            {stale ? (
              <Badge variant="amber" size="sm" dot>
                Outdated Reading
              </Badge>
            ) : (
              <Badge variant="green" size="sm" dot>
                Fresh Reading
              </Badge>
            )}
          </div>
        ) : (
          <Badge variant="gray" size="sm">
            No Sensor Connected
          </Badge>
        )}
      </div>

      {hasData ? (
        <div className="space-y-5">
          {/* Main 2-column stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Soil Moisture */}
            <div className={`p-4 rounded-2xl border transition-all ${classification.bgColor} border-slate-200/80`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <Droplet className="w-4 h-4 text-water-600" /> Soil Moisture
                </span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${classification.badgeColor}`}>
                  {classification.condition}
                </span>
              </div>

              <div className="flex items-baseline gap-1 my-1">
                <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-charcoal">
                  {moisturePercent}%
                </span>
              </div>

              {/* Progress bar gauge */}
              <div className="w-full bg-slate-200/80 rounded-full h-2.5 mt-3 overflow-hidden">
                <div
                  className={`h-2.5 rounded-full transition-all duration-500 ${
                    classification.condition === 'Dry'
                      ? 'bg-amber-500'
                      : classification.condition === 'Wet'
                      ? 'bg-water-600'
                      : 'bg-nature-600'
                  }`}
                  style={{ width: `${moisturePercent}%` }}
                />
              </div>

              <p className={`text-xs font-medium mt-2 ${classification.textColor}`}>
                {classification.label}
              </p>
            </div>

            {/* Soil Temperature */}
            <div className="p-4 rounded-2xl border bg-slate-50 border-slate-200/80">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <Thermometer className="w-4 h-4 text-nature-700" /> Soil Temperature
                </span>
              </div>

              <div className="flex items-baseline gap-1 my-1">
                <span className="text-3xl sm:text-4xl font-extrabold tracking-tight text-charcoal">
                  {tempC !== null ? `${tempC}°C` : '--'}
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-charcoal-muted mt-3">
                <CheckCircle2 className="w-3.5 h-3.5 text-nature-600" />
                <span>Optimal root temperature range</span>
              </div>
            </div>
          </div>

          {/* Footer timestamp & threshold config trigger */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-charcoal-muted">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>
                Last reading: <strong>{formatTimeAgo(reading?.recordedAt)}</strong>
              </span>
            </div>

            {onConfigureThresholds && (
              <button
                type="button"
                onClick={onConfigureThresholds}
                className="text-xs text-water-700 hover:text-water-800 hover:underline font-semibold"
              >
                Adjust Moisture Thresholds
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-6 px-4 bg-slate-50/70 rounded-2xl border border-dashed border-slate-200">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 shadow-subtle mb-3">
            <Droplet className="w-6 h-6 text-water-400" />
          </div>
          <h3 className="text-sm sm:text-base font-bold text-charcoal mb-1">
            No Soil Sensor Readings Available
          </h3>
          <p className="text-xs text-charcoal-muted max-w-sm mx-auto mb-3 leading-relaxed">
            Register a <strong>Soil Sensor</strong> device in the Devices tab to start receiving live moisture and temperature telemetry from your field.
          </p>
        </div>
      )}
    </Card>
  );
};
