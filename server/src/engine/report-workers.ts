/**
 * 5Worker 报告内容生成器 — T006/V7-W5-021
 *
 * 将原 writeNarrative+writeSocial 单体函数拆为5个独立Worker:
 *   Worker A: NarrativeWriter  — summary + coreTruth + weeklyAdvice (AI)
 *   Worker B: InsightsWriter   — insights + quote + suspenseText (AI)
 *   Worker C: KeywordsWorker   — keywords 提取 (计算)
 *   Worker D: IdentityWorker   — personaType/Label/identityBadge (AI复用)
 *   Worker E: SocialWorker     — relationshipCode + celebrityMatches (AI)
 *
 * 全5Worker用 Promise.allSettled 并行编排，每个独立降级。
 * 替代原 Mock 单次调用模式。
 */

import { AiProvider } from '../ai/index.js';
import { ResonanceNarrativeEngine } from './resonance-narrative-engine.js';
import {
  PersonaScore,
  PersonaReport,
  VisualAnchors,
  RelationshipCode,
  CelebrityMatch,
} from './types.js';

// ─── Worker 接口 ──────────────────────────────

export interface WorkerContext {
  scores: PersonaScore[];
  visualAnchors: VisualAnchors;
  ai: AiProvider;
  engine: ResonanceNarrativeEngine;
  /** 从scores中提取的top/low维度，避免重复计算 */
  topScore: PersonaScore;
  lowScore: PersonaScore;
}

export interface WorkerResult<T> {
  workerName: string;
  status: 'success' | 'degraded';
  data: T;
}

export function buildContext(
  scores: PersonaScore[],
  visualAnchors: VisualAnchors,
  ai: AiProvider,
  engine: ResonanceNarrativeEngine,
): WorkerContext {
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  return { scores, visualAnchors, ai, engine, topScore: sorted[0], lowScore: sorted[sorted.length - 1] };
}

// ─── Worker A: NarrativeWriter ──────────────────

export interface NarrativeOutput {
  summary: string;
  coreTruth: string;
  weeklyAdvice: string;
  adTeaser: string;
}

const NARRATIVE_FALLBACK: NarrativeOutput = {
  summary: '你的手掌轮廓独特，五维人格画像呈现出丰富的内在世界。每一个分数都是一面镜子，照见你性格中不同维度的光芒。没有绝对的高低之分，只有属于你的独特比例——正是这种比例，让你成为无法被复制的个体。',
  coreTruth: '你比你想象的更鲜活，也比你表现的更深刻',
  weeklyAdvice: '本周尝试每天给自己10分钟独处时间——不用手机不看书，只是安静地和自己待一会',
  adTeaser: '看30秒广告解锁完整人格报告',
};

export async function runNarrativeWorker(ctx: WorkerContext): Promise<WorkerResult<NarrativeOutput>> {
  if (ctx.ai.name === 'mock') {
    const fallback = ctx.engine.generate(
      { hash: 'narrative_w', palmWidth: ctx.visualAnchors.palmWidth, fingerLengthRatio: ctx.visualAnchors.fingerLengthRatio, lineClarity: ctx.visualAnchors.lineClarity, lineCount: ctx.visualAnchors.lineCount, mountProminence: [50, 50, 50, 60, 50] },
      undefined,
    );
    return {
      workerName: 'NarrativeWriter',
      status: 'degraded',
      data: { summary: fallback.summary, coreTruth: fallback.coreTruth, weeklyAdvice: fallback.weeklyAdvice, adTeaser: fallback.adTeaser || '' },
    };
  }

  try {
    const prompt = `五维分数：
${ctx.scores.map(s => `  ${s.dimension}(${s.dimensionKey}): ${s.score}分 — ${s.label}`).join('\n')}
最高维: ${ctx.topScore.dimension}(${ctx.topScore.score}分)
最低维: ${ctx.lowScore.dimension}(${ctx.lowScore.score}分)
视觉锚点: ${ctx.visualAnchors.opening}

输出JSON (不要markdown包裹):
{
  "summary": "综合解读(200字以内,用'你'第二人称,温暖走心)",
  "coreTruth": "一句戳中核心的话(让人想截图发给某个人,15-30字)",
  "weeklyAdvice": "本周建议(50字以内,具体可操作)",
  "adTeaser": "广告解锁引导语(20字以内)"
}`;

    const raw = await ctx.ai.chat([
      { role: 'system', content: '你是掌心人格局的叙事引擎。要求：①走心不空泛 ②温和刺痛+精确共鸣 ③用"倾向于""更容易""大概率"弱化措辞。输出纯JSON。' },
      { role: 'user', content: prompt },
    ], { temperature: 0.8, maxTokens: 800 });

    const parsed = JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
    return {
      workerName: 'NarrativeWriter',
      status: 'success',
      data: {
        summary: parsed.summary || NARRATIVE_FALLBACK.summary,
        coreTruth: parsed.coreTruth || NARRATIVE_FALLBACK.coreTruth,
        weeklyAdvice: parsed.weeklyAdvice || NARRATIVE_FALLBACK.weeklyAdvice,
        adTeaser: parsed.adTeaser || NARRATIVE_FALLBACK.adTeaser,
      },
    };
  } catch (err) {
    console.warn('[NarrativeWorker] 失败，降级:', (err as Error).message);
    return { workerName: 'NarrativeWriter', status: 'degraded', data: { ...NARRATIVE_FALLBACK } };
  }
}

// ─── Worker B: InsightsWriter ───────────────────

export interface InsightsOutput {
  insights: string[];
  quote: string;
  suspenseText: string;
}

const INSIGHTS_FALLBACK: InsightsOutput = {
  insights: [
    '你拥有敏锐的直觉，有时候比理性分析更值得信赖——试着多听听内心的声音',
    '在关系中你既能给予温暖也能守住边界，这是很多人都还在学习的能力',
    '你的创造力在放松时最活跃，给自己留一些完全不做计划的空白时间',
  ],
  quote: '成为自己，是一生的浪漫',
  suspenseText: '这仅仅是冰山一角——你的深层人格画像还有4个维度等待解锁',
};

export async function runInsightsWorker(ctx: WorkerContext): Promise<WorkerResult<InsightsOutput>> {
  if (ctx.ai.name === 'mock') {
    const fallback = ctx.engine.generate(
      { hash: 'insights_w', palmWidth: ctx.visualAnchors.palmWidth, fingerLengthRatio: ctx.visualAnchors.fingerLengthRatio, lineClarity: ctx.visualAnchors.lineClarity, lineCount: ctx.visualAnchors.lineCount, mountProminence: [50, 50, 50, 60, 50] },
      undefined,
    );
    return {
      workerName: 'InsightsWriter',
      status: 'degraded',
      data: { insights: fallback.insights, quote: fallback.quote, suspenseText: fallback.suspenseText || '' },
    };
  }

  try {
    const prompt = `五维分数：
${ctx.scores.map(s => `  ${s.dimension}(${s.dimensionKey}): ${s.score}分 — ${s.label}`).join('\n')}
最高维: ${ctx.topScore.dimension}(${ctx.topScore.score}分) — ${ctx.topScore.description}
最低维: ${ctx.lowScore.dimension}(${ctx.lowScore.score}分) — ${ctx.lowScore.description}

输出JSON (不要markdown包裹):
{
  "insights": ["洞察1(温和刺痛,15-30字)", "洞察2(精确共鸣,15-30字)", "洞察3(正向赋能,15-30字)"],
  "quote": "一句金句(15字以内)",
  "suspenseText": "一句悬念引导语(告知还有更深层分析可解锁,20-40字)"
}`;

    const raw = await ctx.ai.chat([
      { role: 'system', content: '你是掌心人格局的洞察引擎。洞察要让人"卧槽这说的就是我"。要求：①温和刺痛+精确共鸣 ②正向赋能不恐吓 ③输出纯JSON。' },
      { role: 'user', content: prompt },
    ], { temperature: 0.9, maxTokens: 600 });

    const parsed = JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
    return {
      workerName: 'InsightsWriter',
      status: 'success',
      data: {
        insights: Array.isArray(parsed.insights) && parsed.insights.length >= 3
          ? parsed.insights.slice(0, 3) : INSIGHTS_FALLBACK.insights,
        quote: parsed.quote || INSIGHTS_FALLBACK.quote,
        suspenseText: parsed.suspenseText || INSIGHTS_FALLBACK.suspenseText,
      },
    };
  } catch (err) {
    console.warn('[InsightsWorker] 失败，降级:', (err as Error).message);
    return { workerName: 'InsightsWriter', status: 'degraded', data: { ...INSIGHTS_FALLBACK } };
  }
}

// ─── Worker C: KeywordsWorker ───────────────────

export interface KeywordsOutput {
  keywords: string[];
}

export async function runKeywordsWorker(ctx: WorkerContext): Promise<WorkerResult<KeywordsOutput>> {
  // 计算型Worker: 从scores提取+少量AI增强
  const baseKeywords = ctx.scores.map(s => s.label);
  // 添加top/bottom维度名作为关键词
  const enhanced = [...new Set([
    ctx.topScore.dimension,
    ctx.lowScore.dimension,
    ...baseKeywords,
    ctx.topScore.label,
    ctx.lowScore.label,
  ])];

  return {
    workerName: 'KeywordsWorker',
    status: 'success',
    data: { keywords: enhanced.slice(0, 8) },
  };
}

// ─── Worker D: IdentityWorker ────────────────────

export interface IdentityOutput {
  personaType: string;
  personaLabel: string;
  identityBadge: string;
}

const IDENTITY_FALLBACK: IdentityOutput = {
  personaType: 'flame_explorer',
  personaLabel: '火焰探索者',
  identityBadge: '热情驱动的行动派',
};

export async function runIdentityWorker(ctx: WorkerContext): Promise<WorkerResult<IdentityOutput>> {
  if (ctx.ai.name === 'mock') {
    const fallback = ctx.engine.generate(
      { hash: 'identity_w', palmWidth: ctx.visualAnchors.palmWidth, fingerLengthRatio: ctx.visualAnchors.fingerLengthRatio, lineClarity: ctx.visualAnchors.lineClarity, lineCount: ctx.visualAnchors.lineCount, mountProminence: [50, 50, 50, 60, 50] },
      undefined,
    );
    return {
      workerName: 'IdentityWorker',
      status: 'degraded',
      data: { personaType: fallback.personaType, personaLabel: fallback.personaLabel, identityBadge: fallback.identityBadge || '' },
    };
  }

  try {
    const prompt = `五维分数：
${ctx.scores.map(s => `  ${s.dimension}(${s.dimensionKey}): ${s.score}分 — ${s.label}`).join('\n')}
最高维: ${ctx.topScore.dimension}(${ctx.topScore.score}分)
最低维: ${ctx.lowScore.dimension}(${ctx.lowScore.score}分)
视觉锚点: ${ctx.visualAnchors.opening}

输出JSON (不要markdown包裹):
{
  "personaType": "snake_case英文人格类型(如flame_explorer)",
  "personaLabel": "中文人格标签(如'锐意开拓者·行动派型')",
  "identityBadge": "一句话身份标识(10字以内)"
}`;

    const raw = await ctx.ai.chat([
      { role: 'system', content: '你是掌心人格局的人格分类引擎。根据五维分数+视觉锚点判定人格类型。输出纯JSON。' },
      { role: 'user', content: prompt },
    ], { temperature: 0.6, maxTokens: 300 });

    const parsed = JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
    return {
      workerName: 'IdentityWorker',
      status: 'success',
      data: {
        personaType: parsed.personaType || IDENTITY_FALLBACK.personaType,
        personaLabel: parsed.personaLabel || IDENTITY_FALLBACK.personaLabel,
        identityBadge: parsed.identityBadge || IDENTITY_FALLBACK.identityBadge,
      },
    };
  } catch (err) {
    console.warn('[IdentityWorker] 失败，降级:', (err as Error).message);
    return { workerName: 'IdentityWorker', status: 'degraded', data: { ...IDENTITY_FALLBACK } };
  }
}

// ─── Worker E: SocialWriter ─────────────────────

export interface SocialOutput {
  relationshipCode: RelationshipCode;
  celebrityMatches: CelebrityMatch[];
}

const SOCIAL_FALLBACK: SocialOutput = {
  relationshipCode: {
    frequencyLabel: '同频共振型',
    signalPattern: '你的手掌特征指向一种真诚直率的沟通风格——先观察再表达，每一句话都有分量',
    bestMatchType: '坦诚行动派',
    tensionPoint: '你渴望深度连接，但有时候会因过度照顾他人感受而消耗自己',
  },
  celebrityMatches: [
    { name: '未知', title: '待AI分析', reason: '升级AI Provider后解锁名人匹配' },
  ],
};

export async function runSocialWorker(ctx: WorkerContext): Promise<WorkerResult<SocialOutput>> {
  if (ctx.ai.name === 'mock') return { workerName: 'SocialWriter', status: 'degraded', data: { ...SOCIAL_FALLBACK } };

  try {
    const prompt = `五维分数：
${ctx.scores.map(s => `  ${s.dimension}: ${s.score}分 — ${s.label}`).join('\n')}

输出JSON (不要markdown包裹):
{
  "relationshipCode": {
    "frequencyLabel": "关系频率标签(如'同频共振型')",
    "signalPattern": "信号模式描述(40字以内)",
    "bestMatchType": "最佳匹配类型",
    "tensionPoint": "关系张力点(40字以内)"
  },
  "celebrityMatches": [
    {"name": "名人姓名", "title": "身份(演员/企业家/艺术家等)", "reason": "匹配理由(30字)"},
    {"name": "...", "title": "...", "reason": "..."}
  ]
}`;

    const raw = await ctx.ai.chat([
      { role: 'system', content: '你是掌心人格局的关系分析引擎。根据五维人格分数分析关系模式+名人匹配。输出纯JSON。' },
      { role: 'user', content: prompt },
    ], { temperature: 0.9, maxTokens: 800 });

    const parsed = JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
    return {
      workerName: 'SocialWriter',
      status: 'success',
      data: {
        relationshipCode: parsed.relationshipCode || SOCIAL_FALLBACK.relationshipCode,
        celebrityMatches: Array.isArray(parsed.celebrityMatches) && parsed.celebrityMatches.length > 0
          ? parsed.celebrityMatches : SOCIAL_FALLBACK.celebrityMatches,
      },
    };
  } catch (err) {
    console.warn('[SocialWorker] 失败，降级:', (err as Error).message);
    return { workerName: 'SocialWriter', status: 'degraded', data: { ...SOCIAL_FALLBACK } };
  }
}

// ─── 聚合函数 ──────────────────────────────────

export interface AllWorkerResults {
  narrative: WorkerResult<NarrativeOutput>;
  insights: WorkerResult<InsightsOutput>;
  keywords: WorkerResult<KeywordsOutput>;
  identity: WorkerResult<IdentityOutput>;
  social: WorkerResult<SocialOutput>;
}

/**
 * 一键运行全部5个Worker。
 * 用 Promise.allSettled 并行编排，每个Worker独立降级。
 */
export async function runAllWorkers(ctx: WorkerContext): Promise<AllWorkerResults> {
  const [narrative, insights, keywords, identity, social] = await Promise.allSettled([
    runNarrativeWorker(ctx),
    runInsightsWorker(ctx),
    runKeywordsWorker(ctx),
    runIdentityWorker(ctx),
    runSocialWorker(ctx),
  ]);

  // 极端兜底: Worker 函数本身抛异常 (非 try-catch 覆盖的错误)
  const defaultNarrative: WorkerResult<NarrativeOutput> = { workerName: 'NarrativeWriter', status: 'degraded', data: { ...NARRATIVE_FALLBACK } };
  const defaultInsights: WorkerResult<InsightsOutput> = { workerName: 'InsightsWriter', status: 'degraded', data: { ...INSIGHTS_FALLBACK } };
  const defaultKeywords: WorkerResult<KeywordsOutput> = { workerName: 'KeywordsWorker', status: 'degraded', data: { keywords: ctx.scores.map(s => s.label) } };
  const defaultIdentity: WorkerResult<IdentityOutput> = { workerName: 'IdentityWriter', status: 'degraded', data: { ...IDENTITY_FALLBACK } };
  const defaultSocial: WorkerResult<SocialOutput> = { workerName: 'SocialWriter', status: 'degraded', data: { ...SOCIAL_FALLBACK } };

  return {
    narrative: narrative.status === 'fulfilled' ? narrative.value : defaultNarrative,
    insights: insights.status === 'fulfilled' ? insights.value : defaultInsights,
    keywords: keywords.status === 'fulfilled' ? keywords.value : defaultKeywords,
    identity: identity.status === 'fulfilled' ? identity.value : defaultIdentity,
    social: social.status === 'fulfilled' ? social.value : defaultSocial,
  };
}

/**
 * 从 Worker 结果组装完整 PersonaReport。
 */
export function assembleReport(
  id: string,
  scores: PersonaScore[],
  visualAnchors: VisualAnchors,
  results: AllWorkerResults,
): PersonaReport {
  return {
    id,
    createdAt: new Date().toISOString(),
    personaType: results.identity.data.personaType,
    personaLabel: results.identity.data.personaLabel,
    identityBadge: results.identity.data.identityBadge,
    scores,
    summary: results.narrative.data.summary,
    coreTruth: results.narrative.data.coreTruth,
    weeklyAdvice: results.narrative.data.weeklyAdvice,
    adTeaser: results.narrative.data.adTeaser,
    insights: results.insights.data.insights,
    quote: results.insights.data.quote,
    suspenseText: results.insights.data.suspenseText,
    keywords: results.keywords.data.keywords,
    visualAnchors,
    relationshipCode: results.social.data.relationshipCode,
    celebrityMatches: results.social.data.celebrityMatches,
  };
}
