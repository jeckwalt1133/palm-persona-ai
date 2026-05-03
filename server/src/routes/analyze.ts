import { FastifyInstance } from 'fastify';
import { checkDeviceRateLimit } from '../middleware/rateLimit.js';
import { analysisService } from '../services/analysis-service.js';

const analyzeSchema = {
  body: {
    type: 'object',
    required: ['imageBase64'],
    properties: {
      imageBase64: { type: 'string', minLength: 50 },
      context: {
        type: 'object',
        properties: {
          mood: { type: 'string' },
          focusArea: { type: 'string' },
        },
      },
    },
  },
};

export async function analyzeRoutes(app: FastifyInstance) {
  // 设备级限流（同设备 3次/分钟）
  app.addHook('onRequest', async (req, reply) => {
    if (req.url === '/api/analyze' && req.method === 'POST') {
      const userId = req.userId ?? req.ip;
      const { allowed, retryAfterSec } = checkDeviceRateLimit(userId);
      if (!allowed) {
        reply.header('Retry-After', retryAfterSec);
        return reply.status(429).send({
          code: 'DEVICE_RATE_LIMITED',
          message: `分析请求过于频繁，请在 ${retryAfterSec} 秒后重试`,
        });
      }
    }
  });

  app.post('/analyze', { schema: analyzeSchema }, async (req, reply) => {
    const { imageBase64, context } = req.body as {
      imageBase64: string;
      context?: { mood?: string; focusArea?: string };
    };

    try {
      const report = await analysisService.analyze(imageBase64, context);
      return reply.status(201).send({
        success: true,
        data: report,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : '分析失败';
      const statusMap: Record<string, number> = {
        '图片数据无效或过小': 400,
        '图片过大，请压缩后重试': 413,
        '图片格式不支持，请上传 JPG 或 PNG 格式': 415,
      };
      const status = statusMap[message] ?? 500;
      return reply.status(status).send({
        success: false,
        error: { code: 'ANALYZE_ERROR', message },
      });
    }
  });

  // multipart 上传路由（真机 Taro.uploadFile 使用）
  app.post('/analyze/upload', async (req, reply) => {
    try {
      const file = await req.file();
      if (!file) {
        return reply.status(400).send({
          success: false,
          error: { code: 'NO_FILE', message: '未收到图片文件' },
        });
      }

      const buffer = await file.toBuffer();
      const imageBase64 = buffer.toString('base64');

      const report = await analysisService.analyze(imageBase64);
      return reply.status(201).send({
        success: true,
        data: report,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : '分析失败';
      const statusMap: Record<string, number> = {
        '图片数据无效或过小': 400,
        '图片过大，请压缩后重试': 413,
        '图片格式不支持，请上传 JPG 或 PNG 格式': 415,
      };
      const status = statusMap[message] ?? 500;
      return reply.status(status).send({
        success: false,
        error: { code: 'ANALYZE_ERROR', message },
      });
    }
  });
}
