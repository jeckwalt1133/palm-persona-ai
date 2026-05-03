import { PalmFeatures, AnalysisContext, PersonaScore } from './types.js';

export interface PersonaScoringEngine {
  score(features: PalmFeatures, context?: AnalysisContext): PersonaScore[];
}

const DIMENSIONS = [
  { key: 'emotionalResonance', label: '情绪频率' },
  { key: 'communicationSync', label: '沟通同步' },
  { key: 'actionComplement', label: '行动互补' },
  { key: 'trustPotential', label: '信任潜力' },
  { key: 'frictionRisk', label: '摩擦风险' },
];

const LABELS: Record<string, { low: string; mid: string; high: string }> = {
  emotionalResonance: { low: '理性平稳', mid: '感性平衡', high: '情绪充沛' },
  communicationSync: { low: '内向含蓄', mid: '收放自如', high: '外向活跃' },
  actionComplement: { low: '深思熟虑', mid: '稳健行动', high: '行动导向' },
  trustPotential: { low: '保持距离', mid: '谨慎信任', high: '开放信任' },
  frictionRisk: { low: '和谐包容', mid: '偶尔摩擦', high: '个性鲜明' },
};

const DESCRIPTIONS: Record<string, { low: string; mid: string; high: string }> = {
  emotionalResonance: {
    low: '你的情绪世界平静深邃，不轻易波动',
    mid: '你能够感知情绪流动，同时保持平衡',
    high: '你的情感丰富而敏锐，像一台高灵敏度的天线',
  },
  communicationSync: {
    low: '你更喜欢独处或小范围的深度交流',
    mid: '你能在不同社交场景中切换自如',
    high: '你享受与人连接，是人群中的频率发射站',
  },
  actionComplement: {
    low: '你习惯先观察再出手，每一步都经过衡量',
    mid: '你在思考与行动之间找到了自己的节奏',
    high: '你想到就做，行动是你的第一反应',
  },
  trustPotential: {
    low: '你对关系有天然的警惕心，信任需要时间',
    mid: '你愿意给予信任，但也会保持观察',
    high: '你倾向于先相信他人，坦诚是你的底色',
  },
  frictionRisk: {
    low: '你在关系中展现出难得的包容和灵活性',
    mid: '你有自己的原则，但不会轻易和他人碰撞',
    high: '你有强烈的自我边界，不轻易妥协',
  },
};

function hashToSeed(features: PalmFeatures): number {
  const h = features.hash.replace('palm_', '');
  return parseInt(h.slice(0, 4), 16);
}

export class MockPersonaScoringEngine implements PersonaScoringEngine {
  score(features: PalmFeatures, _context?: AnalysisContext): PersonaScore[] {
    const seed = hashToSeed(features);

    return DIMENSIONS.map((dim, i) => {
      const a = (seed * (i + 1) * 7919) ^ (i * 6271);
      const b = (a >>> 8) ^ ((a & 0xFF) << 8);
      const raw = (b * 2654435761) >>> 0;
      const score = 5 + (raw % 91);

      let label: string;
      let description: string;
      const d = LABELS[dim.key];
      const desc = DESCRIPTIONS[dim.key];

      if (score <= 33) {
        label = d.low;
        description = desc.low;
      } else if (score <= 66) {
        label = d.mid;
        description = desc.mid;
      } else {
        label = d.high;
        description = desc.high;
      }

      return {
        dimension: dim.label,
        dimensionKey: dim.key,
        score,
        label,
        description,
      };
    });
  }
}
