// 引擎层类型定义 — 与 packages/shared-types 保持一致
// 此处定义运行时类型，types/report.ts 定义 Zod 校验

export interface PalmFeatures {
  hash: string;
  palmWidth: number;
  fingerLengthRatio: number;
  lineClarity: number;
  lineCount: number;
  mountProminence: number[];
}

export interface AnalysisContext {
  mood?: string;
  focusArea?: string;
}

export interface PersonaScore {
  dimension: string;
  dimensionKey: string;
  score: number;
  label: string;
  description: string;
}

export interface VisualAnchors {
  opening: string;
  widthLabel: string;
  fingerLabel: string;
  clarityLabel: string;
  lineCountLabel: string;
  prominentMount: string;
  palmWidth: number;
  lineClarity: number;
  lineCount: number;
  fingerLengthRatio: number;
  widthPercentile: string;
  clarityPercentile: string;
  lineCountPercentile: string;
  fingerPercentile: string;
}

export interface CelebrityMatch {
  name: string;
  title: string;
  reason: string;
}

export interface RelationshipCode {
  frequencyLabel: string;
  signalPattern: string;
  bestMatchType: string;
  tensionPoint: string;
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
  suspenseText: string;
  coreTruth: string;
  weeklyAdvice: string;
  visualAnchors?: VisualAnchors;
  identityBadge?: string;
  adTeaser?: string;
  relationshipCode?: RelationshipCode;
  celebrityMatches?: CelebrityMatch[];
}

export interface MatchDimension {
  name: string;
  score: number;
  description: string;
}

export interface CompatibilityResult {
  overall: number;
  dimensions: MatchDimension[];
  summary: string;
}

// 分析请求
export interface AnalyzeRequest {
  imageBase64: string;
  context?: AnalysisContext;
}

// 匹配邀请
export interface MatchInvite {
  id: string;
  inviterReportId: string;
  createdAt: string;
  expiresAt: string;
  status: 'pending' | 'joined' | 'expired';
  joinerReportId?: string;
  result?: CompatibilityResult;
}

// 反馈
export interface ReportFeedback {
  reportId: string;
  userId: string;
  rating: number;
  comment?: string;
  createdAt: string;
}
