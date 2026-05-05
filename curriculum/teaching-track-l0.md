# L0 教学暗线 — 助教材料包

> 等级: 0.1 助教 | 状态: 进行中
> 目标: 带1个学徒完成L1基础段（5门课）
> 教学是最有效的学习

---

## 一、10课教学材料索引

| 课 | 笔记本 | 代码交付 | 可复用性 |
|----|--------|---------|---------|
| L1 Agent SDK | student-notebook/2026-05-05-agent-sdk.md | — | ★★★ 概念框架 |
| L2 MCP协议 | student-notebook/2026-05-05-mcp-protocol.md | palm-mcp-server | ★★★★★ 开源项目 |
| L3 多Agent | student-notebook/2026-05-06-multi-agent-architecture.md | multi-agent-prototype-v2.ts | ★★★★ 架构模式 |
| L4 Skill/Hook | student-notebook/2026-05-06-skill-hook-system.md | review-report skill | ★★★★ 实战模板 |
| L5 论文精读 | student-notebook/2026-05-07-frontier-papers.md | — | ★★★ 方法论 |
| L6 安全合规 | student-notebook/2026-05-07-agent-security.md | agent-security-guard.ts | ★★★★★ 必备技能 |
| L7 自主进化 | student-notebook/2026-05-07-agent-evaluation.md | autonomous-agent.ts | ★★★★ 进阶 |
| L8 工具对比 | student-notebook/2026-05-10-tool-comparison.md | — | ★★★ 选型参考 |
| L9 项目实战 | — | compliance-gate.ts | ★★★★ 实战 |
| L10 毕业设计 | student-notebook/2026-05-07-final-project.md | report-agent.ts + pipeline | ★★★★★ 综合 |

## 二、期中/期末 答题模板

### 期中考试模板（3部分×各30-35分）
1. 理论题模板：画决策树 + 对比表格 + 咬定选择理由
2. 实践题模板：先搭骨架再填逻辑 + 验证编译 + 注意import链路
3. 批判题模板：有观点+有数据+有局限性分析+有改进建议

**参考文件**：
- `student-notebook/exam-cheatsheet.md` — 3页速查手册
- `student-notebook/exam-prep-mcp-memory-dump.ts` — MCP Server默写
- `student-notebook/exam-practice-critique.md` — 批判题练习

### 期末考试模板
- `student-notebook/2026-05-07-final-exam.md` — 完整答题+评分

## 三、学徒学习路径

### 第1-5课：基础期（目标：期中B+）
```
Week 1: L1+L2 (Agent SDK + MCP) → 交付：1个MCP Server
Week 2: L3+L4 (Multi-Agent + Skill) → 交付：1个Skill+架构设计
Week 3: L5 (论文精读) → 交付：3篇论文批判综述
Week 4: 期中复习+考试
```

### 第6-10课：进阶期（目标：期末A-）
```
Week 5: L6+L7 (安全+进化) → 交付：安全守卫+自主Agent
Week 6: L8+L9 (工具+实战) → 交付：项目模块
Week 7: L10 (毕业设计) → 交付：Agent管线+测试
Week 8: 期末复习+答辩
```

## 四、关键注意事项（传给学生）

1. **import链路纪律**：MCP Server桥接数据必须从项目包import，不能硬编码！
2. **验证先行**：代码写完跑typecheck+test，不靠嘴说"应该能跑"
3. **笔记本铁律**：每课必须有不低于200行的笔记
4. **代码交付**：不能只有设计文档，必须有可运行代码
5. **合规红线**：27项禁用词记牢，替代表达形成肌肉记忆

## 五、评分参考

| 等级 | 特征 | 如何达到 |
|------|------|---------|
| A+ | 超越预期，有独立创新 | 在作业要求之外主动加实验/分析 |
| A | 完整正确，工程质量高 | 代码+测试+文档齐全，0 type error |
| B | 基本达标，有改进空间 | 核心功能完成，但缺测试或文档 |
| C | 勉强完成，多处不足 | 功能不完整或有明显bug |

---

*L0.1 助教材料包 | 待验证：找一个真实学徒测试此路径*
