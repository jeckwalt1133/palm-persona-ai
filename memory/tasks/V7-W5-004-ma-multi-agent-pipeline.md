# V7-W5-004: Multi-Agent产品管线 — 从单线程到并行Agent协作

**分配给**: 马富贵 (Senior Engineer, DeepSeek V4 Flash)
**优先级**: P0
**前序依赖**: V7-W5-001 (Agent协议产品化)
**预计产出等级**: L3 实现段 → L4 创新段

## 背景

agent-router协议和广播系统已经产品化。现在进入"超过去"阶段——不只是工具层面用起来，而是让掌心人格局产品本身变成多Agent协作系统。

当前产品分析管线是单线程的: 上传照片 → AI分析 → 生成报告 → 返回前端。耗时约8-15秒。

## 任务目标

设计并实现多Agent并行分析管线，将当前单线程管线改为4个Agent并行协作。

### Phase 1: 管线重构设计

当前管线:
```
上传 → 分析Agent → 文案Agent → 安全Agent → 海报Agent → 返回
        8-15s (串行)
```

目标管线:
```
上传 → Orchestrator
         ├→ 分析Agent ──┐
         ├→ 文案Agent ──┤
         ├→ 安全Agent ──┼→ 结果聚合 → 海报Agent → 返回
         └→ [并行执行] ─┘    预计3-6s
```

设计要点:
1. 分析Agent和文案Agent可以并行（文案用上次结果预生成，等分析完成后微调）
2. 安全Agent始终并行（不依赖分析结果，只检查输入+输出）
3. 海报Agent等待聚合结果后执行
4. 如果分析Agent返回异常，文案Agent用fallback通用文案

### Phase 2: 实现

1. 创建 `server/src/agent/pipeline-orchestrator.ts` — 管线编排器
2. 将现有分析逻辑拆分为独立Agent模块:
   - `server/src/agent/analyst-agent.ts` — 人格分析
   - `server/src/agent/copywriter-agent.ts` — 文案生成
   - `server/src/agent/safety-agent.ts` — 合规检查
3. 用Promise.all并行调度（不引入额外依赖）
4. 测量: 并行vs串行延迟对比

### Phase 3: 验证

5. 端到端测试: 上传照片 → 并行分析 → 报告生成
6. 对比串行基线: 延迟降低百分比
7. 故障注入: 一个Agent超时→其他Agent是否完成→聚合是否降级

## 验收标准
- [ ] 管线从串行改为并行，至少3个Agent同时运行
- [ ] 延迟降低 ≥ 30%（在相同AI调用条件下）
- [ ] 单Agent失败不影响其他Agent（降级而非崩溃）
- [ ] TypeScript编译通过
- [ ] 现有报告质量不低于串行版本

## 输出
- server/src/agent/pipeline-orchestrator.ts
- server/src/agent/analyst-agent.ts
- server/src/agent/copywriter-agent.ts  
- server/src/agent/safety-agent.ts (增强现有)
- student-notebook/ma-multi-agent-pipeline.md (实施报告)

## 超过去锚点
- Google A2A: Task-based parallel agent orchestration
- Anthropic MCP: Tool-use parallelism pattern
- 你的富贵协议v1: 本地Agent间TaskCard协调
