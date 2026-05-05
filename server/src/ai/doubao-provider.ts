import { BaseProvider } from './base-provider.js';

export class DoubaoProvider extends BaseProvider {
  readonly name = 'doubao';
  readonly apiBase = 'https://ark.cn-beijing.volces.com/api/v3';

  constructor(apiKey: string, model = 'doubao-seed-2-0-pro-260215') {
    super(apiKey, model);
  }
}
