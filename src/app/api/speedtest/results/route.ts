import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      download_mbps,
      upload_mbps,
      latency_ms,
      jitter_ms,
      latitude,
      longitude,
      is_public_wifi,
      ssid_hash,
      network_type,
      user_id,
    } = body;

    if (!download_mbps || !latitude || !longitude) {
      return NextResponse.json(
        { error: 'Missing required fields: download_mbps, latitude, longitude' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    if (!supabase) {
      // Database not configured yet — accept but don't persist
      console.warn('Supabase not configured, skipping save');
      return NextResponse.json({ success: true, id: null, warning: 'Database not configured' });
    }

    const { data, error } = await supabase.rpc('insert_speed_test', {
      p_user_id: user_id || null,
      p_download_mbps: download_mbps,
      p_upload_mbps: upload_mbps || 0,
      p_latency_ms: latency_ms || 0,
      p_jitter_ms: jitter_ms || 0,
      p_latitude: latitude,
      p_longitude: longitude,
      p_is_public_wifi: is_public_wifi || false,
      p_ssid_hash: ssid_hash || null,
      p_network_type: network_type || 'unknown',
    });

    if (error) {
      console.error('Supabase insert error:', error);
      return NextResponse.json({ error: 'Failed to save result' }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data });
  } catch (err) {
    console.error('Results API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
