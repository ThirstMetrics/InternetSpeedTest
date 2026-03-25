'use client';

import { useState, useCallback } from 'react';
import { runSpeedTest } from '@/lib/speedtest';
import { getCurrentPosition, isWithinGeofence, getNetworkType } from '@/lib/geo';
import { apiUrl } from '@/lib/api';
import SpeedGauge from '@/components/SpeedGauge';
import type { SpeedTestState, GeoPosition } from '@/types';

interface SpeedTestProps {
  onComplete?: (result: SpeedTestState, position: GeoPosition) => void;
}

export default function SpeedTest({ onComplete }: SpeedTestProps) {
  const [state, setState] = useState<SpeedTestState>({
    phase: 'idle',
    progress: 0,
    download_mbps: 0,
    upload_mbps: 0,
    latency_ms: 0,
    jitter_ms: 0,
  });
  const [isPublicWifi, setIsPublicWifi] = useState(false);
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isLocalhost, setIsLocalhost] = useState(false);

  const isRunning = state.phase !== 'idle' && state.phase !== 'complete';

  const handleStart = useCallback(async () => {
    setLocationError(null);
    setSaved(false);

    // Get location first
    let pos: GeoPosition;
    try {
      pos = await getCurrentPosition();
      setPosition(pos);
    } catch (err) {
      setLocationError(err instanceof Error ? err.message : 'Failed to get location');
      return;
    }

    // Check geofence (skip on localhost for dev testing)
    const onLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!onLocalDev && !isWithinGeofence(pos.latitude, pos.longitude)) {
      setLocationError('SpeedTest is currently available in the Las Vegas metro area. Coming soon to your area!');
      return;
    }

    // Detect localhost — results won't reflect real internet speed
    setIsLocalhost(onLocalDev);

    // Run speed test
    const result = await runSpeedTest(setState);

    if (result.phase === 'complete' && !result.error) {
      // Don't save localhost results — they measure local I/O, not internet speed
      if (onLocalDev) {
        onComplete?.(result, pos);
        return;
      }

      // Save result
      setSaving(true);
      try {
        const networkType = getNetworkType();
        const response = await fetch(apiUrl('/api/speedtest/results'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            download_mbps: result.download_mbps,
            upload_mbps: result.upload_mbps,
            latency_ms: result.latency_ms,
            jitter_ms: result.jitter_ms,
            latitude: pos.latitude,
            longitude: pos.longitude,
            is_public_wifi: isPublicWifi,
            network_type: networkType,
          }),
        });

        if (response.ok) {
          setSaved(true);
        }
      } catch {
        // Silently fail — the user still sees their results
        console.error('Failed to save speed test result');
      }
      setSaving(false);

      onComplete?.(result, pos);
    }
  }, [isPublicWifi, onComplete]);

  const handleReset = () => {
    setState({
      phase: 'idle',
      progress: 0,
      download_mbps: 0,
      upload_mbps: 0,
      latency_ms: 0,
      jitter_ms: 0,
    });
    setSaved(false);
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      <SpeedGauge state={state} />

      {/* Network type selector */}
      <div className="w-full max-w-xs">
        <div className="flex rounded-xl border border-gray-700 overflow-hidden">
          <button
            type="button"
            onClick={() => setIsPublicWifi(false)}
            disabled={isRunning}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              !isPublicWifi
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800/50 text-gray-400 hover:text-gray-200'
            } ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            Home / Private
          </button>
          <button
            type="button"
            onClick={() => setIsPublicWifi(true)}
            disabled={isRunning}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              isPublicWifi
                ? 'bg-green-600 text-white'
                : 'bg-gray-800/50 text-gray-400 hover:text-gray-200'
            } ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.55a11 11 0 0114.08 0" />
              <path d="M1.42 9a16 16 0 0121.16 0" />
              <path d="M8.53 16.11a6 6 0 016.95 0" />
              <circle cx="12" cy="20" r="1" fill="currentColor" />
            </svg>
            Public WiFi
          </button>
        </div>
      </div>

      {/* Location error */}
      {locationError && (
        <p className="text-sm text-amber-400 text-center max-w-xs">{locationError}</p>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        {state.phase === 'idle' && (
          <button
            onClick={handleStart}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-full transition-colors text-lg"
          >
            Start Test
          </button>
        )}
        {state.phase === 'complete' && (
          <>
            <button
              onClick={handleReset}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-full transition-colors"
            >
              Test Again
            </button>
            <button
              onClick={() => {
                const text = `I just tested ${state.download_mbps} Mbps download / ${state.upload_mbps} Mbps upload on SpeedTest!`;
                if (navigator.share) {
                  navigator.share({ text });
                } else {
                  navigator.clipboard.writeText(text);
                }
              }}
              className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-medium rounded-full transition-colors"
            >
              Share
            </button>
          </>
        )}
      </div>

      {/* Save status */}
      {saving && <p className="text-xs text-gray-500">Saving result...</p>}
      {saved && <p className="text-xs text-green-500">Result saved to the map</p>}

      {/* Localhost warning */}
      {isLocalhost && state.phase === 'complete' && (
        <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg px-4 py-3 max-w-sm text-center">
          <p className="text-xs text-amber-400 font-medium mb-1">Localhost — not real internet speed</p>
          <p className="text-xs text-amber-400/70">
            These numbers measure local I/O speed, not your internet connection.
            Deploy to a remote server for accurate results. Data not saved.
          </p>
        </div>
      )}

      {/* Position info */}
      {position && state.phase === 'complete' && !isLocalhost && (
        <p className="text-xs text-gray-600">
          Location: {position.latitude.toFixed(4)}, {position.longitude.toFixed(4)}
          {position.accuracy > 100 && ` (accuracy: ~${Math.round(position.accuracy)}m)`}
        </p>
      )}
    </div>
  );
}
