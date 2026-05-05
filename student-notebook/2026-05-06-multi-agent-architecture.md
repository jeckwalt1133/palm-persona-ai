# 第3课：多 Agent 协作架构

> 学生：Claude Code Student | 日期：2026-05-06 | 状态：✅ 完成

---

## 一、两种核心协作模式

### 1.1 Orchestrator-Workers（编排器-工作者）

```
                   ┌──────────────┐
                   │ Orchestrator │  ← 负责任务分解、派发、汇总、容错
                   └──────┬───────┘
              ┌───────────┼───────────┐
              │           │           │
         ┌────▼───┐ ┌────▼───┐ ┌────▼───┐
         │Worker A│ │Worker B│ │Worker C│  ← 各司其职，互不感知
         └────────┘ └────────┘ └────────┘
```

**工作原理：**
1. Orchestrator 接收任务，分解为子任务
2. 按依赖关系分发到 Worker
3. Worker 独立执行，返回结果
4. Orchestrator 汇总、校验、组合输出

**适用场景：**
- 流水线型任务（数据处理 → 分析 → 报告）
- 有清晰的阶段划分和依赖顺序
- 需要中央控制点做错误处理和重试

**优点：** 结构清晰、容错可控、可观测性强
**缺点：** 中心瓶颈、Orchestrator 决策能力要求高、扩展 Worker 时需要改 Orchestrator

---

### 1.2 Evaluator-Optimizer（评估器-优化器）

```
                 ┌──────────────────┐
                 │    Optimizer     │  ← 生成/改进方案
                 └────────┬─────────┘
                          │ 方案
                          ▼
                 ┌──────────────────┐
                 │    Evaluator     │  ← 评估方案质量，给出反馈
                 └────────┬─────────┘
                          │ 反馈
                          ▼
                 ┌──────────────────┐
                 │  合格？是 → 输出  │
                 │  合格？否 → 循环  │
                 └──────────────────┘
```

**工作原理：**
1. Optimizer 生成初始方案
2. Evaluator 评估方案质量（评分 + 具体反馈）
3. 不合格 → Optimizer 根据反馈改进
4. 重复直到达标或达到最大轮次

**适用场景：**
- 文案生成与润色
- 代码审查与重构
- 需要多轮迭代提升质量的任务

**优点：** 质量上限高、自动迭代改进、可设质量门禁
**缺点：** 延迟高（多轮LLM调用）、成本线性增长、需要设计好的评估标准

---

### 1.3 对比决策树

```
任务有清晰的流水线阶段吗？
├── 是 ───→ 阶段间有强依赖吗？
│           ├── 是 ───→ Orchestrator-Workers
│           └── 否 ───→ 可并行 Fan-out（仍可用 Orchestrator）
└── 否 ───→ 任务需要多轮改进质量吗？
            ├── 是 ───→ Evaluator-Optimizer
            └── 否 ───→ 单 Agent 就够了
```

---

## 二、三大框架对比

### 2.1 架构对比表

| 维度 | MetaGPT | CrewAI | AutoGen |
|------|---------|--------|---------|
| **发布者** | 深度求索(2023) | CrewAI Inc(2024) | Microsoft(2023) |
| **核心思想** | SOP驱动角色扮演 | 灵活角色编排 | 多Agent对话 |
| **通信方式** | 共享消息池(Message Pool) | 顺序/层次化传递 | 直接对话(GroupChat) |
| **Agent定义** | 预置角色(PM/Arch/Eng/QA) | 角色+目标+技能 | 函数式Agent |
| **工作流** | 固定SOP流水线 | 可定制(顺序/层次/自治) | 自由对话/嵌套Chat |
| **状态管理** | 内置 | 手动 | 内置对话历史 |
| **工具调用** | 插件机制 | 强(Tool/自定义) | 函数注册 |
| **调试支持** | 角色日志 | 过程跟踪 | 对话回放 |
| **学习曲线** | 中等 | 低 | 中高 |
| **Pythonic** | 中(大量配置) | 高(简洁API) | 高 |
| **最佳场景** | 软件开发模拟 | 通用业务自动化 | 复杂研究/辩论 |
| **最新版本** | v0.8+ | v0.30+ | v0.4+ |

### 2.2 关键差异分析

#### MetaGPT — "让AI像公司一样运作"
```
[PM] → [Architect] → [Engineer] → [QA]
  │          │             │          │
  ├─ 需求文档  ├─ 架构设计    ├─ 编码实现  ├─ 测试审查
  └─ 任务分解  └─ 技术选型    └─ CRUD生成 └─ Bug报告
```
- **强在**：角色分工严格、SOP成熟、软件开发场景极其高效
- **弱在**：灵活性差、不适合非软件任务、定制工作流复杂
- **2026变化**：开始支持自定义角色和灵活SOP，但核心仍是软件工程

#### CrewAI — "简单就是力量"
```python
from crewai import Agent, Task, Crew, Process

pm = Agent(role='产品经理', goal='定义需求')
dev = Agent(role='开发者', goal='实现功能')

task1 = Task(description='写需求文档', agent=pm)
task2 = Task(description='编码实现', agent=dev)

crew = Crew(agents=[pm, dev], tasks=[task1, task2], process=Process.sequential)
crew.kickoff()
```
- **强在**：API极简、Process灵活(sequential/hierarchical/autonomous)、快速上手
- **弱在**：复杂场景需大量定制、Agent间通信不够透明、大规模不稳定
- **2026变化**：新增Process.consensual、改进记忆系统、支持MCP工具

#### AutoGen — "对话是一切"
```python
import autogen

planner = autogen.AssistantAgent(name="Planner")
critic = autogen.AssistantAgent(name="Critic")
user = autogen.UserProxyAgent(name="User")

group_chat = autogen.GroupChat(agents=[planner, critic, user])
manager = autogen.GroupChatManager(groupchat=group_chat)
manager.initiate_chat("我们需要设计一个系统...")
```
- **强在**：对话灵活度高、Nested Chat支持复杂交互、学术场景验证充分
- **弱在**：调试难度高、对话可能跑偏、结果不稳定、配置复杂
- **2026变化**：v0.4重构为异步架构、支持MCP Server集成、改进对话管理

### 2.3 框架选择指南

| 你的任务 | 推荐框架 | 理由 |
|----------|----------|------|
| 软件工程/代码生成 | MetaGPT | 预置SOP、成熟角色体系 |
| 一般业务自动化 | CrewAI | 简单灵活、快速迭代 |
| 研究探索/辩论 | AutoGen | 对话自由度高、嵌套交互 |
| 内容生成/文案 | CrewAI + 自定义 | 灵活编排、易集成外部工具 |
| 需要MCP集成 | 三者都支持 | 2026年三大框架均已支持MCP协议 |

---

## 三、Agent 通信协议

### 3.1 消息传递 (Message Passing)

```
┌──────┐   Queue: analysis_task    ┌──────┐
│ Orc  │─────────────────────────→│ Worker │
│      │←─────────────────────────│       │
└──────┘   Queue: analysis_result   └──────┘
```

**机制：** Agent 通过消息队列/通道传递结构化消息
**实现：** RabbitMQ、Redis Pub/Sub、Kafka、进程内Channel
**优点：**
- 解耦——生产者和消费者不需要知道对方
- 可追溯——每条消息有ID、时间戳、路由
- 可伸缩——Worker可以水平扩展
- 容错——消息可持久化、可重试

**缺点：**
- 序列化/反序列化开销
- 消息格式需约定(JSON Schema / Protobuf)
- 调试时需要追踪消息流

### 3.2 共享内存 (Shared Memory)

```
┌────────┐     ┌──────────────────┐     ┌────────┐
│ AgentA │◄───►│   Shared Store   │◄───►│ AgentB │
└────────┘     │  (SQLite/Redis)  │     └────────┘
               └──────────────────┘
```

**机制：** Agent 读写共享状态存储
**实现：** SQLite、Redis、PostgreSQL、In-Memory Dict
**优点：**
- 高性能——无序列化开销
- 天然共享——所有Agent看到同一份数据
- 持久化——状态不易丢失
- 适合协作场景——Agent 可以"看到"别人的工作成果

**缺点：**
- 耦合——Agent需要知道数据模型
- 竞争条件——多个Agent同时写入需锁机制
- 调试困难——看不到通信"对话"

### 3.3 掌心人格局选型：混合方案

```
Agent 间通信：结构化消息传递（JSON-RPC风格）
Agent 数据共享：共享内存（报告数据存入 Repository）
外部集成：MCP 协议（标准化的数据和工具接口）
```

**选择理由：**
1. 报告生成流水线各阶段依赖明确 → 消息传递保证顺序和可追溯
2. Worker 需要读取同一份报告数据 → 共享内存让特征/分数/文案可交叉引用
3. 未来扩展时 Worker 可独立部署 → 消息队列天然支持分布式

---

## 四、掌心人格局: 多Agent报告生成系统

### 4.1 架构图 (ASCII)

```
┌─────────────────────────────────────────────────────────────────┐
│                     🕊️  ReportOrchestrator                       │
│  负责任务调度、状态管理、容错恢复、结果汇总                          │
│  输入: imageBase64 + questionnaireAnswers                        │
│  输出: PersonaReport (完整)                                      │
└──────────────┬──────────────────────────────────┬───────────────┘
               │                                  │
     ┌─────────┼─────────┐               ┌────────┴────────┐
     │         │         │               │                  │
     ▼         ▼         ▼               ▼                  ▼
┌─────────┐┌─────────┐┌─────────┐ ┌──────────────┐ ┌──────────────┐
│ Palm    ││ Persona ││ Narrative│ │ Safety       │ │ Social       │
│ Feature ││ Scorer  ││ Writer  │ │ Checker      │ │ Currency Gen │
│ Analyzer││         ││         │ │              │ │              │
├─────────┤├─────────┤├─────────┤ ├──────────────┤ ├──────────────┤
│ 提取手掌  ││ 五维评分 ││ AI生成  │ │ 合规过滤      │ │ 分享文案生成  │
│ 特征     ││ 人格分类 ││ 叙事文案 │ │ 禁用词检测    │ │ 社交货币生产  │
│ 视觉锚点  ││ 类型判定 ││ 核心真相 │ │ 替换建议      │ │ 平台适配      │
└─────────┘└─────────┘└─────────┘ └──────────────┘ └──────────────┘
     │         │         │               │                  │
     │         │         │               │                  │
     └─────────┴─────────┴───────────────┴──────────────────┘
                              │
                              ▼
               ┌─────────────────────────────┐
               │     Report Repository       │
               │     (Shared Memory)         │
               │  PersonaReport + MatchData  │
               └─────────────────────────────┘
```

### 4.2 工作流详解

```
Step 1: Orchestrator 接收请求
  ├─ 输入: { imageBase64, context }
  └─ 创建 Report ID，初始化共享状态

Step 2: PalmFeatureAnalyzer 工作
  ├─ 输入: imageBase64
  ├─ 执行: MockPalmFeatureExtractor.extract()
  ├─ 输出: PalmFeatures { hash, fingerLengthRatio, ... }
  └─ 写入: SharedMemory.features

Step 3: PersonaScorer 工作
  ├─ 输入: SharedMemory.features
  ├─ 执行: PersonaScoringEngine.score(features, context)
  ├─ 输出: PersonaScore[] + personaType + personaLabel
  └─ 写入: SharedMemory.scores

Step 4: NarrativeWriter 工作（并行分支）
  ├─ 输入: SharedMemory.{features, scores}
  ├─ AI调用: 生成 summary / coreTruth / insights / weeklyAdvice
  ├─ 输出: { summary, coreTruth, insights, weeklyAdvice, quote }
  └─ 写入: SharedMemory.narrative

Step 4b: SocialCurrencyGen 工作（与Step4并行）
  ├─ 输入: SharedMemory.{scores, personaType}
  ├─ AI调用: 生成 身份标签/隐秘真相/关系洞察/对立反差
  ├─ 输出: SocialCurrencyPack { identity, truth, relation, contrast }
  └─ 写入: SharedMemory.socialCurrency

Step 5: SafetyChecker 工作
  ├─ 输入: SharedMemory.narrative
  ├─ 执行: ContentSafety.check(summary + insights + ...)
  ├─ 输出: SafetyResult { safe, violations, filteredText }
  └─ 写入: SharedMemory.safetyResult

Step 6: Orchestrator 汇总
  ├─ 读取: SharedMemory 所有字段
  ├─ 组装: PersonaReport
  ├─ 存储: ReportRepository.save(report)
  └─ 返回: PersonaReport
```

### 4.3 为什么选择 Orchestrator-Workers

| 考虑维度 | 掌心人格局的实际需求 | Orchestrator-Workers | Evaluator-Optimizer |
|----------|---------------------|---------------------|--------------------|
| 流水线结构 | 特征→评分→文案→安全→分享，阶段分明 | ✅ 天然适配 | ❌ 无迭代必要 |
| 并行需求 | 文案撰写可以和社交货币生成并行 | ✅ 支持并行Worker | ❌ 串行迭代 |
| 质量门禁 | 安全检查是硬性要求，不通过不能输出 | ✅ Orchestrator可阻断 | ⚠️ 评估器偏软性 |
| 容错需求 | AI生成失败时可用模板降级 | ✅ 中心化容错 | ❌ 失败影响整个循环 |
| 可观测性 | 需要知道哪个阶段失败 | ✅ 每阶段可追踪 | ⚠️ 迭代中难定位 |
| 扩展性 | 未来可能添加更多Worker | ✅ 新增Worker不改流程 | ❌ 每新增维度需重新设计 |

**核心决策逻辑**：掌心人格局的报告生成是一个**有明确阶段边界的流水线任务**，不是需要多轮迭代优化质量的创作任务。Orchestrator-Workers 提供了：
- 清晰的错误边界（每个Worker独立try/catch）
- 灵活的并行策略（Narrative与Social可并行）
- 可控的降级路径（某Worker失败时用Mock兜底）

### 4.4 对比：如果用 Evaluator-Optimizer 会怎样

```
Optimizer 生成完整报告 → Evaluator 评估 → 不合格 → 重写...
                                  ↓
                        问题：什么算"合格"？
                        文案质量主观、安全合规是硬门槛
                        但安全合规不需要多轮迭代——一次检查就够了
                        文案质量迭代 → 成本×轮次，收益递减
```

**结论**：Evaluator-Optimizer 更适合**单步骤高质量产出**（如润色一段文案），不适合**多步骤流水线**（如报告生成）。掌心人格局的天然结构决定了 Orchestrator-Workers 是更优选择。

### 4.5 Agent 间消息协议设计

```typescript
// 每个 Worker 的输入/输出格式统一
interface AgentMessage {
  type: 'request' | 'response' | 'error';
  from: string;          // 'orchestrator' | 'feature_analyzer' | ...
  to: string;
  taskId: string;        // 关联到具体报告
  payload: unknown;
  timestamp: string;
  traceId: string;       // 全链路追踪
}

// Worker 调用规范
interface WorkerDefinition {
  name: string;
  inputSchema: JSONSchema;   // Zod 定义输入
  outputSchema: JSONSchema;  // Zod 定义输出
  maxRetries: number;
  timeoutMs: number;
  fallback: () => unknown;   // 降级函数
}
```

---

## 五、关键争议与局限

1. **Orchestrator 的单点故障**：所有Agent依赖Orchestrator决策，一旦Orchestrator出问题→全流程挂。缓解：Orchestrator使用高可靠模型+重试机制。
2. **Agent 幻觉传播**：一个Worker的错误输出会被下游Worker当作"事实"使用。缓解：每阶段做校验门禁。
3. **框架选择僵化**：MetaGPT强在软件工程但用在内容生成上反而不如CrewAI灵活。"最佳实践"是营销术语，做POC才是正解。
4. **通信开销在高并发时显著**：Agent间消息传递+LLM调用+状态读写，延迟叠加明显。缓解：关键路径可考虑将NarrativeWriter和SocialCurrencyGen并行化（减少一次串行LLM调用）。
5. **多Agent ≠ 好结果**：Anthropic 2025年研究显示，很多场景下单Agent+好Prompt效果不输多Agent，但成本更低。多Agent的收益主要在复杂流程管理和专业分工，不是"多个LLM一起想更聪明"。

---

## 六、交付物清单

- [x] `student-notebook/2026-05-06-multi-agent-architecture.md` — 本笔记
- [x] ASCII架构图 — Orchestrator + 5 Workers + Shared Memory
- [x] 模式选择分析 — Orchestrator-Workers vs Evaluator-Optimizer
- [x] 三大框架对比 — MetaGPT / CrewAI / AutoGen

---

## 七、下一步：MVP实现建议

如果要将本设计落地为代码，建议路线：
1. **Phase 1**：用一个 `ReportOrchestrator` 类封装当前 `MockAnalysisService` 的analyze方法，内部按Worker拆分函数
2. **Phase 2**：将每个Worker抽为独立类，实现 `Worker` 接口
3. **Phase 3**：引入消息队列（先进程内EventEmitter，后切RabbitMQ）
4. **Phase 4**：NarrativeWriter 和 SocialCurrencyGen 并行化

不需引入任何外部框架——CrewAI/MetaGPT/AutoGen 对掌心人格局太重。保持轻量。

---

*本节学习时长：20分钟 | 覆盖模式：2种 | 框架对比：3个 | 架构设计：1份*
