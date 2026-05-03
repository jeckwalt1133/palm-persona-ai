import { FastifyInstance } from 'fastify';
import { analysisService } from '../services/analysis-service.js';

export async function reportRoutes(app: FastifyInstance) {
  // 获取历史报告列表
  app.get('/reports', async (_req) => {
    const reports = await analysisService.listReports();
    return {
      success: true,
      data: reports.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    };
  });

  // 获取单个报告
  app.get<{ Params: { id: string } }>('/reports/:id', async (req, reply) => {
    const report = await analysisService.getReport(req.params.id);
    if (!report) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: '报告不存在或已删除' },
      });
    }
    return { success: true, data: report };
  });

  // 删除报告
  app.delete<{ Params: { id: string } }>('/reports/:id', async (req, reply) => {
    const deleted = await analysisService.deleteReport(req.params.id);
    if (!deleted) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: '报告不存在或已删除' },
      });
    }
    return { success: true, message: '报告已删除' };
  });

  // 提交反馈
  app.post<{ Params: { id: string } }>('/reports/:id/feedback', async (req, reply) => {
    const { id } = req.params;
    const body = req.body as { rating?: number; comment?: string } | undefined;

    const report = await analysisService.getReport(id);
    if (!report) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: '报告不存在' },
      });
    }

    const rating = body?.rating;
    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
      return reply.status(400).send({
        success: false,
        error: { code: 'INVALID_RATING', message: '评分必须在 1-5 之间' },
      });
    }

    req.log.info({ reportId: id, rating, comment: body?.comment }, 'feedback received');
    return { success: true, message: '反馈已收到，感谢你的参与' };
  });

  // 每日关键词
  app.get('/daily-keyword', async () => {
    const keywords = ['探索', '共鸣', '节奏', '勇气', '温柔', '边界', '自洽'];
    const day = new Date().getDate();
    const keyword = keywords[day % keywords.length];
    return {
      success: true,
      data: {
        keyword,
        date: new Date().toISOString().split('T')[0],
        description: `今天的主题是「${keyword}」——在手掌的线条里，发现属于你的节奏。`,
      },
    };
  });
}
