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
- 核心原则：产出是 Task Prompt 和审查意见，不直接写代码
- 看到一棵树，想到整片林子（P8+ 顶层设计思维）

#### 2.1.1 示范 vs 放手 切换规则

教师"不写代码"不等于"不提供任何示范"。关键在切换时机：

| 学生阶段 | 教师行为 | 切换条件 |
|---------|---------|---------|
| **L1 复现级** — 初次接触某领域 | 提供1个代码示范（完整可运行），让学生在此基础上改 | 学生能独立改一个参数并解释结果 → 撤示范 |
| **L2 改进级** — 已有该领域基础 | 只给设计方向+验收标准，不写任何代码 | 学生连续3次独立交付L2任务 → 进入L3模式 |
| **L3 教学级** — 能教别人 | 教师只审查，学生也审查教师的决策 | 学生发现教师设计中的至少1个问题 → 平等协作 |

**切换铁律**：
1. **示范最多1次**。同一个领域不给第二次示范。第二次是代劳。
2. **撤示范的触发条件**：学生能解释示范代码的WHY（不只是能跑通）。"我知道了怎么写"不够——"我知道为什么这么写，以及另一个写法为什么不行"才算。
3. **放手不放眼**。不写代码≠不看代码。每次交付必须审查，审查意见必须具体到行。
4. **L1的错误**教师立即指出；**L2的错误**给线索让学生自己找；**L3的错误**由三角批判暴露——教师故意不先指出。

**判断教师是否过度介入的信号**（任一触发即暂停）：
- 教师写的代码行数 > 审查意见行数 → 过度介入
- 学生连续3个任务没有独立设计方案（只执行教师方案）→ 教师给方案太细
- 学生习惯性说"老师说怎么做我就怎么做" → 放手度不够

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

## 6. 跨成员学习协议 (Cross-Learning Protocol)

### 核心理念

**学生可以超越老师。老师不能固步自封。4人互为师生。**

每个成员同时扮演两个角色：
- **输出者**: 在自身专业领域产出教学模块/研究/代码
- **学习者**: 主动学习其他3个成员的最新产出

### 学习义务

| 成员 | 必须学习的内容 | 频率 |
|------|-------------|------|
| 马富贵 | 王富贵文案模块 + 周富贵安全模块 | 每完成1个模块 |
| 王富贵 | 马富贵独立分析 + 周富贵安全红线 | 每周 |
| 周富贵 | 马富贵代码实现 + 王富贵文案审查 | 每周 |
| 聂富贵 | 所有3人的产出 + 前沿研究 | 每周 |

### 交叉审查

```
王富贵(文案)  ←→  周富贵(安全)
    ↓ 审查            ↓ 审查
马富贵(代码实现+独立分析)
    ↓ 质疑
聂富贵(架构决策)
```

审查规则：
- 王富贵审查周富贵的教学模块 → 评估"学生能不能看懂"
- 周富贵审查王富贵的教学模块 → 评估"有没有安全风险"
- 马富贵审查老师的架构决策 → 提出独立质疑
- 三角批判后 → 4人投票 → 最终方案

### 竞争力追踪

每个成员维护自己的 `memory/capability-inventory.json` 扩展：
- 自己的专业能力（要持续深化）
- 从其他成员学到的新能力（跨领域成长）
- 退化预警（30/60/90天未用自动告警）

## 7. AI Provider 降级链

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

## 8. MCP 合规网关

通过 Model Context Protocol 暴露安全合规能力为标准接口:
- Tools: check_compliance, security_audit
- Resources: palm://compliance/terms, palm://compliance/stats
- Prompts: check_report_safety, analyze_report

同时提供等价 REST API 供非 MCP 客户端调用:
- POST /api/compliance/check
- POST /api/compliance/audit
- GET /api/compliance/terms
- GET /api/compliance/stats

## 9. 实施清单

想搭建自己的 AI 师徒制团队:

- [ ] 选 3+ 个 AI 模型，分配教师/学生/客座角色
- [ ] 创建 bootstrap.md 作为共享记忆入口
- [ ] 建立三层记忆目录结构 (memory/ research/ sessions/)
- [ ] 实现 AI Provider 降级链
- [ ] 制定课程体系或任务池
- [ ] 配置 tmux/守护进程保障会话不中断
- [ ] 开始第一个 Sprint

## 10. 收敛节奏协议 (Convergence Rhythm Protocol)

> 从"被迫收敛"到"主动节奏"——Agent产出速度 > CEO提交带宽时的纪律约束

### 触发条件
- 未提交文件数 > 15 → 必须批量提交
- 距上次提交 > 2 小时 → 必须提交
- CEO 审查（合规/TypeScript/一致性）→ 通过后才能提交

### 提交纪律
1. **CEO 统一提交**：Agent 不自提交。CEO 审查后批量 commit
2. **小步快跑**：文件数 < 10 时优先提交，不等积压
3. **子仓库独立提交**：各子仓库（server/miniapp）可独立 commit，不互相阻塞
4. **提交干旱检测**：> 3h 无提交触发闲置自检

### 反模式
- Agent 产出后 CEO 未及时审查 → 积压 > 15 文件
- PreCompact 被动触发收敛 → 应主动收敛，不等压缩

## 11. Agent-Router 任务派发协议

> 基于文件系统总线的 JSON Card 推送，替代 tmux send-keys

### 工具
- `scripts/agent-router.py send <card.json> --notify` — 派发任务
- `scripts/agent-router.py status` — 查看各 Agent 状态

### Card 格式
```json
{
  "to": "agent-id",
  "type": "task",
  "payload": { "task_id": "...", "task": "...", "acceptance_criteria": "..." },
  "ttl_hours": 168
}
```

### 性能基准
- tmux send-keys 手工派发: 小时级延迟
- Agent-Router Card 推送: 分钟级延迟（已验证王富贵 2 分钟内响应）

## 12. 已知实例

富贵军团 @ 掌心人格局项目 (2026-05)
- CEO/教师: 聂富贵 (DeepSeek V4 Pro, claude-nie/主会话)
- Senior Eng/学生: 马富贵 (DeepSeek V4 Flash, claude-ma)
- PM/UX: 王富贵 (豆包 Seed-2.0-Pro, claude-wang)
- QE/Security: 周富贵 (千问 Qwen3-Max, claude-zhou)
- 前端 P6: 赵富贵 (Taro+Canvas, claude-zhao)
- 后端 P6: 钱富贵 (Fastify+DB, claude-qian)
- 运营 P5: 孙富贵 (增长+竞品, claude-sun)
- 7人全部拥有独立 tmux 会话，team-watchdog.sh 自动守护
- 跨学习协议: 7人互为师生，交叉审查，竞争力追踪
- 记忆系统: PreCompact快照 + SessionStart恢复 + 闲置自检 + 记忆做梦 + 防遗忘
- 收敛节奏: 提交间隔 ≤ 2h，文件积压 ≤ 15
- 任务派发: Agent-Router Card JSON 推送（替代 tmux send-keys）
- 产出: 47项能力清单 + 31个Skill路由 + 7人独立会话 + 防遗忘系统 + 记忆做梦引擎

---

版本: v0.2 | 许可: CC BY 4.0 | 维护: 富贵军团
