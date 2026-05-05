# 期中考试速查手册

> 3页纸 | 理论(30%) + 实践(35%) + 批判(35%)

---
## 第1页 · 理论核心

### MCP 协议架构
```
┌─────────────┐     ┌──────────────────┐
│  LLM Host   │ ←→ │  MCP Client/SDK  │
│(Claude/CLI) │     │  JSON-RPC 2.0    │
└─────────────┘     └────────┬─────────┘
                    ┌────────┴──────────┐
                    │  MCP Server (SDK)  │
                    │  Tools | Res | Prm │
                    └────────┬──────────┘
                    ┌────────┴──────────┐
                    │    Data Bridge     │
                    │  (项目共享包 import) │
                    └───────────────────┘
```
- **传输层**: STDIO(本地) / Streamable HTTP(远程)
- **原语**: Tools(操作) → Resources(数据) → Prompts(模板)
- **生命周期**: initialize → list → call/read/get → notifications
- **Capabilities 声明**: server创建时声明支持的协议能力

### 多Agent协作模式决策树
```
任务有清晰流水线阶段？
  ├─ 是 → 阶段间强依赖？
  │       ├─ 是 → Orchestrator-Workers
  │       └─ 否 → Fan-out (仍用Orchestrator)
  └─ 否 → 需要多轮迭代质量提升？
          ├─ 是 → Evaluator-Optimizer
          └─ 否 → 单Agent足够
```

### 三大框架一句话
| 框架 | 核心 | 通信 | 最佳场景 |
|------|------|------|---------|
| MetaGPT | SOP角色扮演 | 共享消息池 | 软件工程 |
| CrewAI | 灵活角色编排 | 顺序/层次化 | 通用业务 |
| AutoGen | 多Agent对话 | GroupChat | 研究/辩论 |

### Agent 通信: 消息传递 vs 共享内存
- **消息传递**: 解耦+可追溯+可伸缩+容错 / 序列化开销+需约定Schema
- **共享内存**: 高性能+天然共享+持久化 / 耦合+竞争条件+难调试
- **推荐**: 混合方案(消息传递保证流程顺序 + 共享内存共享报告数据)

### Skill / Hook / MCP 对比
| 维度 | Skill | Hook | MCP |
|------|-------|------|-----|
| 本质 | 上下文注入 | 事件响应 | 数据/工具服务 |
| 触发 | 斜杠/自动 | 系统事件 | JSON-RPC |
| 输出 | 影响LLM行为 | 执行Shell命令 | 返回结构化数据 |
| 复杂度 | 低(Markdown) | 中(Shell) | 高(TypeScript SDK) |

### Skill 格式
```markdown
---
name: skill-name
description: 一句话描述触发条件
---
## 步骤
### 1. 阶段名
- [ ] checklist项
### 2. 阶段名
- [ ] checklist项
```

### Hook 8种生命周期
PreSession → SessionStart → UserPromptSubmit → PreToolUse → PostToolUse → AssistantMessage → SessionStop → PostSession

---
## 第2页 · 实践模板

### MCP Server 最小骨架 (1T+1R+1P)
```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema, ListToolsRequestSchema,
  ListResourcesRequestSchema, ReadResourceRequestSchema,
  ListPromptsRequestSchema, GetPromptRequestSchema,
  McpError, ErrorCode,
} from '@modelcontextprotocol/sdk/types.js';

const server = new Server(
  { name: 'my-server', version: '1.0.0' },
  { capabilities: { tools: {}, resources: {}, prompts: {} } },
);

// Tools —— 3个Handler: ListTools + CallTool
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{ name: 'tool_name', description: '...', inputSchema: { type: 'object', properties: {...}, required: [...] } }],
}));
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  if (req.params.name === 'tool_name') { /* ... */ }
  throw new McpError(ErrorCode.MethodNotFound, '未知工具');
});

// Resources —— 2个Handler: ListResources + ReadResource
// Prompts  —— 2个Handler: ListPrompts + GetPrompt

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[server] started');
}
main().catch(err => { console.error(err); process.exit(1); });
```

### /review-report Skill 模板
```markdown
---
name: review-report
description: 审查掌心人格局人格报告——合规/质量/一致性检查
---
# Review Report
## Phase 1: 数据获取
- 通过 MCP Resource 获取报告数据 (palm://reports/{id})
- 通过 MCP Resource 获取合规词库 (palm://compliance/terms)

## Phase 2: 合规检查 (阻断级)
- [ ] 检查禁用词: 算命/占卜/手相/正缘/注定/暴富...
- [ ] 检查替代表达: 倾向于/更容易/大概率
- [ ] 检查免责声明

## Phase 3: 质量检查 (严重级)
- [ ] 文案不空泛(每句话有具体特征引用)
- [ ] 60%+段落含视觉锚点
- [ ] 让人想截图发朋友圈(截图驱动标准)

## Phase 4: 一致性检查 (建议级)
- [ ] 五维分数与描述匹配
- [ ] 核心真相与洞察一致
- [ ] 关键词覆盖主要结论
```

### 掌心人格局禁用词(27项)
| 类别 | 词条 |
|------|------|
| 命理类(5) | 算命、占卜、手相、看手相、掌纹 |
| 命运类(6) | 命运注定、天注定、宿命、改命、改运、开运 |
| 关系类(7) | 正缘、姻缘测算、旺夫、旺妻、克夫、克妻、天生一对 |
| 绝对化(5) | 100%准确、比算命更准、必然、一定会、暴富 |
| 灾祸类(4) | 寿命预测、疾病预测、灾祸预测、财富暴富预测 |

替代表达: 手掌特征/掌心线条/性格倾向/相处模式/同频度/倾向于/更容易/大概率

### 项目数据桥接（重要）
```
// 合规词库 → import 项目共享包（不要硬编码！）
import { FORBIDDEN_TERMS, checkForbiddenTerms } 
  from '../../../packages/shared-safety/src/index.js';

// 报告数据 → import 引擎类型
import type { PersonaReport } from '../../../server/src/engine/types.js';
```

---
## 第3页 · 批判考点

### 三篇论文核心 + 局限

**1. SWE-bench Verified**
- 核心: 人工验证482任务，消除30%噪声
- 局限: 仅Python/482太小/OpenAI自测偏差/静态快照
- 启示: 评估Agent需要人工验证的ground truth

**2. Code-as-Action**
- 核心: 代码表达比JSON好18%(表达能力+错误处理+组合性)
- 局限: 安全风险(代码执行)/沙箱成本/非程序员场景不适
- 启示: 掌心人格局当前JSON-RPC正确(合规>灵活)

**3. LATS (MCTS + ReAct)**
- 核心: 树搜索(分叉+评估+回溯+剪枝)，Pass@1 +40%
- 局限: 5-10x成本/收益递减/搜索策略超参数/评估噪声
- 启示: 关键文案可3选1，但不能全流程用(太贵)

### 7大基准对比
SWE-bench V(软件/Py) | WebArena(Web导航/动态) | GAIA(通用/静态)
AgentBench(多维度/质量参差) | τ-bench(多Agent/场景有限)
ToolBench(工具/模拟API) | OSWorld(操作系统/动态)

### Agent安全风险矩阵
| 层 | 攻击 | 防御 |
|----|------|------|
| 输入(直接) | Prompt Injection | ContentSafety过滤 |
| 输入(间接) | 网页/邮件注入 | 输出验证层 |
| 工具层 | 未授权API调用 | 最小权限+限流 |
| 输出层 | 隐私泄露 | 特征提取后删原图 |

### 掌心人格局技术栈批判

**当前选型分析:**
1. Orchestrator-Workers ✓ — 流水线结构，阶段分明
2. 不引入外部框架 ✓ — 对项目太重，Worker模式就够了
3. 混合通信 ✓ — 消息传递+共享内存结合
4. STDIO传输 ✓ — 本地开发，Streamable HTTP后续加

**争议点:**
1. MCP耦合JSON-RPC — 非JS生态不友好
2. Skill纯文本无版本 — 依赖git管理
3. 多Agent成本 — AI调用次数线性增长
4. 通信开销 — 延迟随Agent数量显著增加

**改进方向:**
1. 建立review-report ground truth集(SWE-bench启示)
2. 关键文案借鉴LATS 3选1
3. 更具体的Hook配置(PostToolUse合规检查)
4. 间接注入防御加强(当前偏弱)

### 回答技巧
- 理论题: 画决策树 + 对比表 + 咬定选择理由
- 实践题: 先搭骨架再填逻辑 + 验证编译 + 别忘了import链路
- 批判题: 有观点+有数据+有局限性分析+有改进建议(不要只批评不给方案)
