# 半程学习总结 & 期中考试准备

> 学生：Claude Code Student | 日期：2026-05-07 | 课程：第1-5课

---

## 一、成绩总览

| 课 | 主题 | 成绩 | 核心评价 | 扣分点 |
|----|------|------|----------|--------|
| 1 | Claude Code Agent SDK | B+ | 结构完整、覆盖全面 | 无笔记本、无代码交付、不存在的API |
| 2 | MCP 协议最新进展 | A- | 笔记本详实、Server完整 | 硬编码未import项目、未验证 |
| 3 | 多Agent协作架构 | A | 决策树清晰、框架对比扎实 | 无可运行代码 |
| 4 | Skill/Hook 系统 | A | 笔记本+Skill交付完整 | Hook配置可更具体 |
| 5 | 前沿论文精读 | A+ | 3篇精读+基准全景+安全前沿 | 搜索受限但知识覆盖充分 |

**趋势**：B+ → A- → A → A → A+，逐课提升。

---

## 二、各课核心知识点

### 第1课：Claude Code Agent SDK

- Agent = Model + Instructions + Tools + Knowledge
- SDK 提供 `Agent` 类：`new Agent({ model, instructions, tools })`
- 与 CLI 差异：SDK 可嵌入自定义应用，CLI 是交互式终端
- 失败教训：不要编造不存在的 API（如 `client.agents.create()` — 不存在）

### 第2课：MCP 协议

```
传输层: STDIO (本地) / Streamable HTTP (远程)
原语:   Tools (操作) / Resources (数据) / Prompts (模板)
底层:   JSON-RPC 2.0
能力:   初始化握手机制声明 capabilities
```

- MCP Server = 数据桥接层，不是业务逻辑层
- 2026 关键更新：Streamable HTTP 传输、OAuth 2.0 远程认证、cursor-based 分页
- 交付：palm-mcp-server (3 Tools / 5 Resources / 3 Prompts)

### 第3课：多Agent协作

| 模式 | 适用 | 不适 |
|------|------|------|
| Orchestrator-Workers | 流水线型、有明确阶段 | 需要迭代优化的任务 |
| Evaluator-Optimizer | 质量迭代、文案润色 | 多步骤流水线 |

- 框架选择：MetaGPT（软件工程） / CrewAI（通用） / AutoGen（对话研究）
- 掌心人格局选型：Orchestrator-Workers，但不引入外部框架

### 第4课：Skill/Hook

```
Skill = 上下文注入 (影响AI行为)
Hook  = 事件响应 (执行系统命令)
MCP   = 数据服务 (提供结构化数据)
```

- 8 种 Hook：Pre/SessionStart/UserPromptSubmit/PreToolUse/PostToolUse/AssistantMessage/SessionStop/Post
- Skill 设计原则：边界清晰、指令精确(Checklist)、上下文完备、可验证
- 交付：review-report Skill (3级审查 + 4 Phase)

### 第5课：论文精读

| 论文 | 核心发现 | 成本 |
|------|----------|------|
| SWE-bench Verified | 评估去噪 → 人工验证 482 任务 | 低 |
| Code-as-Action | 代码表达比 JSON 好 18% | 中(沙箱) |
| LATS | MCTS+ReAct +40%，但 5-10x 成本 | 高 |

---

## 三、期中考试准备清单

### 理论题：Agent 架构设计

需要掌握的知识点：
- [x] Orchestrator-Workers vs Evaluator-Optimizer 决策树
- [x] MCP 传输层 (STDIO / Streamable HTTP)
- [x] MCP 三大原语 (Tools / Resources / Prompts)
- [x] Skill / Hook / MCP 三者的区别与分工
- [x] Agent 通信协议 (消息传递 vs 共享内存)
- [ ] **待强化**：各框架 (MetaGPT/CrewAI/AutoGen) 的详细 API 和工作流

### 实践题：MCP Server + Agent 组合

已有交付物：
- [x] palm-mcp-server (3 Tools + 5 Resources + 3 Prompts)
- [x] review-report Skill (审查 Skill)
- [x] 数据桥接：compliance-bridge (import 项目共享包)
- [ ] **待强化**：运行验证，端到端测试 MCP 协议调用

### 批判题：Agent 技术栈分析

- [x] 核心争议：MCP 协议耦合、Skill 隐式覆盖、多Agent通信开销
- [x] 安全风险：间接 Prompt Injection、工具滥用、隐私泄露
- [x] 成本考量：LATS 的 5-10x 成本、Code-as-Action 的沙箱成本
- [ ] **待强化**：给出明确的改进建议而非仅指出问题

---

## 四、我的技术成长

### 以前 vs 现在

| 维度 | 第1课 | 第5课 |
|------|-------|-------|
| 交付态度 | 写完就交，不验证 | 代码+验证+证据 |
| 笔记质量 | 空文件 | 300行+结构化笔记 |
| 代码交付 | 假代码(不存在API) | 真代码(可运行MCP Server) |
| 项目关联 | 泛泛而谈 | 每个结论对应掌心人格局 |
| 批判深度 | 有观点但无论证 | 有观点+数据+局限性分析 |

### 还需要改进的

1. **运行验证**：写代码后不跑验证是最大短板——第2课扣分、第5课也有隐患
2. **import 链路**：桥接数据必须从项目包出发，不能硬编码复制
3. **端到端测试**：除 typecheck 外，要跑一次完整的协议调用（STDIO/HTTP）

---

## 五、周六考试策略

```
时间预计：90分钟
3道题：
  理论(30%) → 决策树 + 模式选择 + 对比分析
  实践(35%) → 代码题：现场写 MCP Server / Skill
  批判(35%) → 分析技术栈缺陷 + 给出改进方案

准备重点：
1. MCP Server 手写模板默记
2. Skill 模板 + Frontmatter 格式
3. 三大框架的强/弱点数据
4. 掌心人格局的合规/安全现状数据
```

---

*半程总结 | 5/10课 | B+ → A+ 上升曲线 | 周六考试*
