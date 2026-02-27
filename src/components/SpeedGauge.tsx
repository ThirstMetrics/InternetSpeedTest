'use client';

import { useEffect, useRef, useCallback } from 'react';
import { SpeedTestState } from '@/types';
import { getSpeedTier, getSmileColor, getSmileFactor } from '@/lib/speedTier';

interface SpeedGaugeProps {
  state: SpeedTestState;
}

export default function SpeedGauge({ state }: SpeedGaugeProps) {
  const { phase, download_mbps, upload_mbps, latency_ms, jitter_ms, progress } = state;

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
    0; // neutral for idle/latency

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
    // hex fallback
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
    // SVG viewBox is 0 0 200 60
    // Endpoints at y=30 (middle), control points move based on factor
    // factor: -0.7 (frown, curve bows up) to +1.0 (smile, curve bows down)
    const baseY = 30;
    const cpY = baseY + factor * 45; // positive factor = cp below baseline (smile in SVG), negative = above (frown)
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

  // Smile curve progress (stroke fill)
  const smileLength = 200; // approx cubic bezier length for our path
  const smileProgress = phase === 'idle' ? 0 : phase === 'complete' ? 100 : progress;
  const smileDashoffset = smileLength - (smileProgress / 100) * smileLength;

  // Tier badge (only on complete)
  const tier = phase === 'complete' ? getSpeedTier(download_mbps) : null;

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Speed number — primary display on TOP */}
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
          {/* Background track — neutral gray line */}
          <path
            d={buildPath(0)}
            fill="none"
            stroke="#1f2937"
            strokeWidth="8"
            strokeLinecap="round"
          />
          {/* Active smile curve */}
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

      {/* Tier badge (complete only) */}
      {tier && (
        <SpeedTierBadge label={tier.label} color={tier.color} description={tier.description} />
      )}

      {/* 4-metric results grid */}
      {phase !== 'idle' && (
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

function SpeedTierBadge({
  label,
  color,
  description,
}: {
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
        animation: 'fadeIn 0.5s ease-out',
      }}
    >
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
