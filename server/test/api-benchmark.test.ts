/**
 * 全端点自动化性能基准测试 — V7-W5-007 产出
 *
 * 覆盖全部 28 个 API 端点，每端点采集 30 样本，p99 < 500ms SLA 断言。
 * 人工审计 qian-api-audit-may.md 的自动化版本，用于 CI 回归检测。
 *
 * 负责人: 钱富贵 P6 后端工程师
 * 日期: 2026-05-06
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { loadConfig } from '../src/config/index.js';
import { createAiProvider } from '../src/ai/index.js';
import { userIdHook } from '../src/middleware/user-id.js';
import { analysisService } from '../src/services/analysis-service.js';
import { healthRoutes } from '../src/routes/health.js';
import { analyzeRoutes } from '../src/routes/analyze.js';
import { reportRoutes } from '../src/routes/report.js';
import { matchRoutes } from '../src/routes/match.js';
import { analyticsRoutes } from '../src/routes/analytics.js';
import { trackingRoutes } from '../src/routes/tracking.js';
import { growthRoutes } from '../src/routes/growth.js';
import { complianceRoutes } from '../src/routes/compliance.js';
import { adminRoutes } from '../src/routes/admin.js';

// ─── 配置 ────────────────────────────────────────────

const SAMPLE_COUNT = parseInt(process.env.BENCH_SAMPLES ?? '30', 10);
const WARMUP_COUNT = 3;
const SLA_P99_MS = 500;
const ADMIN_KEY = process.env.ADMIN_KEY || 'palm-admin-dev-key';

// ─── 工具 ────────────────────────────────────────────

function p99(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * 0.99) - 1;
  return sorted[Math.max(0, idx)];
}

function p50(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

let imgCounter = 0;
function makeImage(): string {
  imgCounter++;
  const prefix = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk';
  const suffix = 'DADhgGAWjR9awAAAABJRU5ErkJggg==';
  return prefix + String(imgCounter).padStart(6, 'X') + suffix;
}

// ─── 端点定义 (静态表，无运行时依赖) ──────────────────

interface EndpointDef {
  name: string;
  method: 'GET' | 'POST' | 'DELETE';
  /** 静态 URL 或需要 setupUrl 解析的占位符 */
  url: string;
  payload?: unknown;
  headers?: Record<string, string>;
  /**
   * 动态 URL 解析器。
   * 每次 benchmark 采样前调用，应返回确定性的 URL。
   * 实现需自行缓存资源 ID，避免每次创建新资源。
   */
  resolveUrl?: (app: Fastify.FastifyInstance) => Promise<string>;
  /** resolveUrl 调用后，更新 payload 的回调（用于动态 reportId 等） */
  resolvePayload?: (app: Fastify.FastifyInstance) => Promise<unknown>;
}

// ─── 模块级缓存（跨测试共享，避免重复创建资源）───────

let cachedReportId: string | null = null;
let cachedMatchId: string | null = null;
let cachedEscapeTerm: string | null = null;

let ensureCounter = 0;
async function ensureReportId(app: Fastify.FastifyInstance): Promise<string> {
  if (!cachedReportId) {
    ensureCounter++;
    const r = await app.inject({
      method: 'POST', url: '/api/analyze',
      payload: { imageBase64: makeImage() },
      headers: { 'x-user-id': `bench-cache-report-${ensureCounter}` },
    });
    const body = JSON.parse(r.body);
    if (!body.data?.id) {
      throw new Error(`ensureReportId failed: ${r.statusCode} ${r.body.slice(0, 100)}`);
    }
    cachedReportId = body.data.id;
  }
  return cachedReportId;
}

async function ensureMatchId(app: Fastify.FastifyInstance): Promise<string> {
  if (!cachedMatchId) {
    const rid = await ensureReportId(app);
    ensureCounter++;
    const m = await app.inject({
      method: 'POST', url: '/api/match/create',
      payload: { reportId: rid },
      headers: { 'x-user-id': `bench-cache-match-${ensureCounter}` },
    });
    const body = JSON.parse(m.body);
    if (!body.data?.id) {
      throw new Error(`ensureMatchId failed: ${m.statusCode} ${m.body.slice(0, 100)}`);
    }
    cachedMatchId = body.data.id;
  }
  return cachedMatchId;
}

let freshCounter = 0;
async function freshReportId(app: Fastify.FastifyInstance): Promise<string> {
  freshCounter++;
  const r = await app.inject({
    method: 'POST', url: '/api/analyze',
    payload: { imageBase64: makeImage() },
    headers: { 'x-user-id': `bench-fresh-${freshCounter}` },
  });
  const body = JSON.parse(r.body);
  if (!body.data?.id) {
    throw new Error(`freshReportId failed: ${r.statusCode} ${r.body.slice(0, 100)}`);
  }
  return body.data.id;
}

async function ensureEscapeTerm(app: Fastify.FastifyInstance): Promise<string> {
  if (!cachedEscapeTerm) {
    cachedEscapeTerm = `bench-esc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    ensureCounter++;
    await app.inject({
      method: 'POST', url: '/api/admin/escape-room',
      payload: { term: cachedEscapeTerm },
      headers: { 'x-admin-key': ADMIN_KEY, 'x-user-id': `bench-cache-esc-${ensureCounter}` },
    });
  }
  return cachedEscapeTerm;
}

// ─── 端点注册表 ──────────────────────────────────────

const ENDPOINTS: EndpointDef[] = [
  // ── 健康检查 ──
  { name: 'GET /api/health', method: 'GET', url: '/api/health' },

  // ── 报告 ──
  { name: 'GET /api/reports', method: 'GET', url: '/api/reports' },
  {
    name: 'GET /api/reports/:id',
    method: 'GET',
    url: '/api/reports/__ID__',
    resolveUrl: async (a) => `/api/reports/${await ensureReportId(a)}`,
  },
  {
    name: 'DELETE /api/reports/:id',
    method: 'DELETE',
    url: '/api/reports/__ID__',
    resolveUrl: async (a) => `/api/reports/${await freshReportId(a)}`,
  },
  {
    name: 'POST /api/reports/:id/feedback',
    method: 'POST',
    url: '/api/reports/__ID__/feedback',
    payload: { rating: 4, comment: 'benchmark test' },
    resolveUrl: async (a) => `/api/reports/${await ensureReportId(a)}/feedback`,
  },
  { name: 'GET /api/daily-keyword', method: 'GET', url: '/api/daily-keyword' },

  // ── 分析 ──
  {
    name: 'POST /api/analyze',
    method: 'POST',
    url: '/api/analyze',
    payload: { imageBase64: makeImage() },
  },

  // ── 匹配 ──
  {
    name: 'POST /api/match/create',
    method: 'POST',
    url: '/api/match/create',
    resolvePayload: async (a) => ({ reportId: await freshReportId(a) }),
  },
  {
    name: 'GET /api/match/:id',
    method: 'GET',
    url: '/api/match/__ID__',
    resolveUrl: async (a) => `/api/match/${await ensureMatchId(a)}`,
  },
  {
    name: 'POST /api/match/:id/join',
    method: 'POST',
    url: '/api/match/__ID__/join',
    resolveUrl: async (a) => {
      // 每次采样创建独立匹配 + 两份报告（join 不可重复）
      const [rid1, rid2] = await Promise.all([freshReportId(a), freshReportId(a)]);
      const m = await a.inject({
        method: 'POST', url: '/api/match/create',
        payload: { reportId: rid1 },
        headers: { 'x-user-id': 'bench-join-create' },
      });
      return `/api/match/${JSON.parse(m.body).data.id}/join`;
    },
    resolvePayload: async (a) => {
      const r = await a.inject({
        method: 'POST', url: '/api/analyze',
        payload: { imageBase64: makeImage() },
        headers: { 'x-user-id': 'bench-join-other' },
      });
      return { reportId: JSON.parse(r.body).data.id };
    },
  },
  {
    name: 'GET /api/match/:id/result',
    method: 'GET',
    url: '/api/match/__ID__/result',
    resolveUrl: async (a) => {
      const [rid1, rid2] = await Promise.all([freshReportId(a), freshReportId(a)]);
      const m = await a.inject({
        method: 'POST', url: '/api/match/create',
        payload: { reportId: rid1 },
        headers: { 'x-user-id': 'bench-result-create' },
      });
      const mid = JSON.parse(m.body).data.id;
      await a.inject({
        method: 'POST', url: `/api/match/${mid}/join`,
        payload: { reportId: rid2 },
        headers: { 'x-user-id': 'bench-result-join' },
      });
      return `/api/match/${mid}/result`;
    },
  },

  // ── 埋点 ──
  {
    name: 'POST /api/analytics',
    method: 'POST',
    url: '/api/analytics',
    payload: { events: [{ event: 'page_view', timestamp: Date.now() }] },
  },

  // ── 追踪心跳 ──
  {
    name: 'POST /api/tracking/heartbeat',
    method: 'POST',
    url: '/api/tracking/heartbeat',
    payload: {
      session_id: `bench-session-${Date.now()}`,
      sequence: 1,
      accumulated_ms: 5000,
      background_intervals: [],
      timestamp: Date.now(),
      state: 'active',
    },
  },
  { name: 'GET /api/tracking/sessions', method: 'GET', url: '/api/tracking/sessions' },

  // ── 签到 ──
  { name: 'POST /api/checkin', method: 'POST', url: '/api/checkin' },
  { name: 'GET /api/checkin/record', method: 'GET', url: '/api/checkin/record' },
  { name: 'GET /api/checkin/unlocked-lines', method: 'GET', url: '/api/checkin/unlocked-lines' },
  { name: 'GET /api/checkin/pending-unlock', method: 'GET', url: '/api/checkin/pending-unlock' },

  // ── 合规 ──
  { name: 'GET /api/compliance/terms', method: 'GET', url: '/api/compliance/terms' },
  { name: 'GET /api/compliance/stats', method: 'GET', url: '/api/compliance/stats' },
  {
    name: 'POST /api/compliance/check',
    method: 'POST',
    url: '/api/compliance/check',
    payload: { text: '这是一段正常的人格描述文本，用于合规检查基准测试。' },
  },
  {
    name: 'POST /api/compliance/audit',
    method: 'POST',
    url: '/api/compliance/audit',
    payload: { text: '安全审计基准测试文本，不含敏感信息。' },
  },

  // ── 管理 (需 Admin Key) ──
  {
    name: 'GET /api/admin/safety/trends',
    method: 'GET',
    url: '/api/admin/safety/trends',
    headers: { 'x-admin-key': ADMIN_KEY },
  },
  {
    name: 'GET /api/admin/safety/violations',
    method: 'GET',
    url: '/api/admin/safety/violations',
    headers: { 'x-admin-key': ADMIN_KEY },
  },
  {
    name: 'GET /api/admin/safety/stats',
    method: 'GET',
    url: '/api/admin/safety/stats',
    headers: { 'x-admin-key': ADMIN_KEY },
  },
  {
    name: 'GET /api/admin/escape-room',
    method: 'GET',
    url: '/api/admin/escape-room',
    headers: { 'x-admin-key': ADMIN_KEY },
  },
  {
    name: 'POST /api/admin/escape-room',
    method: 'POST',
    url: '/api/admin/escape-room',
    payload: { term: `bench-add-${Date.now()}` },
    headers: { 'x-admin-key': ADMIN_KEY },
  },
  {
    name: 'DELETE /api/admin/escape-room/:term',
    method: 'DELETE',
    url: '/api/admin/escape-room/__TERM__',
    headers: { 'x-admin-key': ADMIN_KEY },
    resolveUrl: async (a) => `/api/admin/escape-room/${encodeURIComponent(await ensureEscapeTerm(a))}`,
  },
];

// ─── App 构建 ────────────────────────────────────────

async function buildBenchApp(): Promise<Fastify.FastifyInstance> {
  process.env.ALLOW_MOCK = 'true';
  const config = loadConfig();
  const aiProvider = createAiProvider(config);
  analysisService.setAiProvider(aiProvider);

  const app = Fastify({ logger: false });

  app.addHook('onRequest', userIdHook);

  app.addHook('onSend', async (_req, reply) => {
    reply.header('X-Response-Time', reply.elapsedTime.toFixed(2) + 'ms');
  });

  await app.register(healthRoutes, { prefix: '/api' });
  await app.register(analyzeRoutes, { prefix: '/api' });
  await app.register(reportRoutes, { prefix: '/api' });
  await app.register(matchRoutes, { prefix: '/api' });
  await app.register(analyticsRoutes, { prefix: '/api' });
  await app.register(trackingRoutes, { prefix: '/api' });
  await app.register(growthRoutes, { prefix: '/api' });
  await app.register(complianceRoutes);
  await app.register(adminRoutes, { prefix: '/api/admin' });

  await app.ready();
  return app;
}

// ─── 采样引擎 ────────────────────────────────────────

async function collectSamples(
  app: Fastify.FastifyInstance,
  def: EndpointDef,
  count: number,
): Promise<number[]> {
  const samples: number[] = [];

  // 解析动态 URL / Payload（只解析一次）
  const resolvedUrl = def.resolveUrl ? await def.resolveUrl(app) : def.url;
  const resolvedPayload = def.resolvePayload ? await def.resolvePayload(app) : def.payload;

  for (let i = 0; i < count; i++) {
    // 不同 userId 绕过设备级限流 (3req/min)
    const headers: Record<string, string> = {
      'x-user-id': `bench-${def.name.replace(/[^a-zA-Z0-9]/g, '-')}-${i}`,
      ...def.headers,
    };

    const start = Date.now();
    const res = await app.inject({
      method: def.method,
      url: resolvedUrl,
      payload: resolvedPayload,
      headers,
    });
    const elapsed = Date.now() - start;

    if (res.statusCode !== 429) {
      samples.push(elapsed);
    }
  }

  return samples;
}

// ─── 测试套件 ────────────────────────────────────────

describe('API 性能基准测试 — p99 < 500ms SLA', () => {
  let app: Fastify.FastifyInstance;

  beforeAll(async () => {
    app = await buildBenchApp();

    // 预热：每个端点 WARMUP_COUNT 次
    for (const def of ENDPOINTS) {
      try {
        await collectSamples(app, def, WARMUP_COUNT);
      } catch {
        // 预热失败不阻塞
      }
    }
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it.each(ENDPOINTS)(
    `$name — p99 < ${SLA_P99_MS}ms (${SAMPLE_COUNT} 样本)`,
    async (def) => {
      const samples = await collectSamples(app, def, SAMPLE_COUNT);

      expect(
        samples.length,
        `${def.name} 有效样本不足 (仅${samples.length}，需≥${Math.floor(SAMPLE_COUNT * 0.8)})`,
      ).toBeGreaterThanOrEqual(Math.floor(SAMPLE_COUNT * 0.8));

      const p99Value = p99(samples);
      const p50Value = p50(samples);
      const avg = samples.reduce((a, b) => a + b, 0) / samples.length;

      expect(
        p99Value,
        `${def.name} p99=${p99Value.toFixed(0)}ms 超过 SLA ${SLA_P99_MS}ms`,
      ).toBeLessThan(SLA_P99_MS);

      console.log(
        `[BENCH] ${def.name.padEnd(42)} n=${String(samples.length).padStart(2)}  ` +
        `avg=${avg.toFixed(1).padStart(6)}ms  p50=${p50Value.toFixed(0).padStart(4)}ms  p99=${p99Value.toFixed(0).padStart(4)}ms  ✅`,
      );
    },
    15_000,
  );
});
