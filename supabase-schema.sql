-- SpeedTest Database Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)

-- 1. Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Speed test results table
CREATE TABLE speed_tests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  download_mbps DECIMAL(10, 2) NOT NULL,
  upload_mbps DECIMAL(10, 2) NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  jitter_ms INTEGER NOT NULL DEFAULT 0,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  latitude DECIMAL(10, 6) NOT NULL,
  longitude DECIMAL(10, 6) NOT NULL,
  is_public_wifi BOOLEAN NOT NULL DEFAULT false,
  ssid_hash TEXT,
  network_type TEXT NOT NULL DEFAULT 'unknown',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Location aggregates table (materialized from speed_tests)
CREATE TABLE locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  latitude DECIMAL(10, 6) NOT NULL,
  longitude DECIMAL(10, 6) NOT NULL,
  avg_download_mbps DECIMAL(10, 2) NOT NULL DEFAULT 0,
  avg_upload_mbps DECIMAL(10, 2) NOT NULL DEFAULT 0,
  avg_latency_ms INTEGER NOT NULL DEFAULT 0,
  test_count INTEGER NOT NULL DEFAULT 0,
  business_name TEXT,
  business_address TEXT,
  business_phone TEXT,
  business_website TEXT,
  business_place_id TEXT,
  is_claimed BOOLEAN NOT NULL DEFAULT false,
  claimed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'featured', 'premium')),
  last_tested_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. User profiles (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  map_views_used INTEGER NOT NULL DEFAULT 0,
  map_views_reset_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Indexes for performance
CREATE INDEX idx_speed_tests_location ON speed_tests USING GIST (location);
CREATE INDEX idx_speed_tests_public ON speed_tests (is_public_wifi) WHERE is_public_wifi = true;
CREATE INDEX idx_speed_tests_created ON speed_tests (created_at DESC);
CREATE INDEX idx_locations_location ON locations USING GIST (location);
CREATE INDEX idx_locations_tier ON locations (tier);
CREATE INDEX idx_locations_download ON locations (avg_download_mbps DESC);

-- 6. Function: Insert a speed test and auto-update location aggregate
CREATE OR REPLACE FUNCTION insert_speed_test(
  p_user_id UUID DEFAULT NULL,
  p_download_mbps DECIMAL DEFAULT 0,
  p_upload_mbps DECIMAL DEFAULT 0,
  p_latency_ms INTEGER DEFAULT 0,
  p_jitter_ms INTEGER DEFAULT 0,
  p_latitude DECIMAL DEFAULT 0,
  p_longitude DECIMAL DEFAULT 0,
  p_is_public_wifi BOOLEAN DEFAULT false,
  p_ssid_hash TEXT DEFAULT NULL,
  p_network_type TEXT DEFAULT 'unknown'
)
RETURNS UUID AS $$
DECLARE
  v_test_id UUID;
  v_point GEOGRAPHY;
  v_location_id UUID;
BEGIN
  -- Create the geography point
  v_point := ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography;

  -- Insert the speed test
  INSERT INTO speed_tests (
    user_id, download_mbps, upload_mbps, latency_ms, jitter_ms,
    location, latitude, longitude, is_public_wifi, ssid_hash, network_type
  ) VALUES (
    p_user_id, p_download_mbps, p_upload_mbps, p_latency_ms, p_jitter_ms,
    v_point, p_latitude, p_longitude, p_is_public_wifi, p_ssid_hash, p_network_type
  ) RETURNING id INTO v_test_id;

  -- Find or create a nearby location aggregate (within 50 meters)
  SELECT id INTO v_location_id
  FROM locations
  WHERE ST_DWithin(location, v_point, 50) -- 50 meters
  ORDER BY ST_Distance(location, v_point)
  LIMIT 1;

  IF v_location_id IS NULL THEN
    -- Create new location
    INSERT INTO locations (
      location, latitude, longitude,
      avg_download_mbps, avg_upload_mbps, avg_latency_ms,
      test_count, last_tested_at
    ) VALUES (
      v_point, p_latitude, p_longitude,
      p_download_mbps, p_upload_mbps, p_latency_ms,
      1, now()
    );
  ELSE
    -- Update existing location aggregate with running average
    UPDATE locations
    SET
      avg_download_mbps = ((avg_download_mbps * test_count) + p_download_mbps) / (test_count + 1),
      avg_upload_mbps = ((avg_upload_mbps * test_count) + p_upload_mbps) / (test_count + 1),
      avg_latency_ms = ((avg_latency_ms * test_count) + p_latency_ms) / (test_count + 1),
      test_count = test_count + 1,
      last_tested_at = now()
    WHERE id = v_location_id;
  END IF;

  RETURN v_test_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Function: Get nearby locations for the map
CREATE OR REPLACE FUNCTION get_nearby_locations(
  p_latitude DECIMAL DEFAULT 36.1699,
  p_longitude DECIMAL DEFAULT -115.1398,
  p_radius_meters DECIMAL DEFAULT 16093, -- 10 miles
  p_public_only BOOLEAN DEFAULT true
)
RETURNS TABLE (
  id UUID,
  latitude DECIMAL,
  longitude DECIMAL,
  avg_download_mbps DECIMAL,
  avg_upload_mbps DECIMAL,
  avg_latency_ms INTEGER,
  test_count INTEGER,
  business_name TEXT,
  is_claimed BOOLEAN,
  tier TEXT,
  last_tested_at TIMESTAMPTZ,
  distance_meters DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    l.latitude,
    l.longitude,
    l.avg_download_mbps,
    l.avg_upload_mbps,
    l.avg_latency_ms,
    l.test_count,
    l.business_name,
    l.is_claimed,
    l.tier,
    l.last_tested_at,
    ST_Distance(
      l.location,
      ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography
    ) AS distance_meters
  FROM locations l
  WHERE ST_DWithin(
    l.location,
    ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography,
    p_radius_meters
  )
  ORDER BY l.avg_download_mbps DESC
  LIMIT 200;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Row Level Security
ALTER TABLE speed_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Everyone can read public speed tests and locations
CREATE POLICY "Anyone can read speed tests"
  ON speed_tests FOR SELECT
  USING (true);

CREATE POLICY "Anyone can read locations"
  ON locations FOR SELECT
  USING (true);

-- Authenticated users can insert speed tests
CREATE POLICY "Anyone can insert speed tests"
  ON speed_tests FOR INSERT
  WITH CHECK (true);

-- Profiles are readable by the owner
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- 9. Auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
