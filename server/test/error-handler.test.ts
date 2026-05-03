import { describe, it, expect } from 'vitest';
import { AppError } from '../src/middleware/error-handler.js';

describe('AppError', () => {
  it('creates an AppError with status and code', () => {
    const err = new AppError(404, 'NOT_FOUND', 'Report not found');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('Report not found');
  });

  it('sets name to AppError', () => {
    const err = new AppError(400, 'BAD_REQUEST', 'nope');
    expect(err.name).toBe('AppError');
  });

  it('accepts optional details', () => {
    const err = new AppError(422, 'INVALID', 'invalid', { fields: ['name'] });
    expect(err.details).toEqual({ fields: ['name'] });
  });
});
