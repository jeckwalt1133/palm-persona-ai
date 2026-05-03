import Taro from '@tarojs/taro';
import { apiUrl } from './api';

export interface CheckInResult {
  checkedIn: boolean;
  consecutiveDays: number;
  totalDays: number;
  message: string;
  reward?: string | null;
}

export interface CheckInRecord {
  lastCheckInDate: string | null;
  consecutiveDays: number;
  totalDays: number;
}

// 签到趣味文案池（key = 连签天数）
const CHECKIN_SENTENCES: Record<number, string[]> = {
  1: ['AI发现你正在解锁一个隐藏副本', '你的掌纹档案已激活，明天来看到更多'],
  2: ['连续签到第2天，你的掌纹开始显现更多细节', '第二天了，AI正在加深对你的理解'],
  3: ['连续签到第3天，AI说你正在觉醒反内卷基因', '坚持3天，你的频率越来越清晰'],
  4: ['连续签到第4天，你正在建立一个新的日常仪式', '第四天，AI捕捉到你的一种深层模式'],
  5: ['连续签到第5天，你已经超过了一半的人', '第五天，AI对你的了解越来越完整'],
  6: ['连续签到第6天，明晚有隐藏奖励', '第六天，坚持本身就是一种人格特质'],
  7: ['连续签到第7天！AI为你解锁了一条掌纹线', '一周了！你的坚持解锁了隐藏内容'],
};

const FALLBACK_SENTENCES = [
  '签到成功，AI正在分析你的掌纹频率',
  '签到成功，你的洞察力 +1',
  '签到成功，你今天的状态已记录',
];

export function buildCheckInMessage(consecutiveDays: number, reward?: string | null): string {
  if (reward) {
    return `🎁 ${reward}`;
  }
  const pool = CHECKIN_SENTENCES[consecutiveDays] ?? FALLBACK_SENTENCES;
  return pool[consecutiveDays % pool.length];
}

export async function dailyCheckIn(): Promise<CheckInResult | null> {
  try {
    const res = await Taro.request({
      url: apiUrl('/api/checkin'),
      method: 'POST',
    });
    const body = res.data as { success: boolean; data: CheckInResult };
    if (!body.success || !body.data) return null;
    return body.data;
  } catch {
    return null;
  }
}

export async function getCheckInRecord(): Promise<CheckInRecord | null> {
  try {
    const res = await Taro.request({ url: apiUrl('/api/checkin/record'), method: 'GET' });
    const body = res.data as { success: boolean; data: CheckInRecord | null };
    if (!body.success) return null;
    return body.data ?? { lastCheckInDate: null, consecutiveDays: 0, totalDays: 0 };
  } catch {
    return null;
  }
}

export async function getUnlockedLines(): Promise<string[]> {
  try {
    const res = await Taro.request({ url: apiUrl('/api/checkin/unlocked-lines'), method: 'GET' });
    const body = res.data as { success: boolean; data: { unlockedLines: string[] } };
    if (!body.success) return [];
    return body.data.unlockedLines ?? [];
  } catch {
    return [];
  }
}
