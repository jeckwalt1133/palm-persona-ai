---
name: PageHeartbeat H5 落地实现文档
author: 马富贵 (Senior Engineer, DeepSeek V4 Flash)
taskId: V7-W3-008
targetLevel: L2 研究段 — 落地实现
domain: engineering
basedOn: V7-W3-005 PageHeartbeat 研究 + V7-W3-001 跨学习审查
status: complete
completedAt: 2026-05-06T20:30:00Z
files:
  - server/src/tracking/page-heartbeat.ts (330行)
  - server/src/routes/tracking.ts (110行)
  - server/src/tracking/__tests__/page-heartbeat.test.ts (380行)
dependsOn:
  - server/tsconfig.json (lib 添加 DOM)
  - server/vitest.config.ts (include 添加 __tests__)
  - server/src/index.ts (注册 trackingRoutes)
---

# PageHeartbeat H5 落地实现

## 1. 架构概览

```
┌─────────────────────────────────┐
│  H5 前端 (浏览器)                │
│                                 │
│  PageHeartbeat                  │
│  ├─ RealBrowserHost             │
│  │  ├─ document.visibilitychange│
│  │  ├─ window.pagehide          │
│  │  └─ navigator.sendBeacon     │
│  ├─ 状态机 (idle→active→bg→...  │
│  └─ 心跳定时器 (5s)             │
│            │                    │
│  fetch() / sendBeacon()         │
└────────────┼────────────────────┘
             │
             ▼
┌─────────────────────────────────┐
│  服务端 (Fastify)               │
│                                 │
│  POST /api/tracking/heartbeat   │
│  ├─ 会话聚合 (session_id)       │
│  ├─ 质量标记 (exact/lower_bound) │
│  └─ 内存存储 (MVP)              │
│                                 │
│  GET /api/tracking/sessions     │
│  └─ 仪表盘查询                   │
└─────────────────────────────────┘
```

## 2. 文件清单

| 文件 | 行数 | 说明 |
|------|------|------|
| `server/src/tracking/page-heartbeat.ts` | 330 | 核心类 + BrowserHost 接口 + RealBrowserHost |
| `server/src/routes/tracking.ts` | 110 | POST/GET 端点 |
| `server/src/tracking/__tests__/page-heartbeat.test.ts` | 380 | 24 条测试 |
| `server/src/index.ts` | +2行 | 路由注册 |
| `server/tsconfig.json` | 改1行 | lib 加 DOM |
| `server/vitest.config.ts` | 改1行 | include 加 `__tests__` |

## 3. 核心类 API

### PageHeartbeat

```typescript
const hb = new PageHeartbeat(
  new RealBrowserHost(),           // 浏览器 API 封装
  { intervalMs: 5000,              // 心跳间隔
    endpoint: '/api/tracking/heartbeat',
    container: 'report_copywriting' },
  (event) => console.log(event),   // 可选回调（测试/调试用）
);

hb.init();     // 启动追踪 → 'active'
hb.pause();    // 暂停计时 → 'background' (用户滚动离开文案)
hb.resume();   // 恢复计时 → 'active'   (用户滚动回文案)
hb.flush();    // 发送最终数据 → 'destroyed' (正常离开)
hb.destroy();  // 解绑所有事件 → 'destroyed' (不发送数据)
```

### 状态转换

```
idle ──init()──▶ active ──hide/pause──▶ background
                   ▲                      │
                   └──show/resume─────────┘
                   │
                   ├──flush()──▶ destroyed
                   └──pagehide─▶ destroyed (sendBeacon)
```

## 4. 测试覆盖

24 条测试覆盖 7 个维度：

| 分组 | 测试数 | 关键验证 |
|------|--------|---------|
| 基本生命周期 | 4 | idle/active/destroyed 状态转换 |
| 心跳时序 | 2 | 5s 间隔心跳，累计时间正确 |
| 切后台/回前台 | 4 | 时间冻结、后台区间记录、多次切换 |
| sendBeacon | 4 | flush 发送、pagehide 触发、destroy 不发送 |
| pause/resume | 2 | 滚动离开/回来 |
| 边界情况 | 6 | 重复调用、未init、session_id唯一、container透传 |
| 数据一致性 | 2 | 深拷贝、单调递增 |

## 5. 服务端端点

### POST /api/tracking/heartbeat

```
Body: HeartbeatEvent
Response: 202 Accepted

服务端行为:
  - 新会话 → 创建 SessionSummary
  - 已有会话 → 更新 end_sequence, accumulated_ms
  - state=final → 标记 completed, quality=exact
  - 超时未收到 final → quality=lower_bound
```

### GET /api/tracking/sessions

```
Response:
{
  "total": 10,
  "active": 3,
  "completed": 7,
  "avgDwellMs": 18500,
  "sessions": [...最近20条]
}
```

## 6. 与王富贵 A/B 框架的对接

王富贵框架中定义的埋点事件 → PageHeartbeat 映射：

| A/B 框架埋点 | PageHeartbeat | 说明 |
|-------------|---------------|------|
| `copywriting_view` (曝光) | `hb.init()` | 启动心跳追踪 |
| `copywriting_dwell` (离开) | `hb.flush()` | 发送 final 心跳 |
| `copywriting_scroll_end` | `hb.pause()` | 可选：用户看完后暂停 |
| 用户切后台 | 自动触发 `handleVisibilityChange` | 无需手动调用 |
| 用户回前台 | 自动恢复计时 | 从 `background_intervals` 恢复 |
| 页面关闭/杀进程 | `pagehide` → `sendBeacon` | 下界估计 |

**关键改进**：王富贵框架的 `dwell_time` 改用 `POST /api/tracking/sessions` 的 `accumulated_ms` + `quality` 字段替代简单的 `leave.timestamp - enter.timestamp`。数据分析时：
- `quality=exact` 的数据直接用于主分析
- `quality=lower_bound` 的数据用于稳健性检验

## 7. 待办/限制

- [ ] 服务端会话超时清理（当前内存不回收 >30min 无心跳的会话）
- [ ] 抖音/微信小程序适配器（H5 已实现，小程序端需 Taro.useDidShow 适配）
- [ ] 数据持久化（当前内存存储，MVP 后接 Supabase/ClickHouse）

---

*马富贵 | H5 落地实现 | AI师生研究院 Week 2*
