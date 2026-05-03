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
      // 低（0-33）
      '你的情绪世界平静深邃，不轻易波动',
      '你习惯把情绪藏起来，不让人轻易看透',
      '你的情绪表达含蓄而克制，像深湖表面',
      '你很少情绪化，理性是你的第一反应',
      // 中（34-66）
      '你能够感知情绪流动，同时保持平衡',
      '你的情绪雷达敏感但可控，不会过度反应',
      '你懂得什么时候该感性，什么时候该理性',
      '你的情绪有自己的节奏，不追随也不抗拒',
      // 高（67-100）
      '你的情感丰富而敏锐，像一台高灵敏度的天线',
      '你的情绪表达直接而充沛，和你相处不需要猜',
      '你对周围人的情绪变化感知力极强',
      '你的喜怒哀乐都写在脸上，这是你的真诚',
    ],
    communicationSync: [
      // 低
      '你更喜欢独处或小范围的深度交流',
      '你在人群中倾向于倾听而不是表达',
      '你不擅长寒暄，但深度对话你从不缺席',
      '你的社交电量有限，需要独处来恢复',
      // 中
      '你能在不同社交场景中切换自如',
      '你可以热闹也可以安静，看场合和心情',
      '你懂得倾听也懂得表达，是很好的交谈对象',
      '你不排斥社交，但也不会主动扎堆',
      // 高
      '你享受与人连接，是人群中的频率发射站',
      '你在社交中如鱼得水，总能找到话题',
      '你的表达欲很强，也总能带动气氛',
      '和陌生人聊天对你来说不是难事',
    ],
    actionComplement: [
      // 低
      '你习惯先观察再出手，每一步都经过衡量',
      '你属于深思熟虑型，很少冲动做决定',
      '你宁愿慢一点也不想走错方向',
      '你花在思考上的时间比行动多得多',
      // 中
      '你在思考与行动之间找到了自己的节奏',
      '你该想的时候想，该做的时候做，不拖沓',
      '你的行动力配合判断力，稳中求进',
      '你擅长评估风险后再行动，不盲目也不犹豫',
      // 高
      '你想到就做，行动是你的第一反应',
      '你的执行力远超大多数人，雷厉风行',
      '你讨厌拖延，有了想法就立刻去试',
      '你享受把想法快速变成现实的过程',
    ],
    trustPotential: [
      // 低
      '你对关系有天然的警惕心，信任需要时间',
      '你不轻易对人敞开心扉，但一旦信任就很深',
      '你习惯先观察别人的为人再决定是否靠近',
      '你的信任门槛很高，但跨过之后就很坚定',
      // 中
      '你愿意给予信任，但也会保持观察',
      '你相信人性本善，但也留有底线',
      '你在开放和谨慎之间找到了合适的平衡',
      '你不会轻易托付，但也不会无故怀疑',
      // 高
      '你倾向于先相信他人，坦诚是你的底色',
      '你对人多半抱有善意，也容易被真诚打动',
      '你觉得信任是关系的起点，不是终点',
      '你愿意给别人机会，即使受过伤也不会关上心门',
    ],
    frictionRisk: [
      // 低
      '你在关系中展现出难得的包容和灵活性',
      '你很少和人发生冲突，习惯退一步海阔天空',
      '你的脾气好到让身边人觉得不可思议',
      '你宁可自己消化也不愿意吵架伤和气',
      // 中
      '你有自己的原则，但不会轻易和他人碰撞',
      '触及底线你会表达，但不会歇斯底里',
      '你能接受不同意见，不会强求别人认同',
      '你知道什么时候该坚持，什么时候该放手',
      // 高
      '你有强烈的自我边界，不轻易妥协',
      '你的观点鲜明，也敢于表达不同意见',
      '你不会为了维持表面的和谐而委屈自己',
      '你的个性有棱角，了解你的人知道这是你真实的一面',
    ],
  };
  const tier = score <= 33 ? 0 : score <= 66 ? 1 : 2;
  const variantIdx = tier * 4 + (Math.round(score) % 4);
  return descs[key]?.[variantIdx] ?? descs[key]?.[tier * 4] ?? '需要更多数据来分析';
}
