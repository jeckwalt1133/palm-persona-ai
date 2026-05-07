import { PalmFeatureExtractor, MockPalmFeatureExtractor, RealPalmFeatureExtractor } from '../engine/palm-feature-extractor.js';
import { ResonanceNarrativeEngine } from '../engine/resonance-narrative-engine.js';
import { MockResonanceNarrativeEngine } from '../engine/resonance-narrative-engine.js';
import { ReportRepository } from '../repository/report-repository.js';
import { reportRepo } from '../repository/index.js';
import { ContentSafety, defaultSafety } from '../safety/content-safety.js';
import { AiProvider, MockAiProvider } from '../ai/index.js';
import { DoubaoVisionProvider } from '../ai/doubao-vision-provider.js';
import { VisionPalmFeatureExtractor } from '../engine/vision-feature-extractor.js';
import { PersonaReport, AnalysisContext } from '../engine/types.js';
import { seedDemoReports } from '../seed/reports.js';
import { ReportAgent } from '../agent/report-agent.js';

// SQLite 共享存储，供 ReportAgent 和 AnalysisService 共用
export const sharedRepo = reportRepo;

function createBestExtractor(): PalmFeatureExtractor {
  // 优先: 豆包 VL AI 视觉分析
  const doubaoKey = process.env.DOUBAO_API_KEY;
  if (doubaoKey) {
    try {
      const visionAi = new DoubaoVisionProvider(doubaoKey);
      return new VisionPalmFeatureExtractor(visionAi);
    } catch { /* 降级 */ }
  }
  // 备选: Sobel CV 真实图像处理
  try { return new RealPalmFeatureExtractor(); }
  catch { /* 降级 */ }
  // 兜底: Mock
  console.warn('[AnalysisService] 所有真实提取器不可用，降级为 Mock');
  return new MockPalmFeatureExtractor();
}

export interface AnalysisService {
  analyze(imageBase64: string, context?: AnalysisContext): Promise<PersonaReport>;
  getReport(id: string): Promise<PersonaReport | null>;
  listReports(): Promise<PersonaReport[]>;
  deleteReport(id: string): Promise<boolean>;
  setFeedback(id: string, rating: number, comment?: string): Promise<boolean>;
  seedDemoData(): Promise<void>;
}

export class MockAnalysisService implements AnalysisService {
  private extractor: PalmFeatureExtractor;
  private engine: ResonanceNarrativeEngine;
  private repo: ReportRepository;
  private safety: ContentSafety;
  private aiProvider: AiProvider;
  private agent: ReportAgent;

  constructor(
    extractor?: PalmFeatureExtractor,
    engine?: ResonanceNarrativeEngine,
    repo?: ReportRepository,
    aiProvider?: AiProvider,
  ) {
    this.extractor = extractor ?? createBestExtractor();
    this.engine = engine ?? new MockResonanceNarrativeEngine();
    this.repo = repo ?? sharedRepo;
    this.safety = defaultSafety;
    this.aiProvider = aiProvider ?? new MockAiProvider();
    this.agent = new ReportAgent(this.extractor, this.engine, this.safety, this.aiProvider, this.repo);
  }

  async analyze(imageBase64: string, context?: AnalysisContext): Promise<PersonaReport> {
    const result = await this.agent.generate(imageBase64, context);
    return result.report;
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

  async setFeedback(id: string, rating: number, comment?: string): Promise<boolean> {
    return this.repo.setFeedback(id, rating, comment);
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
