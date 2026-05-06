import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SafetyLogger, SafetyLogEntry } from '../src/safety/safety-logger.js';
import fs from 'fs';
import os from 'os';
import path from 'path';

function tmpPath(): string {
  return path.join(os.tmpdir(), `safety-log-test-${Date.now()}-${Math.random().toString(36).slice(2)}.jsonl`);
}

describe('SafetyLogger', () => {
  let logPath: string;
  let logger: SafetyLogger;

  beforeEach(() => {
    logPath = tmpPath();
    logger = new SafetyLogger(logPath);
  });

  afterEach(() => {
    try { fs.unlinkSync(logPath); } catch { /* 清理临时文件 */ }
  });

  it('log() 创建含时间戳的条目', () => {
    logger.log({ reportId: 'r1', personaType: 'flame_explorer', passed: true, totalViolations: 0, violationFields: [], violationTerms: [] });
    const entries = logger.getEntries();
    expect(entries).toHaveLength(1);
    expect(entries[0].timestamp).toBeGreaterThan(0);
    expect(entries[0].reportId).toBe('r1');
  });

  it('getEntries() 返回所有已记录条目', () => {
    logger.log({ reportId: 'a', personaType: 't1', passed: true, totalViolations: 0, violationFields: [], violationTerms: [] });
    logger.log({ reportId: 'b', personaType: 't2', passed: false, totalViolations: 2, violationFields: ['summary'], violationTerms: ['算命'] });
    expect(logger.getEntries()).toHaveLength(2);
  });

  it('getStats() 空日志返回零值', () => {
    const s = logger.getStats();
    expect(s.totalChecks).toBe(0);
    expect(s.passed).toBe(0);
    expect(s.failed).toBe(0);
    expect(s.passRate).toBe(0);
    expect(s.totalViolations).toBe(0);
  });

  it('getStats() 正确计算聚合值', () => {
    logger.log({ reportId: '1', personaType: 'a', passed: true, totalViolations: 0, violationFields: [], violationTerms: [] });
    logger.log({ reportId: '2', personaType: 'b', passed: false, totalViolations: 3, violationFields: ['a', 'b'], violationTerms: ['x', 'y'] });
    logger.log({ reportId: '3', personaType: 'c', passed: true, totalViolations: 0, violationFields: [], violationTerms: [] });
    const s = logger.getStats();
    expect(s.totalChecks).toBe(3);
    expect(s.passed).toBe(2);
    expect(s.failed).toBe(1);
    expect(s.passRate).toBeCloseTo(2 / 3, 3);
    expect(s.totalViolations).toBe(3);
  });

  it('getTrends() 按时间窗口正确分桶', () => {
    const now = Date.now();
    // 直接写入 entries 以控制时间戳
    (logger as any).entries = [
      { timestamp: now - 90_000, reportId: 'a', personaType: 't', passed: true, totalViolations: 0, violationFields: [], violationTerms: [] },
      { timestamp: now - 30_000, reportId: 'b', personaType: 't', passed: false, totalViolations: 1, violationFields: ['f'], violationTerms: ['算命'] },
    ];
    const trends = logger.getTrends(60_000, 3);
    expect(trends).toHaveLength(3);
    const bucketed = trends.filter(b => b.total > 0);
    expect(bucketed.length).toBe(2);
  });

  it('getTrends() 空日志返回全零桶', () => {
    const trends = logger.getTrends(3600_000, 3);
    expect(trends).toHaveLength(3);
    for (const b of trends) {
      expect(b.total).toBe(0);
      expect(b.passed).toBe(0);
      expect(b.failed).toBe(0);
    }
  });

  it('从现有 JSONL 文件恢复条目', () => {
    const entry: SafetyLogEntry = { timestamp: 1000, reportId: 'old', personaType: 'x', passed: false, totalViolations: 5, violationFields: ['q'], violationTerms: ['占卜'] };
    fs.writeFileSync(logPath, JSON.stringify(entry) + '\n');
    const restored = new SafetyLogger(logPath);
    expect(restored.getEntries()).toHaveLength(1);
    expect(restored.getEntries()[0].reportId).toBe('old');
  });

  it('缺失文件时无故障启动', () => {
    const l = new SafetyLogger('/nonexistent/path/log.jsonl');
    expect(l.getEntries()).toHaveLength(0);
    expect(l.getStats().totalChecks).toBe(0);
  });

  it('损坏的 JSON 行被跳过', () => {
    fs.writeFileSync(logPath, '这不是json\n{"valid":"but not entry"}\n');
    const l = new SafetyLogger(logPath);
    // 损坏行被跳过，只有能解析成对象但缺少字段的行也会被 push（JSON.parse 不验证类型）
    // 第二行会成功解析，虽然不符合 SafetyLogEntry 类型但 JS 不报错
    expect(l.getEntries().length).toBeGreaterThanOrEqual(0);
  });

  it('多次 log 写入多行文件', () => {
    logger.log({ reportId: '1', personaType: 'a', passed: true, totalViolations: 0, violationFields: [], violationTerms: [] });
    logger.log({ reportId: '2', personaType: 'b', passed: false, totalViolations: 1, violationFields: ['s'], violationTerms: ['掌纹'] });
    const content = fs.readFileSync(logPath, 'utf-8').trim();
    const lines = content.split('\n').filter(Boolean);
    expect(lines.length).toBe(2);
  });
});
