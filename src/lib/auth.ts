import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;

if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error('Missing JWT environment variables');
}

export interface JWTPayload {
  userId: string;
  email: string;
  username: string;
  isDM: boolean;
  iat: number;
  exp: number;
}

export interface RefreshTokenPayload {
  userId: string;
  tokenVersion: number;
  iat: number;
  exp: number;
}

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  displayName: string | null;
  isDM: boolean;
  avatarUrl: string | null;
}

// Hash password
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

// Verify password
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Generate access token (15 minutes)
export function generateAccessToken(user: AuthUser): string {
  const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
    userId: user.id,
    email: user.email,
    username: user.username,
    isDM: user.isDM,
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '15m',
  });
}

// Generate refresh token (7 days)
export function generateRefreshToken(userId: string, tokenVersion: number = 0): string {
  const payload: Omit<RefreshTokenPayload, 'iat' | 'exp'> = {
    userId,
    tokenVersion,
  };

  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: '7d',
  });
}

// Verify access token
export function verifyAccessToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    return null;
  }
}

// Verify refresh token
export function verifyRefreshToken(token: string): RefreshTokenPayload | null {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET) as RefreshTokenPayload;
  } catch (error) {
    return null;
  }
}

// Extract token from request
export function extractTokenFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;

  return parts[1];
}

// Middleware to protect API routes
export function withAuth<T extends Record<string, unknown>>(
  handler: (request: NextRequest, context: T & { user: JWTPayload }) => Promise<Response>
) {
  return async (request: NextRequest, context: T): Promise<Response> => {
    const token = extractTokenFromRequest(request);

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const payload = verifyAccessToken(token);
    if (!payload) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return handler(request, { ...context, user: payload });
  };
}

// Password validation
export function validatePassword(password: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// Email validation
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Username validation
export function validateUsername(username: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (username.length < 3) {
    errors.push('Username must be at least 3 characters long');
  }

  if (username.length > 20) {
    errors.push('Username must be no more than 20 characters long');
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    errors.push('Username can only contain letters, numbers, underscores, and hyphens');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
