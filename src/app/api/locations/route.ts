import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const sql = getDb();
    if (!sql) {
      return NextResponse.json({ locations: [] });
    }

    const { searchParams } = new URL(request.url);
    const lat = parseFloat(searchParams.get('lat') || '36.1699');
    const lng = parseFloat(searchParams.get('lng') || '-115.1398');
    const radiusMiles = parseFloat(searchParams.get('radius') || '10');
    const publicOnly = searchParams.get('public') !== 'false';

    const radiusMeters = radiusMiles * 1609.34;

    const data = await sql`
      SELECT * FROM get_nearby_locations(
        ${lat},
        ${lng},
        ${radiusMeters},
        ${publicOnly}
      )
    `;

    return NextResponse.json({ locations: data || [] });
  } catch (err) {
    console.error('Locations API error:', err);
    return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 });
  }
}
