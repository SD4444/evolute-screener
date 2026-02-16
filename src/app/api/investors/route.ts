import { NextRequest, NextResponse } from 'next/server';

// Investors are now managed client-side
// This API is kept for compatibility

export async function GET() {
  return NextResponse.json([]);
}

export async function POST(request: NextRequest) {
  const data = await request.json();
  return NextResponse.json({ success: true, data });
}
