import { FastifyInstance } from 'fastify';

// 从心跳模块导入类型（编译时擦除，不引入 DOM 依赖）
import type { HeartbeatEvent } from '../tracking/page-heartbeat.js';

// 内存中的会话摘要（MVP，后续接 Supabase/ClickHouse）
interface SessionSummary {
  session_id: string;
  container?: string;
  state: 'active' | 'completed' | 'abandoned';
  start_sequence: number;
  end_sequence: number;
  accumulated_ms: number;
  background_count: number;
  total_background_ms: number;
  quality: 'exact' | 'lower_bound';
  first_seen: number;
  last_seen: number;
}

const sessions = new Map<string, SessionSummary>();

/**
 * POST /api/tracking/heartbeat — 接收页面心跳事件
 *
 * 客户端 PageHeartbeat 每 5s 发送一次心跳，切后台/关闭时发送 final 心跳。
 * 服务端按 session_id 聚合，会话结束后计算最终 dwell_time。
 */
export async function trackingRoutes(app: FastifyInstance) {
  app.post<{ Body: HeartbeatEvent }>(
    '/tracking/heartbeat',
    async (req, reply) => {
      const body = req.body as HeartbeatEvent | undefined;

      if (!body || !body.session_id || typeof body.accumulated_ms !== 'number') {
        return reply.status(400).send({
          code: 'BAD_REQUEST',
          message: '缺少必要字段: session_id, accumulated_ms',
        });
      }

      const existing = sessions.get(body.session_id);

      if (existing) {
        // 更新已有会话
        existing.end_sequence = body.sequence;
        existing.accumulated_ms = body.accumulated_ms;
        existing.background_count = body.background_intervals.length;
        existing.last_seen = body.timestamp;

        if (body.state === 'final') {
          existing.state = 'completed';
          existing.quality = 'exact';
          req.log.info(
            { session: existing },
            'tracking session completed (exact)',
          );
        }
      } else {
        // 新会话
        const summary: SessionSummary = {
          session_id: body.session_id,
          container: body.container,
          state: body.state === 'final' ? 'completed' : 'active',
          start_sequence: body.sequence,
          end_sequence: body.sequence,
          accumulated_ms: body.accumulated_ms,
          background_count: body.background_intervals.length,
          total_background_ms: body.background_intervals.reduce(
            (sum, iv) => sum + ((iv.to ?? body.accumulated_ms) - iv.from),
            0,
          ),
          quality: body.state === 'final' ? 'exact' : 'lower_bound',
          first_seen: body.timestamp,
          last_seen: body.timestamp,
        };
        sessions.set(body.session_id, summary);
      }

      // 202: 已接受，不需要业务响应（减少客户端阻塞）
      return reply.status(202).send();
    },
  );

  /**
   * GET /api/tracking/sessions — 查询会话摘要（调试/仪表盘用）
   */
  app.get('/tracking/sessions', async (_req, reply) => {
    const all = Array.from(sessions.values());
    const active = all.filter((s) => s.state === 'active');
    const completed = all.filter((s) => s.state === 'completed');

    return reply.send({
      total: all.length,
      active: active.length,
      completed: completed.length,
      avgDwellMs:
        completed.length > 0
          ? Math.round(
              completed.reduce((s, c) => s + c.accumulated_ms, 0) /
                completed.length,
            )
          : 0,
      sessions: all.slice(-20), // 最近 20 条
    });
  });
}
