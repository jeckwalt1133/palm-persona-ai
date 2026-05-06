/**
 * 管线编排器 — Multi-Agent并行调度核心
 *
 * 将原串行管线重构为3Agent并行协作:
 *   上传 → Orchestrator → {Analyst ‖ Copywriter ‖ Safety.preCheck} → 聚合 → Safety.postCheck → 返回
 *
 * 目标延迟: 3-6s (原串行 8-15s)
 * 降级策略: Promise.allSettled → 单Agent失败不影响其他 → 兜底值填充
 */

import { PalmFeatureExtractor, MockPalmFeatureExtractor, RealPalmFeatureExtractor } from '../engine/palm-feature-extractor.js';
import { PersonaScoringEngine, MockPersonaScoringEngine } from '../engine/persona-scoring-engine.js';
import { ResonanceNarrativeEngine, MockResonanceNarrativeEngine } from '../engine/resonance-narrative-engine.js';
import { ContentSafety, defaultSafety } from '../safety/content-safety.js';
import { AiProvider, MockAiProvider } from '../ai/index.js';
import {
  PersonaReport,
} from '../engine/types.js';

import { AnalystAgent, AnalystOutput } from './analyst-agent.js';
import { CopywriterAgent, CopywriterOutput } from './copywriter-agent.js';
import { SafetyAgent, SafetyInput, SafetyPreCheckResult, SafetyPostCheckResult } from './safety-agent.js';
import { buildVisualAnchors } from '../engine/report-pipeline.js';

// ─── 类型 ────────────────────────────────────────

export interface AgentStatus {
  analyst: 'success' | 'degraded' | 'failed';
  copywriter: 'success' | 'degraded' | 'failed';
  safetyPre: 'success' | 'degraded' | 'failed';
}

export interface OrchestratorTiming {
  extractMs: number;
  scoreMs: number;
  parallelMs: number;
  safetyPostMs: number;
  totalMs: number;
}

export interface OrchestratorResult {
  report: PersonaReport;
  agentStatus: AgentStatus;
  timing: OrchestratorTiming;
}

export interface OrchestratorDeps {
  extractor: PalmFeatureExtractor;
  scoring: PersonaScoringEngine;
  narrative: ResonanceNarrativeEngine;
  ai: AiProvider;
  safety: ContentSafety;
}

// ─── 降级常量 ────────────────────────────────────

const DEGRADED_ANALYST: AnalystOutput = {
  personaType: 'flame_explorer',
  personaLabel: '火焰探索者',
  identityBadge: '热情驱动的行动派',
  relationshipCode: {
    frequencyLabel: '同频共振型',
    signalPattern: '你的手掌特征指向一种真诚直率的沟通风格',
    bestMatchType: '坦诚行动派',
    tensionPoint: '你渴望深度连接，但有时候会因过度照顾他人感受而消耗自己',
  },
  celebrityMatches: [{ name: '未知', title: '待AI分析', reason: 'Agent 降级后使用默认匹配' }],
};

const DEGRADED_COPYWRITER: CopywriterOutput = {
  summary: '你的手掌轮廓独特，五维人格画像呈现出丰富的内在世界。每个维度都指向一种真实而立体的性格特质——没有绝对的高低，只有属于你的独特比例。',
  coreTruth: '你比你想象的更有力量',
  weeklyAdvice: '本周尝试一次小小的冒险，走出舒适区会带来意想不到的收获',
  insights: ['你拥有敏锐的直觉，有时候比理性分析更值得信赖', '在关系中你既能给予温暖也能守住边界，这是难得的能力', '你的创造力在放松时最活跃，给自己留一些空白时间'],
  quote: '成为自己，是一生的浪漫',
  suspenseText: '这仅仅是冰山一角——你的深层人格画像还有更多维度等待解锁',
  adTeaser: '看30秒广告解锁完整报告',
};

// ─── 工厂 ────────────────────────────────────────

function createExtractor(): PalmFeatureExtractor {
  try { return new RealPalmFeatureExtractor(); }
  catch { return new MockPalmFeatureExtractor(); }
}

const defaultDeps: OrchestratorDeps = {
  extractor: createExtractor(),
  scoring: new MockPersonaScoringEngine(),
  narrative: new MockResonanceNarrativeEngine(),
  ai: new MockAiProvider(),
  safety: defaultSafety,
};

// ─── Orchestrator ────────────────────────────────

export class PipelineOrchestrator {
  private analyst: AnalystAgent;
  private copywriter: CopywriterAgent;
  private safetyAgent: SafetyAgent;
  private extractor: PalmFeatureExtractor;
  private scoring: PersonaScoringEngine;

  constructor(deps?: Partial<OrchestratorDeps>) {
    const d: OrchestratorDeps = { ...defaultDeps, ...deps };
    this.extractor = d.extractor;
    this.scoring = d.scoring;
    this.analyst = new AnalystAgent(d.ai);
    this.copywriter = new CopywriterAgent(d.ai);
    this.safetyAgent = new SafetyAgent(d.safety);
  }

  async run(imageBase64: string): Promise<OrchestratorResult> {
    const t0 = Date.now();

    // Worker 1: 特征提取
    const t1 = Date.now();
    const features = await this.extractor.extract(Buffer.from(imageBase64, 'base64'));
    const extractMs = Date.now() - t1;

    // Worker 2: 五维评分
    const t2 = Date.now();
    const scores = this.scoring.score(features);
    const scoreMs = Date.now() - t2;

    // 构建视觉锚点
    const visualAnchors = buildVisualAnchors(features);

    // ── 并行阶段: 3 Agent 同时执行 ──
    const t3 = Date.now();

    const safetyInput: SafetyInput = { imageBase64, scores };
    const [analystResult, copywriterResult, safetyPreResult] = await Promise.allSettled([
      this.analyst.analyze({ scores, visualAnchors }),
      this.copywriter.generate({ scores, visualAnchors }),
      Promise.resolve(this.safetyAgent.preCheck(safetyInput)),
    ]);

    const parallelMs = Date.now() - t3;

    // ── 解析并行结果 (降级不崩溃) ──
    const agentStatus: AgentStatus = {
      analyst: 'success',
      copywriter: 'success',
      safetyPre: 'success',
    };

    const analyst: AnalystOutput = this.unwrapAnalyst(analystResult, agentStatus);
    const copywriter: CopywriterOutput = this.unwrapCopywriter(copywriterResult, agentStatus);
    const safetyPre: SafetyPreCheckResult = this.unwrapSafetyPre(safetyPreResult, agentStatus);

    // 预检告警 (不阻断管线)
    if (!safetyPre.passed) {
      console.warn('[Orchestrator] 输入预检未通过:', safetyPre.issues.join(', '));
    }

    // ── 聚合为 PersonaReport ──
    const t5 = Date.now();
    const report: PersonaReport = {
      id: features.hash,
      createdAt: new Date().toISOString(),
      personaType: analyst.personaType,
      personaLabel: analyst.personaLabel,
      identityBadge: analyst.identityBadge,
      scores,
      summary: copywriter.summary,
      coreTruth: copywriter.coreTruth,
      weeklyAdvice: copywriter.weeklyAdvice,
      insights: copywriter.insights,
      keywords: scores.map(s => s.label),
      quote: copywriter.quote,
      suspenseText: copywriter.suspenseText,
      adTeaser: copywriter.adTeaser,
      visualAnchors,
      relationshipCode: analyst.relationshipCode,
      celebrityMatches: analyst.celebrityMatches,
    };

    // ── 输出合规门禁 ──
    const safetyPost: SafetyPostCheckResult = this.safetyAgent.postCheck(report);
    const safetyPostMs = Date.now() - t5;

    return {
      report: safetyPost.filteredReport,
      agentStatus,
      timing: {
        extractMs,
        scoreMs,
        parallelMs,
        safetyPostMs,
        totalMs: Date.now() - t0,
      },
    };
  }

  // ─── 结果解包 (allSettled → 值或降级) ──────────

  private unwrapAnalyst(
    result: PromiseSettledResult<AnalystOutput>,
    status: AgentStatus,
  ): AnalystOutput {
    if (result.status === 'fulfilled') return result.value;
    status.analyst = 'failed';
    console.warn('[Orchestrator] AnalystAgent 失败，使用降级输出:', result.reason?.message);
    return { ...DEGRADED_ANALYST };
  }

  private unwrapCopywriter(
    result: PromiseSettledResult<CopywriterOutput>,
    status: AgentStatus,
  ): CopywriterOutput {
    if (result.status === 'fulfilled') return result.value;
    status.copywriter = 'failed';
    console.warn('[Orchestrator] CopywriterAgent 失败，使用降级输出:', result.reason?.message);
    return { ...DEGRADED_COPYWRITER };
  }

  private unwrapSafetyPre(
    result: PromiseSettledResult<SafetyPreCheckResult>,
    status: AgentStatus,
  ): SafetyPreCheckResult {
    if (result.status === 'fulfilled') return result.value;
    status.safetyPre = 'failed';
    console.warn('[Orchestrator] SafetyAgent.preCheck 失败，假定输入安全');
    return { passed: true, issues: [], inputSafe: true };
  }
}
