import { ReportRepository } from '../repository/report-repository.js';
import { MockResonanceNarrativeEngine } from '../engine/resonance-narrative-engine.js';
import { MockPalmFeatureExtractor } from '../engine/palm-feature-extractor.js';

const DEMO_HASHES = [
  'demo-seed-starry-dreamer-001',
  'demo-seed-silent-guardian-002',
  'demo-seed-gentle-healer-003',
];

export async function seedDemoReports(repo: ReportRepository): Promise<void> {
  const existing = await repo.findAll();
  if (existing.length > 0) return; // 已有数据不重复播种

  const engine = new MockResonanceNarrativeEngine();
  const extractor = new MockPalmFeatureExtractor();

  for (const hash of DEMO_HASHES) {
    const features = await extractor.extract(Buffer.from(hash));
    // 覆盖 hash 保证每次生成同一个人格
    features.hash = hash;
    const report = engine.generate(features);
    // 错开创建时间
    const ages = [0, -3600000, -7200000]; // 0h, 1h, 2h ago
    const idx = DEMO_HASHES.indexOf(hash);
    report.createdAt = new Date(Date.now() + ages[idx]).toISOString();
    await repo.save(report);
  }

  console.log(`[seed] 已播种 ${DEMO_HASHES.length} 条演示报告`);
}
