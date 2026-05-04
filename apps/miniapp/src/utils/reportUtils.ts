// 报告页共享工具函数
export interface ScoreItem {
  dimension: string;
  dimensionKey: string;
  score: number;
  label: string;
  description: string;
}

interface DimensionTemplate {
  high: string;
  low: string;
}

const MISUNDERSTOOD_TEMPLATES: Record<string, DimensionTemplate> = {
  emotionalResonance: {
    high: '你以为TA情绪化，其实TA只是不想在你面前藏。那些眼泪和笑容都是真的——TA对重要的人不设防。',
    low: '你以为TA不在乎，其实TA只是不习惯表达。TA心里已经翻了一百页，嘴上只翻了一页。',
  },
  communicationSync: {
    high: '你以为TA话多，其实TA是在意冷场。TA怕尴尬、怕沉默、怕你不舒服——TA的话痨是一种体贴。',
    low: '你以为TA冷漠，其实TA只是还没想好怎么开口。TA的沉默不是拒绝，是没找到对的入口。',
  },
  actionComplement: {
    high: '你以为TA冲动，其实TA已经想了三遍才动手。TA的"快"是因为大脑跑得比嘴巴快。',
    low: '你以为TA犹豫，其实TA是在等最佳时机。TA不动不是怕，是在算最稳的那步。',
  },
  trustPotential: {
    high: '你以为TA对人没防备，其实TA心里有一本账。TA的真诚是真的，但TA从不轻易交底。',
    low: '你以为TA疏远，其实TA只是需要时间相信你。一旦信任成立，TA就是那种不会走的人。',
  },
  frictionRisk: {
    high: '你以为TA脾气大，其实TA只是不忍了。TA忍了很久才发作——那不是脾气，是边界被踩穿的信号。',
    low: '你以为TA没脾气，其实TA只是不想让你难堪。TA把不舒服都自己消化了——但容量再大也有上限。',
  },
};

// 找出最被误解的维度并返回文案
export function getMostMisunderstood(scores: ScoreItem[]): string | null {
  const extreme = [...scores].sort(
    (a, b) => Math.abs(b.score - 50) - Math.abs(a.score - 50),
  )[0];
  if (!extreme) return null;

  const isHigh = extreme.score > 65;
  const isLow = extreme.score < 35;
  const t = MISUNDERSTOOD_TEMPLATES[extreme.dimensionKey];

  if (!t) return `${extreme.dimension}得分${extreme.score}分——你看到的只是冰山一角。`;
  if (isHigh) return t.high;
  if (isLow) return t.low;
  return `${extreme.dimension}得分${extreme.score}分——这比你想象中更说明问题。`;
}

// 卡片序号→卡片标题
export function getCardTitle(cardIndex: number): string {
  const titles: Record<number, string> = {
    1: '你的人格身份证',
    2: '你最容易被误解的地方',
    3: '你的关系频率密码',
    4: 'AI 从你的手掌读取到',
    5: '你的「名人同频」彩蛋',
    6: '本周给你的建议',
  };
  return titles[cardIndex] ?? '掌心人格局';
}
