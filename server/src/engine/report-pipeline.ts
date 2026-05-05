/**
 * 5Worker 报告生成流水线 — 第3课架构设计落地
 *
 *  Worker 1: FeatureExtractor   — 手掌特征提取
 *  Worker 2: ScoreCalculator    — 五维评分
 *  Worker 3: NarrativeWriter    — 人格叙事 + 核心真相  ──┐
 *  Worker 4: SocialAnalyzer     — 关系密码 + 名人彩蛋  ──┤ 并行
 *  Worker 5: SafetyGate         — 合规过滤 + 质量门禁
 *
 *  降级策略: AI Provider 失败 → 引擎默认值兜底
 */

import { PalmFeatureExtractor, MockPalmFeatureExtractor, RealPalmFeatureExtractor } from './palm-feature-extractor.js';
import { PersonaScoringEngine, MockPersonaScoringEngine } from './persona-scoring-engine.js';
import { ResonanceNarrativeEngine, MockResonanceNarrativeEngine } from './resonance-narrative-engine.js';
import { ContentSafety, defaultSafety } from '../safety/content-safety.js';
import { runComplianceGate } from '../safety/compliance-gate.js';
import { AiProvider, MockAiProvider } from '../ai/index.js';
import {
  PalmFeatures,
  PersonaScore,
  PersonaReport,
  VisualAnchors,
  RelationshipCode,
  CelebrityMatch,
} from './types.js';

export interface PipelineResult {
  report: PersonaReport;
  complianceViolations: number;
  timing: {
    extractMs: number;
    scoreMs: number;
    narrativeMs: number;
    socialMs: number;
    safetyMs: number;
    totalMs: number;
  };
}

export interface PipelineDeps {
  extractor: PalmFeatureExtractor;
  scoring: PersonaScoringEngine;
  narrative: ResonanceNarrativeEngine;
  ai: AiProvider;
  safety: ContentSafety;
}

function createExtractor(): PalmFeatureExtractor {
  try { return new RealPalmFeatureExtractor(); }
  catch { return new MockPalmFeatureExtractor(); }
}

const defaultDeps: PipelineDeps = {
  extractor: createExtractor(),
  scoring: new MockPersonaScoringEngine(),
  narrative: new MockResonanceNarrativeEngine(),
  ai: new MockAiProvider(),
  safety: defaultSafety,
};

function buildVisualAnchors(features: PalmFeatures): VisualAnchors {
  const w = features.palmWidth;
  const c = features.lineClarity;
  const lc = features.lineCount;
  const fl = features.fingerLengthRatio;
  const mountNames = ['金星丘', '木星丘', '土星丘', '水星丘', '火星丘'];
  const maxMount = mountNames[features.mountProminence.indexOf(Math.max(...features.mountProminence))];

  return {
    opening: `你的手掌${w > 75 ? '偏宽厚' : w > 60 ? '适中' : '偏窄'}，${fl > 0.85 ? '手指修长' : '比例和谐'}，掌心纹路${c > 60 ? '清晰可见' : c > 35 ? '柔和可见' : '若隐若现'}，线条${lc > 5 ? '非常丰富' : lc > 3 ? '丰富' : '简洁'}。手掌最饱满的地方在${maxMount}——每个手掌的轮廓都不一样，这就是你的独特之处。`,
    widthLabel: `${w > 75 ? '偏宽厚' : w > 60 ? '适中' : '偏窄'} · ${w > 75 ? '人群中少见' : w > 60 ? '中等水平' : '精致手型'}`,
    fingerLabel: `${fl > 0.85 ? '修长指型' : fl > 0.75 ? '比例和谐' : '短指型'} · ${fl > 0.85 ? '多于大多数人' : fl > 0.75 ? '中等水平' : '少数人群'}`,
    clarityLabel: `${c > 60 ? '清晰可见' : c > 35 ? '柔和可见' : '若隐若现'} · ${c > 60 ? '多于大多数人' : c > 35 ? '中等水平' : '少数人群'}`,
    lineCountLabel: `${lc > 5 ? '脉络非常丰富' : lc > 3 ? '脉络丰富' : '脉络简洁'} · ${lc > 5 ? '多于大多数人' : lc > 3 ? '中等水平' : '少数人群'}`,
    prominentMount: `${maxMount}突出${features.mountProminence[Math.max(...features.mountProminence.map((v, i) => i === features.mountProminence.indexOf(Math.max(...features.mountProminence)) ? v : 0))] > 70 ? ' — 这通常与情感能量和自我表达有关' : ''}`,
    palmWidth: w,
    lineClarity: c,
    lineCount: lc,
    fingerLengthRatio: fl,
    widthPercentile: `${Math.min(99, Math.round(w))}%`,
    clarityPercentile: `${Math.min(99, Math.round(c))}%`,
    lineCountPercentile: `${Math.min(99, Math.round(lc * 15))}%`,
    fingerPercentile: `${Math.min(99, Math.round(fl * 100))}%`,
  };
}

async function writeNarrative(
  scores: PersonaScore[],
  visualAnchors: VisualAnchors,
  ai: AiProvider,
  engine: ResonanceNarrativeEngine,
): Promise<Pick<PersonaReport, 'personaType' | 'personaLabel' | 'summary' | 'coreTruth' | 'weeklyAdvice' | 'insights' | 'quote' | 'suspenseText' | 'identityBadge' | 'adTeaser'>> {
  if (ai.name === 'mock') {
    const fallback = engine.generate({ hash: 'pipeline', palmWidth: visualAnchors.palmWidth, fingerLengthRatio: visualAnchors.fingerLengthRatio, lineClarity: visualAnchors.lineClarity, lineCount: visualAnchors.lineCount, mountProminence: [50, 50, 50, 60, 50] }, undefined);
    return {
      personaType: fallback.personaType,
      personaLabel: fallback.personaLabel,
      summary: fallback.summary,
      coreTruth: fallback.coreTruth,
      weeklyAdvice: fallback.weeklyAdvice,
      insights: fallback.insights,
      quote: fallback.quote,
      suspenseText: fallback.suspenseText,
      identityBadge: fallback.identityBadge,
      adTeaser: fallback.adTeaser,
    };
  }

  const topScore = [...scores].sort((a, b) => b.score - a.score)[0];
  const lowScore = [...scores].sort((a, b) => a.score - b.score)[scores.length - 1];

  try {
    const aiResult = await ai.chat([
      { role: 'system', content: `你是掌心人格局的AI文案引擎。根据五维人格分数生成走心文案。要求：①每句话让人想截图发给朋友 ②温和刺痛+精确共鸣 ③不空泛不恐吓 ④用"倾向于""更容易""大概率""趣味语境下"等弱化措辞。输出JSON格式。` },
      { role: 'user', content: `五维分数：
${scores.map(s => `  ${s.dimension}(${s.dimensionKey}): ${s.score}分 — ${s.label}`).join('\n')}

最高维: ${topScore.dimension}(${topScore.score}分) — ${topScore.description}
最低维: ${lowScore.dimension}(${lowScore.score}分) — ${lowScore.description}

视觉锚点: ${visualAnchors.opening}

请输出JSON:
{
  "personaType": "snake_case英文",
  "personaLabel": "中文人格标签(如'锐意开拓者·行动派型')",
  "identityBadge": "一句话身份标识",
  "coreTruth": "一句戳中核心的话(让人想发给某个人)",
  "summary": "综合解读(200字以内)",
  "weeklyAdvice": "本周建议(50字以内)",
  "quote": "一句金句(15字以内)",
  "suspenseText": "一句悬念引导语",
  "adTeaser": "广告解锁引导语(20字以内)",
  "insights": ["洞察1", "洞察2", "洞察3"]
}` },
    ], { temperature: 0.8, maxTokens: 1200 });

    const parsed = JSON.parse(aiResult.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
    return {
      personaType: parsed.personaType || 'flame_explorer',
      personaLabel: parsed.personaLabel || '火焰探索者',
      identityBadge: parsed.identityBadge || '',
      coreTruth: parsed.coreTruth || '',
      summary: parsed.summary || '',
      weeklyAdvice: parsed.weeklyAdvice || '',
      quote: parsed.quote || '',
      suspenseText: parsed.suspenseText || '',
      adTeaser: parsed.adTeaser || '',
      insights: Array.isArray(parsed.insights) ? parsed.insights : [],
    };
  } catch (err) {
    console.warn('[Pipeline] Narrative AI 失败，使用引擎兜底:', (err as Error).message);
    const fallback = engine.generate({ hash: 'pipeline_fallback', palmWidth: visualAnchors.palmWidth, fingerLengthRatio: visualAnchors.fingerLengthRatio, lineClarity: visualAnchors.lineClarity, lineCount: visualAnchors.lineCount, mountProminence: [50, 50, 50, 60, 50] }, undefined);
    return {
      personaType: fallback.personaType,
      personaLabel: fallback.personaLabel,
      identityBadge: fallback.identityBadge,
      coreTruth: fallback.coreTruth,
      summary: fallback.summary,
      weeklyAdvice: fallback.weeklyAdvice,
      quote: fallback.quote,
      suspenseText: fallback.suspenseText,
      adTeaser: fallback.adTeaser,
      insights: fallback.insights,
    };
  }
}

async function writeSocial(
  scores: PersonaScore[],
  ai: AiProvider,
): Promise<{ relationshipCode: RelationshipCode; celebrityMatches: CelebrityMatch[] }> {
  const defaultResult = {
    relationshipCode: {
      frequencyLabel: '同频共振型',
      signalPattern: '你的手掌特征指向一种真诚直率的沟通风格',
      bestMatchType: '坦诚行动派',
      tensionPoint: '你渴望深度连接，但有时候会因过度照顾他人感受而消耗自己',
    },
    celebrityMatches: [
      { name: '未知', title: '待AI分析', reason: '升级AI Provider后解锁' },
    ],
  };

  if (ai.name === 'mock') return defaultResult;

  try {
    const aiResult = await ai.chat([
      { role: 'system', content: '你是掌心人格局的关系分析引擎。根据五维人格分数分析关系模式。输出JSON格式。' },
      { role: 'user', content: `五维分数：
${scores.map(s => `  ${s.dimension}: ${s.score}分 — ${s.label}`).join('\n')}

输出JSON:
{
  "relationshipCode": {
    "frequencyLabel": "关系频率标签(如'同频共振型')",
    "signalPattern": "信号模式描述",
    "bestMatchType": "最佳匹配类型",
    "tensionPoint": "关系张力点"
  },
  "celebrityMatches": [
    {"name": "名人姓名", "title": "身份(演员/企业家/艺术家等)", "reason": "匹配理由(30字以内)"},
    {"name": "...", "title": "...", "reason": "..."}
  ]
}` },
    ], { temperature: 0.9, maxTokens: 800 });

    const parsed = JSON.parse(aiResult.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
    return {
      relationshipCode: parsed.relationshipCode || defaultResult.relationshipCode,
      celebrityMatches: Array.isArray(parsed.celebrityMatches) && parsed.celebrityMatches.length > 0
        ? parsed.celebrityMatches : defaultResult.celebrityMatches,
    };
  } catch (err) {
    console.warn('[Pipeline] Social AI 失败，使用默认值:', (err as Error).message);
    return defaultResult;
  }
}

export async function runPipeline(
  imageBase64: string,
  deps: Partial<PipelineDeps> = {},
): Promise<PipelineResult> {
  const d: PipelineDeps = { ...defaultDeps, ...deps };
  const t0 = Date.now();

  // Worker 1: 特征提取
  const t1 = Date.now();
  const features = await d.extractor.extract(Buffer.from(imageBase64, 'base64'));
  const extractMs = Date.now() - t1;

  // Worker 2: 五维评分
  const t2 = Date.now();
  const scores = d.scoring.score(features);
  const scoreMs = Date.now() - t2;

  // 构建视觉锚点
  const visualAnchors = buildVisualAnchors(features);

  // Worker 3 + Worker 4: 并行执行
  const t3 = Date.now();
  const [narrativeResult, socialResult] = await Promise.all([
    writeNarrative(scores, visualAnchors, d.ai, d.narrative),
    writeSocial(scores, d.ai),
  ]);
  const narrativeMs = Date.now() - t3;
  const socialMs = 0; // 并行计时在 narrativeMs 中

  // Worker 5: 合规安全门禁
  const t5 = Date.now();
  let report: PersonaReport = {
    id: features.hash,
    createdAt: new Date().toISOString(),
    personaType: narrativeResult.personaType,
    personaLabel: narrativeResult.personaLabel,
    scores,
    summary: narrativeResult.summary,
    insights: narrativeResult.insights,
    keywords: scores.map(s => s.label),
    quote: narrativeResult.quote,
    suspenseText: narrativeResult.suspenseText,
    coreTruth: narrativeResult.coreTruth,
    weeklyAdvice: narrativeResult.weeklyAdvice,
    visualAnchors,
    identityBadge: narrativeResult.identityBadge,
    adTeaser: narrativeResult.adTeaser,
    relationshipCode: socialResult.relationshipCode,
    celebrityMatches: socialResult.celebrityMatches,
  };

  const complianceResult = runComplianceGate(report, d.safety);
  report = complianceResult.report;
  const safetyMs = Date.now() - t5;

  return {
    report,
    complianceViolations: complianceResult.totalViolations,
    timing: {
      extractMs,
      scoreMs,
      narrativeMs,
      socialMs,
      safetyMs,
      totalMs: Date.now() - t0,
    },
  };
}
