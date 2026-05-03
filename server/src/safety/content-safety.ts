import { sanitizeInput } from '../utils/sanitize.js';

const DISCLAIMER = '本产品为 AI 趣味分析工具，结果仅供娱乐和自我探索，不构成医学、法律、投资、婚恋或人生决策建议。';

const FORBIDDEN_TERMS: Array<{ pattern: RegExp; label: string }> = [
  // 旧版禁用词
  { pattern: /算命/g, label: '算命' },
  { pattern: /占卜/g, label: '占卜' },
  { pattern: /命运注[定決]/g, label: '命运注定' },
  { pattern: /改运/g, label: '改运' },
  { pattern: /开运/g, label: '开运' },
  { pattern: /正缘/g, label: '正缘' },
  { pattern: /姻缘测算/g, label: '姻缘测算' },
  { pattern: /旺[夫妻]/g, label: '旺夫/旺妻' },
  { pattern: /克[夫妻]/g, label: '克夫/克妻' },
  { pattern: /寿命预测/g, label: '寿命预测' },
  { pattern: /疾病预测/g, label: '疾病预测' },
  { pattern: /灾祸预测/g, label: '灾祸预测' },
  { pattern: /财富暴富预测/g, label: '财富暴富预测' },
  { pattern: /100%准确/g, label: '100%准确' },
  { pattern: /比算命[更还]/g, label: '比算命更准' },
  { pattern: /必然/g, label: '必然' },
  { pattern: /一定会/g, label: '一定会' },
  { pattern: /暴富/g, label: '暴富' },
  { pattern: /改[编変]命/g, label: '改命' },
  { pattern: /天注定/g, label: '天注定' },
  // v3 新增禁用词（product.md 2026-05）
  { pattern: /掌纹/g, label: '掌纹' },
  { pattern: /手相/g, label: '手相' },
  { pattern: /看手相/g, label: '看手相' },
  { pattern: /天生一对/g, label: '天生一对' },
  { pattern: /宿命/g, label: '宿命' },
];

export interface SafetyResult {
  safe: boolean;
  violations: string[];
  filteredText: string;
  disclaimer: string;
}

export class ContentSafety {
  private strictMode: boolean;

  constructor(strictMode = true) {
    this.strictMode = strictMode;
  }

  check(text: string): SafetyResult {
    const violations: string[] = [];
    let filteredText = text;

    for (const term of FORBIDDEN_TERMS) {
      if (term.pattern.test(text)) {
        violations.push(term.label);
        term.pattern.lastIndex = 0;
        if (this.strictMode) {
          filteredText = filteredText.replace(term.pattern, '***');
        }
      }
    }

    return {
      safe: violations.length === 0,
      violations,
      filteredText,
      disclaimer: DISCLAIMER,
    };
  }

  sanitizeUserInput(input: string): string {
    return sanitizeInput(input);
  }

  wrapWithDisclaimer(content: string): string {
    return `${content}\n\n———\n${DISCLAIMER}`;
  }
}

export const defaultSafety = new ContentSafety(true);
