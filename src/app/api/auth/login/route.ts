import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { 
  verifyPassword, 
  generateAccessToken, 
  generateRefreshToken,
  validateEmail,
  type AuthUser 
} from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Validate email format
    if (!validateEmail(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Find user by email
    const { data: user, error: findError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .single();

    if (findError || !user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
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

    // Generate tokens
    const accessToken = generateAccessToken(authUser);
    const refreshToken = generateRefreshToken(user.id);

    // Update last login
    await supabaseAdmin
      .from('users')
      .update({ 
        last_login: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    return NextResponse.json({
      user: authUser,
      accessToken,
      refreshToken,
      message: 'Login successful',
    });

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
