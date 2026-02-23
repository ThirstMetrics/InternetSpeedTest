import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const supabase = getSupabase();
    if (!supabase) {
      // Database not configured — return empty
      return NextResponse.json({ locations: [] });
    }

    const { searchParams } = new URL(request.url);
    const lat = parseFloat(searchParams.get('lat') || '36.1699');
    const lng = parseFloat(searchParams.get('lng') || '-115.1398');
    const radiusMiles = parseFloat(searchParams.get('radius') || '10');
    const publicOnly = searchParams.get('public') !== 'false';

    const radiusMeters = radiusMiles * 1609.34;

    const { data, error } = await supabase.rpc('get_nearby_locations', {
      p_latitude: lat,
      p_longitude: lng,
      p_radius_meters: radiusMeters,
      p_public_only: publicOnly,
    });

    if (error) {
      console.error('Supabase query error:', error);
      return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 });
    }

    return NextResponse.json({ locations: data || [] });
  } catch (err) {
    console.error('Locations API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
