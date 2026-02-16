import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Simple auth - in production use proper auth system
const ADMIN_CREDENTIALS = {
  name: 'Simon',
  password: 'Evolute2025!'
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, password } = body;
    
    if (name === ADMIN_CREDENTIALS.name && password === ADMIN_CREDENTIALS.password) {
      // Create a simple session token
      const token = Buffer.from(`${name}:${Date.now()}`).toString('base64');
      
      // Set cookie
      const cookieStore = await cookies();
      cookieStore.set('admin_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
      });
      
      return NextResponse.json({ success: true });
    }
    
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get('admin_session');
    
    if (session?.value) {
      // Decode and check token
      const decoded = Buffer.from(session.value, 'base64').toString();
      const [name] = decoded.split(':');
      if (name === ADMIN_CREDENTIALS.name) {
        return NextResponse.json({ authenticated: true, name });
      }
    }
    
    return NextResponse.json({ authenticated: false });
  } catch {
    return NextResponse.json({ authenticated: false });
  }
}

export async function DELETE() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete('admin_session');
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 });
  }
}
