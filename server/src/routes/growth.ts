import { FastifyInstance } from 'fastify';
import { growthRepository } from '../services/growth/growth-repository.js';

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

  // 已解锁掌纹线查询
  app.get('/checkin/unlocked-lines', async (req, _reply) => {
    const userId = req.userId ?? req.ip;
    const unlockedLines = await growthRepository.getUnlockedLines(userId);
    return { success: true, data: { unlockedLines } };
  });
}
