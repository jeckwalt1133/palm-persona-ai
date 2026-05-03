// 图片特征哈希 — 提取手掌几何特征后计算哈希，不存原始图片
// 用于去重判断和报告关联

import { simpleHash } from './hash.js';

export interface ImageHashResult {
  featureHash: string;      // 综合特征哈希
  perceptualHash: string;   // 感知哈希（用于相似图检测）
  timestamp: number;
}

// 感知哈希简化实现（缩放到 8x8 灰度图 → 比较均值 → 64位二进制）
export function computePerceptualHash(pixels: Uint8ClampedArray, width: number, height: number): string {
  const size = 8;
  const grayVals: number[] = [];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const srcX = Math.floor((x / size) * width);
      const srcY = Math.floor((y / size) * height);
      const idx = (srcY * width + srcX) * 4;
      const gray = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
      grayVals.push(gray);
    }
  }

  const avg = grayVals.reduce((a, b) => a + b, 0) / grayVals.length;
  let hash = '';
  for (const val of grayVals) {
    hash += val >= avg ? '1' : '0';
  }

  // 转十六进制
  let hex = '';
  for (let i = 0; i < hash.length; i += 4) {
    hex += parseInt(hash.slice(i, i + 4), 2).toString(16);
  }
  return hex;
}

// 综合特征哈希（基于像素数据 + 时间戳）
export function computeFeatureHash(pixels: Uint8ClampedArray, width: number, height: number): ImageHashResult {
  const perceptualHash = computePerceptualHash(pixels, width, height);
  const featureHash = simpleHash(perceptualHash + String(width) + String(height)).toString(36);

  return {
    featureHash,
    perceptualHash,
    timestamp: Date.now(),
  };
}

// 从 Buffer（服务端）计算特征哈希
export function computeFeatureHashFromBuffer(buffer: Buffer): ImageHashResult {
  // 对 buffer 做采样哈希（不完整解码，轻量）
  const sampleSize = 1024;
  const step = Math.max(1, Math.floor(buffer.length / sampleSize));
  let sampled = '';
  for (let i = 0; i < buffer.length; i += step) {
    sampled += String.fromCharCode(buffer[i] ?? 0);
  }

  const perceptualHash = simpleHash(sampled).toString(16).padStart(16, '0');
  const featureHash = simpleHash(sampled).toString(36);

  return {
    featureHash,
    perceptualHash,
    timestamp: Date.now(),
  };
}
