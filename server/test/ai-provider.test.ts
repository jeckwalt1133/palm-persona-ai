import { describe, it, expect } from 'vitest';
import { MockAiProvider } from '../src/ai/mock-provider.js';
import { FallbackProvider } from '../src/ai/fallback-provider.js';
import { createAiProvider } from '../src/ai/provider-factory.js';
import { AiProvider, ChatMessage, ChatOptions } from '../src/ai/types.js';
import { Config } from '../src/config/index.js';

class FailingProvider implements AiProvider {
  name: string;
  private failCount: number;
  private callCount = 0;
  constructor(name: string, failCount = 999) { this.name = name; this.failCount = failCount; }
  async chat(_msgs: ChatMessage[], _opts?: ChatOptions): Promise<string> {
    this.callCount++;
    if (this.callCount <= this.failCount) throw new Error(`${this.name} 模拟故障`);
    return `${this.name} 恢复`;
  }
}

describe('MockAiProvider', () => {
  const provider = new MockAiProvider();

  it('has name "mock"', () => {
    expect(provider.name).toBe('mock');
  });

  it('returns string from chat', async () => {
    const result = await provider.chat([
      { role: 'user', content: '分析我的手掌' },
    ]);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns deterministic response for same input', async () => {
    const msgs = [{ role: 'user' as const, content: '同样的输入' }];
    const a = await provider.chat(msgs);
    const b = await provider.chat(msgs);
    expect(a).toBe(b);
  });

  it('returns different response for different input', async () => {
    const a = await provider.chat([{ role: 'user', content: '输入 A' }]);
    const b = await provider.chat([{ role: 'user', content: '输入 B' }]);
    // 80% 概率不同（有 5 个 mock 响应，hash 碰撞概率低）
    // 实际上 hash 不同几乎肯定映射到不同响应
    expect(a).not.toBe(b);
  });

  it('uses last user message as input', async () => {
    const msgs = [
      { role: 'system', content: '你是人格分析师' },
      { role: 'user', content: '第一次消息' },
      { role: 'assistant', content: '收到' },
      { role: 'user', content: '最终消息' },
    ];
    const result = await provider.chat(msgs);
    expect(typeof result).toBe('string');
  });

  it('handles empty messages gracefully', async () => {
    const result = await provider.chat([]);
    expect(typeof result).toBe('string');
  });
});

describe('createAiProvider', () => {
  it('creates mock provider for "mock" config', () => {
    const config: Config = {
      nodeEnv: 'test',
      port: 3001,
      aiProvider: 'mock',
      maxImageSizeMb: 5,
      contentSafetyLevel: 'strict',
    };
    const provider = createAiProvider(config);
    expect(provider.name).toBe('mock');
  });

  it('falls back to mock for unimplemented providers', () => {
    const config: Config = {
      nodeEnv: 'test',
      port: 3001,
      aiProvider: 'openai', // not yet implemented
      openaiApiKey: 'sk-test',
      maxImageSizeMb: 5,
      contentSafetyLevel: 'strict',
    };
    const provider = createAiProvider(config);
    expect(provider.name).toBe('mock');
  });

  it('creates mock for unknown provider type', () => {
    const config: Config = {
      nodeEnv: 'test',
      port: 3001,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      aiProvider: 'unknown' as any,
      maxImageSizeMb: 5,
      contentSafetyLevel: 'strict',
    };
    const provider = createAiProvider(config);
    expect(provider.name).toBe('mock');
  });
});

describe('FallbackProvider', () => {
  it('returns first provider result on success', async () => {
    const mock = new MockAiProvider();
    const fb = new FallbackProvider([mock]);
    const result = await fb.chat([{ role: 'user', content: 'test' }]);
    expect(result.length).toBeGreaterThan(0);
  });

  it('falls to next provider when first fails', async () => {
    const failing = new FailingProvider('deepseek');
    const mock = new MockAiProvider();
    const fb = new FallbackProvider([failing, mock]);
    const result = await fb.chat([{ role: 'user', content: 'test' }]);
    expect(result.length).toBeGreaterThan(0);
    expect(fb.name).toContain('deepseek→mock');
  });

  it('falls through 2 failures to reach working provider', async () => {
    const f1 = new FailingProvider('deepseek');
    const f2 = new FailingProvider('doubao');
    const mock = new MockAiProvider();
    const fb = new FallbackProvider([f1, f2, mock]);
    const result = await fb.chat([{ role: 'user', content: 'test' }]);
    expect(result.length).toBeGreaterThan(0);
  });

  it('throws when all providers fail', async () => {
    const f1 = new FailingProvider('deepseek');
    const f2 = new FailingProvider('doubao');
    const fb = new FallbackProvider([f1, f2]);
    await expect(fb.chat([{ role: 'user', content: 'test' }])).rejects.toThrow('所有 AI Provider 均调用失败');
  });

  it('name reflects full chain', () => {
    const mock = new MockAiProvider();
    const fb = new FallbackProvider([mock]);
    expect(fb.name).toBe('fallback[mock]');
  });
});
