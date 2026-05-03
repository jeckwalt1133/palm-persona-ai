import { PalmFeatures, AnalysisContext, PersonaReport, PersonaScore } from './types.js';
import { getAllTemplates, pickQuote, assembleReport, QUOTE_ENTRIES, getDimensions, pickSuspenseText } from './persona-templates.js';
import { simpleHash } from '../utils/hash.js';

export interface ResonanceNarrativeEngine {
  generate(features: PalmFeatures, context?: AnalysisContext): PersonaReport;
}

export class MockResonanceNarrativeEngine implements ResonanceNarrativeEngine {
  generate(features: PalmFeatures, _context?: AnalysisContext): PersonaReport {
    const hash = simpleHash(features.hash);
    const templates = getAllTemplates();
    const template = templates[hash % templates.length];
    const dimensions = getDimensions();

    // 基于模板 baseScores 加确定性扰动，保持人格与分数一致
    const scores: PersonaScore[] = dimensions.map((dim, i) => {
      const base = template.baseScores[i];
      // 用 hash 的不同位产生 ±10 的扰动
      const jitter = ((hash >>> (i * 3)) & 15) - 7;
      const score = Math.max(5, Math.min(95, base + jitter));

      return {
        dimension: dim.label,
        dimensionKey: dim.key,
        score,
        label: scoreLabel(dim.key, score),
        description: scoreDescription(dim.key, score),
      };
    });

    const quote = pickQuote(hash % QUOTE_ENTRIES.length);
    const suspenseText = pickSuspenseText(hash);
    return assembleReport(features.hash, template, scores, quote, hash, suspenseText);
  }
}

function scoreLabel(key: string, score: number): string {
  const labels: Record<string, string[]> = {
    emotionalResonance: ['理性平稳', '感性平衡', '情绪充沛'],
    communicationSync: ['内向含蓄', '收放自如', '外向活跃'],
    actionComplement: ['深思熟虑', '稳健行动', '行动导向'],
    trustPotential: ['保持距离', '谨慎信任', '开放信任'],
    frictionRisk: ['和谐包容', '偶尔摩擦', '个性鲜明'],
  };
  const idx = score <= 33 ? 0 : score <= 66 ? 1 : 2;
  return labels[key]?.[idx] ?? '未知';
}

function scoreDescription(key: string, score: number): string {
  const descs: Record<string, string[]> = {
    emotionalResonance: [
      '你的情绪世界平静深邃，不轻易波动',
      '你能够感知情绪流动，同时保持平衡',
      '你的情感丰富而敏锐，像一台高灵敏度的天线',
    ],
    communicationSync: [
      '你更喜欢独处或小范围的深度交流',
      '你能在不同社交场景中切换自如',
      '你享受与人连接，是人群中的频率发射站',
    ],
    actionComplement: [
      '你习惯先观察再出手，每一步都经过衡量',
      '你在思考与行动之间找到了自己的节奏',
      '你想到就做，行动是你的第一反应',
    ],
    trustPotential: [
      '你对关系有天然的警惕心，信任需要时间',
      '你愿意给予信任，但也会保持观察',
      '你倾向于先相信他人，坦诚是你的底色',
    ],
    frictionRisk: [
      '你在关系中展现出难得的包容和灵活性',
      '你有自己的原则，但不会轻易和他人碰撞',
      '你有强烈的自我边界，不轻易妥协',
    ],
  };
  const idx = score <= 33 ? 0 : score <= 66 ? 1 : 2;
  return descs[key]?.[idx] ?? '需要更多数据来分析';
}
