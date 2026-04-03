import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sql = getDb();
    if (!sql) {
      return NextResponse.json({ history: [] });
    }

    const data = await sql`
      SELECT id, download_mbps, upload_mbps, latency_ms, jitter_ms,
             latitude, longitude, created_at
      FROM speed_tests
      WHERE user_id = ${session.user.id}::uuid
      ORDER BY created_at DESC
      LIMIT 20
    `;

    return NextResponse.json({ history: data || [] });
  } catch (err) {
    console.error('History API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
