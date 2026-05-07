import { PalmFeatures } from './types.js';

export interface PalmFeatureExtractor {
  extract(imageData: Buffer | string): Promise<PalmFeatures>;
}

function simpleHash(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

function seedFromHash(hash: number, index: number): number {
  return ((hash * (index + 1) * 2654435761) >>> 0) % 100;
}

export class MockPalmFeatureExtractor implements PalmFeatureExtractor {
  async extract(imageData: Buffer | string): Promise<PalmFeatures> {
    const input = typeof imageData === 'string' ? imageData : imageData.toString('base64');
    const hash = simpleHash(input);
    const hashStr = `palm_${hash.toString(16).padStart(8, '0')}`;

    return {
      hash: hashStr,
      palmWidth: 60 + seedFromHash(hash, 0),
      fingerLengthRatio: 0.7 + (seedFromHash(hash, 1) / 200),
      lineClarity: 30 + seedFromHash(hash, 2),
      lineCount: 3 + (seedFromHash(hash, 3) % 5),
      mountProminence: [
        seedFromHash(hash, 4),
        seedFromHash(hash, 5),
        seedFromHash(hash, 6),
        seedFromHash(hash, 7),
        seedFromHash(hash, 8),
      ],
    };
  }
}

function sobelEdgeIntensity(gray: number[][], x: number, y: number, w: number, h: number): number {
  if (x <= 0 || y <= 0 || x >= w - 1 || y >= h - 1) return 0;
  const gx = -gray[y-1][x-1] - 2*gray[y][x-1] - gray[y+1][x-1]
             + gray[y-1][x+1] + 2*gray[y][x+1] + gray[y+1][x+1];
  const gy = -gray[y-1][x-1] - 2*gray[y-1][x] - gray[y-1][x+1]
             + gray[y+1][x-1] + 2*gray[y+1][x] + gray[y+1][x+1];
  return Math.sqrt(gx * gx + gy * gy) / 4;
}

function extractLineMetrics(rawPixels: Buffer, width: number, height: number): { lineCount: number; lineClarity: number } {
  const gray: number[][] = [];
  for (let y = 0; y < height; y++) {
    gray[y] = [];
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      gray[y][x] = Math.round(rawPixels[idx] * 0.299 + rawPixels[idx + 1] * 0.587 + rawPixels[idx + 2] * 0.114);
    }
  }

  const edges: number[] = [];
  const stepX = Math.max(2, Math.floor(width / 100));
  const stepY = Math.max(2, Math.floor(height / 100));
  for (let y = stepY; y < height - stepY; y += stepY) {
    for (let x = stepX; x < width - stepX; x += stepX) {
      const intensity = sobelEdgeIntensity(gray, x, y, width, height);
      edges.push(intensity);
    }
  }

  edges.sort((a, b) => b - a);
  const threshold = edges[Math.floor(edges.length * 0.15)];
  const strongEdges = edges.filter(e => e > threshold && e > 20);
  const avgIntensity = strongEdges.length > 0
    ? strongEdges.reduce((s, v) => s + v, 0) / strongEdges.length
    : 0;
  const lineCount = strongEdges.length > 0
    ? Math.max(2, Math.min(8, Math.round(strongEdges.length / 10)))
    : 3;
  const lineClarity = Math.max(10, Math.min(95, Math.round(avgIntensity * 1.5)));

  return { lineCount, lineClarity };
}

// sharp 安装在 Linux 原生文件系统以避开 WSL2+Windows 驱动器的 chmod 限制
const SHARP_PATH = '/home/fugui/palm-sharp/node_modules/sharp';

async function loadSharp(): Promise<any> {
  try { return (await import('sharp')).default; }
  catch { /* sharp 不在项目 node_modules 中，尝试备用路径 */ }
  try { return (await import(SHARP_PATH)).default; }
  catch { throw new Error('sharp 未安装。请运行: cd /home/fugui/palm-sharp && npm install sharp'); }
}

export class RealPalmFeatureExtractor implements PalmFeatureExtractor {
  async extract(imageData: Buffer | string): Promise<PalmFeatures> {
    const sharp = await loadSharp();
    const buffer = typeof imageData === 'string'
      ? Buffer.from(imageData, 'base64')
      : imageData;

    const image = sharp(buffer);
    const metadata = await image.metadata();
    const imgWidth = metadata.width || 800;
    const imgHeight = metadata.height || 600;

    const resized = await image
      .resize(200, 260, { fit: 'inside', withoutEnlargement: true })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { lineCount, lineClarity } = extractLineMetrics(
      resized.data,
      resized.info.width,
      resized.info.height
    );

    const aspectRatio = imgWidth / imgHeight;
    const normalizedWidth = Math.round(40 + aspectRatio * 40);
    const fingerRatio = Math.min(0.95, Math.max(0.6, aspectRatio * 0.7));

    const prominenceBase = (lineClarity / 20) * (lineCount / 5);
    const mountProminence = Array.from({ length: 5 }, (_, i) =>
      Math.round(Math.min(95, Math.max(5, prominenceBase * 12 + (Math.sin(i * 1.3) * 10))))
    );

    const hashInput = `${imgWidth}x${imgHeight}:${lineCount}:${lineClarity}`;
    const hash = `palm_${simpleHash(hashInput).toString(16).padStart(8, '0')}`;

    return {
      hash,
      palmWidth: normalizedWidth,
      fingerLengthRatio: fingerRatio,
      lineClarity,
      lineCount,
      mountProminence,
    };
  }
}
