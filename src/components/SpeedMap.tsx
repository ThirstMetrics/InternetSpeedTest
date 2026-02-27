'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { getMapViewsRemaining, incrementMapViews } from '@/lib/storage';
import { apiUrl } from '@/lib/api';

interface MapLocation {
  id: string;
  latitude: number;
  longitude: number;
  avg_download_mbps: number;
  avg_upload_mbps: number;
  avg_latency_ms: number;
  test_count: number;
  business_name?: string;
  is_claimed: boolean;
  tier: string;
}

interface SpeedMapProps {
  isAuthenticated: boolean;
  onAuthRequired?: () => void;
}

function toGeoJSON(locations: MapLocation[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: locations.map((loc) => ({
      type: 'Feature' as const,
      properties: {
        download_mbps: loc.avg_download_mbps,
        upload_mbps: loc.avg_upload_mbps,
        latency_ms: loc.avg_latency_ms,
        test_count: loc.test_count,
        business_name: loc.business_name || '',
        tier: loc.tier,
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [loc.longitude, loc.latitude],
      },
    })),
  };
}

export default function SpeedMap({ isAuthenticated, onAuthRequired }: SpeedMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const mapLoaded = useRef(false);
  const locationsRef = useRef<MapLocation[]>([]);
  const [viewsRemaining, setViewsRemaining] = useState(10);
  const [gated, setGated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Push data to the map source (called from both load callback and data fetch)
  const applyLocations = useCallback((locs: MapLocation[]) => {
    if (!map.current || !mapLoaded.current) return;
    const source = map.current.getSource('speed-tests') as mapboxgl.GeoJSONSource | undefined;
    if (source) {
      source.setData(toGeoJSON(locs));
    }
  }, []);

  // Check map view gate
  useEffect(() => {
    const remaining = getMapViewsRemaining();
    setViewsRemaining(remaining);
    if (!isAuthenticated && remaining <= 0) {
      setGated(true);
    }
  }, [isAuthenticated]);

  // Track map view
  useEffect(() => {
    if (!gated && !isAuthenticated) {
      const remaining = incrementMapViews();
      setViewsRemaining(remaining);
    }
  }, [gated, isAuthenticated]);

  // Fetch locations
  useEffect(() => {
    if (gated) return;

    async function fetchLocations() {
      try {
        const url = apiUrl('/api/locations?lat=36.1699&lng=-115.1398&radius=25');
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        const locs = data.locations || [];
        locationsRef.current = locs;
        applyLocations(locs);
      } catch (err) {
        console.error('Failed to fetch locations:', err);
        setError('Could not load location data');
      } finally {
        setLoading(false);
      }
    }

    fetchLocations();
  }, [gated, applyLocations]);

  // Initialize map
  useEffect(() => {
    if (gated || !mapContainer.current || map.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      setError('Map configuration missing');
      setLoading(false);
      return;
    }

    mapboxgl.accessToken = token;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [-115.1398, 36.1699], // Las Vegas
      zoom: 11,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    map.current.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: false,
      }),
      'top-right'
    );

    map.current.on('load', () => {
      if (!map.current) return;
      mapLoaded.current = true;

      map.current.addSource('speed-tests', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Heatmap layer (zoomed out)
      map.current.addLayer({
        id: 'speed-heatmap',
        type: 'heatmap',
        source: 'speed-tests',
        maxzoom: 15,
        paint: {
          'heatmap-weight': [
            'interpolate', ['linear'], ['get', 'download_mbps'],
            0, 0, 25, 0.3, 50, 0.5, 100, 0.8, 200, 1,
          ],
          'heatmap-intensity': [
            'interpolate', ['linear'], ['zoom'],
            0, 1, 15, 3,
          ],
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(0,0,0,0)',
            0.1, '#3b0764',
            0.3, '#7c3aed',
            0.5, '#3b82f6',
            0.7, '#10b981',
            0.9, '#f59e0b',
            1, '#ef4444',
          ],
          'heatmap-radius': [
            'interpolate', ['linear'], ['zoom'],
            0, 2, 15, 30,
          ],
          'heatmap-opacity': [
            'interpolate', ['linear'], ['zoom'],
            13, 1, 15, 0,
          ],
        },
      });

      // Point layer (zoomed in)
      map.current.addLayer({
        id: 'speed-points',
        type: 'circle',
        source: 'speed-tests',
        minzoom: 13,
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            13, 4, 18, 12,
          ],
          'circle-color': [
            'interpolate', ['linear'], ['get', 'download_mbps'],
            0, '#ef4444',
            25, '#f59e0b',
            50, '#3b82f6',
            100, '#10b981',
            200, '#10b981',
          ],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1,
          'circle-opacity': [
            'interpolate', ['linear'], ['zoom'],
            13, 0, 14, 1,
          ],
        },
      });

      // Popup on click
      map.current.on('click', 'speed-points', (e) => {
        if (!e.features?.length || !map.current) return;
        const feature = e.features[0];
        const props = feature.properties;
        const coords = (feature.geometry as GeoJSON.Point).coordinates as [number, number];

        new mapboxgl.Popup({ closeButton: true, maxWidth: '240px' })
          .setLngLat(coords)
          .setHTML(`
            <div style="color: #fff; font-family: system-ui;">
              ${props?.business_name ? `<strong>${props.business_name}</strong><br/>` : ''}
              <span style="color: #10b981; font-size: 18px; font-weight: 700;">${props?.download_mbps} Mbps</span>
              <span style="color: #999; font-size: 12px;"> down</span><br/>
              <span style="color: #8b5cf6;">${props?.upload_mbps} Mbps</span>
              <span style="color: #999; font-size: 12px;"> up</span><br/>
              <span style="color: #999; font-size: 12px;">${props?.test_count} test(s) &middot; ${props?.latency_ms}ms ping</span>
            </div>
          `)
          .addTo(map.current);
      });

      map.current.on('mouseenter', 'speed-points', () => {
        if (map.current) map.current.getCanvas().style.cursor = 'pointer';
      });
      map.current.on('mouseleave', 'speed-points', () => {
        if (map.current) map.current.getCanvas().style.cursor = '';
      });

      // Apply any locations that arrived before map loaded
      if (locationsRef.current.length > 0) {
        applyLocations(locationsRef.current);
      }

      setLoading(false);
    });

    map.current.on('error', (e) => {
      console.error('Mapbox error:', e.error);
    });

    return () => {
      mapLoaded.current = false;
      map.current?.remove();
      map.current = null;
    };
  }, [gated, applyLocations]);

  // Gated view
  if (gated) {
    return (
      <div className="flex flex-col items-center justify-center h-96 bg-gray-900 rounded-xl border border-gray-800 gap-4 p-8">
        <div className="text-4xl">&#x1F5FA;</div>
        <h3 className="text-lg font-semibold text-white">Free map views used up</h3>
        <p className="text-sm text-gray-400 text-center max-w-xs">
          Sign up for a free account to get unlimited map access and save your favorite fast WiFi locations.
        </p>
        <button
          onClick={onAuthRequired}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-medium transition-colors"
        >
          Sign Up Free
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full">
      {/* Views remaining badge */}
      {!isAuthenticated && viewsRemaining > 0 && (
        <div className="absolute top-3 left-3 z-10 bg-gray-900/80 backdrop-blur px-3 py-1 rounded-full text-xs text-gray-300">
          {viewsRemaining} free map views remaining
        </div>
      )}

      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-900/50">
          <div className="text-gray-400 text-sm">Loading map...</div>
        </div>
      )}

      {error && (
        <div className="absolute top-3 right-3 z-10 bg-red-900/80 backdrop-blur px-3 py-1 rounded-full text-xs text-red-300">
          {error}
        </div>
      )}

      <div
        ref={mapContainer}
        className="w-full h-96 sm:h-[500px] rounded-xl overflow-hidden border border-gray-800"
      />

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-3 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500" /> Slow
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-500" /> Medium
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-500" /> Fast
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500" /> Very Fast
        </span>
      </div>
    </div>
  );
}
