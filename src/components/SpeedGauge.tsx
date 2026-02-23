'use client';

import { SpeedTestState } from '@/types';

interface SpeedGaugeProps {
  state: SpeedTestState;
}

export default function SpeedGauge({ state }: SpeedGaugeProps) {
  const { phase, download_mbps, upload_mbps, latency_ms, jitter_ms, progress } = state;

  // Determine the primary value to display in the gauge
  const displayValue =
    phase === 'download' || phase === 'complete'
      ? download_mbps
      : phase === 'upload'
      ? upload_mbps
      : latency_ms;

  const displayUnit =
    phase === 'latency' ? 'ms' : 'Mbps';

  const displayLabel =
    phase === 'idle' ? 'Ready' :
    phase === 'latency' ? 'Ping' :
    phase === 'download' ? 'Download' :
    phase === 'upload' ? 'Upload' :
    'Complete';

  // SVG gauge arc
  const radius = 90;
  const circumference = Math.PI * radius; // half circle
  const progressOffset = circumference - (progress / 100) * circumference;

  const phaseColor =
    phase === 'latency' ? '#f59e0b' :
    phase === 'download' ? '#3b82f6' :
    phase === 'upload' ? '#8b5cf6' :
    phase === 'complete' ? '#10b981' :
    '#6b7280';

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Gauge */}
      <div className="relative w-64 h-36">
        <svg viewBox="0 0 200 110" className="w-full h-full">
          {/* Background arc */}
          <path
            d="M 10 100 A 90 90 0 0 1 190 100"
            fill="none"
            stroke="#1f2937"
            strokeWidth="8"
            strokeLinecap="round"
          />
          {/* Progress arc */}
          {phase !== 'idle' && (
            <path
              d="M 10 100 A 90 90 0 0 1 190 100"
              fill="none"
              stroke={phaseColor}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={progressOffset}
              className="transition-all duration-300"
            />
          )}
        </svg>
        {/* Center value */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
          <span className="text-4xl font-bold text-white tabular-nums">
            {phase === 'idle' ? '--' : displayValue.toFixed(phase === 'latency' ? 0 : 1)}
          </span>
          <span className="text-sm text-gray-400">{phase === 'idle' ? '' : displayUnit}</span>
        </div>
      </div>

      {/* Phase label */}
      <div
        className="text-sm font-medium px-4 py-1 rounded-full"
        style={{ color: phaseColor, backgroundColor: `${phaseColor}20` }}
      >
        {displayLabel}
        {phase !== 'idle' && phase !== 'complete' && (
          <span className="ml-2 tabular-nums">{progress}%</span>
        )}
      </div>

      {/* Results summary (visible during and after test) */}
      {(phase !== 'idle') && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full max-w-md">
          <ResultCard
            label="Download"
            value={download_mbps}
            unit="Mbps"
            active={phase === 'download'}
            color="#3b82f6"
          />
          <ResultCard
            label="Upload"
            value={upload_mbps}
            unit="Mbps"
            active={phase === 'upload'}
            color="#8b5cf6"
          />
          <ResultCard
            label="Ping"
            value={latency_ms}
            unit="ms"
            active={phase === 'latency'}
            color="#f59e0b"
          />
          <ResultCard
            label="Jitter"
            value={jitter_ms}
            unit="ms"
            active={false}
            color="#6b7280"
          />
        </div>
      )}
    </div>
  );
}

function ResultCard({
  label,
  value,
  unit,
  active,
  color,
}: {
  label: string;
  value: number;
  unit: string;
  active: boolean;
  color: string;
}) {
  return (
    <div
      className={`flex flex-col items-center p-3 rounded-lg border ${
        active ? 'border-opacity-50' : 'border-gray-700 border-opacity-30'
      }`}
      style={{ borderColor: active ? color : undefined }}
    >
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-lg font-semibold text-white tabular-nums">
        {value > 0 ? value.toFixed(unit === 'ms' ? 0 : 1) : '--'}
      </span>
      <span className="text-xs text-gray-500">{unit}</span>
    </div>
  );
}
