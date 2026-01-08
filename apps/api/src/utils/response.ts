import { Response } from 'express';
import { ApiResponse } from '../types';

/**
 * Send successful API response
 */
export function sendSuccess<T>(res: Response, data: T, statusCode = 200): void {
  const response: ApiResponse<T> = {
    success: true,
    data,
  };
  res.status(statusCode).json(response);
}

/**
 * Send error API response
 */
export function sendError(
  res: Response,
  code: string,
  message: string,
  statusCode = 400,
  details?: unknown
): void {
  const response: ApiResponse = {
    success: false,
    error: {
      code,
      message,
      details,
    },
  };
  res.status(statusCode).json(response);
}

/**
 * Common error responses
 */
export const ErrorResponses = {
  unauthorized: (res: Response, message = 'Unauthorized') =>
    sendError(res, 'UNAUTHORIZED', message, 401),

  forbidden: (res: Response, message = 'Forbidden') =>
    sendError(res, 'FORBIDDEN', message, 403),

  notFound: (res: Response, message = 'Resource not found') =>
    sendError(res, 'NOT_FOUND', message, 404),

  validation: (res: Response, details: unknown) =>
    sendError(res, 'VALIDATION_ERROR', 'Invalid input', 400, details),

  internal: (res: Response, message = 'Internal server error') =>
    sendError(res, 'INTERNAL_ERROR', message, 500),

  conflict: (res: Response, message = 'Resource already exists') =>
    sendError(res, 'CONFLICT', message, 409),
};
