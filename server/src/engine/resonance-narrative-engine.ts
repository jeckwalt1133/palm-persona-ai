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

    // 生成视觉锚点文案（基于真实 PalmFeatures）
    const visualAnchors = buildVisualAnchors(features);

    // 核心真相：不用机械拼装，用模板 summary 的第一句 + 最突出维度的洞察
    const coreTruth = buildCoreTruth(scores, visualAnchors);

    // summary 保持模板原文（视觉锚点 opening 已单独展示）
    const enrichedSummary = template.summaryTemplate;

    // 维度描述也注入特征线索
    const enrichedScores = scores.map((s, i) => ({
      ...s,
      description: enrichDescription(s, features, i),
    }));

    return assembleReport(
      features.hash, template, enrichedScores, quote, hash,
      suspenseText, coreTruth, undefined, enrichedSummary, visualAnchors,
    );
  }
}

// ── 视觉锚点生成（基于真实特征数据）──

function buildVisualAnchors(f: PalmFeatures) {
  const widthLabel = f.palmWidth > 80 ? '偏宽厚' : f.palmWidth > 60 ? '适中' : '偏窄长';
  const fingerLabel = f.fingerLengthRatio > 1.05 ? '手指修长' : f.fingerLengthRatio > 0.9 ? '比例和谐' : '手指偏短';
  const clarityLabel = f.lineClarity > 70 ? '清晰深刻' : f.lineClarity > 40 ? '柔和可见' : '浅淡隐约';
  const lineCountLabel = f.lineCount >= 6 ? '脉络丰富' : f.lineCount >= 4 ? '主线清晰' : '简洁分明';

  const mountNames = ['金星丘', '木星丘', '土星丘', '太阳丘', '水星丘'];
  const maxMountIdx = f.mountProminence.indexOf(Math.max(...f.mountProminence));
  const maxMountName = mountNames[maxMountIdx];

  return {
    opening: `AI 读取到你的手掌宽度${widthLabel}，${fingerLabel}，掌心纹路${clarityLabel}，主线条${lineCountLabel}。${maxMountName}区域较为突出——这通常与情感能量和自我表达有关。`,
    widthLabel,
    fingerLabel,
    clarityLabel,
    lineCountLabel,
    prominentMount: maxMountName,
    palmWidth: f.palmWidth,
    lineClarity: f.lineClarity,
    lineCount: f.lineCount,
    fingerLengthRatio: Math.round(f.fingerLengthRatio * 100),
    // 相对比较标签
    widthPercentile: f.palmWidth > 80 ? '偏宽厚 · 人群中少见' : f.palmWidth > 60 ? '中等偏宽' : '偏窄长 · 相对少见',
    clarityPercentile: f.lineClarity > 70 ? '纹路清晰 · 超过80%的人' : f.lineClarity > 40 ? '柔和可见 · 中等水平' : '浅淡隐约 · 较为独特',
    lineCountPercentile: f.lineCount >= 6 ? '脉络丰富 · 多于大多数人' : f.lineCount >= 4 ? '主线清晰 · 大众水平' : '简洁分明 · 较为罕见',
    fingerPercentile: f.fingerLengthRatio > 1.05 ? '手指修长 · 超过75%的人' : f.fingerLengthRatio > 0.9 ? '比例和谐 · 中等水平' : '手指偏短 · 较为独特',
  };
}

function naturalTrait(key: string, score: number): string {
  const map: Record<string, [string, string, string]> = {
    emotionalResonance: ['内心沉静', '情绪细腻', '情感丰沛'],
    communicationSync: ['安静观察者', '收放自如', '天生表达者'],
    actionComplement: ['深思熟虑', '稳中求进', '行动派'],
    trustPotential: ['慢热的', '谨慎而真诚的', '坦诚开放的'],
    frictionRisk: ['温和包容的', '刚柔并济的', '棱角分明的'],
  };
  const idx = score <= 33 ? 0 : score <= 66 ? 1 : 2;
  return map[key]?.[idx] ?? '';
}

function buildCoreTruth(
  scores: PersonaScore[],
  anchors: ReturnType<typeof buildVisualAnchors>,
): string {
  const topTwo = [...scores].sort((a, b) => b.score - a.score).slice(0, 2);
  const trait1 = naturalTrait(topTwo[0].dimensionKey, topTwo[0].score);
  const trait2 = topTwo[1] ? naturalTrait(topTwo[1].dimensionKey, topTwo[1].score) : null;
  const hooks = [
    `你掌心${anchors.clarityLabel}的纹路，藏着一个${trait1}的人——${trait2 ? `但骨子里，你是${trait2}。` : '比你想象中更复杂。'}`,
    `${anchors.prominentMount}的弧度告诉我，你看起来${trait1}，实际上比谁都在意细节。`,
    `AI在你的手掌上看到${anchors.lineCountLabel}的主线——每一条都在说：你比你表现出来的更复杂。`,
    `外表${trait1}，内心${trait2 ?? '藏着别人看不见的敏感'}。你的手掌不会说谎。`,
    `${anchors.clarityLabel}的掌纹、${anchors.prominentMount}的弧度——这些细节拼出一个你：${trait1}，但${trait2 ? `底色是${trait2}` : '没人能简单定义'}。`,
    `很多人只看到你${trait1}的一面，只有你的手掌知道——你${trait2 ? `更多的是${trait2}` : '比表面多好几个层次'}。`,
  ];
  const hash = simpleHash(anchors.opening);
  return hooks[hash % hooks.length];
}

function enrichDescription(s: PersonaScore, f: PalmFeatures, dimIdx: number): string {
  const clues: Record<string, string[]> = {
    emotionalResonance: [
      `手掌${f.lineClarity > 60 ? '清晰的纹路' : '柔和的线条'}也在说同一件事。`,
    ],
    communicationSync: [
      `掌心${f.lineCount > 4 ? '分叉的智慧线' : '延续的线条'}印证了你的沟通模式。`,
    ],
    actionComplement: [
      `${f.mountProminence[dimIdx] > 50 ? '饱满的掌丘轮廓' : '平坦的丘位'}与你的行动风格一致。`,
    ],
    trustPotential: [
      `小指根部的${f.lineCount > 5 ? '细密纹路' : '清晰线条'}透露了你的信任底色。`,
    ],
    frictionRisk: [
      `拇指根部的${f.palmWidth > 70 ? '宽阔区域' : '紧致轮廓'}与你的边界感吻合。`,
    ],
  };
  const clue = clues[s.dimensionKey]?.[0] ?? '';
  return `${s.description} ${clue}`;
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
      '你不是没有情绪，你只是不想让它替你做决定。冷静是一种能力。',
      '你心里有场风暴，但从不让别人看见。不是不在乎，是自己消化习惯了。',
      '他们把安静当成冷漠，不知道你其实什么都看见了，只是选择了不说。',
      '情绪对你来说不是第一语言——你先用理性处理，再决定要不要感受。',
      // 中（34-66）
      '你懂得什么时候该听心里的声音，什么时候该听脑子的——这种平衡不多见。',
      '你不是不敏感，你只是收放自如。能进能退的情绪才是最稳的状态。',
      '共情力强但不泛滥——你知道什么时候该共情，什么时候该抽身。',
      '你能察觉到气氛的变化却不让它控制你。这不叫"中庸"，这叫情绪的自我管理。',
      // 高（67-100）
      '细腻到能听出别人话里的"没事"其实是"有事"。这种天赋累，但珍贵。',
      '你的情绪真的会写在脸上、语气里、打字速度里——但这不是弱点，是真诚。',
      '情绪对你来说从来不是负担，是燃料。你用它感知世界，也用它连接人。',
      '你能感受到别人话里没说完的情绪——很多时候你比当事人先知道他们怎么了。',
    ],
    communicationSync: [
      // 低
      '你不是不会社交，你是不想无效社交。一个人待着比一群人尬聊舒服太多。',
      '你的话不多，但每一句都在点上。安静的人往往最有东西可说。',
      '你擅长倾听，却很少被倾听。你的安静常常被人当成了默认。',
      '社交对你来说是消耗而不是充电。你更需要的是一个能安静待着的人。',
      // 中
      '你可以在人群中发光，也可以独自待着充电。能在两个世界自由切换是种自由。',
      '你知道该说什么，也知道什么时候不该说。恰到好处的沉默是你的优势。',
      '该热时能热起来，该静时能静下来。收放自如比永远高能更难。',
      '你不是社恐也不是社牛——你是"分人"。对谁掏心对谁说场面话，你分得很清。',
      // 高
      '你是那个能把气氛带起来的人。不是刻意热场，是发自内心想让所有人都舒服。',
      '你总有分享不完的事情——不是话多，是真的想把好的感受传递出去。',
      '和人聊天对你来说不是负担，是能量来源。你从连接中充电，而不是消耗。',
      '你能让新认识的人在五分钟内觉得"这个人很好聊"——不只是话多，是真的在听。',
    ],
    actionComplement: [
      // 低
      '你想得比做得多。不是拖延，是你太清楚一个决定会牵动多少事情。',
      '你总是先看到所有可能出错的地方再行动。这让你慢，但也让你稳。',
      '别人说你犹豫，其实你只是比他们多想了一层。三思后行的你很少后悔。',
      '你的大脑在别人行动之前已经把路演了三遍。思考是你的行动。',
      // 中
      '想够了就做，做完了再想——你在这两种节奏里找到了自己的时机感。',
      '该快的时候能快，该停的时候能停。节奏感比速度更重要。',
      '你不盲目冲刺，也不原地纠结。稳中有进才是你的方式。',
      '你在想和做之间有一条自己的路——不跟风，也不掉队。',
      // 高
      '别人还在想"要不要做"，你已经做完了。行动力和直觉是你的最强配置。',
      '你厌恶拖延——想到一个好主意就马上去试。行动本身就是你思考的方式。',
      '快不是冲动，是你比别人先看懂了。当别人还在开会讨论，你已经拿到结果。',
      '你不等完美。做完再改，改完再做——行动派的哲学就是这么简单。',
    ],
    trustPotential: [
      // 低
      '你不是不相信人，你是需要时间。时间够了，你比谁都投入。',
      '你对关系的标准很高——亲密是勋章，不是随手分发的东西。',
      '你的信任像限量版一样珍贵，但一旦给出就很少收回。',
      '慢热让你错过了不少人，但也帮你筛掉了不真诚的。你心里有数。',
      // 中
      '保持着善意但也有底线——你知道什么时候信任，什么时候观望。',
      '你愿意给机会但不透支信任。这种适度的开放是最聪明的相处方式。',
      '对人保持好奇也保持边界——不是防备，是经验教会你的日常智慧。',
      '你信人性里有光，但也承认有阴影。保持信念但不盲目，这很不容易。',
      // 高
      '你对人有一种天然的信赖感——不是天真，是你相信好的关系值得先付出。',
      '你的真诚是一种让人放下戒备的魔力。和你相处不需要演技。',
      '你愿意先相信别人，也愿意在失望后重新相信。这不是软弱，是底气。',
      '信任对你来说是关系的默认设置，不是需要被挣来的东西——这很难得。',
    ],
    frictionRisk: [
      // 低
      '你不喜欢冲突，但不代表没有原则。你只是选择了更聪明的方式表达。',
      '表面好说话，心里有自己的坚持。你不是没脾气，是觉得不值得为小事炸。',
      '你不是懦弱——能在不开心的时候还保持松弛，说明你比问题大。',
      '你以为自己在忍着别人，其实是你的容量比一般人大。但容量再大也有上限。',
      // 中
      '你有自己的底线，但不会轻易拿出来。你知道什么时候该守，什么时候该放手。',
      '不强行改变别人，也不会为任何人丢掉自己。这是你在大事上的分寸感。',
      '你不在小事上较真，但在关键的事上不退让。这种选择性坚持很难得。',
      '你不容易被激怒，不是因为好欺负，而是因为你知道什么值得生气。',
      // 高
      '你最怕的是"假"——所以宁愿有冲突也不装。真实比和谐重要。',
      '你不是脾气大，是边界清楚。知道你是谁、你要什么、你不接受什么。',
      '你不想委屈自己来维持表面的和平。你的棱角是你最诚实的一部分。',
      '你的真诚有时候会让人觉得直接，但了解你的人都知道——你不藏着，也不骗人。',
    ],
  };
  const tier = score <= 33 ? 0 : score <= 66 ? 1 : 2;
  const variantIdx = tier * 4 + (Math.round(score) % 4);
  return descs[key]?.[variantIdx] ?? descs[key]?.[tier * 4] ?? '需要更多数据来分析';
}
