# 记忆系统研究进度 — V7-002

**研究者**: 马富贵 | **课题**: V7-002 记忆系统与上下文自动化
**开始**: 2026-05-06 | **状态**: ✅ 已完成

---

## Hour 0: 初始状态 (2026-05-06 启动)

### 已完成
- ✅ 通读 Task Prompt V7-002
- ✅ 通读 PROTOCOL.md 三层记忆定义
- ✅ 全量审计 memory/ 目录（16个文件）
- ✅ 检查 .claude/settings.json hooks 配置
- ✅ 审计 Claude 全局 settings.json（发现硬编码 Key 仍在）
- ✅ 审计 memory-toolkit 插件能力（已安装但 hooks 未接线）
- ✅ 对比项目 memory/ 与 Claude auto-memory/（发现部分重复）
- ✅ 审计 sessions/ sessions.jsonl workstreams/handoff.md

### 关键发现
1. **PreCompact hook 缺失**：只有 Stop hook（snapview），无 PreCompact/SessionStart hooks
2. **handoff.md 极薄**：仅保存 session ID + branch + last commit + uncommitted count，无任务状态
3. **双轨记忆**：项目 memory/ (D盘 14文件) vs Claude auto-memory/ (Linux home 8文件子集)
4. **API Key 仍在全局 settings.json 中硬编码**（第3行，已轮换，仅保留占位引用）— V7 Day 1 修复漏了这里
5. **memory-toolkit 已安装但 hooks 层未接线**：有 SessionStart/PreCompact/PostToolUse hook 定义但 settings.json 未配置
6. **团队记忆完全断裂**：学生/客座无法读取主会话最新状态

---

## Hour 1: 完成全部调研+设计文档

### 调研完成清单
- memory/ 全部16个文件：全部审计
- .claude/settings.local.json：审计 hooks（只有 PostToolUse echo）
- /home/fugui/.claude/settings.json：审计全局配置 + 发现硬编码 API Key ⚠️
- memory-toolkit 插件 ARCHITECTURE.md + PHILOSOPHY.md：完整理解
- PROTOCOL.md 三层记忆定义：理论框架
- scripts/student-watchdog.sh：验证使用 .env（已修复 ✅）
- scripts/evidence-auto-verify.sh：验证存在（Day 1 产出 ✅）
- tmux 会话状态：claude-student 存活但闲置12h+

### 交付物
**✅ research/memory-automation-design.md** — 完整设计方案

内容结构:
1. **问题分析**: 5个具体断点（PreCompact太薄/SessionStart人工/团队记忆隔离/任务流转手工/记忆增长无管理）
2. **设计方案**: 
   - 总体架构图（Hook层→存储层→角色层）
   - team-status.json 完整 JSON Schema（8个section, 60+字段定义）
   - 压缩时必须保存 vs 可从文件恢复的分类表
   - PreCompact hook 脚本设计（<3秒约束）
   - SessionStart hook 恢复流程（<30秒约束）
   - 团队4角色共享记忆目录结构
   - 任务流转5状态状态机（pending→assigned→in_progress→reviewing→done/rework）
3. **实现路径**: 3个Phase
   - Phase 1: 手动快照（当前会话可用）
   - Phase 2: Hook自动化 + 任务流转
   - Phase 3: 完全自动化 + 记忆健康检查
4. **文件清单**: 13个新建 + 4个修改

### 验收标准自查
- [x] 明确列出"必须保存"和"可从文件恢复"两类信息（Section 2.3 分类表）
- [x] 定义≥3个快照字段的JSON Schema（team-status.json 含8个section, 60+字段）
- [x] 设计PreCompact hook脚本（Section 2.4 + settings.json配置）
- [x] 设计SessionStart hook恢复流程（Section 2.5 + 恢复prompt示例）
- [x] 团队4角色共享记忆结构（Section 2.6 完整目录树）
- [x] 任务流转协议覆盖≥3状态（Section 2.7 状态机覆盖5个状态）
- [x] 实现路径分3个Phase，Phase 1在当前会话可执行

### 额外发现（超出课题范围）
⚠️ **API Key 仍在全局 settings.json 硬编码**: `/home/fugui/.claude/settings.json` 第3行
```
"ANTHROPIC_API_KEY": "sk-<已轮换的红线密钥>"
```
V7 Day 1 P0#1（API Key轮换）只修复了 watchdog，漏了全局 config。这是安全事故遗留。

---

## 总结

设计方案的核心理念：**快照只保存"对话中涌现的临时状态"，不保存"可从文件重新计算的信息"**。通过复用 memory-toolkit 的 hook 框架 + 自定义快照格式（team-status.json），可以在不引入外部依赖的前提下，实现从手动到自动的团队记忆系统。

---

## Phase 2: 知识图谱+记忆检索 (2026-05-06 完成)

### 交付物

**1. memory/knowledge-graph.json** — Layer 3 语义知识图谱
- 26节点（验收要求≥15）| 32条边（要求≥20）| 5种关系类型
- 节点覆盖6个领域：memory(9) / methodology(9) / engineering(4) / product(2) / security(1) / architecture(1)
- 节点类型：concept(概念) / capability(能力) / decision(决策)
- 关系类型：supports(24) / precedes(3) / depends_on(3) / governs(1) / derives_from(1)
- 设计决策 D013：从课件内容重构为项目知识域——覆盖概念/方法论/决策/产品四层

**2. scripts/memory-search.sh + memory-search.py** — 记忆检索工具
- memory-search.sh (9行): Bash入口，调用Python3实现
- memory-search.py (145行): 多源检索引擎
  - 搜索源：knowledge-graph.json节点 + decisions.md + capability-inventory.json
  - 支持 --domain 筛选（如 --domain memory）
  - 支持 --since 时间筛选（如 --since 2026-05-01）
  - 输出≤20行（不溢出上下文窗口）
  - 验证通过：`bash scripts/memory-search.sh '安全'` → 返回相关节点+边+决策+能力

**3. team-status.json** — knowledgeGraph统计字段更新
- 节点数/边数/关系类型/领域/更新时间/更新者 全部就位

### 验收标准自查
- [x] knowledge-graph.json ≥15节点+20边，每条边标注关系类型 → 26N/32E/5种关系
- [x] memory-search.sh 可运行 → 验证通过（安全/记忆/协议三个关键词测试）
- [x] 搜索支持2种筛选：--domain和--since → 均验证通过
- [x] 搜索结果≤20行(不溢出上下文窗口) → 每次输出10-15行
- [x] 更新 team-status.json 的 layer3 统计 → knowledgeGraph字段完整
- [x] 独立完成，不依赖老师写代码 → ✅

### 关键设计决策
- **D013**: 知识图谱从课件内容重构为项目知识域——原graph只有AI课件概念(15节点11边)，与项目记忆系统需求不匹配。重构后以三层记忆架构+PROTOCOL规则+决策链+工程概念为核心
- 选择Python3而非纯Bash实现搜索：Bash处理JSON解析需jq依赖，Python3标准库json模块零依赖且更可维护
- 边结构采用 from/to/relation/label 四字段而非 source/target：与D3.js力导向图格式兼容
