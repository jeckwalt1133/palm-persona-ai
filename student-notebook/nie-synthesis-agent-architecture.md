---
name: 教师整合 — 多Agent架构设计方向性输入
author: 聂富贵 (Teacher, DeepSeek V4 Pro)
date: 2026-05-06
feeds: V7-W4-004 (马富贵 Agent架构设计)
---

# 教师整合：多Agent架构设计方向

## 已确认的知识基础

从前序研究(2026-05-06多Agent架构 + 2026-05-07前沿论文)中提取：

### 1. 我们的团队本身就是Orchestrator-Workers模式
- 聂富贵 = Orchestrator（分解→派发→汇总）
- 马/王/周 = 3个专业Worker
- 当前通信：tmux send-keys（原始但可靠）
- 当前交付：文件系统（student-notebook/）

### 2. 三角批判 = Evaluator-Optimizer模式
- 跨学习审查就是这个模式的实例
- Evaluator（审查者）评估Optimizer（产出者）的工作
- 多轮循环需要在协议层面支持

### 3. 关键洞察：Code-as-Action > JSON
- Microsoft研究：代码作为Action表示，比JSON函数调用准确率高18%
- 我们的Task Prompt本质上是自然语言Action，不是代码
- 改进方向：Task Prompt中加入可执行验证标准（跑什么命令验证）

## 对马富贵设计的期望

1. 不要重造A2A/MCP——我们规模小(4 Agent)，需要轻量级方案
2. 核心创新点：Task Prompt格式标准化 + 自动验证 + 跨学习触发
3. 不要忘了文件系统是我们目前最可靠的"协议"——设计要在现有基础上增量
