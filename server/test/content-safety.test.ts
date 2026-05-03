import { describe, it, expect } from 'vitest';
import { ContentSafety } from '../src/safety/content-safety.js';

describe('ContentSafety', () => {
  const safety = new ContentSafety(true);

  it('passes clean text', () => {
    const result = safety.check('你是一个温柔的人，善于沟通');
    expect(result.safe).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('detects 算命 keyword', () => {
    const result = safety.check('这是算命结果');
    expect(result.safe).toBe(false);
    expect(result.violations).toContain('算命');
  });

  it('detects 占卜 keyword', () => {
    const result = safety.check('来占卜一下');
    expect(result.safe).toBe(false);
    expect(result.violations).toContain('占卜');
  });

  it('filters forbidden text in strict mode', () => {
    const result = safety.check('这是算命和占卜的结果');
    expect(result.filteredText).not.toContain('算命');
    expect(result.filteredText).not.toContain('占卜');
    expect(result.filteredText).toContain('***');
  });

  it('does not filter in non-strict mode', () => {
    const relaxed = new ContentSafety(false);
    const result = relaxed.check('这是算命结果');
    expect(result.safe).toBe(false);
    expect(result.filteredText).toContain('算命');
  });

  it('detects multiple violations', () => {
    const result = safety.check('命运注定你会暴富，100%准确');
    expect(result.violations.length).toBeGreaterThanOrEqual(2);
    expect(result.violations).toContain('100%准确');
  });

  it('wraps content with disclaimer', () => {
    const wrapped = safety.wrapWithDisclaimer('测试内容');
    expect(wrapped).toContain('测试内容');
    expect(wrapped).toContain('AI 趣味分析工具');
    expect(wrapped).toContain('———');
  });

  it('sanitizes XSS input', () => {
    const clean = safety.sanitizeUserInput('<script>alert("xss")</script>hello');
    expect(clean).not.toContain('<script>');
    expect(clean).toBe('hello');
  });

  it('returns disclaimer in result', () => {
    const result = safety.check('测试');
    expect(result.disclaimer).toContain('AI 趣味分析工具');
  });

  it('detects 掌纹 keyword', () => {
    const result = safety.check('掌纹显示你的性格');
    expect(result.safe).toBe(false);
    expect(result.violations).toContain('掌纹');
  });

  it('detects 手相 keyword', () => {
    const result = safety.check('这是你的看手相结果');
    expect(result.safe).toBe(false);
    expect(result.violations).toContain('看手相');
  });

  it('detects 天生一对 keyword', () => {
    const result = safety.check('你们是天生一对');
    expect(result.safe).toBe(false);
    expect(result.violations).toContain('天生一对');
  });

  it('detects 宿命 keyword', () => {
    const result = safety.check('这是宿命的安排');
    expect(result.safe).toBe(false);
    expect(result.violations).toContain('宿命');
  });
});
