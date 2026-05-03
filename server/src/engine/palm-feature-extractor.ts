import { PalmFeatures } from './types.js';

export interface PalmFeatureExtractor {
  extract(imageData: Buffer | string): PalmFeatures;
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
  extract(imageData: Buffer | string): PalmFeatures {
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
