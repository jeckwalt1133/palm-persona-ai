# 第2课：MCP 协议最新进展（2026）

> 学生：Claude Code Student | 日期：2026-05-05 | 状态：✅ 完成

---

## 一、MCP 协议概述

**MCP (Model Context Protocol)** 是 Anthropic 于 2024 年 11 月推出的开源协议，旨在为 LLM 应用提供标准化的上下文数据接入方式。类比 USB-C 为外设提供的统一接口标准，MCP 为 AI 应用与数据源之间定义了统一的通信协议。

### 核心价值
- **标准化**：一套协议接入所有数据源，替代碎片化的自定义集成
- **双向性**：LLM 既能读取数据（Resources），也能触发操作（Tools）
- **可发现**：Server 声明能力，Client 自动发现，LLM 按需选择

---

## 二、2025-2026 关键更新

### 2.1 传输层 (Transport Layer)

| 传输方式 | 状态 | 适用场景 |
|----------|------|----------|
| **STDIO** | 稳定 | 本地开发、Claude Desktop 集成、CLI 工具 |
| **Streamable HTTP** | 新增 (2025) | 远程部署、Web 服务、多 Client 同时连接 |

**STDIO** 通过标准输入/输出在父子进程间通信，适合本地工具链集成。

**Streamable HTTP**（2025 年引入）取代了早期的 SSE-only HTTP 传输，支持：
- 一次性请求-响应（非流式）
- 流式响应（SSE）
- 服务端主动推送

**MCP 2026 新趋势**：
- Inspector 工具的完善，支持可视化调试
- 更完善的 OAuth 2.0 远程认证支持
- Transport 层可插拔架构

### 2.2 传输协议格式

底层使用 **JSON-RPC 2.0**：
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "check_compliance",
    "arguments": { "text": "测试文案" }
  }
}
```

#### 方法分类

| 方向 | 方法 | 描述 |
|------|------|------|
| 生命周期 | `initialize` / `initialized` | 建立会话上下文 |
| 工具 | `tools/list` / `tools/call` | 列出/调用工具 |
| 资源 | `resources/list` / `resources/read` | 列出/读取资源 |
| 提示 | `prompts/list` / `prompts/get` | 列出/获取提示模板 |
| 通知 | `notifications/*` | 服务端状态变更通知 |
| 日志 | `logging/*` | 日志级别设置与输出 |

### 2.3 三大原语 (Primitives)

#### Tools（工具）
- LLM 可以调用的函数，由 Server 实现
- 执行具体操作：数据查询、文本处理、外部 API 调用
- **2026 更新**：更严格的 Input Schema 校验、Tool 版本管理

#### Resources（资源）
- 结构化数据暴露，由 LLM 按 URI 读取
- 类似 RESTful API 的资源模型，但通过 MCP 协议统一访问
- **2026 更新**：支持分页（cursor-based pagination）、订阅更新（资源变更通知）

#### Prompts（提示模板）
- 预定义的 Prompt 模板，带参数和动态内容
- 引导 LLM 按特定模式工作
- **2026 更新**：支持多消息模板、动态参数注入

### 2.4 Capabilities 声明

Server 在初始化阶段声明能力：
```typescript
const server = new Server(info, {
  capabilities: {
    tools: {},
    resources: {},
    prompts: {},
    // 可选：
    // logging: {},
    // experimental: { streamableHttp: true }
  },
});
```

---

## 三、架构设计

### 3.1 分层架构

```
┌──────────────────────────────┐
│          LLM Host            │  (Claude Desktop / CLI / Web)
├──────────────────────────────┤
│      MCP Client (SDK)        │  (@modelcontextprotocol/sdk)
├──────────────────────────────┤
│   ═══ MCP 协议 (JSON-RPC 2.0) ═══  │
├──────────────────────────────┤
│      MCP Server (SDK)        │  (自定义业务逻辑)
├──────────────────────────────┤
│       Data Bridge            │  (合规词库 / 报告数据 / DB)
└──────────────────────────────┘
```

### 3.2 通信流程

```
Client                    Server
  │                         │
  │── initialize ──────────→│  握手协商能力
  │←─ initialized ──────────│
  │                         │
  │── tools/list ──────────→│  发现可用工具
  │←─ [Tool[], ...] ────────│
  │                         │
  │── tools/call(compliance)→│  调用合规检查
  │←─ { violations: [] } ───│
  │                         │
  │── resources/read(uri)──→│  读取资源
  │←─ { contents: [...] } ──│
  │                         │
  │── prompts/list ────────→│  发现提示模板
  │←─ [Prompt[], ...] ──────│
```

### 3.3 事件生命周期

1. **初始化阶段**：Client → `initialize` → Server 回应支持的能力 → `initialized`
2. **发现阶段**：Client 调用 `xxx/list` 发现可用的 Tools/Resources/Prompts
3. **使用阶段**：LLM 根据需求选择合适的原语进行调用
4. **通知阶段**（可选）：Server → `notifications/*` 主动推送状态更新

---

## 四、与本项目的集成

### 4.1 掌心人格局 MCP Server 架构

```
palm-mcp-server/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts              # 主入口: Server + 3 Tools + 5 Resources + 3 Prompts
    ├── compliance-bridge.ts   # 合规词库桥接 (← packages/shared-safety)
    └── report-bridge.ts       # 报告数据桥接 (← server/src/engine/types)
```

### 4.2 数据流

```
LLM Model
  │
  ├── Tool: check_compliance()  → compliance-bridge.FORBIDDEN_TERMS (25项)
  ├── Tool: query_reports()     → report-bridge.DEMO_REPORTS (2份示范报告)
  ├── Tool: get_report_stats()  → report-bridge.getReportStats()
  │
  ├── Resource: palm://compliance/terms  → FORBIDDEN_TERMS 完整列表
  ├── Resource: palm://compliance/stats  → 分类统计
  ├── Resource: palm://reports/list      → 报告概览
  ├── Resource: palm://reports/demo-001  → 思虑守护者报告
  ├── Resource: palm://reports/demo-002  → 自由探索者报告
  │
  └── Prompt: analyze_report(report_id, platform)    → 平台适配分析
      Prompt: draft_caption(persona_label, style)     → 社交货币文案
      Prompt: check_report_safety(text)               → 安全审查
```

### 4.3 为什么这样设计

| 设计决策 | 理由 |
|----------|------|
| Tools 用于执行操作 | 合规检查是"动作"，需要参数输入+结果输出，适合 Tool |
| Resources 用于数据暴露 | 禁用词列表和数据报告是"静态结构化数据"，适合 Resource |
| Prompts 用于模式引导 | 报告分析是"特定工作模式"，需要多步引导，适合 Prompt |
| STDIO 作为默认传输 | 本地开发调试方便，与 Claude Desktop 集成 |
| Streamable HTTP 可选 | 部署到远程服务器时启用，支持 HTTP 客户端访问 |

---

## 五、SDK 对比与选择

| SDK | 语言 | 成熟度 | 适用场景 |
|-----|------|--------|----------|
| `@modelcontextprotocol/sdk` | TypeScript | 官方稳定 | 通用 MCP Server 开发 |
| `mcp-python-sdk` | Python | 官方维护 | Python 项目集成 |
| `mcp-golang-sdk` | Go | 社区 | 高性能服务 |
| `mcp-rust-sdk` | Rust | 社区 | 嵌入式/边缘场景 |

---

## 六、关键争议与局限

1. **协议耦合**：MCP 强绑定 JSON-RPC，对非 JS 生态不够友好
2. **传输层选择**：STDIO 不适合分布式场景，Streamable HTTP 还在演进中
3. **无服务端主动推送标准**：当前通知机制有限，不适合实时数据场景
4. **与 OpenAI Function Calling 的竞争**：MCP 是开放协议但由 Anthropic 主导，存在厂商锁定风险
5. **生态成熟度**：2026 年 5 月仍处于早期阶段，生产级部署方案（SSO/RBAC/审计）尚不完善

---

## 七、参考资源

- [MCP 官方文档](https://modelcontextprotocol.io/)
- [MCP SDK (TypeScript)](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP 协议规范](https://spec.modelcontextprotocol.io/)
- [MCP Inspector 调试工具](https://github.com/modelcontextprotocol/inspector)

---

## 八、交付物清单

- [x] `student-notebook/2026-05-05-mcp-protocol.md` — 本笔记
- [x] `mcp-servers/palm-mcp-server/src/index.ts` — MCP Server 入口
- [x] `mcp-servers/palm-mcp-server/src/compliance-bridge.ts` — 合规词库桥接
- [x] `mcp-servers/palm-mcp-server/src/report-bridge.ts` — 报告数据桥接
- [x] `mcp-servers/palm-mcp-server/package.json` — 依赖声明
- [x] `mcp-servers/palm-mcp-server/tsconfig.json` — TypeScript 配置

---

*本节学习时长：20 分钟 | 传输层覆盖：STDIO + Streamable HTTP | 原语覆盖：Tools/Resources/Prompts*
