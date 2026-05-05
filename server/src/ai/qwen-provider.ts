import { AiProvider, ChatMessage, ChatOptions } from './types.js';

const QWEN_API_BASE = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

export class QwenProvider implements AiProvider {
  readonly name = 'qwen';
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model = 'qwen3-max') {
    if (!apiKey) throw new Error('Qwen API key is required');
    this.apiKey = apiKey;
    this.model = model;
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    const response = await fetch(QWEN_API_BASE, {
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
      throw new Error(`Qwen API error (${response.status}): ${errorBody}`);
    }

    const json = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error('Qwen API returned empty response');
    return content.trim();
  }
}
