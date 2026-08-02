import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { logger } from '../config/logger';
import { AppError } from '../errors/AppError';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 400,
        message: 'Invalid request parameters',
        details: err.flatten(),
      },
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: { code: err.statusCode, message: err.message },
    });
    return;
  }

  if (isBodyParseError(err)) {
    res.status(400).json({
      error: { code: 400, message: 'Invalid JSON in request body' },
    });
    return;
  }

  logger.error({ err }, 'Unhandled error');
  res.status(500).json({
    error: { code: 500, message: 'Internal server error' },
  });
}

function isBodyParseError(err: unknown): err is Error & { status: number } {
  return err instanceof SyntaxError && (err as { status?: number }).status === 400;
}
