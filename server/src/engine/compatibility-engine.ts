import { PersonaScore, MatchDimension, CompatibilityResult } from './types.js';

export type { MatchDimension, CompatibilityResult };

export interface CompatibilityEngine {
  match(personaA: PersonaScore[], personaB: PersonaScore[]): CompatibilityResult;
}

const DIMENSION_NAMES = ['情绪频率', '沟通同步', '行动互补', '信任潜力', '摩擦风险'];

function complementScore(a: number, b: number, dim: number): number {
  const diff = Math.abs(a - b);
  if (dim === 4) {
    // 摩擦风险：分数接近为好（双方都低摩擦为佳）
    return Math.max(10, 100 - diff * 1.2);
  }
  // 其他维度：相似度高或适度互补都加分
  let bonus = 0;
  if (diff <= 15) bonus = 20;       // 高度相似
  else if (diff <= 30) bonus = 10;  // 比较相似
  else if (diff <= 55) bonus = 15;  // 适度互补

  return Math.min(95, Math.max(10, (a + b) / 2 + bonus));
}

const MATCH_DESCRIPTIONS: Record<string, string[]> = {
  emotionalResonance: [
    '你们的情感频率相似，容易理解彼此的情绪状态',
    '一方的沉稳平衡了另一方的敏感，形成良好的情感互补',
    '情绪表达方式差异较大，需要更多的耐心和理解',
  ],
  communicationSync: [
    '沟通节奏自然合拍，交流不费力',
    '一人健谈一人倾听，形成了舒适的对话模式',
    '沟通风格差异明显，需要找到共同的频率',
  ],
  actionComplement: [
    '行动节奏匹配，协作起来高效顺畅',
    '一方规划一方执行，是很好的互补搭档',
    '行动风格差异较大，需要明确分工来减少摩擦',
  ],
  trustPotential: [
    '双方都愿意敞开心扉，信任基础牢固',
    '信任在逐步建立中，有很好的发展潜力',
    '建立深度信任需要更多的时间和共同经历',
  ],
  frictionRisk: [
    '冲突概率低，双方都善于包容和理解',
    '偶尔有分歧，但能够理性处理',
    '个性都比较鲜明，学会求同存异是关键',
  ],
};

export class MockCompatibilityEngine implements CompatibilityEngine {
  match(personaA: PersonaScore[], personaB: PersonaScore[]): CompatibilityResult {
    const dimensions = personaA.map((dimA, i) => {
      const dimB = personaB[i];
      const score = Math.round(complementScore(dimA.score, dimB.score, i));

      const descriptions = MATCH_DESCRIPTIONS[dimA.dimensionKey];
      let descIndex: number;
      if (score >= 70) descIndex = 0;
      else if (score >= 40) descIndex = 1;
      else descIndex = 2;

      return {
        name: DIMENSION_NAMES[i],
        score,
        description: descriptions?.[descIndex] ?? '',
      };
    });

    const overall = Math.round(dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length);

    let summary: string;
    if (overall >= 80) summary = '你们是高度共鸣的组合，频率匹配度很高。彼此的差异成为互补，相似成为默契。这是一段值得珍惜的关系频率。';
    else if (overall >= 60) summary = '你们在很多维度上有不错的共鸣，虽然也有差异，但差异恰好为关系增添了层次。随着了解加深，匹配度还有上升空间。';
    else if (overall >= 40) summary = '你们在某些方面很有默契，在另一些方面则需要更多磨合。差异不是障碍，而是彼此成长的机会。多一份理解，就多一份共鸣。';
    else summary = '你们的频率差异较大，但这并不意味着不合适。有时候，最长久的伙伴关系恰恰来自截然不同的灵魂。差异让彼此看见世界的另一面。';

    return { overall, dimensions, summary };
  }
}
