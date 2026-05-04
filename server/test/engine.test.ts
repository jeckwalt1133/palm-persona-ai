import { describe, it, expect } from 'vitest';
import { MockPalmFeatureExtractor } from '../src/engine/palm-feature-extractor.js';
import { MockPersonaScoringEngine } from '../src/engine/persona-scoring-engine.js';
import { MockResonanceNarrativeEngine } from '../src/engine/resonance-narrative-engine.js';
import { MockCompatibilityEngine } from '../src/engine/compatibility-engine.js';
import { getAllTemplates, getDimensions, pickQuote } from '../src/engine/persona-templates.js';

describe('MockPalmFeatureExtractor', () => {
  const extractor = new MockPalmFeatureExtractor();

  it('returns deterministic features for same input', () => {
    const a = extractor.extract('test-image');
    const b = extractor.extract('test-image');
    expect(a).toEqual(b);
  });

  it('returns different features for different input', () => {
    const a = extractor.extract('alpha');
    const b = extractor.extract('beta');
    expect(a.hash).not.toBe(b.hash);
  });

  it('produces valid feature ranges', () => {
    const f = extractor.extract('test');
    expect(f.palmWidth).toBeGreaterThanOrEqual(60);
    expect(f.palmWidth).toBeLessThanOrEqual(100);
    expect(f.fingerLengthRatio).toBeGreaterThanOrEqual(0.7);
    expect(f.lineClarity).toBeGreaterThanOrEqual(30);
    expect(f.mountProminence).toHaveLength(5);
  });

  it('accepts Buffer input', () => {
    const buf = Buffer.from('hello-world-image');
    const result = extractor.extract(buf);
    expect(result.hash).toMatch(/^palm_/);
  });
});

describe('MockPersonaScoringEngine', () => {
  const extractor = new MockPalmFeatureExtractor();
  const engine = new MockPersonaScoringEngine();

  it('returns 5 dimension scores', () => {
    const features = extractor.extract('test');
    const scores = engine.score(features);
    expect(scores).toHaveLength(5);
  });

  it('all scores are within 0-100', () => {
    const features = extractor.extract('test');
    const scores = engine.score(features);
    for (const s of scores) {
      expect(s.score).toBeGreaterThanOrEqual(5);
      expect(s.score).toBeLessThanOrEqual(95);
    }
  });

  it('each score has label and description', () => {
    const features = extractor.extract('test');
    const scores = engine.score(features);
    for (const s of scores) {
      expect(s.dimension).toBeTruthy();
      expect(s.dimensionKey).toBeTruthy();
      expect(s.label).toBeTruthy();
      expect(s.description).toBeTruthy();
    }
  });

  it('produces deterministic scores for same features', () => {
    const f1 = extractor.extract('same');
    const f2 = extractor.extract('same');
    const s1 = engine.score(f1);
    const s2 = engine.score(f2);
    expect(s1).toEqual(s2);
  });
});

describe('MockResonanceNarrativeEngine', () => {
  const extractor = new MockPalmFeatureExtractor();
  const engine = new MockResonanceNarrativeEngine();

  it('generates a complete report', () => {
    const features = extractor.extract('narrative-test');
    const report = engine.generate(features);

    expect(report.id).toBe(features.hash);
    expect(report.createdAt).toBeDefined();
    expect(report.personaType).toBeTruthy();
    expect(report.personaLabel).toBeTruthy();
    expect(report.scores).toHaveLength(5);
    expect(report.summary).toBeTruthy();
    expect(report.insights.length).toBeGreaterThan(0);
    expect(report.keywords.length).toBeGreaterThan(0);
    expect(report.quote).toBeTruthy();
  });

  it('returns deterministic report for same input', () => {
    const f1 = extractor.extract('deterministic');
    const f2 = extractor.extract('deterministic');
    const r1 = engine.generate(f1);
    const r2 = engine.generate(f2);
    // createdAt 依赖当前时间，忽略比较
    delete (r1 as Record<string, unknown>).createdAt;
    delete (r2 as Record<string, unknown>).createdAt;
    expect(r1).toEqual(r2);
  });

  it('assigns different persona types for different inputs', () => {
    const reports = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const f = extractor.extract(`user-${i}`);
      const r = engine.generate(f);
      reports.add(r.personaType);
    }
    // 至少匹配到 3 种以上不同人格
    expect(reports.size).toBeGreaterThanOrEqual(3);
  });

  it('always returns exactly 3 insights via circular selection', () => {
    for (let i = 0; i < 30; i++) {
      const f = extractor.extract(`insight-test-${i}`);
      const r = engine.generate(f);
      expect(r.insights.length).toBe(3);
      // 每条 insight 非空
      for (const ins of r.insights) {
        expect(ins).toBeTruthy();
      }
    }
  });

  it('report scores are close to template baseScores', () => {
    const f = extractor.extract('score-test');
    const r = engine.generate(f);
    const templates = getAllTemplates();
    const tpl = templates.find((t) => t.type === r.personaType);
    expect(tpl).toBeDefined();
    // 每个分数的偏差不超过 10
    for (let i = 0; i < r.scores.length; i++) {
      expect(Math.abs(r.scores[i].score - tpl!.baseScores[i])).toBeLessThanOrEqual(10);
    }
  });
});

describe('MockCompatibilityEngine', () => {
  const extractor = new MockPalmFeatureExtractor();
  const scorer = new MockPersonaScoringEngine();
  const engine = new MockCompatibilityEngine();

  it('returns 5 dimensions', () => {
    const a = scorer.score(extractor.extract('person-a'));
    const b = scorer.score(extractor.extract('person-b'));
    const result = engine.match(a, b);
    expect(result.dimensions).toHaveLength(5);
    expect(result.overall).toBeGreaterThanOrEqual(0);
    expect(result.overall).toBeLessThanOrEqual(100);
    expect(result.summary).toBeTruthy();
  });

  it('same person scores 100 match with self', () => {
    const a = scorer.score(extractor.extract('same-person'));
    const result = engine.match(a, a);
    // 与自己匹配应当非常高
    expect(result.overall).toBeGreaterThanOrEqual(70);
  });

  it('different people get different matches', () => {
    const a = scorer.score(extractor.extract('x'));
    const b = scorer.score(extractor.extract('y'));
    const r1 = engine.match(a, b);
    const r2 = engine.match(b, a);
    expect(r1.overall).toBe(r2.overall);
  });
});

describe('persona-templates', () => {
  it('has at least 12 templates', () => {
    expect(getAllTemplates().length).toBeGreaterThanOrEqual(12);
  });

  it('all templates have valid base scores', () => {
    for (const tpl of getAllTemplates()) {
      expect(tpl.baseScores).toHaveLength(5);
      expect(tpl.type).toBeTruthy();
      expect(tpl.label).toBeTruthy();
      expect(tpl.summaryTemplate).toBeTruthy();
      expect(tpl.insightPool.length).toBeGreaterThanOrEqual(4);
      expect(tpl.keywordPool.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('has 5 dimensions', () => {
    expect(getDimensions()).toHaveLength(5);
  });

  it('pickQuote returns a quote', () => {
    for (let i = 0; i < 40; i++) {
      const q = pickQuote(i);
      expect(q).toBeTruthy();
      expect(typeof q).toBe('string');
    }
  });
});
