/**
 * 多 Agent 报告分析原型 v2
 *
 * 第1版问题: spawn MCP 子进程通信复杂易挂
 * 第2版方案: in-process 直调 bridge 模块
 *
 * 架构不变: Orchestrator + 3 Workers + Shared Memory
 * 但砍掉网络层——Agent 之间不需要 JSON-RPC，直接函数调用
 *
 * 运行: npx tsx student-notebook/multi-agent-prototype-v2.ts
 * (从 mcp-servers/palm-mcp-server 目录)
 */

// 直接 import bridge 模块，不经过 MCP 协议层
import { checkTextCompliance } from '../mcp-servers/palm-mcp-server/src/compliance-bridge.js';
import { queryReports } from '../mcp-servers/palm-mcp-server/src/report-bridge.js';

// ─── 类型 ────────────────────────────────────────

interface ReportData {
  id: string;
  personaLabel: string;
  personaType: string;
  summary: string;
  coreTruth: string;
  scores: { dimension: string; score: number; label: string; description: string }[];
  insights: string[];
  weeklyAdvice: string;
  keywords: string[];
}

interface WorkerMessage {
  type: 'request' | 'response';
  from: string;
  to: string;
  taskId: string;
  payload: unknown;
}

interface ComplianceResult {
  safe: boolean;
  violations: string[];
  totalChecked: number;
}

interface QualityResult {
  score: number;
  hasVisualAnchors: boolean;
  hasCoreTruth: boolean;
  details: string[];
}

interface CaptionResult {
  identity: string;
  truth: string;
  relation: string;
  contrast: string;
}

// ─── Shared Memory ───────────────────────────────

class SharedMemory {
  private data = new Map<string, unknown>();
  set<T>(k: string, v: T): void { this.data.set(k, v); }
  get<T>(k: string): T | undefined { return this.data.get(k) as T; }
}

// ─── Worker 1: 合规审查 ──────────────────────────

function complianceWorker(msg: WorkerMessage, mem: SharedMemory): WorkerMessage {
  const report = mem.get<ReportData>('report');
  if (!report) return { ...msg, type: 'response', from: 'compliance', to: 'orchestrator', payload: { error: 'no report' } };

  const targets = [report.summary, report.coreTruth, ...report.insights];
  const allViolations: string[] = [];

  for (const t of targets) {
    const r = checkTextCompliance(t);
    if (!r.safe) allViolations.push(...r.violations);
  }

  const result: ComplianceResult = {
    safe: allViolations.length === 0,
    violations: [...new Set(allViolations)],
    totalChecked: targets.length,
  };

  mem.set('compliance', result);
  return { ...msg, type: 'response', from: 'compliance', to: 'orchestrator', payload: result };
}

// ─── Worker 2: 质量分析 ──────────────────────────

function qualityWorker(msg: WorkerMessage, mem: SharedMemory): WorkerMessage {
  const report = mem.get<ReportData>('report');
  if (!report) return { ...msg, type: 'response', from: 'quality', to: 'orchestrator', payload: { error: 'no report' } };

  const allText = [report.summary, report.coreTruth, ...report.insights].join(' ');
  const details: string[] = [];

  // 视觉锚点：引用手掌特征的具体描述
  const anchors = ['手掌', '掌心', '手指', '线条', '轮廓', '纹路', '特征'];
  const hasAnchors = anchors.some(a => allText.includes(a));
  if (!hasAnchors) details.push('缺少视觉锚点引用');

  // 核心真相：是否有非空的具体真相
  const hasTruth = report.coreTruth.length > 10;
  if (!hasTruth) details.push('核心真相为空或太短');

  // 洞察数量
  if (report.insights.length < 3) details.push(`洞察仅${report.insights.length}条，建议≥3`);

  // 空泛检查
  const generic = ['善良', '有潜力', '很好', '很棒'];
  if (generic.some(g => allText.includes(g))) details.push('包含空泛表述');

  // 分数完整性
  if (report.scores.length !== 5) details.push(`五维分数不完整: ${report.scores.length}/5`);

  let score = 100;
  if (!hasAnchors) score -= 25;
  if (!hasTruth) score -= 20;
  if (report.insights.length < 3) score -= 15;
  if (details.some(d => d.includes('空泛'))) score -= 10;
  if (report.scores.length !== 5) score -= 10;

  const result: QualityResult = {
    score: Math.max(0, score),
    hasVisualAnchors: hasAnchors,
    hasCoreTruth: hasTruth,
    details,
  };

  mem.set('quality', result);
  return { ...msg, type: 'response', from: 'quality', to: 'orchestrator', payload: result };
}

// ─── Worker 3: 文案生成 ──────────────────────────

function captionWorker(msg: WorkerMessage, mem: SharedMemory): WorkerMessage {
  const report = mem.get<ReportData>('report');
  if (!report) return { ...msg, type: 'response', from: 'caption', to: 'orchestrator', payload: { error: 'no report' } };

  const templates: Record<string, CaptionResult> = {
    thoughtful_guardian: {
      identity: `我是${report.personaLabel}——想太多不是病，是超能力`,
      truth: '你看起来很好说话，但心里有张评分表，每个人都被你默默打过分数',
      relation: '最适合和自由探索者做朋友——他们负责拉你出门，你负责提醒他们看路',
      contrast: '表面随和好商量，内心原则性极强',
    },
    free_explorer: {
      identity: `我是${report.personaLabel}——人生不是轨道，是旷野`,
      truth: '你以为你随性，其实你只是懒得计较——真踩到你底线，你比谁都果断',
      relation: '最适合和思虑守护者做朋友——他们帮你兜底，你带他们冒险',
      contrast: '表面大大咧咧，其实心里门儿清',
    },
  };

  const result = templates[report.personaType] || {
    identity: `我是${report.personaLabel}`,
    truth: '你比你想象中更复杂，也比你表现出来更简单',
    relation: '和你同频的人比你以为的更多',
    contrast: '你以为的自己 vs 别人眼中的你，可能是两个人',
  };

  mem.set('captions', result);
  return { ...msg, type: 'response', from: 'caption', to: 'orchestrator', payload: result };
}

// ─── Orchestrator ────────────────────────────────

async function main() {
  const reportId = process.argv[2] || 'demo-001';
  const mem = new SharedMemory();

  console.log('═'.repeat(54));
  console.log('  多 Agent 报告分析 v2 (in-process)');
  console.log('═'.repeat(54));

  // Step 1: 获取报告数据
  const start = Date.now();
  const reports = queryReports({ id: reportId });
  const report = reports[0] as unknown as ReportData | undefined;
  if (!report) { console.error('❌ 报告未找到'); return; }

  mem.set('report', report);
  console.log(`  📄 ${report.personaLabel} (${report.personaType})`);
  console.log(`     ${report.scores.map(s => `${s.dimension}=${s.score}`).join(' · ')}`);

  // Step 2: 并行派发3个Worker (实际是顺序调用，但接口统一)
  const msg: WorkerMessage = { type: 'request', from: 'orchestrator', to: 'all', taskId: reportId, payload: reportId };

  const [cr, qr, cap] = await Promise.all([
    Promise.resolve(complianceWorker(msg, mem)),
    Promise.resolve(qualityWorker(msg, mem)),
    Promise.resolve(captionWorker(msg, mem)),
  ]);

  // Step 3: 输出KPI卡
  const elapsed = Date.now() - start;
  const c = cr.payload as ComplianceResult;
  const q = qr.payload as QualityResult;
  const cp = cap.payload as CaptionResult;

  console.log('\n  ┌──────────────────────────────────────────────────┐');
  console.log(`  │ 📊 KPI 卡${' '.repeat(42)}│`);
  console.log('  ├──────────────────────────────────────────────────┤');
  console.log(`  │ Report ID     ${reportId.padEnd(35)}│`);
  console.log(`  │ 人格          ${(report.personaLabel + ' (' + report.personaType + ')').padEnd(33)}│`);
  console.log(`  │ 处理耗时      ${String(elapsed).padEnd(3)}ms${' '.repeat(31)}│`);
  console.log(`  │ Worker 数     3 (合规/质量/文案)${' '.repeat(22)}│`);
  console.log('  ├──────────────────────────────────────────────────┤');
  console.log(`  │ 合规审查      ${c.safe ? '✅ 通过' : '❌ ' + c.violations.join(',')}${' '.repeat(34)}│`);
  console.log(`  │ 质量评分      ${q.score}/100${' '.repeat(36)}│`);
  console.log(`  │ 视觉锚点      ${q.hasVisualAnchors ? '✅ 有' : '❌ 无'} · 核心真相 ${q.hasCoreTruth ? '✅' : '❌'}${' '.repeat(28)}│`);
  console.log(`  │ 文案产出      ${cp.identity.slice(0, 36)}${' '.repeat(4)}│`);
  console.log(`  │              ${cp.truth.slice(0, 36)}${' '.repeat(4)}│`);
  console.log('  └──────────────────────────────────────────────────┘');

  // 复盘
  console.log('\n  📋 知识映射:');
  console.log('    第2课 MCP:     ✓ bridge 模块直连 (不经过网络层)');
  console.log('    第3课 多Agent: ✓ Orchestrator + 3 Workers + Shared Memory');
  console.log('    第4课 Skill:   ✓ 合规审查+质量门禁+文案生成');
  console.log('    第5课 论文:    ✓ 每阶段可验证 (SWE-bench启示)');
}

main().catch(err => { console.error('❌', err); process.exit(1); });
