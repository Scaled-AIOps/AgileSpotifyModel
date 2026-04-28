/**
 * Purpose: Global error handler + `createError` helper.
 * Usage:   Mounted last via `app.use(errorHandler)`. Services throw `createError(msg, code)` to short-circuit out of a request with a specific HTTP status.
 * Goal:    Hide internal stack traces from clients (returns `Internal server error` for 500s, exact message otherwise) and keep error response shape uniform.
 * ToDo:    Add a request-id correlator so 500 logs can be matched to client reports.
 */
import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
}

export function errorHandler(err: AppError, _req: Request, res: Response, _next: NextFunction): void {
  const status = err.statusCode ?? 500;
  const message = status === 500 ? 'Internal server error' : err.message;
  if (status === 500) console.error('[Error]', err);
  res.status(status).json({ error: message });
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Not found' });
}

export function createError(message: string, statusCode: number): AppError {
  const err: AppError = new Error(message);
  err.statusCode = statusCode;
  return err;
}
