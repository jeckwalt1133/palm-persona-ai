/**
 * 5Worker 报告生成器测试 — T006/V7-W5-021
 *
 * 验证:
 *   1. 5Worker 全部独立产出合法数据
 *   2. AI失败 → 各自降级不崩
 *   3. Promise.allSettled 编排 → 单Worker失败不影响其他
 *   4. 并行延时 < 2× 最慢Worker
 *   5. assembleReport 聚合完整性
 */
import { describe, it, expect } from 'vitest';
import {
  runNarrativeWorker,
  runInsightsWorker,
  runKeywordsWorker,
  runIdentityWorker,
  runSocialWorker,
  runAllWorkers,
  assembleReport,
  buildContext,
  type WorkerContext,
  type AllWorkerResults,
} from '../src/engine/report-workers.js';
import { MockAiProvider } from '../src/ai/mock-provider.js';
import { MockResonanceNarrativeEngine } from '../src/engine/resonance-narrative-engine.js';
import { AiProvider, ChatMessage, ChatOptions } from '../src/ai/types.js';
import type { PersonaScore, VisualAnchors } from '../src/engine/types.js';

// ─── 测试数据 ────────────────────────────────

const mockScores: PersonaScore[] = [
  { dimension: '开放度', dimensionKey: 'openness', score: 75, label: '较高', description: '乐于接受新体验' },
  { dimension: '共情力', dimensionKey: 'empathy', score: 82, label: '高', description: '深度理解他人情感' },
  { dimension: '行动力', dimensionKey: 'action', score: 60, label: '中等', description: '行动前需要思考' },
  { dimension: '稳定性', dimensionKey: 'stability', score: 88, label: '高', description: '情绪稳定可靠' },
  { dimension: '创造性', dimensionKey: 'creativity', score: 70, label: '较高', description: '有独特视角' },
];

const mockAnchors: VisualAnchors = {
  opening: '你的手掌适中，手指修长，掌心纹路清晰可见，线条丰富。手掌最饱满的地方在金星丘。',
  widthLabel: '适中 · 中等水平', fingerLabel: '修长指型 · 多于大多数人',
  clarityLabel: '清晰可见 · 多于大多数人', lineCountLabel: '脉络丰富 · 中等水平',
  prominentMount: '金星丘突出',
  palmWidth: 65, lineClarity: 70, lineCount: 4, fingerLengthRatio: 0.82,
  widthPercentile: '65%', clarityPercentile: '70%', lineCountPercentile: '60%', fingerPercentile: '82%',
};

function makeCtx(ai?: AiProvider): WorkerContext {
  return buildContext(mockScores, mockAnchors, ai ?? new MockAiProvider(), new MockResonanceNarrativeEngine());
}

// ─── 1. 单Worker测试 ──────────────────────────

describe('NarrativeWorker', () => {
  it('Mock模式: 产出完整NarrativeOutput', async () => {
    const result = await runNarrativeWorker(makeCtx());
    expect(result.status).toBe('degraded');
    expect(result.data.summary.length).toBeGreaterThan(10);
    expect(result.data.coreTruth.length).toBeGreaterThan(5);
    expect(result.data.weeklyAdvice.length).toBeGreaterThan(5);
    expect(result.data.adTeaser.length).toBeGreaterThan(0);
  });

  it('AI失败 → 降级不抛异常', async () => {
    class FailAI implements AiProvider {
      readonly name = 'fail';
      async chat(): Promise<string> { throw new Error('BOOM'); }
    }
    const result = await runNarrativeWorker(makeCtx(new FailAI()));
    expect(result.status).toBe('degraded');
    expect(result.data.summary.length).toBeGreaterThan(0);
    expect(result.data.coreTruth).toBeTruthy();
  });
});

describe('InsightsWorker', () => {
  it('Mock模式: 产出3条insights', async () => {
    const result = await runInsightsWorker(makeCtx());
    expect(result.data.insights).toHaveLength(3);
    for (const insight of result.data.insights) {
      expect(insight.length).toBeGreaterThan(5);
    }
    expect(result.data.quote.length).toBeGreaterThan(0);
    expect(result.data.suspenseText.length).toBeGreaterThan(0);
  });

  it('AI失败 → 降级保留3条insights', async () => {
    class FailAI implements AiProvider {
      readonly name = 'fail';
      async chat(): Promise<string> { throw new Error('BOOM'); }
    }
    const result = await runInsightsWorker(makeCtx(new FailAI()));
    expect(result.status).toBe('degraded');
    expect(result.data.insights).toHaveLength(3);
  });
});

describe('KeywordsWorker', () => {
  it('从scores提取关键词(计算型,无AI调用)', async () => {
    const result = await runKeywordsWorker(makeCtx());
    expect(result.status).toBe('success');
    expect(result.data.keywords.length).toBeGreaterThanOrEqual(5);
    // 包含top维度标签(稳定性=88分最高)和low维度标签
    expect(result.data.keywords).toContain('稳定性'); // top dimension
    expect(result.data.keywords).toContain('行动力'); // low dimension
  });
});

describe('IdentityWorker', () => {
  it('Mock模式: 产出personaType+Label+Badge', async () => {
    const result = await runIdentityWorker(makeCtx());
    expect(result.data.personaType).toBeTruthy();
    expect(result.data.personaLabel).toBeTruthy();
    expect(result.data.identityBadge).toBeTruthy();
    expect(result.data.personaType).toMatch(/^[a-z][a-z_-]+$/);
  });

  it('AI失败 → 降级值完整', async () => {
    class FailAI implements AiProvider {
      readonly name = 'fail';
      async chat(): Promise<string> { throw new Error('BOOM'); }
    }
    const result = await runIdentityWorker(makeCtx(new FailAI()));
    expect(result.status).toBe('degraded');
    expect(result.data.personaType).toBe('flame_explorer');
  });
});

describe('SocialWorker', () => {
  it('Mock模式: 产出relationshipCode+celebrityMatches', async () => {
    const result = await runSocialWorker(makeCtx());
    expect(result.data.relationshipCode.frequencyLabel).toBeTruthy();
    expect(result.data.relationshipCode.tensionPoint).toBeTruthy();
    expect(result.data.celebrityMatches.length).toBeGreaterThan(0);
  });
});

// ─── 2. 并行编排测试 ─────────────────────────

describe('runAllWorkers (5Worker Promise.allSettled)', () => {
  it('5Worker全部成功产出', async () => {
    const results = await runAllWorkers(makeCtx());

    expect(results.narrative.data.summary).toBeTruthy();
    expect(results.insights.data.insights).toHaveLength(3);
    expect(results.keywords.data.keywords.length).toBeGreaterThan(0);
    expect(results.identity.data.personaType).toBeTruthy();
    expect(results.social.data.relationshipCode).toBeDefined();
  });

  it('AI全故障 → 5Worker全部降级 → 全部有数据', async () => {
    class AllFailAI implements AiProvider {
      readonly name = 'all-fail';
      async chat(): Promise<string> { throw new Error('ALL DOWN'); }
    }
    const results = await runAllWorkers(makeCtx(new AllFailAI()));

    // 计算型Worker不受AI影响
    expect(results.keywords.status).toBe('success');
    // AI型Worker全部降级
    expect(results.narrative.status).toBe('degraded');
    expect(results.insights.status).toBe('degraded');
    expect(results.identity.status).toBe('degraded');
    expect(results.social.status).toBe('degraded');

    // 但所有Worker都有兜底数据
    expect(results.narrative.data.coreTruth.length).toBeGreaterThan(0);
    expect(results.insights.data.insights).toHaveLength(3);
    expect(results.identity.data.personaLabel).toBeTruthy();
    expect(results.social.data.celebrityMatches.length).toBeGreaterThan(0);
  });
});

// ─── 3. 聚合测试 ─────────────────────────────

describe('assembleReport', () => {
  it('从Worker结果组装完整PersonaReport', async () => {
    const results = await runAllWorkers(makeCtx());
    const report = assembleReport('test_hash_001', mockScores, mockAnchors, results);

    // 所有必填字段
    expect(report.id).toBe('test_hash_001');
    expect(report.personaType).toBeTruthy();
    expect(report.personaLabel).toBeTruthy();
    expect(report.identityBadge).toBeTruthy();
    expect(report.scores).toHaveLength(5);
    expect(report.summary.length).toBeGreaterThan(10);
    expect(report.coreTruth.length).toBeGreaterThan(5);
    expect(report.weeklyAdvice.length).toBeGreaterThan(5);
    expect(report.insights).toHaveLength(3);
    expect(report.quote.length).toBeGreaterThan(0);
    expect(report.suspenseText.length).toBeGreaterThan(0);
    expect(report.adTeaser.length).toBeGreaterThan(0);
    expect(report.keywords.length).toBeGreaterThan(0);
    expect(report.visualAnchors).toBeDefined();
    expect(report.relationshipCode!.frequencyLabel).toBeTruthy();
    expect(report.celebrityMatches!.length).toBeGreaterThan(0);
    expect(report.createdAt).toBeTruthy();
  });

  it('降级Worker结果也能组装完整报告', async () => {
    class AllFailAI implements AiProvider {
      readonly name = 'all-fail';
      async chat(): Promise<string> { throw new Error('DOWN'); }
    }
    const results = await runAllWorkers(makeCtx(new AllFailAI()));
    const report = assembleReport('degraded_hash', mockScores, mockAnchors, results);

    // 降级报告也应完整
    expect(report.summary.length).toBeGreaterThan(0);
    expect(report.insights).toHaveLength(3);
    expect(report.personaType).toBeTruthy();
  });
});

// ─── 4. 并行性能验证 ──────────────────────────

describe('5Worker 并行性能', () => {
  class DelayedAI implements AiProvider {
    readonly name = 'delayed';
    constructor(private delayMs: number) {}
    async chat(_msgs: ChatMessage[], _opts?: ChatOptions): Promise<string> {
      await new Promise(r => setTimeout(r, this.delayMs));
      return '{}';
    }
  }

  it('并行耗时 < 2×单Worker耗时', async () => {
    const delayMs = 80;
    const ctx = makeCtx(new DelayedAI(delayMs));

    const t0 = Date.now();
    await runAllWorkers(ctx);
    const elapsed = Date.now() - t0;

    // 4个AI Worker各delayMs → 串行需 4×80=320ms
    // 并行应 < 2×80=160ms (因为KeywordsWorker无AI调用)
    expect(elapsed).toBeLessThan(delayMs * 2 + 30); // +30ms 容错
  });

  it('并行耗时 >= 单Worker耗时', async () => {
    const delayMs = 80;
    const ctx = makeCtx(new DelayedAI(delayMs));

    const t0 = Date.now();
    await runAllWorkers(ctx);
    const elapsed = Date.now() - t0;

    // 并行总耗时 ≥ 最慢单Worker的时间
    expect(elapsed).toBeGreaterThanOrEqual(delayMs - 20);
  });
});
