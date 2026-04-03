import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

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

    const sql = getDb();
    if (!sql) {
      console.warn('Database not configured, skipping save');
      return NextResponse.json({ success: true, id: null, warning: 'Database not configured' });
    }

    const rows = await sql`
      SELECT insert_speed_test(
        ${user_id || null},
        ${download_mbps},
        ${upload_mbps || 0},
        ${latency_ms || 0},
        ${jitter_ms || 0},
        ${latitude},
        ${longitude},
        ${is_public_wifi || false},
        ${ssid_hash || null},
        ${network_type || 'unknown'}
      ) AS id
    `;

    return NextResponse.json({ success: true, id: rows[0]?.id });
  } catch (err) {
    console.error('Results API error:', err);
    return NextResponse.json({ error: 'Failed to save result' }, { status: 500 });
  }
}
