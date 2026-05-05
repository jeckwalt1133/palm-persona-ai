/**
 * 合规门禁 — Lesson 9: 掌心人格局项目实战
 *
 * 全字段合规检查：PersonaReport 的所有文本字段逐一扫描
 *
 * 修复：原 analysis-service.ts 仅检查 summary（第175行），
 * coreTruth/insights/weeklyAdvice/维度描述全部漏检。
 */

import { PersonaReport } from '../engine/types.js';
import { ContentSafety } from './content-safety.js';

export interface FieldViolation {
  field: string;
  violations: string[];
}

export interface ComplianceGateResult {
  passed: boolean;
  violations: FieldViolation[];
  totalViolations: number;
  report: PersonaReport; // 经过过滤的报告
}

export function runComplianceGate(
  report: PersonaReport,
  safety: ContentSafety,
): ComplianceGateResult {
  const textFields: Array<{ field: string; value: string }> = [
    { field: 'summary', value: report.summary },
    { field: 'coreTruth', value: report.coreTruth },
    { field: 'weeklyAdvice', value: report.weeklyAdvice },
    ...report.insights.map((v, i) => ({ field: `insights[${i}]`, value: v })),
    ...report.scores.map((s, i) => ({ field: `scores[${i}].description`, value: s.description })),
    ...report.keywords.map((v, i) => ({ field: `keywords[${i}]`, value: v })),
  ];

  if (report.quote) {
    textFields.push({ field: 'quote', value: report.quote });
  }
  if (report.suspenseText) {
    textFields.push({ field: 'suspenseText', value: report.suspenseText });
  }
  if (report.identityBadge) {
    textFields.push({ field: 'identityBadge', value: report.identityBadge });
  }

  const allViolations: FieldViolation[] = [];
  let filtered = { ...report };

  for (const { field, value } of textFields) {
    if (!value) continue;
    const result = safety.check(value);
    if (!result.safe) {
      allViolations.push({ field, violations: result.violations });
    }
    // 逐字段更新过滤后的文本
    setField(filtered, field, result.filteredText);
  }

  return {
    passed: allViolations.length === 0,
    violations: allViolations,
    totalViolations: allViolations.reduce((sum, fv) => sum + fv.violations.length, 0),
    report: filtered,
  };
}

function setField(report: PersonaReport, field: string, value: string): void {
  if (field === 'summary') report.summary = value;
  else if (field === 'coreTruth') report.coreTruth = value;
  else if (field === 'weeklyAdvice') report.weeklyAdvice = value;
  else if (field === 'quote') report.quote = value;
  else if (field === 'suspenseText') report.suspenseText = value;
  else if (field === 'identityBadge') report.identityBadge = value;
  else if (field.startsWith('insights[')) {
    const idx = parseInt(field.match(/\d+/)?.[0] ?? '-1');
    if (idx >= 0 && idx < report.insights.length) report.insights[idx] = value;
  } else if (field.startsWith('keywords[')) {
    const idx = parseInt(field.match(/\d+/)?.[0] ?? '-1');
    if (idx >= 0 && idx < report.keywords.length) report.keywords[idx] = value;
  } else if (field.startsWith('scores[')) {
    const idx = parseInt(field.match(/\d+/)?.[0] ?? '-1');
    if (idx >= 0 && idx < report.scores.length) report.scores[idx].description = value;
  }
}
