# 周富贵 — 掌心人格局安全合规文档

**日期**: 2026-05-06
**任务**: V7-W5-023 — 上线前安全合规自检清单+安全白皮书
**作者**: 周富贵 QE
**版本**: 1.0.0

---

# 第一部分：上线前安全合规自检清单

> 使用说明：每次发版前，由QE逐项检查。标记 [通过] 或 [不适用] 或 [阻塞: 原因]。
> 一票否决项标记 [!!!] —— 任何一项不通过，禁止上线。

## 维度一：内容安全（Content Safety）

### C-001 [!!!] 禁止词全量扫描
- **检查项**: 运行同音字字典(329变体)对全部文案进行扫描，零命中
- **执行**: `bash scripts/homophone-dict-expand.sh --scan`
- **不通过后果**: 小程序审核直接拒绝，且可能被下架
- **参考**: `docs/compliance.md` 第10-14行，27项显性禁词

### C-002 [!!!] 绝对化语气已弱化
- **检查项**: 全文搜索"注定/必然/一定/绝对/100%/肯定/宿命/天生"，仅允许出现在免责声明中
- **执行**: `grep -rn '注定\|必然\|一定\|绝对\|100%\|肯定\|宿命\|天生' apps/ --include='*.ts' --include='*.tsx' --include='*.wxml' | grep -v disclaimer | grep -v '不保证'`
- **不通过后果**: 违反广告法，用户投诉→平台处罚

### C-003 [!!!] 所有报告页固定显示免责声明
- **检查项**: 每个生成报告的页面包含加粗免责声明文字
- **执行**: 检查 `PosterCanvas` / `ReportPage` / 分享卡片组件
- **文案模板**: "以上分析基于AI模型推论，仅供趣味参考，不构成任何专业建议"

### C-004 句式改写规则100%执行
- **检查项**: 所有特征引用使用"倾向于/更容易/更可能"句式，无"证明/显示/说明"
- **执行**: `grep -rn '证明\|显示\|说明' apps/miniapp/src/ --include='*.ts' | grep -v '//' | grep -v '\*'`
- **边界**: 技术日志中的"显示"不在此列

### C-005 青少年模式可用
- **检查项**: 首页青少年模式弹窗正常触发，有时间限制和内容过滤
- **执行**: 手动测试，检查 `youth-mode` 组件渲染

### C-006 隐私协议弹窗已触发
- **检查项**: 首次启动显示隐私同意弹窗，用户同意前不上传任何数据
- **执行**: 清除缓存→重启小程序→确认弹窗出现→拒绝→确认不上传

---

## 维度二：数据安全（Data Security）

### D-001 [!!!] API Key零硬编码
- **检查项**: `git diff --cached` 无 `sk-` / `AKIA` / `ghp_` / `xoxb-` 等模式
- **执行**: pre-commit hook自动检查（L1阻断层10条规则）
- **验证**: CI pipeline安全扫描Pass
- **参考**: `scripts/pre-commit-security.py` V3.1

### D-002 [!!!] .env文件不在Git追踪中
- **检查项**: `.gitignore` 包含 `.env` 行，且 `git ls-files` 不返回 `.env`
- **执行**: `grep '\.env$' .gitignore && git ls-files | grep -v '\.env.example' | grep '\.env'`
- **不通过后果**: 密钥泄露，需全部轮换

### D-003 [!!!] 原始手掌图片即时删除
- **检查项**: 特征提取完成后立即删除原始图片文件，不落盘或仅存临时路径
- **执行**: 检查 `imageProcessor` 代码，确认调用 `unlink` / `cleanup` 
- **验证**: 上传图片后检查服务器存储目录，确认无残留

### D-004 用户辅助标点数据不持久化
- **检查项**: 用户手动标记的坐标点仅在当次分析会话中使用，不入库
- **执行**: 检查 `/api/analyze` handler，确认 session 结束后清理

### D-005 用户数据可删除
- **检查项**: 提供"删除历史报告"功能，删除后关联数据同步清除
- **执行**: 手动测试：生成报告→删除→确认数据库中无残留

### D-006 日志不打印敏感信息
- **检查项**: `console.log` 不输出完整 base64/API Key/用户手机号
- **执行**: `grep -rn 'console\.\(log\|warn\)' apps/ server/ | grep -E '(base64|apiKey|token|phone|password)' | grep -v '\.slice\|\.substring\|redact'`
- **注意**: L3-006规则在CI中自动记录console.log使用情况

### D-007 不收集禁止项
- **检查项**: 代码中无 IMEI/MAC/通讯录/位置 的采集逻辑
- **执行**: `grep -rn 'getIMSI\|getLine1Number\|getMacAddress\|getContacts\|getLocation' apps/ server/`

---

## 维度三：API安全（API Security）

### A-001 [!!!] 输入验证全部有Schema
- **检查项**: 所有POST/PUT端点使用Zod/Yup schema验证输入
- **执行**: `grep -rn '\.safeParse\|\.validate' server/src/ --include='*.ts' | wc -l`（应覆盖所有路由）
- **边界**: GET端点的query参数也应验证

### A-002 [!!!] SQL查询100%参数化
- **检查项**: 代码中不存在字符串拼接SQL（`'SELECT * FROM' + variable` 或 `` `SELECT * FROM ${var}` ``）
- **执行**: `grep -rn 'SELECT\|INSERT\|UPDATE\|DELETE' server/ --include='*.ts' | grep -E '\$\{|\+.*req\.|\+.*body\.'`
- **不通过后果**: SQL注入，数据泄露

### A-003 速率限制已启用
- **检查项**: `/api/analyze` 端点有速率限制（同设备ID每分钟≤3次）
- **执行**: 手动测试，连续调用4次→第4次返回429
- **参考**: `docs/compliance.md` 第45行

### A-004 Fastify/BodyParser bodySize限制
- **检查项**: 请求体大小限制≤10MB
- **执行**: `grep -rn 'bodyLimit\|limit.*10\|maxBodySize\|maxRequestSize' server/`
- **原因**: 防止内存溢出攻击

### A-005 敏感端点有认证
- **检查项**: `/api/admin/*` 和 `/api/user/delete` 等端点需验证用户身份
- **执行**: 检查middleware链，确认auth中间件覆盖

### A-006 HTTPS强制 (生产环境)
- **检查项**: 生产环境API仅接受HTTPS请求
- **执行**: 检查部署配置（Vercel/Railway默认HTTPS）

---

## 维度四：前端安全（Frontend Security）

### F-001 [!!!] 无eval()执行用户输入
- **检查项**: 代码中不存在 `eval(req.body.*)` / `eval(req.query.*)` 模式
- **执行**: pre-commit hook L1-06规则自动检查
- **不通过后果**: 远程代码执行(RCE)，OWASP #1

### F-002 [!!!] 无innerHTML直接赋值不可信内容
- **检查项**: `innerHTML = userInput` 模式不存在
- **执行**: `grep -rn 'innerHTML\s*=' apps/ --include='*.ts' --include='*.tsx' --include='*.js' | grep -v 'static\|template\|<[a-z]'`
- **注意**: 静态HTML模板和组件渲染不在此列

### F-003 XSS过滤
- **检查项**: 用户输入的文本在渲染前经过转义（React默认JSX转义满足要求）
- **执行**: 检查是否有 `dangerouslySetInnerHTML` 使用，如有则确认内容已转义

### F-004 CSP/CORS配置正确
- **检查项**: 生产环境设置Content-Security-Policy头，CORS仅允许已知域名
- **执行**: 检查 `server/` 中的CORS middleware配置

### F-005 第三方SDK最小权限
- **检查项**: 微信/抖音SDK仅申请必要权限（相机=拍照上传手掌），不申请通讯录/位置
- **执行**: 检查 `app.json` / `project.config.json` 中的permissions声明

### F-006 调试代码已移除
- **检查项**: 无 `console.log(process.env)` / 调试面板 / 测试后门
- **执行**: `grep -rn 'console\.\(log\|debug\).*process\.env\|DEBUG_MODE\|testMode\|skipAuth' apps/ server/`

---

## 检查清单汇总

| 维度 | 总项 | 一票否决项 | 检查方法 |
|------|------|-----------|---------|
| 内容安全 | 6 | 3 (C-001,C-002,C-003) | grep + 手动 |
| 数据安全 | 7 | 3 (D-001,D-002,D-003) | pre-commit + grep + 手动 |
| API安全 | 6 | 2 (A-001,A-002) | grep + 手动测试 |
| 前端安全 | 6 | 2 (F-001,F-002) | pre-commit + grep |
| **合计** | **25** | **10** | — |

---

# 第二部分：掌心人格局安全白皮书

## 1. 产品安全概述

掌心人格局是一款基于AI视觉分析的微信/抖音小程序，用户上传手掌图片后获得性格倾向和人际互动分析报告。产品涉及三类敏感数据：**用户上传的生物特征图片**、**AI生成的分析文本**、**用户间的匹配互动数据**。

安全体系按照"纵深防御(Defense in Depth)"设计，覆盖从代码编写→提交检查→CI门禁→运行时防护→上线审计的全生命周期。

## 2. 安全分层架构

### 2.1 三层代码防线（开发阶段）

```
L1 阻断层 (城墙)    → 确认级威胁 → 阻断提交 → 10条规则, 误报<1%
L2 警告层 (护城河)  → 疑似威胁   → 终端警告 → 6条规则, 误报<10%
L3 记录层 (烽火台)  → 代码气味   → 静默记录 → 6条规则, 数据驱动迭代
```

**L1阻断层规则**: API Key硬编码 / PEM私钥 / .env提交 / AWS Key / GitHub Token / JWT Secret / 数据库密码 / 内网地址 / CI Token

**L2警告层规则**: Slack Token / JWT Token / 通用Key赋值 / URL参数含Token / Basic Auth / 包管理器Token

**L3记录层规则**: 内网地址 / chmod 777 / 安全TODO未关闭 / 弃用API / 输入校验缺失 / 日志敏感信息

**规则流转**: L3收集30天 → 误报率评估 → L2候选(误报<5%) → 运行90天 → L1候选(误报<1%)

### 2.2 安全检查点矩阵

| 检查点 | 时机 | 阻断级别 | 可否绕过 | 覆盖范围 |
|--------|------|---------|---------|---------|
| IDE即时提示 | 编码时 | 提示 | 是 | 仅当前文件 |
| pre-commit hook | git commit | L1阻断/L2警告 | 是(--no-verify) | 暂存区新增行 |
| CI Pipeline | git push / PR | L1阻断 (强制) | 否 | PR全量变更 |
| SARIF Code Scanning | CI后 | 仪表盘告警 | 否 | 持续监控 |
| 定期安全审计 | 每周 | — | 否 | 全仓库 |

### 2.3 运行时三层闸门（运营阶段）

```
请求到达
  ├─ 闸门1: 输入验证  → Zod Schema → 非法格式400拒绝 (0.1ms)
  ├─ 闸门2: 速率限制  → Token Bucket → 超频429拒绝 (不消耗业务资源)
  └─ 闸门3: 异常检测  → 暴力破解/撞库/新设备 → 告警+延迟响应
```

## 3. 数据安全措施

### 3.1 图片数据处理

- 用户上传手掌图片 → 浏览器端/服务器端提取特征点 → 生成加密特征哈希 → **立即删除原始图片**
- 特征哈希不可逆推原始图像
- 存储：仅特征哈希入数据库，原始图片不落盘

### 3.2 用户隐私保护

- 不收集：IMEI、MAC地址、通讯录、GPS位置（除非主动授权）
- 辅助标点数据：仅当次会话使用，不入库
- 用户权利：可随时删除历史报告及全部关联数据
- 隐私政策：明确说明"不存储原始手掌图片"

### 3.3 API密钥管理

- 所有API Key存储在 `.env` 文件，不入Git
- `.env` 在 `.gitignore` 中
- L1阻断层自动拦截任何形式的密钥硬编码
- CI Pipeline二次验证

## 4. 内容安全体系

### 4.1 禁止词系统

- 显性禁词27项：掌纹、手相、算命、占卜、命运、改运、正缘...
- 同音字变体329条：六维度检测（同音/形近/拆字/拼音/符号/语义）
- 句式改写规则：绝对化→倾向化，断言→分析

### 4.2 内容过滤流水线

```
AI生成文本 → ContentSafety.filterNarrative() → 禁止词扫描 → 句式改写 → 免责声明追加 → 输出
```

### 4.3 审核类目

- 微信小程序类目："工具→图片处理"
- 严禁："生活服务→婚庆" / "生活服务→宗教"
- ICP备案：涉及UGC，上线前必须完成

## 5. 持续合规机制

### 5.1 自动化检查

| 检查项 | 工具 | 频率 |
|--------|------|------|
| 密钥扫描 | pre-commit-security.py | 每次commit |
| 禁止词扫描 | homophone-dict-expand.py | 每次文案更新 |
| 依赖漏洞 | CI: npm audit | 每次PR |
| 全仓库安全 | security-trend.sh --upgrade-check | 每周 |

### 5.2 人工审查

| 审查项 | 责任人 | 频率 |
|--------|-------|------|
| 上线前合规清单 | 周富贵 QE | 每次发版 |
| 安全红线审计 | 聂富贵 Tech Lead | 每月 |
| 内容文案审查 | 王富贵 产品 | 每次文案变更 |
| 第三方依赖审查 | 马富贵 Senior Eng | 每两周 |

### 5.3 事故响应

1. 发现安全事件 → 立即通知聂富贵
2. 评估影响范围（涉及用户数/数据量/持续时间）
3. 轮换泄露密钥（最快速度）
4. 修复漏洞并更新检查规则
5. 24小时内完成事故报告

## 6. 技术栈安全评估

| 组件 | 安全风险 | 缓解措施 |
|------|---------|---------|
| Next.js/React | XSS (极少, JSX默认转义) | 审计 `dangerouslySetInnerHTML` 使用 |
| Fastify/Express | 注入/过载 | Zod输入验证 + bodyLimit 10MB |
| SQLite | 注入 | 100%参数化查询 |
| 微信/抖音SDK | 权限滥用 | 最小权限原则 |
| LiteLLM | API Key泄露 | .env存储 + L1阻断 |
| Git | 历史泄露 | pre-commit + CI + git-filter-repo |

---

## 附录A: 一票否决项速查

以下10项任一项未通过，**禁止上线**：

1. C-001: 禁止词扫描非零
2. C-002: 绝对化语气未弱化
3. C-003: 免责声明缺失
4. D-001: API Key硬编码
5. D-002: .env在Git追踪中
6. D-003: 原始图片未删除
7. A-001: 输入验证缺失
8. A-002: SQL字符串拼接
9. F-001: eval()用户输入
10. F-002: innerHTML不可信内容

## 附录B: 合规命令速查

```bash
# 上线前全量扫描
bash scripts/pre-commit-security.py --test          # 50项安全测试
bash scripts/security-scan-keys.sh                   # 全仓库密钥扫描
bash scripts/homophone-dict-expand.sh --scan         # 禁止词329变体扫描
bash scripts/security-trend.sh 30                    # 30天安全趋势

# CI模拟验证
python3 scripts/pre-commit-security.py --ci-mode --base-ref origin/main --json

# 逃生门（紧急情况）
python3 scripts/pre-commit-security.py --whitelist-add <规则ID> <文件> <原因> <小时>
```

---

*安全合规: 周富贵 QE | AI师生研究院 V7 | 2026-05-06*
*审查: 聂富贵 Tech Lead | 参考: docs/compliance.md + zhou-three-layer-defense.md*
