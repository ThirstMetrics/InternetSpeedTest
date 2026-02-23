'use client';

import { useEffect, useState } from 'react';

interface LocationDetailProps {
  location: {
    id: string;
    latitude: number;
    longitude: number;
    avg_download_mbps: number;
    avg_upload_mbps: number;
    avg_latency_ms: number;
    test_count: number;
    business_name?: string;
    business_address?: string;
    is_claimed: boolean;
    tier: 'free' | 'featured' | 'premium';
    last_tested_at: string;
  } | null;
  onClose: () => void;
  onTestHere?: () => void;
}

export default function LocationDetail({ location, onClose, onTestHere }: LocationDetailProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (location) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [location]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  const getRelativeTime = (timestamp: string) => {
    const now = new Date();
    const past = new Date(timestamp);
    const diffMs = now.getTime() - past.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 30) return `${diffDays}d ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
  };

  const getTierBadge = (tier: 'free' | 'featured' | 'premium') => {
    if (tier === 'free') return null;

    const colors = {
      featured: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
      premium: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[tier]}`}>
        {tier.charAt(0).toUpperCase() + tier.slice(1)}
      </span>
    );
  };

  if (!location) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 bg-gray-900 border-t border-gray-700 rounded-t-2xl transition-transform duration-300 ${
          isVisible ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ maxHeight: '60vh' }}
      >
        <div className="overflow-y-auto p-6" style={{ maxHeight: '60vh' }}>
          {/* Close Button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Title and Tier Badge */}
          <div className="flex items-start gap-3 mb-2 pr-10">
            <h2 className="text-xl font-bold text-white">
              {location.business_name || 'Unknown Location'}
            </h2>
            {getTierBadge(location.tier)}
          </div>

          {/* Address */}
          {location.business_address && (
            <p className="text-gray-400 text-sm mb-6">{location.business_address}</p>
          )}

          {/* Speed Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
              <div className="text-xs text-green-400 mb-1">Download</div>
              <div className="text-2xl font-bold text-green-400">
                {location.avg_download_mbps.toFixed(1)}
              </div>
              <div className="text-xs text-green-400/70">Mbps</div>
            </div>

            <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
              <div className="text-xs text-purple-400 mb-1">Upload</div>
              <div className="text-2xl font-bold text-purple-400">
                {location.avg_upload_mbps.toFixed(1)}
              </div>
              <div className="text-xs text-purple-400/70">Mbps</div>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
              <div className="text-xs text-amber-400 mb-1">Ping</div>
              <div className="text-2xl font-bold text-amber-400">
                {location.avg_latency_ms.toFixed(0)}
              </div>
              <div className="text-xs text-amber-400/70">ms</div>
            </div>
          </div>

          {/* Test Info */}
          <div className="flex items-center gap-4 text-sm text-gray-400 mb-6">
            <span>{location.test_count} test{location.test_count !== 1 ? 's' : ''}</span>
            <span>•</span>
            <span>Last tested: {getRelativeTime(location.last_tested_at)}</span>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            {onTestHere && (
              <button
                onClick={onTestHere}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
              >
                Test Here
              </button>
            )}

            {!location.is_claimed && (
              <button
                onClick={() => {
                  // TODO: Implement claim flow
                  console.log('Claim location:', location.id);
                }}
                className="w-full border border-gray-600 hover:border-gray-500 text-gray-300 hover:text-white font-medium py-3 px-4 rounded-lg transition-colors"
              >
                Claim This Location
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
