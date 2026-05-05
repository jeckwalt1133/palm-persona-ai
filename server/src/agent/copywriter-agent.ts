/**
 * 文案Agent — 用户可见文本生成
 *
 * 职责: 接收五维评分、视觉锚点和人格类型，生成所有面向用户的文案。
 * 可与分析Agent并行——先用视觉特征预生成，分析完成后微调 personaLabel/identityBadge。
 */

import { AiProvider, MockAiProvider } from '../ai/index.js';
import { PersonaScore, VisualAnchors } from '../engine/types.js';
import { ResonanceNarrativeEngine, MockResonanceNarrativeEngine } from '../engine/resonance-narrative-engine.js';
import { withTimeout, parseAiJson } from './agent-utils.js';

export interface CopywriterInput {
  scores: PersonaScore[];
  visualAnchors: VisualAnchors;
  personaType?: string;       // 分析Agent 产出 (可选——预生成时可能还没拿到)
  personaLabel?: string;      // 分析Agent 产出 (可选)
  identityBadge?: string;     // 分析Agent 产出 (可选)
}

export interface CopywriterOutput {
  summary: string;
  coreTruth: string;
  weeklyAdvice: string;
  insights: string[];
  quote: string;
  suspenseText: string;
  adTeaser: string;
}

export class CopywriterAgent {
  private ai: AiProvider;
  private engine: ResonanceNarrativeEngine;
  private timeoutMs: number;

  constructor(ai?: AiProvider, timeoutMs = 15000) {
    this.ai = ai ?? new MockAiProvider();
    this.engine = new MockResonanceNarrativeEngine();
    this.timeoutMs = timeoutMs;
  }

  async generate(input: CopywriterInput): Promise<CopywriterOutput> {
    if (this.ai.name === 'mock') {
      return this.engineFallback(input);
    }

    const { scores, visualAnchors, personaLabel, identityBadge } = input;
    const topScore = [...scores].sort((a, b) => b.score - a.score)[0];
    const lowScore = [...scores].sort((a, b) => a.score - b.score)[scores.length - 1];

    const personaHint = personaLabel
      ? `人格标签: ${personaLabel} / 身份: ${identityBadge || ''}`
      : '人格标签: 待分析 (用分数推断)';

    const prompt = `五维分数：
${scores.map(s => `  ${s.dimension}(${s.dimensionKey}): ${s.score}分 — ${s.label}`).join('\n')}

最高维: ${topScore.dimension}(${topScore.score}分) — ${topScore.description}
最低维: ${lowScore.dimension}(${lowScore.score}分) — ${lowScore.description}
视觉锚点: ${visualAnchors.opening}
${personaHint}

输出JSON (不要markdown包裹):
{
  "summary": "综合解读(200字以内,用'你'第二人称,温暖走心)",
  "coreTruth": "一句戳中核心的话(让人想截图发给某个人)",
  "weeklyAdvice": "本周建议(50字以内,具体可操作)",
  "quote": "一句金句(15字以内)",
  "suspenseText": "一句悬念引导语(告知还有更深层分析可解锁)",
  "adTeaser": "广告解锁引导语(20字以内,引导分享或看广告解锁完整报告)",
  "insights": ["洞察1(温和刺痛)", "洞察2(精确共鸣)", "洞察3(正向赋能)"]
}`;

    try {
      const raw = await withTimeout(
        this.ai.chat([
          { role: 'system', content: '你是掌心人格局的文案引擎。要求：①每句话让人想截图发给朋友 ②温和刺痛+精确共鸣 ③不空泛不恐吓 ④用"倾向于""更容易""大概率""趣味语境下"等弱化措辞。输出纯JSON。' },
          { role: 'user', content: prompt },
        ], { temperature: 0.8, maxTokens: 1200 }),
        this.timeoutMs,
      );

      const parsed = parseAiJson(raw);
      return {
        summary: parsed.summary || '',
        coreTruth: parsed.coreTruth || '',
        weeklyAdvice: parsed.weeklyAdvice || '',
        quote: parsed.quote || '',
        suspenseText: parsed.suspenseText || '',
        adTeaser: parsed.adTeaser || '',
        insights: Array.isArray(parsed.insights) ? parsed.insights : [],
      };
    } catch (err) {
      console.warn('[CopywriterAgent] AI 调用失败，使用引擎降级:', (err as Error).message);
      return this.engineFallback(input);
    }
  }

  private engineFallback(input: CopywriterInput): CopywriterOutput {
    const result = this.engine.generate({
      hash: `copywriter_${Date.now()}`,
      palmWidth: input.visualAnchors.palmWidth,
      fingerLengthRatio: input.visualAnchors.fingerLengthRatio,
      lineClarity: input.visualAnchors.lineClarity,
      lineCount: input.visualAnchors.lineCount,
      mountProminence: [50, 50, 50, 60, 50],
    });

    return {
      summary: result.summary,
      coreTruth: result.coreTruth,
      weeklyAdvice: result.weeklyAdvice,
      insights: result.insights,
      quote: result.quote,
      suspenseText: result.suspenseText || '',
      adTeaser: result.adTeaser || '',
    };
  }
}

export { withTimeout };
