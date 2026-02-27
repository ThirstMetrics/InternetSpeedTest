export interface SpeedTier {
  label: string;
  color: string;
  description: string;
}

const tiers: { min: number; label: string; color: string; description: string }[] = [
  { min: 100, label: 'Ultra Fast', color: '#10b981', description: 'Multiple 4K streams, cloud gaming, large downloads' },
  { min: 50,  label: 'Very Fast',  color: '#10b981', description: '4K streaming, video conferencing, fast downloads' },
  { min: 25,  label: 'Fast',       color: '#3b82f6', description: 'HD streaming, video calls, smooth browsing' },
  { min: 10,  label: 'Moderate',   color: '#f59e0b', description: 'Standard video, social media, email' },
  { min: 0,   label: 'Slow',       color: '#ef4444', description: 'Basic browsing, email, may buffer on video' },
];

export function getSpeedTier(downloadMbps: number): SpeedTier {
  for (const t of tiers) {
    if (downloadMbps >= t.min) {
      return { label: t.label, color: t.color, description: t.description };
    }
  }
  return tiers[tiers.length - 1];
}

/**
 * RGB-interpolated color from red (0 Mbps) → amber (25) → blue (50) → green (100+)
 */
export function getSmileColor(downloadMbps: number): string {
  const stops: [number, [number, number, number]][] = [
    [0,   [239, 68, 68]],   // #ef4444
    [25,  [245, 158, 11]],  // #f59e0b
    [50,  [59, 130, 246]],  // #3b82f6
    [100, [16, 185, 129]],  // #10b981
  ];

  const clamped = Math.max(0, Math.min(downloadMbps, 100));

  for (let i = 0; i < stops.length - 1; i++) {
    const [lowSpeed, lowRgb] = stops[i];
    const [highSpeed, highRgb] = stops[i + 1];
    if (clamped <= highSpeed) {
      const t = (clamped - lowSpeed) / (highSpeed - lowSpeed);
      const r = Math.round(lowRgb[0] + (highRgb[0] - lowRgb[0]) * t);
      const g = Math.round(lowRgb[1] + (highRgb[1] - lowRgb[1]) * t);
      const b = Math.round(lowRgb[2] + (highRgb[2] - lowRgb[2]) * t);
      return `rgb(${r},${g},${b})`;
    }
  }

  return 'rgb(16,185,129)';
}

/**
 * Continuous float: -0.7 (frown at 0 Mbps) to +1.0 (big grin at 100+ Mbps)
 * Uses sqrt curve so higher speeds ramp up faster to a big smile.
 */
export function getSmileFactor(downloadMbps: number): number {
  const clamped = Math.max(0, Math.min(downloadMbps, 200));
  // sqrt curve: ramps quickly toward smile, saturates at high speeds
  // 0→-0.7, ~10→-0.16, ~25→0.15, ~50→0.5, ~100→0.87, 150+→1.0
  const t = Math.sqrt(clamped / 200); // 0→0, 50→0.5, 200→1.0 (sqrt shaped)
  const factor = -0.7 + t * 1.7;
  return Math.max(-0.7, Math.min(1.0, factor));
}
