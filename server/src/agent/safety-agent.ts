/**
 * 安全Agent — 合规检查 + 内容安全门禁
 *
 * 职责: 独立执行输入和输出的安全合规检查。始终与其他Agent并行——
 * 不依赖分析或文案结果，只检查原始输入和最终输出。
 *
 * 分两阶段:
 *   阶段1 (preCheck): 检查输入图片和分数数据是否合法 (可与分析/文案并行)
 *   阶段2 (postCheck): 检查生成的报告文本是否合规 (需等分析+文案完成)
 */

import { PersonaReport, PersonaScore } from '../engine/types.js';
import { ContentSafety, defaultSafety } from '../safety/content-safety.js';
import { runComplianceGate, type ComplianceGateResult } from '../safety/compliance-gate.js';

export interface SafetyInput {
  imageBase64: string;
  scores: PersonaScore[];
}

export interface SafetyPreCheckResult {
  passed: boolean;
  issues: string[];
  inputSafe: boolean;
}

export interface SafetyPostCheckResult {
  passed: boolean;
  violations: string[];
  totalViolations: number;
  filteredReport: PersonaReport;
}

export interface SafetyReport {
  preCheck: SafetyPreCheckResult;
  postCheck: SafetyPostCheckResult | null; // null 如果 postCheck 还没跑
}

export class SafetyAgent {
  private safety: ContentSafety;

  constructor(safety?: ContentSafety) {
    this.safety = safety ?? defaultSafety;
  }

  /** 阶段1: 输入预检——可与分析/文案并行 */
  preCheck(input: SafetyInput): SafetyPreCheckResult {
    const issues: string[] = [];

    // 图片大小检查
    if (!input.imageBase64 || input.imageBase64.length < 50) {
      issues.push('图片数据无效或过小');
    }
    const estimatedBytes = input.imageBase64.length * 0.75;
    if (estimatedBytes > 10 * 1024 * 1024) {
      issues.push('图片过大(超过10MB)');
    }

    // 分数合法性
    for (const s of input.scores) {
      if (s.score < 0 || s.score > 100) {
        issues.push(`${s.dimension} 分数越界: ${s.score}`);
      }
    }
    if (input.scores.length < 3) {
      issues.push(`五维评分数不足: ${input.scores.length}/5`);
    }

    return {
      passed: issues.length === 0,
      issues,
      inputSafe: issues.length === 0,
    };
  }

  /** 阶段2: 输出合规门禁——需等分析+文案完成后 */
  postCheck(report: PersonaReport): SafetyPostCheckResult {
    const result: ComplianceGateResult = runComplianceGate(report, this.safety);
    return {
      passed: result.passed,
      violations: result.violations.map(v => `${v.field}: ${v.violations.join(', ')}`),
      totalViolations: result.totalViolations,
      filteredReport: result.report,
    };
  }

  /** 一键执行全流程 (用于串行模式) */
  run(input: SafetyInput, report: PersonaReport): SafetyReport {
    return {
      preCheck: this.preCheck(input),
      postCheck: this.postCheck(report),
    };
  }
}
