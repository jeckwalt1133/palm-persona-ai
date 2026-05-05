# 第4课：Skill/Hook 系统深度解析

> 学生：Claude Code Student | 日期：2026-05-06 | 状态：✅ 完成

---

## 一、Claude Code Skill 系统设计原理

### 1.1 什么是 Skill

Skill 是 Claude Code 的**行为插件**——一段结构化的 Markdown 指令，当满足触发条件时自动加载到对话上下文中，引导模型以特定方式工作。

```
Skill = Frontmatter(声明) + Body(指令)
```

类比：Skill 是 AI 的"岗位说明书"。定义好之后，Claude Code 在遇到对应任务时自动"上岗"。

### 1.2 架构层级

```
┌───────────────────────────────────────────────┐
│               Claude Code CLI                  │
├───────────────────────────────────────────────┤
│  Skill 加载器                                   │
│  ├─ 命令触发: /review-report                    │
│  └─ 自动触发: 识别到 git add → 加载 git-workflow │
├───────────────────────────────────────────────┤
│  Skill 存储                                     │
│  ├─ .claude/skills/  (项目本地)                 │
│  └─ ~/.claude/skills/ (全局用户)                │
├───────────────────────────────────────────────┤
│  Hook 系统                                      │
│  └─ settings.json → 事件驱动                    │
└───────────────────────────────────────────────┘
```

### 1.3 Skill = Context Injection

Skill 不编译、不运行、不产生副作用。它的全部价值在于：**在正确的时机，把正确的上下文注入到对话中**。

```
无 Skill:     "审查这个报告" → Claude 猜你要什么审查
有 Skill:     "/review-report" → Skill 注入12条审查标准 → Claude 精确执行
```

### 1.4 Skill 存储位置

| 位置 | 作用域 | 优先级 |
|------|--------|--------|
| `.claude/skills/<name>/SKILL.md` | 项目级 | 高 |
| `~/.claude/skills/<name>/SKILL.md` | 用户级 | 中 |
| Plugin 市场安装 | 全局可用 | 低（自动发现） |

同名 Skill：项目级覆盖用户级。

### 1.5 触发方式

| 方式 | 示例 | 适用场景 |
|------|------|----------|
| **斜杠命令** | `/review-report` | 用户主动调用 |
| **自动检测** | 用户发视频链接 → 自动加载 video-analyze | 隐式触发 |
| **CLAUDE.md 调度** | 任务类型→Skill 映射表 | 常规开发流程 |

---

## 二、Skill 文件格式详解

### 2.1 标准模板

```markdown
---
name: review-report
description: 审查掌心人格局人格报告——合规/质量/一致性检查。当用户说"/review-report"时触发
---

# Review Report — 报告审查 Skill

## 触发条件
用户输入 /review-report [report_id]

## 输入
- `report_id`: 报告ID（可选，缺省时审查当前对话中的报告）

## 步骤

### 1. 合规检查
- 检查是否包含禁用词（算命/占卜/正缘/掌纹/手相等）
- 检查是否使用替代表达（倾向于/更容易/大概率）
- 检查是否包含免责声明

### 2. 质量检查
- [具体检查项]
```

### 2.2 Frontmatter 字段

| 字段 | 必填 | 说明 |
|------|------|------|
| `name` | ✅ | Skill 名称，同时也是斜杠命令名 |
| `description` | ✅ | 简介，用于自动触发匹配和技能列表展示 |
| `trigger` | ❌ | 自定义触发模式（plugin 场景） |
| `model` | ❌ | 指定模型（如 `opus` 用于深度分析 task） |

### 2.3 Skill 设计原则

1. **边界清晰**：一个 Skill 做好一件事。review-report 只审查不修改
2. **指令精确**：用 checklist 而非描述。列出12条审查项比"审查报告质量"有效
3. **上下文完备**：Skill 自包含——读到 Skill 就知道怎么做，不需要翻其他文档
4. **可验证**：每个 Skill 有明确的完成条件（Definition of Done）
5. **版本化**：Skill 也是代码，要 git 管理

---

## 三、Hook 生命周期（8种）

### 3.1 Hook 是什么

Hook 是 Claude Code 的**事件驱动机制**：在特定事件发生时执行 Shell 命令。与 Skill 不同：
- **Skill** = "告诉模型怎么想"（上下文注入）
- **Hook** = "告诉系统怎么做"（命令执行）

### 3.2 八大 Hook 详解

```
                     任务生命周期
                     
  启动阶段                    运行阶段                     结束阶段
  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐
  │Pre-  │  │Session│  │User  │  │Pre-  │  │Post- │  │Assis-│  │Session│  │Post- │
  │Session│→│Start  │→│Prompt│→│ToolUse│→│ToolUse│→│tant  │→│Stop  │→│Session│
  │      │  │       │  │Submit│  │      │  │      │  │Message│  │      │  │      │
  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘
```

| # | Hook 名称 | 触发时机 | 典型用途 |
|---|-----------|----------|----------|
| 1 | **PreSession** | 会话开始前（最早期） | 环境检查、版本校验 |
| 2 | **SessionStart** | 会话初始化完成 | 加载项目上下文、自动执行初始化命令 |
| 3 | **UserPromptSubmit** | 用户提交消息后 | 消息预处理、附加上下文、加载 PUA 风格 |
| 4 | **PreToolUse** | 工具调用前 | 权限检查、参数校验 |
| 5 | **PostToolUse** | 工具调用后 | 结果处理、日志记录、检查工具输出 |
| 6 | **AssistantMessage** | 每次助手消息 | 流式处理、合规过滤 |
| 7 | **SessionStop** | 会话停止时 | 清理资源、保存状态 |
| 8 | **PostSession** | 会话完全结束后 | 数据持久化、生成报告 |

### 3.3 Hook 配置语法

在 `settings.json` / `settings.local.json` 中配置：

```json
{
  "hooks": {
    "UserPromptSubmit": "bash命令或脚本路径",
    "PostToolUse": "node scripts/check-output.js",
    "SessionStop": "bash cleanup.sh"
  }
}
```

### 3.4 Hook 最佳实践

| 原则 | 说明 |
|------|------|
| **轻量** | 每个 Hook 应在 500ms 内完成，避免阻塞用户体验 |
| **幂等** | 同一 Hook 多次执行结果一致，不会污染状态 |
| **无状态** | 不依赖外部状态文件（除非 Intentional） |
| **错误容忍** | Hook 失败不应中断主流程，用 `|| true` 兜底 |
| **日志可见** | 输出到 stderr 避免干扰主流程 |
| **权限最小** | 只给 Hook 需要的权限，不做 `allow all` |

### 3.5 掌心人格局的 Hook 设计

```json
{
  "hooks": {
    "UserPromptSubmit": "加载 PUA 风格和市场监控上下文",
    "PostToolUse": "检查生成文案是否含禁用词",
    "SessionStop": "保存当前工作状态和会话摘要"
  }
}
```

---

## 四、Skill 项目实践：review-report

### 4.1 功能定义

`/review-report` Skill 审查掌心人格局人格报告的三个方面：

```
审查维度                   检查项                          权重
┌─────────────────┐
│  合规检查        │  禁用词、替代表达、免责声明             阻断级
├─────────────────┤
│  质量检查        │  视觉锚点引用、文案共鸣度、不空泛       严重级
├─────────────────┤
│  一致性检查      │  分数与描述匹配、特征与结论呼应         建议级
└─────────────────┘
```

阻断级不通过 → 报告必须修改
严重级不通过 → 建议修改
建议级不通过 → 记录但不阻塞

### 4.2 与 MCP Server 的关系

```
/review-report              MCP Server
    │                           │
    ├─ 获取合规词库 ───────────→ palm://compliance/terms
    ├─ 获取报告数据 ───────────→ palm://reports/{id}
    │                           │
    ▼                           ▼
  审查结果                  数据提供层
```

Skill 是"审查指令"，MCP Server 是"数据来源"。两者职责分离。

### 4.3 安装方式

```bash
# 项目级安装（claude code 工作目录）
mkdir -p .claude/skills/review-report
# 将 SKILL.md 放入该目录
# 使用：在对话中输入 /review-report [report_id]
```

---

## 五、Skill vs Hook vs MCP 对比

| 维度 | Skill | Hook | MCP Server |
|------|-------|------|------------|
| **本质** | 上下文注入 | 事件响应 | 数据/工具服务 |
| **触发** | 斜杠命令/自动匹配 | 系统事件 | 协议调用 (JSON-RPC) |
| **输出** | 影响 LLM 行为 | 执行系统命令 | 返回结构化数据 |
| **开发** | Markdown 指令编写 | Shell 脚本 | TypeScript SDK |
| **生效** | 对话上下文级别 | 系统级别 | 协议级别 |
| **调试** | 直接看 Skill 内容 | 看 Hook 执行日志 | 用 MCP Inspector |
| **复杂度** | 低 | 中 | 高 |
| **协作** | 人→AI 指令 | 系统→系统 事件 | AI→数据 查询 |

---

## 六、Skill 的局限与争议

1. **纯文本指令，无法编程**：Skill 是 Markdown，不能做条件判断/循环/变量。复杂逻辑需要借助 Tool 或 Hook
2. **无版本管理**：Skill 更新后，旧会话仍然使用旧版。需要用户重新加载
3. **隐式覆盖风险**：同名 Skill 在项目级和用户级都可能存在，优先级规则对新手不友好
4. **调试困难**：Skill 加载到上下文中后，无法直接看到"当前哪些 Skill 生效了"
5. **Plugin vs Skill 界限模糊**：Plugin 是完整的代码包，Skill 是指令文件，但用户难以区分
6. **自动触发误判**：Skill 的自动匹配基于 description 关键词，可能误触发

---

## 七、交付物清单

- [x] `student-notebook/2026-05-06-skill-hook-system.md` — 本笔记
- [x] `.claude/skills/review-report/SKILL.md` — 完整可用的 /review-report Skill
- [ ] ✅ Skill 覆盖 3 个审查维度（合规/质量/一致性）
- [ ] ✅ Hook 覆盖全部 8 种生命周期
- [ ] ✅ Skill vs Hook vs MCP 对比

---

*本节学习时长：20分钟 | 覆盖：Skill 原理 + Hook 8种 + 项目实践 + 对比分析*
