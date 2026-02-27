'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { SpeedTestState } from '@/types';
import { getSpeedTier, getUploadTier, getPingTier, getJitterTier, getSmileColor, getSmileFactor, SpeedTier } from '@/lib/speedTier';

interface SpeedGaugeProps {
  state: SpeedTestState;
}

type MetricKey = 'download' | 'upload' | 'ping' | 'jitter';

export default function SpeedGauge({ state }: SpeedGaugeProps) {
  const { phase, download_mbps, upload_mbps, latency_ms, jitter_ms, progress } = state;
  const [selectedMetric, setSelectedMetric] = useState<MetricKey | null>(null);

  // Reset selection when a new test starts
  const prevPhase = useRef(phase);
  useEffect(() => {
    if (prevPhase.current === 'idle' && phase !== 'idle') {
      setSelectedMetric(null);
    }
    prevPhase.current = phase;
  }, [phase]);

  // Primary display value
  const displayValue =
    phase === 'download' || phase === 'complete'
      ? download_mbps
      : phase === 'upload'
      ? upload_mbps
      : latency_ms;

  const displayUnit = phase === 'latency' ? 'ms' : 'Mbps';

  const displayLabel =
    phase === 'idle' ? 'Ready' :
    phase === 'latency' ? 'Ping' :
    phase === 'download' ? 'Download' :
    phase === 'upload' ? 'Upload' :
    'Complete';

  const phaseColor =
    phase === 'latency' ? '#f59e0b' :
    phase === 'download' ? '#3b82f6' :
    phase === 'upload' ? '#8b5cf6' :
    phase === 'complete' ? '#10b981' :
    '#6b7280';

  // Target smile factor based on current phase
  const targetSmileFactor =
    phase === 'download' ? getSmileFactor(download_mbps) :
    phase === 'upload' ? getSmileFactor(upload_mbps) :
    phase === 'complete' ? getSmileFactor(download_mbps) :
    0;

  // Target color
  const targetColor =
    phase === 'download' ? getSmileColor(download_mbps) :
    phase === 'upload' ? getSmileColor(upload_mbps) :
    phase === 'complete' ? getSmileColor(download_mbps) :
    '#6b7280';

  // Animated smile curve
  const pathRef = useRef<SVGPathElement>(null);
  const currentFactor = useRef(0);
  const currentColorRgb = useRef<[number, number, number]>([107, 114, 128]);
  const animFrame = useRef<number>(0);

  const parseRgb = useCallback((color: string): [number, number, number] => {
    const m = color.match(/rgb\((\d+),(\d+),(\d+)\)/);
    if (m) return [+m[1], +m[2], +m[3]];
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
      ];
    }
    return [107, 114, 128];
  }, []);

  const buildPath = useCallback((factor: number): string => {
    const baseY = 30;
    const cpY = baseY + factor * 45;
    return `M 20 ${baseY} C 60 ${cpY}, 140 ${cpY}, 180 ${baseY}`;
  }, []);

  useEffect(() => {
    const decay = 0.08;
    const targetRgb = parseRgb(targetColor);

    const animate = () => {
      currentFactor.current += (targetSmileFactor - currentFactor.current) * decay;
      currentColorRgb.current = [
        currentColorRgb.current[0] + (targetRgb[0] - currentColorRgb.current[0]) * decay,
        currentColorRgb.current[1] + (targetRgb[1] - currentColorRgb.current[1]) * decay,
        currentColorRgb.current[2] + (targetRgb[2] - currentColorRgb.current[2]) * decay,
      ];

      if (pathRef.current) {
        pathRef.current.setAttribute('d', buildPath(currentFactor.current));
        const [r, g, b] = currentColorRgb.current;
        pathRef.current.setAttribute('stroke', `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`);
      }

      animFrame.current = requestAnimationFrame(animate);
    };

    animFrame.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrame.current);
  }, [targetSmileFactor, targetColor, parseRgb, buildPath]);

  // Smile curve progress
  const smileLength = 200;
  const smileProgress = phase === 'idle' ? 0 : phase === 'complete' ? 100 : progress;
  const smileDashoffset = smileLength - (smileProgress / 100) * smileLength;

  // Tier badge: show selected metric's tier, or download by default
  function getActiveTier(): SpeedTier | null {
    if (phase !== 'complete') return null;
    switch (selectedMetric) {
      case 'download': return getSpeedTier(download_mbps);
      case 'upload':   return getUploadTier(upload_mbps);
      case 'ping':     return getPingTier(latency_ms);
      case 'jitter':   return getJitterTier(jitter_ms);
      default:         return getSpeedTier(download_mbps);
    }
  }

  const tier = getActiveTier();
  const tierMetricLabel = selectedMetric
    ? selectedMetric.charAt(0).toUpperCase() + selectedMetric.slice(1)
    : 'Download';

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Speed number */}
      <div className="flex flex-col items-center">
        <span className="text-5xl sm:text-6xl font-bold text-white tabular-nums leading-none">
          {phase === 'idle' ? '--' : displayValue.toFixed(phase === 'latency' ? 0 : 1)}
        </span>
        <span className="text-sm text-gray-400 mt-1">
          {phase === 'idle' ? '' : displayUnit}
        </span>
      </div>

      {/* Phase pill */}
      <div
        className="text-sm font-medium px-4 py-1 rounded-full"
        style={{ color: phaseColor, backgroundColor: `${phaseColor}20` }}
      >
        {displayLabel}
        {phase !== 'idle' && phase !== 'complete' && (
          <span className="ml-2 tabular-nums">{progress}%</span>
        )}
      </div>

      {/* SVG smile curve */}
      <div className="w-56 h-20">
        <svg viewBox="0 0 200 80" className="w-full h-full">
          <path
            d={buildPath(0)}
            fill="none"
            stroke="#1f2937"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <path
            ref={pathRef}
            d={buildPath(0)}
            fill="none"
            stroke="#6b7280"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={smileLength}
            strokeDashoffset={smileDashoffset}
            className="transition-[stroke-dashoffset] duration-300"
          />
        </svg>
      </div>

      {/* Tier badge */}
      {tier && (
        <SpeedTierBadge
          key={selectedMetric || 'download'}
          metricLabel={tierMetricLabel}
          label={tier.label}
          color={tier.color}
          description={tier.description}
        />
      )}

      {/* 4-metric results grid */}
      {phase !== 'idle' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full max-w-md">
          <ResultCard
            label="Download"
            value={download_mbps}
            unit="Mbps"
            active={phase === 'download'}
            selected={phase === 'complete' && (selectedMetric === 'download' || selectedMetric === null)}
            color="#3b82f6"
            onClick={phase === 'complete' ? () => setSelectedMetric('download') : undefined}
          />
          <ResultCard
            label="Upload"
            value={upload_mbps}
            unit="Mbps"
            active={phase === 'upload'}
            selected={phase === 'complete' && selectedMetric === 'upload'}
            color="#8b5cf6"
            onClick={phase === 'complete' ? () => setSelectedMetric('upload') : undefined}
          />
          <ResultCard
            label="Ping"
            value={latency_ms}
            unit="ms"
            active={phase === 'latency'}
            selected={phase === 'complete' && selectedMetric === 'ping'}
            color="#f59e0b"
            onClick={phase === 'complete' ? () => setSelectedMetric('ping') : undefined}
          />
          <ResultCard
            label="Jitter"
            value={jitter_ms}
            unit="ms"
            active={false}
            selected={phase === 'complete' && selectedMetric === 'jitter'}
            color="#6b7280"
            onClick={phase === 'complete' ? () => setSelectedMetric('jitter') : undefined}
          />
        </div>
      )}
    </div>
  );
}

function SpeedTierBadge({
  metricLabel,
  label,
  color,
  description,
}: {
  metricLabel: string;
  label: string;
  color: string;
  description: string;
}) {
  return (
    <div
      className="flex flex-col items-center gap-1 px-5 py-3 rounded-xl border"
      style={{
        borderColor: `${color}40`,
        backgroundColor: `${color}10`,
        animation: 'fadeIn 0.3s ease-out',
      }}
    >
      <span className="text-xs text-gray-500">{metricLabel}</span>
      <span className="text-sm font-semibold" style={{ color }}>
        &#x26A1; {label}
      </span>
      <span className="text-xs text-gray-400 text-center max-w-xs">
        {description}
      </span>
    </div>
  );
}

function ResultCard({
  label,
  value,
  unit,
  active,
  selected,
  color,
  onClick,
}: {
  label: string;
  value: number;
  unit: string;
  active: boolean;
  selected: boolean;
  color: string;
  onClick?: () => void;
}) {
  return (
    <div
      className={`flex flex-col items-center p-3 rounded-lg border transition-all ${
        selected ? 'border-opacity-70 scale-105' :
        active ? 'border-opacity-50' :
        'border-gray-700 border-opacity-30'
      } ${onClick ? 'cursor-pointer hover:scale-105' : ''}`}
      style={{ borderColor: active || selected ? color : undefined }}
      onClick={onClick}
    >
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-lg font-semibold text-white tabular-nums">
        {value > 0 ? value.toFixed(unit === 'ms' ? 0 : 1) : '--'}
      </span>
      <span className="text-xs text-gray-500">{unit}</span>
    </div>
  );
}
