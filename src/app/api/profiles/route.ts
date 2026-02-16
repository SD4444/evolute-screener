import { NextRequest, NextResponse } from 'next/server';

// Profiles are now stored client-side in localStorage
// This API is kept for compatibility but returns empty data

export async function GET() {
  return NextResponse.json([]);
}

export async function POST(request: NextRequest) {
  const data = await request.json();
  return NextResponse.json({ success: true, data });
}

export async function DELETE(request: NextRequest) {
  return NextResponse.json({ success: true });
}
