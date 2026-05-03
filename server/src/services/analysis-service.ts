import { PalmFeatureExtractor } from '../engine/palm-feature-extractor.js';
import { MockPalmFeatureExtractor } from '../engine/palm-feature-extractor.js';
import { ResonanceNarrativeEngine } from '../engine/resonance-narrative-engine.js';
import { MockResonanceNarrativeEngine } from '../engine/resonance-narrative-engine.js';
import { ReportRepository } from '../repository/report-repository.js';
import { InMemoryReportRepository } from '../repository/report-repository.js';
import { ContentSafety, defaultSafety } from '../safety/content-safety.js';
import { AiProvider, MockAiProvider } from '../ai/index.js';
import { PersonaReport, AnalysisContext } from '../engine/types.js';

export interface AnalysisService {
  analyze(imageBase64: string, context?: AnalysisContext): Promise<PersonaReport>;
  getReport(id: string): Promise<PersonaReport | null>;
  listReports(): Promise<PersonaReport[]>;
  deleteReport(id: string): Promise<boolean>;
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
  ) {
    this.extractor = extractor ?? new MockPalmFeatureExtractor();
    this.engine = engine ?? new MockResonanceNarrativeEngine();
    this.repo = repo ?? new InMemoryReportRepository();
    this.safety = defaultSafety;
    this.aiProvider = new MockAiProvider();
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

    // 7. AI Provider 润色叙事文案（mock 模式返回模板文案）
    try {
      const polishedSummary = await this.aiProvider.chat([
        { role: 'system', content: '你是人格分析助手，将分析骨架润色为温暖有力的中文文案。保持原意，增强共鸣。' },
        { role: 'user', content: `请润色以下分析：${report.summary}` },
      ]);
      // 只在 mock 模式下有意义，真实 AI 会润色文案
      if (polishedSummary && polishedSummary.length > 20) {
        report.summary = polishedSummary;
      }
    } catch {
      // AI 润色失败，保留引擎原文
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
}

// 单例
export const analysisService = new MockAnalysisService();
