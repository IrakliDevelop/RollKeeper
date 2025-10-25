import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { 
  verifyRefreshToken, 
  generateAccessToken, 
  generateRefreshToken,
  type AuthUser 
} from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { refreshToken } = body;

    // Validate input
    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Refresh token is required' },
        { status: 400 }
      );
    }

    // Verify refresh token
    const payload = verifyRefreshToken(refreshToken);
    if (!payload) {
      return NextResponse.json(
        { error: 'Invalid or expired refresh token' },
        { status: 401 }
      );
    }

    // Find user by ID
    const { data: user, error: findError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', payload.userId)
      .single();

    if (findError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 401 }
      );
    }

    // Create auth user object
    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.display_name,
      isDM: user.is_dm,
      avatarUrl: user.avatar_url,
    };

    // Generate new tokens
    const newAccessToken = generateAccessToken(authUser);
    const newRefreshToken = generateRefreshToken(user.id, payload.tokenVersion);

    return NextResponse.json({
      user: authUser,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
