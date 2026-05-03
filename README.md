# 掌心人格局 🌙

AI 手掌图像性格趣味解析工具。拍一张手掌，基于真实几何特征生成"准到戳心"的人格报告。

**⚠️ 合规定位：** 本产品为 AI 趣味分析工具，结果仅供娱乐和自我探索，不构成医学、法律、投资、婚恋或人生决策建议。

## 技术栈
Taro + React + TypeScript / Fastify + TypeScript + Zod / Vitest + ESLint + Prettier / pnpm workspace

## 快速开始
```bash
cp .env.example .env
pnpm install
pnpm dev:server          # 后端 http://localhost:3001
pnpm dev:weapp           # 微信小程序
pnpm dev:tt              # 抖音小程序
pnpm test; pnpm lint; pnpm typecheck
```

## 项目结构
```
palm-persona-ai/
  packages/          # 共享层 (shared-types/shared-utils/shared-safety)
  apps/miniapp/      # Taro 小程序 (含辅助标点页)
  server/            # Fastify 后端 (含限流/特征提取/AI Provider)
  docs/              # 产品/合规/API/算法文档
```

## AI Provider
默认 Mock 模式（无 API Key 可跑）。支持多模型轮询降级：Mock→通义→豆包→Claude。设置 AI_PROVIDER=openai 等切换。

## 产品灵魂
表面合规趣味测试，本质基于真实手掌几何特征分析。用户辅助标点提取关键掌纹特征，50 条映射规则生成共鸣报告，所有洞察均引用具体特征作为视觉锚点。

## 小程序审核关键
- **类目**："工具→图片处理"（严禁"生活服务→婚庆"）
- **开发 appid**：微信 `touristappid`，抖音 `testAppId`
- **ICP 备案**：涉及 UGC，上线前必须完成
- **隐私**：原始图片提取特征后即时删除，仅存加密特征哈希
- **合规**：首页青少年模式+隐私双弹窗，每日免费3次+激励视频，不强制分享

## API
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/analyze | 上传手掌+标点→人格报告 |
| GET | /api/reports | 历史报告 |
| DELETE | /api/reports/:id | 删除报告 |
| POST | /api/match/create | 创建匹配邀请(7天有效) |
| POST | /api/match/:id/join | 好友加入匹配 |
| GET | /api/match/:id/result | 匹配结果(含特征对比) |

## 配置
- BodyLimit: 10MB | 限流: 3次/分钟/设备 | CORS: 已启用
- 环境变量：AI_PROVIDER, AI_API_KEY, AI_BASE_URL, AI_MODEL, MAX_IMAGE_SIZE_MB=10

## Roadmap
- V1.0: 个人报告+分享海报（第1-2周）
- V1.1: 好友匹配+数据埋点（第3周）
- V1.2: 文案A/B测试+优化（第4周）
- V1.3: 抖音挑战话题页（第5周）
- V2.0: 会员体系+深度主题报告（亲密关系/职场人格）

## 项目灵魂
这不是工具，是**情绪共鸣型内容产品**。成功取决于用户测完觉得"这说的就是我，我要发给朋友看看"。
报告采用"截图驱动"设计——每个模块是独立卡片，可单独保存分享。
分享文案库 ≥100 条社交货币，四类：身份标签/隐秘真相/关系洞察/对立反差。
