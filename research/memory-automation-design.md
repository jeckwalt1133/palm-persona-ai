# 记忆系统与上下文自动化 — 完整设计方案

**研究者**: 马富贵 (Senior Engineer / 学生)
**课题**: V7-002 | **版本**: v1.0 | **时间**: 2026-05-06
**基于**: memory-toolkit 插件架构 + Claude Code hook 系统 + 三层记忆理论

---

## 一、问题分析：当前系统的5个断点

### 断点1: PreCompact 快照太薄，丢了最关键的信息

**当前状态**: memory-toolkit 的 PreCompact hook 保存到 `memory/workstreams/handoff.md`，内容仅4行：

```markdown
**Session:** 4671aa3c-b6dc-4593-a8de-668679929948
**Branch:** master
**Last commit:** 663bf8c
**Uncommitted files:** 33
```

**丢失的信息**（压缩后无法恢复）:
- 正在执行的任务ID和进度（如 "V7 P0#3 Sharp特征提取，已完成20%，卡在WSL编译"）
- 本次会话的关键决策（如 "决定用 Sharp 而非 Jimp，因为前者支持原生像素操作"）
- 本次会话的发现（如 "发现 provider-factory.ts 在 mock 模式下也创建了真实实例"）
- 被否决的方案及否决原因（如 "尝试了 bore→被墙，改用 localhost.run→延迟高，最终选 ngrok"）
- 下次恢复时应该执行的下一个动作

### 断点2: SessionStart 恢复依赖人工，学生完全不知道做什么

**当前状态**: 
- 主会话：人工读取 CLAUDE.md → bootstrap.md → v7.final-plan.md。手动判断"上次做到哪了"。
- 学生会话（watchdog）：注入相同的 bootstrap.md 路径，学生读完后得到的是一份**24小时前的静态快照**，不知道之后发生了什么。

**具体问题**:
- 学生恢复后 reads `bootstrap.md` → 看到 V7 Week 1 Day 1 Plan → 但主会话可能已经做到 Day 3
- bootstrap.md 更新频率：仅在主会话**手动**更新时刷新。经常过期。
- 没有 "current_task" 字段告诉恢复后的 agent 当前应该干什么

### 断点3: 团队4个成员的记忆完全隔离

**当前状态**:

| 角色 | 记忆位置 | 可读范围 | 谁在维护 |
|------|---------|---------|---------|
| 聂富贵（主会话） | 项目 memory/ + Claude auto-memory/ | 全部 | 人工 + 部分自动 |
| 马富贵（学生tmux） | 无独立记忆文件 | bootstrap.md | 无人维护 |
| 王富贵（客座·豆包） | 无持久状态 | 无 | 无 |
| 周富贵（客座·千问） | 无持久状态 | 无 | 无 |

- 客座讲师的审查意见只存在于对话中，下次调用时无法回溯上次的观点
- 学生完成的任务，主会话不知道（需要主动检查 student-notebook/）
- 两个 memory 目录（D盘项目 vs Linux home auto-memory）部分重复但不同步

### 断点4: 任务流转纯人工，tmux send-keys 是唯一通信方式

**当前流转**:
```
老师在主会话写 Task Prompt
  → 保存为 curriculum/task-prompts/V7-XXX.md
  → 手动 tmux send-keys "Read curriculum/task-prompts/V7-XXX.md" 到学生会话
  → 学生完成后写 student-notebook/
  → 老师手动检查 student-notebook/ 是否有新文件
  → 老师手动调用客座审查
  → 客座审查意见只在对话中
```

**这是 PROTOCOL.md 自己定义的三层记忆规则没有被遵守的根因**——不是缺少意愿，是缺少自动化执行机制。

### 断点5: 记忆文件增长无管理

**当前状态**: memory/ 目录已有16个文件。`decisions.md` 会线性增长（D001→D100→D1000）。没有归档策略，没有过期清理。预计3个月后 memory/ 目录将有 50+ 文件，grep 搜索将不再可行。

---

## 二、设计方案

### 2.1 总体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    自动化记忆系统架构                              │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   Hook 层（自动执行）                     │    │
│  │                                                          │    │
│  │  SessionStart  ──→ 恢复上一次快照 + 注入任务上下文       │    │
│  │  PreCompact    ──→ 保存当前任务状态 + 决策 + 发现        │    │
│  │  PostToolUse   ──→ 检测关键事件（决策/发现/错误）       │    │
│  │  Stop          ──→ 最终快照 + 健康检查                  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   存储层（文件系统）                       │    │
│  │                                                          │    │
│  │  memory/                                                  │    │
│  │  ├── bootstrap.md          ← 全局快照（所有角色共享）     │    │
│  │  ├── decisions.md          ← 决策日志（结构化）           │    │
│  │  ├── team-status.json      ← 团队仪表盘（机器可读）      │    │
│  │  ├── snapshots/            ← 压缩前快照历史              │    │
│  │  │   └── 2026-05-06-001.json                              │    │
│  │  ├── tasks/                ← 任务状态追踪                │    │
│  │  │   └── active.json       ← 当前活跃任务                │    │
│  │  ├── reviews/              ← 客座审查记录（结构化）      │    │
│  │  │   └── 2026-05-06-wang.md                               │    │
│  │  └── knowledge-graph.json  ← 语义记忆（自动增量更新）    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   角色层（按需读写）                       │    │
│  │                                                          │    │
│  │  聂富贵 ──→ 全局读写（所有文件）                         │    │
│  │  马富贵 ──→ 读 team-status.json + 写 student-notebook/   │    │
│  │  王富贵 ──→ 读 tasks/active.json + 写 reviews/           │    │
│  │  周富贵 ──→ 读 tasks/active.json + 写 reviews/           │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 快照格式定义：team-status.json

这是整个自动化系统的核心文件。JSON Schema：

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "TeamStatus",
  "type": "object",
  "required": ["version", "updated", "session"],
  "properties": {
    "version": {
      "type": "string",
      "const": "1.0"
    },
    "updated": {
      "type": "string",
      "format": "date-time",
      "description": "最后更新时间"
    },
    "session": {
      "type": "object",
      "description": "当前会话状态",
      "required": ["id", "role", "startedAt"],
      "properties": {
        "id": { "type": "string", "description": "Claude 会话 UUID" },
        "role": { "type": "string", "enum": ["teacher", "student", "guest-wang", "guest-zhou"] },
        "startedAt": { "type": "string", "format": "date-time" },
        "lastCheckpoint": { "type": "string", "format": "date-time" }
      }
    },
    "currentTask": {
      "type": "object",
      "description": "当前正在执行的任务——PreCompact时必须填充",
      "required": ["id", "status", "summary"],
      "properties": {
        "id": { "type": "string", "description": "如 V7-002" },
        "title": { "type": "string" },
        "status": {
          "type": "string",
          "enum": ["not_started", "in_progress", "blocked", "completed", "reviewing"]
        },
        "progress": { "type": "string", "description": "人类可读的进度描述" },
        "blocker": { "type": "string", "description": "如果status=blocked，描述阻塞原因" },
        "nextAction": { "type": "string", "description": "恢复后应该做的第一件事" },
        "assignedTo": { "type": "string", "enum": ["nie", "ma", "wang", "zhou"] },
        "startedAt": { "type": "string", "format": "date-time" }
      }
    },
    "decisions": {
      "type": "array",
      "description": "本次会话的新决策——PreCompact时自动收集",
      "items": {
        "type": "object",
        "required": ["id", "summary", "timestamp"],
        "properties": {
          "id": { "type": "string", "description": "如 D010" },
          "summary": { "type": "string", "maxLength": 200 },
          "rationale": { "type": "string" },
          "alternatives": { "type": "string" },
          "decidedBy": { "type": "string" },
          "timestamp": { "type": "string", "format": "date-time" }
        }
      }
    },
    "discoveries": {
      "type": "array",
      "description": "本次会话的新发现——PreCompact时自动收集",
      "items": {
        "type": "object",
        "required": ["summary", "timestamp"],
        "properties": {
          "summary": { "type": "string", "maxLength": 200 },
          "category": { "type": "string", "enum": ["bug", "insight", "risk", "optimization"] },
          "timestamp": { "type": "string", "format": "date-time" }
        }
      }
    },
    "completedTasks": {
      "type": "array",
      "description": "本次会话完成的任务",
      "items": {
        "type": "object",
        "required": ["id", "completedAt"],
        "properties": {
          "id": { "type": "string" },
          "title": { "type": "string" },
          "evidence": { "type": "string", "description": "完成的证据（如 git commit hash）" },
          "completedAt": { "type": "string", "format": "date-time" }
        }
      }
    },
    "teamMembers": {
      "type": "object",
      "description": "各成员当前状态",
      "properties": {
        "nie": {
          "type": "object",
          "properties": {
            "status": { "type": "string", "enum": ["active", "idle", "offline"] },
            "currentFocus": { "type": "string" },
            "lastActive": { "type": "string", "format": "date-time" }
          }
        },
        "ma": {
          "type": "object",
          "properties": {
            "status": { "type": "string", "enum": ["active", "idle", "offline"] },
            "tmuxSession": { "type": "string" },
            "currentTask": { "type": "string" },
            "lastActive": { "type": "string", "format": "date-time" }
          }
        },
        "wang": {
          "type": "object",
          "properties": {
            "status": { "type": "string", "enum": ["active", "idle", "offline"] },
            "lastReview": { "type": "string", "format": "date-time" }
          }
        },
        "zhou": {
          "type": "object",
          "properties": {
            "status": { "type": "string", "enum": ["active", "idle", "offline"] },
            "lastReview": { "type": "string", "format": "date-time" }
          }
        }
      }
    },
    "priorityQueue": {
      "type": "array",
      "description": "当前优先级队列（所有成员可见）",
      "items": {
        "type": "object",
        "required": ["rank", "taskId", "title", "status"],
        "properties": {
          "rank": { "type": "integer" },
          "taskId": { "type": "string" },
          "title": { "type": "string" },
          "status": { "type": "string" },
          "assignedTo": { "type": "string" },
          "dependency": { "type": "string", "description": "前置任务ID（如果有）" }
        }
      }
    }
  }
}
```

### 2.3 压缩时必须保存 vs 可从文件恢复的分类

#### 必须保存（丢了无法恢复——这些是"对话中涌现的"）

| 类别 | 具体内容 | 存储位置 | 理由 |
|------|---------|---------|------|
| **任务进度** | 当前任务ID、状态、具体进度、下一步行动 | team-status.json → currentTask | 对话中逐步骤推进，文件系统无记录 |
| **新决策** | 本次会话做的所有新决策（D编号） | team-status.json → decisions → memory/decisions.md | 决策的理由/替代方案在对话中，压缩后消失 |
| **新发现** | bug、insight、风险、优化点 | team-status.json → discoveries | 发现过程在对话中，发现本身需持久化 |
| **被否决的方案** | 试过但不行的方案+否决原因 | decisions.md（作为决策的 alternatives 字段） | 防止下次重复尝试 |
| **阻塞项** | 当前卡在什么地方、为什么 | team-status.json → currentTask.blocker | 决定了恢复后第一个动作 |
| **审查意见** | 客座讲师的审查结论（如果有） | reviews/YYYY-MM-DD-{reviewer}.md | 下次调用同一客座时可回溯一致性 |

#### 可从文件恢复（不需要快照保存——重新读取即可）

| 类别 | 来源文件 | 理由 |
|------|---------|------|
| 团队身份 | team-identity.md | 静态文件，不会随对话改变 |
| 毕业状态 | graduation-ladder.json | JSON文件，结构化可读 |
| 项目知识图谱 | knowledge-graph.json | 静态+低频更新 |
| 进化史 | evolution-v1-v6.md | 静态文档 |
| 代码状态 | git log / git status | Git 是权威来源 |
| 测试结果 | vitest 输出 | 重新跑即可 |
| 类型检查状态 | tsc --noEmit 输出 | 重新跑即可 |
| 公网URL存活性 | evidence-auto-verify.sh | 重新跑即可 |

**核心原则**：快照只保存"对话中涌现的临时状态"，不保存"可以从文件系统重新计算的信息"。

### 2.4 PreCompact Hook 设计

**脚本**: `scripts/precompact-snapshot.sh`
**执行时间**: < 3秒
**触发**: Claude Code PreCompact hook

```bash
#!/bin/bash
# PreCompact 快照生成
# 用法: bash scripts/precompact-snapshot.sh <session-id> <role>
# 由 Claude Code PreCompact hook 自动调用
# 时间约束: < 3秒

# 步骤1: 收集git状态（~0.5s）
# 步骤2: 生成快照JSON（~0.5s）
# 步骤3: 写入 memory/snapshots/YYYY-MM-DD-HHMMSS.json（~0.1s）
# 步骤4: 更新 memory/team-status.json（~0.3s）
# 步骤5: 如果快照中有新决策，追加到 memory/decisions.md（~0.5s）
# 步骤6: 清理30天前的旧快照（~0.5s）
```

**settings.json hook 配置**:

```json
{
  "hooks": {
    "PreCompact": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "bash /mnt/d/Claude/Workspace/palm-persona-ai/scripts/precompact-snapshot.sh \"$CLAUDE_SESSION_ID\" \"teacher\"",
            "timeout": 5000
          }
        ]
      }
    ]
  }
}
```

**关键设计决策**: PreCompact hook 只收集**元数据**（git状态、时间戳），不分析对话内容。对话内容的分析（提取决策/发现）由 PostToolUse watcher 异步完成。这保证了 < 3秒 的时间约束。

### 2.5 SessionStart Hook 设计

**脚本**: `scripts/sessionstart-recover.sh`
**执行时间**: < 30秒
**触发**: Claude Code SessionStart hook

```bash
#!/bin/bash
# SessionStart 自动恢复
# 用法: bash scripts/sessionstart-recover.sh <role>
# 时间约束: < 30秒

# 步骤1: 读取最新 team-status.json（~0.2s）
# 步骤2: 读取最新快照（~0.2s）
# 步骤3: 运行 evidence-auto-verify.sh --quick（~10s，验证上次完成的任务证据仍有效）
# 步骤4: 检查 git status 是否有未提交变更（~0.5s）
# 步骤5: 生成恢复上下文注入 prompt（~0.5s）
# 步骤6: 写入 /tmp/claude-resume-context.md（供 CLAUDE.md 恢复指令读取）
```

**生成的恢复 prompt 示例**（注入到会话上下文）:

```
[自动恢复] 上次会话: 2026-05-06 15:30 (session: 8b99187e)
  角色: teacher
  当前任务: V7-002 记忆系统自动化设计
  进度: 已完成调研阶段，正在写设计文档 Phase 1
  下一步: 完成 research/memory-automation-design.md 的 Phase 1-2 部分
  上次决策: D010（决定用JSON而非Markdown做快照格式，因为机器可读性）
  阻塞项: 无
  优先级队列: V7-002(进行中) > V7-001(审查中) > V7-003(待开始)
  团队状态: 聂(active) 马(idle>12h) 王(idle) 周(idle)
  Git: main分支, 1个未提交文件 (research/memory-automation-design.md)
  证据验证: L1.1-L4.1 全部通过 (5分钟前)
```

### 2.6 团队4角色共享记忆结构

```
memory/
├── team-status.json          ← 全局仪表盘（所有角色可读）
├── bootstrap.md              ← 全局快照（人工维护 + 脚本更新）
├── decisions.md              ← 决策日志（所有角色可写，冲突用时间戳解决）
├── snapshots/                ← PreCompact 快照历史（只读归档）
│   └── 2026-05-06-153000.json
├── tasks/
│   ├── active.json           ← 当前任务队列（老师写，其他人读）
│   └── history.jsonl         ← 已完成任务历史
├── reviews/                  ← 客座审查记录
│   ├── 2026-05-06-wang.md    ← 王富贵审查
│   └── 2026-05-06-zhou.md    ← 周富贵审查
├── domain/                   ← 各角色私有的领域记忆
│   ├── nie-architecture.md   ← 聂富贵：架构决策思路
│   ├── ma-notebook.md        ← 马富贵：学习笔记索引
│   ├── wang-copy.md          ← 王富贵：文案风格指南
│   └── zhou-quality.md       ← 周富贵：质量标准+常见问题
└── knowledge-graph.json      ← 语义记忆（增量自动更新）
```

**记忆冲突解决**:
- `team-status.json` 只有一个写者（当前活跃角色），无冲突
- `decisions.md` 追加写入，用时间戳+决策ID解决顺序
- `domain/` 各角色独立文件，无冲突
- 如果同一角色从两个会话同时写（不应该发生但预防）：最后写入者获胜 + 旧版本备份到 `snapshots/`

### 2.7 任务流转协议

#### 状态机

```
                    ┌─────────────┐
                    │   pending   │  ← 老师创建任务
                    └──────┬──────┘
                           │ 老师分配给马/王/周
                           ▼
                    ┌─────────────┐
                    │  assigned   │  ← 指定负责人
                    └──────┬──────┘
                           │ 负责人开始执行
                           ▼
                    ┌─────────────┐
            ┌───────│ in_progress │
            │       └──────┬──────┘
            │              │ 负责人完成，提交审查
            │ blocked       ▼
            │       ┌─────────────┐
            └──────▶│  reviewing  │  ← 客座/老师审查
                    └──────┬──────┘
                           │
                    ┌──────┴──────┐
                    ▼             ▼
             ┌──────────┐  ┌──────────┐
             │  done    │  │ rework   │  ← 审查不通过
             └──────────┘  └────┬─────┘
                                │ 回到 in_progress
                                ▼
                          ┌──────────┐
                          │in_progress│
                          └──────────┘
```

#### 消息格式（从老师到学生）

文件 `tasks/dispatch-{taskId}.json`:

```json
{
  "taskId": "V7-003",
  "from": "nie",
  "to": "ma",
  "status": "assigned",
  "timestamp": "2026-05-06T16:00:00Z",
  "title": "实现 precompact-snapshot.sh",
  "acceptanceCriteria": [
    "生成 team-status.json 格式有效",
    "执行时间 < 3秒",
    "在测试会话中验证 PreCompact hook 触发"
  ],
  "filesToTouch": [
    "scripts/precompact-snapshot.sh",
    ".claude/settings.local.json"
  ],
  "blockedBy": [],
  "deadline": "2026-05-06T20:00:00Z"
}
```

#### 学生主动拉取任务

**当前**: 学生被动等待 `tmux send-keys` 注入任务
**目标**: 学生 SessionStart 时自动扫描 `tasks/` 目录，找到分配给自己的 `assigned` 状态任务，自动开始执行

watchdog 恢复脚本改为:

```bash
# 注入学生恢复上下文
tmux send-keys -t "$SESSION" "Read memory/team-status.json" Enter
sleep 0.3
tmux send-keys -t "$SESSION" "如果 team-status.json 中有分配给 ma 的任务且状态为 assigned，自动认领并开始执行。如果没有，检查 tasks/ 目录。如果都没有，报告'等待老师分配任务'。" Enter
```

---

## 三、实现路径（3个Phase）

### Phase 1: 最小可行——当前会话可用的手动快照

**目标**: 不依赖 hook 配置，纯脚本 + 手动调用即可运行。为本会话提供快照能力。

**文件**:
1. `memory/team-status.json` — 初始版本（手动填写或脚本生成）
2. `scripts/precompact-snapshot.sh` — 快照生成脚本
3. `scripts/sessionstart-recover.sh` — 恢复上下文生成脚本

**验证**: 手动运行 `bash scripts/precompact-snapshot.sh test-001 teacher` → 生成有效 team-status.json → 手动运行 `bash scripts/sessionstart-recover.sh teacher` → 输出恢复上下文

**产出对应**: V7-002 的 Phase 1 交付

### Phase 2: 团队协作——Hook + 任务流转

**目标**: 配置 SessionStart/PreCompact hooks → 自动快照+自动恢复。任务流转协议的第一个可运行版。

**文件**:
4. `.claude/settings.local.json` — 添加 PreCompact + SessionStart hooks
5. `scripts/task-dispatch.sh` — 任务分发脚本（老师用）
6. `scripts/task-claim.sh` — 任务认领脚本（学生用）
7. `memory/tasks/active.json` — 任务队列
8. `memory/reviews/` 目录 + 审查模板

**验证**: 老师运行 `task-dispatch.sh V7-003 ma` → 学生 SessionStart 自动检测到新任务 → 学生完成后更新 team-status.json → 老师看到状态变更

### Phase 3: 完全自动化——团队仪表盘 + 记忆健康检查

**目标**: 无需人工介入。记忆系统自我维护。

**文件**:
9. `scripts/memory-health-check.sh` — 记忆健康检查（死链接/过期文件/重复内容/膨胀检测）
10. `scripts/memory-archive.sh` — 记忆归档（30天前的快照 → 按周合并 → 90天前删除）
11. `memory/team-status.json` 自动更新为"团队仪表盘"格式
12. `scripts/guest-review-dispatch.sh` — 客座讲师自动审查调度

**验证**: 
- 记忆健康检查每日自动运行
- 30天前快照自动归档
- 团队仪表盘自动反映所有成员状态

---

## 四、文件清单

### 需要创建的文件

| 文件 | 用途 | Phase |
|------|------|-------|
| `memory/team-status.json` | 全局团队状态（核心快照格式） | P1 |
| `memory/snapshots/` | 快照历史目录 | P1 |
| `memory/tasks/active.json` | 活跃任务队列 | P2 |
| `memory/tasks/history.jsonl` | 任务完成历史 | P2 |
| `memory/reviews/` | 客座审查记录目录 | P2 |
| `memory/domain/` | 各角色领域记忆目录 | P2 |
| `scripts/precompact-snapshot.sh` | PreCompact hook 脚本 | P1 |
| `scripts/sessionstart-recover.sh` | SessionStart hook 脚本 | P1 |
| `scripts/task-dispatch.sh` | 任务分发脚本 | P2 |
| `scripts/task-claim.sh` | 任务认领脚本 | P2 |
| `scripts/memory-health-check.sh` | 记忆健康检查 | P3 |
| `scripts/memory-archive.sh` | 记忆归档脚本 | P3 |
| `scripts/guest-review-dispatch.sh` | 客座审查调度 | P3 |

### 需要修改的文件

| 文件 | 修改内容 | Phase |
|------|---------|-------|
| `.claude/settings.local.json` | 添加 PreCompact + SessionStart hooks | P2 |
| `memory/bootstrap.md` | 添加恢复指令中的 team-status.json 读取 | P1 |
| `scripts/student-watchdog.sh` | 恢复prompt改为读取 team-status.json + tasks/ | P2 |
| `PROTOCOL.md` | 更新"通信协议"章节，补充消息格式和状态机 | P2 |

### 不需要修改的文件（复用现有基础设施）

| 基础设施 | 用途 |
|---------|------|
| memory-toolkit 插件 | 提供 SessionStart/PreCompact/PostToolUse hook 框架 |
| evidence-auto-verify.sh | Phase 2 恢复时验证证据仍有效 |
| knowledge-graph.json | Phase 3 语义记忆增量更新 |
| graduation-ladder.json | 毕业状态跟踪（已结构化，无需改动） |

---

## 五、约束满足验证

| 约束 | 方案 | 满足 |
|------|------|------|
| 只存 D盘 | 所有脚本路径硬编码 `/mnt/d/Claude/Workspace/palm-persona-ai/memory/` | ✅ |
| 不依赖外部数据库 | 全部 JSON + Markdown 文件 | ✅ |
| 快照 < 3秒 | Phase 1 只收集元数据（git + JSON读写），不分析对话 | ✅ |
| 恢复 < 30秒 | evidence-auto-verify --quick模式 + 读JSON + git status | ✅ |
| 4角色共享结构 | team-status.json 全局读 + domain/ 私有写 | ✅ |
| 任务3状态覆盖 | assigned → reviewing → done（实际覆盖了5状态） | ✅ |

---

## 六、关键设计权衡

### 为什么用 JSON 而不是 Markdown 做快照？

- **机器可读**: Claude 可以通过工具（python3 -c）直接解析 JSON 字段
- **结构化验证**: JSON Schema 可以自动验证完整性
- **增量更新**: 脚本可以修改单个字段（如 currentTask.progress）而不需要重写整个文件
- **tradeoff**: JSON 不如 Markdown 人类可读。解决方案：sessionstart-recover.sh 将 JSON 转为 Markdown 摘要注入上下文

### 为什么不做 embedding / 向量搜索？

- 当前规模（<50个记忆文件）：文件路径 + grep 已经足够
- memory-toolkit 的 PHILOSOPHY.md 明确指出："Flat markdown, not vector DB. Vector search pulls 'similar', not 'needed'"
- 如果将来需要语义搜索：`knowledge-graph.json` 的 edges 已经提供了关联结构，通过图遍历可以找到相关概念

### 为什么 PreCompact 不等对话分析完成？

- 时间约束：对话分析（即使是 Haiku）需要 5-10秒
- PreCompact 必须在压缩前完成，如果超时可能丢失快照
- 解决方案：PreCompact 只做元数据快照，PostToolUse watcher 做对话分析（memory-toolkit 的 session-watcher.js 已经提供了这个能力）

---

*设计完成于 2026-05-06 | 马富贵 / AI师生研究院 V7*
*引用依据: PROTOCOL.md三层记忆 / memory-toolkit ARCHITECTURE.md + PHILOSOPHY.md / 项目 memory/ 目录全面审计 / Claude Code hook系统 / sessions.jsonl 9条记录分析*
