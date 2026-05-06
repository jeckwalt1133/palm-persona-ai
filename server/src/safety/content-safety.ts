import { sanitizeInput } from '../utils/sanitize.js';
import { EscapeRoom, defaultEscapeRoom } from './escape-room.js';

const DISCLAIMER = '本产品为 AI 趣味分析工具，结果仅供娱乐和自我探索，不构成医学、法律、投资、婚恋或人生决策建议。';

// —— 预处理层：对抗攻击检测 (V6.1 T004) ——

const ZERO_WIDTH_RE = /[​‌‍﻿­‎‏]/g;

function fullToHalf(c: string): string {
  const code = c.charCodeAt(0);
  if (code === 0x3000) return ' ';
  if (code >= 0xFF01 && code <= 0xFF5E) return String.fromCharCode(code - 0xFEE0);
  return c;
}

// 同音字→禁用词映射 (V6.1 T004-B: 对抗实验发现的漏检向量)
const HOMOPHONE_TO_TERM: Record<string, { term: string; label: string }> = {
  '算名': { term: '算命', label: '同音字-算命→算名' },
  '站补': { term: '占卜', label: '同音字-占卜→站补' },
  '手像': { term: '手相', label: '同音字-手相→手像' },
  '证圆': { term: '正缘', label: '同音字-正缘→证圆' },
  '抱富': { term: '暴富', label: '同音字-暴富→抱富' },
  '撑文': { term: '掌纹', label: '同音字-掌纹→撑文' },
  '看手像': { term: '看手相', label: '同音字-看手相→看手像' },
  '宿名': { term: '宿命', label: '同音字-宿命→宿名' },
  '盖命': { term: '改命', label: '同音字-改命→盖命' },
  '概运': { term: '改运', label: '同音字-改运→概运' },
};

const PINYIN_TO_TERM: Record<string, { term: string; label: string }> = {
  'suanming': { term: '算命', label: '拼音-算命' },
  'suan ming': { term: '算命', label: '拼音-算命' },
  'zhanbu': { term: '占卜', label: '拼音-占卜' },
  'zhan bu': { term: '占卜', label: '拼音-占卜' },
  'shouxiang': { term: '手相', label: '拼音-手相' },
  'shou xiang': { term: '手相', label: '拼音-手相' },
  'zhengyuan': { term: '正缘', label: '拼音-正缘' },
  'zheng yuan': { term: '正缘', label: '拼音-正缘' },
  'baofu': { term: '暴富', label: '拼音-暴富' },
  'bao fu': { term: '暴富', label: '拼音-暴富' },
  'zhangwen': { term: '掌纹', label: '拼音-掌纹' },
  'zhang wen': { term: '掌纹', label: '拼音-掌纹' },
  'kanshouxiang': { term: '看手相', label: '拼音-看手相' },
  'kan shouxiang': { term: '看手相', label: '拼音-看手相' },
  'kan shou xiang': { term: '看手相', label: '拼音-看手相' },
  'tianshengyidui': { term: '天生一对', label: '拼音-天生一对' },
  'tiansheng yidui': { term: '天生一对', label: '拼音-天生一对' },
  'tian sheng yi dui': { term: '天生一对', label: '拼音-天生一对' },
  'suming': { term: '宿命', label: '拼音-宿命' },
  'su ming': { term: '宿命', label: '拼音-宿命' },
  'gaiming': { term: '改命', label: '拼音-改命' },
  'gai ming': { term: '改命', label: '拼音-改命' },
  'kaiyun': { term: '开运', label: '拼音-开运' },
  'kai yun': { term: '开运', label: '拼音-开运' },
  'wangfu': { term: '旺夫', label: '拼音-旺夫' },
  'wang fu': { term: '旺夫', label: '拼音-旺夫' },
  'wangqi': { term: '旺妻', label: '拼音-旺妻' },
  'wang qi': { term: '旺妻', label: '拼音-旺妻' },
  'kefu': { term: '克夫', label: '拼音-克夫' },
  'ke fu': { term: '克夫', label: '拼音-克夫' },
  'keqi': { term: '克妻', label: '拼音-克妻' },
  'ke qi': { term: '克妻', label: '拼音-克妻' },
  'gaiyun': { term: '改运', label: '拼音-改运' },
  'gai yun': { term: '改运', label: '拼音-改运' },
  'yinyuan': { term: '姻缘测算', label: '拼音-姻缘测算' },
  'yin yuan': { term: '姻缘测算', label: '拼音-姻缘测算' },
  'shouming': { term: '寿命预测', label: '拼音-寿命预测' },
  'shou ming': { term: '寿命预测', label: '拼音-寿命预测' },
  'jibing': { term: '疾病预测', label: '拼音-疾病预测' },
  'ji bing': { term: '疾病预测', label: '拼音-疾病预测' },
  'zaihuo': { term: '灾祸预测', label: '拼音-灾祸预测' },
  'zai huo': { term: '灾祸预测', label: '拼音-灾祸预测' },
};

function preprocess(text: string): { cleaned: string; violations: string[] } {
  const violations: string[] = [];

  // 1. 移除零宽字符
  let cleaned = text.replace(ZERO_WIDTH_RE, '');
  if (cleaned !== text) {
    violations.push('检测到零宽字符攻击');
  }

  // 2. 全角→半角归一化（仅 ASCII 字母范围的全角形式标记为可疑）
  let normalized = '';
  let suspiciousFullWidth = false;
  for (const ch of cleaned) {
    const half = fullToHalf(ch);
    if (half !== ch) {
      normalized += half;
      // 全角字母 a-z A-Z (U+FF41-U+FF5A, U+FF21-U+FF3A) 是攻击信号
      const code = ch.charCodeAt(0);
      if ((code >= 0xFF41 && code <= 0xFF5A) || (code >= 0xFF21 && code <= 0xFF3A)) {
        suspiciousFullWidth = true;
      }
    } else {
      normalized += ch;
    }
  }
  if (suspiciousFullWidth) {
    violations.push('检测到全角字母混淆');
  }
  cleaned = normalized;

  // 3. 拼音检测：提取连续小写字母序列，匹配拼音表
  const lowerOnly = cleaned.toLowerCase().replace(/[^a-z\s]/g, ' ');
  const words = lowerOnly.split(/\s+/).filter(Boolean);

  // 尝试匹配连续2-4个拼音词
  for (let len = 4; len >= 1; len--) {
    for (let i = 0; i <= words.length - len; i++) {
      const phrase = words.slice(i, i + len).join(' ');
      if (PINYIN_TO_TERM[phrase]) {
        const { term, label } = PINYIN_TO_TERM[phrase];
        if (!violations.includes(label)) {
          violations.push(label);
          cleaned = cleaned.replace(
            new RegExp(words.slice(i, i + len).join('\\s+'), 'gi'),
            term,
          );
        }
      }
    }
  }

  // 4. 同音字检测 (V6.1 T004-B)
  for (const [homophone, { term, label }] of Object.entries(HOMOPHONE_TO_TERM)) {
    if (cleaned.includes(homophone)) {
      if (!violations.includes(label)) {
        violations.push(label);
      }
      cleaned = cleaned.replace(new RegExp(homophone, 'g'), term);
    }
  }

  // 5. 符号/分隔符剥离后匹配 (V6.1 T004-B)
  // 先剥离特殊分隔符
  const stripped = cleaned.replace(/[*.\-_\n🎲🔮✨🌟💫⭐]/g, '');
  if (stripped !== cleaned) {
    cleaned = stripped;
  }
  // 再剥离CJK字符间的空白：正常中文不含字间空格，"算 命"是攻击信号
  const despaced = cleaned.replace(/([一-鿿])\s+([一-鿿])/g, '$1$2');
  if (despaced !== cleaned) {
    cleaned = despaced;
  }

  return { cleaned, violations };
}

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
  private escapeRoom: EscapeRoom;

  constructor(strictMode = true, escapeRoom?: EscapeRoom) {
    this.strictMode = strictMode;
    this.escapeRoom = escapeRoom ?? defaultEscapeRoom;
  }

  check(text: string): SafetyResult {
    const violations: string[] = [];
    let filteredText = text;

    // 预处理：零宽字符移除 + 全角半角归一化 + 拼音检测
    const pre = preprocess(text);
    for (const v of pre.violations) {
      if (!violations.includes(v)) violations.push(v);
    }
    const cleaned = pre.cleaned;

    for (const term of FORBIDDEN_TERMS) {
      if (term.pattern.test(cleaned)) {
        if (this.escapeRoom.check(term.label)) continue;
        if (!violations.includes(term.label)) {
          violations.push(term.label);
        }
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
