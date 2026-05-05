---
name: Bootstrap — 会话快速启动
description: V7全量整改已完成。AI师生研究院元项目已纯化，子项目分离。
type: project
updated: 2026-05-06 01:30
version: AI师生研究院 V7 "方法论扎根"
---

## 一句话

**AI师生研究院 = AI教AI的方法论系统。掌心人格局 = 使用该方法的子项目。两套独立。**

## 团队状态

| 角色 | 状态 | 当前任务 |
|------|------|---------|
| 聂富贵 | active | V7 P0全部完成，P1收尾 |
| 马富贵 | active | Phase 1完成(precompact+sessionstart+team-status) |
| 王富贵 | idle | 教学模块01已交付 |
| 周富贵 | idle | 教学模块01已交付，健康检查通过 |

详见: `memory/team-status.json`

## V7 Week 1 产出清单

### P0（6/6 全部完成 ✅）
- `curriculum/task-prompt-schema.json` — Task Prompt标准格式
- `curriculum/learning-standards.md` — 学会三级标准
- `curriculum/onboarding.md` — 新学徒Day 1手册
- `curriculum/evidence-schema.json` — 证据结构化Schema
- `scripts/methodology-health-check.sh` — 方法论健康检查(7项)
- `curriculum/guest-modules/wang-copywriting-01.md` + `zhou-security-01.md` — 2个完整教学模块

### 马富贵 V7-002 研究课题
- `research/memory-automation-design.md` (606行) — 记忆系统自动化完整设计
- `scripts/precompact-snapshot.sh` — PreCompact快照生成
- `scripts/sessionstart-recover.sh` — SessionStart自动恢复
- `memory/team-status.json` — 团队仪表盘

### P1（部分完成）
- `curriculum/task-dependency-graph.json` — 13节点+4条学习路径
- 笔记系统规则: learning-standards.md 已内含

## 毕业体系

```
L1 基础段 1.1→1.2→1.3  ✅
L2 研究段 2.1→2.2→2.3  ✅2.1 ✅2.2 | 2.3
L3 产品段 3.1→3.2→3.3  ✅3.1
L4 开源段 4.1→4.2→4.3  ✅4.1
L0 教学暗线 0.1→0.2→0.3  ~0.1
```

## 项目分家规则

AI师生研究院（元）→ 优化方法论 → 子项目复用
掌心人格局（子）→ 使用方法论 → 产品开发
未来项目B/C → 复用同一套方法

## 恢复指令

1. `memory/bootstrap.md` → `memory/team-status.json` → `memory/v7.final-plan.md`
2. `bash scripts/methodology-health-check.sh` 检查系统状态
3. `git log --oneline -3 && pnpm run typecheck`
4. 检查 team-status.json 的 priorityQueue 确定下一个任务

## 公网地址

- H5: localhost:3001（隧道过期，待重建）
- 证据验证: `bash scripts/evidence-auto-verify.sh`
