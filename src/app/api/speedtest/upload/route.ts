import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  // Consume the upload body to measure upload speed, then discard
  const buffer = await request.arrayBuffer();

  return NextResponse.json({ received: buffer.byteLength, t: Date.now() }, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
