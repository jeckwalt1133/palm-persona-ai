import { PalmFeatures } from './types.js';
import { PalmFeatureExtractor, RealPalmFeatureExtractor } from './palm-feature-extractor.js';
import { AiProvider } from '../ai/index.js';

function simpleHash(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

function parseVisionResponse(text: string): PalmFeatures {
  const hash = `palm_vision_${simpleHash(text).toString(16).padStart(8, '0')}`;

  // 从 AI 返回文本中提取数值特征
  const widthMatch = text.match(/宽[度厚]?[：:]\s*(\d+)/);
  const palmWidth = widthMatch ? Number(widthMatch[1]) : 60;

  const fingerMatch = text.match(/手指[长比][度例]?[：:]\s*(\d+\.?\d*)/);
  const fingerLengthRatio = fingerMatch ? Number(fingerMatch[1]) : 0.85;

  const clarityMatch = text.match(/纹路[清晰]?[度晰]?[：:]\s*(\d+)/);
  const lineClarity = clarityMatch ? Number(clarityMatch[1]) : 45;

  const countMatch = text.match(/线条[数数量]?[：:]\s*(\d+)/);
  const lineCount = countMatch ? Number(countMatch[1]) : 4;

  // 从文本中推断掌丘突出度（基于 AI 描述的语义分析）
  const mountKeywords = ['金星丘', '木星丘', '土星丘', '太阳丘', '水星丘'];
  const mountProminence = mountKeywords.map((name) => {
    const idx = text.indexOf(name);
    const context = idx > 0 ? text.slice(Math.max(0, idx - 20), idx + 30) : '';
    if (/突出|饱满|发达|隆起|明显/.test(context)) return 60 + (simpleHash(name) % 35);
    if (/平坦|不显|微弱/.test(context)) return 15 + (simpleHash(name) % 20);
    return 35 + (simpleHash(name) % 30);
  });

  return {
    hash,
    palmWidth,
    fingerLengthRatio: Math.min(1.1, Math.max(0.55, fingerLengthRatio)),
    lineClarity: Math.max(5, Math.min(95, lineClarity)),
    lineCount: Math.max(1, Math.min(8, lineCount)),
    mountProminence,
  };
}

/**
 * AI 视觉特征提取器 — 使用豆包 VL 真实分析手掌图片
 *
 * 降级链: 豆包 VL → Sobel CV (real) → simpleHash (mock)
 */
export class VisionPalmFeatureExtractor implements PalmFeatureExtractor {
  private visionAi: AiProvider;
  private cvFallback: RealPalmFeatureExtractor;

  constructor(visionAi: AiProvider) {
    this.visionAi = visionAi;
    this.cvFallback = new RealPalmFeatureExtractor();
  }

  async extract(imageData: Buffer | string): Promise<PalmFeatures> {
    const base64 = typeof imageData === 'string' ? imageData : imageData.toString('base64');
    const imageUrl = `data:image/jpeg;base64,${base64}`;

    try {
      const raw = await this.visionAi.chat([
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: '你是一只手掌的分析引擎。请用以下格式输出（仅输出数据，不要其他文字）：\n手掌宽度: [0-100的数字]\n手指长度比例: [0.5-1.1的数字，>1.0表示手指偏长]\n纹路清晰度: [0-100的数字]\n线条数量: [1-8的数字]\n掌丘突出: [金星丘/木星丘/土星丘/太阳丘/水星丘分别描述突出或平坦]',
            },
            { type: 'image_url', image_url: { url: imageUrl, detail: 'low' } },
          ],
        },
      ], { temperature: 0.2, maxTokens: 300, timeoutMs: 15000 });

      return parseVisionResponse(raw);
    } catch (err) {
      console.warn('[VisionPalmFeatureExtractor] 豆包VL调用失败，降级为Sobel CV:', (err as Error).message);
      try {
        return await this.cvFallback.extract(imageData);
      } catch (cvErr) {
        console.warn('[VisionPalmFeatureExtractor] Sobel CV也失败，降级为Mock');
        const { MockPalmFeatureExtractor } = await import('./palm-feature-extractor.js');
        return new MockPalmFeatureExtractor().extract(imageData);
      }
    }
  }
}
