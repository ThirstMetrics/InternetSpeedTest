'use client';

import { useState, useEffect, useCallback } from 'react';
import { getSupabase } from '@/lib/supabase';
import SpeedTest from '@/components/SpeedTest';
import SpeedMap from '@/components/SpeedMap';
import AuthModal from '@/components/AuthModal';
import TestHistory from '@/components/TestHistory';
import { saveTestToHistory } from '@/components/TestHistory';
import Leaderboard from '@/components/Leaderboard';
import type { SpeedTestState, GeoPosition } from '@/types';

type Tab = 'test' | 'map';

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('test');
  const [user, setUser] = useState<any>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Check auth state on mount
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUser(data.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
  };

  const handleTestComplete = useCallback((result: SpeedTestState, position: GeoPosition) => {
    // Save to local history for guest users
    saveTestToHistory({
      download_mbps: result.download_mbps,
      upload_mbps: result.upload_mbps,
      latency_ms: result.latency_ms,
      jitter_ms: result.jitter_ms,
      latitude: position.latitude,
      longitude: position.longitude,
      created_at: new Date().toISOString(),
    });
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-sm">
              ST
            </div>
            <h1 className="text-lg font-semibold">SpeedTest</h1>
          </div>
          <nav className="flex items-center gap-1 bg-gray-900 rounded-full p-1">
            <button
              onClick={() => setActiveTab('test')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeTab === 'test'
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Test
            </button>
            <button
              onClick={() => setActiveTab('map')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeTab === 'map'
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Map
            </button>
          </nav>
          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400 hidden sm:block">{user.email}</span>
              <button
                onClick={handleSignOut}
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAuthModalOpen(true)}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {activeTab === 'test' ? (
          <div className="flex flex-col items-center gap-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Test Your Internet Speed</h2>
              <p className="text-gray-400 text-sm">
                Results are shared on the map to help others find fast public WiFi
              </p>
            </div>
            <SpeedTest onComplete={handleTestComplete} />

            {/* History & Leaderboard below the test */}
            <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
              <div>
                <h3 className="text-lg font-semibold mb-3">Your History</h3>
                <TestHistory userId={user?.id} />
              </div>
              <div>
                <Leaderboard
                  onSelectLocation={() => setActiveTab('map')}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-2">Fast WiFi Near You</h2>
              <p className="text-gray-400 text-sm">
                Public WiFi speeds tested by the community
              </p>
            </div>
            <SpeedMap
              isAuthenticated={!!user}
              onAuthRequired={() => setAuthModalOpen(true)}
            />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-auto">
        <div className="max-w-4xl mx-auto px-4 py-4 text-center text-xs text-gray-600">
          SpeedTest by ThirstMetrics &middot; Las Vegas, NV
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={(authUser) => setUser(authUser)}
      />
    </div>
  );
}
