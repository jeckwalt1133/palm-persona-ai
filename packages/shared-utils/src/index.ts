// @palm/shared-utils — 前后端共享工具函数

// 简单的字符串哈希（确定性，跨平台一致）
export function simpleHash(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// 生成稳定的设备 ID（基于浏览器/小程序设备信息）
export function generateDeviceId(platform: string, screenWidth: number, screenHeight: number, pixelRatio: number): string {
  const seed = `${platform}-${screenWidth}-${screenHeight}-${pixelRatio}-${Date.now()}`;
  return `palm-${simpleHash(seed).toString(36)}`;
}

// 安全截断字符串
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

// 深色主题色板
export const COLORS = {
  deepPurple: '#1B1035',
  starGold: '#FFD166',
  rosePink: '#EF476F',
  cyan: '#06D6A0',
  glassBg: 'rgba(255, 255, 255, 0.08)',
  glassBorder: 'rgba(255, 255, 255, 0.12)',
} as const;

// 免责声明（全项目统一）
export const DISCLAIMER = '本产品为 AI 趣味分析工具，结果仅供娱乐和自我探索，不构成医学、法律、投资、婚恋或人生决策建议。';
