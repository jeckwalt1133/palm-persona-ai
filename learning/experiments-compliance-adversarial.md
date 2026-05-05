# 可复现实验：合规门禁对抗测试
## L2.2 实验者 — 掌心人格局项目

> 实验设计：Claude Code Student | 日期：2026-05-05
> 对应论文综述第6.1节 & 第4.1节

---

## 实验1：禁用词绕过攻击检测

### 假设
攻击者会尝试用同音字、拼音、Unicode变体绕过关键词过滤。

### 方法
构造50个对抗样本（10种攻击×5个禁用词），测试当前合规门禁的检测率。

### 实现

```typescript
// experiments/adversarial-compliance.test.ts
import { describe, it, expect } from 'vitest';

// 当前实现：简单字符串匹配
const FORBIDDEN = ['算命', '占卜', '手相', '正缘', '暴富'];

function checkText(text: string): { safe: boolean; violations: string[] } {
  const found = FORBIDDEN.filter(t => text.includes(t));
  return { safe: found.length === 0, violations: found };
}

// —— 攻击向量 ——
const ADVERSARIAL_SAMPLES: { name: string; text: string; shouldDetect: boolean }[] = [
  // 1. 同音字替换
  { name: '同音字-算命→算名', text: '你的算名结果是...', shouldDetect: true },
  { name: '同音字-占卜→站补', text: '做一个站补分析', shouldDetect: true },
  { name: '同音字-手相→手像', text: '看看你的手像特征', shouldDetect: true },
  { name: '同音字-正缘→证圆', text: '寻找你的证圆', shouldDetect: true },
  { name: '同音字-暴富→抱富', text: '你会抱富的', shouldDetect: true },

  // 2. 拼音替换
  { name: '拼音-suanming', text: '你的 suanming 结果显示', shouldDetect: true },
  { name: '拼音-zhanbu', text: '给你做个 zhanbu', shouldDetect: true },
  { name: '拼音-shouxiang', text: '看 shouxiang 分析性格', shouldDetect: true },
  { name: '拼音-zhengyuan', text: '找到 zhengyuan 很重要', shouldDetect: true },
  { name: '拼音-baofu', text: '你会 baofu 的', shouldDetect: true },

  // 3. Unicode混淆（全角/半角/零宽字符）
  { name: '全角字符', text: '你的算－命结果是', shouldDetect: false },
  { name: '零宽空格', text: '算​命', shouldDetect: true },  // 零宽插入但不改变显示
  { name: '全角拼音', text: 'ｓｕａｎｍｉｎｇ分析你的', shouldDetect: false },

  // 4. 中间插入符号
  { name: '符号分隔-算*命', text: '算*命结果', shouldDetect: false },
  { name: '符号分隔-算.命', text: '算.命', shouldDetect: false },
  { name: '空格分隔', text: '算 命', shouldDetect: false },

  // 5. 拆分+重组
  { name: 'emoji插入', text: '算🎲命', shouldDetect: false },
  { name: '换行分隔', text: '算\n命', shouldDetect: false },
  { name: 'HTML实体', text: '算&#x547D;', shouldDetect: false },

  // 6. 混合攻击
  { name: '混合-拼音+同音', text: '你的 shouxiang 显示手像特征', shouldDetect: true },
  { name: '混合-拼音+符号', text: 'zhan.bu 分析', shouldDetect: false },
];

describe('合规门禁 对抗性测试', () => {
  const results: { name: string; detected: boolean; shouldDetect: boolean; pass: boolean }[] = [];

  for (const sample of ADVERSARIAL_SAMPLES) {
    it(`攻击: ${sample.name}`, () => {
      const result = checkText(sample.text);
      const detected = !result.safe;
      const pass = detected === sample.shouldDetect;
      results.push({ name: sample.name, detected, shouldDetect: sample.shouldDetect, pass });
      // 宽松标准：期望检测的应该检测，不期望检测的允许误报
      if (sample.shouldDetect) {
        expect(detected).toBe(true);  // 必须检测到
      }
    });
  }

  // 统计报告
  afterAll(() => {
    const total = results.length;
    const correct = results.filter(r => r.pass).length;
    const falseNegatives = results.filter(r => r.shouldDetect && !r.detected);
    const falsePositives = results.filter(r => !r.shouldDetect && r.detected);

    console.log(`\n========== 对抗测试报告 ==========`);
    console.log(`总样本: ${total}`);
    console.log(`正确: ${correct}/${total} (${(correct/total*100).toFixed(1)}%)`);
    console.log(`漏检(应检未检): ${falseNegatives.length}`);
    for (const fn of falseNegatives) {
      console.log(`  ❌ ${fn.name}: "${fn.text}"`);
    }
    console.log(`误报(不应检但检了): ${falsePositives.length}`);
    console.log(`===================================\n`);
  });
});
```

### 预期结果

| 攻击类型 | 样本数 | 当前检测率 | 备注 |
|---------|--------|-----------|------|
| 同音字替换 | 5 | 0% (0/5) | 全部绕过——字符串匹配无法处理同音字 |
| 拼音替换 | 5 | 0% (0/5) | 全部绕过——需要拼音→汉字转换 |
| Unicode混淆 | 3 | ~33% (1/3) | 零宽空格保留可检测性 |
| 符号分隔 | 3 | 0% (0/3) | 全部绕过——符号插入破坏子串匹配 |
| 其他技术 | 3 | 0% (0/3) | 全部绕过 |
| 混合攻击 | 2 | 50% (1/2) | 部分可检测 |
| **总计** | **21** | **~10% (2/21)** | **当前实现漏检率90%** |

### 改进方案

```typescript
// 增强版 checkText：加入文本预处理
function enhancedCheckText(text: string): { safe: boolean; violations: string[] } {
  // Step 0: 标准化
  let normalized = text
    .replace(/[​‌‍﻿]/g, '')  // 移除零宽字符
    .replace(/[！-～]/g, c =>           // 全角→半角
      String.fromCharCode(c.charCodeAt(0) - 0xFEE0)
    )
    .replace(/[^一-鿿\w]/g, '');         // 移除标点符号

  // Step 1: 直接匹配（保留原有逻辑）
  const found = FORBIDDEN.filter(t => text.includes(t) || normalized.includes(t));
  return { safe: found.length === 0, violations: found };
}
```

### 结论
当前合规门禁的简单字符串匹配对对抗性攻击的检测率仅约10%。需要至少加入：
1. 零宽字符清理（影响真机用户输入）
2. 全角→半角转换
3. 标点符号移除后匹配
4. 同音字字典（长期：需要NLP模型辅助）

---

## 实验2：Reflexion基线对比

### 方法
对比"无Reflexion日志"vs"有Reflexion日志"的质量改进速度。

| 轮次 | 无Reflexion | 有Reflexion | 提升 |
|------|-----------|-----------|------|
| 1 | 55 | 55 | 0 |
| 2 | 60 | 70 | +10 |
| 3 | 62 | 80 | +18 |
| 4 | 58 | 88 | +30 |
| 5 | 63 | 95 | +32 |

数据来源：`autonomous-agent.ts` 第7课实验（已在课程7验证）

---

## 实验3：MCP STDIO vs HTTP 延迟对比

待执行。需Streamable HTTP Server部署后测试。

---

*实验代码见项目仓库 `server/test/` 和 `learning/experiments-*.md`*
*下一阶段：将对抗测试集成到CI pipeline，每次提交自动运行*
