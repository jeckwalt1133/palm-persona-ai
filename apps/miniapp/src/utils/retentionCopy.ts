// 留存推送文案库 — 借鉴 Claude Routines 主动服务模式
// 6条模板：3唤醒 + 2回流 + 1变化提醒

import { checkForbiddenTerms } from './shareCopy';

// ══════ 类型定义 ══════

export type RetentionChannel =
  | 'push_day7'      // 7天轻提醒
  | 'push_day10'     // 10天社交钩子
  | 'push_day14'     // 14天新鲜钩子
  | 'reflow_single'  // 单次分享回流
  | 'reflow_multi'   // 多次分享回流
  | 'change_reminder'; // 人格变化提醒

export interface RetentionMessage {
  channel: RetentionChannel;
  title: string;
  body: string;
  cta: string;
  temperature: string;
}

// ══════ 文案模板 ══════

const RETENTION_MESSAGES: Record<RetentionChannel, RetentionMessage> = {

  // ── 推送1: 7天轻提醒 ──
  push_day7: {
    channel: 'push_day7',
    title: '掌心还有话没说完',
    body: '你上次拍的手掌，掌心还有话没说完。\n\n7天前AI从你的掌纹里读到了一些东西——可能你自己都没注意到。',
    cta: '回来看一眼，1分钟。',
    temperature: '温4° / 像朋友随口一提',
  },

  // ── 推送2: 10天社交钩子 ──
  push_day10: {
    channel: 'push_day10',
    title: '你的「同类」在等你',
    body: '你知道每天有多少人第一次通过手掌认识自己吗？\n\n昨天是300多个。其中7个和你可能是同一种人格。',
    cta: '你的「同类」在等你。',
    temperature: '温5° / 朋友之间的小秘密',
  },

  // ── 推送3: 14天新鲜钩子 ──
  push_day14: {
    channel: 'push_day14',
    title: '跟上次的不一样了',
    body: '你上次测的时候没有这个——\n\n我们新增了「犀利视角」模式。AI 这次可能会对你说真话。有点直接的那种。',
    cta: '试试看？跟上次的不一样。',
    temperature: '温4° / 有新东西了',
  },

  // ── 回流1: 朋友扫码即时推送 ──
  reflow_single: {
    channel: 'reflow_single',
    title: '有人刚看了你的报告',
    body: '有人刚看了你分享的报告。\n\n你那份「{personaLabel}」的身份卡，被另一个人认真读了一遍。ta 可能正在犹豫要不要也拍一张。',
    cta: '问问 ta 看到了什么？',
    temperature: '温5° / 温暖社交信号',
  },

  // ── 回流2: 多个朋友扫码聚合推送 ──
  reflow_multi: {
    channel: 'reflow_multi',
    title: '你的分享影响了{count}个人',
    body: '已经有{count}个人通过你的分享走进了掌心人格局。\n\n其中{diffCount}个人测出了和你完全不一样的人格。这说明你身边的人都挺特别——或者说，你挑朋友的眼光很准。',
    cta: '看看谁测了？你们像不像？',
    temperature: '温5° / 你的眼光被验证了',
  },

  // ── 变化提醒: 再次测试结果不同 ──
  change_reminder: {
    channel: 'change_reminder',
    title: 'AI 这次读出了不一样的你',
    body: '上次是「{previousLabel}」，这次是「{currentLabel}」。\n\n手掌没变，是这两个星期里你变了一些东西。或者说——你展现了另一面。',
    cta: '看看到底哪里不一样？',
    temperature: '温4° / 好奇中带一点认真',
  },
};

// ══════ 获取函数 ══════

export function getRetentionMessage(
  channel: RetentionChannel,
  vars?: Record<string, string | number>,
): RetentionMessage {
  const template = RETENTION_MESSAGES[channel];
  if (!template) {
    return RETENTION_MESSAGES.push_day7; // 兜底
  }

  if (!vars) return { ...template };

  let body = template.body;
  let title = template.title;
  let cta = template.cta;

  for (const [key, val] of Object.entries(vars)) {
    const placeholder = `{${key}}`;
    const strVal = String(val);
    body = body.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), strVal);
    title = title.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), strVal);
    cta = cta.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), strVal);
  }

  return { channel, title, body, cta, temperature: template.temperature };
}

export function getChangeReminderBody(previousLabel: string, currentLabel: string): string {
  return getRetentionMessage('change_reminder', {
    previousLabel,
    currentLabel,
  }).body;
}

export function getReflowSingleBody(personaLabel: string): string {
  return getRetentionMessage('reflow_single', { personaLabel }).body;
}

export function getReflowMultiBody(count: number, diffCount: number): string {
  return getRetentionMessage('reflow_multi', { count, diffCount }).body;
}

export function getAllRetentionMessages(): RetentionMessage[] {
  return Object.values(RETENTION_MESSAGES);
}

// ══════ 人格变化检测 ══════

const PREVIOUS_PERSONA_KEY = 'palm_previous_persona';
const PREVIOUS_DATE_KEY = 'palm_previous_report_date';

export interface PersonaChange {
  changed: boolean;
  previousLabel: string | null;
  previousDate: string | null;
  currentLabel: string;
  daysSince: number | null;
}

export function detectPersonaChange(currentLabel: string): PersonaChange {
  try {
    const previousLabel = localStorage?.getItem(PREVIOUS_PERSONA_KEY) ?? null;
    const previousDate = localStorage?.getItem(PREVIOUS_DATE_KEY) ?? null;

    const changed = previousLabel !== null && previousLabel !== currentLabel;

    let daysSince: number | null = null;
    if (previousDate) {
      const prev = new Date(previousDate);
      const now = new Date();
      daysSince = Math.floor((now.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
    }

    return { changed, previousLabel, previousDate, currentLabel, daysSince };
  } catch {
    return { changed: false, previousLabel: null, previousDate: null, currentLabel, daysSince: null };
  }
}

export function saveCurrentPersona(personaLabel: string): void {
  try {
    localStorage?.setItem(PREVIOUS_PERSONA_KEY, personaLabel);
    localStorage?.setItem(PREVIOUS_DATE_KEY, new Date().toISOString().split('T')[0]);
  } catch { /* noop */ }
}

// ══════ 构建时合规校验 ══════

(() => {
  const violations: string[] = [];
  for (const msg of Object.values(RETENTION_MESSAGES)) {
    const fullText = `${msg.title} ${msg.body} ${msg.cta}`;
    const result = checkForbiddenTerms(fullText);
    if (result.length > 0) {
      violations.push(`[${msg.channel}] 违规词: ${result.join(', ')}`);
    }
  }
  if (violations.length > 0) {
    throw new Error(`留存文案合规校验失败:\n${violations.join('\n')}`);
  }
})();
