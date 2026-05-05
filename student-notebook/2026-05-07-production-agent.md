---
name: 第7课 — 生产级 Agent
description: 监控/日志/可观测性/健康检查/优雅降级
---

# 第7课：生产级 Agent

## 可观测性三大支柱

### 1. 日志（Logging）

```
级别: DEBUG < INFO < WARN < ERROR < FATAL
格式: JSON 结构化（方便日志系统索引）
必含: timestamp, level, agentId, sessionId, message
```

### 2. 指标（Metrics）

| 指标 | 类型 | 含义 |
|------|------|------|
| request_count | Counter | 请求总量 |
| request_duration | Histogram | 请求耗时分布 |
| tool_call_count | Counter | 工具调用次数 |
| tool_error_rate | Gauge | 工具错误率 |
| active_sessions | Gauge | 当前活跃会话 |
| token_usage | Counter | Token 消耗 |

### 3. 链路追踪（Tracing）

```
请求 → Orchestrator → Worker1 → Tool1 → Worker2 → 响应
        ├─ span: 8ms    ├─ span: 3ms  ├─ span: 4ms
        └─ trace ID: abc123
```

## 健康检查

- `/health` — 返回存活状态
- `/ready` — 依赖是否就绪（DB / AI Provider / MCP Server）
- 启动检查：先 readiness 通过后再接受流量

## 优雅降级

| 故障场景 | 降级策略 |
|---------|---------|
| AI Provider 超时 | 切换到备用模型（Claude → 豆包 → 通义 → Mock） |
| MCP Server 断开 | 缓存上次结果 + 标记过时 |
| 数据库不可用 | 只读模式 + 队列写入 |
| 限流触发 | 返回 429 + Retry-After header |

## 掌心人格局的降级链

```
Claude API ─┬→ 超时(3s) → 豆包API ─┬→ 超时(5s) → 通义API ─┬→ 超时(5s) → Mock
             熔断(连错3次)            熔断(连错3次)            熔断(连错3次)
```

实现了 `server/src/providers/index.ts` 中的轮询降级 + 超时熔断。

## 错误处理模式

```
try {
  result = await aiProvider.generate(prompt);
} catch (err) {
  if (isRateLimit(err)) { await backoff(); retry(); }
  else if (isTimeout(err)) { switchProvider(); retry(); }
  else { logError(err); return fallback(); }
}
```

## 考点
- 可观测性三大支柱
- 健康检查的两类端点
- 降级策略的选择原则
- 熔断 vs 超时重试的区别
