---
name: 第8课复习 — 多模态Agent
description: 视觉/文本/工具三模态融合，MCP Tools 作为行动层
type: review
grade: L8
---

# L8 多模态Agent — 视觉/文本/工具融合

> 学生：马富贵 | 日期：2026-05-05 | 类型：500字复习

---

## 一、多模态 Agent 的核心命题

传统 Agent 只能处理文本，但真实世界的输入是多样的——图片、语音、结构化数据。多模态 Agent 要解决的核心问题是：**如何在统一的推理框架中融合不同模态的信息，并据此做出决策和行动**。

## 二、三种融合模式

| 模式 | 做法 | 优点 | 缺点 |
|------|------|------|------|
| Early Fusion | 输入端合并多模态数据，一次性送入模型 | 信息损失小 | 计算量大，模态对齐难 |
| Late Fusion | 各模态独立处理，决策层合并 | 灵活，可独立优化 | 丢失跨模态关联 |
| Hybrid | 部分早期融合+部分后期融合 | 平衡性能与灵活 | 架构复杂 |

选型原则：模态间强关联（如"这张图的哪个部分是红色的？"）→ Early Fusion；模态间弱关联（如"分析手掌特征+生成性格文案"）→ Late Fusion。

## 三、Tool-use 作为行动层

MCP Tools 补足了 LLM 的短板——LLM 只能生成文本，Tools 让它能**做事**：

```
Agent 思考 → decideTool() → callTool() → 结果回传 → 继续推理
              ↑ 模型选择哪个工具    ↑ MCP Server 执行
```

Tool-use 的生命周期：**发现**（list tools）→ **选择**（model decides which）→ **调用**（client invokes）→ **回注**（result injected into context）。这是多模态 Agent 的"手"，没有它 Agent 只是聊天机器人。

## 四、掌心人格局的多模态实践

我们的链路是典型的 Late Fusion：

```
用户上传手掌照片（视觉）
  → imageCompress 前端压缩
  → PalmFeatureMarker 15+ 维度特征提取（非 LLM Vision）
  → 特征向量 → 分析引擎（LLM 文本推理）
  → ReportAgent 5 Worker 并行生成报告（工具调用）
  → Canvas 前端合成分享海报（视觉输出）
```

关键洞察：**视觉在这里走的是传统 CV 管线（特征提取），而非 AI Vision API**。因为手掌几何特征（掌长比、指长比、纹路密度）是结构化计算问题，不需要大模型看图。LLM 的舞台在**从特征到人格叙事的语义跃迁**。

## 五、考点清单

| 考点 | 我的答案 |
|------|---------|
| 三种融合模式 | Early / Late / Hybrid |
| Tool-use 生命周期 | 发现→选择→调用→回注 |
| MCP Tools 定位 | 多模态 Agent 的行动层 |
| 掌心人格局融合模式 | Late Fusion（CV提取+LLM叙事） |
| 为什么不用 AI Vision | 几何特征是结构计算，不需要大模型 |
