import { FastifyInstance } from 'fastify';
import { growthRepo as growthRepository } from '../repository/index.js';

export async function growthRoutes(app: FastifyInstance) {
  // 每日签到
  app.post('/checkin', async (req, reply) => {
    try {
      const userId = req.userId ?? req.ip;
      const today = new Date().toISOString().split('T')[0];

      const result = await growthRepository.checkIn(userId, today);

      if (!result.checkedIn) {
        return reply.status(200).send({
          success: true,
          data: {
            checkedIn: false,
            message: `今日已签到，已连续签到 ${result.consecutiveDays} 天`,
            consecutiveDays: result.consecutiveDays,
            totalDays: result.totalDays,
          },
        });
      }

      const rewardMsg = result.reward ? ` 获得奖励：${result.reward}` : '';
      return reply.status(201).send({
        success: true,
        data: {
          checkedIn: true,
          message: `签到成功！已连续签到 ${result.consecutiveDays} 天。${rewardMsg}`,
          consecutiveDays: result.consecutiveDays,
          totalDays: result.totalDays,
          reward: result.reward ?? null,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : '签到失败';
      return reply.status(500).send({
        success: false,
        error: { code: 'CHECKIN_ERROR', message },
      });
    }
  });

  // 签到记录查询
  app.get('/checkin/record', async (req, _reply) => {
    const userId = req.userId ?? req.ip;
    const record = await growthRepository.getRecord(userId);

    return {
      success: true,
      data: record ?? { userId, lastCheckInDate: null, consecutiveDays: 0, totalDays: 0 },
    };
  });

  // 已解锁维度查询
  app.get('/checkin/unlocked-lines', async (req, _reply) => {
    const userId = req.userId ?? req.ip;
    const unlockedLines = await growthRepository.getUnlockedLines(userId);
    return { success: true, data: { unlockedLines } };
  });

  // 检查是否有待解锁资格
  app.get('/checkin/pending-unlock', async (req, _reply) => {
    const userId = req.userId ?? req.ip;
    const pending = await growthRepository.hasPendingUnlock(userId);
    return { success: true, data: { pendingUnlock: pending } };
  });

  // 自选解锁维度（第7天）
  app.post<{ Body: { lineKey?: string } }>('/checkin/claim-line', async (req, reply) => {
    const userId = req.userId ?? req.ip;
    const { lineKey } = req.body ?? {};

    if (!lineKey) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_LINE_KEY', message: '请选择要解锁的维度' },
      });
    }

    const ok = await growthRepository.claimLine(userId, lineKey);
    if (!ok) {
      return reply.status(400).send({
        success: false,
        error: { code: 'CLAIM_FAILED', message: '无法解锁，请检查资格或是否已解锁' },
      });
    }

    return { success: true, data: { unlocked: lineKey } };
  });
}
