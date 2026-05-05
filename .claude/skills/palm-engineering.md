# 掌心人格局 — 工程规范 Skill

调用时机：任何涉及代码修改、测试、部署时。

## 技术栈
前端：Taro + React + TypeScript + SCSS
后端：Node.js + Fastify + TypeScript + Zod，bodyLimit: 10MB
测试：Vitest | 包管理：pnpm workspace
共享层：packages/shared-types + shared-utils + shared-safety
存储：Repository 接口抽象，MVP 内存，后续切 SQLite/MySQL
AI：可插拔 Provider → 多模型轮询降级 + 失败重试 + 超时熔断
安全：接口限流（同设备 3次/分钟）+ CORS + 动态敏感词库

## 项目结构
```
palm-persona-ai/
  packages/          # shared-types/shared-utils/shared-safety
  apps/miniapp/      # Taro 小程序 (含 points-marking/PalmFeatureMarker/analytics)
  server/            # Fastify 后端 (含 engine/ai/safety/routes)
  docs/              # product/compliance/api/algorithm/growth-philosophy
```

## 强制工作流
- 修改前：git status → 阅读 → rg 搜索 → 说计划
- 修改中：小步改 → 遵循风格 → 不破坏其他功能
- 修改后：测试 → lint → typecheck → git diff 自查 → 汇报
- 失败：不忽略 → 分析根因 → 修复或说明

## Definition of Done
代码实现 → 测试通过 → typecheck通过 → lint通过 → git diff自查 → 汇报
额外检查：非手掌图片正确提示、重新测试按钮可用、空状态引导存在、匹配7天过期、报告含视觉锚点、README含类目/appid/备案

## 常用命令
```bash
pnpm install; pnpm test; pnpm lint; pnpm typecheck
pnpm dev:server; pnpm build:weapp; pnpm build:tt
```

## Skill 自动调用规则
| 任务类型 | 技能 | 任务类型 | 技能 |
|----------|------|----------|------|
| 写UI/样式 | frontend-design | 写代码 | developer+code-style |
| 代码审查 | cr | 修bug | bug-fix+tester |
| 性能优化 | perf-opt | 技术架构 | architect |
| 安全检查 | security-review | 部署上线 | team-ops |
| 记忆维护 | memory-maintainer | 复杂任务 | planning-with-files |

识别到对应任务类型，直接自动调用。不等待用户提醒。
