import { describe, it, expect, beforeAll } from 'vitest';
import Fastify from 'fastify';
import { analyzeRoutes } from '../src/routes/analyze.js';
import { reportRoutes } from '../src/routes/report.js';
import { matchRoutes } from '../src/routes/match.js';

// 生成唯一测试图像（修改 base64 主体确保 hash 不同）
let imgCounter = 0;
function makeImage(): string {
  imgCounter++;
  const prefix = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk';
  const suffix = 'DADhgGAWjR9awAAAABJRU5ErkJggg==';
  return prefix + String(imgCounter).padStart(6, 'X') + suffix;
}

function buildApp() {
  const app = Fastify({ logger: false });
  app.addHook('onRequest', async (req) => {
    // @ts-expect-error 注入测试用的 userId
    req.userId = req.headers['x-user-id'] as string ?? 'test-user';
  });
  return app;
}

describe('POST /api/analyze', () => {
  const app = buildApp();
  beforeAll(async () => {
    await app.register(analyzeRoutes, { prefix: '/api' });
    await app.ready();
  });

  it('returns 201 for valid image', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/analyze',
      payload: { imageBase64: makeImage() },
      headers: { 'x-user-id': 'test-analyze-1' },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty('personaType');
    expect(body.data.scores).toHaveLength(5);
    expect(body.data.keywords.length).toBeGreaterThan(0);
    expect(body.data.summary.length).toBeGreaterThan(10);
  });

  it('returns 400 for missing image', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/analyze',
      payload: {},
      headers: { 'x-user-id': 'test-analyze-2' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns duplicate report for same image', async () => {
    const img = makeImage();
    const res1 = await app.inject({
      method: 'POST',
      url: '/api/analyze',
      payload: { imageBase64: img },
      headers: { 'x-user-id': 'test-analyze-3' },
    });
    const res2 = await app.inject({
      method: 'POST',
      url: '/api/analyze',
      payload: { imageBase64: img },
      headers: { 'x-user-id': 'test-analyze-3' },
    });
    expect(res1.statusCode).toBe(201);
    expect(res2.statusCode).toBe(201);
    const r1 = JSON.parse(res1.body).data;
    const r2 = JSON.parse(res2.body).data;
    expect(r1.id).toBe(r2.id);
  });
});

describe('Report CRUD', () => {
  const app = buildApp();

  beforeAll(async () => {
    await app.register(analyzeRoutes, { prefix: '/api' });
    await app.register(reportRoutes, { prefix: '/api' });
    await app.ready();
  });

  it('GET /api/reports returns list', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/analyze',
      payload: { imageBase64: makeImage() },
      headers: { 'x-user-id': 'test-reports' },
    });
    expect(createRes.statusCode).toBe(201);

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/reports',
    });
    expect(listRes.statusCode).toBe(200);
    const body = JSON.parse(listRes.body);
    expect(body.success).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  it('GET /api/reports/:id returns report', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/analyze',
      payload: { imageBase64: makeImage() },
      headers: { 'x-user-id': 'test-get-report' },
    });
    const report = JSON.parse(createRes.body).data;

    const getRes = await app.inject({
      method: 'GET',
      url: `/api/reports/${report.id}`,
    });
    expect(getRes.statusCode).toBe(200);
    expect(JSON.parse(getRes.body).data.id).toBe(report.id);
  });

  it('GET /api/reports/:id returns 404 for unknown id', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/reports/nonexistent',
    });
    expect(res.statusCode).toBe(404);
  });

  it('DELETE /api/reports/:id deletes report', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/analyze',
      payload: { imageBase64: makeImage() },
      headers: { 'x-user-id': 'test-delete' },
    });
    const report = JSON.parse(createRes.body).data;

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/reports/${report.id}`,
    });
    expect(deleteRes.statusCode).toBe(200);

    const getRes = await app.inject({
      method: 'GET',
      url: `/api/reports/${report.id}`,
    });
    expect(getRes.statusCode).toBe(404);
  });

  it('POST /api/reports/:id/feedback validates rating', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/analyze',
      payload: { imageBase64: makeImage() },
      headers: { 'x-user-id': 'test-feedback' },
    });
    const report = JSON.parse(createRes.body).data;

    const badRes = await app.inject({
      method: 'POST',
      url: `/api/reports/${report.id}/feedback`,
      payload: { rating: 10 },
    });
    expect(badRes.statusCode).toBe(400);

    const goodRes = await app.inject({
      method: 'POST',
      url: `/api/reports/${report.id}/feedback`,
      payload: { rating: 5, comment: '很准！' },
    });
    expect(goodRes.statusCode).toBe(200);
  });

  it('GET /api/daily-keyword returns keyword', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/daily-keyword',
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data).toHaveProperty('keyword');
    expect(body.data).toHaveProperty('date');
  });
});

describe('Match endpoints', () => {
  const app = buildApp();

  beforeAll(async () => {
    await app.register(analyzeRoutes, { prefix: '/api' });
    await app.register(matchRoutes, { prefix: '/api' });
    await app.ready();
  });

  it('POST /api/match/create requires reportId', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/match/create',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('full match flow: create → join → result', async () => {
    // 创建两份唯一报告
    const resA = await app.inject({
      method: 'POST',
      url: '/api/analyze',
      payload: { imageBase64: makeImage() },
      headers: { 'x-user-id': 'match-user-A' },
    });
    const resB = await app.inject({
      method: 'POST',
      url: '/api/analyze',
      payload: { imageBase64: makeImage() },
      headers: { 'x-user-id': 'match-user-B' },
    });
    const reportA = JSON.parse(resA.body).data;
    const reportB = JSON.parse(resB.body).data;

    // 创建匹配
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/match/create',
      payload: { reportId: reportA.id },
    });
    expect(createRes.statusCode).toBe(201);
    const match = JSON.parse(createRes.body).data;
    expect(match.status).toBe('pending');

    // 查询状态
    const statusRes = await app.inject({
      method: 'GET',
      url: `/api/match/${match.id}`,
    });
    expect(statusRes.statusCode).toBe(200);
    expect(JSON.parse(statusRes.body).data.status).toBe('pending');

    // 加入匹配
    const joinRes = await app.inject({
      method: 'POST',
      url: `/api/match/${match.id}/join`,
      payload: { reportId: reportB.id },
    });
    expect(joinRes.statusCode).toBe(200);
    const joined = JSON.parse(joinRes.body).data;
    expect(joined.overallScore).toBeGreaterThan(0);

    // 获取结果
    const resultRes = await app.inject({
      method: 'GET',
      url: `/api/match/${match.id}/result`,
    });
    expect(resultRes.statusCode).toBe(200);
    const result = JSON.parse(resultRes.body).data;
    expect(result.overall).toBeGreaterThan(0);
    expect(result.dimensions.length).toBe(5);
  });
});
