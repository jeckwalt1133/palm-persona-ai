# 全网研究资讯爬取 — AI师生研究院

## 触发条件
当老师（聂富贵）或学生（马富贵）需要获取最新 AI/ML 研究、行业动态、
论文解读时，使用本 skill 进行全网爬取和整理。

触发短语：
- "查一下最新..."
- "最近有什么新论文"
- "搜一下...领域的最新进展"
- "给马富贵更新课程资料"
- "全网搜索..."

## 搜索源优先级

| 优先级 | 来源 | 用途 | 工具 |
|--------|------|------|------|
| P0 | arXiv | 最新论文 | WebFetch arxiv.org |
| P0 | Hacker News | 行业趋势 | WebFetch news.ycombinator.com |
| P1 | GitHub Trending | 开源项目 | gh CLI / WebFetch |
| P1 | AI Conference (NeurIPS/ICML/ICLR) | 顶会论文 | WebFetch |
| P2 | 公众号/知乎 | 中文解读 | WebSearch |
| P2 | Twitter/X (AI researchers) | 实时动态 | WebSearch |

## 每次搜索的标准流程

### 1. 确定搜索范围
- 时间：默认最近 7 天，可指定更长
- 领域：根据当前课程/任务确定关键词
- 深度：浅搜（3-5篇标题摘要）、深搜（10+篇全文解读）

### 2. 执行搜索

按以下顺序：

```
# arXiv 搜索
WebFetch: https://arxiv.org/search/?searchtype=all&query={关键词}&start=0

# Hacker News
WebFetch: https://hn.algolia.com/api/v1/search?query={关键词}&tags=story&hitsPerPage=10

# 中文解读
WebSearch: {关键词} 最新进展 2026
```

### 3. 结构化输出

所有搜索结果整理为以下格式，写入 `research/` 目录：

```markdown
# 全网扫描报告 — {日期}

## 扫描范围
- 关键词: ...
- 时间: ...
- 来源: ...

## 发现 (按重要性排序)

### [P0] 标题
- 来源: arXiv / HN / 顶会
- 链接: https://...
- 一句话: ...
- 与研究院关联: 对马富贵课程X有帮助 / 影响方法论Y / 可能改变工程Z
- 建议行动: ...

## 马富贵本周必读
1. ...
2. ...
3. ...

## 方法论影响评估
- 是否有需要更新 PROTOCOL.md 的新发现？
- 是否有新的最佳实践需要纳入课程？
```

## 集成到课程体系

搜索完成后，根据内容自动分流：

| 内容类型 | 写入位置 | 触发条件 |
|---------|---------|---------|
| 新方法/范式 | `curriculum/guest-modules/` | 发现可教学方法论 |
| 安全漏洞/补丁 | `curriculum/guest-modules/zhou-security-*.md` | 影响安全基线 |
| 工具/框架更新 | `memory/decisions.md` | 影响技术选型 |
| 学术突破 | `research/` | 需要深度解读 |
| 工程最佳实践 | `curriculum/task-pool.json` | 可转化为新任务 |

## 输出要求
1. 每次搜索必须产出结构化报告（写入文件，不只是对话里说）
2. 报告中必须包含"马富贵本周必读"
3. 评估对方法论的影响
4. 如果有需要立即行动的发现（安全漏洞等），在报告顶部标记 [ACTION REQUIRED]

## 速率限制
- 每 4 小时最多 1 次深度搜索（避免 API 费用）
- 浅搜索无限制
- arXiv 搜索间隔不少于 30 分钟

## 示例

用户: "查一下 Agent 记忆系统的最新进展"

输出文件: `research/agent-memory-scan-2026-05-06.md`
包含:
- arXiv 最新 5 篇 Agent Memory 论文的摘要和解读
- Hacker News 最近讨论的记忆相关工具
- 对马富贵 V7-002 记忆系统设计的补充建议
- 对方法论"三层记忆"的更新建议
