# 掌心人格局 — Skill 完全配置手册

## 一、已内置技能（无需安装，直接用）

### 产品层
| 技能 | 命令 | 何时自动调用 |
|------|------|-------------|
| product-manager | /product-manager | 新产品方案、MVP 定义、需求分析 |
| pm | /pm | 用户故事、功能清单、优先级排序 |
| architect | /architect | 技术方案、项目结构、模型选择 |
| team-architect | /team-architect | 团队协作架构设计 |

### 开发层
| 技能 | 命令 | 何时自动调用 |
|------|------|-------------|
| developer | /developer | 编码实现、修改文件 |
| team-dev | /team-dev | 团队模式按架构方案逐模块实现 |
| crud-gen | /crud-gen | 给定表结构生成前后端全套 CRUD |
| framework-x | /framework-x | Vue↔React 框架互转、JS↔TS 互转 |
| code-style | /code-style | 对齐 ESLint/Prettier 代码风格 |
| project-scan | /project-scan | 扫描项目目录、识别技术栈 |
| auto-docs | /auto-docs | 代码写完自动生成 JSDoc/API 文档/README |

### 质量层
| 技能 | 命令 | 何时自动调用 |
|------|------|-------------|
| cr | /cr | 代码变更审查（性能/安全/风格） |
| bug-fix | /bug-fix | 粘贴报错→自动定位根因→给出修复代码 |
| tester | /tester | 检查项目是否能运行、功能达标 |
| team-tester | /team-tester | 对照需求清单逐项验证 |
| perf-opt | /perf-opt | 全链路性能优化 |
| security-review | /security-review | 当前分支安全审查 |

### 工具层
| 技能 | 命令 | 何时自动调用 |
|------|------|-------------|
| frontend-design | /frontend-design | UI/UX 设计：毛玻璃、配色、动画、排版 |
| git-workflow | /git-workflow | 安全 git 状态检查、规范提交 |
| planning-with-files | /planning-with-files | 超过 10 步的复杂任务（task_plan/notes/progress） |
| video-reader | /video-reader | 分析在线视频/本地视频 |
| website-perf | /website-perf | 网站性能优化 |
| memory-maintainer | /memory-maintainer | 自动维护长期记忆 |
| skill-creator | /skill-creator | 创建新 skill |

### 管理/协作层
| 技能 | 命令 | 何时自动调用 |
|------|------|-------------|
| team | /team | 6 个 AI 智能体并行协作 |
| schedule | /schedule | 创建定时任务 |
| setup-cowork | /setup-cowork | Cowork 环境初始化 |
| consolidate-memory | /consolidate-memory | 记忆文件整理去重 |
| team-ops | /team-ops | 部署方案/环境配置/安全检查 |

---

## 二、需要安装的新技能（按顺序装）

### 第一批：视觉能力（今天装）
```
# Snapview — 截屏看图
npm i -g snapview
# 使用：/snapview 截取当前屏幕，Claude Code 可直接看到并分析
```

### 第二批：开发增效（今天装）

```
# Waza — 8 个核心技能（著名 TypeScript 专家 tw93 出品）
claude plugin marketplace add tw93/Waza
claude plugin install Waza@Waza
# 新增：/think（深度思考）/design（方案设计）/check（代码审查）/hunt（bug追踪）/plan（任务规划）/code（编码）/test（测试）/doc（文档）

# Superpowers — 完整开发周期
/plugin install obra/superpowers
# 新增：brainstorming → writing-plans → subagent-driven-development → test-driven-development → requesting-code-review
```

### 第三批：品质提升（明天装）

```
# everything-claude-code — 181 skills 全家桶
claude plugin marketplace add everything-claude-code
# 先浏览不全部装，挑需要的
```

---

## 三、自动调度规则（追加到 CLAUDE.md）

```
## Skill 自动调用规则
以下任务类型发生时，必须主动调用对应技能，不等待用户提醒：

┌──────────────┬───────────────────────────────────────────┐
│ 任务类型     │ 自动调用的技能                            │
├──────────────┼───────────────────────────────────────────┤
│ 写 UI/样式   │ frontend-design + developer               │
│ 写代码       │ developer + code-style                    │
│ 代码审查     │ cr                                        │
│ 修 bug       │ bug-fix + tester                          │
│ 报错排查     │ bug-fix                                   │
│ 跑测试       │ tester + team-tester                      │
│ 性能优化     │ perf-opt + website-perf                   │
│ 新产品方案   │ product-manager + pm                      │
│ 技术架构     │ architect + team-architect                │
│ 复杂多步任务 │ planning-with-files（建立 task_plan.md）   │
│ 生成文档     │ auto-docs                                 │
│ Git 操作     │ git-workflow                              │
│ 生成 CRUD    │ crud-gen                                  │
│ 框架转换     │ framework-x                               │
│ 安全检查     │ security-review                           │
│ 扫描项目     │ project-scan                              │
│ 部署上线     │ team-ops                                  │
│ 团队协作     │ team                                      │
│ 需要看图     │ /snapview 或 video-reader                 │
│ 记忆维护     │ memory-maintainer + consolidate-memory    │
│ 创建新技能   │ skill-creator                             │
│ 定时任务     │ schedule                                  │
│ 前端设计     │ frontend-design                           │
└──────────────┴───────────────────────────────────────────┘

规则：识别到对应任务类型，直接自动调用。不等待用户说"请使用 xx 技能"。
每次完成任务后，检查是否有遗漏的 skill 应该被调用。
```
