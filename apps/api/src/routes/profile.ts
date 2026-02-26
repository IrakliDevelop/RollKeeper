import { Router, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { sendSuccess } from '../utils/response';
import { AuthRequest } from '../types';
import { pool } from '../db/connection';

const router = Router();

/**
 * GET /api/profile
 * Get the authenticated user's profile
 */
router.get(
  '/',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const result = await pool.query(
      'SELECT * FROM user_profiles WHERE id = $1',
      [req.user!.id]
    );
    sendSuccess(res, { profile: result.rows[0] });
  })
);

/**
 * PUT /api/profile
 * Update the authenticated user's profile
 */
router.put(
  '/',
  authMiddleware,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { username, display_name, role } = req.body;

    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (username !== undefined) {
      fields.push(`username = $${paramIndex++}`);
      values.push(username);
    }
    if (display_name !== undefined) {
      fields.push(`display_name = $${paramIndex++}`);
      values.push(display_name);
    }
    if (role !== undefined && ['player', 'dm', 'both'].includes(role)) {
      fields.push(`role = $${paramIndex++}`);
      values.push(role);
    }

    if (fields.length === 0) {
      const current = await pool.query(
        'SELECT * FROM user_profiles WHERE id = $1',
        [req.user!.id]
      );
      return sendSuccess(res, { profile: current.rows[0] });
    }

    values.push(req.user!.id);
    const result = await pool.query(
      `UPDATE user_profiles SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    sendSuccess(res, { profile: result.rows[0] });
  })
);

export default router;
