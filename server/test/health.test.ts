import { describe, it, expect } from 'vitest';

describe('health check', () => {
  it('config loads with defaults', async () => {
    // Mock门禁测试需要显式放行
    process.env.ALLOW_MOCK = 'true';
    const { loadConfig } = await import('../src/config/index.js');
    const config = loadConfig();
    expect(config.port).toBe(3001);
    expect(config.aiProvider).toBe('mock');
  });
});
