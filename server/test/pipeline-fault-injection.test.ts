/**
 * 管线故障注入测试 — 验证双重降级不崩溃
 *
 * 降级防线:
 *   L1: Agent内部 try-catch → 自降级返回兜底值 (不抛错)
 *   L2: Orchestrator Promise.allSettled → 即使Agent崩溃也有兜底
 *
 * 场景:
 *   1. AI全部抛错 → Agent自降级 → 状态success(自愈) → 报告完整
 *   2. 部分Agent失败 → 不影响其他Agent
 *   3. 输入预检失败 → 告警但不阻断
 *   4. 全故障 → 全降级 → 报告可产出
 */
import { describe, it, expect } from 'vitest';
import { PipelineOrchestrator } from '../src/agent/pipeline-orchestrator.js';
import { MockPalmFeatureExtractor } from '../src/engine/palm-feature-extractor.js';
import { MockPersonaScoringEngine } from '../src/engine/persona-scoring-engine.js';
import { MockResonanceNarrativeEngine } from '../src/engine/resonance-narrative-engine.js';
import { defaultSafety } from '../src/safety/content-safety.js';
import { AiProvider, ChatMessage, ChatOptions } from '../src/ai/types.js';

const TEST_IMAGE = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const baseDeps = {
  extractor: new MockPalmFeatureExtractor(),
  scoring: new MockPersonaScoringEngine(),
  narrative: new MockResonanceNarrativeEngine(),
  safety: defaultSafety,
};

/** AI Provider 总是抛错 — 触发 Agent L1 自降级 */
class ThrowingAiProvider implements AiProvider {
  readonly name = 'chaos';
  async chat(_msgs: ChatMessage[], _opts?: ChatOptions): Promise<string> {
    throw new Error('注入故障: AI 调用超时');
  }
}

/** 延迟 Provider — 用于验证并行执行时间 */
class DelayedAiProvider implements AiProvider {
  readonly name = 'delayed';
  constructor(private delayMs: number) {}
  async chat(_msgs: ChatMessage[], _opts?: ChatOptions): Promise<string> {
    await new Promise(r => setTimeout(r, this.delayMs));
    return '{"personaType":"patient","personaLabel":"耐心者","identityBadge":"深沉思考者","relationshipCode":{"frequencyLabel":"慢频","signalPattern":"深思后表达","bestMatchType":"倾听者","tensionPoint":"过度沉默"},"celebrityMatches":[{"name":"测试","title":"哲学家","reason":"深思熟虑"}]}';
  }
}

describe('PipelineOrchestrator L1降级 (Agent自愈)', () => {
  it('AI全抛错 → Agent自降级不抛错 → 状态仍为success → 报告完整', async () => {
    const orchestrator = new PipelineOrchestrator({
      ...baseDeps,
      ai: new ThrowingAiProvider(),
    });

    const result = await orchestrator.run(TEST_IMAGE);

    // Agent 内部 catch → 自降级成功 → orchestrator 看到 fulfilled
    expect(result.agentStatus.analyst).toBe('success');
    expect(result.agentStatus.copywriter).toBe('success');
    expect(result.agentStatus.safetyPre).toBe('success');

    // 报告用降级值完整产出
    expect(result.report.personaType).toBeTruthy();
    expect(result.report.personaLabel).toBeTruthy();
    expect(result.report.summary).toBeTruthy();
    expect(result.report.coreTruth).toBeTruthy();
    expect(result.report.insights.length).toBeGreaterThanOrEqual(2);
    expect(result.report.celebrityMatches.length).toBeGreaterThan(0);
    expect(result.report.relationshipCode).toBeDefined();
  });

  it('安全预检失败 → 告警但不阻断 → 报告正常产出', async () => {
    const orchestrator = new PipelineOrchestrator({
      ...baseDeps,
      ai: new ThrowingAiProvider(),
    });

    const badImage = 'x'; // 过短，触发 preCheck issue
    const result = await orchestrator.run(badImage);

    expect(result.report).toBeDefined();
    expect(result.report.id).toBeTruthy();
    expect(result.report.scores).toHaveLength(5);
  });

  it('全故障: 所有降级值有效不崩', async () => {
    const orchestrator = new PipelineOrchestrator({
      ...baseDeps,
      ai: new ThrowingAiProvider(),
    });

    const result = await orchestrator.run(TEST_IMAGE);

    // 关键字段全有值（降级兜底）
    expect(result.report.summary.length).toBeGreaterThan(10);
    expect(result.report.coreTruth.length).toBeGreaterThan(5);
    expect(result.report.weeklyAdvice.length).toBeGreaterThan(5);
    expect(result.report.insights).toHaveLength(3);
    expect(result.report.quote.length).toBeGreaterThan(0);
    expect(result.report.suspenseText.length).toBeGreaterThan(0);
    expect(result.report.adTeaser.length).toBeGreaterThan(0);
    expect(result.report.personaLabel).toBeTruthy();
    expect(result.report.identityBadge).toBeTruthy();
  });
});

describe('PipelineOrchestrator 并行性能', () => {
  it('并行阶段耗时 < 2×单Agent耗时 (证明并行执行)', async () => {
    const delayMs = 80;
    const orchestrator = new PipelineOrchestrator({
      ...baseDeps,
      ai: new DelayedAiProvider(delayMs),
    });

    const result = await orchestrator.run(TEST_IMAGE);

    // 3个Agent 各 delayMs → 并行应 < 2×delayMs → < 160ms
    // (串行需 ≥ 2×delayMs = 160ms)
    expect(result.timing.parallelMs).toBeLessThan(delayMs * 2);
  });

  it('并行阶段耗时 ≥ 单Agent耗时 (不低于最小值)', async () => {
    const delayMs = 80;
    const orchestrator = new PipelineOrchestrator({
      ...baseDeps,
      ai: new DelayedAiProvider(delayMs),
    });

    const result = await orchestrator.run(TEST_IMAGE);

    // 并行执行总时间 ≥ 最慢Agent的时间
    expect(result.timing.parallelMs).toBeGreaterThanOrEqual(delayMs - 20); // ±20ms 误差
  });

  it('计时: 各阶段耗时之和 ≈ totalMs', async () => {
    const orchestrator = new PipelineOrchestrator({
      ...baseDeps,
      ai: new ThrowingAiProvider(),
    });

    const result = await orchestrator.run(TEST_IMAGE);

    const sum = result.timing.extractMs + result.timing.scoreMs
      + result.timing.parallelMs + result.timing.safetyPostMs;
    expect(Math.abs(sum - result.timing.totalMs)).toBeLessThanOrEqual(5);
  });
});
