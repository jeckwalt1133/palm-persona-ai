import path from 'path';
import { fileURLToPath } from 'url';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { loadConfig } from './config/index.js';
import { errorHandler } from './middleware/error-handler.js';
import { globalLimiter } from './middleware/rate-limiter.js';
import { userIdHook } from './middleware/user-id.js';
import { healthRoutes } from './routes/health.js';
import { analyzeRoutes } from './routes/analyze.js';
import { reportRoutes } from './routes/report.js';
import { matchRoutes } from './routes/match.js';
import { analyticsRoutes } from './routes/analytics.js';
import { trackingRoutes } from './routes/tracking.js';
import { growthRoutes } from './routes/growth.js';
import { adminRoutes } from './routes/admin.js';
import { complianceRoutes } from './routes/compliance.js';
import { analysisService } from './services/analysis-service.js';
import { createAiProvider } from './ai/index.js';

async function main() {
  const config = loadConfig();
  const aiProvider = createAiProvider(config);
  analysisService.setAiProvider(aiProvider);

  const app = Fastify({
    bodyLimit: 10485760, // 10MB — 手掌照片上传
    logger: {
      level: config.nodeEnv === 'production' ? 'info' : 'debug',
      transport: config.nodeEnv !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
  });

  app.setErrorHandler(errorHandler);

  app.addHook('onRequest', async (req) => {
    req.log.info({ method: req.method, url: req.url }, 'incoming request');
  });

  // X-User-Id 提取（在所有路由之前）
  app.addHook('onRequest', userIdHook);

  // 全局限流 60req/60s
  app.addHook('onRequest', globalLimiter);

  app.addHook('onSend', async (_req, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('X-Response-Time', reply.elapsedTime.toFixed(2) + 'ms');
  });

  await app.register(cors, { origin: true });
  await app.register(fastifyMultipart);

  await app.register(healthRoutes, { prefix: '/api' });
  await app.register(analyzeRoutes, { prefix: '/api' });
  await app.register(reportRoutes, { prefix: '/api' });
  await app.register(matchRoutes, { prefix: '/api' });
  await app.register(analyticsRoutes, { prefix: '/api' });
  await app.register(trackingRoutes, { prefix: '/api' });
  await app.register(growthRoutes, { prefix: '/api' });
  await app.register(complianceRoutes);
  await app.register(adminRoutes, { prefix: '/api/admin' });

  // H5 静态文件托管
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const h5Dist = path.resolve(__dirname, '../../apps/miniapp/dist');
  await app.register(fastifyStatic, {
    root: h5Dist,
    prefix: '/',
  });

  // SPA 回退：非 API 路径返回 index.html
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/')) {
      return reply.status(404).send({ error: 'Not found' });
    }
    return reply.sendFile('index.html');
  });

  // 播种演示数据（仅 mock 模式）
  await analysisService.seedDemoData();

  // 优雅关机
  const shutdown = async (signal: string) => {
    app.log.info(`收到 ${signal} 信号，正在关闭...`);
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  try {
    await app.listen({ port: config.port, host: '0.0.0.0' });
    app.log.info(`Server running on http://localhost:${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
