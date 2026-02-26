import { Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { AuthRequest } from '../types';
import { ErrorResponses } from '../utils/response';
import { pool } from '../db/connection';

// Initialize Supabase client (for auth validation only)
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_ANON_KEY || ''
);

/**
 * Find or create a user profile in our database based on Supabase auth user.
 * This ensures every authenticated user has a row in user_profiles.
 */
async function findOrCreateProfile(
  supabaseUid: string,
  email: string
): Promise<{ id: string; role: string }> {
  // Try to find existing profile
  const existing = await pool.query(
    'SELECT id, role FROM user_profiles WHERE supabase_uid = $1',
    [supabaseUid]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0];
  }

  // Auto-create profile on first login
  const created = await pool.query(
    `INSERT INTO user_profiles (supabase_uid, email, display_name, role)
     VALUES ($1, $2, $3, 'player')
     RETURNING id, role`,
    [supabaseUid, email, email.split('@')[0]]
  );

  return created.rows[0];
}

/**
 * Authentication middleware
 * Validates Supabase JWT token, then looks up user in our own user_profiles table.
 */
export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
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

    // Look up or create profile in our own database
    const profile = await findOrCreateProfile(user.id, user.email || '');

    // Attach our user (not Supabase's) to request
    req.user = {
      id: profile.id,
      supabaseUid: user.id,
      email: user.email || '',
      role: profile.role || 'player',
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
  _res: Response,
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
      const profile = await findOrCreateProfile(user.id, user.email || '');
      req.user = {
        id: profile.id,
        supabaseUid: user.id,
        email: user.email || '',
        role: profile.role || 'player',
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

/**
 * Campaign ownership middleware
 * Checks that the authenticated user is the DM of the campaign in the route params
 */
export async function requireCampaignDm(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      return ErrorResponses.unauthorized(res, 'Authentication required');
    }

    const campaignId = req.params.id || req.params.campaignId;
    if (!campaignId) {
      return ErrorResponses.validation(res, {
        message: 'Campaign ID required',
      });
    }

    const result = await pool.query(
      'SELECT dm_id FROM campaigns WHERE id = $1',
      [campaignId]
    );

    if (result.rows.length === 0) {
      return ErrorResponses.notFound(res, 'Campaign not found');
    }

    if (result.rows[0].dm_id !== req.user.id) {
      return ErrorResponses.forbidden(
        res,
        'Only the DM can perform this action'
      );
    }

    next();
  } catch (error) {
    console.error('Campaign DM check error:', error);
    return ErrorResponses.internal(res);
  }
}

/**
 * Campaign membership middleware
 * Checks that the authenticated user is a member of the campaign (or its DM)
 */
export async function requireCampaignAccess(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      return ErrorResponses.unauthorized(res, 'Authentication required');
    }

    const campaignId = req.params.id || req.params.campaignId;
    if (!campaignId) {
      return ErrorResponses.validation(res, {
        message: 'Campaign ID required',
      });
    }

    // Check if user is the DM
    const dmCheck = await pool.query(
      'SELECT id FROM campaigns WHERE id = $1 AND dm_id = $2',
      [campaignId, req.user.id]
    );

    if (dmCheck.rows.length > 0) {
      return next();
    }

    // Check if user is a member
    const memberCheck = await pool.query(
      `SELECT id FROM campaign_members
       WHERE campaign_id = $1 AND user_id = $2 AND status = 'active'`,
      [campaignId, req.user.id]
    );

    if (memberCheck.rows.length > 0) {
      return next();
    }

    return ErrorResponses.forbidden(
      res,
      'You are not a member of this campaign'
    );
  } catch (error) {
    console.error('Campaign access check error:', error);
    return ErrorResponses.internal(res);
  }
}
