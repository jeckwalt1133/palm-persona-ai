---
name: analyze-report
description: 分析掌心人格局人格报告——多维度分析+社交货币文案生成。当用户说"/analyze-report [id]"时触发
---

# Analyze Report — 报告分析 Skill

## 触发条件
用户输入 `/analyze-report [report_id] [--platform=weapp|tt]`

## 步骤

### Phase 1: 获取数据
- [ ] 通过 MCP Resource 读取报告数据: `palm://reports/{report_id}`
- [ ] 通过 MCP Resource 读取合规词库: `palm://compliance/terms`
- [ ] 提取五维分数、核心真相、洞察要点

### Phase 2: 综合分析
- [ ] 人格特征概括（2-3句话，描述核心人格画像）
- [ ] 五维分数解读（最高分/最低分含义，平衡性分析）
- [ ] 核心真相展开（为什么这是"最准的点"——引用具体特征）
- [ ] 洞察提炼（top 3，每条有场景感）

### Phase 3: 社交货币生成
- [ ] 身份标签（1条，"我是XXX"格式，15字内）
- [ ] 隐秘真相（1条，"你看起来...其实..."格式，20字内）
- [ ] 关系洞察（1条，适配匹配场景）
- [ ] 对立反差（1条，"表面...内心..."格式）

### Phase 4: 合规检查
- [ ] 以上生成内容是否包含禁用词
- [ ] 绝对化语气是否弱化（→倾向于/更容易/大概率）
- [ ] 免责声明是否到位

### Phase 5: 平台适配
- [ ] weapp → 情绪向、深度、走心、私域传播
- [ ] tt → 中性、趣味、轻快、泛用户群体

## 输出格式
```json
{
  "reportId": "demo-001",
  "personaLabel": "思虑守护者",
  "summary": "2-3句话概括",
  "captions": {
    "identity": "身份标签文案",
    "truth": "隐秘真相文案",
    "relation": "关系洞察文案",
    "contrast": "对立反差文案"
  },
  "complianceNote": "合规检查结果",
  "platformSuggestion": "平台适配建议"
}
```
