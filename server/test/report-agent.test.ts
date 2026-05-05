/**
 * 毕业设计测试 — ReportAgent + ReportPipeline
 *
 * 覆盖：PreCheck / Pipeline / ComplianceGate / Quality / Reflexion
 */
import { describe, it, expect } from 'vitest';
import { ReportAgent } from '../src/agent/report-agent.js';
import { runPipeline } from '../src/engine/report-pipeline.js';
import { MockPalmFeatureExtractor } from '../src/engine/palm-feature-extractor.js';
import { MockResonanceNarrativeEngine } from '../src/engine/resonance-narrative-engine.js';
import { MockAiProvider } from '../src/ai/mock-provider.js';
import { MockReportRepository } from './helpers/mock-repo.js';

const TEST_IMAGE = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe('ReportAgent (毕业设计)', () => {
  const agent = new ReportAgent(
    new MockPalmFeatureExtractor(),
    new MockResonanceNarrativeEngine(),
    undefined,
    new MockAiProvider(),
    new MockReportRepository(),
  );

  it('PreCheck: 拒绝空图片', async () => {
    await expect(agent.generate('')).rejects.toThrow('Pre-check 失败');
  });

  it('PreCheck: 拒绝过短 base64', async () => {
    await expect(agent.generate('abc')).rejects.toThrow('Pre-check 失败');
  });

  it('完整流水线: 生成报告 + 合规检查 + 质量评分', async () => {
    const result = await agent.generate(TEST_IMAGE);
    expect(result.report).toBeDefined();
    expect(result.report.id).toMatch(/^palm_/);
    expect(result.report.scores).toHaveLength(5);
    expect(result.pipeline.preCheck.passed).toBe(true);
    expect(result.pipeline.quality.score).toBeGreaterThanOrEqual(0);
    expect(result.pipeline.totalMs).toBeGreaterThan(0);
  });

  it('合规门禁: 报告字段不为空', async () => {
    const result = await agent.generate(TEST_IMAGE);
    expect(result.report.summary.length).toBeGreaterThan(0);
    expect(result.report.coreTruth.length).toBeGreaterThan(0);
    expect(result.report.insights.length).toBeGreaterThanOrEqual(3);
  });

  it('Reflexion: 累积统计正确', async () => {
    const stats = agent.getReflexionStats();
    expect(stats.totalReports).toBeGreaterThan(0);
    expect(stats.avgQuality).toBeGreaterThan(0);
  });

  it('重复请求: 返回缓存报告', async () => {
    const r1 = await agent.generate(TEST_IMAGE);
    const r2 = await agent.generate(TEST_IMAGE);
    expect(r2.report.id).toBe(r1.report.id);
  });
});

describe('ReportPipeline (毕业设计)', () => {
  it('Mock 模式: 5 Worker 全部完成', async () => {
    const result = await runPipeline(TEST_IMAGE);
    expect(result.report).toBeDefined();
    expect(result.timing.extractMs).toBeGreaterThanOrEqual(0);
    expect(result.timing.scoreMs).toBeGreaterThanOrEqual(0);
    expect(result.timing.narrativeMs).toBeGreaterThanOrEqual(0);
    expect(result.timing.safetyMs).toBeGreaterThanOrEqual(0);
    expect(result.timing.totalMs).toBeGreaterThanOrEqual(0);
  });

  it('报告包含视觉锚点', async () => {
    const result = await runPipeline(TEST_IMAGE);
    expect(result.report.visualAnchors).toBeDefined();
    expect(result.report.visualAnchors.opening).toBeTruthy();
    expect(result.report.visualAnchors.widthLabel).toBeTruthy();
    expect(result.report.visualAnchors.palmWidth).toBeGreaterThan(0);
  });

  it('报告包含关系频率密码', async () => {
    const result = await runPipeline(TEST_IMAGE);
    expect(result.report.relationshipCode).toBeDefined();
    expect(result.report.relationshipCode.frequencyLabel).toBeTruthy();
  });

  it('合规违规为 0（Mock 模式）', async () => {
    const result = await runPipeline(TEST_IMAGE);
    expect(result.complianceViolations).toBe(0);
  });

  it('评分在 0-100 范围内', async () => {
    const result = await runPipeline(TEST_IMAGE);
    for (const s of result.report.scores) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(100);
    }
  });
});
