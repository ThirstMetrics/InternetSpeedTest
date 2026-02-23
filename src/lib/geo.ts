import type { GeoPosition } from '@/types';

const GEOFENCE_LAT = parseFloat(process.env.NEXT_PUBLIC_GEOFENCE_LAT || '36.1699');
const GEOFENCE_LNG = parseFloat(process.env.NEXT_PUBLIC_GEOFENCE_LNG || '-115.1398');
const GEOFENCE_RADIUS_MILES = parseFloat(process.env.NEXT_PUBLIC_GEOFENCE_RADIUS_MILES || '50');

export function getCurrentPosition(): Promise<GeoPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            reject(new Error('Location permission denied. Please enable location access to run a speed test.'));
            break;
          case error.POSITION_UNAVAILABLE:
            reject(new Error('Location information unavailable.'));
            break;
          case error.TIMEOUT:
            reject(new Error('Location request timed out.'));
            break;
          default:
            reject(new Error('An unknown error occurred getting location.'));
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  });
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function isWithinGeofence(latitude: number, longitude: number): boolean {
  const distance = haversineDistance(GEOFENCE_LAT, GEOFENCE_LNG, latitude, longitude);
  return distance <= GEOFENCE_RADIUS_MILES;
}

export function getDistanceFromCenter(latitude: number, longitude: number): number {
  return haversineDistance(GEOFENCE_LAT, GEOFENCE_LNG, latitude, longitude);
}

export function getNetworkType(): 'wifi' | 'cellular' | 'ethernet' | 'unknown' {
  const nav = navigator as Navigator & {
    connection?: { type?: string; effectiveType?: string };
  };

  if (nav.connection?.type) {
    switch (nav.connection.type) {
      case 'wifi':
        return 'wifi';
      case 'cellular':
        return 'cellular';
      case 'ethernet':
        return 'ethernet';
      default:
        return 'unknown';
    }
  }
  return 'unknown';
}

export function hashSSID(ssid: string): string {
  // Simple hash for privacy - we don't store the actual SSID
  let hash = 0;
  for (let i = 0; i < ssid.length; i++) {
    const char = ssid.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
