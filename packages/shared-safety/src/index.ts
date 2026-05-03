// @palm/shared-safety — 前后端共享内容安全模块

// 全项目禁用词列表（v3 终版 25 项）
export const FORBIDDEN_TERMS: Array<{ pattern: string; label: string }> = [
  { pattern: '算命', label: '算命' },
  { pattern: '占卜', label: '占卜' },
  { pattern: '命运注定', label: '命运注定' },
  { pattern: '改运', label: '改运' },
  { pattern: '开运', label: '开运' },
  { pattern: '正缘', label: '正缘' },
  { pattern: '姻缘测算', label: '姻缘测算' },
  { pattern: '旺夫', label: '旺夫' },
  { pattern: '旺妻', label: '旺妻' },
  { pattern: '克夫', label: '克夫' },
  { pattern: '克妻', label: '克妻' },
  { pattern: '寿命预测', label: '寿命预测' },
  { pattern: '疾病预测', label: '疾病预测' },
  { pattern: '灾祸预测', label: '灾祸预测' },
  { pattern: '财富暴富预测', label: '财富暴富预测' },
  { pattern: '100%准确', label: '100%准确' },
  { pattern: '比算命更准', label: '比算命更准' },
  { pattern: '必然', label: '必然' },
  { pattern: '一定会', label: '一定会' },
  { pattern: '暴富', label: '暴富' },
  { pattern: '改命', label: '改命' },
  { pattern: '天注定', label: '天注定' },
  { pattern: '掌纹', label: '掌纹' },
  { pattern: '手相', label: '手相' },
  { pattern: '看手相', label: '看手相' },
  { pattern: '天生一对', label: '天生一对' },
  { pattern: '宿命', label: '宿命' },
];

export function checkForbiddenTerms(text: string): string[] {
  const violations: string[] = [];
  for (const term of FORBIDDEN_TERMS) {
    if (text.includes(term.pattern)) {
      violations.push(term.label);
    }
  }
  return violations;
}

export function replaceForbiddenTerms(text: string): string {
  let result = text;
  for (const term of FORBIDDEN_TERMS) {
    // 全局替换为 ***
    const escaped = term.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escaped, 'g'), '***');
  }
  return result;
}
