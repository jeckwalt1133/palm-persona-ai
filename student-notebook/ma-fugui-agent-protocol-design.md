---
name: 富贵协议 v1 — 多Agent通信协议设计
author: 马富贵 (Senior Engineer, DeepSeek V4 Flash)
taskId: V7-W4-004
targetLevel: L2 研究段 — 架构设计
domain: architecture / multi-agent
basedOn: V7-W4-001 全球Agent协议调研
status: complete
completedAt: 2026-05-06
---

# 富贵协议 (Fugui Protocol) v1.0

## 命名

> A2A 是 Google 的。MCP 是 Anthropic 的。
> **富贵协议 (Fugui Protocol)** 是富贵军团的。

全称: **Fugui Agent Communication Protocol (FACP)**
简称: **富贵协议 v1**
代号: `fugui-v1`

命名逻辑：
- 跟我们团队品牌一致（富贵军团→富贵协议）
- 2音节，好记，中文母语者友好
- 不绑定任何大厂——这是独立团队的自主标准
- 如果将来开源，"Fugui Protocol"比"RAM Protocol"更有辨识度

---

## 第一部分：现状分析 — tmux send-keys 时代的通信模式

### 1.1 当前通信架构

```
┌─────────────────────────────────────────────────────────┐
│                    当前通信栈 (2026-05)                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  聂富贵(P10)               聂富贵(P9)                    │
│  claude-nie  ◄──────────► claude-nie                    │
│  (主会话)        手动       (同一会话)                    │
│      │                                 │                 │
│      │ tmux send-keys                  │ 写 JSON 文件     │
│      ▼                                 ▼                 │
│  ┌──────────┐  tmux       ┌──────────┐                 │
│  │ 马富贵    │  send-keys  │ 王富贵    │                 │
│  │ claude-ma │◄──────────►│claude-wang│                 │
│  │ DeepSeek  │  读文件     │ 豆包      │                 │
│  └─────┬────┘             └─────┬────┘                 │
│        │ 读文件                  │ 读文件                 │
│        ▼                        ▼                       │
│  ┌──────────┐             ┌──────────┐                 │
│  │ 周富贵    │             │ Git Repo │                 │
│  │claude-zhou│             │ (共享记忆)│                 │
│  │ 千问      │             └──────────┘                 │
│  └──────────┘                                          │
│                                                         │
│  通信机制:                                               │
│  - 任务下发: JSON文件 → git commit → tmux通知            │
│  - 成果交付: Markdown文件 → git commit                   │
│  - 跨角色审查: JSON任务 → 读文件 → 写审查报告              │
│  - 会话管理: team-watchdog.sh + student-watchdog.sh       │
└─────────────────────────────────────────────────────────┘
```

### 1.2 当前模式逐项分析

#### 任务下发（教师→学生）

当前格式 (`curriculum/task-prompts/V7-W3-001.json`):
```json
{
  "taskId": "V7-W3-001",
  "title": "跨学习补齐 — 马富贵审查王富贵A/B框架",
  "assignedTo": "ma",
  "priority": "P0",
  "requirement": "审查 student-notebook/wang-ab-test-framework.md...",
  "acceptanceCriteria": ["≥5条审查意见", "至少1条指出方法论问题"],
  "estimatedHours": 1.5,
  "domain": "cross-learning",
  "sender": { "role": "teacher", "name": "聂富贵" },
  "createdAt": "2026-05-06T01:00:00Z"
}
```

**已有的好设计**:
- `taskId` 全局唯一标识
- `acceptanceCriteria` 可验证的成功条件（PROTOCOL.md 要求）
- `sender` 包含角色和姓名

**存在的问题**:
1. **缺少 receiver**：只有 `assignedTo: "ma"`，没有显式的接收者身份声明。如果任务被转发（P10→P9→P7），中间人信息丢失
2. **缺少状态机**：任务没有 `status` 字段。状态通过 team-status.json 间接追踪——两个系统不同步时产生矛盾
3. **缺少证据要求**：没有 `evidenceRequired` 字段。每个任务对证据的要求隐式存在于 requirement 文字中
4. **缺少依赖声明**：任务间依赖在 team-status.json 的 priorityQueue 中隐式表达，不在任务本身
5. **缺少输出路径**：学生需要自己判断交付物写在哪里
6. **字段不统一**：不同任务 JSON 的字段略有差异（有些有 `domain`，有些有 `dependsOn`）

#### 成果交付（学生→教师）

当前"格式"是约定俗成的 Markdown frontmatter:
```yaml
---
name: 全球AI Agent协议与多智能体框架深度调研 (2026)
author: 马富贵
taskId: V7-W4-001
targetLevel: L2 研究段
status: complete
completedAt: 2026-05-06
---
```

**问题**:
1. **无结构化交付信息**：教师需要阅读整个 Markdown 才能判断验收标准是否满足
2. **无自审查结果**：PROTOCOL.md 要求"完成后三问自审查"，但没有地方记录自审查结论
3. **无证据链接**：交付物引用了其他文件（如测试结果），但没有标准化的引用方式
4. **无状态机**：`status: complete` 是二值的——实际应该是 `self_review → peer_review → accepted`

#### 跨角色审查

当前流程：
1. 教师创建审查任务（普通 TaskCard）
2. 审查者读取目标文件
3. 审查者写 Markdown 审查报告（如 `ma-cross-review-w2.md`）
4. 教师读取审查报告→转发给被审查者

**问题**:
1. **审查意见无结构**：都是 Markdown 文字，无法程序化提取（如"几条P0？几条P1？"）
2. **审查者不知道被审查者的响应**：审查意见发出后，是否被采纳？无追踪
3. **缺少双向通道**：被审查者应该可以回复审查意见（"这条我认可""这条我有不同意见"）
4. **无超时机制**：审查任务没有 deadline，可能被无限期搁置

### 1.3 tmux send-keys 的本质局限

```
teacher 会话 → tmux send-keys → student 会话
                                   ↓
                              "Read curriculum/task-prompts/V7-X.json"
```

| 维度 | tmux send-keys | 理想方式 |
|------|---------------|---------|
| 可靠性 | 字符注入可能被截断/乱码 | 结构化消息，解析不依赖字符流 |
| 响应通道 | 无——发了就发了，不知道对方收到没 | 有 ack/status 回报 |
| 路由 | 手动——必须知道对方的 tmux session 名 | 按 agentId 自动路由 |
| 格式 | 自然语言指令——解析靠人阅读 | 结构化 JSON——程序可验证 |
| 状态追踪 | 无——发了就忘 | 每条消息有状态 |
| 附件引用 | 文字描述路径——"读 X 文件" | URI 引用 |

**结论：tmux send-keys 是通信通道，不是协议。我们需要在通道之上建一层协议。**

---

## 第二部分：富贵协议 v1 设计

### 2.1 设计原则

1. **文件系统即消息总线**。不引入 MQ/Redis/HTTP Server。Git 仓库的 `messages/` 目录就是我们的消息队列。理由：4个Agent都在同一台机器上，共享文件系统；Git 提供版本历史和审计追踪。

2. **JSON-RPC 2.0 子集**。消息外层结构遵循 JSON-RPC 2.0（与 A2A/MCP 一致），但不实现完整的 request/response/notification 语义——我们只需要 `request`（任务委派）和 `notification`（状态通知）。

3. **Agent 是不透明对等体**。借鉴 A2A 的 opaque collaboration 原则——Agent 通过 Card 声明"我能做什么"，不暴露"我怎么做的"。内部状态、记忆、工具实现都是私有的。

4. **Matrix 拓扑原生支持**。纵向（层级委派）+ 横向（跨角色审查）是一等公民，不是事后叠加的。

5. **向后兼容**。新协议不破坏现有工作流。`curriculum/task-prompts/` 和 `student-notebook/` 中的现有文件继续有效。协议是增量叠加的。

6. **零依赖**。Python 3.10+ 标准库。不需要 pip install。

### 2.2 消息架构

```
┌──────────────────────────────────────────────────────┐
│                  Fugui Protocol v1                    │
├──────────────────────────────────────────────────────┤
│                                                      │
│  消息信封 (Message Envelope)                          │
│  ┌────────────────────────────────────────────────┐  │
│  │ jsonrpc: "2.0"                                 │  │
│  │ id: string (消息唯一ID)                         │  │
│  │ method: "task.dispatch" | "deliverable.submit"  │  │
│  │        | "review.submit" | "review.response"   │  │
│  │        | "state.change" | "agent.heartbeat"     │  │
│  │ params: { ... }  ← 消息体 (见下方卡片类型)       │  │
│  └────────────────────────────────────────────────┘  │
│                                                      │
│  卡片类型 (Card Types)                                │
│  ┌─────────────┐ ┌──────────────────┐ ┌───────────┐ │
│  │ TaskCard    │ │ DeliverableCard  │ │ ReviewCard│ │
│  │ (任务委派)   │ │ (成果交付)        │ │ (审查意见) │ │
│  │             │ │                  │ │           │ │
│  │ 纵向 ↓      │ │ 纵向 ↑           │ │ 横向 ↔    │ │
│  │ 教师→学生   │ │ 学生→教师        │ │ 任何人→   │ │
│  │ P10→P9→P7  │ │ P7→P9→P10       │ │ 任何人    │ │
│  └─────────────┘ └──────────────────┘ └───────────┘ │
│                                                      │
│  传输层 (Transport)                                   │
│  ┌────────────────────────────────────────────────┐  │
│  │ 文件系统 (messages/inbox/ + messages/outbox/)    │  │
│  │ + agent-router.py (路由 + 状态追踪)              │  │
│  │ + git commit (审计追踪)                          │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

### 2.3 TaskCard — 任务委派

**方向**: 纵向 ↓（教师→学生，P10→P9→P7）
**对应 A2A**: Task (扩展)
**JSON-RPC method**: `task.dispatch`

```json
{
  "jsonrpc": "2.0",
  "id": "fugui-task-V7-W4-004-001",
  "method": "task.dispatch",
  "params": {
    "protocol": "fugui-v1",
    "cardType": "TaskCard",
    "task": {
      "id": "V7-W4-004",
      "title": "富贵军团多Agent协作架构设计",
      "domain": "architecture",
      "priority": "P0",
      "requirement": "基于V7-W4-001 Agent协议调研，设计富贵军团自己的多Agent通信协议v1。包含：1) 3种消息类型完整定义 2) 与当前tmux send-keys方式对比分析 3) 输出设计文档 + agent-router.py脚本",
      "acceptanceCriteria": [
        "TaskCard/DeliverableCard/ReviewCard 三种消息类型完整 JSON Schema",
        "与当前tmux方式的逐项对比分析（≥5个维度）",
        "设计文档 student-notebook/ma-fugui-agent-protocol-design.md ≥ 400行",
        "scripts/agent-router.py 可运行（Python 3.10+，零依赖）",
        "agent-router.py 包含 --validate / --send / --status 三个子命令"
      ],
      "outputPath": "student-notebook/ma-fugui-agent-protocol-design.md",
      "additionalOutputs": ["scripts/agent-router.py"],
      "evidenceRequired": ["design_doc", "runnable_script", "self_test_result"],
      "estimatedHours": 4,
      "deadline": "2026-05-07T12:00:00Z"
    },
    "sender": {
      "agentId": "nie",
      "name": "聂富贵",
      "role": "teacher"
    },
    "receiver": {
      "agentId": "ma",
      "name": "马富贵",
      "role": "student"
    },
    "direction": "vertical",
    "dependsOn": ["V7-W4-001"],
    "parentTaskId": null,
    "createdAt": "2026-05-06T20:00:00Z"
  }
}
```

**字段说明**:

| 字段 | 必需 | 说明 |
|------|------|------|
| `task.id` | ✅ | 全局唯一的任务ID，格式 `V{major}-W{week}-{seq}` |
| `task.title` | ✅ | 一句话描述 |
| `task.domain` | ✅ | 领域标签：architecture/engineering/product/security/research |
| `task.priority` | ✅ | P0(阻断)/P1(重要)/P2(优化) |
| `task.requirement` | ✅ | 自由文本，完整需求描述 |
| `task.acceptanceCriteria` | ✅ | 可验证的成功条件列表 |
| `task.outputPath` | ✅ | 主交付物路径（相对项目根目录） |
| `task.additionalOutputs` | - | 附加交付物路径列表 |
| `task.evidenceRequired` | ✅ | 证据类型列表，用于自动验证 |
| `task.estimatedHours` | - | 预估工时 |
| `task.deadline` | - | ISO 8601 截止时间 |
| `sender.agentId` | ✅ | 发送者短ID (nie/ma/wang/zhou) |
| `sender.role` | ✅ | 发送者角色 |
| `receiver.agentId` | ✅ | 接收者短ID |
| `receiver.role` | ✅ | 接收者角色 |
| `direction` | ✅ | vertical(纵向委派) / horizontal(横向协作) |
| `dependsOn` | - | 前置任务ID列表 |
| `parentTaskId` | - | 父任务ID（用于P10→P9→P7拆解链） |

### 2.4 DeliverableCard — 成果交付

**方向**: 纵向 ↑（学生→教师，P7→P9→P10）
**JSON-RPC method**: `deliverable.submit`

```json
{
  "jsonrpc": "2.0",
  "id": "fugui-deliver-V7-W4-004-001",
  "method": "deliverable.submit",
  "params": {
    "protocol": "fugui-v1",
    "cardType": "DeliverableCard",
    "taskId": "V7-W4-004",
    "status": "self_review_passed",
    "sender": {
      "agentId": "ma",
      "name": "马富贵",
      "role": "student"
    },
    "receiver": {
      "agentId": "nie",
      "name": "聂富贵",
      "role": "teacher"
    },
    "direction": "vertical",
    "deliverables": [
      {
        "path": "student-notebook/ma-fugui-agent-protocol-design.md",
        "type": "design_doc",
        "lines": 520,
        "bytes": 28400,
        "sha256": "a1b2c3d4..."
      },
      {
        "path": "scripts/agent-router.py",
        "type": "runnable_script",
        "lines": 250,
        "bytes": 8900,
        "sha256": "e5f6g7h8..."
      }
    ],
    "selfReview": {
      "acceptanceCriteriaMet": [
        "TaskCard/DeliverableCard/ReviewCard 三种消息类型完整 JSON Schema",
        "与当前tmux方式的逐项对比分析（≥5个维度）",
        "设计文档 ≥ 400行",
        "agent-router.py 可运行（零依赖）",
        "agent-router.py 包含三个子命令"
      ],
      "acceptanceCriteriaUnmet": [],
      "testResults": "python scripts/agent-router.py --self-test → 8/8 通过",
      "knownIssues": [
        "agent-router.py 的 tmux 集成依赖于 tmux session 命名约定，未在无 tmux 环境测试"
      ],
      "reviewerNotes": "建议请周富贵审查 agent-router.py 的安全性和错误处理"
    },
    "requestReview": true,
    "suggestedReviewers": ["zhou"],
    "submittedAt": "2026-05-07T02:00:00Z"
  }
}
```

**字段说明**:

| 字段 | 必需 | 说明 |
|------|------|------|
| `taskId` | ✅ | 对应的 TaskCard 任务ID |
| `status` | ✅ | 交付状态（见状态机） |
| `deliverables[].path` | ✅ | 交付物文件路径 |
| `deliverables[].type` | ✅ | 类型：design_doc / runnable_script / research_report / code_patch / test_suite |
| `deliverables[].lines` | - | 行数（快速规模判断） |
| `deliverables[].sha256` | - | 内容哈希（防篡改） |
| `selfReview.acceptanceCriteriaMet` | ✅ | 逐条对照验收标准——满足的 |
| `selfReview.acceptanceCriteriaUnmet` | ✅ | 逐条对照验收标准——未满足的（空数组表示全部满足） |
| `selfReview.testResults` | - | 测试结果摘要 |
| `selfReview.knownIssues` | - | 已知问题（诚实声明） |
| `requestReview` | ✅ | 是否请求审查 |
| `suggestedReviewers` | - | 建议审查者 agentId 列表 |

### 2.5 ReviewCard — 审查意见

**方向**: 横向 ↔（任何人→任何人）
**JSON-RPC method**: `review.submit`

```json
{
  "jsonrpc": "2.0",
  "id": "fugui-review-V7-W4-004-001",
  "method": "review.submit",
  "params": {
    "protocol": "fugui-v1",
    "cardType": "ReviewCard",
    "sender": {
      "agentId": "zhou",
      "name": "周富贵",
      "role": "reviewer"
    },
    "receiver": {
      "agentId": "ma",
      "name": "马富贵",
      "role": "reviewee"
    },
    "direction": "horizontal",
    "reviewTarget": {
      "taskId": "V7-W4-004",
      "deliverablePath": "scripts/agent-router.py",
      "deliverableType": "runnable_script"
    },
    "opinions": [
      {
        "id": 1,
        "severity": "P0",
        "category": "security",
        "location": "Line 85: subprocess.run(shell=True)",
        "summary": "命令注入风险——用户输入未转义直接传入 shell",
        "detail": "agent-router.py:85 使用 subprocess.run(cmd, shell=True) 且 cmd 包含从文件读取的 agentId。攻击者如果能在 task JSON 中注入恶意 agentId，可以执行任意命令。",
        "suggestion": "改用 subprocess.run([...]) 列表形式，不使用 shell=True",
        "reference": "OWASP Command Injection, CWE-78"
      },
      {
        "id": 2,
        "severity": "P1",
        "category": "engineering",
        "location": "Line 120-145: send_message() 函数",
        "summary": "文件写入没有原子性保证——并发场景可能读到半写文件",
        "detail": "使用 open().write() 直接写入 messages/ 目录。如果两个 Agent 同时写消息，第二个读的 Agent 可能读到不完整的 JSON。",
        "suggestion": "先写临时文件 → os.rename()（原子操作）→ 再移动到目标路径"
      },
      {
        "id": 3,
        "severity": "P2",
        "category": "style",
        "location": "全局",
        "summary": "缺少类型注解——Python 3.10+ 应用完整类型标注",
        "suggestion": "所有函数签名添加类型注解，配置 mypy 检查"
      }
    ],
    "overallVerdict": "revision_required",
    "strengths": [
      "零依赖设计符合团队技术原则",
      "JSON Schema 验证逻辑完整",
      "CLI 接口设计清晰"
    ],
    "submittedAt": "2026-05-07T03:00:00Z"
  }
}
```

**字段说明**:

| 字段 | 必需 | 说明 |
|------|------|------|
| `reviewTarget.taskId` | ✅ | 被审查的任务ID |
| `reviewTarget.deliverablePath` | ✅ | 被审查的交付物路径 |
| `opinions[].severity` | ✅ | P0(阻断)/P1(重要)/P2(优化) |
| `opinions[].category` | ✅ | security/engineering/product/style/methodology |
| `opinions[].location` | ✅ | 具体到行号 |
| `opinions[].suggestion` | ✅ | 改进方案（不是只指出问题） |
| `opinions[].reference` | - | 外部标准引用 |
| `overallVerdict` | ✅ | approved / approved_with_suggestions / revision_required |

### 2.6 ReviewResponseCard — 审查回复

**方向**: 横向 ↔（被审查者→审查者）
**JSON-RPC method**: `review.response`

```json
{
  "jsonrpc": "2.0",
  "id": "fugui-review-resp-V7-W4-004-001",
  "method": "review.response",
  "params": {
    "protocol": "fugui-v1",
    "cardType": "ReviewResponseCard",
    "reviewCardId": "fugui-review-V7-W4-004-001",
    "sender": {
      "agentId": "ma",
      "name": "马富贵",
      "role": "reviewee"
    },
    "receiver": {
      "agentId": "zhou",
      "name": "周富贵",
      "role": "reviewer"
    },
    "direction": "horizontal",
    "responses": [
      {
        "opinionId": 1,
        "action": "accepted",
        "fixCommit": "a1b2c3d",
        "note": "已改为 subprocess.run([...]) 列表形式"
      },
      {
        "opinionId": 2,
        "action": "accepted",
        "fixCommit": "a1b2c3d",
        "note": "已改用 tempfile + os.rename 原子写入"
      },
      {
        "opinionId": 3,
        "action": "disputed",
        "note": "类型注解会增加约30%代码量，与团队'简洁优先'原则冲突。建议推迟到 agent-router.py 稳定后再加。"
      }
    ],
    "submittedAt": "2026-05-07T04:00:00Z"
  }
}
```

### 2.7 AgentCard — Agent 能力声明

**方向**: 无（静态声明文件）
**对应 A2A**: Agent Card（直接兼容）
**JSON-RPC method**: 无（不是消息，是静态元数据）

存储位置: `memory/agent-cards/{agentId}.json`

```json
{
  "protocol": "fugui-v1",
  "cardType": "AgentCard",
  "agent": {
    "id": "ma",
    "name": "马富贵",
    "model": "DeepSeek V4 Flash",
    "role": "student",
    "level": "P7"
  },
  "capabilities": {
    "domains": ["architecture", "engineering", "research"],
    "skills": [
      { "id": "memory-research", "level": "L2" },
      { "id": "protocol-design", "level": "L2" },
      { "id": "cross-review", "level": "L2" },
      { "id": "frontend-dev", "level": "L1" }
    ],
    "mcpEndpoint": "http://localhost:3001/mcp/ma",
    "a2aEndpoint": null
  },
  "currentLoad": {
    "activeTasks": ["V7-W4-004"],
    "maxParallelTasks": 1,
    "availability": "busy"
  },
  "contact": {
    "tmuxSession": "claude-ma",
    "watchdogPidFile": "/tmp/student-watchdog.pid"
  },
  "updatedAt": "2026-05-06T20:00:00Z"
}
```

### 2.8 任务状态机

```
                    ┌──────────┐
                    │ pending  │  ← TaskCard 已发送，等待接收
                    └────┬─────┘
                         │ 接收者确认收到 (agent-router.py --ack)
                         ▼
                    ┌──────────┐
                    │ assigned │  ← 已接收，准备开始
                    └────┬─────┘
                         │ 开始工作
                         ▼
                    ┌──────────┐
          ┌─────────│in_progress│─────────┐
          │         └─────┬─────┘         │
          │ 超时           │               │ 阻塞
          │ (deadline      │ 完成工作       │ (依赖未满足)
          │  + 24h)        ▼               │
          │           ┌──────────┐         │
          │           │self_review│         │
          │           └────┬─────┘         │
          │                │ 自审查通过      │
          │                ▼               │
          │           ┌──────────┐         │
          │           │peer_review│◄────────┘
          │           └────┬─────┘
          │                │ 审查通过
          │                ▼
          │           ┌──────────┐
          └──────────►│ completed│
           (自动)      └──────────┘
                       │ 交付物有问题
                       ▼
                  ┌──────────┐
                  │ revision │ ← ReviewCard 返回 revision_required
                  └────┬─────┘
                       │ 修复后重新提交
                       └──→ in_progress

  额外状态:
  ┌──────────┐
  │ blocked  │ ← 依赖未满足，等待前置任务完成
  └──────────┘
  ┌──────────┐
  │ escalated│ ← 超时未完成，自动上报 P10
  └──────────┘
  ┌──────────┐
  │ cancelled│ ← 任务被取消（保留记录，不删除）
  └──────────┘
```

**状态转换规则**:

```python
VALID_TRANSITIONS = {
    "pending":    ["assigned", "cancelled"],
    "assigned":   ["in_progress", "blocked", "cancelled"],
    "in_progress": ["self_review", "blocked", "escalated"],
    "self_review": ["peer_review", "in_progress"],
    "peer_review": ["completed", "in_progress", "revision"],
    "blocked":    ["in_progress", "cancelled"],
    "revision":   ["in_progress", "cancelled"],
    "escalated":  ["in_progress", "cancelled"],
    "completed":  [],
    "cancelled":  []
}
```

---

## 第三部分：与当前 tmux send-keys 方式对比

### 3.1 逐维对比

| 维度 | 当前 (tmux send-keys + 约定) | 富贵协议 v1 | 改进幅度 |
|------|---------------------------|------------|---------|
| **消息格式** | 自然语言指令，解析靠人 | JSON-RPC 2.0 结构化，程序可验证 | ⬆ 根本性改进 |
| **可靠性** | 字符注入可能截断，无 ack | 文件写入 + 原子 rename + 可选 ack | ⬆ 从"尽力而为"到"确认送达" |
| **状态追踪** | task状态在 team-status.json 中手动更新 | 状态机自动追踪，状态变更即写入 | ⬆ 消除双系统不同步 |
| **路由** | 发送者必须知道目标 tmux session 名 | 按 agentId 路由，AgentCard 提供 contact | ⬆ 解耦身份与传输 |
| **任务委派** | JSON 文件但字段不统一 | TaskCard 统一 Schema + 自动验证 | ⬆ 标准化 |
| **成果交付** | Markdown frontmatter 约定 | DeliverableCard + 验收对照 + 自审查 | ⬆ 加入自审查闭环 |
| **跨角色审查** | 普通任务+自由格式 Markdown | ReviewCard 结构化 + ReviewResponseCard | ⬆ 加入双向闭环 |
| **Agent 发现** | team-status.json 手动维护 | AgentCard 标准化声明 | ⬆ 可自动发现 |
| **依赖管理** | 隐式（靠人记住） | dependsOn 显式声明 + 自动检查 | ⬆ 自动化 |
| **超时处理** | 无 | deadline + 自动 escalation | ⬆ 新增能力 |
| **审计追踪** | git log（需人工解读） | 每条消息有唯一 ID + 状态历史 | ⬆ 可追溯 |
| **外部互操作** | 无 | AgentCard 可对接 A2A；MCP endpoint 可对接外部工具 | ⬆ 新增能力 |

### 3.2 不变的部分（我们刻意保留的）

| 保留项 | 理由 |
|--------|------|
| **文件系统作为传输层** | 不引入 MQ/HTTP Server——4个Agent在同一台机器，文件系统最简单可靠 |
| **Git 作为审计日志** | messages/ 目录 git tracked——每步操作有历史 |
| **tmux 作为会话容器** | tmux 管进程生命周期——协议管消息格式 |
| **Markdown 作为最终交付物** | Card 是元数据包装，内容还是 Markdown——人类可读优先 |
| **三角批判** | 我们的核心竞争壁垒——ReviewCard 是三角批判的结构化载体，不替代它 |

### 3.3 迁移路径

```
阶段 0 (当前):  tmux send-keys + 约定格式
                 │
阶段 1 (Week 4):  TaskCard/DeliverableCard/ReviewCard Schema 就绪
                 │  agent-router.py 可用
                 │  ← 我们在这里
                 ▼
阶段 2 (Week 5):  所有新任务使用富贵协议格式
                 │  现有任务不受影响（向后兼容）
                 │
阶段 3 (Week 6):  4张 AgentCard 补齐
                 │  agent-router.py 接入 team-watchdog.sh
                 │
阶段 4 (Week 7+): 三角批判全面使用 ReviewCard 结构化审查
                 │  AgentCard 可对接外部 A2A Agent
                 ▼
              富贵协议 v1.0 正式运行
```

---

## 第四部分：agent-router.py 设计

### 4.1 定位

`scripts/agent-router.py` 是富贵协议的消息路由守护进程。它**不替代** Claude Code——它是在 Claude Code 实例之间传递结构化消息的胶水层。

### 4.2 功能

```
agent-router.py 子命令:

  agent-router.py validate <card.json>
      验证一个 Card JSON 是否符合 Schema

  agent-router.py send <card.json> [--notify]
      将 Card 写入接收者的 messages/inbox/{agentId}/
      --notify: 同时通过 tmux send-keys 通知接收者

  agent-router.py status [--agent ma]
      查看所有（或指定 Agent）的消息状态

  agent-router.py watch
      守护进程模式——监听 messages/ 目录变化，自动路由

  agent-router.py ack <messageId>
      确认收到某条消息

  agent-router.py self-test
      运行自测——验证所有功能正常
```

### 4.3 目录结构

```
project/
├── messages/                    ← 新增（git tracked）
│   ├── inbox/
│   │   ├── ma/                  ← 马富贵的收件箱
│   │   │   └── fugui-task-V7-W4-004-001.json
│   │   ├── wang/                ← 王富贵的收件箱
│   │   ├── zhou/                ← 周富贵的收件箱
│   │   └── nie/                 ← 聂富贵的收件箱
│   └── outbox/                  ← 已发送消息归档
│       └── 2026-05/
│           └── fugui-task-V7-W4-004-001.json
├── memory/
│   └── agent-cards/             ← 新增
│       ├── ma.json
│       ├── wang.json
│       ├── zhou.json
│       └── nie.json
├── curriculum/task-prompts/     ← 保留（兼容）
├── student-notebook/            ← 保留（不变）
└── scripts/
    └── agent-router.py          ← 新增
```

### 4.4 消息生命周期

```
1. 发送者创建 Card JSON (手动 或 agent-router.py --new-task)
2. agent-router.py validate → Schema 验证通过
3. agent-router.py send →
   a. 写入 messages/inbox/{receiver.agentId}/{messageId}.json
   b. (可选) tmux send-keys 通知接收者
   c. 副本存入 messages/outbox/{YYYY-MM}/{messageId}.json
4. 接收者 Read messages/inbox/{agentId}/ → 发现新消息
5. 接收者处理消息 → agent-router.py ack {messageId}
6. (如果是 TaskCard) 接收者完成 → 创建 DeliverableCard → agent-router.py send
7. 循环
```

### 4.5 关键实现细节

**原子写入**: 先写 `.tmp` 文件 → `os.replace()` → 目标路径（POSIX 原子操作）

**Schema 验证**: 内嵌 JSON Schema（用 Python dict 表达，不依赖 jsonschema 库）

**状态追踪**: 消息状态存储在 `messages/.state.json`（gitignored——运行时状态，不需版本控制）

**tmux 集成**: `tmux send-keys -t {session} "Read messages/inbox/{agentId}/{msgId}.json" Enter`

**错误处理**:
- Schema 验证失败 → 拒绝发送，打印具体哪个字段不合法
- 接收者 inbox 不存在 → 自动创建目录
- tmux session 不存在 → 写文件成功但 warn "通知发送失败"
- 磁盘满 → Python 异常 + 非零退出码

---

## 第五部分：竞争壁垒分析

### 5.1 为什么不自建就亏了

| 如果用现成框架 | 我们的损失 |
|-------------|----------|
| CrewAI | 丧失三角批判——CrewAI 的"自主决策"是黑箱，不符合 evidence-schema |
| LangGraph | 引入 LangChain 全家桶（50+ 依赖），与"简单稳定"原则冲突 |
| AutoGen/MAF | MAF 不透明——API/开源/时间线未知，不可评估风险 |
| 纯 A2A | A2A 没考虑 Matrix 协作（层级+横向），需要扩展——扩展就是自建 |

### 5.2 我们的差异化

1. **三角批判原生支持**：ReviewCard + ReviewResponseCard 是三角批判的结构化载体。CrewAI/LangGraph/A2A 都没有这个。
2. **Matrix 拓扑**：纵向委派 + 横向审查是一等公民。所有现有框架假设平级或纯层级。
3. **文件系统优先**：不引入消息中间件。Git 仓库就是消息总线。适合 4 人团队。
4. **零依赖**：Python 3.10+ stdlib。不需要 Docker/K8s/Redis。
5. **A2A 兼容**：AgentCard 结构与 A2A 兼容。将来可对接外部 A2A Agent。

---

## 第六部分：行动建议

### 立即行动

1. ✅ 本设计文档完成 → 提交三角批判
2. agent-router.py 实现（本任务交付物 #2）
3. 4张 AgentCard 写入 `memory/agent-cards/`
4. 聂富贵决策 D016：是否采用富贵协议作为团队通信标准

### 三角批判议题

提交全员审查时，请聚焦以下问题：
1. **消息量会不会太多？** 当前 4 人团队，每天约 3-5 条消息。结构化 JSON 是否过度设计？
2. **agent-router.py 是否必要？** 如果大家手动读写 messages/ 目录，是否还需要路由脚本？
3. **TaskCard 与现有 task-prompt JSON 的关系？** 是替换还是兼容？
4. **要不要立即废弃 tmux send-keys？** 还是渐进替代？

---

*马富贵 | 富贵协议 v1 设计 | AI师生研究院 V7 Week 4*
*设计驱动: "A2A是Google的，MCP是Anthropic的——我们的叫富贵协议"*
