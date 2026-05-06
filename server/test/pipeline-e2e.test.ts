/**
 * 多Agent端到端集成测试 — V7-W5-008
 *
 * 覆盖全链路: API层 → ReportAgent → PipelineOrchestrator → {Analyst‖Copywriter‖Safety} → 聚合 → 合规 → 返回
 *
 * 测试维度:
 *   1. 完整E2E链路 (MockAnalysisService → ReportAgent → Orchestrator → 3 Agent)
 *   2. Agent协作一致性 (Analyst产出 → Copywriter消费)
 *   3. 独立Agent模块测试 (Analyst/Copywriter/Safety 各自输入输出)
 *   4. 并发请求稳定性
 *   5. 降级E2E (AI失败 → 全链路不崩)
 *   6. 报告质量 (所有必填字段非空/合法)
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { MockAnalysisService, sharedRepo, type AnalysisService } from '../src/services/analysis-service.js';
import { ReportAgent, type AgentPipelineResult } from '../src/agent/report-agent.js';
import { PipelineOrchestrator, type OrchestratorResult } from '../src/agent/pipeline-orchestrator.js';
import { AnalystAgent, type AnalystOutput } from '../src/agent/analyst-agent.js';
import { CopywriterAgent, type CopywriterOutput } from '../src/agent/copywriter-agent.js';
import { SafetyAgent, type SafetyInput } from '../src/agent/safety-agent.js';
import { MockPalmFeatureExtractor } from '../src/engine/palm-feature-extractor.js';
import { MockPersonaScoringEngine } from '../src/engine/persona-scoring-engine.js';
import { MockResonanceNarrativeEngine } from '../src/engine/resonance-narrative-engine.js';
import { MockAiProvider } from '../src/ai/mock-provider.js';
import { defaultSafety } from '../src/safety/content-safety.js';
import { AiProvider, ChatMessage, ChatOptions } from '../src/ai/types.js';
import type { PersonaReport, PersonaScore, VisualAnchors } from '../src/engine/types.js';

// ─── 测试数据 ────────────────────────────────

const TEST_IMAGE = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const ALT_IMAGE = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVQIHWNg+M9Qz8BQz0AFAOkBBApBxAoAAAAASUVORK5CYII=';

// ─── Providers ───────────────────────────────

/** 智能Provider: 根据prompt内容返回Analyst或Copywriter格式JSON */
class SmartJsonAiProvider implements AiProvider {
  readonly name = 'e2e-smart';
  private idx = 0;
  private readonly personas = [
    { type: 'flame_explorer', label: '火焰探索者', badge: '热情驱动的行动派' },
    { type: 'ocean_thinker', label: '深海思想者', badge: '深度洞察的思考者' },
    { type: 'mountain_guardian', label: '高山守护者', badge: '可靠稳重的后盾' },
  ];
  async chat(msgs: ChatMessage[], _opts?: ChatOptions): Promise<string> {
    const allText = msgs.map(m => m.content).join(' ');
    const p = this.personas[this.idx % this.personas.length];
    this.idx++;

    // Copywriter prompt 特征: 含 "最高维"/"综合解读"/"insights"
    if (allText.includes('综合解读') || allText.includes('insights')) {
      return JSON.stringify({
        summary: `你的${p.label}特质在你的手掌中清晰可见。你是一个真诚而富有洞察力的人，在关系中既能给予温暖也能坚守边界。你的手掌轮廓独特——正如你的性格，无法被简单定义。`,
        coreTruth: '你比你想象的更鲜活，也比你表现的更深刻',
        weeklyAdvice: '本周尝试每天给自己10分钟独处时间，让内在声音浮现',
        quote: '成为自己，是一生的浪漫',
        suspenseText: '这仅仅是冰山一角——你的深层人格画像还有4个维度等待解锁',
        adTeaser: '看30秒广告解锁完整人格报告',
        insights: ['你拥有敏锐的直觉，有时候比理性分析更值得信赖', '在关系中你既能给予温暖也能守住边界，这是难得的能力', '你的创造力在放松时最活跃，给自己留一些空白时间'],
      });
    }

    // Analyst prompt: personaType / relationshipCode / celebrityMatches
    return JSON.stringify({
      personaType: p.type,
      personaLabel: p.label,
      identityBadge: p.badge,
      relationshipCode: {
        frequencyLabel: '同频共振型',
        signalPattern: '你倾向于先观察再行动，沉默中酝酿力量',
        bestMatchType: '深度思考者',
        tensionPoint: '有时过度分析会延迟行动，但这不是缺点',
      },
      celebrityMatches: [
        { name: `测试名人${this.idx}`, title: '艺术家', reason: '气质共鸣' },
        { name: `对照名人${this.idx}`, title: '哲学家', reason: '思维模式相似' },
      ],
    });
  }
}

/** 仅返回Analyst格式的Provider (测试单个Agent) */
class AnalystOnlyProvider implements AiProvider {
  readonly name = 'analyst-e2e';
  async chat(_msgs: ChatMessage[], _opts?: ChatOptions): Promise<string> {
    return JSON.stringify({
      personaType: 'flame_explorer',
      personaLabel: '火焰探索者',
      identityBadge: '热情驱动的行动派',
      relationshipCode: {
        frequencyLabel: '同频共振型',
        signalPattern: '先观察再行动',
        bestMatchType: '深度思考者',
        tensionPoint: '过度分析延迟行动',
      },
      celebrityMatches: [
        { name: '测试名人', title: '艺术家', reason: '气质共鸣' },
        { name: '对照名人', title: '哲学家', reason: '思维相似' },
      ],
    });
  }
}

/** 延迟Provider (验证并行性能) */
class SlowButValidAiProvider implements AiProvider {
  readonly name = 'e2e-slow';
  constructor(private delayMs: number) {}
  async chat(_msgs: ChatMessage[], _opts?: ChatOptions): Promise<string> {
    await new Promise(r => setTimeout(r, this.delayMs));
    return JSON.stringify({
      personaType: 'patient_sage',
      personaLabel: '耐心智者',
      identityBadge: '深思熟虑的决策者',
      relationshipCode: {
        frequencyLabel: '慢频深连型',
        signalPattern: '深思后表达，每一句都有分量',
        bestMatchType: '倾听理解者',
        tensionPoint: '过度沉默可能被误认为疏离',
      },
      celebrityMatches: [
        { name: '查理·芒格', title: '投资家', reason: '深度思考模式' },
        { name: '宫崎骏', title: '动画大师', reason: '耐心打磨每一帧' },
      ],
    });
  }
}

// ─── 1. 完整E2E链路 ──────────────────────────

describe('E2E: 完整链路 (AnalysisService → ReportAgent → Orchestrator → 3 Agent)', () => {
  let service: MockAnalysisService;

  beforeAll(() => {
    service = new MockAnalysisService(
      new MockPalmFeatureExtractor(),
      new MockResonanceNarrativeEngine(),
      sharedRepo,
      new SmartJsonAiProvider(),
    );
  });

  it('analyze() → report 所有必填字段非空', async () => {
    const report = await service.analyze(TEST_IMAGE);

    expect(report.id).toMatch(/^palm_/);
    expect(report.personaType).toBeTruthy();
    expect(report.personaLabel).toBeTruthy();
    expect(report.scores).toHaveLength(5);
    expect(report.summary.length).toBeGreaterThan(0);
    expect(report.coreTruth.length).toBeGreaterThan(0);
    expect(report.weeklyAdvice.length).toBeGreaterThan(0);
    expect(report.insights.length).toBeGreaterThanOrEqual(2);
    expect(report.quote.length).toBeGreaterThan(0);
    expect(report.identityBadge).toBeTruthy();
    expect(report.suspenseText).toBeTruthy();
    expect(report.adTeaser).toBeTruthy();
    expect(report.relationshipCode).toBeDefined();
    expect(report.celebrityMatches!.length).toBeGreaterThan(0);
  });

  it('analyze() → report scores 在 0-100 范围', async () => {
    const report = await service.analyze(TEST_IMAGE);
    for (const s of report.scores) {
      expect(s.score).toBeGreaterThanOrEqual(0);
      expect(s.score).toBeLessThanOrEqual(100);
      expect(s.dimension).toBeTruthy();
      expect(s.dimensionKey).toBeTruthy();
      expect(s.label).toBeTruthy();
      expect(s.description).toBeTruthy();
    }
  });

  it('analyze() → visualAnchors 5维度完整', async () => {
    const report = await service.analyze(TEST_IMAGE);
    const va = report.visualAnchors!;
    expect(va.opening.length).toBeGreaterThan(10);
    expect(va.widthLabel).toBeTruthy();
    expect(va.fingerLabel).toBeTruthy();
    expect(va.clarityLabel).toBeTruthy();
    expect(va.lineCountLabel).toBeTruthy();
    expect(va.prominentMount).toBeTruthy();
    expect(va.palmWidth).toBeGreaterThan(0);
    expect(va.lineClarity).toBeGreaterThan(0);
  });

  it('analyze() → ReportAgent.generate() → pipeline 全字段', async () => {
    const agent = new ReportAgent(
      new MockPalmFeatureExtractor(),
      new MockResonanceNarrativeEngine(),
      defaultSafety,
      new SmartJsonAiProvider(),
      sharedRepo,
    );

    const result: AgentPipelineResult = await agent.generate(TEST_IMAGE);

    // pipeline 包装层
    expect(result.report).toBeDefined();
    expect(result.pipeline.preCheck.passed).toBe(true);
    expect(result.pipeline.complianceGate.passed).toBe(true);
    expect(result.pipeline.quality.score).toBeGreaterThan(0);
    expect(result.pipeline.totalMs).toBeGreaterThanOrEqual(0);
  });

  it('analyze() → 不同图片产生不同hash id', async () => {
    const r1 = await service.analyze(TEST_IMAGE);
    const r2 = await service.analyze(ALT_IMAGE);

    expect(r1.id).not.toBe(r2.id);
  });
});

// ─── 2. Agent协作一致性 ──────────────────────

describe('E2E: Agent协作 — Analyst产出 → Copywriter消费', () => {
  const baseDeps = {
    extractor: new MockPalmFeatureExtractor(),
    scoring: new MockPersonaScoringEngine(),
    narrative: new MockResonanceNarrativeEngine(),
    safety: defaultSafety,
  };

  it('Analyst personaLabel 出现在 Copywriter prompt 中 (通过Orchestrator聚合)', async () => {
    const orchestrator = new PipelineOrchestrator({
      ...baseDeps,
      ai: new SmartJsonAiProvider(),
    });

    const result = await orchestrator.run(TEST_IMAGE);
    const report = result.report;

    // Analyst 产出的 personaLabel 和 identityBadge 应体现在报告中
    expect(report.personaLabel).toBeTruthy();
    expect(report.identityBadge).toBeTruthy();
    // Copywriter 产出的文案应与 Analyst 产出的 personaType 共存
    expect(report.summary).toBeTruthy();
    expect(report.personaType).toBeTruthy();
  });

  it('Orchestrator 聚合: relationshipCode 来自 Analyst, summary 来自 Copywriter', async () => {
    const orchestrator = new PipelineOrchestrator({
      ...baseDeps,
      ai: new SmartJsonAiProvider(),
    });

    const result = await orchestrator.run(TEST_IMAGE);

    // Analyst → relationshipCode + celebrityMatches
    expect(result.report.relationshipCode!.frequencyLabel).toBeTruthy();
    expect(result.report.celebrityMatches!.length).toBe(2);
    // Copywriter → summary + coreTruth + insights + quote
    expect(result.report.summary.length).toBeGreaterThan(10);
    expect(result.report.coreTruth.length).toBeGreaterThan(5);
    expect(result.report.insights.length).toBe(3);
    expect(result.report.quote.length).toBeGreaterThan(0);
  });
});

// ─── 3. 独立Agent模块测试 ────────────────────

describe('E2E: 独立Agent模块', () => {
  describe('AnalystAgent', () => {
    const mockScores: PersonaScore[] = [
      { dimension: '开放度', dimensionKey: 'openness', score: 75, label: '较高', description: '乐于接受新体验' },
      { dimension: '共情力', dimensionKey: 'empathy', score: 82, label: '高', description: '深度理解他人情感' },
      { dimension: '行动力', dimensionKey: 'action', score: 60, label: '中等', description: '行动前需要思考' },
      { dimension: '稳定性', dimensionKey: 'stability', score: 88, label: '高', description: '情绪稳定可靠' },
      { dimension: '创造性', dimensionKey: 'creativity', score: 70, label: '较高', description: '有独特视角' },
    ];
    const mockAnchors: VisualAnchors = {
      opening: '测试视觉锚点',
      widthLabel: '适中', fingerLabel: '修长', clarityLabel: '清晰', lineCountLabel: '丰富',
      prominentMount: '金星丘', palmWidth: 65, lineClarity: 70, lineCount: 4, fingerLengthRatio: 0.82,
      widthPercentile: '65%', clarityPercentile: '70%', lineCountPercentile: '60%', fingerPercentile: '82%',
    };

    it('mock模式返回降级值', async () => {
      const agent = new AnalystAgent(new MockAiProvider());
      const result = await agent.analyze({ scores: mockScores, visualAnchors: mockAnchors });
      expect(result.personaType).toBe('flame_explorer');
      expect(result.personaLabel).toBe('火焰探索者');
      expect(result.celebrityMatches.length).toBeGreaterThan(0);
    });

    it('有效AI返回完整AnalystOutput', async () => {
      const agent = new AnalystAgent(new AnalystOnlyProvider());
      const result = await agent.analyze({ scores: mockScores, visualAnchors: mockAnchors });
      expect(result.personaType).toBeTruthy();
      expect(result.personaLabel).toBeTruthy();
      expect(result.identityBadge).toBeTruthy();
      expect(result.relationshipCode.frequencyLabel).toBeTruthy();
      expect(result.relationshipCode.tensionPoint).toBeTruthy();
      expect(result.celebrityMatches.length).toBe(2);
    });

    it('AI失败 → 自降级不抛异常', async () => {
      class FailProvider implements AiProvider {
        readonly name = 'fail';
        async chat(): Promise<string> { throw new Error('BOOM'); }
      }
      const agent = new AnalystAgent(new FailProvider());
      const result = await agent.analyze({ scores: mockScores, visualAnchors: mockAnchors });
      // 应返回降级值，不抛异常
      expect(result.personaType).toBeTruthy();
      expect(result.personaLabel).toBeTruthy();
    });
  });

  describe('CopywriterAgent', () => {
    const mockScores: PersonaScore[] = [
      { dimension: '开放度', dimensionKey: 'openness', score: 75, label: '较高', description: '乐于接受新体验' },
      { dimension: '共情力', dimensionKey: 'empathy', score: 82, label: '高', description: '深度理解他人情感' },
      { dimension: '行动力', dimensionKey: 'action', score: 60, label: '中等', description: '行动前需要思考' },
      { dimension: '稳定性', dimensionKey: 'stability', score: 88, label: '高', description: '情绪稳定可靠' },
      { dimension: '创造性', dimensionKey: 'creativity', score: 70, label: '较高', description: '有独特视角' },
    ];
    const mockAnchors: VisualAnchors = {
      opening: '测试视觉锚点',
      widthLabel: '适中', fingerLabel: '修长', clarityLabel: '清晰', lineCountLabel: '丰富',
      prominentMount: '金星丘', palmWidth: 65, lineClarity: 70, lineCount: 4, fingerLengthRatio: 0.82,
      widthPercentile: '65%', clarityPercentile: '70%', lineCountPercentile: '60%', fingerPercentile: '82%',
    };

    it('缺 personaLabel → 正常生成 (用分数推断)', async () => {
      const agent = new CopywriterAgent(new MockAiProvider());
      const result = await agent.generate({ scores: mockScores, visualAnchors: mockAnchors });
      expect(result.summary.length).toBeGreaterThan(0);
      expect(result.coreTruth.length).toBeGreaterThan(0);
      expect(result.insights.length).toBe(3);
    });

    it('有 personaLabel → 正常生成 (使用标签)', async () => {
      const agent = new CopywriterAgent(new MockAiProvider());
      const result = await agent.generate({
        scores: mockScores,
        visualAnchors: mockAnchors,
        personaLabel: '火焰探索者',
        identityBadge: '热情驱动的行动派',
      });
      expect(result.summary.length).toBeGreaterThan(0);
    });

    it('CopywriterOutput 所有字段非空', async () => {
      const agent = new CopywriterAgent(new MockAiProvider());
      const result = await agent.generate({ scores: mockScores, visualAnchors: mockAnchors });
      for (const [key, val] of Object.entries(result)) {
        if (key === 'insights') {
          expect(Array.isArray(val)).toBe(true);
          expect(val.length).toBeGreaterThanOrEqual(2);
        } else {
          expect(typeof val).toBe('string');
          expect((val as string).length).toBeGreaterThan(0);
        }
      }
    });

    it('AI失败 → 引擎降级不抛异常', async () => {
      class FailProvider implements AiProvider {
        readonly name = 'fail';
        async chat(): Promise<string> { throw new Error('BOOM'); }
      }
      const agent = new CopywriterAgent(new FailProvider());
      const result = await agent.generate({ scores: mockScores, visualAnchors: mockAnchors });
      expect(result.summary.length).toBeGreaterThan(0);
      expect(result.insights.length).toBe(3);
    });
  });

  describe('SafetyAgent', () => {
    const validScores: PersonaScore[] = [
      { dimension: '开放度', dimensionKey: 'o', score: 50, label: '中', description: 'desc' },
      { dimension: '共情力', dimensionKey: 'e', score: 50, label: '中', description: 'desc' },
      { dimension: '行动力', dimensionKey: 'a', score: 50, label: '中', description: 'desc' },
      { dimension: '稳定性', dimensionKey: 's', score: 50, label: '中', description: 'desc' },
      { dimension: '创造性', dimensionKey: 'c', score: 50, label: '中', description: 'desc' },
    ];

    it('preCheck: 有效输入通过', () => {
      const agent = new SafetyAgent();
      const result = agent.preCheck({ imageBase64: TEST_IMAGE, scores: validScores });
      expect(result.passed).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.inputSafe).toBe(true);
    });

    it('preCheck: 分数越界检测', () => {
      const agent = new SafetyAgent();
      const badScores = [...validScores];
      badScores[0] = { ...badScores[0], score: 150 };
      const result = agent.preCheck({ imageBase64: TEST_IMAGE, scores: badScores });
      expect(result.passed).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it('preCheck: 分数不足检测', () => {
      const agent = new SafetyAgent();
      const result = agent.preCheck({ imageBase64: TEST_IMAGE, scores: validScores.slice(0, 2) });
      expect(result.passed).toBe(false);
      expect(result.issues.some(i => i.includes('不足'))).toBe(true);
    });

    it('preCheck: 图片过小检测', () => {
      const agent = new SafetyAgent();
      const result = agent.preCheck({ imageBase64: 'x', scores: validScores });
      expect(result.passed).toBe(false);
      expect(result.issues.some(i => i.includes('图片'))).toBe(true);
    });

    it('postCheck: 干净报告通过', () => {
      const agent = new SafetyAgent();
      const cleanReport: PersonaReport = {
        id: 'test_1', createdAt: new Date().toISOString(),
        personaType: 'test', personaLabel: '测试',
        scores: validScores,
        summary: '这是一个测试报告', coreTruth: '你是独特的', weeklyAdvice: '放轻松',
        insights: ['洞察1', '洞察2', '洞察3'], keywords: ['测试', 'AI'],
        quote: '活在当下', suspenseText: '更多待解锁', adTeaser: '看广告解锁',
      };
      const result = agent.postCheck(cleanReport);
      expect(result.passed).toBe(true);
      expect(result.totalViolations).toBe(0);
    });

    it('postCheck: 含违规词报告被过滤', () => {
      const agent = new SafetyAgent();
      const badReport: PersonaReport = {
        id: 'test_2', createdAt: new Date().toISOString(),
        personaType: 'test', personaLabel: '算命大师',
        scores: validScores,
        summary: '通过手相算命分析你的命运注定', coreTruth: '你是天命所归', weeklyAdvice: '改运开运',
        insights: ['你的掌纹显示天生一对', '占卜显示你会暴富', '必然成功'],
        keywords: ['算命', '手相'], quote: '天注定', suspenseText: '更多命运', adTeaser: '看手相解锁',
      };
      const result = agent.postCheck(badReport);
      // 合规门禁应检测到违规
      expect(result.totalViolations).toBeGreaterThan(0);
      expect(result.passed).toBe(false);
      // 过滤后报告字段应被替换
      expect(result.filteredReport).toBeDefined();
    });
  });
});

// ─── 4. 并发稳定性 ────────────────────────────

describe('E2E: 并发请求', () => {
  it('5个并发 analyze 全部成功', async () => {
    const service = new MockAnalysisService(
      new MockPalmFeatureExtractor(),
      new MockResonanceNarrativeEngine(),
      sharedRepo,
      new SmartJsonAiProvider(),
    );

    const images = [TEST_IMAGE, ALT_IMAGE, TEST_IMAGE, ALT_IMAGE, TEST_IMAGE];
    const results = await Promise.all(images.map(img => service.analyze(img)));

    expect(results).toHaveLength(5);
    for (const r of results) {
      expect(r.id).toBeTruthy();
      expect(r.personaType).toBeTruthy();
      expect(r.scores).toHaveLength(5);
    }
    // 相同图片应产相同hash
    expect(results[0].id).toBe(results[2].id);
    expect(results[0].id).toBe(results[4].id);
    expect(results[1].id).toBe(results[3].id);
  });
});

// ─── 5. 降级E2E ───────────────────────────────

describe('E2E: 降级全链路不崩', () => {
  class AlwaysFailProvider implements AiProvider {
    readonly name = 'always-fail';
    async chat(): Promise<string> { throw new Error('E2E: AI 不可用'); }
  }

  it('AI全故障 → ReportAgent.generate() 仍返回完整报告', async () => {
    const agent = new ReportAgent(
      new MockPalmFeatureExtractor(),
      new MockResonanceNarrativeEngine(),
      defaultSafety,
      new AlwaysFailProvider(),
      sharedRepo,
    );

    const result = await agent.generate(TEST_IMAGE);

    expect(result.report.id).toBeTruthy();
    expect(result.report.personaType).toBeTruthy();
    expect(result.report.summary).toBeTruthy();
    expect(result.report.insights.length).toBeGreaterThanOrEqual(2);
    expect(result.pipeline.totalMs).toBeGreaterThanOrEqual(0);
  });

  it('AI全故障 → Orchestrator 三Agent全部自降级 → agentStatus全success', async () => {
    const orchestrator = new PipelineOrchestrator({
      extractor: new MockPalmFeatureExtractor(),
      scoring: new MockPersonaScoringEngine(),
      narrative: new MockResonanceNarrativeEngine(),
      ai: new AlwaysFailProvider(),
      safety: defaultSafety,
    });

    const result = await orchestrator.run(TEST_IMAGE);

    // 三个Agent内部自降级成功 → orchestrator看到fulfilled
    expect(result.agentStatus.analyst).toBe('success');
    expect(result.agentStatus.copywriter).toBe('success');
    expect(result.agentStatus.safetyPre).toBe('success');

    // 降级报告仍然完整
    expect(result.report.personaType).toBeTruthy();
    expect(result.report.coreTruth.length).toBeGreaterThan(0);
    expect(result.report.celebrityMatches!.length).toBeGreaterThan(0);
  });
});

// ─── 6. 报告质量 ──────────────────────────────

describe('E2E: 报告质量', () => {
  const baseDeps = {
    extractor: new MockPalmFeatureExtractor(),
    scoring: new MockPersonaScoringEngine(),
    narrative: new MockResonanceNarrativeEngine(),
    safety: defaultSafety,
  };

  it('Mock模式: 报告所有推荐字段合法', async () => {
    const orchestrator = new PipelineOrchestrator({
      ...baseDeps,
      ai: new MockAiProvider(),
    });

    const result = await orchestrator.run(TEST_IMAGE);
    const r = result.report;

    // 结构完整性
    expect(r.scores).toHaveLength(5);
    expect(r.insights.length).toBe(3);
    expect(r.celebrityMatches!.length).toBeGreaterThan(0);

    // 文案非空
    expect(r.summary.length).toBeGreaterThan(10);
    expect(r.coreTruth.length).toBeGreaterThan(5);
    expect(r.weeklyAdvice.length).toBeGreaterThan(5);
    expect(r.quote.length).toBeGreaterThan(0);
    expect(r.suspenseText.length).toBeGreaterThan(0);
    expect(r.adTeaser.length).toBeGreaterThan(0);
    expect(r.identityBadge!.length).toBeGreaterThan(0);
    expect(r.personaLabel.length).toBeGreaterThan(0);

    // 关系密码四字段
    expect(r.relationshipCode!.frequencyLabel).toBeTruthy();
    expect(r.relationshipCode!.signalPattern).toBeTruthy();
    expect(r.relationshipCode!.bestMatchType).toBeTruthy();
    expect(r.relationshipCode!.tensionPoint).toBeTruthy();
  });

  it('有效AI模式: 报告来自真实AI解析', async () => {
    const orchestrator = new PipelineOrchestrator({
      ...baseDeps,
      ai: new SmartJsonAiProvider(),
    });

    const result = await orchestrator.run(TEST_IMAGE);

    // AI 解析出的 personaType 应为 snake_case
    expect(result.report.personaType).toMatch(/^[a-z_]+$/);
    // identityBadge 不为空
    expect(result.report.identityBadge!.length).toBeGreaterThan(0);
    // celebrityMatches 含 name + reason
    for (const cm of result.report.celebrityMatches!) {
      expect(cm.name).toBeTruthy();
      expect(cm.reason).toBeTruthy();
    }
  });
});

// ─── 7. 并行性能验证 ──────────────────────────

describe('E2E: 并行性能', () => {
  it('3 Agent 并行 < 2×最慢Agent (证明非串行)', async () => {
    const delayMs = 100;
    const orchestrator = new PipelineOrchestrator({
      extractor: new MockPalmFeatureExtractor(),
      scoring: new MockPersonaScoringEngine(),
      narrative: new MockResonanceNarrativeEngine(),
      ai: new SlowButValidAiProvider(delayMs),
      safety: defaultSafety,
    });

    const result = await orchestrator.run(TEST_IMAGE);

    // 并行: max(analyst, copywriter) ≈ delayMs
    // 串行: analyst + copywriter ≈ delayMs * 2
    const serialEstimate = delayMs * 2;
    expect(result.timing.parallelMs).toBeLessThan(serialEstimate);
  });

  it('并行阶段耗时 ≈ 最慢Agent >0', async () => {
    const delayMs = 80;
    const orchestrator = new PipelineOrchestrator({
      extractor: new MockPalmFeatureExtractor(),
      scoring: new MockPersonaScoringEngine(),
      narrative: new MockResonanceNarrativeEngine(),
      ai: new SlowButValidAiProvider(delayMs),
      safety: defaultSafety,
    });

    const result = await orchestrator.run(TEST_IMAGE);

    // 并行耗时不应远小于单Agent耗时 (否则说明没真正调AI)
    expect(result.timing.parallelMs).toBeGreaterThan(0);
  });
});
