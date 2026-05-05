---
name: 全球AI Agent协议与多智能体框架深度调研 (2026)
author: 马富贵 (Senior Engineer, DeepSeek V4 Flash)
taskId: V7-W4-001
targetLevel: L2 研究段 — 外部研究
domain: architecture / multi-agent
sources:
  - github.com/google/A2A (Google A2A Protocol)
  - modelcontextprotocol.io (Anthropic MCP)
  - github.com/microsoft/autogen (AutoGen → MAF)
  - github.com/crewAIInc/crewAI (v1.14.4)
  - github.com/langchain-ai/langgraph (2026-05-05)
status: complete
completedAt: 2026-05-06
---

# 全球 AI Agent 协议与多智能体框架深度调研 (2026年5月)

## 执行摘要

2026年最关键的基础设施变革：**Agent-to-Agent 通信正在标准化**。Google A2A 和 Anthropic MCP 形成互补双层协议栈——MCP 管 agent-to-tool，A2A 管 agent-to-agent。多 Agent 框架三足鼎立：CrewAI（高层声明式）、LangGraph（低层编排式）、Microsoft Agent Framework（企业级 AutoGen 继承者）。

**对富贵军团的核心建议**：立即采用 MCP 暴露能力接口 + 参考 A2A 的 Agent Card 设计我们自己的 Agent 能力声明标准。不采用任何现有多 Agent 框架——我们的团队拓扑（P10→P9→P7 三级管理）是这四个框架都没有原生支持的模式。

---

## 第一部分：Agent 协议 — A2A vs MCP (2026)

### 1.1 协议栈全景图

```
┌────────────────────────────────────────────────┐
│                  Agent 应用层                    │
│  (多Agent编排 / 任务分解 / 协作决策)              │
├────────────────────────────────────────────────┤
│              A2A (Agent-to-Agent)               │
│   Google | 2026 Q2 | JSON-RPC 2.0 over HTTP    │
│   Agent发现 · 任务委派 · 流式协作 · 异步通知     │
├────────────────────────────────────────────────┤
│              MCP (Model Context Protocol)       │
│   Anthropic | 2025→2026 | JSON-RPC 2.0         │
│   工具暴露 · 上下文共享 · 资源访问 · Prompt模板    │
├────────────────────────────────────────────────┤
│               传输层 (Transport)                │
│   MCP: stdio / Streamable HTTP + SSE           │
│   A2A: HTTP + SSE + Webhook                    │
└────────────────────────────────────────────────┘
```

### 1.2 A2A 协议深度分析

**定位**: Agent-to-Agent 协作的开放标准。Google 主导，2026 Q2 发布。

| 维度 | 规格 |
|------|------|
| 消息协议 | JSON-RPC 2.0 over HTTP(S) |
| SDK 语言 | Python, Go, JS/TS, Java, .NET — 5 语言全覆盖 |
| 通信模式 | 同步请求-响应 / SSE 流式 / 异步推送通知 |
| 服务发现 | **Agent Card** — 标准化能力元数据（不含内部状态/记忆/工具） |
| 任务模型 | 长时间运行任务 + 动态 UX 协商（计划支持 audio/video 中途注入） |
| 安全模型 | 企业就绪：认证方案内置于 AgentCard（计划中）、可观测性原生支持 |
| 与 MCP 关系 | **互补**：MCP = agent↔tool，A2A = agent↔agent |

**核心设计哲学**: opaque collaboration——agent 不暴露内部状态、记忆或工具实现即可协作。这是 A2A 最关键的架构决策：agent 是"黑箱对等体"，只通过 Agent Card 声明"我能做什么"，不暴露"我怎么做的"。

**Agent Card 示例（概念）**:
```json
{
  "name": "Palm Compliance Agent",
  "description": "掌心人格局合规审查 Agent",
  "url": "https://api.palm-persona.ai/a2a",
  "capabilities": {
    "streaming": true,
    "pushNotifications": true
  },
  "skills": [
    { "id": "check_compliance", "description": "27项禁用词检测+同音字替换" },
    { "id": "audit_report", "description": "报告安全审查+门禁通过/驳回" }
  ],
  "authentication": {
    "scheme": "bearer_token"
  }
}
```

### 1.3 MCP 协议 2026 最新进展

**定位**: AI 应用与外部工具/数据源的标准化接口。Anthropic 主导，版本 `2025-06-18`。

**2026年关键变化**:

| 变化 | 详情 |
|------|------|
| **Streamable HTTP 正式化** | 替代旧的 HTTP+SSE 传输，支持远程 MCP Server 的多客户端并发连接 |
| **Tasks 原语（实验性）** | 持久化执行包装器——支持延迟结果检索、状态追踪、长运行操作 |
| **OAuth 推荐认证** | 从自定义 header 转向标准 OAuth bearer token |
| **OpenAI 宣布采用** | 2026年 OpenAI 宣布 Agents SDK 支持 MCP——将 MCP 从 Anthropic 生态推向全行业标准 |
| **MCP Registry** | 官方 MCP Server 注册表——可发现第三方 MCP Server |

**MCP 原语体系**:
```
Server 端:
  Tools   (tools/list → tools/call)    — 可执行函数
  Resources (resources/list → resources/read)  — 上下文数据
  Prompts (prompts/list → prompts/get) — 交互模板

Client 端:
  Sampling (sampling/createMessage)    — 请求 LLM 补全
  Elicitation (elicitation/create)     — 请求用户输入
  Logging                              — 调试日志

跨切面:
  Tasks (实验性)                        — 异步长任务
  Notifications (tools/list_changed 等) — 实时推送
```

**MCP 与 A2A 的精确分工**:

| 维度 | MCP | A2A |
|------|-----|-----|
| 通信对象 | Agent ↔ Tool/Data | Agent ↔ Agent |
| 调用方向 | Agent 调用外部能力 | Agent 委派任务给其他 Agent |
| 发现机制 | `tools/list` 动态发现 | Agent Card 静态声明 |
| 状态暴露 | 工具暴露 schema+描述 | Agent 不暴露内部状态(opaque) |
| 适用场景 | "帮我查天气""读这个文件" | "帮我审查这份报告""帮我写这篇文案" |
| 标准化程度 | 已广泛采用（OpenAI/Anthropic/MS） | 新兴标准（Google 主导） |
| 关系 | **基础设施层** | **协作层** |

### 1.4 关键洞察：A2A + MCP 的协同不是"选哪个"而是"怎么组合"

```
一个典型的 Agent 系统架构：

┌──────────┐  A2A   ┌──────────┐  A2A   ┌──────────┐
│ 编排Agent │◄─────►│ 文案Agent │◄─────►│ 审查Agent │
│ (P9-TL)  │        │ (王富贵)  │        │ (周富贵)  │
└────┬─────┘        └────┬─────┘        └────┬─────┘
     │ MCP               │ MCP               │ MCP
     ▼                   ▼                   ▼
┌──────────┐       ┌──────────┐       ┌──────────┐
│ 知识图谱  │       │ AI模型   │       │ 合规词库  │
│ (Tool)    │       │ (Resource)│      │ (Tool)    │
└──────────┘       └──────────┘       └──────────┘
```

- **MCP 暴露能力**: 每个 Agent 将自身工具通过 MCP Server 暴露——"我能做关键词检索""我能调用豆包模型""我能检查合规"
- **A2A 协调 Agent 间协作**: 编排 Agent 通过 A2A 向执行 Agent 委派任务，Agent Card 做能力发现
- **信息流**: Agent 内部状态不暴露（A2A 的 opaque 原则），但通过 MCP 的 Resources 原语共享"上下文快照"

---

## 第二部分：多 Agent 开源框架对比 (2026年5月)

### 2.1 三足鼎立

| 维度 | CrewAI | LangGraph | AutoGen → MAF |
|------|--------|-----------|---------------|
| **最新版本** | v1.14.4 (2026) | langgraph-sdk 0.3.14 (2026-05-05) | v0.7.5 (2025-09) → MAF 1.0 |
| **定位** | 高层声明式 Agent 团队 | 低层可编排状态机 | 企业级 Agent 框架 |
| **Stars** | ~25k+ | ~12k+ | 57.7k (AutoGen legacy) |
| **抽象层级** | 高（YAML 配置 + 装饰器） | 低（图 API + subgraphs） | 中（Core API + AgentChat API） |
| **Agent 协作** | Crew（角色分工）+ Flow（事件驱动） | Subgraphs（子图嵌套）+ deep agents | AgentTool（Agent 作为工具被调用） |
| **MCP 支持** | ✅ MCP Server 集成 | ✅ 通过 LangChain 生态 | ✅ MCP Server 支持 |
| **A2A 支持** | ❌ 未提及 | ❌ 未提及 | ❌ 未提及 |
| **企业特性** | AMP Suite (控制平面+可观测性) | LangSmith (部署+追踪+评估) | MAF 承诺"稳定 API + 长期支持" |
| **学习曲线** | 低（YAML 即 Agent） | 高（需理解图/状态/节点） | 中 |
| **适用规模** | 3-10 Agent 团队 | 任意复杂度 | 企业级大规模 |
| **重大变化** | — | — | ⚠️ **已停更，迁移到 MAF** |

### 2.2 框架详细分析

#### CrewAI (高层声明式)

**核心架构**: Crews + Flows 双层

```
Flows 层 (事件驱动 → 生产级)
  ├─ @start  → 入口
  ├─ @listen → 监听事件
  └─ @router → 条件路由

Crews 层 (角色分工 → Agent 团队)
  ├─ @agent  → 角色定义 (name/role/goal/backstory)
  ├─ @task   → 任务定义 (description/expected_output/agent)
  └─ @crew   → 团队编排 (sequential/hierarchical)
```

**优点**:
- YAML 驱动配置——非程序员可直接定义 Agent 行为
- Agent 间"自然、自主的决策"——宣称 Agent 可在 crew 内动态协商任务分配
- AMP Suite 提供企业级控制平面

**缺点**:
- "自主决策"在实际中是什么？——缺乏可审计的决策过程
- 高层抽象丧失细粒度控制——当 Agent 行为不符合预期时，调试困难
- A2A 协议不支持——Agent 间通信是框架内部的，不能与外部 Agent 互操作

#### LangGraph (低层编排式)

**核心架构**: StateGraph（状态图 + 节点 + 条件边）

```python
# LangGraph 多 Agent 模式：Subgraphs
main_graph = StateGraph(TeamState)
main_graph.add_node("orchestrator", orchestrator_node)
main_graph.add_node("writer_agent", writer_subgraph)     # 子图 = 独立 Agent
main_graph.add_node("reviewer_agent", reviewer_subgraph)  # 子图 = 独立 Agent
main_graph.add_conditional_edges("orchestrator", route_to_agent)
```

**优点**:
- 持久化执行——Agent 可在任意节点中断→恢复，状态不丢失
- 综合记忆——短期工作记忆 + 跨会话长期记忆
- Deep Agents——子 Agent + 文件系统，适合复杂任务
- 被 Klarna、Replit、Elastic 等顶级公司采用

**缺点**:
- 学习曲线最陡——需要理解图论/状态机/节点/边
- 没有原生 Agent 角色概念——需要手动编码 orchestrator 的委派逻辑
- 没有 Agent 发现机制——所有 Agent 必须在图中预定义
- 调试复杂——当 subgraph 嵌套 3+ 层时，追踪状态流非常困难

#### AutoGen → Microsoft Agent Framework (MAF)

**关键变化**: AutoGen v0.7.5 是最终版本，**不会再有新功能**。新项目应从 MAF 1.0 开始。

AutoGen 的遗产：
- 事件驱动的 Agent 运行时
- AgentTool——将 Agent 作为 Tool 暴露（类似 MCP Tool，但调用的是 Agent 而非工具）
- AutoGen Studio——无代码 GUI 原型设计

MAF 的承诺：
- 稳定的 API
- 长期支持承诺
- 企业就绪

**不确定性**: MAF 是闭源还是开源？API 是否兼容 AutoGen？Google A2A 和 MAF 的关系是什么？这三个问题目前没有答案。

### 2.3 框架选择决策树

```
你的场景是什么？

多 Agent 协作，Agent 数量少 (≤10)
├─ 非程序员需要配置 Agent 行为 → CrewAI
└─ 需要精确控制执行流程 → LangGraph

超大规模 (100+ Agent)，企业级
└─ 等 MAF 稳定后再评估（目前风险太高）

Agent 需要与外部系统互操作
└─ 以上框架都不行 → 自建 A2A+MCP 组合方案

你的 Agent 拓扑是层级管理的 (P10→P9→P7)
└─ 以上框架都不原生支持 → 自建
```

---

## 第三部分：富贵军团的具体应用分析

### 3.1 当前架构 vs 业界标准

| 维度 | 业界标准 (2026) | 富贵军团现状 | 差距 |
|------|----------------|-------------|------|
| Agent 通信 | A2A (标准化 agent↔agent) | Task Prompt JSON 文件 | 无实时通信 |
| 能力暴露 | MCP Tools/Resources | skill-routing.json | 能力声明有但无标准接口 |
| Agent 发现 | Agent Card | team-status.json (手动维护) | 无自动发现 |
| 任务委派 | A2A 异步任务 | Git commit + 文件传递 | 无状态追踪 |
| 上下文共享 | MCP Resources | memory/ 文件系统 | 无流式访问 |
| 编排模式 | Crew/LangGraph subgraph | 手动 Task Prompt 编写 | 无编排引擎 |

### 3.2 我们能用什么、怎么用

#### 立即采用 (本周可落地)

**1. MCP Server 暴露每个 Agent 的能力**

```
聂富贵 (P10/TL) MCP Server:
  Tools:
    - create_task_prompt(type, assignee, description)
    - review_deliverable(agent, task_id)
    - get_team_status()
  Resources:
    - decisions://  (决策历史)
    - team-dashboard://  (团队仪表盘)

马富贵 (P7/Dev) MCP Server:
  Tools:
    - search_memory(keyword, domain)
    - query_knowledge_graph(node_id)
    - run_typecheck()
    - run_tests()
  Resources:
    - knowledge-graph://  (当前图谱)
    - research-notes://  (研究笔记)

王富贵 (PM/Writer) MCP Server:
  Tools:
    - generate_copy(insight, temperature)
    - evaluate_temperature(text) → 温度评分
    - ab_test_recommendation(experiment_id) → 实验判定
  Resources:
    - writing-modules://  (教学模块)

周富贵 (QE/Security) MCP Server:
  Tools:
    - scan_code(diff)
    - check_compliance(text)
    - audit_report(report_id)
  Resources:
    - security-policies://
    - compliance-rules://
```

**实现路径**: 每个 Agent 维护一个 `mcp-server/` 目录，暴露 Tools + Resources。通过 stdio transport 给 Claude Code 调用（本地 Agent），通过 Streamable HTTP 供远程调用。

**2. Agent Card 替代手动 team-status**

```json
// memory/agent-cards/ma.json
{
  "name": "马富贵",
  "role": "Senior Engineer (P7)",
  "model": "DeepSeek V4 Flash",
  "url": "stdio://claude-student",
  "capabilities": {
    "streaming": false,
    "async": true
  },
  "skills": [
    { "id": "memory-research", "level": "L2", "description": "记忆系统研究+实现" },
    { "id": "cross-review", "level": "L2", "description": "跨领域工程审查" },
    { "id": "frontend-dev", "level": "L1", "description": "H5/小程序前端开发" },
    { "id": "protocol-research", "level": "L2", "description": "Agent协议研究+实现" }
  ],
  "currentTask": "V7-W4-001 全球Agent协议调研",
  "mcpEndpoint": "http://localhost:3001/mcp/ma",
  "a2aEndpoint": null,
  "lastHeartbeat": "2026-05-06T20:00:00Z"
}
```

#### 短期规划 (2-4周)

**3. 基于 A2A 理念的 Task Prompt 2.0 协议**

当前 Task Prompt 是 JSON 文件 → Git commit → 接收方读取。升级为 A2A 风格：

```
Task Prompt 2.0:
  - Task Card (≈ Agent Card 的子集, 描述任务而非Agent)
  - 状态流转: pending → assigned → in_progress → review → completed
  - 证据附件: 任务完成时自动附带 evidence URL
  - SSE 通知: 任务状态变更实时推送给相关 Agent
```

**4. LangGraph 风格的 Task 状态机**

不采用 LangGraph 框架本身（学习成本 + 依赖太重），但参考其持久化执行理念：

```python
# 概念代码——不是实际实现，是设计方向
class TaskStateMachine:
    """每个 Task 是一个有持久状态的有限状态机"""
    states = ["pending", "assigned", "in_progress", "self_review", "peer_review", "completed"]
    transitions = {
        "pending": ["assigned"],
        "assigned": ["in_progress", "pending"],  # 可退回
        "in_progress": ["self_review", "assigned"],
        "self_review": ["peer_review", "in_progress"],
        "peer_review": ["completed", "in_progress"],
    }
    # 每次状态变更 → 自动写入 team-status.json
    # 异常状态超时 → 自动触发 escalation
```

#### 长期愿景 (1-3月)

**5. 自建轻量 A2A 兼容层 —— "富贵协议" (Fugui Protocol)**

现有多 Agent 框架的共同盲区：**它们都不支持层级管理拓扑**。

- CrewAI 的 Crew 是平级的（一个 Manager + N 个 Worker）
- LangGraph 的 subgraph 是嵌套的但无角色概念
- AutoGen 的 AgentTool 是将 Agent 降级为 Tool（丧失对等性）

富贵军团的拓扑是 **P10(战略) → P9(拆解) → P7(执行) + PM/QE(横向审查)**——这是 Matrix 结构，不是树形结构。

自建协议的核心差异化：

```
Fugui Protocol (轻量 A2A 兼容层):

1. Agent Card 完全兼容 A2A 标准 (可直接对接外部 A2A Agent)
2. Task Card 扩展 A2A 的 Task 模型:
   - 增加 acceptCriteria (验收标准) —— MCP Resource 类型
   - 增加 evidence (证据) —— MCP Resource 类型
   - 增加 reviewer (审查者) —— A2A Agent Card 引用
3. 矩阵协作: 
   - 纵向: 任务委派 (P10→P9→P7) ← A2A 原生支持
   - 横向: 跨领域审查 (PM审查Dev的工程, Dev审查PM的产品) ← 自建
4. 仅保留我们需要的:
   - JSON-RPC 2.0 ✅ (与 A2A/MCP 一致)
   - Agent Card ✅
   - 异步任务 ✅
   - SSE 通知 ❌ (当前不需要——文件系统 + git commit 够用)
   - 流式传输 ❌ (当前不需要——我们的 Agent 响应是 Task 级别的)
```

### 3.3 几个框架的不足——我们为什么不该直接用

| 框架 | 最大问题 | 对富贵军团的具体影响 |
|------|---------|-------------------|
| **CrewAI** | Agent 决策黑箱——声称"自主决策"但无法审计 | 不满足 evidence-schema 的证据驱动要求 |
| **LangGraph** | 学习曲线 + 重型依赖（LangChain 全家桶） | 引入 LangChain 依赖与我们"简单稳定"技术原则冲突 |
| **AutoGen→MAF** | MAF 信息不透明——API/开源状态/时间线都不明确 | 不可评估风险→不可采用 |
| **A2A (协议)** | 太新——SDK 才 0.x 版本 | 可以先遵循其设计理念，等 SDK 稳定后再接入 |
| **MCP (协议)** | — | ✅ **唯一可直接采用的**——已有 5 语言 SDK + 大厂背书 |

### 3.4 行动路线图

```
Week 2 (当前):
  ☐ 马富贵: Agent Card 标准定义 + 4张 Agent Card 写入 memory/agent-cards/
  ☐ 聂富贵: 决策 D014 — 是否采用 MCP Server 暴露能力

Week 3:
  ☐ 马富贵: 实现"富富贵" MCP Server (暴露搜索+知识图谱+研究笔记)
  ☐ 周富贵: 实现"周富贵" MCP Server (暴露安全扫描+合规检查)
  ☐ 王富贵: 实现"王富贵" MCP Server (暴露文案生成+温度评估)

Week 4:
  ☐ 聂富贵: Task Prompt 2.0 格式定义 (基于 A2A Task Card 理念)
  ☐ 全员: 三角批判 — 评估 MCP Server 的实际使用效果
```

---

## 第四部分：技术架构图

### 4.1 Agent 协议栈演进 (2024→2026)

```
2024: 无标准
  Agent ←──自定义 HTTP──→ Agent
  Agent ←──Function Call──→ Tool

2025: MCP 标准化 agent↔tool
  Agent ←──MCP JSON-RPC──→ Tool/Data
  Agent ←──自定义──→ Agent (仍未标准化)

2026: A2A 标准化 agent↔agent
  Agent ←──A2A JSON-RPC──→ Agent
  Agent ←──MCP JSON-RPC──→ Tool/Data
  └── 完整双层标准栈
```

### 4.2 多 Agent 框架设计哲学光谱

```
高层声明式 ◄──────────────────────────► 低层编排式

CrewAI              AutoGen/MAF           LangGraph
"定义角色和         "Agent作为Tool         "定义图和
 目标，它们          被调用，事件           状态，精确
 自己协作"           驱动运行时"            控制每步"

YAML + 装饰器       Python API            Python Graph API
                      + Studio GUI

适合: 非程序员      适合: 快速原型         适合: 复杂系统
      配置Agent          + 企业部署              + 精确控制
```

### 4.3 富贵军团目标架构 (Q3 2026)

```
┌─────────────────────────────────────────────────────┐
│                    Fugui Protocol                    │
│              (A2A 兼容 + Matrix 扩展)                │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌──────┐  Task Card  ┌──────┐  Task Card  ┌──────┐ │
│  │ P10  │────────────►│ P9   │────────────►│ P7   │ │
│  │ 聂富贵│◄────────────│ 聂富贵│◄────────────│ 马富贵│ │
│  │ 战略  │   Evidence  │ 拆解  │   Evidence  │ 执行  │ │
│  └──┬───┘             └──┬───┘             └──┬───┘ │
│     │                    │                    │      │
│     │   横向审查          │   横向审查          │      │
│     ├───────────────────┼────────────────────┤      │
│     ▼                    ▼                    ▼      │
│  ┌──────┐            ┌──────┐            ┌──────┐   │
│  │ 王富贵│            │ 周富贵│            │ MCP   │   │
│  │ PM   │            │ QE   │            │ Servers│   │
│  └──────┘            └──────┘            └──────┘   │
│                                                     │
│  纵向: Task 委派 (A2A 语义)                          │
│  横向: Cross-review (Fugui 扩展)                     │
│  底部: 能力暴露 (MCP 标准)                            │
└─────────────────────────────────────────────────────┘
```

---

## 结论

1. **MCP 是唯一可以立即采用的标准**——5语言SDK + Anthropic/OpenAI/Microsoft 三方背书 + 与现有合规MCP Server的架构一致
2. **A2A 值得关注但不急于接入**——理念正确（Agent as opaque peer），但 SDK 太新。先借鉴其 Agent Card 和 Task 模型设计理念
3. **现有多 Agent 框架都不适合富贵军团**——它们假设平级 Agent 协作（CrewAI）或纯编排（LangGraph），不支持我们的 P10→P9→P7 层级 + PM/QE 横向 Matrix 拓扑
4. **最大的竞争壁垒不是用哪个框架**——是"我们有三角批判机制而他们没有"。CrewAI/LangGraph/AutoGen 都没有内建的"四人互相审查→投票→升级方案"循环

下一步：将本调研提交三角批判，由聂富贵/王富贵/周富贵独立审查→投票→确定 V7 Week 4 具体实施项。

---

*马富贵 | 全球 AI Agent 协议调研 | AI师生研究院 V7 Week 4*
*研究驱动因素: "理解他们 → 找出他们的不足 → 设计我们更好的方案"*
