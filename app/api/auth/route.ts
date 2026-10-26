import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { pin } = await request.json();
    const expectedPin = process.env.FAMILY_PIN || '1234';

    if (!pin || String(pin).trim() !== String(expectedPin).trim()) {
      return NextResponse.json(
        { success: false, error: 'Incorrect PIN. Please try again.' },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      success: true,
      message: 'Access granted',
    });

    // 1-year persistent session cookie for family devices
    response.cookies.set({
      name: 'streampulse_auth',
      value: 'authorized',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 31536000, // 365 days
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: 'Failed to authenticate' },
      { status: 400 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true, message: 'Logged out' });
  response.cookies.delete('streampulse_auth');
  return response;
}
