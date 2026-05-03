import { AiProvider, ChatMessage, ChatOptions } from './types.js';

const DEEPSEEK_API_BASE = 'https://api.deepseek.com/v1';

export class DeepSeekProvider implements AiProvider {
  readonly name = 'deepseek';
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = 'deepseek-chat') {
    if (!apiKey || apiKey === '') {
      throw new Error('DeepSeek API key is required');
    }
    this.apiKey = apiKey;
    this.model = model;
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    const response = await fetch(`${DEEPSEEK_API_BASE}/chat/completions`, {
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
      throw new Error(`DeepSeek API error (${response.status}): ${errorBody}`);
    }

    const json = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    const content = json.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('DeepSeek API returned empty response');
    }

    return content.trim();
  }
}
