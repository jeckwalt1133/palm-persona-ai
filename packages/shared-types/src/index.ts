// @palm/shared-types — 前后端共享类型定义
// 注意：此处定义纯类型，不引入任何运行时依赖

export interface PersonaScore {
  dimension: string;
  dimensionKey: string;
  score: number;
  label: string;
  description: string;
}

export interface PersonaReport {
  id: string;
  createdAt: string;
  personaType: string;
  personaLabel: string;
  scores: PersonaScore[];
  summary: string;
  insights: string[];
  keywords: string[];
  quote: string;
}

export interface MatchDimension {
  label: string;
  key: string;
  scoreA: number;
  scoreB: number;
  matchScore: number;
  description: string;
}

export interface MatchResult {
  matchId: string;
  overallScore: number;
  dimensions: MatchDimension[];
  narrative: string;
  disclaimer: string;
}

export interface PalmFeatures {
  hash: string;
  fingerLengthRatio: number;
  palmWidthRatio: number;
  heartLineCurvature: number;
  headLineDepth: number;
  lifeLineLength: number;
  thumbAngle: number;
  fingerShapeIndex: number;
  skinTextureScore: number;
  mountProminence: number[];
  lineClarity: number;
  gridDensity: number;
  colorBalance: number;
  symmetryIndex: number;
  marginShape: number;
}

export interface AnalysisContext {
  questionnaireAnswers?: Record<string, string>;
  platform?: 'weapp' | 'tt';
  abTestGroup?: string;
}

export type AiProviderName = 'mock' | 'openai' | 'claude' | 'dashscope' | 'doubao' | 'hunyuan';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export type SafetyLevel = 'strict' | 'moderate';
