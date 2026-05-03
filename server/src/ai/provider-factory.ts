import { AiProvider } from './types.js';
import { MockAiProvider } from './mock-provider.js';
import { Config } from '../config/index.js';

export function createAiProvider(config: Config): AiProvider {
  switch (config.aiProvider) {
    case 'mock':
      return new MockAiProvider();
    case 'openai':
    case 'claude':
    case 'dashscope':
    case 'doubao':
    case 'hunyuan':
      // 真实 Provider 在后续 Phase 实现，当前 fallback 到 mock
      console.warn(`Provider ${config.aiProvider} 尚未实现，回退到 mock 模式`);
      return new MockAiProvider();
    default:
      return new MockAiProvider();
  }
}
