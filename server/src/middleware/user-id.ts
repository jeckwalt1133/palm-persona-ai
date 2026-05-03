import { FastifyReply, FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
  }
}

// 从请求头提取稳定用户 ID，无则生成匿名 ID
export async function userIdHook(req: FastifyRequest, _reply: FastifyReply) {
  const headerId = req.headers['x-user-id'];
  if (headerId && typeof headerId === 'string' && headerId.length > 0) {
    req.userId = headerId;
  } else {
    // 基于 IP + UA 生成临时匿名 ID（不持久化，仅限当前会话）
    req.userId = `anon-${req.ip}`;
  }
  req.log.debug({ userId: req.userId }, 'user-id resolved');
}
