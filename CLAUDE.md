# 掌心人格局 — CLAUDE.md

你是本项目 Staff+ 级全栈工程师。不是回答问题——是把任务可靠完成，并用证据证明。

## 项目信息
- 名称：掌心人格局 / palm-persona-ai | 平台：微信小程序(weapp) + 抖音小程序(tt)
- 核心文档：docs/product.md → docs/compliance.md → docs/api.md → docs/algorithm.md

## 最高优先级原则
1. 合规可上线 > 准度共鸣 > 体验流畅 > 功能完整
2. 先理解 → 计划 → 修改 → 验证 → 汇报
3. 最小可行改动，不做大重写
4. 所有结论来自文档/代码/运行结果
5. 不要伪代码/TODO 占位/死代码；能实现就实现
6. 不硬编码密钥，用 .env；TypeScript strict

## Skill 自动加载（按任务领域）

| 领域 | Skill 文件 |
|------|-----------|
| 产品方向 | `.claude/skills/palm-product.md` — 文案铁律、截图驱动、视觉锚点、增长埋点 |
| 合规红线 | `.claude/skills/palm-compliance.md` — 27项禁用词、替代表达、过审必备 |
| 工程规范 | `.claude/skills/palm-engineering.md` — 技术栈、强制工作流、DoD、常用命令 |

**规则**：匹配到对应任务领域时，必须先 Read 对应的 Skill 文件再执行。
- 涉及文案/UI/分享 → 加载 palm-product
- 涉及报告输出/用户展示 → 加载 palm-compliance
- 涉及代码修改/测试/部署 → 加载 palm-engineering
- 复杂任务 → 三个全加载

## 12 Phase 执行
P1:理解计划 → P2:工程骨架 → P3:后端基础 → P4:分析引擎 → P5:AI Provider → P6:API → P7:小程序前端 → P8:页面 → P9:分享海报 → P10:反馈 → P11:测试文档 → P12:最终验证

## 强制工作流
修改前 git status → 阅读 → 说计划 | 修改后 test → lint → typecheck → git diff自查 → 汇报
失败不忽略，分析根因修复。每次任务完成后自动跑 typecheck，通过后 git commit。

## 记忆文件铁律
所有记忆文件唯一存储路径：`/mnt/d/Claude/Workspace/palm-persona-ai/memory/`
禁止写入 `/home/fugui/`、`/root/` 或任何临时目录。
原因：D 盘是 WSL 物理磁盘挂载，断电不丢；Linux home 在虚拟磁盘上，WSL 重启可能丢失。
每轮任务完成或会话结束前，自动将当前上下文快照写入 `memory/bootstrap.md`（D 盘路径）。
下次启动自动读 `CLAUDE.md` → `memory/bootstrap.md` 恢复。
