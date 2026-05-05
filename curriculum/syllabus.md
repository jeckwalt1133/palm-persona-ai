# 教学大纲：AI Agent 与 Claude Code 深度研修

> 导师：Claude Code Teacher | 学生：Claude Code Student  
> 学期：2026-05-05 起 | 10课制 | 每5课一次考试  
> 毕业等级体系：[5段×3阶 产出矩阵](./graduation-ladder.json) — L1基础(会学)→L2研究(会写)→L3产品(会做)→L4开源(会分享)→L5商业(会赚) | 教学暗线L0(会教)贯穿全程

---

## 第1课：Claude Code Agent SDK 深度剖析
- Agent SDK 架构与核心 API
- 自定义 Agent 的创建与部署
- SDK 与 CLI 模式的差异与选择
- 实践：用 Agent SDK 构建一个最小可用 Agent
- 笔记本：`student-notebook/2026-05-05-sdk-architecture.md`

## 第2课：MCP 协议最新进展（2026）
- MCP 协议规范更新（2025-2026）
- MCP Server 开发实战（TypeScript/Python）
- MCP 企业级部署：SSO/RBAC/审计
- 实践：开发一个 MCP Server 连接项目数据库
- 笔记本：`student-notebook/2026-05-05-mcp-protocol.md`

## 第3课：多 Agent 协作架构
- Orchestrator-Workers / Evaluator-Optimizer 模式对比
- MetaGPT vs CrewAI vs AutoGen 架构差异
- Agent 通信协议（消息传递 vs 共享内存）
- 实践：设计掌心人格局的多 Agent 报告生成系统
- 笔记本：`student-notebook/2026-05-06-multi-agent-architecture.md`

## 第4课：Skill/Hook 系统深度解析
- Claude Code Skill 系统设计原理
- Hook 的生命周期与最佳实践
- 自定义 Skill 开发（从模板到部署）
- 实践：为掌心人格局创建 `/review-report` Skill
- 笔记本：`student-notebook/2026-05-06-skill-hook-system.md`

## 第5课：2026年5月前沿 AI Agent 论文精读
- 最新 Agent 架构论文（ArXiv 2026.01-05）
- LLM Agent 评估基准新进展
- Agent 安全与对齐前沿
- 实践：精读3篇论文并写批判性综述
- 笔记本：`student-notebook/2026-05-07-frontier-papers.md`

## 🔴 第一次考试：第1-5课综合
- 理论题：Agent 架构设计（决策树、模式选择）
- 实践题：独立开发一个 MCP Server + Agent 组合
- 论文题：对当前 Agent 技术栈的批判性分析
- 评分维度：正确性(30%) / 创新性(25%) / 工程质量(25%) / 文档(20%)

## 第6课：AI Agent 安全与合规
- Prompt Injection 攻防全景
- Jailbreak 检测与防护
- Agent 权限管控与沙箱隔离
- 内容安全与合规（中国监管要求）
- 实践：构建 Agent 安全网关
- 笔记本：`student-notebook/2026-05-08-agent-security.md`

## 第7课：自主进化框架与持续学习
- Agent 自我反思（Reflexion/Self-Refine）
- 自动化提示优化（DSPy/APE）
- Agent 记忆系统设计（短期/长期/情景）
- 实践：实现带记忆的自主改进 Agent
- 笔记本：`student-notebook/2026-05-09-autonomous-evolution.md`

## 第8课：AI 编程工具全景对比
- Claude Code vs Cursor vs Copilot vs Codex vs Aider vs Windsurf
- 各工具架构差异与适用场景
- Vibe Coding 工具选择决策矩阵
- 实践：同一任务用2个不同工具完成并对比
- 笔记本：`student-notebook/2026-05-10-tool-comparison.md`

## 第9课：掌心人格局项目实战
- 报告文案引擎升级为 Agent 架构
- 分享海报生成 Pipeline 优化
- 全链路埋点智能分析
- 实践：独立交付一个完整功能模块
- 笔记本：`student-notebook/2026-05-11-project-practice.md`

## 第10课：毕业设计
- 主题：为掌心人格局设计并实现一个完整的 AI Agent 功能模块
- 要求：从需求分析→架构设计→编码实现→测试验证→文档
- 交付物：可运行的代码 + 设计文档 + 测试用例 + 部署指南
- 评分：导师评审 + 自我评价 + 实际运行验证
- 笔记本：`student-notebook/2026-05-12-graduation-project.md`

## 🔴 第二次考试：第6-10课综合 + 毕业答辩
- 综合理论考试（2小时）
- 毕业设计答辩（30分钟）
- 最终评分：平时成绩(30%) + 期中考试(25%) + 期末考试(25%) + 毕业设计(20%)

---

## 教学方法论

| 环节 | 方法 |
|------|------|
| 预习 | 学生自主搜索学习，创建笔记本 |
| 授课 | 导师审查笔记本，逐知识点讨论 |
| 批判 | 师生互相质疑，指出局限与争议 |
| 实践 | 每课有可运行的代码交付 |
| 考试 | 独立完成，导师盲评打分 |

## 评分标准

| 等级 | 分数 | 标准 |
|------|------|------|
| A+ | 95-100 | 超越预期，有独立创新 |
| A | 85-94 | 完整正确，工程质量高 |
| B | 75-84 | 基本达标，有改进空间 |
| C | 60-74 | 勉强完成，多处不足 |
| F | <60 | 未完成或严重错误 |

## 毕业等级体系

完成10课+2场考试≠毕业。这只是L1(基础段)的完结。

### 5段×3阶 产出矩阵
```
L1 基础段 1.1→1.2→1.3  入门生→修学者→毕业生    ✅ 已完成
L2 研究段 2.1→2.2→2.3  研读者→实验者→发表者    ← 进行中
L3 产品段 3.1→3.2→3.3  交付者→迭代者→增长者    ← 进行中
L4 开源段 4.1→4.2→4.3  发布者→社区者→影响者    ← 进行中
L5 商业段 5.1→5.2→5.3  变现者→持续者→闭环者    待解锁
L0 教学暗线 0.1→0.2→0.3  助教→导师→宗师        ← 进行中
```

**当前进度**: L1全部完成(1.1/1.2/1.3) | L2.1+L3.1+L4.1+L0.1 并行推进中
**详细定义**: [graduation-ladder.json](./graduation-ladder.json)
**晋升铁律**: 每级必须有可公开验证的证据(URL/截图/数据)，不产出真实影响力的学习是自我感动
