import { Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { AuthRequest } from '../types';
import { ErrorResponses } from '../utils/response';

// Initialize Supabase client (for auth validation only)
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

/**
 * Authentication middleware
 * Validates Supabase JWT token and attaches user to request
 */
export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return ErrorResponses.unauthorized(
        res,
        'Missing or invalid authorization header'
      );
    }

    const token = authHeader.split('Bearer ')[1];

    if (!token) {
      return ErrorResponses.unauthorized(res, 'No token provided');
    }

    // Validate token with Supabase
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.error('Auth error:', error);
      return ErrorResponses.unauthorized(res, 'Invalid or expired token');
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email || '',
      role: user.user_metadata?.role || 'player',
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return ErrorResponses.unauthorized(res, 'Authentication failed');
  }
}

/**
 * Optional authentication middleware
 * Attaches user if token is valid, but doesn't require it
 */
export async function optionalAuthMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split('Bearer ')[1];

    if (!token) {
      return next();
    }

    const {
      data: { user },
    } = await supabase.auth.getUser(token);

    if (user) {
      req.user = {
        id: user.id,
        email: user.email || '',
        role: user.user_metadata?.role || 'player',
      };
    }

    next();
  } catch {
    next();
  }
}

/**
 * Role-based authorization middleware
 * Requires user to have specific role(s)
 */
export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return ErrorResponses.unauthorized(res, 'Authentication required');
    }

    if (!roles.includes(req.user.role || '')) {
      return ErrorResponses.forbidden(
        res,
        `Access denied. Required roles: ${roles.join(', ')}`
      );
    }

    next();
  };
}
