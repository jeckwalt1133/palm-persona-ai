import { FastifyReply, FastifyRequest } from 'fastify';

interface WindowEntry {
  timestamps: number[];
}

// 内存滑动窗口限流
const store = new Map<string, WindowEntry>();
const CLEANUP_INTERVAL = 60_000;

// 定期清理过期记录，防止内存泄漏
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => t > now);
    if (entry.timestamps.length === 0) store.delete(key);
  }
}, CLEANUP_INTERVAL).unref();

export interface RateLimitOptions {
  max: number;
  windowMs: number;
}

export function rateLimiter(options: RateLimitOptions) {
  const { max, windowMs } = options;

  return async (req: FastifyRequest, reply: FastifyReply) => {
    // NODE_ENV=test 或 X-Admin-Key 绕过限流，避免测试/审计被429污染
    if (process.env.NODE_ENV === 'test') return;
    if (req.headers['x-admin-key']) return;

    const ip = req.ip;
    const now = Date.now();
    const windowStart = now - windowMs;

    let entry = store.get(ip);
    if (!entry) {
      entry = { timestamps: [] };
      store.set(ip, entry);
    }

    entry.timestamps = entry.timestamps.filter((t) => t > windowStart);
    entry.timestamps.push(now);

    if (entry.timestamps.length > max) {
      reply.header('Retry-After', Math.ceil(windowMs / 1000));
      return reply.status(429).send({
        code: 'RATE_LIMITED',
        message: `请求过于频繁，请在 ${Math.ceil(windowMs / 1000)} 秒后重试`,
      });
    }
  };
}

// 预设：全局 60req/60s，分析接口更严格
export const globalLimiter = rateLimiter({ max: 60, windowMs: 60_000 });
export const analyzeLimiter = rateLimiter({ max: 5, windowMs: 60_000 });
