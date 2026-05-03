import { describe, it, expect } from 'vitest';
import { sanitizeInput, maskSensitive } from '../src/utils/sanitize.js';

describe('sanitizeInput', () => {
  it('removes <script> tags', () => {
    expect(sanitizeInput('<script>evil()</script>hello')).toBe('hello');
  });

  it('removes HTML tags', () => {
    expect(sanitizeInput('<p>text</p>')).toBe('text');
  });

  it('trims whitespace', () => {
    expect(sanitizeInput('  hello  ')).toBe('hello');
  });

  it('returns clean text unchanged', () => {
    expect(sanitizeInput('你好世界')).toBe('你好世界');
  });
});

describe('maskSensitive', () => {
  it('masks long strings', () => {
    const masked = maskSensitive('sk-1234567890abcdef');
    expect(masked).toBe('sk-1***cdef');
    expect(masked).not.toContain('12345678');
  });

  it('returns *** for short strings', () => {
    expect(maskSensitive('abc')).toBe('***');
    expect(maskSensitive('12345678')).toBe('***');
  });
});
