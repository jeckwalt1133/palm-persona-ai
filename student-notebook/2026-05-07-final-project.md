---
name: 第10课 — 综合实战
description: 学期项目展示 / 全链路整合 / 答辩准备
---

# 第10课：综合实战

## 项目全景：掌心人格局

```
┌─────────────────────────────────────────────────────┐
│                  用户（微信/抖音小程序）                │
├─────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────┐│
│  │  Frontend (Taro + React + TypeScript)          ││
│  │  └─ 拍照上传 → PalmFeatureMarker → 6张报告卡片  ││
│  ├─────────────────────────────────────────────────┤│
│  │  Server (Fastify + Zod + TypeScript)           ││
│  │  └─ 分析引擎 → AI Provider(4级降级) → 合规检查  ││
│  ├─────────────────────────────────────────────────┤│
│  │  MCP Server (SDK v1.29.0)                      ││
│  │  ├─ Tools: check_compliance, query_reports     ││
│  │  ├─ Resources: palm://reports, //compliance    ││
│  │  └─ Prompts: analyze_report, draft_caption     ││
│  ├─────────────────────────────────────────────────┤│
│  │  Shared Packages                                ││
│  │  ├─ shared-types (PersonaReport, scores...)     ││
│  │  ├─ shared-utils (concurrency, retry)           ││
│  │  └─ shared-safety (29 禁用词, 检查/替换)         ││
│  └─────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

## 课程知识映射

| 课程 | 在项目中的体现 |
|------|-------------|
| L1 Agent SDK | AI Provider 可插拔架构 + ProviderManager |
| L2 MCP 协议 | palm-mcp-server (3T+5R+3P) |
| L3 多Agent | Orchestrator + 3 Workers (合规/质量/文案) |
| L4 Skill/Hook | `.claude/skills/` 技能定义 + hook 配置 |
| L5 前沿论文 | SWE-bench 分级验证理念 |
| L6 Agent 安全 | 29 项禁用词 + Prompt Injection 检测 |
| L7 生产级 | 4级降级链 + 限流 + 超时熔断 |
| L8 多模态 | 手掌特征提取 → 分析引擎 |
| L9 评估 | 单元测试 + 合规扫描 + 内测评分 |
| L10 综合 | 全链路从拍照到分享 |

## 答辩准备 Q&A

**Q: MCP 为什么选 STDIO 而非 Streamable HTTP？**
A: 掌心人格局是内部工具 + 本地服务，STDIO 零配置、低延迟、不依赖网络。远程部署需求出现后再切 HTTP。

**Q: 为什么不用 CrewAI 自己搭？**
A: 初期团队小、Worker 职责固定，直接函数调用比框架更轻。规模扩大后可迁移到 CrewAI。

**Q: 合规怎么做到的？**
A: 三层检查：① 引擎输出禁用词过滤 ② AI Provider prompt 注入合规指令 ③ 输出后合规桥二次扫描。

**Q: 降级策略怎么验证？**
A: 单元测试 Mock 每个 Provider 的超时/报错，验证降级链正确切换。线上通过日志验证。

## 项目亮点

1. **合规先行**：29 项禁用词 + 替代表达 + 三层检查
2. **截图驱动**：6 张报告卡片 = 6 次主动分享机会
3. **100 条社交货币文案库**：精准匹配 12 种人格类型
4. **4 级 AI 降级链**：任何 Provider 不可用都不影响用户体验
5. **完全 typescript**：端到端类型安全
