import { BaseProvider } from './base-provider.js';

export class DeepSeekProvider extends BaseProvider {
  readonly name = 'deepseek';
  readonly apiBase = 'https://api.deepseek.com/v1';

  constructor(apiKey: string, model = 'deepseek-chat') {
    super(apiKey, model);
  }
}
