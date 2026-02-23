'use client';

import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';

export interface HistoryEntry {
  id?: string;
  download_mbps: number;
  upload_mbps: number;
  latency_ms: number;
  jitter_ms: number;
  latitude: number;
  longitude: number;
  created_at: string;
}

interface TestHistoryProps {
  userId?: string | null;
  onSelectTest?: (test: HistoryEntry) => void;
}

const STORAGE_KEY = 'speedtest_history';
const MAX_GUEST_HISTORY = 10;

export function saveTestToHistory(entry: HistoryEntry) {
  try {
    const history = getLocalHistory();
    history.unshift(entry);
    const trimmed = history.slice(0, MAX_GUEST_HISTORY);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (error) {
    console.error('Failed to save test to history:', error);
  }
}

function getLocalHistory(): HistoryEntry[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to read history from localStorage:', error);
    return [];
  }
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function TestHistory({ userId, onSelectTest }: TestHistoryProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHistory() {
      setLoading(true);
      try {
        if (userId) {
          // Fetch from Supabase for authenticated users
          const supabase = getSupabase();
          if (!supabase) { setHistory(getLocalHistory()); setLoading(false); return; }
          const { data, error } = await supabase
            .from('speed_tests')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(20);

          if (error) {
            console.error('Failed to fetch history from Supabase:', error);
            setHistory([]);
          } else {
            setHistory(data || []);
          }
        } else {
          // Fetch from localStorage for guests
          setHistory(getLocalHistory());
        }
      } catch (error) {
        console.error('Error fetching history:', error);
        setHistory([]);
      } finally {
        setLoading(false);
      }
    }

    fetchHistory();
  }, [userId]);

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-8">
        <div className="flex items-center justify-center">
          <div className="animate-pulse text-gray-500">Loading history...</div>
        </div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-8">
        <p className="text-center text-gray-500">
          No tests yet. Run a speed test to see your history.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800">
      <div className="max-h-80 overflow-y-auto">
        {history.map((test, index) => (
          <button
            key={test.id || `${test.created_at}-${index}`}
            onClick={() => onSelectTest?.(test)}
            className="w-full px-4 py-3 border-b border-gray-800 last:border-b-0 hover:bg-gray-800/50 transition-colors text-left"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-4 mb-1">
                  <span className="text-sm font-medium text-green-400">
                    {test.download_mbps.toFixed(1)} Mbps
                  </span>
                  <span className="text-sm font-medium text-purple-400">
                    {test.upload_mbps.toFixed(1)} Mbps
                  </span>
                  <span className="text-sm font-medium text-amber-400">
                    {test.latency_ms.toFixed(0)} ms
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  {formatRelativeTime(test.created_at)}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
