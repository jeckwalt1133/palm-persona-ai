/**
 * 管理 API — L3 安全可观测性 + 逃生门管理
 *
 * 端点：
 *   GET  /safety/trends     — 违规趋势
 *   GET  /safety/violations  — 违规日志
 *   GET  /safety/stats       — 聚合统计
 *   GET  /escape-room        — 白名单列表
 *   POST /escape-room        — 添加白名单词
 *   DELETE /escape-room/:term — 移除白名单词
 */

import { FastifyInstance } from 'fastify';
import { defaultSafetyLogger } from '../safety/safety-logger.js';
import { defaultEscapeRoom } from '../safety/escape-room.js';

const ADMIN_KEY = process.env.ADMIN_KEY;
if (!ADMIN_KEY) {
  console.warn('[admin] ADMIN_KEY 环境变量未设置，管理API已禁用');
}

const WINDOW_MAP: Record<string, number> = {
  hourly: 3600_000,
  daily: 86_400_000,
  weekly: 604_800_000,
};

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', async (req, reply) => {
    if (!ADMIN_KEY) {
      return reply.status(503).send({ success: false, error: { code: 'NOT_CONFIGURED', message: 'Admin API 未配置 — 请设置 ADMIN_KEY 环境变量' } });
    }
    const key = req.headers['x-admin-key'];
    if (!key || key !== ADMIN_KEY) {
      return reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Admin key required' } });
    }
  });

  app.get('/safety/trends', async (req, reply) => {
    const { window = 'daily', lookback = '7' } = req.query as Record<string, string>;
    const windowMs = WINDOW_MAP[window] ?? WINDOW_MAP.daily;
    const numBuckets = Math.min(Math.max(parseInt(lookback) || 7, 1), 90);
    return reply.send(defaultSafetyLogger.getTrends(windowMs, numBuckets));
  });

  app.get('/safety/violations', async (req, reply) => {
    const { limit = '20', offset = '0', since } = req.query as Record<string, string>;
    const entries = defaultSafetyLogger.getEntries();
    const sinceMs = since ? parseInt(since) : 0;
    const filtered = sinceMs ? entries.filter(e => e.timestamp >= sinceMs) : entries;
    const start = parseInt(offset) || 0;
    const count = Math.min(parseInt(limit) || 20, 100);
    return reply.send({
      total: filtered.length,
      offset: start,
      entries: filtered.slice(start, start + count),
    });
  });

  app.get('/safety/stats', async (_req, reply) => {
    const stats = defaultSafetyLogger.getStats();
    return reply.send(stats);
  });

  app.get('/escape-room', async (_req, reply) => {
    return reply.send({ terms: defaultEscapeRoom.list(), count: defaultEscapeRoom.count() });
  });

  app.post('/escape-room', async (req, reply) => {
    const { term } = req.body as { term?: string };
    if (!term || typeof term !== 'string') {
      return reply.status(400).send({ success: false, error: { code: 'BAD_REQUEST', message: '缺少必填字段 term' } });
    }
    const added = defaultEscapeRoom.add(term.trim());
    if (!added) {
      return reply.status(409).send({ success: false, error: { code: 'ALREADY_EXISTS', message: `词 "${term}" 已在白名单中` } });
    }
    return reply.status(201).send({ added: term.trim() });
  });

  app.delete('/escape-room/:term', async (req, reply) => {
    const { term } = req.params as { term: string };
    const removed = defaultEscapeRoom.remove(decodeURIComponent(term));
    if (!removed) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: `词 "${term}" 不在白名单中` } });
    }
    return reply.send({ removed: term });
  });
}
