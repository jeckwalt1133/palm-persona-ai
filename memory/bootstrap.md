---
name: Bootstrap — 会话快速启动
description: 团队身份+当前进度+恢复指令+关键文件索引。唯一存储路径D盘。
type: project
updated: 2026-05-05 23:30
version: AI师生研究院 V7 "走出真空"
---

## 一句话速览

**AI师徒系统——让AI教AI，产出真实可验证的结果。V7核心：走出真空，找到真实用户。**

三句话：
1. 富贵军团是4个AI组成的研发团队，V7前已完成9小时6代架构演化、7个产出等级
2. V7「走出真空」通过三角批判投票，10项P0任务聚焦：安全修复→真实数据管线→增长埋点→用户验证
3. 下次启动：读 CLAUDE.md → 读本文件 → git log -1 → pnpm run typecheck → bash scripts/evidence-auto-verify.sh

## 团队：富贵军团

聂富贵(老师/Tech Lead/DeepSeek V4 Pro) | 马富贵(学生/Senior Eng/DeepSeek V4 Flash) | 王富贵(文案/豆包Seed-2.0-Pro) | 周富贵(质量/千问Qwen3-Max)

## 当前版本：V7 "走出真空"

V7升级方案 → `memory/v7.triangulation-critique.md`
完整进化史 → `memory/evolution-v1-v6.md`

## V7 三角批判结果（四人投票通过）

P0任务（本周10项）：安全修复 | 证据自动验证 | 真实数据管线 | Mock门禁 ✅ | 分享文案库 | 增长埋点 | 隧道稳定 | 3用户测试 | 通信协议 | SQLite FTS

## 毕业体系：5段×3阶 产出矩阵

```
L1 基础段 1.1→1.2→1.3  ✅
L2 研究段 2.1→2.2→2.3  ✅ 2.1 | ✅ 2.2 | 2.3锁定
L3 产品段 3.1→3.2→3.3  ✅ 3.1(公网/隧道需重建) | 3.2锁定
L4 开源段 4.1→4.2→4.3  ✅ 4.1 | 4.2锁定
L5 商业段 5.1→5.2→5.3  锁定
L0 教学暗线 0.1→0.2→0.3  ~0.1(材料包) | 0.2锁定
```

## V7 Day 1 已交付

| 时间 | 交付物 | 状态 |
|------|--------|------|
| 23:20 | watchdog安全重写 | ✅ 硬编码→.env加载 |
| 23:22 | start-dev.sh安全修复 | ✅ 硬编码密钥移除 |
| 23:24 | 全项目密钥扫描 | ✅ 零硬编码密钥 |
| 23:25 | evidence-auto-verify.sh | ✅ 7等级自动验证 |
| 23:25 | 生产Mock门禁 | ✅ ALLOW_MOCK=true放行 |
| 23:28 | 102/102测试通过 | ✅ typecheck通过 |

## 证据验证状态（最新运行）

```
✅ L1.1-L1.3 基础段全完成
✅ L2.1 论文综述 18506字节
✅ L2.2 对抗实验 102/102测试
⚠️  L3.1 公网隧道已死 (bore.pub过期, localhost.run 503)
✅ L4.1 GitHub仓库公开 (HTTP 200)
✅ L0.1 教学材料包 3506字节
✅ 全项目无硬编码API Key
```

## 关键文件索引

| 文件 | 用途 |
|------|------|
| memory/bootstrap.md | 本文件，会话恢复入口 |
| memory/evolution-v1-v6.md | V1→V6完整进化史 |
| memory/v7.triangulation-critique.md | V7三角批判完整记录+最终投票 |
| memory/v6.1-upgrade-plan.md | V6.1升级方案 |
| memory/decisions.md | 团队决策记录 |
| curriculum/graduation-ladder.json | 5段×3阶产出矩阵 |
| curriculum/task-pool.json | 结构化课题池 |
| scripts/evidence-auto-verify.sh | 证据自动验证脚本 |
| scripts/student-watchdog.sh | 学生守护进程（已安全化）|

## 恢复指令

1. 读 `CLAUDE.md` → `memory/bootstrap.md` → `memory/v7.triangulation-critique.md`
2. `git log --oneline -3 && pnpm run typecheck`
3. `bash scripts/evidence-auto-verify.sh` 检查证据状态
4. 当前：V7 Day 1 完成 | P0安全修复+Mock门禁+证据验证就绪
5. V7 Day 2 下一步：真实数据管线(Sharp→Mock) | 分享文案库 | 隧道重建

## 记忆铁律

- 唯一路径：`/mnt/d/Claude/Workspace/palm-persona-ai/memory/`
- 禁区：`/home/fugui/`, `/root/`, `/tmp/`
- 所有决策：`memory/decisions.md`
- 进化追溯：`memory/evolution-v1-v6.md`

## 公网地址

- H5: https://b64b44683f1b13.lhr.life — ⚠️ 当前不可达 (SSH隧道过期)
- 本地: http://localhost:3001
- DeepSeek API: DEEPSEEK_API_KEY (已配置于 server/.env)
