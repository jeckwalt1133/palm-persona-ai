import { z } from 'zod';

export const MatchDimensionSchema = z.object({
  name: z.string(),
  score: z.number().min(0).max(100),
  description: z.string(),
});

export const MatchResultSchema = z.object({
  overall: z.number().min(0).max(100),
  dimensions: z.array(MatchDimensionSchema),
  summary: z.string(),
});

export type MatchDimension = z.infer<typeof MatchDimensionSchema>;

export type MatchResult = z.infer<typeof MatchResultSchema>;
