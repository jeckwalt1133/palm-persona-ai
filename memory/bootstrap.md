---
name: Bootstrap — 会话快速启动
description: V7 Day 2 完结。4人独立研究院上线，记忆系统全链路闭环。
type: project
updated: 2026-05-06 03:30
version: AI师生研究院 V7 "方法论扎根" Day 2 + 3h学习模式
---

## 一句话

**AI师生研究院 = 4人独立会话 + 完整记忆闭环 + 82项能力矩阵。掌心人格局 = 子项目产品。**

## 团队状态

| 角色 | 功能 | 状态 | 当前任务 |
|------|------|------|---------|
| 聂富贵 | EM+TL | active | 团队协调+学习模式 |
| 马富贵 | SE | active | V7-003 记忆系统 Phase 2 (知识图谱+检索) |
| 王富贵 | PM | active | WANG-02 文案模块02 ✅已完成 |
| 周富贵 | QE | active | ZHOU-02 安全模块02 ✅已完成+审计报告 |

详见: `memory/team-status.json`

## V7 Day 2 3h学习模式产出

- **学习笔记**: `student-notebook/nie-learning-2026-05-06.md` — 4模块深度学习+4组跨模块连接
- **三角批判**: `memory/v7.triangulation-critique-day2.md` — 四成员产出交叉审查+3结构性矛盾+Week 2升级方案
- **Week 2 Sprint**: P0(4项基础设施修复)+P1(3项实验/部署/执行强制)

## V7 Day 2 产出清单 (git commit f817ce6)

### 基础设施
- **4人独立tmux会话**: 聂(DeepSeek V4 Pro)、马(DeepSeek V4 Flash)、王(豆包Seed-2.0-Pro)、周(千问Qwen3-Max)
- **Anthropic→OpenAI翻译代理**: `scripts/anthropic-proxy.py` — 豆包(:8787)+千问(:8788)
- **团队守护进程**: `scripts/team-watchdog.sh` — 60s检测+自动拉起3个学生会话

### 记忆系统全链路
- **做梦引擎**: `scripts/dream-consolidation.sh` — hippocampal replay记忆巩固
- **防遗忘系统**: `scripts/anti-forgetting.sh` — 47项能力+3级退化阈值(L1:30d/L2:60d/L3:90d)
- **State Tracker**: `scripts/state-tracker.sh` — PostToolUse hook,每次工具调用更新checkpoint
- **记忆检索**: `scripts/memory-search.sh` — 多源知识图谱+决策+能力搜索

### Skill系统
- **路由v2.0**: `memory/skill-routing.json` — 31 skills+236关键词+4级优先级
- **Web爬取**: `.claude/skills/palm-web-research.md` — 全网最新AI资讯爬取

### 能力矩阵
- **团队总计82项**: 聂26+王22+周19+马15, 覆盖10领域
- **功能角色**: PM(王)+EM(聂)+QE(周)+TL(聂)+SE(马)
- **个人能力文件**: capability-nie/wang/zhou.json

### 教学模块产出
- **王富贵**: `curriculum/guest-modules/wang-copywriting-02.md` — 情感分层+场景化文案
- **周富贵**: `curriculum/guest-modules/zhou-security-02.md` — 安全左移+CI集成+pre-commit门禁
- **周富贵**: `student-notebook/zhou-v7-003-audit.md` — 马富贵代码安全审计

### 安全
- **Pre-commit门禁**: 密钥扫描(只查新增行)+.env检查+代码模式警告
- **CI扫描脚本**: `scripts/security-scan-keys.sh` — 全仓库+历史100提交

## 恢复指令

1. `memory/bootstrap.md` → `memory/team-status.json` → `git log --oneline -3`
2. `bash scripts/methodology-health-check.sh`
3. 检查 `memory/team-status.json` priorityQueue
4. 检查 team-watchdog: `tmux list-sessions`

## 公网地址

- H5: localhost:3001
- 证据验证: `bash scripts/evidence-auto-verify.sh`
- 代理健康: `curl localhost:8787/health` (豆包) + `curl localhost:8788/health` (千问)
