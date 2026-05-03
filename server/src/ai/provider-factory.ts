import { AiProvider } from './types.js';
import { MockAiProvider } from './mock-provider.js';
import { DeepSeekProvider } from './deepseek-provider.js';
import { Config } from '../config/index.js';

export function createAiProvider(config: Config): AiProvider {
  switch (config.aiProvider) {
    case 'mock':
      return new MockAiProvider();
    case 'deepseek': {
      const apiKey = config.deepseekApiKey;
      if (!apiKey) {
        console.warn('DEEPSEEK_API_KEY 未配置，回退到 mock 模式');
        return new MockAiProvider();
      }
      const model = config.aiModel ?? 'deepseek-chat';
      console.log(`初始化 DeepSeek AI Provider (model: ${model})`);
      return new DeepSeekProvider(apiKey, model);
    }
    case 'openai':
    case 'claude':
    case 'dashscope':
    case 'doubao':
    case 'hunyuan':
      console.warn(`Provider ${config.aiProvider} 尚未实现，回退到 mock 模式`);
      return new MockAiProvider();
    default:
      return new MockAiProvider();
  }
}
