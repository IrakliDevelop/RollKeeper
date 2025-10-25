import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { 
  hashPassword, 
  generateAccessToken, 
  generateRefreshToken,
  validateEmail,
  validatePassword,
  validateUsername,
  type AuthUser 
} from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, username, password, displayName } = body;

    // Validate input
    if (!email || !username || !password) {
      return NextResponse.json(
        { error: 'Email, username, and password are required' },
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

    // Validate username
    const usernameValidation = validateUsername(username);
    if (!usernameValidation.isValid) {
      return NextResponse.json(
        { error: 'Invalid username', details: usernameValidation.errors },
        { status: 400 }
      );
    }

    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return NextResponse.json(
        { error: 'Invalid password', details: passwordValidation.errors },
        { status: 400 }
      );
    }

    // Check if user already exists
    const { data: existingUsers, error: checkError } = await supabaseAdmin
      .from('users')
      .select('id, email, username')
      .or(`email.eq.${email},username.eq.${username}`);

    if (checkError) {
      console.error('Database error checking existing users:', checkError);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }

    if (existingUsers && existingUsers.length > 0) {
      const existingUser = existingUsers[0];
      if (existingUser.email === email) {
        return NextResponse.json(
          { error: 'Email already registered' },
          { status: 409 }
        );
      }
      if (existingUser.username === username) {
        return NextResponse.json(
          { error: 'Username already taken' },
          { status: 409 }
        );
      }
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const { data: newUser, error: createError } = await supabaseAdmin
      .from('users')
      .insert({
        email: email.toLowerCase(),
        username: username.toLowerCase(),
        password_hash: passwordHash,
        display_name: displayName || null,
        is_dm: false,
        preferences: {},
      })
      .select()
      .single();

    if (createError) {
      console.error('Database error creating user:', createError);
      return NextResponse.json(
        { error: 'Failed to create user account' },
        { status: 500 }
      );
    }

    // Create auth user object
    const authUser: AuthUser = {
      id: newUser.id,
      email: newUser.email,
      username: newUser.username,
      displayName: newUser.display_name,
      isDM: newUser.is_dm,
      avatarUrl: newUser.avatar_url,
    };

    // Generate tokens
    const accessToken = generateAccessToken(authUser);
    const refreshToken = generateRefreshToken(newUser.id);

    // Update last login
    await supabaseAdmin
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', newUser.id);

    return NextResponse.json({
      user: authUser,
      accessToken,
      refreshToken,
      message: 'Account created successfully',
    });

  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
