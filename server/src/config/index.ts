import { z } from 'zod';

const configSchema = z.object({
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  port: z.coerce.number().default(3001),
  aiProvider: z.enum(['mock', 'openai', 'claude', 'dashscope', 'doubao', 'hunyuan', 'deepseek', 'qwen']).default('mock'),
  aiModel: z.string().optional(),
  maxImageSizeMb: z.coerce.number().default(5),
  contentSafetyLevel: z.enum(['strict', 'normal', 'disabled']).default('strict'),

  // API Keys
  openaiApiKey: z.string().optional(),
  openaiBaseUrl: z.string().optional(),
  claudeApiKey: z.string().optional(),
  dashscopeApiKey: z.string().optional(),
  doubaoApiKey: z.string().optional(),
  hunyuanApiKey: z.string().optional(),
  deepseekApiKey: z.string().optional(),
});

export type Config = z.infer<typeof configSchema>;

function envToCamelCase(key: string): string {
  return key.toLowerCase().replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

export function loadConfig(): Config {
  const env = Object.fromEntries(
    Object.entries(process.env).map(([k, v]) => [envToCamelCase(k), v]),
  );
  const parsed = configSchema.safeParse(env);
  if (!parsed.success) {
    console.error('[CONFIG] 配置验证失败，使用默认值。请检查环境变量:', parsed.error.flatten());
    return configSchema.parse({}); // fallback to defaults
  }
  return parsed.data;
}
