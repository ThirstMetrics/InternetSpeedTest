export interface SpeedTestResult {
  id?: string;
  user_id?: string;
  download_mbps: number;
  upload_mbps: number;
  latency_ms: number;
  jitter_ms: number;
  latitude: number;
  longitude: number;
  is_public_wifi: boolean;
  ssid_hash?: string;
  network_type: 'wifi' | 'cellular' | 'ethernet' | 'unknown';
  created_at?: string;
}

export interface LocationAggregate {
  id: string;
  latitude: number;
  longitude: number;
  avg_download_mbps: number;
  avg_upload_mbps: number;
  avg_latency_ms: number;
  test_count: number;
  business_name?: string;
  business_address?: string;
  business_phone?: string;
  business_website?: string;
  is_claimed: boolean;
  tier: 'free' | 'featured' | 'premium';
  last_tested_at: string;
}

export interface SpeedTestState {
  phase: 'idle' | 'latency' | 'download' | 'upload' | 'complete';
  progress: number; // 0-100
  download_mbps: number;
  upload_mbps: number;
  latency_ms: number;
  jitter_ms: number;
  error?: string;
}

export interface GeoPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export interface MapViewState {
  center: [number, number]; // [lng, lat]
  zoom: number;
}

export interface UserProfile {
  id: string;
  email: string;
  map_views_used: number;
  map_views_reset_at: string;
  created_at: string;
}
