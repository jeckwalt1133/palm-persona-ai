/**
 * 全端点自动化性能基准测试 — V7-W5-010
 *
 * 覆盖全部 30 个 API 端点，每端点采集 30 样本，p99 < 500ms SLA 断言。
 * 包含冷启动测试 + 速率限制绕过验证。
 *
 * 负责人: 钱富贵 P6 后端工程师
 * 日期: 2026-05-06
 * 基于: student-notebook/qian-api-audit-may.md (V7-W5-007)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import fastifyMultipart from '@fastify/multipart';
import { loadConfig } from '../src/config/index.js';
import { createAiProvider } from '../src/ai/index.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import { userIdHook } from '../src/middleware/user-id.js';
import { globalLimiter } from '../src/middleware/rate-limiter.js';
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

// ─── 统计工具 ────────────────────────────────────────

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

function avg(samples: number[]): number {
  return samples.reduce((a, b) => a + b, 0) / samples.length;
}

function min(samples: number[]): number {
  return Math.min(...samples);
}

function max(samples: number[]): number {
  return Math.max(...samples);
}

// ─── 假图片生成 ──────────────────────────────────────

let imgCounter = 0;
function makeImage(): string {
  imgCounter++;
  const prefix = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk';
  const suffix = 'DADhgGAWjR9awAAAABJRU5ErkJggg==';
  return prefix + String(imgCounter).padStart(6, 'X') + suffix;
}

/** 生成最小的有效 JPEG buffer (1x1 像素) 用于 multipart 上传 */
function makeJpegBuffer(): Buffer {
  // 最小的有效 JPEG (1x1 灰色像素)
  return Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
    0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
    0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06,
    0x05, 0x08, 0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c,
    0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12, 0x13, 0x0f,
    0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
    0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28,
    0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
    0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff,
    0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01,
    0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05,
    0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06,
    0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff, 0xc4, 0x00, 0xb5, 0x10,
    0x00, 0x02, 0x01, 0x03, 0x03, 0x02, 0x04, 0x03, 0x05, 0x05,
    0x04, 0x04, 0x00, 0x00, 0x01, 0x7d, 0x01, 0x02, 0x03, 0x00,
    0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06, 0x13, 0x51,
    0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08,
    0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0, 0x24, 0x33,
    0x62, 0x72, 0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a,
    0x25, 0x26, 0x27, 0x28, 0x29, 0x2a, 0x34, 0x35, 0x36, 0x37,
    0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49,
    0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x63,
    0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6a, 0x73, 0x74, 0x75,
    0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87,
    0x88, 0x89, 0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98,
    0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9,
    0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba,
    0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2,
    0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2,
    0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2,
    0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa, 0xff, 0xda,
    0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x7b, 0x94,
    0x11, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0xff, 0xd9,
  ]);
}

/** 构造 multipart/form-data 载荷 */
function buildMultipartPayload(
  fileBuffer: Buffer,
  filename: string,
  fieldName = 'file',
): { payload: Buffer; headers: Record<string, string> } {
  const boundary = `--Benchmark${Date.now()}${Math.random().toString(36).slice(2)}`;
  const CRLF = '\r\n';
  const parts: Buffer[] = [
    Buffer.from(`--${boundary}${CRLF}`),
    Buffer.from(`Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"${CRLF}`),
    Buffer.from(`Content-Type: image/jpeg${CRLF}${CRLF}`),
    fileBuffer,
    Buffer.from(`${CRLF}--${boundary}--${CRLF}`),
  ];
  return {
    payload: Buffer.concat(parts),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  };
}

// ─── 端点定义 ────────────────────────────────────────

interface EndpointDef {
  name: string;
  method: 'GET' | 'POST' | 'DELETE';
  url: string;
  payload?: unknown;
  headers?: Record<string, string>;
  resolveUrl?: (app: Fastify.FastifyInstance) => Promise<string>;
  resolvePayload?: (app: Fastify.FastifyInstance) => Promise<unknown>;
}

// ─── 资源缓存（跨测试共享） ──────────────────────────

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
      throw new Error(`ensureReportId failed: ${r.statusCode} ${r.body.slice(0, 200)}`);
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
      throw new Error(`ensureMatchId failed: ${m.statusCode} ${m.body.slice(0, 200)}`);
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
    throw new Error(`freshReportId failed: ${r.statusCode} ${r.body.slice(0, 200)}`);
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

// ─── 30 端点注册表 ───────────────────────────────────

const ENDPOINTS: EndpointDef[] = [
  // ═══ 健康检查 (1) ═══
  { name: 'GET /api/health', method: 'GET', url: '/api/health' },

  // ═══ 报告 (5) ═══
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
    payload: { rating: 4, comment: '基准测试反馈' },
    resolveUrl: async (a) => `/api/reports/${await ensureReportId(a)}/feedback`,
  },
  { name: 'GET /api/daily-keyword', method: 'GET', url: '/api/daily-keyword' },

  // ═══ 分析 (2) ═══
  {
    name: 'POST /api/analyze',
    method: 'POST',
    url: '/api/analyze',
    payload: { imageBase64: makeImage() },
  },
  {
    name: 'POST /api/analyze/upload',
    method: 'POST',
    url: '/api/analyze/upload',
    resolvePayload: () => {
      const { payload, headers } = buildMultipartPayload(makeJpegBuffer(), 'bench-upload.jpg');
      return Promise.resolve({ payload, headers });
    },
  },

  // ═══ 匹配 (4) ═══
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
      const [rid1, rid2] = await Promise.all([freshReportId(a), freshReportId(a)]);
      const m = await a.inject({
        method: 'POST', url: '/api/match/create',
        payload: { reportId: rid1 },
        headers: { 'x-user-id': `bench-join-create-${freshCounter}` },
      });
      return `/api/match/${JSON.parse(m.body).data.id}/join`;
    },
    resolvePayload: async (a) => {
      const r = await a.inject({
        method: 'POST', url: '/api/analyze',
        payload: { imageBase64: makeImage() },
        headers: { 'x-user-id': `bench-join-other-${freshCounter}` },
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
        headers: { 'x-user-id': `bench-result-create-${freshCounter}` },
      });
      const mid = JSON.parse(m.body).data.id;
      await a.inject({
        method: 'POST', url: `/api/match/${mid}/join`,
        payload: { reportId: rid2 },
        headers: { 'x-user-id': `bench-result-join-${freshCounter}` },
      });
      return `/api/match/${mid}/result`;
    },
  },

  // ═══ 埋点 (1) ═══
  {
    name: 'POST /api/analytics',
    method: 'POST',
    url: '/api/analytics',
    payload: { events: [{ event: 'page_view', timestamp: Date.now() }] },
  },

  // ═══ 追踪心跳 (2) ═══
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

  // ═══ 签到 (5) ═══
  { name: 'POST /api/checkin', method: 'POST', url: '/api/checkin' },
  { name: 'GET /api/checkin/record', method: 'GET', url: '/api/checkin/record' },
  { name: 'GET /api/checkin/unlocked-lines', method: 'GET', url: '/api/checkin/unlocked-lines' },
  { name: 'GET /api/checkin/pending-unlock', method: 'GET', url: '/api/checkin/pending-unlock' },
  {
    name: 'POST /api/checkin/claim-line',
    method: 'POST',
    url: '/api/checkin/claim-line',
    payload: { lineKey: 'career' },
  },

  // ═══ 合规 (4) ═══
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

  // ═══ 管理 (6) — 需 Admin Key ═══
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
  // NODE_ENV=test 触发全局+设备级限流绕过
  process.env.NODE_ENV = 'test';
  process.env.ALLOW_MOCK = 'true';

  const config = loadConfig();
  const aiProvider = createAiProvider(config);
  analysisService.setAiProvider(aiProvider);

  const app = Fastify({ logger: false });

  // 错误处理 (与生产一致)
  app.setErrorHandler(errorHandler);

  // X-User-Id 提取 (与生产一致)
  app.addHook('onRequest', userIdHook);

  // 全局限流 (NODE_ENV=test 自动绕过，但保留中间件链开销)
  app.addHook('onRequest', globalLimiter);

  // 响应头 (与生产一致)
  app.addHook('onSend', async (_req, reply) => {
    reply.header('X-Response-Time', reply.elapsedTime.toFixed(2) + 'ms');
  });

  // multipart 支持 (upload 端点依赖)
  await app.register(fastifyMultipart);

  // 路由注册 (与 index.ts 一致)
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

  const resolvedUrl = def.resolveUrl ? await def.resolveUrl(app) : def.url;
  const resolvedPayload = def.resolvePayload ? await def.resolvePayload(app) : def.payload;

  // 判断是否 multipart (payload 含 headers 字段)
  const isMultipart = resolvedPayload && typeof resolvedPayload === 'object' && 'headers' in resolvedPayload && 'payload' in resolvedPayload;

  for (let i = 0; i < count; i++) {
    const headers: Record<string, string> = {
      'x-user-id': `bench-${def.name.replace(/[^a-zA-Z0-9]/g, '-')}-${i}`,
      ...def.headers,
    };

    const injectOpts: Record<string, unknown> = {
      method: def.method,
      url: resolvedUrl,
      headers,
    };

    if (isMultipart) {
      const mp = resolvedPayload as { payload: Buffer; headers: Record<string, string> };
      injectOpts.payload = mp.payload;
      Object.assign(headers, mp.headers);
    } else {
      injectOpts.payload = resolvedPayload;
    }

    const start = Date.now();
    const res = await app.inject(injectOpts as Parameters<typeof app.inject>[0]);
    const elapsed = Date.now() - start;

    // 跳过 429 (速率限制残余)，但 test 环境理论上不会触发
    if (res.statusCode !== 429) {
      samples.push(elapsed);
    }
  }

  return samples;
}

// ─── 测试套件 ────────────────────────────────────────

describe('API 性能基准测试', () => {
  let app: Fastify.FastifyInstance;

  // ═══════════════════════════════════════════════════
  // 冷启动性能
  // ═══════════════════════════════════════════════════
  describe('冷启动性能', () => {
    it('app 构建 < 2000ms', async () => {
      const buildStart = Date.now();
      const coldApp = await buildBenchApp();
      const buildTime = Date.now() - buildStart;

      // 首个请求延迟 (冷缓存)
      const firstReqStart = Date.now();
      const firstRes = await coldApp.inject({
        method: 'GET',
        url: '/api/health',
        headers: { 'x-user-id': 'cold-start-test' },
      });
      const firstReqTime = Date.now() - firstReqStart;

      await coldApp.close();

      console.log(
        `[COLD-START] 构建=${buildTime}ms  首请求(GET /api/health)=${firstReqTime}ms  status=${firstRes.statusCode}`,
      );

      expect(buildTime, `冷启动构建耗时 ${buildTime}ms 超过 2000ms`).toBeLessThan(2000);
      expect(firstReqTime, `冷启动首请求 ${firstReqTime}ms 超过 ${SLA_P99_MS}ms`).toBeLessThan(SLA_P99_MS);
      expect(firstRes.statusCode).toBe(200);
    }, 15_000);
  });

  // ═══════════════════════════════════════════════════
  // 速率限制绕过验证
  // ═══════════════════════════════════════════════════
  describe('速率限制绕过 (NODE_ENV=test)', () => {
    beforeAll(async () => {
      app = await buildBenchApp();
    });

    afterAll(async () => {
      await app.close();
    });

    it('连续 100 请求全部不触发 429', async () => {
      const statusCodes: number[] = [];
      for (let i = 0; i < 100; i++) {
        const res = await app.inject({
          method: 'GET',
          url: '/api/health',
          headers: { 'x-user-id': `rate-limit-bypass-${i}` },
        });
        statusCodes.push(res.statusCode);
      }

      const blocked = statusCodes.filter((s) => s === 429).length;
      expect(blocked, `100 请求中 ${blocked} 次被限流 (应为 0)`).toBe(0);
    }, 15_000);

    it('POST /api/analyze 连续 20 请求不触发设备级限流', async () => {
      const statusCodes: number[] = [];
      for (let i = 0; i < 20; i++) {
        const res = await app.inject({
          method: 'POST',
          url: '/api/analyze',
          payload: { imageBase64: makeImage() },
          headers: { 'x-user-id': 'device-bypass-test' },
        });
        statusCodes.push(res.statusCode);
      }

      const blocked = statusCodes.filter((s) => s === 429).length;
      expect(blocked, `同 userId 20 次分析请求中 ${blocked} 次被设备级限流 (应为 0)`).toBe(0);
    }, 15_000);
  });

  // ═══════════════════════════════════════════════════
  // 全端点 SLA (p99 < 500ms)
  // ═══════════════════════════════════════════════════
  describe(`全端点 p99 < ${SLA_P99_MS}ms SLA (${SAMPLE_COUNT} 样本)`, () => {
    beforeAll(async () => {
      app = await buildBenchApp();

      // 预热：每个端点 WARMUP_COUNT 次
      for (const def of ENDPOINTS) {
        try { await collectSamples(app, def, WARMUP_COUNT); } catch { /* 预热失败不阻塞 */ }
      }
    }, 30_000);

    afterAll(async () => {
      await app.close();
    });

    it.each(ENDPOINTS)(
      '$name',
      async (def) => {
        const samples = await collectSamples(app, def, SAMPLE_COUNT);

        // 至少需要 80% 有效样本
        const minSamples = Math.floor(SAMPLE_COUNT * 0.8);
        expect(
          samples.length,
          `${def.name} 有效样本不足 (${samples.length}/${SAMPLE_COUNT}，需≥${minSamples})`,
        ).toBeGreaterThanOrEqual(minSamples);

        const p99Value = p99(samples);
        const p50Value = p50(samples);
        const avgValue = avg(samples);
        const minValue = min(samples);
        const maxValue = max(samples);

        expect(
          p99Value,
          `${def.name} p99=${p99Value.toFixed(0)}ms 超过 SLA ${SLA_P99_MS}ms (min=${minValue} max=${maxValue})`,
        ).toBeLessThan(SLA_P99_MS);

        console.log(
          `  ${def.name.padEnd(44)} n=${String(samples.length).padStart(2)}  ` +
          `avg=${avgValue.toFixed(1).padStart(6)}ms  p50=${p50Value.toFixed(0).padStart(4)}ms  ` +
          `p99=${p99Value.toFixed(0).padStart(4)}ms  ✅`,
        );
      },
      20_000,
    );
  });

  // ═══════════════════════════════════════════════════
  // 性能回归对比 (vs 审计基线)
  // ═══════════════════════════════════════════════════
  describe('性能回归对比 — vs 2026-05-06 审计基线', () => {
    beforeAll(async () => {
      app = await buildBenchApp();
    });

    afterAll(async () => {
      await app.close();
    });

    // 审计报告中 p99 最高的 5 个端点，需持续关注
    it('POST /api/compliance/audit — p99 < 100ms (审计基线 82ms)', async () => {
      const samples = await collectSamples(
        app,
        ENDPOINTS.find((e) => e.name === 'POST /api/compliance/audit')!,
        SAMPLE_COUNT,
      );
      expect(p99(samples)).toBeLessThan(100);
    });

    it('GET /api/admin/escape-room — p99 < 100ms (审计基线 76ms)', async () => {
      const samples = await collectSamples(
        app,
        ENDPOINTS.find((e) => e.name === 'GET /api/admin/escape-room')!,
        SAMPLE_COUNT,
      );
      expect(p99(samples)).toBeLessThan(100);
    });

    it('POST /api/compliance/check — p99 < 100ms (审计基线 73ms)', async () => {
      const samples = await collectSamples(
        app,
        ENDPOINTS.find((e) => e.name === 'POST /api/compliance/check')!,
        SAMPLE_COUNT,
      );
      expect(p99(samples)).toBeLessThan(100);
    });

    it('GET /api/checkin/unlocked-lines — p99 < 100ms (审计基线 69ms)', async () => {
      const samples = await collectSamples(
        app,
        ENDPOINTS.find((e) => e.name === 'GET /api/checkin/unlocked-lines')!,
        SAMPLE_COUNT,
      );
      expect(p99(samples)).toBeLessThan(100);
    });

    it('POST /api/match/create — p99 < 100ms (审计基线 69ms)', async () => {
      const samples = await collectSamples(
        app,
        ENDPOINTS.find((e) => e.name === 'POST /api/match/create')!,
        SAMPLE_COUNT,
      );
      expect(p99(samples)).toBeLessThan(100);
    });
  });
});
