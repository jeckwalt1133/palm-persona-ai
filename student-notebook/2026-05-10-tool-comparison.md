---
name: 第8课 — AI 编程工具全景对比
description: Claude Code vs Cursor vs Copilot vs Codex vs Aider vs Windsurf
---

# 第8课：AI 编程工具全景对比

## 六大工具概览

| 工具 | 厂商 | 架构 | 价格 | 最佳场景 |
|------|------|------|------|---------|
| **Claude Code** | Anthropic | CLI Agent + MCP | Pro $20/Max $100/$200 | 复杂 Agent 任务、MCP 集成、多文件重构 |
| **Cursor** | Anysphere | IDE + Agent | $20/月 | 日常编码、快速迭代、小步修改 |
| **GitHub Copilot** | Microsoft/OpenAI | IDE 补全 + Agent | $10/月 | 代码补全、简单任务 |
| **Codex CLI** | OpenAI | CLI Agent | API 按量计费 | 开源 Agent、自定义 |
| **Aider** | Paul Gauthier | CLI + Git | 免费(自带API Key) | Git 原生、开源、代码库修改 |
| **Windsurf** | Codeium | IDE + Agent | 免费/付费 | 免费入门、Flow 模式 |

## 架构差异

```
Claude Code:   CLI ←→ MCP ←→ Tools/Resources/Prompts
               ↑ Agent SDK + Hook 系统 + Skill 生态

Cursor:        IDE ←→ Agent ←→ Terminal/编辑器
               ↑ 内嵌补全、Tab、内联编辑

Copilot:       IDE ←→ Copilot Agent
               ↑ 补全为主，Agent 模式较新

Aider:         CLI ←→ Git ←→ 文件系统
               ↑ 每次修改自动 commit，方便回滚
```

## 掌心人格局的选型决策

### 为什么选 Claude Code？
1. **MCP Server 原生支持** — 直接集成 palm-mcp-server
2. **Hook 系统** — 自动化合规检查、提交前验证
3. **Skill 生态** — `/review-report` 等自定义技能
4. **多文件重构** — 掌心人格局是 monorepo，经常跨包修改
5. **Agent 模式** — 复杂任务（如"分析引擎升级"）需要多步推理

### 什么场景用其他工具？
- **Cursor** — 快速改 UI 样式、单文件调整时更快
- **Aider** — 需要 git 原生回滚、开源透明时
- **Copilot** — 只需要代码补全时（最轻量）

## 实践：工具决策矩阵

```
任务类型 → CLI工具(重构/Agent) → IDE工具(微调/补全) → 选型结果
                                                                   
多文件重构+测试    → Claude Code    → Cursor    → Claude Code ✅
单行样式修复       → Claude Code    → Cursor    → Cursor ✅  
新 API 端点        → Claude Code    → Aider     → Claude Code ✅
代码补全           → -              → Copilot   → Copilot ✅
```

## 结论

掌心人格局用 Claude Code 作为主力工具是正确的——MCP + Hook + Skill 三件套是其他工具不具备的。Cursor/Copilot 作为辅助，在特定场景提速。

## 考点
- 六大工具的核心差异（架构/价格/场景）
- 掌心人格局为什么选 Claude Code
- 工具决策矩阵的使用方法
