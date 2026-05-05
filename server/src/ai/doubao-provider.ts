import { AiProvider, ChatMessage, ChatOptions } from './types.js';

const DOUBAO_API_BASE = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';

export class DoubaoProvider implements AiProvider {
  readonly name = 'doubao';
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = 'doubao-seed-2-0-pro-260215') {
    if (!apiKey) throw new Error('Doubao API key is required');
    this.apiKey = apiKey;
    this.model = model;
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    const response = await fetch(DOUBAO_API_BASE, {
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
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'unknown error');
      throw new Error(`Doubao API error (${response.status}): ${errorBody}`);
    }

    const json = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error('Doubao API returned empty response');
    return content.trim();
  }
}
