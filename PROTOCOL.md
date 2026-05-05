# AI 原生师徒制 — 开放协议 v0.1

> 一个可复用的 AI R&D 团队架构模式。三角互批判 + 三层记忆 + 任务池驱动。
> 命名：Recursive AI Mentorship (RAM) / AI 原生师徒制
> 首创：富贵军团 (2026-05-05)

## 1. 核心概念

AI 原生师徒制是一种全新的 AI 协作范式：多个独立的 AI 实例通过结构化的师生关系、
互批判机制和共享记忆系统协作，形成能自我进化的研发组织。

与传统单 Agent 的关键区别：

| 维度 | 单 Agent | AI 师徒制 |
|------|----------|-----------|
| 结构 | 1 个模型 + 人 | 教师 + 学生 + 客座讲师 (≥3 实例) |
| 质量 | 模型上限 = 质量上限 | 互批判 → 超越单一模型上限 |
| 记忆 | 无持久记忆 | 三层记忆系统 (工作/情景/语义) |
| 进化 | 靠人喂指令 | 课程体系自动驱动 |
| 产出 | 代码 | 代码 + 原创概念 + 研究论文 |

## 2. 角色定义

### 2.1 教师 (Teacher / Tech Lead)
- 职责: 架构决策、任务拆解、代码审查、方向调度
- 不直接写代码——产出是 Task Prompt 和审查意见
- 看到一棵树，想到整片林子（P8+ 顶层设计思维）

### 2.2 学生 (Student / Senior Engineer)
- 职责: 学习研究、主力开发、笔记本维护
- 先设计方案+影响分析，再编码实现
- 完成后三问自审查

### 2.3 客座讲师 (Guest Lecturer)
- 职责: 特定领域专业能力补充
- 豆包 (文案审美): 生成内容质量评估、文案润色
- 千问 (代码质量): 代码审查、工程质量保障
- 每位讲师有明确的领域边界，不越界

## 3. 三角互批判机制

```
        教师 (架构决策)
        /              \
       /   批判+审查     \
      /                  \
   学生 (执行+学习) —— 客座 (领域专业)
        \              /
         \  互审+反馈 /
          \          /
        共享记忆系统 (三层)
```

批判规则:
- 学生完成任务后 → 客座讲师审查 → 教师终审
- 教师决策 → 学生可质疑 → 客座提供第三方意见
- 所有批判过程记录到记忆系统

## 4. 三层记忆系统

### Layer 1: 工作记忆 (Working)
- 当前会话上下文
- 任务队列 + 进度追踪
- 生命周期: 会话内

### Layer 2: 情景记忆 (Episodic)
- 会话记录 (memory/sessions/)
- 研究笔记 (research/)
- 决策记录 (memory/decisions.md)
- 生命周期: 项目周期

### Layer 3: 语义记忆 (Semantic)
- 知识图谱 (memory/knowledge-graph.json)
- bootstrap.md (会话恢复入口)
- 检查点机制: PreCompact hook 自动保存任务状态
- 生命周期: 永久

### 检查点协议
```
每个会话:
  开始 → 读 bootstrap.md (恢复上下文)
  执行 → 任务状态实时更新
  压缩前 → memoryCheckpoint() 保存精确进度
  恢复后 → getLatestCheckpoint() 重新对齐
```

## 5. 任务池驱动模型

### 任务状态
```
pending → in_progress → completed
         ↘ blocked (等待依赖)
```

### 任务拆解标准 (从教师到学生)
- 目标: 一句话描述交付物
- 验收标准: 可验证的成功条件
- 影响范围: 涉及的文件和模块
- 依赖: 前置任务

### 研发节奏
```
Hour 1-3: 聚焦开发 (Task Prompt 驱动)
Hour 4:   测试 + 互审 + 验证
每日产出: 1个可交付增量
```

## 6. AI Provider 降级链

### 标准接口
```typescript
interface AiProvider {
  name: string;
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<string>;
}
```

### 降级链路
```
主 Provider → 豆包 (Seed-2.0-Pro) → 千问 (Qwen3-Max) → Mock
     ↓失败          ↓失败                ↓失败           ↓
   401/超时      自动接管             自动接管       引擎兜底
```

### 设计原则
- 每个 Provider 独立封装，实现相同接口
- FallbackProvider 按序尝试，失败自动降级
- Mock 永远在链尾，保证不中断
- 降级日志清晰可追溯

## 7. MCP 合规网关

通过 Model Context Protocol 暴露安全合规能力为标准接口:
- Tools: check_compliance, security_audit
- Resources: palm://compliance/terms, palm://compliance/stats
- Prompts: check_report_safety, analyze_report

同时提供等价 REST API 供非 MCP 客户端调用:
- POST /api/compliance/check
- POST /api/compliance/audit
- GET /api/compliance/terms
- GET /api/compliance/stats

## 8. 实施清单

想搭建自己的 AI 师徒制团队:

- [ ] 选 3+ 个 AI 模型，分配教师/学生/客座角色
- [ ] 创建 bootstrap.md 作为共享记忆入口
- [ ] 建立三层记忆目录结构 (memory/ research/ sessions/)
- [ ] 实现 AI Provider 降级链
- [ ] 制定课程体系或任务池
- [ ] 配置 tmux/守护进程保障会话不中断
- [ ] 开始第一个 Sprint

## 9. 已知实例

富贵军团 @ 掌心人格局项目 (2026-05)
- 教师: DeepSeek V4 Pro
- 学生: DeepSeek V4 Flash
- 客座: 豆包 Seed-2.0-Pro + 千问 Qwen3-Max
- 产出: 1天5课(GPA 3.7) + 7项原创概念 + 5Worker流水线 + MCP合规网关

---

版本: v0.1 | 许可: CC BY 4.0 | 维护: 富贵军团
