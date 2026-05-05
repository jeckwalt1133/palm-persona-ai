import { BaseProvider } from './base-provider.js';

export class QwenProvider extends BaseProvider {
  readonly name = 'qwen';
  readonly apiBase = 'https://dashscope.aliyuncs.com/compatible-mode/v1';

  constructor(apiKey: string, model = 'qwen3-max') {
    super(apiKey, model);
  }
}
