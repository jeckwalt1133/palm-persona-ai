import { z } from 'zod';

export const PersonaScoreSchema = z.object({
  dimension: z.string(),
  dimensionKey: z.string(),
  score: z.number().min(0).max(100),
  label: z.string(),
  description: z.string(),
});

export const PersonaReportSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  personaType: z.string(),
  personaLabel: z.string(),
  scores: z.array(PersonaScoreSchema),
  summary: z.string(),
  insights: z.array(z.string()),
  keywords: z.array(z.string()),
  quote: z.string(),
  suspenseText: z.string(),
  coreTruth: z.string(),
  weeklyAdvice: z.string(),
});

export type PersonaScore = z.infer<typeof PersonaScoreSchema>;
export type PersonaReport = z.infer<typeof PersonaReportSchema>;
