import { PalmFeatureExtractor } from '../engine/palm-feature-extractor.js';
import { MockPalmFeatureExtractor } from '../engine/palm-feature-extractor.js';
import { ResonanceNarrativeEngine } from '../engine/resonance-narrative-engine.js';
import { MockResonanceNarrativeEngine } from '../engine/resonance-narrative-engine.js';
import { ReportRepository } from '../repository/report-repository.js';
import { InMemoryReportRepository } from '../repository/report-repository.js';
import { ContentSafety, defaultSafety } from '../safety/content-safety.js';
import { AiProvider, MockAiProvider } from '../ai/index.js';
import { PersonaReport, AnalysisContext } from '../engine/types.js';
import { seedDemoReports } from '../seed/reports.js';

export interface AnalysisService {
  analyze(imageBase64: string, context?: AnalysisContext): Promise<PersonaReport>;
  getReport(id: string): Promise<PersonaReport | null>;
  listReports(): Promise<PersonaReport[]>;
  deleteReport(id: string): Promise<boolean>;
  seedDemoData(): Promise<void>;
}

export class MockAnalysisService implements AnalysisService {
  private extractor: PalmFeatureExtractor;
  private engine: ResonanceNarrativeEngine;
  private repo: ReportRepository;
  private safety: ContentSafety;
  private aiProvider: AiProvider;

  constructor(
    extractor?: PalmFeatureExtractor,
    engine?: ResonanceNarrativeEngine,
    repo?: ReportRepository,
    aiProvider?: AiProvider,
  ) {
    this.extractor = extractor ?? new MockPalmFeatureExtractor();
    this.engine = engine ?? new MockResonanceNarrativeEngine();
    this.repo = repo ?? new InMemoryReportRepository();
    this.safety = defaultSafety;
    this.aiProvider = aiProvider ?? new MockAiProvider();
  }

  async analyze(imageBase64: string, context?: AnalysisContext): Promise<PersonaReport> {
    // 1. 基础校验
    if (!imageBase64 || imageBase64.length < 50) {
      throw new Error('图片数据无效或过小');
    }

    // 2. 图片大小检查（10MB limit）
    const estimatedBytes = imageBase64.length * 0.75;
    if (estimatedBytes > 10 * 1024 * 1024) {
      throw new Error('图片过大，请压缩后重试');
    }

    // 3. 非手掌图片检测（简化版：检查最小像素标志）
    const header = imageBase64.slice(0, 20);
    if (!header.match(/^[A-Za-z0-9+/=]+$/)) {
      throw new Error('图片格式不支持，请上传 JPG 或 PNG 格式');
    }

    // 4. 提取特征
    const features = this.extractor.extract(Buffer.from(imageBase64, 'base64'));

    // 5. 去重检查
    const existing = await this.repo.findById(features.hash);
    if (existing) return existing;

    // 6. 生成报告骨架（引擎）
    const report = this.engine.generate(features, context);

    // 7. AI Provider 生成叙事文案（真实 AI 润色或生成完整文案）
    if (this.aiProvider.name !== 'mock') {
      try {
        const scoresText = report.scores
          .map((s) => `${s.dimension}: ${s.score}分（${s.label}）`)
          .join('\n');

        const aiSummary = await this.aiProvider.chat([
          {
            role: 'system',
            content: `你是一个人格分析助手。根据五维人格数据生成以下内容：

1. **维度解析**：为每个维度写一段个性化描述（30-50字），要结合具体分数、有洞察力
2. **综合分析**：200-300字综合分析，温暖有洞察力
3. **关系洞察**：3条洞察（每条15-25字）

格式：
---维度解析---
情绪频率: [描述]
沟通同步: [描述]
行动互补: [描述]
信任潜力: [描述]
摩擦风险: [描述]

---综合分析---
[文案]

---关系洞察---
1. [洞察1]
2. [洞察2]
3. [洞察3]

要求：
- 语气温暖但不矫情，有洞察力但不武断
- 使用"倾向于""更容易"等温和措辞，避免绝对化表达（"一定""必然""注定"）
- 不涉及迷信、命运、占卜等敏感内容
- 结合具体分数给出有针对性的分析，而非泛泛而谈`,
          },
          {
            role: 'user',
            content: `人格类型：${report.personaLabel}
五维分数：
${scoresText}

请基于以上数据生成维度解析、综合分析文案和关系洞察。`,
          },
        ]);

        // 1. 解析维度解析
        const dimMatch = aiSummary.match(/---维度解析---\n*([\s\S]*?)\n*---综合分析---/);
        if (dimMatch?.[1]?.trim()) {
          const dimLines = dimMatch[1].trim().split('\n');
          for (const line of dimLines) {
            const colonIdx = line.indexOf(':');
            if (colonIdx === -1) continue;
            const dimName = line.slice(0, colonIdx).trim();
            const desc = line.slice(colonIdx + 1).trim();
            if (desc.length < 10) continue;
            // 按名称匹配，更新对应维度的描述
            const match = report.scores.find((s) => s.dimension === dimName);
            if (match) match.description = desc;
          }
        }

        // 2. 解析综合分析
        const summaryMatch = aiSummary.match(/---综合分析---\n*([\s\S]*?)\n*---关系洞察---/);
        const insightMatch = aiSummary.match(/---关系洞察---\n*([\s\S]*)/);

        if (summaryMatch?.[1]?.trim()) {
          report.summary = summaryMatch[1].trim();
        }
        if (insightMatch?.[1]?.trim()) {
          const lines = insightMatch[1]
            .split('\n')
            .map((l) => l.replace(/^\d+[\.\、]\s*/, '').trim())
            .filter(Boolean);
          if (lines.length >= 2) {
            report.insights = lines.slice(0, 3);
          }
        }
      } catch (err) {
        console.warn('AI 生成失败，使用模板文案:', err instanceof Error ? err.message : err);
      }
    } else {
      // mock 模式：用模板文案（已在 engine.generate 中生成）
    }

    // 8. 安全过滤
    const safetyResult = this.safety.check(report.summary);
    if (!safetyResult.safe) {
      report.summary = safetyResult.filteredText;
    }

    // 9. 存储
    await this.repo.save(report);

    return report;
  }

  async getReport(id: string): Promise<PersonaReport | null> {
    return this.repo.findById(id);
  }

  async listReports(): Promise<PersonaReport[]> {
    return this.repo.findAll();
  }

  async deleteReport(id: string): Promise<boolean> {
    return this.repo.deleteById(id);
  }

  setAiProvider(provider: AiProvider): void {
    this.aiProvider = provider;
  }

  async seedDemoData(): Promise<void> {
    await seedDemoReports(this.repo);
  }
}

// 单例
export const analysisService = new MockAnalysisService();
