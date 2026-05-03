import { describe, it, expect } from 'vitest';
import { rateLimiter } from '../src/middleware/rate-limiter.js';

function mockReq(ip: string) {
  return { ip } as unknown as Parameters<ReturnType<typeof rateLimiter>>[0];
}

function mockReply() {
  const sent: { status?: number; body?: unknown } = {};
  const reply = {
    status: (code: number) => {
      sent.status = code;
      return { send: (body: unknown) => { sent.body = body; return reply; } };
    },
    header: () => reply,
    get sent() { return sent; },
  } as unknown as Parameters<ReturnType<typeof rateLimiter>>[1] & { sent: { status?: number; body?: unknown } };
  return reply;
}

describe('rateLimiter', () => {
  it('allows requests within limit', async () => {
    const limiter = rateLimiter({ max: 3, windowMs: 60_000 });

    for (let i = 0; i < 3; i++) {
      const r = mockReply();
      await limiter(mockReq('10.0.0.' + i), r);
      expect(r.sent.status).toBeUndefined();
    }
  });

  it('blocks requests exceeding limit', async () => {
    const limiter = rateLimiter({ max: 2, windowMs: 60_000 });
    const ip = '192.168.1.100';

    await limiter(mockReq(ip), mockReply());
    await limiter(mockReq(ip), mockReply());

    const reply3 = mockReply();
    await limiter(mockReq(ip), reply3);
    expect(reply3.sent.status).toBe(429);
  });

  it('sets Retry-After header on rate limit', async () => {
    const limiter = rateLimiter({ max: 1, windowMs: 30_000 });
    const ip = '10.10.10.10';

    await limiter(mockReq(ip), mockReply());
    const reply2 = mockReply();
    await limiter(mockReq(ip), reply2);
    expect(reply2.sent.status).toBe(429);
  });

  it('treats different IPs independently', async () => {
    const limiter = rateLimiter({ max: 1, windowMs: 60_000 });

    await limiter(mockReq('1.1.1.1'), mockReply());
    // 不同 IP 不受影响
    const reply2 = mockReply();
    await limiter(mockReq('2.2.2.2'), reply2);
    expect(reply2.sent.status).toBeUndefined();
  });
});
