/**
 * Agent 报告管线 — 第10课：毕业设计
 *
 * 整合第1-9课所有知识，构建统一的 Agent 式报告生成管线：
 *
 *   Pre-check → Generate → Compliance Gate → Quality Score → Reflect → Log
 *
 * 架构：
 *   ReportAgent (Orchestrator)
 *   ├─ PreCheckWorker    — 输入合法性 + 安全审计
 *   ├─ GenerateWorker    — 引擎 + AI Provider (复用现有)
 *   ├─ ComplianceWorker  — 全字段合规门禁 (Lesson 9)
 *   ├─ QualityWorker     — 质量评分 + 改进建议 (Lesson 3)
 *   └─ ReflexionLog     — 反思记录 + 持续改进 (Lesson 7)
 *
 * 覆盖课程：L1 Agent SDK / L2 MCP / L3 多Agent / L4 Skill / L5 论文评估
 *            L6 安全审计 / L7 Reflexion / L8 工具对比 / L9 项目实战
 */

import { PersonaReport, AnalysisContext } from '../engine/types.js';
import { ResonanceNarrativeEngine, MockResonanceNarrativeEngine } from '../engine/resonance-narrative-engine.js';
import { PalmFeatureExtractor, MockPalmFeatureExtractor } from '../engine/palm-feature-extractor.js';
import { PersonaScoringEngine, MockPersonaScoringEngine } from '../engine/persona-scoring-engine.js';
import { runPipeline } from '../engine/report-pipeline.js';
import { ContentSafety, defaultSafety } from '../safety/content-safety.js';
import { type ComplianceGateResult } from '../safety/compliance-gate.js';
import { AiProvider } from '../ai/index.js';
import { ReportRepository } from '../repository/report-repository.js';

// ─── 类型 ────────────────────────────────────────

export interface PreCheckResult {
  passed: boolean;
  issues: string[];
  imageBase64: string;
}

export interface QualityReport {
  score: number;
  hasVisualAnchors: boolean;
  hasCoreTruth: boolean;
  insightCount: number;
  issues: string[];
  suggestions: string[];
}

export interface ReflexionEntry {
  timestamp: number;
  reportId: string;
  personaType: string;
  complianceViolations: number;
  qualityScore: number;
  lessons: string[];
}

export interface AgentPipelineResult {
  report: PersonaReport;
  pipeline: {
    preCheck: PreCheckResult;
    complianceGate: ComplianceGateResult;
    quality: QualityReport;
    totalMs: number;
  };
}

// ─── PreCheck Worker ─────────────────────────────

class PreCheckWorker {
  run(imageBase64: string): PreCheckResult {
    const issues: string[] = [];
    if (!imageBase64 || imageBase64.length < 50) {
      issues.push('图片数据无效或过小');
    }
    const estimatedBytes = imageBase64.length * 0.75;
    if (estimatedBytes > 10 * 1024 * 1024) {
      issues.push('图片过大(超过10MB)');
    }
    const header = imageBase64.slice(0, 20);
    if (!header.match(/^[A-Za-z0-9+/=]+$/)) {
      issues.push('图片格式不支持');
    }
    return { passed: issues.length === 0, issues, imageBase64 };
  }
}

// ─── Quality Worker (复用 Lesson 3 质量分析器) ──

class QualityWorker {
  evaluate(report: PersonaReport): QualityReport {
    const issues: string[] = [];
    const suggestions: string[] = [];
    const allText = [report.summary, report.coreTruth, ...report.insights].join(' ');

    const hasAnchors = ['手掌', '掌心', '手指', '线条', '轮廓', '纹路', '特征'].some(a => allText.includes(a));
    if (!hasAnchors) {
      issues.push('缺少视觉锚点');
      suggestions.push('加入手掌特征引用（宽度/纹路清晰度/掌丘）');
    }

    const hasTruth = report.coreTruth.length > 10;
    if (!hasTruth) {
      issues.push('核心真相为空或太短');
      suggestions.push('核心真相需≥10字，描述具体人格矛盾点');
    }

    const hasAdvice = report.weeklyAdvice.length > 10;
    if (!hasAdvice) {
      issues.push('本周建议为空或太短');
      suggestions.push('每周建议需具体可操作，而非泛泛而谈');
    }

    if (report.insights.length < 3) {
      issues.push(`洞察仅${report.insights.length}条`);
      suggestions.push('洞察需≥3条');
    }

    const generic = ['善良', '有潜力', '很好', '很棒'];
    if (generic.some(g => allText.includes(g))) {
      issues.push('包含空泛表述');
      suggestions.push('替换"善良/有潜力"为具体行为描述');
    }

    const score = Math.max(0, 100
      - (hasAnchors ? 0 : 25)
      - (hasTruth ? 0 : 20)
      - (hasAdvice ? 0 : 15)
      - (report.insights.length >= 3 ? 0 : 15)
      - (issues.some(i => i.includes('空泛')) ? 10 : 0)
    );

    return {
      score,
      hasVisualAnchors: hasAnchors,
      hasCoreTruth: hasTruth,
      insightCount: report.insights.length,
      issues,
      suggestions,
    };
  }
}

// ─── Reflexion Logger ────────────────────────────

class ReflexionLogger {
  private entries: ReflexionEntry[] = [];

  log(
    reportId: string,
    personaType: string,
    complianceViolations: number,
    qualityScore: number,
    lessons: string[],
  ): void {
    this.entries.push({
      timestamp: Date.now(),
      reportId,
      personaType,
      complianceViolations,
      qualityScore,
      lessons,
    });
  }

  getStats(): { totalReports: number; avgQuality: number; commonLessons: string[] } {
    if (this.entries.length === 0) {
      return { totalReports: 0, avgQuality: 0, commonLessons: [] };
    }
    const avgQ = Math.round(this.entries.reduce((s, e) => s + e.qualityScore, 0) / this.entries.length);
    const lessonCount = new Map<string, number>();
    for (const e of this.entries) {
      for (const l of e.lessons) {
        const key = l.slice(0, 30);
        lessonCount.set(key, (lessonCount.get(key) || 0) + 1);
      }
    }
    const common = [...lessonCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([lesson]) => lesson);
    return { totalReports: this.entries.length, avgQuality: avgQ, commonLessons: common };
  }
}

// ─── ReportAgent (Orchestrator) ──────────────────

export class ReportAgent {
  private extractor: PalmFeatureExtractor;
  private scoring: PersonaScoringEngine;
  private engine: ResonanceNarrativeEngine;
  private safety: ContentSafety;
  private aiProvider: AiProvider;
  private repo: ReportRepository;
  private reflexion = new ReflexionLogger();

  constructor(
    extractor?: PalmFeatureExtractor,
    engine?: ResonanceNarrativeEngine,
    safety?: ContentSafety,
    aiProvider?: AiProvider,
    repo?: ReportRepository,
  ) {
    this.extractor = extractor ?? new MockPalmFeatureExtractor();
    this.scoring = new MockPersonaScoringEngine();
    this.engine = engine ?? new MockResonanceNarrativeEngine();
    this.safety = safety ?? defaultSafety;
    this.aiProvider = aiProvider!; // 由调用方设置
    this.repo = repo!;
  }

  async generate(imageBase64: string, _context?: AnalysisContext): Promise<AgentPipelineResult> {
    const start = Date.now();
    const lessons: string[] = [];

    // Step 1: Pre-check (输入合法性)
    const preCheckWorker = new PreCheckWorker();
    const preCheck = preCheckWorker.run(imageBase64);
    if (!preCheck.passed) {
      throw new Error(`Pre-check 失败: ${preCheck.issues.join(', ')}`);
    }

    // Step 2: 去重 — 先用 extractor 算 hash
    const features = this.extractor.extract(Buffer.from(imageBase64, 'base64'));
    const existing = await this.repo.findById(features.hash);
    if (existing) {
      return {
        report: existing,
        pipeline: { preCheck, complianceGate: { passed: true, violations: [], totalViolations: 0, report: existing }, quality: { score: 100, hasVisualAnchors: true, hasCoreTruth: true, insightCount: existing.insights.length, issues: [], suggestions: [] }, totalMs: Date.now() - start },
      };
    }

    // Step 3-7: 5Worker 并行流水线 (特征→评分→叙事∥社交→合规)
    const pipelineResult = await runPipeline(imageBase64, {
      extractor: this.extractor,
      scoring: this.scoring,
      narrative: this.engine,
      ai: this.aiProvider,
      safety: this.safety,
    });
    const report = pipelineResult.report;

    // 合规门禁（流水线内部已完成，此处仅获取结果）
    const complianceGate: ComplianceGateResult = {
      passed: pipelineResult.complianceViolations === 0,
      violations: [],
      totalViolations: pipelineResult.complianceViolations,
      report,
    };
    if (pipelineResult.complianceViolations > 0) {
      lessons.push(`合规: 自动过滤${pipelineResult.complianceViolations}个违规词`);
    }

    // Step 8: 质量评分
    const qualityWorker = new QualityWorker();
    const quality = qualityWorker.evaluate(report);
    for (const s of quality.suggestions) {
      lessons.push(`质量: ${s}`);
    }

    // Step 9: 反思日志
    this.reflexion.log(
      report.id,
      report.personaType,
      complianceGate.totalViolations,
      quality.score,
      lessons,
    );

    // Step 10: 存储
    await this.repo.save(report);

    return {
      report,
      pipeline: {
        preCheck,
        complianceGate,
        quality,
        totalMs: Date.now() - start,
      },
    };
  }

  getReflexionStats() { return this.reflexion.getStats(); }
}
