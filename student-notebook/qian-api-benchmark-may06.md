# 掌心人格局 — API 性能基准报告

> 钱富贵 (P6 后端) | 2026-05-06 | 30样本/端点 | mock模式 (node:sqlite)

## 1. 执行摘要

| 指标 | 值 | 判定 |
|------|-----|------|
| 测试端点 | 28 | 全覆盖 |
| 测试用例 | 38 | 全部通过 |
| SLA p99 < 500ms | 28/28 | ✅ |
| 回归 p99 < 100ms | 5/5 | ✅ |
| 冷启动构建 | 151ms | ✅ |
| 冷启动首请求 | 15ms | ✅ |
| 速率限制绕过 | 120请求0拒绝 | ✅ |
| 总耗时 | 3.44s | — |

## 2. 冷启动性能

```
构建耗时: 151ms (SLA: <2000ms)
首请求:   15ms  (SLA: <500ms, GET /api/health)
状态码:   200
```

应用构建+路由注册+中间件链初始化在 151ms 完成，内存占用极小。

## 3. 全端点 p99 性能排名

按 p99 从高到低排序 (mock模式, 30样本):

| 排名 | 端点 | avg | p50 | p99 | 状态 |
|------|------|-----|-----|-----|------|
| 1 | POST /api/reports/:id/feedback | 0.6ms | 0ms | 7ms | ✅ |
| 2 | GET /api/admin/safety/violations | 0.3ms | 0ms | 4ms | ✅ |
| 3 | GET /api/reports | 1.4ms | 1ms | 3ms | ✅ |
| 4 | POST /api/analyze/upload | 0.7ms | 1ms | 2ms | ✅ |
| 5 | GET /api/health | 0.1ms | 0ms | 1ms | ✅ |
| 6 | GET /api/reports/:id | 0.2ms | 0ms | 1ms | ✅ |
| 7 | DELETE /api/reports/:id | 0.3ms | 0ms | 1ms | ✅ |
| 8 | GET /api/daily-keyword | 0.1ms | 0ms | 1ms | ✅ |
| 9 | POST /api/analyze | 0.4ms | 0ms | 1ms | ✅ |
| 10 | POST /api/match/create | 0.3ms | 0ms | 1ms | ✅ |
| 11 | GET /api/match/:id | 0.2ms | 0ms | 1ms | ✅ |
| 12 | POST /api/match/:id/join | 0.3ms | 0ms | 1ms | ✅ |
| 13 | GET /api/match/:id/result | 0.2ms | 0ms | 1ms | ✅ |
| 14 | POST /api/analytics | 0.3ms | 0ms | 1ms | ✅ |
| 15 | POST /api/tracking/heartbeat | 0.2ms | 0ms | 1ms | ✅ |
| 16 | GET /api/tracking/sessions | 0.1ms | 0ms | 1ms | ✅ |
| 17 | POST /api/checkin | 0.2ms | 0ms | 1ms | ✅ |
| 18 | GET /api/checkin/record | 0.1ms | 0ms | 1ms | ✅ |
| 19 | GET /api/checkin/unlocked-lines | 0.2ms | 0ms | 1ms | ✅ |
| 20 | GET /api/checkin/pending-unlock | 0.1ms | 0ms | 1ms | ✅ |
| 21 | POST /api/checkin/claim-line | 0.3ms | 0ms | 1ms | ✅ |
| 22 | GET /api/compliance/terms | 0.3ms | 0ms | 1ms | ✅ |
| 23 | GET /api/compliance/stats | 0.1ms | 0ms | 1ms | ✅ |
| 24 | POST /api/compliance/check | 0.4ms | 0ms | 1ms | ✅ |
| 25 | POST /api/compliance/audit | 0.3ms | 0ms | 1ms | ✅ |
| 26 | GET /api/admin/safety/trends | 0.4ms | 0ms | 1ms | ✅ |
| 27 | GET /api/admin/safety/stats | 0.2ms | 0ms | 1ms | ✅ |
| 28 | GET /api/admin/escape-room | 0.1ms | 0ms | 1ms | ✅ |
| 29 | POST /api/admin/escape-room | 0.3ms | 0ms | 1ms | ✅ |
| 30 | DELETE /api/admin/escape-room/:term | 0.1ms | 0ms | 1ms | ✅ |

## 4. 性能回归对比 (vs 2026-05-06 审计基线)

| 端点 | 审计基线 p99 | 本次 p99 | 变化 | 阈值 | 状态 |
|------|-------------|---------|------|------|------|
| POST /api/compliance/audit | 82ms | 1ms | -81ms | <100ms | ✅ |
| GET /api/admin/escape-room | 76ms | 1ms | -75ms | <100ms | ✅ |
| POST /api/compliance/check | 73ms | 1ms | -72ms | <100ms | ✅ |
| GET /api/checkin/unlocked-lines | 69ms | 1ms | -68ms | <100ms | ✅ |
| POST /api/match/create | 69ms | 1ms | -68ms | <100ms | ✅ |

> 注意: 审计基线来自30样本真实LLM调用环境，本次在mock内存模式下运行故大幅下降。需在SQLite接入后重跑真实场景。

## 5. 速率限制绕过验证

```
连续 100 GET /api/health:  100 通过, 0 被限流 (429=0)
连续 20 POST /api/analyze: 20 通过, 0 被限流 (429=0)
```

`NODE_ENV=test` 下 `globalLimiter` + `checkDeviceRateLimit` 均正确绕过。

## 6. 关键发现

### 6.1 框架开销极小
- 28个端点的 p99 均在 1-7ms 范围
- Fastify 5 + 中间件链 (userId提取+限流检查+安全头) 的固定开销 < 1ms
- Mock模式下瓶颈不在框架，在业务逻辑

### 6.2 最高开销端点
- `POST /api/reports/:id/feedback` (p99=7ms) — 含JSON解析+内存Map写入
- `GET /api/reports` (p99=3ms) — 全量Map遍历
- `GET /api/admin/safety/violations` (p99=4ms) — 违规日志查询

### 6.3 SQLite接入后的预期影响
当前所有存储为内存Map。SQLite接入后预计：
- 简单查询 (GET by ID): +1-2ms (索引查找)
- 列表查询 (GET /api/reports): +2-5ms (全表扫描)
- 写入 (POST/PUT): +2-5ms (磁盘同步)
- 仍远低于 500ms SLA

### 6.4 下一步
| 优先级 | 任务 | 说明 |
|--------|------|------|
| P0 | SQLite仓库接入真实请求流 | 替换 InMemoryRepository |
| P0 | 真实环境benchmark重跑 | 带node:sqlite的完整基准 |
| P1 | 生产环境网络层benchmark | artillery/k6 真实HTTP压测 |
| P2 | 慢查询监控 | pino日志 + 慢查询阈值告警 |

## 7. 运行方式

```bash
# 默认30样本
npx vitest run test/api-benchmark.test.ts

# 自定义样本数
BENCH_SAMPLES=100 npx vitest run test/api-benchmark.test.ts

# 仅运行特定套件
npx vitest run test/api-benchmark.test.ts -t "冷启动"
npx vitest run test/api-benchmark.test.ts -t "性能回归"
```
