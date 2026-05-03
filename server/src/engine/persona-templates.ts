import { PersonaReport } from './types.js';

const DIMENSIONS = [
  { key: 'emotionalResonance', label: '情绪频率' },
  { key: 'communicationSync', label: '沟通同步' },
  { key: 'actionComplement', label: '行动互补' },
  { key: 'trustPotential', label: '信任潜力' },
  { key: 'frictionRisk', label: '摩擦风险' },
];

export interface PersonaTemplate {
  type: string;
  label: string;
  baseScores: number[];
  summaryTemplate: string;
  insightPool: string[];
  keywordPool: string[];
}

export interface QuoteEntry {
  text: string;
  dimension?: string;
  tone?: string;
}

export const QUOTE_ENTRIES: QuoteEntry[] = [
  // ── 诗意金句（保留原版 20 条）──
  { text: '你的手掌，写满了星辰大海的痕迹。', dimension: 'emotionalResonance', tone: '浪漫' },
  { text: '柔软与坚定并存，这是你独特的频率。', dimension: 'emotionalResonance', tone: '温暖' },
  { text: '掌心的线条，像河流一样自有方向。', dimension: 'trustPotential', tone: '哲思' },
  { text: '在这个加速的世界里，你保持着自己的节奏。', dimension: 'actionComplement', tone: '坚定' },
  { text: '有时候，最温柔的手掌，藏着最坚韧的灵魂。', dimension: 'emotionalResonance', tone: '温暖' },
  { text: 'AI 读你的手，读到了一种不设防的真诚。', dimension: 'trustPotential', tone: '温暖' },
  { text: '你的频率很特别——介于月光和日出之间。', dimension: 'emotionalResonance', tone: '浪漫' },
  { text: '手掌线条，是你与生俱来的独特密码。', dimension: 'emotionalResonance', tone: '神秘' },
  { text: '世界很大，你的手掌很小，但能量很足。', dimension: 'actionComplement', tone: '鼓励' },
  { text: '安静的力量，一直在你的掌心里生长。', dimension: 'trustPotential', tone: '坚定' },
  { text: '你不是随波逐流的人，你的掌心线条证明了这一点。', dimension: 'emotionalResonance', tone: '坚定' },
  { text: '每一次握手，都是两个宇宙的短暂相遇。', dimension: 'frictionRisk', tone: '浪漫' },
  { text: '温柔不是软弱，你的掌心这么说。', dimension: 'frictionRisk', tone: '温暖' },
  { text: '那些曲折的线条，是你走过的风景。', dimension: 'communicationSync', tone: '哲思' },
  { text: '手掌不会说谎，它说：你值得被看见。', dimension: 'trustPotential', tone: '鼓励' },
  { text: '复杂又简单，矛盾又自洽——这正是你的魅力。', dimension: 'emotionalResonance', tone: '洞察' },
  { text: '你的手，适合创造，也适合被握住。', dimension: 'actionComplement', tone: '温暖' },
  { text: '频率共振不需要言说，掌心已经告诉了答案。', dimension: 'communicationSync', tone: '浪漫' },
  { text: '未来不确定，但你的掌心线条有自己的主见。', dimension: 'actionComplement', tone: '坚定' },
  { text: '不被定义，不被框住——这是你的掌心给世界的回答。', dimension: 'emotionalResonance', tone: '坚定' },

  // ── 互联网风格金句 30 条（温和刺痛 + 精确共鸣）──
  { text: '你看起来很好说话，但心里有张严格的评分表。', dimension: 'frictionRisk', tone: '洞察' },
  { text: '你真正的累不是事情多，而是总在照顾别人的感受，却很少有人反过来照顾你的情绪。', dimension: 'emotionalResonance', tone: '共情' },
  { text: '表面说无所谓的人，往往是最有所谓的那一个。', dimension: 'communicationSync', tone: '洞察' },
  { text: '你不是冷，你是慢热且挑人。', dimension: 'communicationSync', tone: '清醒' },
  { text: '看起来随和，其实对分寸感非常敏感。', dimension: 'frictionRisk', tone: '洞察' },
  { text: '你以为你社恐，其实你只是不想跟不喜欢的人说话。', dimension: 'communicationSync', tone: '清醒' },
  { text: '你不是脾气好，你只是把爆发阈值调得比较高。', dimension: 'frictionRisk', tone: '洞察' },
  { text: '表面是社牛，本质是省电模式。', dimension: 'communicationSync', tone: '幽默' },
  { text: '你对别人很大方，对自己抠得要命——这也是一种偏执。', dimension: 'trustPotential', tone: '洞察' },
  { text: '嘴上说躺平，身体还在偷偷卷。', dimension: 'actionComplement', tone: '幽默' },
  { text: '你不在乎大多数人的评价，但在乎你在乎的人怎么看你。', dimension: 'emotionalResonance', tone: '共情' },
  { text: '你不是没有情绪，你只是习惯了先照顾场面。', dimension: 'frictionRisk', tone: '共情' },
  { text: '你给别人的温柔，其实很需要有人接住。', dimension: 'emotionalResonance', tone: '共情' },
  { text: '你的独立是被逼出来的，你的坚强是练出来的。', dimension: 'trustPotential', tone: '鼓励' },
  { text: '最了解你的人，可能是你的手机输入法。', dimension: 'communicationSync', tone: '幽默' },
  { text: '在别人眼里你什么都行，只有你知道自己有时候也在硬撑。', dimension: 'emotionalResonance', tone: '共情' },
  { text: '你擅长安慰所有人，却很少认真安慰自己。', dimension: 'trustPotential', tone: '共情' },
  { text: '你在陌生人面前是正常人，在熟人面前是另一种生物。', dimension: 'communicationSync', tone: '幽默' },
  { text: '你最大的问题不是想太多，而是想太多还不说。', dimension: 'communicationSync', tone: '洞察' },
  { text: '和舒服的人在一起你的电量是满的，和消耗你的人在一起分分钟自动关机。', dimension: 'frictionRisk', tone: '清醒' },
  { text: '你不是懒，你只是对不想做的事启动速度比较慢。', dimension: 'actionComplement', tone: '幽默' },
  { text: '你嘴上说一个人挺好，但看到别人被惦记的时候还是有点羡慕。', dimension: 'emotionalResonance', tone: '共情' },
  { text: '别人对你好一点你就想加倍还回去——这是温柔，也是负担。', dimension: 'trustPotential', tone: '共情' },
  { text: '你在深夜做的决定和白天做的，像两个人的选择。', dimension: 'actionComplement', tone: '洞察' },
  { text: '你的相册里最多的不是自拍，是那些舍不得删的截图。', dimension: 'emotionalResonance', tone: '浪漫' },
  { text: '最了解你脆弱一面的人，是凌晨三点的天花板。', dimension: 'emotionalResonance', tone: '共情' },
  { text: '你不是不爱社交，你是社交完需要两天恢复电量。', dimension: 'communicationSync', tone: '清醒' },
  { text: '你对过去的洒脱是演出来的，但你往前走的样子是真的。', dimension: 'trustPotential', tone: '鼓励' },
  { text: '世界上有一种人闹钟响了立刻起来，有一种人按掉继续睡——你属于后者，但你也从没迟到过什么重要的事。', dimension: 'actionComplement', tone: '幽默' },
  { text: '你表面上在听别人说话，心里已经在想怎么让对方好受一点。', dimension: 'emotionalResonance', tone: '共情' },
];

export const QUOTE_TEMPLATES: string[] = QUOTE_ENTRIES.map((q) => q.text);

// ── 关系模式洞察文案 20 条 ──
export const RELATIONSHIP_INSIGHTS: string[] = [
  '你们之间最好的部分是：不用解释太多，对方就懂了。',
  '一段好的关系不会让你一直猜——情绪稳定的背后是安全感到位。',
  '真正契合的两个人不是从来不吵架，而是吵完架还能一起去吃夜宵。',
  '你在一个人面前可以安静地不说话也不尴尬，那他就是对的人。',
  '有些关系像充电器，插上就满电；有些关系像漏电的插座，越充越少。',
  '最让人心安的信号不是"我爱你"，而是"我在"。',
  '你们如果不做恋人也会是很好的朋友——这是最高的评价之一。',
  '最好的相处模式是：我需要你的时候你在我身边，你忙的时候我也不觉得被冷落。',
  '一个人的成熟藏在情绪里，两个人的成熟藏在吵架后的沉默里。',
  '那些愿意在细节里花心思的人，比说一万句情话的人更值得。',
  '如果一段关系让你越来越喜欢自己，那就是对的关系。',
  '能和你一起吐槽世界的人，比能和你一起欣赏世界的人更难得。',
  '好的关系不是永远热烈，而是平淡期也不觉得无聊。',
  '你看一个人的眼神比你说的话诚实得多——关系里最骗不了人的是注意力。',
  '有一种默契叫：我想找你的时候，你的消息刚好发过来。',
  '最舒服的关系不是24小时粘在一起，而是各自忙碌却知道彼此都在。',
  '你们之间有没有未来，看遇到冲突时的第一反应就知道。',
  '不是非要相同的性格才能走到一起，但一定要相同方向的包容。',
  '愿意为你停下脚步的人，比愿意陪你奔跑的人更值得珍惜。',
  '关系里的信任不是一次建立的，而是一次次在小事上被确认的。',
];

export const PERSONA_TEMPLATES: PersonaTemplate[] = [
  {
    type: 'starry-dreamer',
    label: '星辰梦想家',
    baseScores: [85, 60, 45, 75, 30],
    summaryTemplate: '你是一个内心充满想象力的人。情绪丰富而敏感，常常能在平凡中发现不凡。你相信直觉，跟随内心的频率前行。偶尔会与现实脱节，但正是这份不切实际，让你保持了可贵的创造力。',
    insightPool: ['你对美的感知力超乎常人', '有时候需要落地，但你飞的姿态很美', '你的灵感常常来得突然，抓住它', '独处是你充电的方式，不是孤僻'],
    keywordPool: ['浪漫', '直觉', '创造力', '敏感', '理想主义'],
  },
  {
    type: 'silent-guardian',
    label: '沉默守护者',
    baseScores: [55, 45, 80, 90, 20],
    summaryTemplate: '你不善言辞，但行动永远在别人需要之前。可靠是你最大的标签。你不追求聚光灯，但团队里没有你不行。内心有一片深海，不轻易示人，但值得被探索。',
    insightPool: ['你的忠诚是最珍贵的品质', '不要总是把别人的需求放在自己前面', '被认为无趣只是表面，懂你的人知道你多有趣', '慢热但长情，这是你的人际关系法则'],
    keywordPool: ['可靠', '沉稳', '忠诚', '务实', '内敛'],
  },
  {
    type: 'flame-explorer',
    label: '火焰探索者',
    baseScores: [70, 85, 75, 50, 65],
    summaryTemplate: '你对世界充满好奇，能量外放而具有感染力。不断尝试新事物是你的本能。有时候会三分钟热度，但那是因为你的灵魂需要多方向的滋养。敢于冒险是你的底色。',
    insightPool: ['你的热情是天赋，聚焦是功课', '世界是你的游乐场，尽情探索', '偶尔停下来，看看已经走了多远', '你的勇气比你自己以为的还大'],
    keywordPool: ['冒险', '热情', '好奇心', '活力', '自由'],
  },
  {
    type: 'deep-thinker',
    label: '深海思考者',
    baseScores: [40, 50, 35, 60, 20],
    summaryTemplate: '你习惯在行动前思考三步。逻辑是你的语言，深度是你的习惯。表面可能显得疏离，但你的内心世界极其丰富。你不喜欢浅薄的社交，但会为有深度的对话投入全部注意力。',
    insightPool: ['思考是你的优势，过度思考是你的陷阱', '偶尔让直觉带路，会有惊喜', '你的分析能力是稀缺资产', '不是所有人都能跟上你的思维，这是好事'],
    keywordPool: ['深度', '理性', '逻辑', '内省', '洞察力'],
  },
  {
    type: 'gentle-healer',
    label: '温柔疗愈者',
    baseScores: [90, 80, 55, 85, 15],
    summaryTemplate: '你自带治愈气场。共情能力极强，不自觉地成为身边人的情绪避风港。你懂得倾听，更懂得在合适的时机说出合适的话。需要小心的是，不要让自己成为别人的情绪垃圾桶。',
    insightPool: ['你的共情是天赐的礼物', '照顾好自己，再去照顾世界', '说"不"不会让你变得不善良', '你的存在就是一种安慰'],
    keywordPool: ['共情', '温暖', '治愈', '倾听', '包容'],
  },
  {
    type: 'sharp-pioneer',
    label: '锐意开拓者',
    baseScores: [60, 70, 90, 65, 75],
    summaryTemplate: '你倾向于主动行动。想到了就去做，执行力是你最锋利的武器。在别人还在讨论的时候，你已经完成了第一版。有竞争意识，但不失风度。世界需要你这样的推动者。',
    insightPool: ['行动力是你的超能力', '偶尔慢下来，看到的风景同样重要', '你的果断是稀缺品质', '带领他人之前，先确认方向'],
    keywordPool: ['果断', '执行力', '领导力', '效率', '进取'],
  },
  {
    type: 'moon-artist',
    label: '月光艺术家',
    baseScores: [80, 55, 40, 60, 25],
    summaryTemplate: '你的灵魂需要表达。文字、绘画、音乐——无论什么媒介，你总有东西要向世界诉说。感知力细腻，能看到别人忽略的细节。情绪是你创作的源泉，不是负担。',
    insightPool: ['你的表达欲是你最珍贵的动力', '不用追求完美，追求真实就好', '别人不懂的作品，不代表它不好', '你的敏感不是缺点，是天赋'],
    keywordPool: ['艺术', '表达', '细腻', '审美', '独立'],
  },
  {
    type: 'bridge-builder',
    label: '桥梁搭建者',
    baseScores: [75, 90, 70, 80, 10],
    summaryTemplate: '你是人际关系中的天然粘合剂。善于化解矛盾，让不同的声音找到共同频率。在大场面中游刃有余，但私下也需要独处时光来恢复能量。真诚是你最核心的武器。',
    insightPool: ['你的社交能力背后是真实的共情', '不要把所有人的矛盾都揽到自己身上', '你的朋友圈因为你而更紧密', '连接他人之前，先连接自己'],
    keywordPool: ['社交', '协调', '包容', '真诚', '凝聚力'],
  },
  {
    type: 'quiet-mountain',
    label: '静默山峰',
    baseScores: [30, 35, 50, 80, 15],
    summaryTemplate: '你不热衷于表达，但内心有自己的法则和秩序。稳如磐石，泰山崩于前而色不变。有人觉得你难以接近，但了解你的人知道，你的沉稳正是最强大的力量。',
    insightPool: ['沉稳是你的底色，不是冷漠', '有时候说出来，会让别人更懂你', '你的耐心是许多人最羡慕的品质', '你不需要改变自己来取悦任何人'],
    keywordPool: ['内敛', '坚韧', '沉稳', '自洽', '深度'],
  },
  {
    type: 'sunshine-spark',
    label: '阳光火花',
    baseScores: [85, 75, 65, 70, 35],
    summaryTemplate: '你是人群里最先笑起来的那个人。乐观不是无知，而是一种主动选择。你相信美好，并在行动中传递美好。偶尔也会难过，但情绪更新得很快。和你在一起，世界都亮了一些。',
    insightPool: ['你的乐观不是天真，是勇敢', '允许自己偶尔不做小太阳', '你散发的光和热，正在悄悄改变一些人', '保持这份明亮，世界需要你'],
    keywordPool: ['乐观', '阳光', '感染力', '热情', '轻盈'],
  },
  {
    type: 'wind-wanderer',
    label: '追风行者',
    baseScores: [55, 60, 55, 40, 40],
    summaryTemplate: '你享受不确定性，不喜欢被框住的人生。随性而至，顺势而为。计划对你来说是束缚，你更相信当下此刻的直觉。路上遇到的风景，比目的地更重要。',
    insightPool: ['自由是你最珍贵的财富', '偶尔规划一下，会让自由更有方向', '你的随性让你拥有了别人计划不来的精彩', '风不需要解释为什么吹向某个方向'],
    keywordPool: ['自由', '随性', '浪漫', '旅人', '轻盈'],
  },
  {
    type: 'root-keeper',
    label: '根系守护者',
    baseScores: [65, 55, 70, 90, 20],
    summaryTemplate: '你重视根基和传统。家庭、朋友和熟悉的地方构成了你的安全网。你不盲目追逐新潮，更愿意把已经拥有的守护好。你像一棵树，扎根越深，给予的荫凉越多。',
    insightPool: ['守护是爱的最高形式之一', '你的可靠让身边的人安心', '传统不代表守旧，根基稳固才能长得更高', '你给予的安全感是无价的'],
    keywordPool: ['稳定', '忠诚', '传统', '守护', '温暖'],
  },
];

export function getDimensions() {
  return DIMENSIONS;
}

export function getTemplateByType(type: string): PersonaTemplate | undefined {
  return PERSONA_TEMPLATES.find((t) => t.type === type);
}

export function getAllTemplates(): PersonaTemplate[] {
  return PERSONA_TEMPLATES;
}

export function pickQuote(index: number): string {
  return QUOTE_ENTRIES[index % QUOTE_ENTRIES.length].text;
}

export function pickQuoteEntry(index: number): QuoteEntry {
  return QUOTE_ENTRIES[index % QUOTE_ENTRIES.length];
}

export function pickRelationshipInsight(index: number): string {
  return RELATIONSHIP_INSIGHTS[index % RELATIONSHIP_INSIGHTS.length];
}

// ── 蔡格尼克悬念文案（次日留存钩子）──
export const SUSPENSE_TEXTS: string[] = [
  '明天同一时间，AI 会解读你手掌的另一条线——那条藏着你不为人知一面的线。',
  '你的掌心还有一条线没解读——它会在明天揭示你另一种可能的自己。',
  '今天的分析只是第一层，明天 AI 会看到你手掌里关于「关系」的秘密。',
  '你手掌中有一条线的走向很特别——明天同一时间，你会知道它说了什么。',
  '有一件事你的手掌已经说了，但今天的分析还没讲到——明天见。',
];

export function pickSuspenseText(index: number): string {
  return SUSPENSE_TEXTS[index % SUSPENSE_TEXTS.length];
}

export function assembleReport(
  id: string,
  template: PersonaTemplate,
  scores: PersonaReport['scores'],
  quote: string,
  seed: number,
  suspenseText?: string,
): PersonaReport {
  const insightCount = Math.min(3, template.insightPool.length);
  const keywordCount = Math.min(3, template.keywordPool.length);

  // 环形选取，保证始终取到足够的 insight
  const startIdx = seed % template.insightPool.length;
  const insights: string[] = [];
  for (let i = 0; i < insightCount; i++) {
    insights.push(template.insightPool[(startIdx + i) % template.insightPool.length]);
  }

  return {
    id,
    createdAt: new Date().toISOString(),
    personaType: template.type,
    personaLabel: template.label,
    scores,
    summary: template.summaryTemplate,
    insights,
    keywords: template.keywordPool.slice(0, keywordCount),
    quote,
    suspenseText: suspenseText ?? SUSPENSE_TEXTS[seed % SUSPENSE_TEXTS.length],
  };
}
