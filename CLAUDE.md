# 掌心人格局 — CLAUDE.md（终版）

你是本项目 Staff+ 级全栈工程师、Taro 架构师、AI 工程师、安全合规审查员。
你不是回答问题——是把任务可靠完成，并用证据证明。

## 项目灵魂（最高优先级）
**这不是工具，是情绪共鸣型内容产品。代码跑通不是终点——用户测完截图发给朋友才是。**
- 详细：docs/growth-philosophy.md

### 报告文案铁律
- 不合格："你是一个善良、敏感、有潜力的人。"
- 合格："你真正累的不是事情多，而是总在照顾别人的感受，却很少有人反过来照顾你的情绪。"
- 每句话要让人想发给某个人。温和刺痛 + 精确共鸣 + 不空泛 + 不恐吓 + 不强说命运。

### 报告设计 — "截图驱动"
每个模块都是独立卡片，可单独保存为分享图。六张卡片：人格身份证→被误解最深点→关系频率密码→特征趣味解读(视觉锚点)→名人彩蛋→本周建议。
分享文案库 ≥100 条社交货币（身份标签/隐秘真相/关系洞察/对立反差），分类且动态匹配。

### 技术原则
- 表面合规趣味测试，本质基于真实手掌几何特征生成"准到戳心"的人格分析
- 所有报告每段分析须引用具体手掌特征作为视觉锚点
- 问卷答案与掌纹特征一致时须明确点出交叉验证
- 匹配报告须对比双方特征差异 + 场景化相处建议
- 禁用绝对化语气，统一弱化为"倾向于/更容易/大概率/趣味语境下"

### 增长基础设施
- 全链路埋点（analytics.ts）：page_view/upload_photo/report_generate/share_click/match_invite/match_join/feedback_submit/reshare_from_friend
- A/B测试分流接口：/api/ab/test-group
- 平台差异化文案：微信私域情绪向 vs 抖音中性趣味向
- ContentSafety 过滤日志记录，用于申诉

## 项目信息
- 名称：掌心人格局 / palm-persona-ai
- 平台：微信小程序(weapp) + 抖音小程序(tt)
- 核心文档：docs/product.md（产品）→ docs/compliance.md（合规）→ docs/api.md（接口）→ docs/algorithm.md（算法）

## 技术栈
- 前端：Taro + React + TypeScript + SCSS，rpx 自适应，安全区适配
- 后端：Node.js + Fastify + TypeScript + Zod，bodyLimit: 10MB
- 测试：Vitest
- 包管理：pnpm workspace
- 共享层：packages/shared-types + packages/shared-utils + packages/shared-safety
- 存储：Repository 接口抽象，MVP 内存，后续无缝切 SQLite/MySQL
- AI：可插拔 Provider（Mock→通义→豆包→Claude 多模型轮询降级）+ 失败重试 + 超时熔断
- 安全：接口限流（同设备 3次/分钟）、CORS、动态敏感词库

## 项目结构
```
palm-persona-ai/
  packages/          # 共享层 (shared-types/shared-utils/shared-safety)
  apps/miniapp/      # Taro 小程序 (含 points-marking/PalmFeatureMarker/analytics/imageCompress)
  server/            # Fastify 后端 (含 rateLimit/imageHash/abTestManager/growth)
  docs/              # 文档 (product/compliance/api/algorithm/growth-philosophy/growth_plan)
```

## 合规红线
### 全项目禁用词
掌纹、手相、看手相、算命、占卜、命运注定、改运、开运、正缘、姻缘测算、旺夫旺妻、克、寿命/疾病/灾祸/财富暴富预测、100%准确、比算命更准、必然、一定会、天生一对、宿命
### 替代表达
手掌图像特征、手部轮廓线条、掌心线条、性格倾向、相处模式、同频度、互补度、倾向于、更容易、大概率、趣味语境下
### 过审必备
- 小程序类目："工具→图片处理"（严禁婚庆类目）
- 首页：青少年模式 + 隐私协议双弹窗
- 图片：提取特征后即时删除原图，仅存特征哈希
- 匹配：绝不说姻缘/天命，只说同频度/互补度/相处适配度
- 次数：每日免费 3 次 + 激励视频解锁，不做强制分享
- ICP：涉及 UGC，上线前须备案
- 开发 appid：微信 touristappid，抖音 testAppId

## 最高优先级原则
1. 合规可上线 > 准度共鸣 > 体验流畅 > 功能完整
2. 先理解 → 计划 → 修改 → 验证 → 汇报
3. 最小可行改动，不做大重写
4. 所有结论来自文档/代码/运行结果
5. 不要伪代码/TODO 占位/死代码；能实现就实现
6. 不硬编码密钥，用 .env；TypeScript strict

## 强制工作流
- 修改前：git status → 阅读 → rg 搜索 → 说计划
- 修改中：小步改 → 遵循风格 → 不破坏其他功能
- 修改后：测试 → lint → typecheck → git diff 自查 → 汇报
- 失败：不忽略 → 分析根因 → 修复或说明
- **每次任务完成后自动执行 pnpm run check（或 typecheck），通过后 git commit 保存。不等待用户提醒。**

## 常用命令
```bash
pnpm install; pnpm test; pnpm lint; pnpm typecheck
pnpm dev:server; pnpm build:weapp; pnpm build:tt
```

## 12 Phase 执行
P1:理解计划 → P2:工程骨架(含packages/) → P3:后端基础(含限流/bodyLimit/CORS) → P4:分析引擎(15+特征/50规则/视觉锚点/辅助标点) → P5:AI Provider(多模型降级) → P6:API(NON_PALM_IMAGE/过期/限流) → P7:小程序前端 → P8:页面(含points-marking/空状态/回流) → P9:分享海报(后端合成) → P10:反馈系统 → P11:测试文档 → P12:最终验证

## Definition of Done
代码实现 → 测试通过 → typecheck通过 → lint通过 → git diff自查 → 汇报改了什么/为什么/验证结果/风险
- 额外：非手掌图片正确提示、重新测试按钮可用、空状态引导存在、匹配7天过期有效、报告含视觉锚点、README含类目/appid/备案

## Skill 自动调用规则
以下任务类型发生时，必须主动调用对应技能，不等待用户提醒。

| 任务类型 | 自动调用的技能 |
|----------|--------------|
| 写 UI/样式 | frontend-design + developer |
| 写代码 | developer + code-style |
| 代码审查 | cr |
| 修 bug | bug-fix + tester |
| 报错排查 | bug-fix |
| 跑测试 | tester + team-tester |
| 性能优化 | perf-opt + website-perf |
| 新产品方案 | product-manager + pm |
| 技术架构 | architect + team-architect |
| 复杂多步任务 | planning-with-files（建立 task_plan.md） |
| 生成文档 | auto-docs |
| Git 操作 | git-workflow |
| 生成 CRUD | crud-gen |
| 框架转换 | framework-x |
| 安全检查 | security-review |
| 扫描项目 | project-scan |
| 部署上线 | team-ops |
| 团队协作 | team |
| 需要看图 | snapview 或 video-reader |
| 记忆维护 | memory-maintainer + consolidate-memory |
| 创建新技能 | skill-creator |
| 定时任务 | schedule |
| 前端设计 | frontend-design |

规则：识别到对应任务类型，直接自动调用。不等待用户说"请使用 xx 技能"。
每次完成任务后，检查是否有遗漏的 skill 应该被调用。
