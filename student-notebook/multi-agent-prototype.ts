/**
 * 多 Agent 报告分析原型
 *
 * 整合：第2课 MCP 数据源 + 第3课 Orchestrator-Workers 模式 + 第4课 Skill 审查
 *
 * 架构：
 *   Orchestrator → 接收报告ID → 派发到3个Worker → 汇总结果
 *   ├─ Worker 1: ComplianceChecker (合规审查)
 *   ├─ Worker 2: QualityAnalyzer (质量分析)
 *   └─ Worker 3: CaptionGenerator (文案生成)
 *
 * 通信方式: 消息传递 (结构化 Message)
 * 数据共享: 共享 Memory 对象
 *
 * 运行: npx tsx student-notebook/multi-agent-prototype.ts
 */

import { spawn, ChildProcess } from 'child_process';

// ─── 类型定义 ─────────────────────────────────────

interface Message {
  type: 'request' | 'response' | 'error';
  from: string;
  to: string;
  taskId: string;
  payload: unknown;
  timestamp: string;
}

interface ReportData {
  id: string;
  personaLabel: string;
  personaType: string;
  summary: string;
  coreTruth: string;
  scores: { dimension: string; score: number; label: string; description: string }[];
  insights: string[];
  keywords: string[];
}

interface ComplianceResult {
  safe: boolean;
  violations: string[];
  filteredText: string;
}

interface QualityResult {
  score: number;
  hasVisualAnchors: boolean;
  hasCoreTruth: boolean;
  hasActionableAdvice: boolean;
  issues: string[];
}

interface CaptionResult {
  identity: string;
  truth: string;
  relation: string;
  contrast: string;
}

// ─── MCP Client 工具 ─────────────────────────────

class McpClient {
  private proc: ChildProcess | null = null;
  private msgId = 0;

  async connect(): Promise<void> {
    this.proc = spawn('npx', ['tsx', 'src/index.ts'], {
      cwd: '/mnt/d/Claude/Workspace/palm-persona-ai/mcp-servers/palm-mcp-server',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    // 等待启动
    await new Promise(r => setTimeout(r, 800));
    // 发送 initialize
    const init = await this.send({
      jsonrpc: '2.0',
      id: this.nextId(),
      method: 'initialize',
      params: {
        protocolVersion: '2025-05-24',
        capabilities: {},
        clientInfo: { name: 'multi-agent-prototype', version: '1.0' },
      },
    });
    if (!init?.result?.capabilities) throw new Error('MCP Server 握手失败');
  }

  private nextId(): number {
    return ++this.msgId;
  }

  private send(msg: object): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.proc) return reject(new Error('Not connected'));
      const data = JSON.stringify(msg) + '\n';
      let buf = '';
      const timeout = setTimeout(() => { cleanup(); reject(new Error('MCP 超时')); }, 5000);
      const onData = (chunk: Buffer) => {
        buf += chunk.toString();
        try { clearTimeout(timeout); cleanup(); resolve(JSON.parse(buf)); }
        catch { /* 还没收完 */ }
      };
      const cleanup = () => { this.proc?.stdout?.removeListener('data', onData); };
      this.proc.stdout?.on('data', onData);
      this.proc.stdin?.write(data);
    });
  }

  async getReport(id: string): Promise<ReportData> {
    const resp = await this.send({
      jsonrpc: '2.0',
      id: this.nextId(),
      method: 'resources/read',
      params: { uri: `palm://reports/${id}` },
    });
    const text = resp?.result?.contents?.[0]?.text;
    if (!text) throw new Error(`报告 ${id} 获取失败`);
    return JSON.parse(text);
  }

  async checkCompliance(text: string): Promise<ComplianceResult> {
    const resp = await this.send({
      jsonrpc: '2.0',
      id: this.nextId(),
      method: 'tools/call',
      params: {
        name: 'check_compliance',
        arguments: { text },
      },
    });
    const result = resp?.result?.content?.[0]?.text;
    return JSON.parse(result);
  }

  disconnect(): void {
    this.proc?.kill();
  }
}

// ─── Shared Memory ────────────────────────────────

class SharedMemory {
  private store: Map<string, unknown> = new Map();

  set<T>(key: string, value: T): void {
    this.store.set(key, value);
  }

  get<T>(key: string): T | undefined {
    return this.store.get(key) as T | undefined;
  }
}

// ─── Message 工具 ─────────────────────────────────

function makeMsg(from: string, to: string, taskId: string, payload: unknown): Message {
  return { type: 'request', from, to, taskId, payload, timestamp: new Date().toISOString() };
}

function responseMsg(from: string, to: string, taskId: string, payload: unknown): Message {
  return { type: 'response', from, to, taskId, payload, timestamp: new Date().toISOString() };
}

// ─── Worker 1: 合规审查 ───────────────────────────

async function complianceWorker(
  msg: Message,
  memory: SharedMemory,
  mcp: McpClient,
): Promise<Message> {
  const reportId = msg.payload as string;
  const report = memory.get<ReportData>(`report:${reportId}`);
  if (!report) return { ...msg, type: 'error', payload: '报告数据未找到' };

  // 检查报告各字段
  const textsToCheck = [
    report.summary,
    report.coreTruth,
    ...report.insights,
    ...report.keywords,
  ];

  const allViolations: string[] = [];
  for (const text of textsToCheck) {
    const result = await mcp.checkCompliance(text);
    if (!result.safe) allViolations.push(...result.violations);
  }

  const uniqueViolations = [...new Set(allViolations)];
  const result = {
    safe: uniqueViolations.length === 0,
    violations: uniqueViolations,
    totalChecked: textsToCheck.length,
    reportId,
  };

  memory.set(`compliance:${reportId}`, result);
  return responseMsg('compliance-worker', 'orchestrator', reportId, result);
}

// ─── Worker 2: 质量分析 ──────────────────────────

async function qualityWorker(
  msg: Message,
  memory: SharedMemory,
): Promise<Message> {
  const reportId = msg.payload as string;
  const report = memory.get<ReportData>(`report:${reportId}`);
  if (!report) return { ...msg, type: 'error', payload: '报告数据未找到' };

  const issues: string[] = [];

  // 1. 视觉锚点检查 (有没有引用具体特征)
  const anchorKeywords = ['手掌', '掌心', '手指', '拇指', '线条', '纹路', '特征', '轮廓'];
  const allText = [report.summary, report.coreTruth, ...report.insights].join(' ');
  const hasVisualAnchors = anchorKeywords.some(k => allText.includes(k));

  // 2. 核心真相存在性
  const hasCoreTruth = report.coreTruth.length > 10;

  // 3. 可操作建议
  const hasActionableAdvice = report.insights.length >= 3;

  // 4. 空泛检查 (避免"你是一个善良的人"这类空话)
  const genericPhrases = ['善良', '有潜力', '很好的人', '很棒'];
  const hasGeneric = genericPhrases.some(p => allText.includes(p));
  if (hasGeneric) issues.push('包含空泛表述（善良/有潜力等）');

  // 5. 五维分数一致性
  if (report.scores.length !== 5) issues.push(`五维分数不完整：${report.scores.length}/5`);

  // 计算总分 (加权)
  let score = 100;
  if (!hasVisualAnchors) score -= 20;
  if (!hasCoreTruth) score -= 20;
  if (!hasActionableAdvice) score -= 15;
  if (hasGeneric) score -= 10;
  if (issues.length > 0) score -= issues.length * 5;

  const result: QualityResult = {
    score: Math.max(0, score),
    hasVisualAnchors,
    hasCoreTruth,
    hasActionableAdvice,
    issues,
  };

  memory.set(`quality:${reportId}`, result);
  return responseMsg('quality-worker', 'orchestrator', reportId, result);
}

// ─── Worker 3: 文案生成 ──────────────────────────

async function captionWorker(
  msg: Message,
  memory: SharedMemory,
): Promise<Message> {
  const reportId = msg.payload as string;
  const report = memory.get<ReportData>(`report:${reportId}`);
  if (!report) return { ...msg, type: 'error', payload: '报告数据未找到' };

  const label = report.personaLabel;

  // 基于人格类型生成文案模板
  const captions: Record<string, CaptionResult> = {
    thoughtful_guardian: {
      identity: `我是${label}——想太多不是病，是超能力`,
      truth: '你看起来很好说话，但心里有张评分表，每个人都被你默默打过分数',
      relation: `最适合和自由探索者做朋友——他们负责拉你出门，你负责提醒他们看路`,
      contrast: '表面随和好商量，内心原则性极强——你只是不想把力气花在争辩上',
    },
    free_explorer: {
      identity: `我是${label}——人生不是轨道，是旷野`,
      truth: `你以为你随性，其实你只是懒得计较——真踩到你底线，你比谁都果断`,
      relation: '最适合和思虑守护者做朋友——他们帮你兜底，你带他们冒险',
      contrast: '表面大大咧咧什么都不在乎，其实心里门儿清——只是选择不计较',
    },
  };

  const result = captions[report.personaType] || {
    identity: `我是${label}`,
    truth: '你比你想象中更复杂——也比你表现出来更简单',
    relation: '你的社交圈比你以为的更广',
    contrast: '你以为的自己 vs 别人眼中的你，可能是两个人',
  };

  memory.set(`captions:${reportId}`, result);
  return responseMsg('caption-worker', 'orchestrator', reportId, result);
}

// ─── Orchestrator ─────────────────────────────────

async function orchestrator(reportId: string): Promise<void> {
  console.log(`\n🤖 [Orchestrator] 启动分析任务: ${reportId}`);
  const startTime = Date.now();

  // 初始化
  const mcp = new McpClient();
  const memory = new SharedMemory();
  const workers: Promise<Message>[] = [];

  try {
    // Step 1: 获取报告数据 (MCP Resource)
    console.log(`  ├─ 步骤1: 从 MCP Server 获取报告数据...`);
    const report = await mcp.getReport(reportId);
    memory.set(`report:${reportId}`, report);
    console.log(`  │  报告: ${report.personaLabel} (${report.personaType})`);
    console.log(`  │  分数: ${report.scores.map(s => `${s.dimension}=${s.score}`).join(', ')}`);
    console.log(`  │  关键词: ${report.keywords.join(', ')}`);

    // Step 2: 并行派发3个Worker
    console.log(`  ├─ 步骤2: 并行派发 Worker...`);

    const msg = makeMsg('orchestrator', 'all', reportId, reportId);
    workers.push(complianceWorker(msg, memory, mcp));
    workers.push(qualityWorker(msg, memory));
    workers.push(captionWorker(msg, memory));

    const results = await Promise.all(workers);

    // Step 3: 汇总结果
    console.log(`  ├─ 步骤3: 汇总分析结果...`);

    for (const r of results) {
      switch (r.from) {
        case 'compliance-worker': {
          const cr = r.payload as ComplianceResult & { totalChecked: number; reportId: string };
          console.log(`  │  [合规审查] ${cr.safe ? '✅ 通过' : '❌ 违规'}`);
          if (cr.violations.length > 0) {
            console.log(`  │    违规词: ${cr.violations.join(', ')}`);
          }
          console.log(`  │    检查文本数: ${cr.totalChecked}`);
          break;
        }
        case 'quality-worker': {
          const qr = r.payload as QualityResult;
          console.log(`  │  [质量分析] 总分: ${qr.score}/100`);
          console.log(`  │    视觉锚点: ${qr.hasVisualAnchors ? '✅' : '❌'} | 核心真相: ${qr.hasCoreTruth ? '✅' : '❌'} | 可操作建议: ${qr.hasActionableAdvice ? '✅' : '❌'}`);
          if (qr.issues.length > 0) {
            qr.issues.forEach(i => console.log(`  │    问题: ${i}`));
          }
          break;
        }
        case 'caption-worker': {
          const cap = r.payload as CaptionResult;
          console.log(`  │  [文案生成]`);
          console.log(`  │    🏷️  ${cap.identity}`);
          console.log(`  │    🔍  ${cap.truth}`);
          console.log(`  │    🤝  ${cap.relation}`);
          console.log(`  │    ⚡  ${cap.contrast}`);
          break;
        }
      }
    }

    // Step 4: 输出完整报告
    const elapsed = Date.now() - startTime;
    console.log(`  └─ ✅ 分析完成 (${elapsed}ms)`);

    // 最终 KPI 卡
    console.log('\n' + '='.repeat(56));
    console.log('  📊 多Agent报告分析 — KPI 卡');
    console.log('='.repeat(56));
    const cr = memory.get<ComplianceResult & { totalChecked: number }>(`compliance:${reportId}`);
    const qr = memory.get<QualityResult>(`quality:${reportId}`);
    const cap = memory.get<CaptionResult>(`captions:${reportId}`);
    console.log(`  ReportID      ${reportId}`);
    console.log(`  人格标签      ${report.personaLabel}`);
    console.log(`  合规状态      ${cr?.safe ? '✅ 通过' : '❌ 需修改'}`);
    console.log(`  质量评分      ${qr?.score}/100`);
    console.log(`  文案产出      4条 (${Object.keys(cap || {}).length}/4)`);
    console.log(`  处理耗时      ${elapsed}ms`);
    console.log(`  Worker数量    3 (并行度: 3/3)`);
    console.log('='.repeat(56));

  } finally {
    mcp.disconnect();
  }
}

// ─── 主入口 ──────────────────────────────────────

async function main() {
  const reportId = process.argv[2] || 'demo-001';
  console.log('═'.repeat(56));
  console.log('  多 Agent 报告分析系统原型 v1.0');
  console.log('═'.repeat(56));
  console.log(`  Orchestrator-Workers 模式 | MCP 数据源 | 3 Workers`);
  console.log('═'.repeat(56));

  await orchestrator(reportId);

  console.log('\n  📋 复盘:');
  console.log('    第2课 MCP: ✓ 通过 MCP Client 获取报告+合规检查');
  console.log('    第3课 多Agent: ✓ Orchestrator + 3 Workers + Shared Memory');
  console.log('    第4课 Skill: ✓ 审查逻辑贯穿合规/质量/文案');
  console.log('    第5课 论文: ✓ SWE-bench启示→可验证的审查标准');
}

main().catch(err => {
  console.error('❌ 原型执行失败:', err);
  process.exit(1);
});
