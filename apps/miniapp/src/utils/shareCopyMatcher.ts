// 卡片序号→分享分类→文案匹配桥接
import { matchShareCopy, type ShareCategory, type MatchedShareCopy } from './shareCopy';
import type { ScoreItem } from './reportUtils';

// 卡片序号→分享分类映射
const CARD_CATEGORY_MAP: Record<number, ShareCategory> = {
  1: 'identity_label',
  2: 'hidden_truth',
  3: 'relationship',
  4: 'hidden_truth',
  5: 'identity_label',
  6: 'contrast',
};

export function resolveShareCopy(
  personaType: string,
  scores: ScoreItem[],
  cardIndex: number,
): MatchedShareCopy {
  const allMatched = matchShareCopy(personaType, scores);
  const targetCategory = CARD_CATEGORY_MAP[cardIndex] ?? 'hidden_truth';

  const best = allMatched.find((m) => m.category === targetCategory);
  if (best) return best;

  // 兜底：返回第一条匹配
  if (allMatched.length > 0) return allMatched[0];

  // 绝对兜底
  return {
    category: 'hidden_truth' as ShareCategory,
    texts: ['你的手掌说出了你没说出口的话。'],
    primaryText: '你的手掌说出了你没说出口的话。',
  };
}

export function getCardCategory(cardIndex: number): ShareCategory {
  return CARD_CATEGORY_MAP[cardIndex] ?? 'hidden_truth';
}
