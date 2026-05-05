/**
 * 合规网关 REST API — MCP Server 能力接入生产链路
 *
 * 将 MCP Server 的 check_compliance / security_audit 能力
 * 暴露为标准 REST 端点，供外部系统和 CI 流水线调用。
 *
 * MCP 资源映射：
 *   palm://compliance/terms   → GET  /api/compliance/terms
 *   palm://compliance/stats   → GET  /api/compliance/stats
 *   check_compliance tool     → POST /api/compliance/check
 *   security_audit   tool     → POST /api/compliance/audit
 */

import { FastifyInstance } from 'fastify';
import { defaultSafety } from '../safety/content-safety.js';

// ─── 禁用词分类 ──────────────────────────────────────

const TERM_CATEGORIES: Record<string, string[]> = {
  命理类: ['算命', '占卜', '手相', '看手相', '掌纹'],
  命运类: ['命运注定', '天注定', '宿命', '改命', '改运', '开运'],
  关系类: ['正缘', '姻缘测算', '旺夫', '旺妻', '克夫', '克妻', '天生一对'],
  绝对化: ['100%准确', '比算命更准', '必然', '一定会', '暴富'],
  灾祸类: ['寿命预测', '疾病预测', '灾祸预测', '财富暴富预测'],
};

// ─── 安全审计类型 ───────────────────────────────────

interface SecurityFinding {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: 'prompt_injection' | 'secret_leak' | 'compliance_jailbreak' | 'compliance_violation';
  detail: string;
  snippet: string;
}

interface SecurityAuditResult {
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  passed: boolean;
  findings: SecurityFinding[];
  score: number;
}

// ─── Prompt Injection 检测 ──────────────────────────

function detectPromptInjection(text: string): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const patterns: Array<{ pattern: RegExp; severity: SecurityFinding['severity']; detail: string }> = [
    { pattern: /忽略.{0,5}(?:之前|以上|所有|一切).{0,10}(?:指令|指示|要求|规则|设定|提示|内容)/i, severity: 'CRITICAL', detail: '系统指令覆盖尝试' },
    { pattern: /ignore\s+(all\s+)?(prior|previous|above)\s+(instructions|directions|prompts)/i, severity: 'CRITICAL', detail: 'System prompt override attempt' },
    { pattern: /忘记你(?:是|的角色|的设定|是谁)/i, severity: 'CRITICAL', detail: '角色劫持尝试' },
    { pattern: /DAN|do\s+anything\s+now|jailbreak/i, severity: 'CRITICAL', detail: 'DAN 越狱尝试' },
    { pattern: /(?:绕过|跳过)(?:审核|审查|过滤|安全|合规|限制)/i, severity: 'CRITICAL', detail: '安全绕过尝试' },
    { pattern: /你.{0,3}(?:现在|将|可以)扮演/i, severity: 'HIGH', detail: '角色扮演注入尝试' },
    { pattern: /(?:输出|显示|打印|展示|回复|说).{0,10}(?:你的|系统|初始|原始|系统提示).{0,10}(?:提示|指令|prompt|设定|设置|规则|词|内容)/i, severity: 'HIGH', detail: 'Prompt 泄露尝试' },
    { pattern: /(?:不用|别)(?:管|考虑|遵循|遵守|按照)/i, severity: 'MEDIUM', detail: '否定提示：试图禁用安全规则' },
  ];

  for (const p of patterns) {
    const match = p.pattern.exec(text);
    if (match) {
      findings.push({ severity: p.severity, category: 'prompt_injection', detail: p.detail, snippet: match[0].slice(0, 60) });
    }
  }
  return findings;
}

// ─── 敏感信息扫描 ──────────────────────────────────

function scanSecrets(text: string): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const mask = (s: string) => s.length <= 8 ? '***' : s.slice(0, 4) + '...' + s.slice(-4);

  const patterns: Array<{ pattern: RegExp; severity: SecurityFinding['severity']; detail: string }> = [
    { pattern: /sk-[a-zA-Z0-9]{20,}/, severity: 'CRITICAL', detail: 'API Key 泄露' },
    { pattern: /(?:api[_-]?key|apikey|secret[_-]?key)\s*[:=]\s*['"][a-zA-Z0-9_\-]{16,}['"]/i, severity: 'CRITICAL', detail: 'API Key 硬编码' },
    { pattern: /bearer\s+[a-zA-Z0-9_\-.]{20,}/i, severity: 'CRITICAL', detail: 'Bearer Token 泄露' },
    { pattern: /eyJ[a-zA-Z0-9_\-]+\.eyJ[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+/, severity: 'CRITICAL', detail: 'JWT Token 泄露' },
    { pattern: /AKIA[0-9A-Z]{16}/, severity: 'CRITICAL', detail: 'AWS Access Key 泄露' },
    { pattern: /ghp_[a-zA-Z0-9]{36}|gho_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{50,}/, severity: 'CRITICAL', detail: 'GitHub Token 泄露' },
    { pattern: /mongodb(?:\+srv)?:\/\/[^\s]+|postgresql:\/\/[^\s]+|mysql:\/\/[^\s]+|redis:\/\/[^\s]+/, severity: 'CRITICAL', detail: '数据库连接串泄露' },
    { pattern: /\d{17}[\dXx]/, severity: 'CRITICAL', detail: '身份证号泄露' },
    { pattern: /(?:password|pwd|passwd|secret|token)\s*[:=]\s*['"][^'"]{8,}['"]/i, severity: 'HIGH', detail: '密码/密钥硬编码' },
    { pattern: /1[3-9]\d{9}/, severity: 'HIGH', detail: '手机号泄露' },
    { pattern: /(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})/, severity: 'MEDIUM', detail: '内网 IP 泄露' },
  ];

  for (const p of patterns) {
    const match = p.pattern.exec(text);
    if (match) {
      findings.push({ severity: p.severity, category: 'secret_leak', detail: p.detail, snippet: mask(match[0]) });
    }
  }
  return findings;
}

// ─── 合规越狱检测 ──────────────────────────────────

function detectComplianceJailbreak(text: string): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const jailbreakPatterns: Array<{ pattern: RegExp; severity: SecurityFinding['severity']; detail: string }> = [
    { pattern: /(?:仅供|仅限|学术|研究|测试|教学|实验)(?:目的|参考|使用)[\s\S]{0,50}(?:算命|占卜|手相|掌纹)/i, severity: 'MEDIUM', detail: '以学术名义使用禁用词' },
    { pattern: /(?:虚拟|模拟|假设|演示|案例)[\s\S]{0,30}(?:算命|占卜|手相|掌纹|改运)/i, severity: 'MEDIUM', detail: '以模拟名义绕过合规' },
    { pattern: /你(?:的|是)(?:系统|程序|AI|模型|机器人)[\s\S]{0,30}(?:算命|占卜|手相|改运)/i, severity: 'MEDIUM', detail: '利用 AI 身份绕过合规' },
  ];

  for (const p of jailbreakPatterns) {
    const match = p.pattern.exec(text);
    if (match) {
      findings.push({ severity: p.severity, category: 'compliance_jailbreak', detail: p.detail, snippet: match[0].slice(0, 60) });
    }
  }
  return findings;
}

// ─── 统一安全审计 ──────────────────────────────────

function securityAudit(text: string): SecurityAuditResult {
  const findings: SecurityFinding[] = [
    ...detectPromptInjection(text),
    ...scanSecrets(text),
    ...detectComplianceJailbreak(text),
  ];

  const critical = findings.filter(f => f.severity === 'CRITICAL').length;
  const high = findings.filter(f => f.severity === 'HIGH').length;
  const score = Math.max(0, 100 - critical * 30 - high * 10 - findings.length * 2);

  return { totalFindings: findings.length, criticalCount: critical, highCount: high, passed: critical === 0 && high === 0, findings, score };
}

// ─── 路由注册 ────────────────────────────────────────

export async function complianceRoutes(app: FastifyInstance): Promise<void> {
  // 获取完整禁用词列表
  app.get('/api/compliance/terms', async (_req, reply) => {
    const allTerms = Object.values(TERM_CATEGORIES).flat();
    return reply.send({ categories: TERM_CATEGORIES, total: allTerms.length });
  });

  // 获取合规词库统计
  app.get('/api/compliance/stats', async (_req, reply) => {
    const categorized: Record<string, number> = {};
    for (const [cat, terms] of Object.entries(TERM_CATEGORIES)) {
      categorized[cat] = terms.length;
    }
    return reply.send({ totalTerms: Object.values(TERM_CATEGORIES).flat().length, categories: categorized });
  });

  // 合规文本检查
  app.post('/api/compliance/check', async (req, reply) => {
    const { text } = req.body as { text?: string };
    if (!text || typeof text !== 'string') {
      return reply.status(400).send({ error: '缺少必填字段 text' });
    }
    const result = defaultSafety.check(text);
    return reply.send(result);
  });

  // 安全审计（Prompt Injection / 敏感信息 / 合规越狱）
  app.post('/api/compliance/audit', async (req, reply) => {
    const { text } = req.body as { text?: string };
    if (!text || typeof text !== 'string') {
      return reply.status(400).send({ error: '缺少必填字段 text' });
    }
    const result = securityAudit(text);
    return reply.send(result);
  });
}
