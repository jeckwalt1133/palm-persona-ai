/**
 * 合规门禁测试 — 全字段合规检查
 */
import { describe, it, expect } from 'vitest';
import { runComplianceGate } from '../src/safety/compliance-gate.js';
import { defaultSafety } from '../src/safety/content-safety.js';
import { PersonaReport } from '../src/engine/types.js';

const CLEAN_REPORT: PersonaReport = {
  id: 'palm_test',
  createdAt: new Date().toISOString(),
  personaType: 'flame_explorer',
  personaLabel: '火焰探索者',
  identityBadge: '热情驱动的行动派',
  scores: [
    { dimension: '情绪感知', dimensionKey: 'emotionalResonance', score: 75, label: '敏锐', description: '你能感受到他人情绪的微妙变化' },
    { dimension: '沟通风格', dimensionKey: 'communicationSync', score: 60, label: '真诚直接', description: '倾向于用简单直接的方式表达自己' },
    { dimension: '行动力', dimensionKey: 'actionComplement', score: 82, label: '行动派', description: '想到就做，说干就干' },
    { dimension: '信任深度', dimensionKey: 'trustPotential', score: 70, label: '信任开放', description: '愿意相信值得的人' },
    { dimension: '边界感', dimensionKey: 'frictionRisk', score: 55, label: '温和边界', description: '边界是柔软的，但存在' },
  ],
  summary: '你的手掌轮廓独特，五维人格画像呈现出丰富的内在世界。',
  coreTruth: '你比你想象的更有力量',
  weeklyAdvice: '本周尝试一次小小的冒险',
  insights: ['你拥有敏锐的直觉', '在关系中你既能给予温暖也能守住边界', '你的创造力在放松时最活跃'],
  keywords: ['敏锐', '行动派', '力量'],
  quote: '成为自己，是一生的浪漫',
  suspenseText: '这仅仅是冰山一角',
  adTeaser: '解锁完整报告',
  visualAnchors: {
    opening: '手掌宽厚，纹路清晰',
    widthLabel: '偏宽厚',
    fingerLabel: '比例和谐',
    clarityLabel: '清晰可见',
    lineCountLabel: '脉络丰富',
    prominentMount: '金星丘突出',
    palmWidth: 78,
    lineClarity: 65,
    lineCount: 4,
    fingerLengthRatio: 0.8,
    widthPercentile: '78%',
    clarityPercentile: '65%',
    lineCountPercentile: '60%',
    fingerPercentile: '80%',
  },
  relationshipCode: {
    frequencyLabel: '同频共振型',
    signalPattern: '真诚直率的沟通风格',
    bestMatchType: '坦诚行动派',
    tensionPoint: '你渴望深度连接但有时会过度照顾他人感受',
  },
  celebrityMatches: [{ name: '名人', title: '身份', reason: '匹配理由' }],
};

describe('ComplianceGate', () => {
  it('通过干净内容', () => {
    const result = runComplianceGate(CLEAN_REPORT, defaultSafety);
    expect(result.passed).toBe(true);
    expect(result.totalViolations).toBe(0);
  });

  it('检测 算命 关键词', () => {
    const report = { ...CLEAN_REPORT, summary: '看手相算命，预测你的命运走向' };
    const result = runComplianceGate(report, defaultSafety);
    expect(result.passed).toBe(false);
    expect(result.totalViolations).toBeGreaterThan(0);
  });

  it('检测 占卜 关键词', () => {
    const report = { ...CLEAN_REPORT, coreTruth: '通过占卜的方式了解自己' };
    const result = runComplianceGate(report, defaultSafety);
    expect(result.passed).toBe(false);
  });

  it('检测 insights 数组中的违规', () => {
    const report = { ...CLEAN_REPORT, insights: ['清晰的洞察', '算命看你的未来', '温和的观点'] };
    const result = runComplianceGate(report, defaultSafety);
    expect(result.passed).toBe(false);
  });

  it('检测 scores.description 中的违规', () => {
    const report = { ...CLEAN_REPORT };
    report.scores[0].description = '通过手相算命分析你的性格';
    const result = runComplianceGate(report, defaultSafety);
    expect(result.passed).toBe(false);
  });

  it('检测 keywords 中的违规', () => {
    const report = { ...CLEAN_REPORT, keywords: ['算命', '占卜', '性格'] };
    const result = runComplianceGate(report, defaultSafety);
    expect(result.passed).toBe(false);
  });

  it('检测 掌纹 关键词', () => {
    const report = { ...CLEAN_REPORT, summary: '你的掌纹清晰可见，命运线很长' };
    const result = runComplianceGate(report, defaultSafety);
    expect(result.passed).toBe(false);
  });

  it('检测 手相 关键词', () => {
    const report = { ...CLEAN_REPORT, weeklyAdvice: '根据手相分析的建议' };
    const result = runComplianceGate(report, defaultSafety);
    expect(result.passed).toBe(false);
  });

  it('过滤后文本不包含违规词', () => {
    const report = { ...CLEAN_REPORT, summary: '这是算命占卜的内容' };
    const result = runComplianceGate(report, defaultSafety);
    expect(result.report.summary).not.toContain('算命');
    expect(result.report.summary).not.toContain('占卜');
  });

  it('违规信息包含字段名', () => {
    const report = { ...CLEAN_REPORT, quote: '手相算命预测命运' };
    const result = runComplianceGate(report, defaultSafety);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations[0].field).toBe('quote');
  });

  it('可选字段为空的处理', () => {
    const report = { ...CLEAN_REPORT, quote: undefined as any, suspenseText: '', adTeaser: '' };
    const result = runComplianceGate(report, defaultSafety);
    expect(result.passed).toBe(true);
  });
});
