import { FastifyInstance } from 'fastify';

// 埋点事件接收路由
export async function analyticsRoutes(app: FastifyInstance) {
  app.post('/analytics', async (req, reply) => {
    const { events } = req.body as { events?: unknown[] } ?? {};

    if (!events || !Array.isArray(events)) {
      return reply.status(400).send({ code: 'BAD_REQUEST', message: '缺少 events 数组' });
    }

    // MVP: 日志记录 + 内存计数，后续接 Supabase/ClickHouse
    const counts: Record<string, number> = {};
    for (const evt of events) {
      if (evt && typeof evt === 'object' && 'event' in evt) {
        const name = (evt as { event: string }).event;
        counts[name] = (counts[name] ?? 0) + 1;
      }
    }

    req.log.info({ eventsReceived: events.length, counts }, 'analytics batch');

    return reply.status(204).send();
  });
}
