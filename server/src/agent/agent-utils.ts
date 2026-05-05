/**
 * Agent 共享工具 — withTimeout / JSON解析 / markdown清理
 */

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`超时(${ms}ms)`)), ms)),
  ]);
}

export function parseAiJson(raw: string): Record<string, any> {
  return JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
}
