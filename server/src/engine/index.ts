export type { PalmFeatures, AnalysisContext, PersonaScore, PersonaReport } from './types.js';
export type { PalmFeatureExtractor } from './palm-feature-extractor.js';
export type { PersonaScoringEngine } from './persona-scoring-engine.js';
export type { ResonanceNarrativeEngine } from './resonance-narrative-engine.js';
export type { CompatibilityEngine, CompatibilityResult, MatchDimension } from './compatibility-engine.js';

export { MockPalmFeatureExtractor } from './palm-feature-extractor.js';
export { MockPersonaScoringEngine } from './persona-scoring-engine.js';
export { MockResonanceNarrativeEngine } from './resonance-narrative-engine.js';
export { MockCompatibilityEngine } from './compatibility-engine.js';

export {
  getAllTemplates,
  getTemplateByType,
  getDimensions,
  PERSONA_TEMPLATES,
  QUOTE_TEMPLATES,
} from './persona-templates.js';
