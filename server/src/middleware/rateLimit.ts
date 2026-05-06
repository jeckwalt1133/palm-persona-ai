// 设备级限流（基于 X-User-Id，3次/分钟）
// 与 rate-limiter.ts（IP 级，60次/分钟）互补

const store = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_REQ = 3;
const CLEANUP_MS = 120_000;

// 定期清理过期记录
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of store) {
    const valid = timestamps.filter((t) => t > now - WINDOW_MS);
    if (valid.length === 0) store.delete(key);
    else store.set(key, valid);
  }
}, CLEANUP_MS).unref();

export function checkDeviceRateLimit(userId: string): { allowed: boolean; retryAfterSec: number } {
  // NODE_ENV=test 绕过设备级限流
  if (process.env.NODE_ENV === 'test') return { allowed: true, retryAfterSec: 0 };

  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  let timestamps = store.get(userId);
  if (!timestamps) {
    timestamps = [];
    store.set(userId, timestamps);
  }

  // 清理窗口外的记录
  const valid = timestamps.filter((t) => t > windowStart);
  valid.push(now);
  store.set(userId, valid);

  if (valid.length > MAX_REQ) {
    return { allowed: false, retryAfterSec: Math.ceil(WINDOW_MS / 1000) };
  }

  return { allowed: true, retryAfterSec: 0 };
}
