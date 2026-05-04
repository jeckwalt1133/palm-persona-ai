// 分享文案库 — 100+ 条社交货币，4 分类动态匹配

// 安全过滤（内联，避免跨 workspace 包依赖）
const FORBIDDEN_TERMS = [
  '算命', '占卜', '命运注定', '改运', '开运', '正缘', '姻缘测算',
  '旺夫', '旺妻', '克夫', '克妻', '寿命预测', '疾病预测', '灾祸预测',
  '财富暴富预测', '100%准确', '比算命更准', '必然', '一定会',
  '暴富', '改命', '天注定', '掌纹', '手相', '看手相', '天生一对', '宿命',
];

export function checkForbiddenTerms(text: string): string[] {
  const violations: string[] = [];
  for (const term of FORBIDDEN_TERMS) {
    if (text.includes(term)) violations.push(term);
  }
  return violations;
}

export function replaceForbiddenTerms(text: string): string {
  let result = text;
  for (const term of FORBIDDEN_TERMS) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escaped, 'g'), '***');
  }
  return result;
}

export type ShareCategory =
  | 'identity_label'   // 身份标签 — 个人首页展示
  | 'hidden_truth'      // 隐秘真相 — 最易截图
  | 'relationship'      // 关系洞察 — 适合发给特定人
  | 'contrast';         // 对立反差 — 引发讨论

export interface ShareCopyEntry {
  text: string;
  category: ShareCategory;
  personaTypes?: string[];  // 限定人格类型，空=全类型
  dimension?: string;       // 关联维度
}

export interface MatchedShareCopy {
  category: ShareCategory;
  texts: string[];
  primaryText: string;
}

// ═══════════════════════════════════════════
// 文案库 — 4 分类，共 110 条
// ═══════════════════════════════════════════

const SHARE_COPY_LIBRARY: ShareCopyEntry[] = [
  // ── 身份标签 identity_label (27条) ──
  { text: '慢热但深情', category: 'identity_label', personaTypes: ['silent-guardian', 'quiet-mountain'] },
  { text: '清醒恋爱脑', category: 'identity_label', personaTypes: ['starry-dreamer', 'sunshine-spark'] },
  { text: '反内卷艺术家', category: 'identity_label', personaTypes: ['moon-artist', 'wind-wanderer'] },
  { text: '边界感王者', category: 'identity_label', personaTypes: ['sharp-pioneer', 'root-keeper'] },
  { text: '省电模式社交达人', category: 'identity_label', personaTypes: ['silent-guardian', 'deep-thinker'] },
  { text: '温和但不好惹', category: 'identity_label', personaTypes: ['gentle-healer', 'root-keeper'] },
  { text: '人间清醒观察员', category: 'identity_label', personaTypes: ['deep-thinker', 'sharp-pioneer'] },
  { text: '直觉驱动型选手', category: 'identity_label', personaTypes: ['starry-dreamer', 'flame-explorer'] },
  { text: '细节控晚期', category: 'identity_label', personaTypes: ['deep-thinker', 'gentle-healer'] },
  { text: '行动力 MAX 但需要充电', category: 'identity_label', personaTypes: ['flame-explorer', 'sharp-pioneer'] },
  { text: '外表淡定内心风暴', category: 'identity_label', personaTypes: ['quiet-mountain', 'bridge-builder'] },
  { text: '温柔但内核很硬', category: 'identity_label', personaTypes: ['gentle-healer', 'moon-artist'] },
  { text: '灵感型选手不按套路', category: 'identity_label', personaTypes: ['wind-wanderer', 'moon-artist'] },
  { text: '靠谱是最大的魅力', category: 'identity_label', personaTypes: ['root-keeper', 'silent-guardian'] },
  { text: '情绪雷达满格', category: 'identity_label', personaTypes: ['sunshine-spark', 'starry-dreamer'] },
  { text: '共情能力天花板', category: 'identity_label', personaTypes: ['gentle-healer', 'bridge-builder'] },
  { text: 'ISTJ 外表 INFJ 灵魂', category: 'identity_label' },
  { text: '口是心非专业户', category: 'identity_label', personaTypes: ['flame-explorer', 'wind-wanderer'] },
  { text: '安全感自给自足型', category: 'identity_label', personaTypes: ['root-keeper', 'quiet-mountain'] },
  { text: '计划与冲动五五开', category: 'identity_label', personaTypes: ['sharp-pioneer', 'flame-explorer'] },
  { text: '三分钟热度但每三分钟都很认真', category: 'identity_label', personaTypes: ['wind-wanderer', 'sunshine-spark'] },
  { text: '表面好说话底线很明确', category: 'identity_label', personaTypes: ['silent-guardian', 'root-keeper'] },
  { text: '48% 卷 + 52% 躺', category: 'identity_label' },
  { text: '天生氛围组', category: 'identity_label', personaTypes: ['sunshine-spark', 'bridge-builder'] },
  { text: '独处能力满级', category: 'identity_label', personaTypes: ['deep-thinker', 'quiet-mountain'] },
  { text: '乐观的悲观主义者', category: 'identity_label', personaTypes: ['moon-artist', 'starry-dreamer'] },
  { text: '内核稳定输出型', category: 'identity_label', personaTypes: ['root-keeper', 'bridge-builder'] },

  // ── 隐秘真相 hidden_truth (32条) — 最易截图的温和刺痛 ──
  { text: '你看起来很好说话，但心里有张严格的评分表。', category: 'hidden_truth', dimension: 'frictionRisk' },
  { text: '你真正累的不是事情多，而是总在照顾别人的感受，却很少有人反过来照顾你的情绪。', category: 'hidden_truth', dimension: 'emotionalResonance' },
  { text: '表面说无所谓的人，往往是最有所谓的那一个。', category: 'hidden_truth', dimension: 'communicationSync' },
  { text: '你不是冷，你是慢热且挑人。', category: 'hidden_truth', dimension: 'communicationSync' },
  { text: '看起来随和，其实对分寸感非常敏感。', category: 'hidden_truth', dimension: 'frictionRisk' },
  { text: '你以为你社恐，其实你只是不想跟不喜欢的人说话。', category: 'hidden_truth', dimension: 'communicationSync' },
  { text: '你不是脾气好，你只是把爆发阈值调得比较高。', category: 'hidden_truth', dimension: 'frictionRisk' },
  { text: '在别人眼里你什么都行，只有你知道自己有时候也在硬撑。', category: 'hidden_truth', dimension: 'emotionalResonance' },
  { text: '你擅长安慰所有人，却很少认真安慰自己。', category: 'hidden_truth', dimension: 'trustPotential' },
  { text: '你最大的问题不是想太多，而是想太多还不说。', category: 'hidden_truth', dimension: 'communicationSync' },
  { text: '和舒服的人在一起你的电量是满的，和消耗你的人在一起分分钟自动关机。', category: 'hidden_truth', dimension: 'frictionRisk' },
  { text: '你不是不爱社交，你是社交完需要两天恢复电量。', category: 'hidden_truth', dimension: 'communicationSync' },
  { text: '别人对你好一点你就想加倍还回去——这是温柔，也是负担。', category: 'hidden_truth', dimension: 'trustPotential' },
  { text: '你不在乎大多数人的评价，但在乎你在乎的人怎么看你。', category: 'hidden_truth', dimension: 'emotionalResonance' },
  { text: '你不是玻璃心，是太容易捕捉到别人语气里的敷衍，却又不好意思戳破。', category: 'hidden_truth', dimension: 'emotionalResonance' },
  { text: '你给别人的温柔，其实很需要有人接住。', category: 'hidden_truth', dimension: 'emotionalResonance' },
  { text: '你的独立是被逼出来的，你的坚强是练出来的。', category: 'hidden_truth', dimension: 'trustPotential' },
  { text: '你嘴上说一个人挺好，但看到别人被惦记的时候还是有点羡慕。', category: 'hidden_truth', dimension: 'emotionalResonance' },
  { text: '你在深夜做的决定和白天做的，像两个人的选择。', category: 'hidden_truth', dimension: 'actionComplement' },
  { text: '最了解你脆弱一面的人，是凌晨三点的天花板。', category: 'hidden_truth', dimension: 'emotionalResonance' },
  { text: '你不是没有情绪，你只是习惯了先照顾场面。', category: 'hidden_truth', dimension: 'frictionRisk' },
  { text: '你对过去的洒脱是演出来的，但你往前走的样子是真的。', category: 'hidden_truth', dimension: 'trustPotential' },
  { text: '你表面上在听别人说话，心里已经在想怎么让对方好受一点。', category: 'hidden_truth', dimension: 'emotionalResonance' },
  { text: '你总是看得太远，忘了照顾眼前的自己。', category: 'hidden_truth', dimension: 'actionComplement' },
  { text: '你的相册里最多的不是自拍，是那些舍不得删的截图。', category: 'hidden_truth', dimension: 'emotionalResonance' },
  { text: '你不是不会拒绝，你是拒绝完之后会内耗半天。', category: 'hidden_truth', dimension: 'trustPotential' },
  { text: '别人觉得你很开朗，但你知道那只是你的社交模式，不是全部真实的你。', category: 'hidden_truth', dimension: 'communicationSync' },
  { text: '你对自己要求太高了，高到偶尔会忘记夸奖自己。', category: 'hidden_truth', dimension: 'actionComplement' },
  { text: '你笑着听别人倾诉的时候，自己心里可能也在下着雨。', category: 'hidden_truth', dimension: 'emotionalResonance' },
  { text: '你的沉默不是没想法，是想好了再说，但想太久就错过了说的时机。', category: 'hidden_truth', dimension: 'communicationSync' },
  { text: '你的善良有棱角，别人碰不到是因为还没触到底线。', category: 'hidden_truth', dimension: 'frictionRisk' },
  { text: '你不是不想被理解，你只是不想解释得太累。', category: 'hidden_truth', dimension: 'communicationSync' },

  // ── 关系洞察 relationship (28条) — 适合发给某个人 ──
  { text: '你们之间最好的部分是：不用解释太多，对方就懂了。', category: 'relationship' },
  { text: '一段好的关系不会让你一直猜——情绪稳定的背后是安全感到位。', category: 'relationship' },
  { text: '真正契合的两个人不是从来不吵架，而是吵完架还能一起去吃夜宵。', category: 'relationship' },
  { text: '你在一个人面前可以安静地不说话也不尴尬，那他就是对的人。', category: 'relationship' },
  { text: '有些关系像充电器，插上就满电；有些关系像漏电的插座，越充越少。', category: 'relationship' },
  { text: '最让人心安的信号不是"我爱你"，而是"我在"。', category: 'relationship' },
  { text: '最好的相处模式是：我需要你的时候你在我身边，你忙的时候我也不觉得被冷落。', category: 'relationship' },
  { text: '如果一段关系让你越来越喜欢自己，那就是对的关系。', category: 'relationship' },
  { text: '能和你一起吐槽世界的人，比能和你一起欣赏世界的人更难得。', category: 'relationship' },
  { text: '好的关系不是永远热烈，而是平淡期也不觉得无聊。', category: 'relationship' },
  { text: '有一种默契叫：我想找你的时候，你的消息刚好发过来。', category: 'relationship' },
  { text: '最舒服的关系不是24小时粘在一起，而是各自忙碌却知道彼此都在。', category: 'relationship' },
  { text: '你们之间有没有未来，看遇到冲突时的第一反应就知道。', category: 'relationship' },
  { text: '愿意为你停下脚步的人，比愿意陪你奔跑的人更值得珍惜。', category: 'relationship' },
  { text: '关系里的信任不是一次建立的，而是一次次在小事上被确认的。', category: 'relationship' },
  { text: 'TA 懂你的敏感不是脆弱，是你感知世界的精度比别人高。', category: 'relationship' },
  { text: '你们在一起最放松的时候，就是你们关系最好的证明。', category: 'relationship' },
  { text: '有些人让你不自觉地想变好，有些人让你不经意间做回自己——这两类人都值得珍惜。', category: 'relationship' },
  { text: '你们性格不同但方向一致——这是关系里最难得的幸运。', category: 'relationship' },
  { text: 'TA 是那种你伤心时不急着讲道理，先问你饿不饿的人。', category: 'relationship' },
  { text: '你的频率传出去，如果能被另一个人稳稳接收——那就是对的关系。', category: 'relationship' },
  { text: '舒服的关系不是话多，是安静也不尴尬。', category: 'relationship' },
  { text: '你们不一定是同一种人，但你们在重要的事情上观念一致。', category: 'relationship' },
  { text: '最好的拍档是：一个冲动一个稳，一个大胆一个细，刚好补上彼此的短板。', category: 'relationship' },
  { text: '一段关系里最温暖的信号不是惊喜，是无论什么时候都有人在。', category: 'relationship' },
  { text: 'TA让你觉得被理解，不是因为说了什么，而是因为什么都没说也懂了。', category: 'relationship' },
  { text: '和频率相同的人在一起，你不需要解释自己。', category: 'relationship' },
  { text: '你们不一定要一起做所有事，但要在一起时感觉每件事都更轻松。', category: 'relationship' },

  // ── 对立反差 contrast (23条) — 引发讨论 ──
  { text: '表面是社牛，本质是省电模式。', category: 'contrast', dimension: 'communicationSync' },
  { text: '嘴上说躺平，身体还在偷偷卷。', category: 'contrast', dimension: 'actionComplement' },
  { text: '在陌生人面前是正常人，在熟人面前是另一种生物。', category: 'contrast', dimension: 'communicationSync' },
  { text: '你看上去很感性，其实做决定的时候比谁都清醒。', category: 'contrast', dimension: 'emotionalResonance' },
  { text: '外表冷静理性，心里住着一个浪漫主义诗人。', category: 'contrast', dimension: 'trustPotential' },
  { text: '看起来不爱说话，打字却可以写论文。', category: 'contrast', dimension: 'communicationSync' },
  { text: '温柔是你的外包装，但你的内核是不锈钢。', category: 'contrast', dimension: 'frictionRisk' },
  { text: '你以为自己怕孤独，其实你一个人也能过得很好，只是偶尔想有人分享。', category: 'contrast', dimension: 'emotionalResonance' },
  { text: '想被理解又不想被看穿——这个矛盾是你性格里最迷人的部分。', category: 'contrast', dimension: 'communicationSync' },
  { text: '看起来好脾气，其实心里有本"记仇小本本"。', category: 'contrast', dimension: 'frictionRisk' },
  { text: '想独处又想被找到——你不是矛盾，你是需要一个懂你频率的人。', category: 'contrast', dimension: 'emotionalResonance' },
  { text: '看起来对什么都不在乎，其实对在乎的事比谁都认真。', category: 'contrast', dimension: 'trustPotential' },
  { text: '不喜欢回消息但看到有人找还是会开心。', category: 'contrast', dimension: 'communicationSync' },
  { text: '社交场合是外向人格，回家立刻切换静音模式。', category: 'contrast', dimension: 'communicationSync' },
  { text: '受不了别人敷衍你，但自己偶尔也会敷衍别人——不是故意的，只是电用完了。', category: 'contrast', dimension: 'frictionRisk' },
  { text: '计划和冲动并存——你会在出发前做详细攻略，然后在路上随便改。', category: 'contrast', dimension: 'actionComplement' },
  { text: '想做最酷的人，却有一颗最暖的心。', category: 'contrast', dimension: 'trustPotential' },
  { text: '外表看起来波澜不惊，内心弹幕已经刷了三千条。', category: 'contrast', dimension: 'emotionalResonance' },
  { text: '看起来随遇而安，其实每一步都有自己的盘算。', category: 'contrast', dimension: 'actionComplement' },
  { text: '讨厌麻烦别人但喜欢被人需要——这之间的微妙差别只有自己懂。', category: 'contrast', dimension: 'trustPotential' },
  { text: '最怕矫情的话，但看到走心的内容还是会截图存起来。', category: 'contrast', dimension: 'emotionalResonance' },
  { text: '在安全场合话多到爆炸，在不安全的地方自动开启省电模式。', category: 'contrast', dimension: 'communicationSync' },
  { text: '理智告诉你该走了，但你的热心还没用完。', category: 'contrast', dimension: 'trustPotential' },
];

// ═══════════════════════════════════════════
// 合规校验 — 构建时检查所有文案
// ═══════════════════════════════════════════

// 构建时合规校验
(() => {
  const violations: string[] = [];
  for (const entry of SHARE_COPY_LIBRARY) {
    const result = checkForbiddenTerms(entry.text);
    if (result.length > 0) {
      violations.push(`[${entry.category}] ${entry.text} — 违规词: ${result.join(', ')}`);
    }
  }
  if (violations.length > 0) {
    throw new Error(`分享文案合规校验失败:\n${violations.join('\n')}`);
  }
})();

// ═══════════════════════════════════════════
// 匹配算法
// ═══════════════════════════════════════════

interface ScoreInfo {
  dimensionKey: string;
  score: number;
}

export function getTotalCount(): number {
  return SHARE_COPY_LIBRARY.length;
}

export function getCountByCategory(category: ShareCategory): number {
  return SHARE_COPY_LIBRARY.filter((e) => e.category === category).length;
}

export function matchShareCopy(
  personaType: string,
  scores: ScoreInfo[],
): MatchedShareCopy[] {
  // 找出最高分维度
  let topDim = scores[0]?.dimensionKey ?? '';
  let topScore = 0;

  for (const s of scores) {
    if (s.score > topScore) { topScore = s.score; topDim = s.dimensionKey; }
  }

  // 给每条文案打分
  const scored = SHARE_COPY_LIBRARY.map((entry) => {
    let score = 0;
    // 人格类型匹配
    if (!entry.personaTypes || entry.personaTypes.length === 0) {
      score += 1; // 通用文案给基础分
    } else if (entry.personaTypes.includes(personaType)) {
      score += 3;
    }
    // 维度匹配 — 最高分维度相关
    if (entry.dimension === topDim) score += 2;
    // hidden_truth 加权 — 最易截图
    if (entry.category === 'hidden_truth') score += 1;
    return { entry, score };
  });

  scored.sort((a, b) => b.score - a.score);

  // 按分类汇总 top 3
  const result: MatchedShareCopy[] = [];
  const categories: ShareCategory[] = ['identity_label', 'hidden_truth', 'relationship', 'contrast'];

  for (const cat of categories) {
    const matches = scored
      .filter((s) => s.entry.category === cat)
      .slice(0, 3)
      .map((s) => s.entry.text);

    if (matches.length > 0) {
      result.push({
        category: cat,
        texts: matches,
        primaryText: matches[0],
      });
    }
  }

  return result;
}

// 安全过滤后返回文案
export function safeText(text: string): string {
  return replaceForbiddenTerms(text);
}
