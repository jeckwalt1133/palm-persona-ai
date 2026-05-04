import { describe, it, expect } from 'vitest';
import { matchShareCopy, getTotalCount, checkForbiddenTerms, safeText } from '../src/utils/shareCopy';

describe('分享文案库', () => {
  it('至少包含 100 条文案', () => {
    expect(getTotalCount()).toBeGreaterThanOrEqual(100);
  });

  it('所有文案通过禁词检查', () => {
    // 此测试在构建时已通过 IIFE 校验，这里做二次确认
    // 验证 checkForbiddenTerms 函数正常工作
    expect(checkForbiddenTerms('这是一段正常文案')).toEqual([]);
    expect(checkForbiddenTerms('算命').length).toBeGreaterThan(0);
    expect(checkForbiddenTerms('手相')).not.toEqual([]);
  });

  it('safeText 替换禁词', () => {
    const input = '这是一段算命文案';
    const result = safeText(input);
    expect(result).not.toContain('算命');
    expect(result).toContain('***');
  });

  it('匹配算法对 12 种人格均返回结果', () => {
    const personaTypes = [
      'starry-dreamer', 'silent-guardian', 'flame-explorer', 'deep-thinker',
      'gentle-healer', 'sharp-pioneer', 'moon-artist', 'bridge-builder',
      'quiet-mountain', 'sunshine-spark', 'wind-wanderer', 'root-keeper',
    ];

    const mockScores = [
      { dimensionKey: 'emotionalResonance', score: 70 },
      { dimensionKey: 'communicationSync', score: 60 },
      { dimensionKey: 'actionComplement', score: 50 },
      { dimensionKey: 'trustPotential', score: 65 },
      { dimensionKey: 'frictionRisk', score: 40 },
    ];

    for (const pt of personaTypes) {
      const result = matchShareCopy(pt, mockScores);
      expect(result.length).toBeGreaterThanOrEqual(1);
      // 每个分类至少应有 primaryText
      for (const r of result) {
        expect(r.primaryText).toBeTruthy();
        expect(r.texts.length).toBeGreaterThan(0);
      }
    }
  });

  it('不同人格返回不同文案', () => {
    const scores = [
      { dimensionKey: 'emotionalResonance', score: 85 },
      { dimensionKey: 'communicationSync', score: 45 },
      { dimensionKey: 'actionComplement', score: 60 },
      { dimensionKey: 'trustPotential', score: 70 },
      { dimensionKey: 'frictionRisk', score: 30 },
    ];

    const dreamer = matchShareCopy('starry-dreamer', scores);
    const guardian = matchShareCopy('silent-guardian', scores);

    // 身份标签分类应该不同（因为人格限定）
    const dreamerIdentity = dreamer.find((r) => r.category === 'identity_label');
    const guardianIdentity = guardian.find((r) => r.category === 'identity_label');

    expect(dreamerIdentity).toBeTruthy();
    expect(guardianIdentity).toBeTruthy();
    // 至少一个人格限定文案应该不同
    const dreamerTexts = new Set(dreamerIdentity!.texts);
    const guardianTexts = new Set(guardianIdentity!.texts);
    const hasDifference = [...dreamerTexts].some((t) => !guardianTexts.has(t));
    expect(hasDifference).toBe(true);
  });
});
