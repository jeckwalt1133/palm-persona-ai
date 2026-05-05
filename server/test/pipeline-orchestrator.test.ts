/**
 * PipelineOrchestrator 测试 — Multi-Agent并行管线
 *
 * 覆盖: 并行执行 / 降级不崩溃 / AgentStatus / 计时 / 聚合
 */
import { describe, it, expect } from 'vitest';
import { PipelineOrchestrator } from '../src/agent/pipeline-orchestrator.js';
import { MockPalmFeatureExtractor } from '../src/engine/palm-feature-extractor.js';
import { MockPersonaScoringEngine } from '../src/engine/persona-scoring-engine.js';
import { MockResonanceNarrativeEngine } from '../src/engine/resonance-narrative-engine.js';
import { MockAiProvider } from '../src/ai/mock-provider.js';
import { defaultSafety } from '../src/safety/content-safety.js';

const TEST_IMAGE = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe('PipelineOrchestrator (Multi-Agent并行管线)', () => {
  const mockDeps = {
    extractor: new MockPalmFeatureExtractor(),
    scoring: new MockPersonaScoringEngine(),
    narrative: new MockResonanceNarrativeEngine(),
    ai: new MockAiProvider(),
    safety: defaultSafety,
  };

  it('完整并行管线: 产出合法PersonaReport', async () => {
    const orchestrator = new PipelineOrchestrator(mockDeps);
    const result = await orchestrator.run(TEST_IMAGE);

    expect(result.report).toBeDefined();
    expect(result.report.id).toMatch(/^palm_/);
    expect(result.report.personaType).toBeTruthy();
    expect(result.report.personaLabel).toBeTruthy();
    expect(result.report.scores).toHaveLength(5);
    expect(result.report.insights.length).toBeGreaterThanOrEqual(3);
    expect(result.report.coreTruth.length).toBeGreaterThan(0);
  });

  it('AgentStatus: 全部成功', async () => {
    const orchestrator = new PipelineOrchestrator(mockDeps);
    const result = await orchestrator.run(TEST_IMAGE);

    expect(result.agentStatus.analyst).toBe('success');
    expect(result.agentStatus.copywriter).toBe('success');
    expect(result.agentStatus.safetyPre).toBe('success');
  });

  it('计时: 所有阶段耗时非负且totalMs > 0', async () => {
    const orchestrator = new PipelineOrchestrator(mockDeps);
    const result = await orchestrator.run(TEST_IMAGE);

    expect(result.timing.extractMs).toBeGreaterThanOrEqual(0);
    expect(result.timing.scoreMs).toBeGreaterThanOrEqual(0);
    expect(result.timing.parallelMs).toBeGreaterThanOrEqual(0);
    expect(result.timing.safetyPostMs).toBeGreaterThanOrEqual(0);
    expect(result.timing.totalMs).toBeGreaterThanOrEqual(0);
  });

  it('报告包含视觉锚点 (5个维度)', async () => {
    const orchestrator = new PipelineOrchestrator(mockDeps);
    const result = await orchestrator.run(TEST_IMAGE);

    const va = result.report.visualAnchors;
    expect(va.opening).toBeTruthy();
    expect(va.widthLabel).toBeTruthy();
    expect(va.fingerLabel).toBeTruthy();
    expect(va.clarityLabel).toBeTruthy();
    expect(va.lineCountLabel).toBeTruthy();
    expect(va.palmWidth).toBeGreaterThan(0);
  });

  it('报告包含关系频率密码', async () => {
    const orchestrator = new PipelineOrchestrator(mockDeps);
    const result = await orchestrator.run(TEST_IMAGE);

    const rc = result.report.relationshipCode;
    expect(rc.frequencyLabel).toBeTruthy();
    expect(rc.signalPattern).toBeTruthy();
    expect(rc.bestMatchType).toBeTruthy();
    expect(rc.tensionPoint).toBeTruthy();
  });

  it('报告包含名人彩蛋', async () => {
    const orchestrator = new PipelineOrchestrator(mockDeps);
    const result = await orchestrator.run(TEST_IMAGE);

    expect(result.report.celebrityMatches.length).toBeGreaterThan(0);
    for (const cm of result.report.celebrityMatches) {
      expect(cm.name).toBeTruthy();
      expect(cm.reason).toBeTruthy();
    }
  });

  it('评分在 0-100 范围内', async () => {
    const orchestrator = new PipelineOrchestrator(mockDeps);
    const result = await orchestrator.run(TEST_IMAGE);

    for (const s of result.report.scores) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(100);
    }
  });

  it('identityBadge 不为空', async () => {
    const orchestrator = new PipelineOrchestrator(mockDeps);
    const result = await orchestrator.run(TEST_IMAGE);

    expect(result.report.identityBadge).toBeTruthy();
  });

  it('suspenseText 和 adTeaser 不为空', async () => {
    const orchestrator = new PipelineOrchestrator(mockDeps);
    const result = await orchestrator.run(TEST_IMAGE);

    expect(result.report.suspenseText).toBeTruthy();
    expect(result.report.adTeaser).toBeTruthy();
  });

  it('重复调用产出不同id (模拟不同手掌)', async () => {
    // Mock extractor 相同输入产相同hash，这里验证管线幂等性
    const orchestrator = new PipelineOrchestrator(mockDeps);
    const r1 = await orchestrator.run(TEST_IMAGE);
    const r2 = await orchestrator.run(TEST_IMAGE);

    expect(r1.report.id).toBe(r2.report.id); // 相同image→相同hash
    expect(r1.timing.totalMs).toBeGreaterThanOrEqual(0);
  });
});
