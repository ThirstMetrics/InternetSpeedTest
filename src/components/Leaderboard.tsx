'use client';

import { useEffect, useState } from 'react';

export interface LeaderboardEntry {
  id: string;
  latitude: number;
  longitude: number;
  avg_download_mbps: number;
  avg_upload_mbps: number;
  avg_latency_ms: number;
  test_count: number;
  business_name?: string;
  tier: string;
}

interface LeaderboardProps {
  onSelectLocation?: (location: LeaderboardEntry) => void;
}

export default function Leaderboard({ onSelectLocation }: LeaderboardProps) {
  const [locations, setLocations] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch(
          '/api/locations?lat=36.1699&lng=-115.1398&radius=50'
        );

        if (!response.ok) {
          throw new Error('Failed to fetch locations');
        }

        const data = await response.json();

        // Sort by download speed descending and take top 20
        const sorted = (data.locations || [])
          .sort((a: LeaderboardEntry, b: LeaderboardEntry) =>
            b.avg_download_mbps - a.avg_download_mbps
          )
          .slice(0, 20);

        setLocations(sorted);
      } catch (err) {
        console.error('Leaderboard fetch error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
      } finally {
        setLoading(false);
      }
    }

    fetchLeaderboard();
  }, []);

  const getRankColor = (rank: number): string => {
    if (rank === 1) return 'text-[#fbbf24]'; // gold
    if (rank === 2) return 'text-[#9ca3af]'; // silver
    if (rank === 3) return 'text-[#cd7f32]'; // bronze
    return 'text-gray-400';
  };

  const getTierBadge = (tier: string) => {
    if (tier === 'premium') {
      return (
        <span className="inline-block px-2 py-0.5 text-xs font-medium bg-blue-500/20 text-blue-400 rounded">
          Premium
        </span>
      );
    }
    if (tier === 'featured') {
      return (
        <span className="inline-block px-2 py-0.5 text-xs font-medium bg-amber-500/20 text-amber-400 rounded">
          Featured
        </span>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="flex items-center gap-2 mb-6">
          <span className="text-xl text-amber-400 font-bold">#1</span>
          <h2 className="text-xl font-bold text-white">Fastest WiFi in Las Vegas</h2>
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="flex items-center px-4 py-3 border-b border-gray-800 animate-pulse"
            >
              <div className="w-8 h-6 bg-gray-800 rounded mr-4"></div>
              <div className="flex-1">
                <div className="h-5 bg-gray-800 rounded w-48 mb-2"></div>
                <div className="h-4 bg-gray-800 rounded w-32"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl text-amber-400 font-bold">#1</span>
          <h2 className="text-xl font-bold text-white">Fastest WiFi in Las Vegas</h2>
        </div>
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    );
  }

  if (locations.length === 0) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xl text-amber-400 font-bold">#1</span>
          <h2 className="text-xl font-bold text-white">Fastest WiFi in Las Vegas</h2>
        </div>
        <p className="text-gray-400 text-center py-8">No locations tested yet.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800">
      <div className="flex items-center gap-2 p-6 pb-4">
        <span className="text-xl text-amber-400 font-bold">#1</span>
        <h2 className="text-xl font-bold text-white">Fastest WiFi in Las Vegas</h2>
      </div>

      <div className="divide-y divide-gray-800">
        {locations.map((location, index) => {
          const rank = index + 1;
          const displayName = location.business_name || `Location #${location.id.slice(0, 8)}`;

          return (
            <div
              key={location.id}
              className="flex items-center px-4 py-3 hover:bg-gray-800/50 transition-colors"
            >
              {/* Rank */}
              <div className={`w-8 text-center font-bold ${getRankColor(rank)}`}>
                #{rank}
              </div>

              {/* Location Info */}
              <div className="flex-1 min-w-0 px-3">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-white font-medium truncate">{displayName}</h3>
                  {getTierBadge(location.tier)}
                </div>

                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500">↓</span>
                    <span className="text-green-400 font-semibold">
                      {location.avg_download_mbps.toFixed(1)} Mbps
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-gray-500">↑</span>
                    <span className="text-purple-400">
                      {location.avg_upload_mbps.toFixed(1)} Mbps
                    </span>
                  </div>
                  <span className="text-gray-500 text-xs">
                    {location.test_count} test{location.test_count !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              {/* See on Map */}
              {onSelectLocation && (
                <button
                  onClick={() => onSelectLocation(location)}
                  className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors whitespace-nowrap"
                >
                  See on Map
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
