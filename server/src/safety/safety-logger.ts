/**
 * L3 安全日志 — 违规检测结果持久化 + 趋势聚合
 *
 * 复用 ReflexionLogger 的 JSONL 追加模式。
 * 日志路径：memory/safety/safety-log.jsonl
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../..');

const DEFAULT_LOG_PATH = path.join(PROJECT_ROOT, 'memory/safety/safety-log.jsonl');

export interface SafetyLogEntry {
  timestamp: number;
  reportId: string;
  personaType: string;
  passed: boolean;
  totalViolations: number;
  violationFields: string[];
  violationTerms: string[];
}

export interface TrendBucket {
  start: number;
  end: number;
  total: number;
  passed: number;
  failed: number;
  violationTerms: Record<string, number>;
}

export class SafetyLogger {
  private entries: SafetyLogEntry[] = [];
  private logPath: string;

  constructor(logPath?: string) {
    this.logPath = logPath ?? DEFAULT_LOG_PATH;
    this.load();
  }

  log(entry: Omit<SafetyLogEntry, 'timestamp'>): void {
    const record: SafetyLogEntry = { timestamp: Date.now(), ...entry };
    this.entries.push(record);
    this.appendToFile(record);
  }

  getEntries(): SafetyLogEntry[] {
    return this.entries;
  }

  getStats(): { totalChecks: number; passed: number; failed: number; passRate: number; totalViolations: number } {
    if (this.entries.length === 0) {
      return { totalChecks: 0, passed: 0, failed: 0, passRate: 0, totalViolations: 0 };
    }
    const passed = this.entries.filter(e => e.passed).length;
    return {
      totalChecks: this.entries.length,
      passed,
      failed: this.entries.length - passed,
      passRate: Math.round((passed / this.entries.length) * 10000) / 10000,
      totalViolations: this.entries.reduce((s, e) => s + e.totalViolations, 0),
    };
  }

  getTrends(windowMs: number, numBuckets: number): TrendBucket[] {
    const now = Date.now();
    const start = now - windowMs * numBuckets;
    const buckets: TrendBucket[] = [];

    for (let i = 0; i < numBuckets; i++) {
      buckets.push({
        start: start + i * windowMs,
        end: start + (i + 1) * windowMs,
        total: 0,
        passed: 0,
        failed: 0,
        violationTerms: {},
      });
    }

    for (const entry of this.entries) {
      if (entry.timestamp < start) continue;
      const idx = Math.floor((entry.timestamp - start) / windowMs);
      if (idx < 0 || idx >= numBuckets) continue;
      const bucket = buckets[idx];
      bucket.total++;
      if (entry.passed) bucket.passed++;
      else bucket.failed++;
      for (const term of entry.violationTerms) {
        bucket.violationTerms[term] = (bucket.violationTerms[term] || 0) + 1;
      }
    }

    return buckets;
  }

  private appendToFile(entry: SafetyLogEntry): void {
    try {
      const dir = path.dirname(this.logPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.appendFileSync(this.logPath, JSON.stringify(entry) + '\n');
    } catch (err) {
      console.warn('[SafetyLogger] 文件写入失败:', (err as Error).message);
    }
  }

  private load(): void {
    try {
      if (fs.existsSync(this.logPath)) {
        const lines = fs.readFileSync(this.logPath, 'utf-8').trim().split('\n');
        for (const line of lines) {
          if (line.trim()) this.entries.push(JSON.parse(line));
        }
      }
    } catch (err) {
      console.warn('[SafetyLogger] 文件加载失败，使用空日志:', (err as Error).message);
    }
  }
}

export const defaultSafetyLogger = new SafetyLogger();
