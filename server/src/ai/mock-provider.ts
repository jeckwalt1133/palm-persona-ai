import { AiProvider, ChatMessage, ChatContentPart, ChatOptions } from './types.js';
import { simpleHash } from '../utils/hash.js';

const MOCK_RESPONSES = [
  '根据手掌的特征分析，你的情感频率偏高，沟通风格偏向主动。在人际关系中，你倾向于先付出信任。',
  '从手掌特征来看，你具备深刻的洞察力。做事之前会思考多个角度，不急于表达但心中有数。',
  '分析显示，你的行动力较强，善于在复杂环境中找到自己的节奏。偶尔的犹豫其实是深思的表现。',
  '你的手掌特征指向了一种平衡型人格——既能独处充电，也能在人群中发光。适应性是你的核心优势。',
  '手掌特征显示你是一个内心柔软但外表坚定的人。你重视承诺，对自己在乎的人会全力以赴。',
];

function contentToString(content: string | ChatContentPart[]): string {
  if (typeof content === 'string') return content;
  return content.filter((c): c is { type: 'text'; text: string } => c.type === 'text').map(c => c.text).join(' ');
}

export class MockAiProvider implements AiProvider {
  readonly name = 'mock';

  async chat(messages: ChatMessage[], _options?: ChatOptions): Promise<string> {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    const input = lastUserMsg?.content ? contentToString(lastUserMsg.content) : JSON.stringify(messages);
    const hash = simpleHash(input);
    return MOCK_RESPONSES[hash % MOCK_RESPONSES.length];
  }
}
