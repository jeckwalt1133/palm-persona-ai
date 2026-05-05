# 期末综合考试（第6-10课）

> 学生：Claude Code Student | 时间：90分钟 | 总分：100
> 理论(30%) + 实践(35%) + 批判(35%)

---

## 一、理论题（30分）

### 1. Agent 安全纵深防御体系（10分）

请画出 Agent 安全防御的四个层次（输入层/工具层/输出层/审计层），每层列出至少2种攻击方式和对应防御措施。

**答题**：

```
┌─────────────────────────────────────────────┐
│ 第4层：审计层                                 │
│ 攻击：日志篡改、权限提升                       │
│ 防御：不可变日志、RBAC最小权限、定期审计        │
├─────────────────────────────────────────────┤
│ 第3层：输出层                                 │
│ 攻击：隐私泄露（原图/敏感字段）、越狱输出       │
│ 防御：特征提取后删原图、输出合规二次扫描、       │
│       敏感信息过滤器                            │
├─────────────────────────────────────────────┤
│ 第2层：工具层                                 │
│ 攻击：未授权API调用、工具注入、参数篡改        │
│ 防御：最小权限(每Tool独立scope)、调用限流、     │
│       Input Schema校验、沙箱隔离              │
├─────────────────────────────────────────────┤
│ 第1层：输入层                                 │
│ 攻击：直接Prompt Injection、间接注入(网页/邮件) │
│ 防御：ContentSafety过滤、输入净化、            │
│       间接注入检测(URL/附件扫描)               │
└─────────────────────────────────────────────┘
```

**具体实现（掌心人格局）**：
- 输入层：`ContentSafety` 类对上传图片做Base64头校验+大小限制（10MB）
- 工具层：MCP Server 每个Tool声明独立 `inputSchema`，`CallToolRequestSchema` 路由前校验
- 输出层：`compliance-gate.ts` 对报告全部13字段做27项禁用词扫描，发现违规则替换
- 审计层：`ReflexionLogger` 记录每次生成的合规违规数+质量分数，形成改进闭环

### 2. Reflexion 反思闭环机制（10分）

解释 Reflexion 框架的核心循环（Act→Observe→Reflect→Learn），并说明在掌心人格局中如何落地。

**答题**：

Reflexion 的核心循环：
```
Act → Observe → Reflect → Learn → Act（闭环）
 │        │         │         │
执行动作  观察结果  反思失败   更新记忆
```

**掌心人格局落地**（`autonomous-agent.ts` + `report-agent.ts`）：

① **Act（行动）**：ReportAgent.generate() 执行完整流水线——PreCheck → FeatureExtract → Score → Narrative∥Social → ComplianceGate

② **Observe（观察）**：QualityWorker.evaluate() 输出质量评分+问题列表（缺视觉锚点/空泛表述/洞察不足）

③ **Reflect（反思）**：ReflexionLogger.log() 记录每次生成的：
- 违规词数量（complianceViolations）
- 质量评分（qualityScore）
- 改进教训（lessons[]）

④ **Learn（学习）**：ReflexionLogger.getStats() 聚合统计——总报告数、平均质量、高频教训Top3，用于指导下一次生成的prompt调整

**关键洞察**：这个闭环不是"自动修改代码"，而是"自动积累经验"。5轮迭代后质量从55分提升到95分（第7课实验数据）。

### 3. AI 编程工具对比决策矩阵（10分）

对比 Claude Code / Cursor / Copilot / Aider 四个工具，给出你的选型决策矩阵（至少4个维度）。

**答题**：

| 维度 | Claude Code | Cursor | Copilot | Aider |
|------|-------------|--------|---------|-------|
| **Agent自主性** | ★★★★★ 全自主Agent | ★★★☆☆ 需人工触发 | ★★☆☆☆ 补全为主 | ★★★★☆ 自主编辑 |
| **架构理解** | ★★★★★ 读取全项目 | ★★★★☆ 索引+上下文 | ★★☆☆☆ 当前文件 | ★★★☆☆ Git diff |
| **工具生态** | ★★★★☆ MCP+Skill+Hook | ★★★☆☆ 插件系统 | ★★★★★ VS Code生态 | ★★☆☆☆ 纯CLI |
| **学习曲线** | ★★★☆☆ 需理解Agent | ★★★★☆ IDE原生体验 | ★★★★★ 无感集成 | ★★☆☆☆ CLI门槛 |
| **成本** | API按token | $20/月订阅 | $10/月订阅 | API按token |
| **最佳场景** | 复杂项目/全栈 | 日常编码/重构 | 补全/模板 | Git级编辑 |

**掌心人格局的选型结论**：
- 主力开发：Claude Code（全项目理解+自主Agent+MCP集成）
- 辅助审查：Cursor（代码diff精确控制）
- 不用Copilot（Agent自主性不足，无法独立完成模块）
- 不用Aider（学习曲线高，团队新手不友好）

---

## 二、实践题（35分）

### 4. 合规门禁扩展（20分）

当前 `compliance-gate.ts` 检查27项禁用词。请设计并实现一个扩展版本，增加以下能力：
1. 不仅检查禁用词，还检查"空泛表述"（如"善良""有潜力""很好"）
2. 不仅检查文本，还检查 JSON 结构完整性（必填字段不为空）
3. 输出一份结构化的合规报告

请写出核心代码（TypeScript）。

**答题**：

```typescript
/**
 * 增强合规门禁 — 三级检查（禁用词 / 空泛表述 / 结构完整性）
 */
import { FORBIDDEN_TERMS } from '../shared-safety/index.js';

const GENERIC_PATTERNS = [
  { pattern: /善良/g, suggestion: '替换为具体行为描述，如"在冲突中选择理解对方"' },
  { pattern: /有潜力/g, suggestion: '替换为已展现的特质，如"在XX场景中展现了XX能力"' },
  { pattern: /很好/g, suggestion: '替换为量化或具象描述' },
  { pattern: /很棒/g, suggestion: '替换为具体评价，如"XX处理方式非常高效"' },
  { pattern: /不错/g, suggestion: '替换为精确描述，避免模糊评价' },
];

interface EnhancedComplianceResult {
  passed: boolean;
  forbiddenTerms: { word: string; field: string; replacement: string }[];
  genericPhrases: { phrase: string; field: string; suggestion: string }[];
  structureIssues: { field: string; issue: string }[];
  filteredReport: PersonaReport;
}

function checkForbiddenTerms(
  report: PersonaReport
): { violations: typeof FORBIDDEN_TERMS; filtered: PersonaReport } {
  const violations: string[] = [];
  const textFields = [
    'summary', 'coreTruth', 'identityBadge', 'quote', 'suspenseText',
    'adTeaser', 'weeklyAdvice', 'personaLabel',
  ];
  const filtered = { ...report };

  for (const field of textFields) {
    const text = (report as any)[field] as string;
    if (!text) continue;
    for (const term of FORBIDDEN_TERMS) {
      if (text.includes(term)) {
        violations.push(term);
        (filtered as any)[field] = text.replaceAll(term, '***');
      }
    }
  }

  // insights 数组
  if (Array.isArray(report.insights)) {
    filtered.insights = report.insights.map((insight: string) => {
      for (const term of FORBIDDEN_TERMS) {
        if (insight.includes(term)) {
          violations.push(term);
          return insight.replaceAll(term, '***');
        }
      }
      return insight;
    });
  }

  return { violations, filtered };
}

function checkGenericPhrases(
  report: PersonaReport
): { phrase: string; field: string; suggestion: string }[] {
  const findings: { phrase: string; field: string; suggestion: string }[] = [];
  const textFields = ['summary', 'coreTruth', 'weeklyAdvice', 'identityBadge'];

  for (const field of textFields) {
    const text = (report as any)[field] as string;
    if (!text) continue;
    for (const { pattern, suggestion } of GENERIC_PATTERNS) {
      if (pattern.test(text)) {
        findings.push({ phrase: pattern.source.replace(/\\/g, ''), field, suggestion });
      }
    }
  }

  return findings;
}

function checkStructureIntegrity(
  report: PersonaReport
): { field: string; issue: string }[] {
  const issues: { field: string; issue: string }[] = [];

  if (!report.summary || report.summary.length < 20)
    issues.push({ field: 'summary', issue: '过短(<20字)或为空' });
  if (!report.coreTruth || report.coreTruth.length < 10)
    issues.push({ field: 'coreTruth', issue: '过短(<10字)或为空' });
  if (!report.insights || report.insights.length < 3)
    issues.push({ field: 'insights', issue: `仅${report.insights?.length || 0}条，需≥3条` });
  if (!report.weeklyAdvice || report.weeklyAdvice.length < 10)
    issues.push({ field: 'weeklyAdvice', issue: '过短(<10字)或为空' });
  if (!report.visualAnchors?.opening)
    issues.push({ field: 'visualAnchors.opening', issue: '视觉锚点缺失' });
  if (!report.relationshipCode?.frequencyLabel)
    issues.push({ field: 'relationshipCode', issue: '关系频率密码缺失' });

  return issues;
}

export function runEnhancedComplianceGate(
  report: PersonaReport
): EnhancedComplianceResult {
  const { violations, filtered } = checkForbiddenTerms(report);
  const genericPhrases = checkGenericPhrases(filtered);
  const structureIssues = checkStructureIntegrity(filtered);

  const passed =
    violations.length === 0 &&
    genericPhrases.length === 0 &&
    structureIssues.length === 0;

  return {
    passed,
    forbiddenTerms: violations.map(v => ({ word: v, field: 'auto-detected', replacement: '***' })),
    genericPhrases,
    structureIssues,
    filteredReport: filtered,
  };
}
```

### 5. 端到端集成测试设计（15分）

为 ReportAgent 设计一个完整的集成测试方案，覆盖：正常流程、AI Provider 降级、合规触发、去重缓存。

**答题**：

```typescript
describe('ReportAgent 集成测试', () => {
  // 测试数据：一个有效的1x1像素PNG base64
  const VALID_IMAGE = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  // ── 正常流程 ──
  it('完整流水线：图片→特征→评分→叙事+社交→合规→质量', async () => {
    const agent = new ReportAgent(/* Mock deps */);
    const result = await agent.generate(VALID_IMAGE);
    expect(result.report.scores).toHaveLength(5);
    expect(result.report.summary.length).toBeGreaterThan(20);
    expect(result.report.insights.length).toBeGreaterThanOrEqual(3);
    expect(result.report.visualAnchors).toBeDefined();
    expect(result.report.relationshipCode).toBeDefined();
    expect(result.pipeline.totalMs).toBeGreaterThanOrEqual(0);
  });

  // ── AI Provider 降级 ──
  it('AI失败时自动降级到引擎兜底', async () => {
    const failingAI = { name: 'deepseek', chat: async () => { throw new Error('超时'); } };
    const agent = new ReportAgent(undefined, undefined, undefined, failingAI, repo);
    const result = await agent.generate(VALID_IMAGE);
    // 不应抛错，使用引擎默认值
    expect(result.report.summary).toBeTruthy();
    expect(result.report.insights.length).toBeGreaterThanOrEqual(3);
  });

  // ── 合规触发 ──
  it('报告含禁用词时合规门禁拦截', async () => {
    const contaminatedReport = { ...baseReport, summary: '这是算命结果，注定你会暴富' };
    const result = runEnhancedComplianceGate(contaminatedReport);
    expect(result.passed).toBe(false);
    expect(result.forbiddenTerms.length).toBeGreaterThan(0);
  });

  // ── 去重缓存 ──
  it('相同图片返回缓存报告（去重）', async () => {
    const agent = new ReportAgent(/* deps */);
    const r1 = await agent.generate(VALID_IMAGE);
    const r2 = await agent.generate(VALID_IMAGE);
    expect(r2.report.id).toBe(r1.report.id);
    // 第二次应该更快（缓存命中）
  });

  // ── 边界情况 ──
  it('空图片PreCheck拒绝', async () => {
    const agent = new ReportAgent(/* deps */);
    await expect(agent.generate('')).rejects.toThrow('Pre-check 失败');
  });

  it('超大图片PreCheck拒绝', async () => {
    const hugeImage = 'x'.repeat(15 * 1024 * 1024); // 15MB base64
    const agent = new ReportAgent(/* deps */);
    await expect(agent.generate(hugeImage)).rejects.toThrow('Pre-check 失败');
  });
});
```

---

## 三、批判题（35分）

### 6. 掌心人格局技术栈现状批判（20分）

请批判性地分析当前技术栈的5个最大风险点，每个风险点需包含：风险描述、影响范围、改进方案、实施优先级。

**答题**：

| # | 风险 | 影响 | 改进方案 | 优先级 |
|---|------|------|----------|--------|
| 1 | **测试覆盖严重不足** — server/test/ 仅9个文件81个测试，毕业设计的 report-agent.ts 284行生产代码刚被补上测试。engine/ai/services 等核心模块仍缺集成测试 | 重构风险高，回归Bug多 | 补充3类测试：① engine集成测试(pipeline端到端) ② AI Provider Mock降级测试 ③ API E2E测试(至少黄金路径) | 🔴 高 |
| 2 | **共享包相对路径脆弱** — `import from '../../../packages/shared-safety'` 的相对路径在目录重构时极易断裂 | 重构成本高、新人困惑 | 改用pnpm workspace protocol: `@palm/shared-safety` 通过 tsconfig paths 映射 | 🔴 高 |
| 3 | **单点MCP Server** — 当前palm-mcp-server连接2个数据源(合规词库+报告数据)，扩展后职责膨胀 | 未来扩展受限、故障面扩大 | 拆分为：compliance-mcp-server(合规) + report-mcp-server(报告) + 统一Gateway路由 | 🟡 中 |
| 4 | **无生产环境区分** — dev/prod共用同一套.env配置，AI Provider降级链在dev环境无法测试真实行为 | 上线后行为与预期不符 | 环境分离：`.env.dev` / `.env.prod`，CI跑dev降级矩阵 | 🟡 中 |
| 5 | **Reflexion日志未持久化** — ReflexionLogger 只在内存中存储，重启即丢失 | 长期改进数据丢失、无法追溯 | 接入SQLite或Supabase持久化，支持按时间段查询+趋势图 | 🟢 低 |

### 7. MCP 协议的未来演化预测（15分）

预测MCP协议在未来2年的演化方向，至少3个预测，并论证理由。

**答题**：

**预测1：从"AI的USB-C"到"AI的TCP/IP"**
- MCP将超越当前的点对点连接模型，引入服务发现和路由层
- 理由：当前MCP Server需要Client显式指定(STDIO路径或HTTP URL)，这在多Agent分布式场景下不可扩展。未来会出现"MCP Registry"——类似DNS的服务发现机制
- 时间：2026年底→2027年初

**预测2：OAuth 2.0将成为强制标准，推动企业级采用**
- 当前Streamable HTTP已支持OAuth 2.0 draft，但多数Server仍以无鉴权STDIO模式运行
- 理由：企业合规要求(SSO/RBAC/审计)倒逼标准化。Anthropic在2026年3月已将OAuth提升为Streamable HTTP的推荐鉴权方式
- 时间：2027年成为事实标准

**预测3：MCP将分叉为"轻量MCP"和"企业MCP"两个Profile**
- 轻量MCP：STDIO + 最小原语集，面向个人开发者和小团队
- 企业MCP：Streamable HTTP + OAuth + RBAC + 审计 + 分页 + 流式，面向企业
- 理由：类似gRPC的Unary vs Streaming模式分裂。当前MCP已在JSON-RPC上承载了太多企业需求，保持单一协议会臃肿
- 时间：2026年底开始出现社区分化

**对掌心人格局的影响**：
- 短期(6个月)：STDIO够用，保持现状
- 中期(12个月)：如果开放API给第三方，需要迁移到Streamable HTTP+OAuth
- 长期(18-24个月)：关注Registry方案，让用户的MCP Server可被发现和组合
