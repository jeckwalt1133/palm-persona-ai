// Canvas 中文自动换行 — 二分查找换行点，O(n) → O(log n) 次 measureText
export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 8,
): string[] {
  const lines: string[] = [];
  let remaining = text;

  while (remaining.length > 0 && lines.length < maxLines) {
    let lo = 1;
    let hi = remaining.length;
    let bestLen = 0;

    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (ctx.measureText(remaining.slice(0, mid)).width <= maxWidth) {
        bestLen = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    if (bestLen === 0) bestLen = 1;
    lines.push(remaining.slice(0, bestLen));
    remaining = remaining.slice(bestLen);
  }

  return lines;
}

// 截断文本并加省略号 — 二分查找
export function truncateText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;

  let lo = 1;
  let hi = text.length;
  let bestLen = 0;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (ctx.measureText(text.slice(0, mid) + '...').width <= maxWidth) {
      bestLen = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return text.slice(0, bestLen) + '...';
}
