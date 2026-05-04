// Canvas 中文自动换行 — 逐字测量宽度
export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 8,
): string[] {
  const lines: string[] = [];
  let current = '';

  for (const char of text) {
    const test = current + char;
    if (ctx.measureText(test).width > maxWidth && current.length > 0) {
      lines.push(current);
      if (lines.length >= maxLines) return lines;
      current = char;
    } else {
      current = test;
    }
  }

  if (current) lines.push(current);
  return lines;
}

// 截断文本并加省略号
export function truncateText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;

  let result = '';
  for (const char of text) {
    if (ctx.measureText(result + char + '...').width > maxWidth) {
      return result + '...';
    }
    result += char;
  }
  return result + '...';
}
