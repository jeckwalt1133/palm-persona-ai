import { AiProvider } from './types.js';
import { MockAiProvider } from './mock-provider.js';
import { DeepSeekProvider } from './deepseek-provider.js';
import { DoubaoProvider } from './doubao-provider.js';
import { QwenProvider } from './qwen-provider.js';
import { FallbackProvider } from './fallback-provider.js';
import { Config } from '../config/index.js';

function tryCreateProvider(name: string, config: Config): AiProvider | null {
  switch (name) {
    case 'deepseek': {
      const key = config.deepseekApiKey;
      if (!key) { console.warn('[AI] DEEPSEEK_API_KEY 未配置，跳过'); return null; }
      return new DeepSeekProvider(key, config.aiModel ?? 'deepseek-chat');
    }
    case 'doubao': {
      const key = config.doubaoApiKey;
      if (!key) { console.warn('[AI] DOUBAO_API_KEY 未配置，跳过'); return null; }
      return new DoubaoProvider(key, 'doubao-seed-2-0-pro-260215');
    }
    case 'qwen': {
      const key = config.dashscopeApiKey;
      if (!key) { console.warn('[AI] DASHSCOPE_API_KEY 未配置，跳过'); return null; }
      return new QwenProvider(key, 'qwen3-max');
    }
    default:
      return null;
  }
}

export function createAiProvider(config: Config): AiProvider {
  const primary = config.aiProvider;

  if (primary === 'mock') {
    return new MockAiProvider();
  }

  // 降级链路：主 Provider → 豆包 → 千问 → Mock（去重）
  const fallbackOrder = [primary, 'doubao', 'qwen'].filter(
    (v, i, a) => a.indexOf(v) === i,
  );

  const providers: AiProvider[] = [];
  for (const name of fallbackOrder) {
    const provider = tryCreateProvider(name, config);
    if (provider) providers.push(provider);
  }

  // Mock 作为最终兜底
  const mockProvider = new MockAiProvider();
  providers.push(mockProvider);

  if (providers.length === 1) {
    console.log(`[AI] 单 Provider 模式: mock (其他未配置)`);
    return mockProvider;
  }

  const chain = providers.map((p) => p.name).join('→');
  console.log(`[AI] 降级链路: ${chain}`);
  return new FallbackProvider(providers);
}
