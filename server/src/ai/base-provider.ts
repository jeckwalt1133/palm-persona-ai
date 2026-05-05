import { AiProvider, ChatMessage, ChatOptions } from './types.js';

export abstract class BaseProvider implements AiProvider {
  abstract readonly name: string;
  abstract readonly apiBase: string;
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model: string) {
    if (!apiKey || apiKey === '') {
      throw new Error(`${this.constructor.name}: API key is required`);
    }
    this.apiKey = apiKey;
    this.model = model;
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    const timeoutMs = options?.timeoutMs ?? 30000;
    const response = await fetch(`${this.apiBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 1024,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'unknown error');
      throw new Error(`${this.name} API error (${response.status}): ${errorBody}`);
    }

    const json = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = json.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error(`${this.name} API returned empty response`);
    }

    return content.trim();
  }
}
