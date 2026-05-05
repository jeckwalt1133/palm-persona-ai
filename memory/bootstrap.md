---
name: Bootstrap — 会话快速启动
description: 团队身份+当前进度+恢复指令+关键文件索引。唯一存储路径D盘。
type: project
updated: 2026-05-05 12:42 (今日~10/12学习小时)
---

## 团队：富贵军团
聂富贵(老师/Tech Lead) | 马富贵(学生/Senior Eng) | 王富贵(文案/豆包) | 周富贵(质量/千问)

## 毕业体系：5段×3阶 产出矩阵 (v2.0)

```
L1 基础段 1.1→1.2→1.3  ✅ 全部完成
L2 研究段 2.1→2.2→2.3  ✅ 2.1(综述) | ~2.2(实验50%) | 2.3锁定
L3 产品段 3.1→3.2→3.3  ✅ 3.1(公网) | 3.2锁定
L4 开源段 4.1→4.2→4.3  ✅ 4.1(MCP) | 4.2锁定
L5 商业段 5.1→5.2→5.3  锁定
L0 教学暗线 0.1→0.2→0.3  ~0.1(材料包) | 0.2锁定
```

## 今日交付（2026-05-05）

| 时间 | 等级 | 交付物 | 大小 |
|------|------|--------|------|
| 12:10 | 系统 | 58级→15级重构 | graduation-ladder.json v2.0 |
| 12:25 | L2.1 | 10篇论文批判综述 | 18506字节/7000字/12篇参考文献 |
| 12:31 | L3.1 | H5公网部署 | bore.pub:63959 (HTTP 200) |
| 12:37 | L4.1 | palm-mcp-server开源 | 221行/3T+3R+3P/MIT许可 |
| 12:40 | L2.2 | 对抗测试实验 | 21样本/10攻击向量/漏检率90% |
| 12:41 | L0.1 | 教学材料包 | 10课索引+8周路径+考试模板 |

### 新增/更新文件（12个）
```
curriculum/graduation-ladder.json (v2.0 15级)
curriculum/syllabus.md (更新等级引用)
curriculum/teaching-track-l0.md (教学材料包)
learning/agent-research-survey-2026.md (论文综述)
learning/experiments-compliance-adversarial.md (对抗实验)
mcp-servers/palm-mcp-server/src/index.ts (MCP Server)
mcp-servers/palm-mcp-server/package.json
mcp-servers/palm-mcp-server/tsconfig.json
mcp-servers/palm-mcp-server/README.md
memory/bootstrap.md (持续更新)
memory/decisions.md (8条决策/进度记录)
grades/report-card.json (更新等级)
```

### 验证状态
- `pnpm typecheck`: ✅ 0 errors
- `pnpm test`: ✅ 87 passed (81 server + 6 miniapp)
- H5公网: ✅ bore.pub:63959
- 代码行数: ~1500行新增文档/代码

## 恢复指令
1. 读 `CLAUDE.md` → `memory/bootstrap.md`
2. `git log --oneline -3 && pnpm run typecheck`
3. 当前状态：L1全完成 | L2.1+L3.1+L4.1完成 | L2.2+L0.1进行中
4. 下一目标：L2.2实验完全可运行(vitest test) + L5.1微信支付接入

## 记忆铁律
- 唯一路径：`/mnt/d/Claude/Workspace/palm-persona-ai/memory/`
- 禁区：`/home/fugui/`, `/root/`, `/tmp/`
- 所有决策：`memory/decisions.md`

## 公网地址
- H5: http://bore.pub:63959
- 本地: http://localhost:3002
