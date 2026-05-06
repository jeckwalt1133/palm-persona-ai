# 掌心人格局 — SQLite 数据库 Schema 设计

> 钱富贵 (P6 后端) | 2026-05-06 | v1.0

## 1. 设计目标

- **存储引擎**: SQLite (Node 24 内置 `node:sqlite` 模块，零外部依赖)
- **接口兼容**: 实现现有 `ReportRepository` / `GrowthRepository` 接口，与内存版可互换
- **迁移支持**: 版本化迁移表，幂等执行，支持 CI/开发/生产环境
- **数据完整性**: WAL 模式 + 外键约束 + 唯一索引 + STRICT 表模式

## 2. 技术选型

| 维度 | 选择 | 原因 |
|------|------|------|
| 数据库 | SQLite | 单文件、零配置、与 MVP 阶段匹配 |
| 驱动 | `node:sqlite` (Node 24+) | 内置模块，无需原生编译，避免 WSL 跨文件系统权限问题 |
| 写入模式 | WAL (Write-Ahead Logging) | 读不阻塞写，适合小程序并发读场景 |
| 表模式 | STRICT | 防止意外写入错误类型字段 |
| 外键 | PRAGMA foreign_keys=ON | 级联删除 + 引用完整性 |
| 繁忙超时 | 5000ms | 避免并发写入时的 SQLITE_BUSY 错误 |

## 3. 表结构

### 3.1 user 表

存储用户基本信息和成长数据。

```sql
CREATE TABLE IF NOT EXISTS "user" (
  "id"                  TEXT PRIMARY KEY NOT NULL,   -- 用户唯一标识 (设备ID/微信openid)
  "nickname"            TEXT,                        -- 昵称
  "avatar_url"          TEXT,                        -- 头像URL
  "palm_image_count"    INTEGER NOT NULL DEFAULT 0,  -- 累计上传掌纹次数
  "unlocked_lines_json" TEXT NOT NULL DEFAULT '[]',  -- 已解锁的深度维度线 (JSON数组)
  "created_at"          TEXT NOT NULL,               -- 创建时间 (ISO8601)
  "updated_at"          TEXT NOT NULL                -- 更新时间 (ISO8601)
) STRICT;
```

**设计要点**:
- `unlocked_lines_json` 存储如 `["life", "wisdom"]` 的数组，避免额外关联表
- 签到功能可通过 `checkin` 表关联查询，不冗余存储在 user 表
- `palm_image_count` 用于快速展示用户活跃度，非关键数据

### 3.2 report 表

存储掌纹分析报告，是核心业务表。

```sql
CREATE TABLE IF NOT EXISTS "report" (
  "id"                     TEXT PRIMARY KEY NOT NULL,  -- 报告UUID
  "user_id"                TEXT NOT NULL,              -- 所属用户 (FK → user.id)
  "persona_type"           TEXT NOT NULL,              -- 人格类型key (如 "explorer")
  "persona_label"          TEXT NOT NULL,              -- 人格类型标签 (如 "探索者")
  "scores_json"            TEXT NOT NULL,              -- 维度得分 (PersonaScore[])
  "summary"                TEXT NOT NULL,              -- 报告摘要
  "insights_json"          TEXT NOT NULL,              -- 洞察列表 (string[])
  "keywords_json"          TEXT NOT NULL,              -- 关键词列表 (string[])
  "quote"                  TEXT NOT NULL,              -- 金句
  "suspense_text"          TEXT NOT NULL,              -- 悬念文案
  "core_truth"             TEXT NOT NULL,              -- 核心真相
  "weekly_advice"          TEXT NOT NULL,              -- 本周建议
  "visual_anchors_json"    TEXT,                       -- 掌纹视觉锚点 (nullable)
  "identity_badge"         TEXT,                       -- 身份徽章 (nullable)
  "ad_teaser"              TEXT,                       -- 广告导语 (nullable)
  "relationship_code_json" TEXT,                       -- 关系密码 (nullable)
  "celebrity_matches_json" TEXT,                       -- 名人匹配 (nullable)
  "feedback_rating"        INTEGER,                    -- 用户评分 1-5 (nullable)
  "feedback_comment"       TEXT,                       -- 用户反馈 (nullable)
  "compliance_checked"     INTEGER NOT NULL DEFAULT 0, -- 合规检查: 0=未检查 1=已通过
  "created_at"             TEXT NOT NULL,              -- 创建时间 (ISO8601)
  "updated_at"             TEXT NOT NULL,              -- 更新时间 (ISO8601)
  FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE
) STRICT;
```

**设计要点**:
- JSON 字段统一用 `_json` 后缀命名，便于识别序列化字段
- 扩展字段 (visualAnchors/identityBadge/adTeaser/relationshipCode/celebrityMatches) 允许 NULL，兼容不同版本报告
- `compliance_checked` 使用 INTEGER 而非 BOOLEAN (SQLite 无原生布尔类型)
- 所有时间使用 ISO8601 字符串存储，跨语言兼容
- 外键级联删除: 删除用户时自动清理其所有报告

### 3.3 checkin 表

存储每日签到记录。

```sql
CREATE TABLE IF NOT EXISTS "checkin" (
  "id"               INTEGER PRIMARY KEY AUTOINCREMENT, -- 自增ID
  "user_id"          TEXT NOT NULL,                     -- 用户 (FK → user.id)
  "checkin_date"     TEXT NOT NULL,                     -- 签到日期 (YYYY-MM-DD)
  "consecutive_days" INTEGER NOT NULL,                  -- 截止该日的连续签到天数
  "total_days"       INTEGER NOT NULL,                  -- 截止该日的累计签到天数
  "reward"           TEXT,                              -- 该次签到奖励描述 (nullable)
  "created_at"       TEXT NOT NULL,                     -- 签到时间 (ISO8601)
  FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE,
  UNIQUE("user_id", "checkin_date")                     -- 每人每天只能签到一次
) STRICT;
```

**设计要点**:
- `consecutive_days` 和 `total_days` 冗余存储每次的快照值，无需 JOIN 即可获取用户当天状态
- 唯一约束 `(user_id, checkin_date)` 防重复签到
- 签到即隐式创建用户 (SqliteGrowthRepository.ensureUser)
- `reward` 字段记录里程碑奖励，如 "今日金句解锁" / "深度分析体验卡 ×1"

## 4. 索引策略

```sql
CREATE INDEX IF NOT EXISTS "idx_report_user_id"    ON "report"("user_id");
CREATE INDEX IF NOT EXISTS "idx_report_created_at"  ON "report"("created_at");
CREATE INDEX IF NOT EXISTS "idx_checkin_user_id"    ON "checkin"("user_id");
CREATE INDEX IF NOT EXISTS "idx_checkin_date"       ON "checkin"("checkin_date");
CREATE INDEX IF NOT EXISTS "idx_checkin_user_date"  ON "checkin"("user_id", "checkin_date");
```

**索引选择理由**:
| 索引 | 覆盖查询 | 类型 |
|------|---------|------|
| `idx_report_user_id` | `findByUserId` — 按用户查报告列表 | 单列 |
| `idx_report_created_at` | `findAll` — 按时间倒序 | 单列 |
| `idx_checkin_user_id` | `getRecord` — 查用户最新签到 | 单列 |
| `idx_checkin_date` | 后台统计/日活查询 | 单列 |
| `idx_checkin_user_date` | 签到时查今日是否已签 + 查昨天记录 | 联合 (覆盖最频繁查询) |

## 5. 迁移系统

### 版本追踪表

```sql
CREATE TABLE IF NOT EXISTS "_migration" (
  "version"   INTEGER PRIMARY KEY NOT NULL,
  "name"      TEXT NOT NULL,
  "applied_at" TEXT NOT NULL DEFAULT (datetime('now'))
) STRICT;
```

### 迁移注册

迁移注册在 `db/migrate.ts` 中按版本号顺序排列，**永远只追加不删除**:

```ts
const MIGRATIONS: Migration[] = [
  { version: 1, name: 'init_user_report_checkin', sql: [...] },
  // 未来迁移在此追加:
  // { version: 2, name: 'add_tracking_session_table', sql: [...] },
];
```

### 幂等保证

- 每个迁移的 DDL 使用 `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`
- 迁移执行前检查 `_migration` 表中已应用的最大版本号
- 已应用的迁移永不重复执行

### 执行方式

```bash
# 开发环境: 运行迁移+种子
npx tsx src/db/seed.ts

# 仅迁移 (生产环境)
npx tsx src/db/migrate.ts

# 代码中调用
import { migrate, seed } from './db/index.js';
migrate();  // 仅迁移
seed();     // 迁移+种子 (开发环境)
```

## 6. 仓库实现

### 6.1 SqliteReportRepository

实现 `ReportRepository` 接口 (`server/src/repository/report-repository.ts`):

| 方法 | SQL | 说明 |
|------|-----|------|
| `save(report)` | `INSERT OR REPLACE` | 幂等写入 |
| `findById(id)` | `SELECT * WHERE id=?` | 单行查询 |
| `findAll()` | `SELECT * ORDER BY created_at DESC` | 全量倒序 |
| `deleteById(id)` | `DELETE WHERE id=?` | 返回是否删除成功 |
| `findByUserId(id)` | `SELECT * WHERE user_id=?` | 按用户查询 (扩展方法) |
| `setComplianceChecked(id)` | `UPDATE SET compliance_checked=?` | 合规状态 (扩展方法) |
| `setFeedback(id, rating)` | `UPDATE SET feedback_rating=?` | 反馈更新 (扩展方法) |

### 6.2 SqliteGrowthRepository

实现 `GrowthRepository` 接口 (`server/src/services/growth/growth-repository.ts`):

| 方法 | 说明 |
|------|------|
| `checkIn(userId, date)` | 签到 — 检查重复→计算连续性→插入记录 |
| `getRecord(userId)` | 查询最新签到记录 |
| `getUnlockedLines(userId)` | 解析 user.unlocked_lines_json |
| `hasPendingUnlock(userId)` | 7天里程碑且未全部解锁 |
| `claimLine(userId, key)` | 追加解锁线到 JSON 数组 |

**隐式用户创建**: `checkIn` 首次调用时自动在 `user` 表创建行 (`ensureUser`)。

## 7. ER 图

```
┌──────────────────┐       ┌──────────────────────────┐       ┌──────────────────┐
│      user        │       │         report           │       │     checkin      │
├──────────────────┤       ├──────────────────────────┤       ├──────────────────┤
│ id PK            │───╮   │ id PK                    │       │ id PK (AUTOINC)  │
│ nickname         │   ╰──<│ user_id FK → user.id     │       │ user_id FK       │
│ avatar_url       │       │ persona_type             │   ╭──<│ checkin_date     │
│ palm_image_count │       │ persona_label            │   │   │ consecutive_days │
│ unlocked_lines   │       │ scores_json              │   │   │ total_days       │
│ created_at       │       │ summary                  │   │   │ reward           │
│ updated_at       │       │ insights_json            │   │   │ created_at       │
└──────────────────┘       │ keywords_json            │   │   └──────────────────┘
                           │ quote                    │   │
                           │ suspense_text            │   │
                           │ core_truth               │   │
                           │ weekly_advice            │   │
                           │ visual_anchors_json      │   │
                           │ identity_badge           │   │
                           │ ad_teaser                │   │
                           │ relationship_code_json   │   │
                           │ celebrity_matches_json   │   │
                           │ feedback_rating          │   │
                           │ feedback_comment         │   │
                           │ compliance_checked       │   │
                           │ created_at               │   │
                           │ updated_at               │   │
                           └──────────────────────────┘   │
                                                          │
        user 1 ──── * report                              │
        user 1 ──── * checkin ────────────────────────────╯
```

## 8. 数据流

```
小程序端                    Server API                   SQLite
   │                          │                           │
   │ POST /api/analyze        │                           │
   │──────────────────────────▶                           │
   │                          │ AnalysisService           │
   │                          │ → Engine 提取特征          │
   │                          │ → AI Provider 生成报告     │
   │                          │                           │
   │                          │ repo.save(report)         │
   │                          │──────────────────────────▶│
   │                          │                           │ INSERT INTO report
   │                          │                           │
   │ POST /api/checkin        │                           │
   │──────────────────────────▶                           │
   │                          │ growthRepo.checkIn()      │
   │                          │──────────────────────────▶│
   │                          │                           │ ensureUser → INSERT checkin
   │                          │                           │
   │ GET /api/reports/:id     │                           │
   │──────────────────────────▶                           │
   │                          │ repo.findById(id)         │
   │                          │──────────────────────────▶│
   │                          │                           │ SELECT * FROM report
   │                          │◀──────────────────────────│
   │◀─────────────────────────│                           │
```

## 9. 文件结构

```
server/src/db/
├── connection.ts    # 数据库连接单例 (WAL/外键/超时)
├── schema.ts        # DDL + TypeScript 行类型
├── migrate.ts       # 版本化迁移执行器
├── seed.ts          # 开发环境种子数据
└── index.ts         # 统一导出

server/src/repository/
├── report-repository.ts           # ReportRepository 接口 + 内存实现
├── sqlite-report-repository.ts    # SQLite 实现
├── sqlite-growth-repository.ts    # SQLite GrowthRepository 实现

server/scripts/
└── verify-db.ts     # 数据库验证脚本
```

## 10. 后续规划

| 优先级 | 任务 | 说明 |
|--------|------|------|
| P1 | 接入 index.ts 启动流程 | `server/src/index.ts` 启动时自动 migrate |
| P1 | 修改 AnalysisService | 切换 InMemory → SqliteReportRepository |
| P2 | tracking 会话表 | 持久化 `routes/tracking.ts` 的内存会话数据 |
| P2 | match 匹配表 | 持久化匹配邀请和结果 |
| P3 | 备份策略 | 定期备份 `data/palm-persona.db` 文件 |
| P3 | 性能监控 | 慢查询日志，必要时添加覆盖索引 |
