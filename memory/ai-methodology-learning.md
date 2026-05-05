---
name: AI能力强化学习记录
description: 2026-05-05 2小时深度学习全球AI顶级方法论，覆盖LLM工程、Agent架构、提示工程、安全、MCP生态
type: reference
originSessionId: 4671aa3c-b6dc-4593-a8de-668679929948
---
# AI 能力强化学习记录（2026-05-05）

## 学习目标
通过互联网搜集全球AI领域顶级人物、开发者、研究者的方法论和最佳实践，全面提升AI Agent开发能力。

## 学习成果
- 生成两份学习报告，共约32KB
- `learning/global-ai-masters-report.md` (619行, 16章, 22KB) — 全球AI方法论全景
- `learning/zhouhongyi-douyin-report.md` (9.8KB) — 周鸿祎抖音IP分析

## 核心摄入知识点

### Agent架构 (Anthropic官方)
- 5种工作流模式：提示链→路由→并行化→编排器-工作者→评估器-优化器
- ACI设计原则：站在模型角度、防错设计、贴近自然文本
- 决策树：永远从最简单的方案开始验证

### 提示工程
- 18种技术：CoT→Self-Consistency→ToT→ReAct→Reflexion→APE
- DSPy范式：编程替代手工提示是趋势
- 生产系统：上下文工程+函数调用+Agent架构

### AI领袖方法论
- Karpathy: 从零构建理解、极致简洁、历史谦逊
- Simon Willison: 工具即博客、手机开发、Ralph Loop模式
- Anthropic: 安全与能力并重、透明展示规划步骤

### 安全防护
- 五层防御：输入过滤→安全分类→沙箱隔离→输出校验→审计日志
- 职责分离：安全检查和核心响应用不同模型
- 1,405个真实越狱提示的攻防数据库

### 中国AI生态
- 开源三强：DeepSeek(极致性价比)、Qwen(Agent原生)、GLM(超长上下文)
- 闭源：文心、豆包、Kimi各有特色
- Dify是中国生态最成熟的Agent可视化平台

### MCP协议
- AI工具生态的标准化协议（TCP/IP类比）
- 10+语言SDK、数千Server覆盖数据库到Slack
- 企业级：SSO/RBAC/审计/付费端点

## Why
用户要求通过互联网学习全球AI知识以强化Claude Code能力。由于抖音访问受限（CDP被检测、API需签名、SPA需JS渲染），转向多渠道信息聚合策略。

## How to apply
- 在掌心人格局项目中应用Agent架构决策树
- 报告文案引擎从静态模板升级为提示链架构
- CLAUDE.md应包含项目架构决策和测试策略
- MCP协议是连接外部工具的标准途径
