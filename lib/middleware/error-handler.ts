import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export class AppError extends Error {
  statusCode: number;
  code: string;
  details?: unknown;
  isOperational: boolean;
  constructor(message: string, statusCode = 500, code = 'INTERNAL', details?: unknown, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;
  }
  static badRequest(message = 'Bad Request', details?: unknown) { return new AppError(message, 400, 'BAD_REQUEST', details); }
  static unauthorized(message = 'Unauthorized', details?: unknown) { return new AppError(message, 401, 'UNAUTHORIZED', details); }
  static forbidden(message = 'Forbidden', details?: unknown) { return new AppError(message, 403, 'FORBIDDEN', details); }
  static notFound(message = 'Not Found', details?: unknown) { return new AppError(message, 404, 'NOT_FOUND', details); }
  static internal(message = 'Internal Server Error', details?: unknown) { return new AppError(message, 500, 'INTERNAL', details); }
}

export interface ErrorResponse {
  status: 'error';
  code: string;
  message: string;
  details?: unknown;
  requestId: string;
  timestamp: string;
}

export function errorHandler(error: Error, req: Request, res: Response, next: NextFunction) {
  const appErr = error instanceof AppError ? error : AppError.internal('Unexpected error');
  const requestId = (req.headers?.['x-request-id'] as string) || '';
  const payload: ErrorResponse = {
    status: 'error',
    code: appErr.code,
    message: process.env.NODE_ENV === 'production' ? appErr.message : `${appErr.message}`,
    details: process.env.NODE_ENV === 'production' ? undefined : appErr.details,
    requestId,
    timestamp: new Date().toISOString()
  };
  logger.error('API error', { code: payload.code, requestId, message: appErr.message });
  res.status(appErr.statusCode).json(payload);
}

export function asyncHandler(handler: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await handler(req, res, next);
    } catch (err) {
      next(err);
    }
  };
}
