import { AiProvider, ChatMessage, ChatOptions } from './types.js';

export class FallbackProvider implements AiProvider {
  readonly name: string;
  private providers: AiProvider[];

  constructor(providers: AiProvider[]) {
    if (providers.length === 0) throw new Error('FallbackProvider requires at least one provider');
    this.providers = providers;
    this.name = `fallback[${providers.map((p) => p.name).join('→')}]`;
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    let lastError: Error | null = null;

    for (let i = 0; i < this.providers.length; i++) {
      const provider = this.providers[i];
      try {
        const result = await provider.chat(messages, options);
        if (i > 0) {
          console.log(`[AI] 主 Provider 失败后由 ${provider.name} 接管成功`);
        }
        return result;
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        lastError = err instanceof Error ? err : new Error(errMsg);
        console.warn(`[AI] ${provider.name} 调用失败 (${i + 1}/${this.providers.length}): ${errMsg}`);
        if (i < this.providers.length - 1) {
          console.warn(`[AI] 降级到 ${this.providers[i + 1].name}...`);
        }
      }
    }

    throw new Error(`所有 AI Provider 均调用失败 (${this.providers.length}个): ${lastError?.message}`);
  }
}
