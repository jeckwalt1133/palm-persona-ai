import { describe, it, expect } from 'vitest';
import { ok, fail } from '../src/utils/response.js';

describe('response helpers', () => {
  it('ok wraps data with success', () => {
    const res = ok({ name: 'test' });
    expect(res.success).toBe(true);
    expect(res.data).toEqual({ name: 'test' });
    expect(res.meta.timestamp).toBeDefined();
  });

  it('fail creates error response', () => {
    const res = fail('NOT_FOUND', 'Resource not found');
    expect(res.success).toBe(false);
    expect(res.error.code).toBe('NOT_FOUND');
    expect(res.error.message).toBe('Resource not found');
  });

  it('fail includes optional details', () => {
    const res = fail('VALIDATION_ERROR', 'Bad input', { field: 'name' });
    expect(res.error.details).toEqual({ field: 'name' });
  });
});
