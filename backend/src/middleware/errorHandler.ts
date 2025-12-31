import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ErrorResponses } from '../utils/response';

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function errorHandler(err: Error, req: Request, res: Response): void {
  // Log error in development
  if (process.env.NODE_ENV !== 'production') {
    console.error('❌ Error:', err);
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const details = err.errors.map(e => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return ErrorResponses.validation(res, details);
  }

  // Handle custom API errors
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
  }

  // Handle PostgreSQL errors
  const pgError = err as Error & { code?: string };
  if (err.name === 'PostgresError' || pgError.code) {
    // Unique constraint violation
    if (pgError.code === '23505') {
      return ErrorResponses.conflict(res, 'Resource already exists');
    }

    // Foreign key violation
    if (pgError.code === '23503') {
      return ErrorResponses.validation(res, {
        message: 'Referenced resource does not exist',
      });
    }

    // Log unknown database errors
    console.error('Database error:', pgError);
  }

  // Default to 500 internal server error
  return ErrorResponses.internal(
    res,
    process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message
  );
}

/**
 * Async handler wrapper
 * Catches errors in async route handlers
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
