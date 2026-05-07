import { AiProvider, ChatMessage, ChatOptions } from './types.js';

/**
 * 豆包 VL Provider — 多模态视觉分析
 *
 * 火山引擎 Ark API (OpenAI 兼容格式)
 * 模型: doubao-seed-2-0-pro-260215 (支持 vision)
 */
export class DoubaoVisionProvider implements AiProvider {
  readonly name = 'doubao-vision';
  private apiKey: string;
  private model: string;
  private apiBase: string;

  constructor(apiKey: string, model = 'doubao-seed-2-0-pro-260215') {
    if (!apiKey) throw new Error('DoubaoVisionProvider: API key is required');
    this.apiKey = apiKey;
    this.model = model;
    this.apiBase = 'https://ark.cn-beijing.volces.com/api/v3';
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
        temperature: options?.temperature ?? 0.3,
        max_tokens: options?.maxTokens ?? 512,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'unknown');
      throw new Error(`DoubaoVision API error (HTTP ${response.status}): ${errorBody}`);
    }

    const json = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error('DoubaoVision API returned empty response');
    return content.trim();
  }
}
