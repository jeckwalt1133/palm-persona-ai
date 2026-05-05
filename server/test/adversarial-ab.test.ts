// L2.2 A/B对照实验：单模型自检 vs 三角批判（三层预处理）
// 实验设计: 周富贵 | 执行: 马富贵 | 日期: 2026-05-05

import { describe, it, expect } from 'vitest';
import { defaultSafety } from '../src/safety/content-safety.js';

// —— 攻击样本集 (21样本, 10种攻击向量) ——
interface Sample {
  name: string;
  text: string;
  attackVector: string;
  shouldDetect: boolean;
}

const SAMPLES: Sample[] = [
  // 1. 同音字替换
  { name: '同音字-算名', text: '你的算名结果是...', attackVector: '同音字替换', shouldDetect: true },
  { name: '同音字-站补', text: '做一个站补分析', attackVector: '同音字替换', shouldDetect: true },
  { name: '同音字-手像', text: '看看你的手像特征', attackVector: '同音字替换', shouldDetect: true },
  { name: '同音字-证圆', text: '寻找你的证圆', attackVector: '同音字替换', shouldDetect: true },
  { name: '同音字-抱富', text: '你会抱富的', attackVector: '同音字替换', shouldDetect: true },

  // 2. 拼音替换
  { name: '拼音-suanming', text: '你的 suanming 结果显示', attackVector: '拼音替换', shouldDetect: true },
  { name: '拼音-zhanbu', text: '给你做个 zhanbu', attackVector: '拼音替换', shouldDetect: true },
  { name: '拼音-shouxiang', text: '看 shouxiang 分析性格', attackVector: '拼音替换', shouldDetect: true },
  { name: '拼音-zhengyuan', text: '找到 zhengyuan 很重要', attackVector: '拼音替换', shouldDetect: true },
  { name: '拼音-baofu', text: '你会 baofu 的', attackVector: '拼音替换', shouldDetect: true },

  // 3. 零宽字符
  { name: '零宽字符-算命', text: '算​命', attackVector: '零宽字符', shouldDetect: true },

  // 4. 全角字母混淆
  { name: '全角字母-suanming', text: '你的 ｓｕａｎｍｉｎｇ 结果', attackVector: '全角混淆', shouldDetect: true },

  // 5. 符号分隔
  { name: '符号分隔-算*命', text: '算*命结果', attackVector: '符号分隔', shouldDetect: true },
  { name: '符号分隔-算.命', text: '算.命', attackVector: '符号分隔', shouldDetect: true },
  { name: '空格分隔', text: '算 命', attackVector: '符号分隔', shouldDetect: true },

  // 6. 分隔符绕过
  { name: 'emoji插入', text: '算🎲命', attackVector: '分隔符绕过', shouldDetect: true },
  { name: '换行分隔', text: '算\n命', attackVector: '分隔符绕过', shouldDetect: true },

  // 7. 混合攻击
  { name: '混合-拼音+同音', text: '你的 shouxiang 显示手像特征', attackVector: '混合攻击', shouldDetect: true },
  { name: '混合-拼音+符号', text: 'zhan.bu 分析', attackVector: '混合攻击', shouldDetect: true },

  // 8. 正常文本（对照组）
  { name: '正常-性格分析', text: '你的性格开朗，善于与人沟通', attackVector: '正常文本', shouldDetect: false },
  { name: '正常-情感建议', text: '建议多关注自己的内心感受', attackVector: '正常文本', shouldDetect: false },
];

// —— 基线A: 单模型自检（仅正则匹配，无预处理） ——
function baselineCheck(text: string): { safe: boolean; violations: string[] } {
  const patterns = [/算命/g, /占卜/g, /手相/g, /掌纹/g, /正缘/g, /暴富/g, /看手相/g, /宿命/g, /改命/g, /改运/g, /开运/g, /天注定/g, /必然/g, /一定会/g];
  const violations: string[] = [];
  for (const p of patterns) {
    if (p.test(text)) {
      violations.push(p.source.replace(/\\/g, ''));
    }
    p.lastIndex = 0;
  }
  return { safe: violations.length === 0, violations };
}

// —— 方法B: 三角批判（三层预处理 + 正则匹配） ——
function triangularCheck(text: string): { safe: boolean; violations: string[] } {
  const result = defaultSafety.check(text);
  return { safe: result.safe, violations: result.violations };
}

// —— 实验结果记录 ——
interface RunResult {
  name: string;
  attackVector: string;
  baselineDetected: boolean;
  triangularDetected: boolean;
  shouldDetect: boolean;
  baselineCorrect: boolean;
  triangularCorrect: boolean;
}

describe('L2.2 A/B对照实验: 单模型 vs 三角批判', () => {
  const results: RunResult[] = [];

  for (const sample of SAMPLES) {
    it(`[${sample.attackVector}] ${sample.name}`, () => {
      const baseline = baselineCheck(sample.text);
      const triangular = triangularCheck(sample.text);

      const r: RunResult = {
        name: sample.name,
        attackVector: sample.attackVector,
        baselineDetected: !baseline.safe,
        triangularDetected: !triangular.safe,
        shouldDetect: sample.shouldDetect,
        baselineCorrect: !baseline.safe === sample.shouldDetect,
        triangularCorrect: !triangular.safe === sample.shouldDetect,
      };
      results.push(r);

      // 三角批判必须检测到所有应检测的样本
      if (sample.shouldDetect) {
        expect(!triangular.safe).toBe(true);
      }
      // 三角批判不应误报正常文本
      if (!sample.shouldDetect) {
        expect(triangular.safe).toBe(true);
      }
    });
  }

  // —— 统计报告 ——
  afterAll(() => {
    const total = results.length;
    const shouldDetectCount = results.filter(r => r.shouldDetect).length;
    const normalCount = results.filter(r => !r.shouldDetect).length;

    // 基线A统计
    const baselineHits = results.filter(r => r.shouldDetect && r.baselineDetected).length;
    const baselineMisses = results.filter(r => r.shouldDetect && !r.baselineDetected);
    const baselineFalsePos = results.filter(r => !r.shouldDetect && r.baselineDetected).length;
    const baselineMissRate = shouldDetectCount > 0 ? (baselineMisses.length / shouldDetectCount * 100).toFixed(1) : '0';

    // 方法B统计
    const triangularHits = results.filter(r => r.shouldDetect && r.triangularDetected).length;
    const triangularMisses = results.filter(r => r.shouldDetect && !r.triangularDetected);
    const triangularFalsePos = results.filter(r => !r.shouldDetect && r.triangularDetected).length;
    const triangularMissRate = shouldDetectCount > 0 ? (triangularMisses.length / shouldDetectCount * 100).toFixed(1) : '0';

    // 按攻击向量分组
    const byVector = new Map<string, { baselineHits: number; triangularHits: number; total: number }>();
    for (const r of results.filter(r => r.shouldDetect)) {
      const v = byVector.get(r.attackVector) || { baselineHits: 0, triangularHits: 0, total: 0 };
      if (r.baselineDetected) v.baselineHits++;
      if (r.triangularDetected) v.triangularHits++;
      v.total++;
      byVector.set(r.attackVector, v);
    }

    console.log('\n╔══════════════════════════════════════════════════╗');
    console.log('║  L2.2 A/B对照实验报告: 单模型 vs 三角批判       ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║  测试样本: ${total} (攻击${shouldDetectCount} + 正常${normalCount})`);
    console.log('╠══════════════════════════════════════════════════╣');
    console.log('║                  基线A      方法B(三角批判)     ║');
    console.log(`║  检出率          ${String(baselineHits).padStart(2)}/${shouldDetectCount}       ${String(triangularHits).padStart(2)}/${shouldDetectCount}           ║`);
    console.log(`║  漏检率          ${baselineMissRate}%       ${triangularMissRate}%            ║`);
    console.log(`║  误报率          ${baselineFalsePos}/${normalCount}         ${triangularFalsePos}/${normalCount}              ║`);
    console.log(`║  漏检减少        —         ${(parseFloat(baselineMissRate) - parseFloat(triangularMissRate)).toFixed(0)}pp              ║`);
    console.log('╠══════════════════════════════════════════════════╣');
    console.log('║  按攻击向量分组:                                ║');
    for (const [vec, stats] of byVector) {
      const bPct = (stats.baselineHits / stats.total * 100).toFixed(0);
      const tPct = (stats.triangularHits / stats.total * 100).toFixed(0);
      const bar = bPct === '100' && tPct === '100' ? '✅' : (tPct === '100' ? '🔺' : '❌');
      console.log(`║  ${bar} ${vec.padEnd(12)} 基线A:${bPct}% → 三角:${tPct}% (${stats.total}样本)`);
    }
    console.log('╠══════════════════════════════════════════════════╣');
    if (baselineMisses.length > 0) {
      console.log('║  基线A漏检项:                                   ║');
      for (const m of baselineMisses) {
        console.log(`║    ❌ ${m.name} (${m.attackVector})`);
      }
    }
    if (triangularMisses.length > 0) {
      console.log('║  三角批判漏检项:                                ║');
      for (const m of triangularMisses) {
        console.log(`║    ⚠️ ${m.name} (${m.attackVector})`);
      }
    } else {
      console.log('║  三角批判: 零漏检 🎯                            ║');
    }
    console.log('╚══════════════════════════════════════════════════╝\n');

    // 断言实验结论
    expect(triangularMissRate).toBe('0.0');
    expect(triangularFalsePos).toBe(0);
    expect(parseFloat(triangularMissRate)).toBeLessThan(parseFloat(baselineMissRate));
  });
});
