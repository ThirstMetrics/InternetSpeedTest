import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  // Consume the upload body to measure upload speed, then discard
  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const size = file ? file.size : 0;

  return NextResponse.json({ received: size, t: Date.now() }, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
