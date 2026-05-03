import { FastifyInstance } from 'fastify';
import { getMatchService } from '../services/match-service.js';
import { analysisService } from '../services/analysis-service.js';

const matchService = getMatchService(analysisService);

export async function matchRoutes(app: FastifyInstance) {
  // 创建匹配邀请
  app.post('/match/create', async (req, reply) => {
    const body = req.body as { reportId?: string } | undefined;
    const reportId = body?.reportId;

    if (!reportId) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_REPORT_ID', message: '请提供您的报告 ID' },
      });
    }

    try {
      const invite = await matchService.createInvite(reportId);
      return reply.status(201).send({ success: true, data: invite });
    } catch (err) {
      const message = err instanceof Error ? err.message : '创建匹配失败';
      return reply.status(400).send({
        success: false,
        error: { code: 'CREATE_MATCH_ERROR', message },
      });
    }
  });

  // 好友加入匹配
  app.post<{ Params: { id: string } }>('/match/:id/join', async (req, reply) => {
    const body = req.body as { reportId?: string } | undefined;
    const reportId = body?.reportId;

    if (!reportId) {
      return reply.status(400).send({
        success: false,
        error: { code: 'MISSING_REPORT_ID', message: '请提供您的好友报告 ID' },
      });
    }

    try {
      const invite = await matchService.joinMatch(req.params.id, reportId);
      if (invite.result) {
        return reply.send({
          success: true,
          data: {
            matchId: invite.id,
            status: invite.status,
            overallScore: invite.result.overall,
            dimensions: invite.result.dimensions,
            summary: invite.result.summary,
          },
        });
      }
      return reply.send({ success: true, data: invite });
    } catch (err) {
      const message = err instanceof Error ? err.message : '加入匹配失败';
      return reply.status(400).send({
        success: false,
        error: { code: 'JOIN_MATCH_ERROR', message },
      });
    }
  });

  // 查询匹配状态
  app.get<{ Params: { id: string } }>('/match/:id', async (req, reply) => {
    const invite = await matchService.getMatchStatus(req.params.id);
    if (!invite) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: '匹配邀请不存在' },
      });
    }

    return reply.send({
      success: true,
      data: {
        id: invite.id,
        status: invite.status,
        createdAt: invite.createdAt,
        expiresAt: invite.expiresAt,
        hasResult: invite.status === 'joined',
      },
    });
  });

  // 获取匹配结果
  app.get<{ Params: { id: string } }>('/match/:id/result', async (req, reply) => {
    const result = await matchService.getMatchResult(req.params.id);
    if (!result) {
      return reply.status(404).send({
        success: false,
        error: { code: 'NOT_FOUND', message: '匹配结果尚未生成或匹配不存在' },
      });
    }

    return reply.send({ success: true, data: result });
  });
}
