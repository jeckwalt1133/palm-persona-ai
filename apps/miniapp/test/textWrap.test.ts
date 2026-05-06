import { describe, it, expect } from 'vitest';
import { wrapText, truncateText } from '../src/utils/textWrap';

// 模拟 Canvas 2D measureText: 中文字符宽=fontSize, 英文/数字宽=fontSize*0.55
function mockCtx(charWidth: number): CanvasRenderingContext2D {
  const ctx = {
    font: '',
    measureText: (text: string) => ({
      width: [...text].reduce((sum, ch) => {
        // CJK 字符近似全宽
        if (/[一-鿿　-〿＀-￯]/.test(ch)) return sum + charWidth;
        // 英文/数字/标点半宽
        return sum + charWidth * 0.55;
      }, 0),
    }),
  } as unknown as CanvasRenderingContext2D;
  return ctx;
}

describe('wrapText 二分查找换行', () => {
  it('空字符串返回空数组', () => {
    const ctx = mockCtx(26);
    expect(wrapText(ctx, '', 500)).toEqual([]);
  });

  it('单行文本不换行', () => {
    const ctx = mockCtx(26);
    // "你好世界" 4字 × 26 = 104px < 500px
    const result = wrapText(ctx, '你好世界', 500);
    expect(result).toEqual(['你好世界']);
  });

  it('超长文本正确换行', () => {
    const ctx = mockCtx(26);
    // 每字26px, 20字 = 520px > 300px → 应该换行
    const text = '一二三四五六七八九十一二三四五六七八九十';
    // 300/26 ≈ 11.5, 所以每行约11字
    const result = wrapText(ctx, text, 300);
    expect(result.length).toBe(2);
    // 第一行11字, 第二行9字
    expect(result[0].length).toBeGreaterThanOrEqual(10);
    expect(result[1].length).toBeGreaterThanOrEqual(8);
  });

  it('maxLines 限制行数', () => {
    const ctx = mockCtx(26);
    const text = '一二三四五六七八九十一二三四五六七八九十一二三四五六七八九十';
    // maxLines=2, 每行约300/26≈11字
    const result = wrapText(ctx, text, 300, 2);
    expect(result.length).toBe(2);
    // 第三行被截断
    expect(result.join('').length).toBeLessThan(text.length);
  });

  it('单字符超宽不丢字符', () => {
    const ctx = mockCtx(50);
    // 单个字符50px > maxWidth 30px → 仍应保留单字符
    const result = wrapText(ctx, '大', 30);
    expect(result.length).toBe(1);
    expect(result[0]).toBe('大');
  });

  it('混合中英文正确换行', () => {
    const ctx = mockCtx(24);
    // "Hello世界Test" — 英文半宽, 中文全宽
    // H(13.2) e(13.2) l(13.2) l(13.2) o(13.2) 世(24) 界(24) T(13.2) e(13.2) s(13.2) t(13.2)
    // 总共: 5*13.2 + 2*24 + 4*13.2 = 66+48+52.8 = 166.8
    const result = wrapText(ctx, 'Hello世界Test', 100);
    // 100/24 ≈ 4个中文字符宽 → "Hello"=66 < 100, "Hello世"=90 < 100, "Hello世界"=114 > 100
    // 所以第一行 "Hello世", 第二行 "界Test"
    expect(result.length).toBe(2);
    expect(result[0]).toContain('Hello');
    expect(result[1]).toContain('Test');
  });

  it('英文长单词不被拆分 (已知限制)', () => {
    const ctx = mockCtx(24);
    // 二分查找不会拆分单词, 但会在字符级拆分
    // "ABCDEFGHIJ" 10个字符 × 13.2px = 132px > 100px
    const result = wrapText(ctx, 'ABCDEFGHIJ', 100);
    // 应该在某个字符处拆分
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.every((line) => line.length > 0)).toBe(true);
  });

  it('极端窄宽度不陷入死循环', () => {
    const ctx = mockCtx(26);
    // 每个字符26px, maxWidth只有10px, 每个字符都超宽
    const result = wrapText(ctx, '测试文本', 10, 3);
    expect(result.length).toBeLessThanOrEqual(3);
    expect(result.every((line) => line.length > 0)).toBe(true);
  });
});

describe('truncateText 二分查找截断', () => {
  it('短文本不需要截断', () => {
    const ctx = mockCtx(26);
    expect(truncateText(ctx, '你好', 100)).toBe('你好');
  });

  it('超长文本截断加省略号', () => {
    const ctx = mockCtx(26);
    // 20字×26=520px > 300px
    const result = truncateText(ctx, '一二三四五六七八九十一二三四五六七八九十', 300);
    expect(result.endsWith('...')).toBe(true);
    expect(result.length).toBeLessThan(20);
  });

  it('单字符+省略号=刚好不溢出', () => {
    const ctx = mockCtx(26);
    const result = truncateText(ctx, '测测测测测测测测测测', 100);
    // 省略号3个字符 + 文本
    expect(result.endsWith('...')).toBe(true);
    // 验证结果不超 maxWidth
    const measured = ctx.measureText(result).width;
    expect(measured).toBeLessThanOrEqual(100);
  });

  it('极端情况: 单字符也放不下', () => {
    const ctx = mockCtx(50);
    const result = truncateText(ctx, '大', 10);
    // 单字符50px > 10px, 连一个字符也放不下
    expect(result).toBe('...');
  });
});
