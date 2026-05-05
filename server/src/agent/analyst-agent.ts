/**
 * 分析Agent — 人格类型判定 + 关系分析 + 名人匹配
 *
 * 职责: 接收五维评分和视觉锚点，调用 AI 推断人格类型、
 * 关系模式、名人彩蛋。不生成面向用户的文案。
 */

import { AiProvider, MockAiProvider } from '../ai/index.js';
import { PersonaScore, VisualAnchors, RelationshipCode, CelebrityMatch } from '../engine/types.js';
import { withTimeout, parseAiJson } from './agent-utils.js';

export interface AnalystInput {
  scores: PersonaScore[];
  visualAnchors: VisualAnchors;
}

export interface AnalystOutput {
  personaType: string;
  personaLabel: string;
  identityBadge: string;
  relationshipCode: RelationshipCode;
  celebrityMatches: CelebrityMatch[];
}

const FALLBACK_OUTPUT: AnalystOutput = {
  personaType: 'flame_explorer',
  personaLabel: '火焰探索者',
  identityBadge: '热情驱动的行动派',
  relationshipCode: {
    frequencyLabel: '同频共振型',
    signalPattern: '你的手掌特征指向一种真诚直率的沟通风格',
    bestMatchType: '坦诚行动派',
    tensionPoint: '你渴望深度连接，但有时候会因过度照顾他人感受而消耗自己',
  },
  celebrityMatches: [{ name: '未知', title: '待AI分析', reason: 'AI Provider 降级后使用默认匹配' }],
};

export class AnalystAgent {
  private ai: AiProvider;
  private timeoutMs: number;

  constructor(ai?: AiProvider, timeoutMs = 15000) {
    this.ai = ai ?? new MockAiProvider();
    this.timeoutMs = timeoutMs;
  }

  async analyze(input: AnalystInput): Promise<AnalystOutput> {
    if (this.ai.name === 'mock') return { ...FALLBACK_OUTPUT };

    const { scores, visualAnchors } = input;
    const topScore = [...scores].sort((a, b) => b.score - a.score)[0];
    const lowScore = [...scores].sort((a, b) => a.score - b.score)[scores.length - 1];

    const prompt = `五维人格分数：
${scores.map(s => `  ${s.dimension}(${s.dimensionKey}): ${s.score}分 — ${s.label}`).join('\n')}

最高维: ${topScore.dimension}(${topScore.score}分)
最低维: ${lowScore.dimension}(${lowScore.score}分)
视觉锚点: ${visualAnchors.opening}

输出JSON (不要markdown包裹):
{
  "personaType": "snake_case英文",
  "personaLabel": "中文人格标签(如'锐意开拓者·行动派型')",
  "identityBadge": "一句话身份标识(10字以内)",
  "relationshipCode": {
    "frequencyLabel": "关系频率标签",
    "signalPattern": "信号模式描述(40字)",
    "bestMatchType": "最佳匹配类型",
    "tensionPoint": "关系张力点(40字)"
  },
  "celebrityMatches": [
    {"name": "名人姓名", "title": "身份", "reason": "匹配理由(30字)"},
    {"name": "名人姓名", "title": "身份", "reason": "匹配理由(30字)"}
  ]
}`;

    try {
      const raw = await withTimeout(
        this.ai.chat([
          { role: 'system', content: '你是掌心人格局的人格分析引擎。根据五维分数和手掌特征推断人格类型、关系模式和名人匹配。输出纯JSON。' },
          { role: 'user', content: prompt },
        ], { temperature: 0.7, maxTokens: 600 }),
        this.timeoutMs,
      );

      const parsed = parseAiJson(raw);
      return {
        personaType: parsed.personaType || FALLBACK_OUTPUT.personaType,
        personaLabel: parsed.personaLabel || FALLBACK_OUTPUT.personaLabel,
        identityBadge: parsed.identityBadge || FALLBACK_OUTPUT.identityBadge,
        relationshipCode: parsed.relationshipCode || FALLBACK_OUTPUT.relationshipCode,
        celebrityMatches: Array.isArray(parsed.celebrityMatches) && parsed.celebrityMatches.length > 0
          ? parsed.celebrityMatches : FALLBACK_OUTPUT.celebrityMatches,
      };
    } catch (err) {
      console.warn('[AnalystAgent] AI 调用失败，使用降级输出:', (err as Error).message);
      return { ...FALLBACK_OUTPUT };
    }
  }
}

export { withTimeout };
