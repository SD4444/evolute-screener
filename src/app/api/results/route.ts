import { NextRequest, NextResponse } from 'next/server';

// Results are now stored client-side in localStorage
// This API is kept for compatibility but returns empty data

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const clientName = searchParams.get('client');
  
  return NextResponse.json([]);
}

export async function DELETE(request: NextRequest) {
  return NextResponse.json({ success: true, deleted: 0 });
}
