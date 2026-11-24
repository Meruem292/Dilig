import React, { useRef, useState } from 'react';
import { Droplet, Thermometer } from 'lucide-react';
import type { Device, Gate, Quadrant, QuadrantEdge, QuadrantPlacement } from '../../types';

export type SelectedMapItem = { type: 'gate' | 'sensor'; id: string } | null;

interface QuadrantCanvasProps {
  quadrant: Quadrant;
  gates: Gate[];
  sensors: Device[];
  editMode: boolean;
  selectedItem: SelectedMapItem;
  onSelect: (item: SelectedMapItem) => void;
  onMoveGate: (gate: Gate, placement: QuadrantPlacement) => Promise<void>;
  onMoveSensor: (sensor: Device, placement: QuadrantPlacement) => Promise<void>;
}

interface DragState {
  type: 'gate' | 'sensor';
  id: string;
  pointerId: number;
  placement: QuadrantPlacement;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const snapGate = (quadrantId: string, x: number, y: number): QuadrantPlacement => {
  const distances = [
    { edge: 'west' as QuadrantEdge, distance: x },
    { edge: 'east' as QuadrantEdge, distance: 1 - x },
    { edge: 'north' as QuadrantEdge, distance: y },
    { edge: 'south' as QuadrantEdge, distance: 1 - y },
  ];
  const edge = distances.sort((a, b) => a.distance - b.distance)[0].edge;
  if (edge === 'west') return { quadrantId, x: 0, y: clamp(y, 0.08, 0.92), edge };
  if (edge === 'east') return { quadrantId, x: 1, y: clamp(y, 0.08, 0.92), edge };
  if (edge === 'north') return { quadrantId, x: clamp(x, 0.08, 0.92), y: 0, edge };
  return { quadrantId, x: clamp(x, 0.08, 0.92), y: 1, edge };
};

const fieldColors = {
  green: { base: '#dcfce7', line: 'rgba(0,104,56,.10)', border: '#00874a' },
  blue: { base: '#e0f2fe', line: 'rgba(2,132,199,.11)', border: '#0284c7' },
  amber: { base: '#fef3c7', line: 'rgba(217,119,6,.11)', border: '#d97706' },
};

export const QuadrantCanvas: React.FC<QuadrantCanvasProps> = ({
  quadrant,
  gates,
  sensors,
  editMode,
  selectedItem,
  onSelect,
  onMoveGate,
  onMoveSensor,
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const palette = fieldColors[quadrant.color];

  const getPointerPlacement = (
    event: React.PointerEvent<HTMLButtonElement>,
    type: 'gate' | 'sensor'
  ): QuadrantPlacement | null => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    return type === 'gate'
      ? snapGate(quadrant.id, x, y)
      : { quadrantId: quadrant.id, x: clamp(x, 0.08, 0.92), y: clamp(y, 0.1, 0.9) };
  };

  const beginDrag = (
    event: React.PointerEvent<HTMLButtonElement>,
    type: 'gate' | 'sensor',
    id: string,
    placement: QuadrantPlacement
  ) => {
    onSelect({ type, id });
    if (!editMode) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ type, id, pointerId: event.pointerId, placement });
  };

  const moveDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const placement = getPointerPlacement(event, drag.type);
    if (placement) setDrag({ ...drag, placement });
  };

  const finishDrag = async (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const completed = drag;
    setDrag(null);
    if (completed.type === 'gate') {
      const gate = gates.find((item) => item.id === completed.id);
      if (gate) await onMoveGate(gate, completed.placement);
    } else {
      const sensor = sensors.find((item) => item.id === completed.id);
      if (sensor) await onMoveSensor(sensor, completed.placement);
    }
  };

  const visiblePlacement = (type: 'gate' | 'sensor', id: string, original: QuadrantPlacement) =>
    drag?.type === type && drag.id === id ? drag.placement : original;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-card sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-bold text-charcoal">{quadrant.name}</h2>
          <p className="text-xs text-charcoal-muted">{quadrant.description || 'Live gate and sensor positions'}</p>
        </div>
        {editMode && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">Layout editing</span>}
      </div>

      <div className="px-7 py-9 sm:px-10 sm:py-12">
        <div
          ref={canvasRef}
          className="relative aspect-[16/10] w-full rounded-sm border-[6px] shadow-inner sm:border-[8px]"
          style={{
            backgroundColor: palette.base,
            borderColor: palette.border,
            backgroundImage: `linear-gradient(${palette.line} 1px, transparent 1px), linear-gradient(90deg, ${palette.line} 1px, transparent 1px)`,
            backgroundSize: '32px 32px',
          }}
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) onSelect(null);
          }}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(255,255,255,.46),transparent_60%)]" />

          {gates.map((gate) => {
            if (!gate.quadrantPlacement) return null;
            const placement = visiblePlacement('gate', gate.id, gate.quadrantPlacement);
            const vertical = placement.edge === 'east' || placement.edge === 'west';
            const selected = selectedItem?.type === 'gate' && selectedItem.id === gate.id;
            const open = gate.reportedState === 'open';
            const moving = gate.reportedState === 'moving';
            const error = gate.reportedState === 'error';
            return (
              <button
                key={gate.id}
                type="button"
                aria-label={`${gate.name}, ${gate.reportedState}${editMode ? ', drag to reposition' : ''}`}
                onPointerDown={(event) => beginDrag(event, 'gate', gate.id, placement)}
                onPointerMove={moveDrag}
                onPointerUp={(event) => void finishDrag(event)}
                onPointerCancel={(event) => void finishDrag(event)}
                className={`absolute z-20 flex touch-none select-none flex-col items-center gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-water-600 ${editMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
                style={{ left: `${placement.x * 100}%`, top: `${placement.y * 100}%`, transform: 'translate(-50%, -50%)' }}
              >
                <span className={`relative flex h-12 w-12 items-center justify-center rounded-xl border-2 bg-white shadow-elevated transition-transform ${selected ? 'scale-110 border-water-600 ring-4 ring-water-200' : error ? 'border-red-500' : 'border-slate-800'} ${moving ? 'motion-safe:animate-pulse' : ''}`}>
                  <span className={`flex ${vertical ? 'flex-col' : 'flex-row'} items-center justify-center gap-1`}>
                    <span className={`${vertical ? 'h-3 w-5' : 'h-5 w-3'} rounded-sm ${error ? 'bg-red-500' : 'bg-slate-700'}`} />
                    <span className={`${vertical ? 'h-2 w-5' : 'h-5 w-2'} rounded-sm transition-colors ${open ? 'bg-water-400 motion-safe:animate-pulse' : moving ? 'bg-water-200' : 'bg-slate-700'}`} />
                    <span className={`${vertical ? 'h-3 w-5' : 'h-5 w-3'} rounded-sm ${error ? 'bg-red-500' : 'bg-slate-700'}`} />
                  </span>
                </span>
                <span className="max-w-28 rounded-lg bg-white/95 px-2 py-1 text-[10px] font-bold text-charcoal shadow-subtle sm:text-xs">{gate.name}</span>
              </button>
            );
          })}

          {sensors.map((sensor) => {
            if (!sensor.quadrantPlacement) return null;
            const placement = visiblePlacement('sensor', sensor.id, sensor.quadrantPlacement);
            const selected = selectedItem?.type === 'sensor' && selectedItem.id === sensor.id;
            const reading = sensor.latestReading;
            return (
              <button
                key={sensor.id}
                type="button"
                aria-label={`${sensor.name}, soil sensor${editMode ? ', drag to reposition' : ''}`}
                onPointerDown={(event) => beginDrag(event, 'sensor', sensor.id, placement)}
                onPointerMove={moveDrag}
                onPointerUp={(event) => void finishDrag(event)}
                onPointerCancel={(event) => void finishDrag(event)}
                className={`absolute z-10 flex touch-none select-none flex-col items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-nature-700 ${editMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
                style={{ left: `${placement.x * 100}%`, top: `${placement.y * 100}%`, transform: 'translate(-50%, -50%)' }}
              >
                <span className={`relative flex h-12 w-12 items-center justify-center rounded-full border-2 bg-white shadow-elevated ${selected ? 'border-nature-700 ring-4 ring-nature-200' : 'border-nature-600'}`}>
                  <span className="absolute inset-1 rounded-full border border-nature-300 motion-safe:animate-ping motion-reduce:animate-none" />
                  <Droplet className="relative h-5 w-5 text-water-600" />
                </span>
                <span className="mt-1 min-w-max rounded-lg bg-white/95 px-2 py-1 text-[10px] font-bold text-charcoal shadow-subtle sm:text-xs">{sensor.name}</span>
                {reading && (
                  <span className="mt-1 flex min-w-max gap-2 rounded-lg bg-charcoal px-2 py-1 text-[9px] font-semibold text-white shadow-subtle sm:text-[10px]">
                    <span className="flex items-center gap-0.5"><Thermometer className="h-2.5 w-2.5" />{reading.soilTemperatureC == null ? '--' : `${reading.soilTemperatureC.toFixed(1)}°`}</span>
                    <span className="flex items-center gap-0.5"><Droplet className="h-2.5 w-2.5" />{reading.soilMoisturePercent.toFixed(0)}%</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-100 pt-3 text-[11px] font-medium text-slate-600">
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-nature-600" />Sensor</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-water-500" />Open / flowing</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-slate-700" />Closed</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-red-500" />Error</span>
      </div>
    </div>
  );
};
