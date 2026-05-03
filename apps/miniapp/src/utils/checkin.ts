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

// 签到段落文案池（key = 连签天数）
const CHECKIN_PARAGRAPHS: Record<number, string[]> = {
  1: [
    '第1天。AI发现你正在解锁一个隐藏副本。明天同一时间，你的掌纹会说更多。',
    '签到成功。你的掌纹档案已激活。明天来看看AI读出了什么。',
  ],
  2: [
    '连续签到第2天。你的掌纹开始显现更多细节。AI说：你在建立一个新的习惯。',
    '第二天了。AI正在加深对你的理解——你的频率越来越清晰。',
  ],
  3: [
    '连续签到第3天。AI说你的反内卷基因正在觉醒。明天继续？',
    '坚持3天。你的频率越来越清晰——AI捕捉到了一种稳定的模式。',
  ],
  4: [
    '连续签到第4天。你正在建立一个新的日常仪式。AI说：坚持本身就是一种人格特质。',
    '第四天。AI捕捉到你的一种深层模式——你比自己想象中更有规律。',
  ],
  5: [
    '连续签到第5天。你已经超过了一半的人。AI对你的了解越来越完整。',
    '第五天。你的掌心人格图谱越来越完整——差两天就能解锁隐藏内容。',
  ],
  6: [
    '连续签到第6天。明晚有隐藏奖励——再签一天，你可以自选解锁一条掌纹线。',
    '第六天。坚持本身就是一种人格特质——明天有大事发生。',
  ],
  7: [
    '连续签到第7天！🎉 你获得了一次自选掌纹线解锁资格——选一条你想深度了解的线吧。',
    '一周了！你的坚持解锁了选择权——生命线、智慧线、感情线、事业线，选哪条？',
  ],
};

const FALLBACK_PARAGRAPHS = [
  '签到成功。AI正在分析你的掌纹频率——每天都有新洞察。',
  '签到成功。你的洞察力 +1——今天的状态已记录。',
];

export function buildCheckInParagraph(consecutiveDays: number, reward?: string | null): string {
  if (reward && !reward.includes('解锁')) {
    return `🎁 ${reward}`;
  }
  const pool = CHECKIN_PARAGRAPHS[consecutiveDays] ?? FALLBACK_PARAGRAPHS;
  return pool[consecutiveDays % pool.length];
}

export async function dailyCheckIn(): Promise<CheckInResult | null> {
  try {
    const res = await Taro.request({
      url: apiUrl('/api/checkin'),
      method: 'POST',
      timeout: 15000,
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

export async function hasPendingUnlock(): Promise<boolean> {
  try {
    const res = await Taro.request({ url: apiUrl('/api/checkin/pending-unlock'), method: 'GET' });
    const body = res.data as { success: boolean; data: { pendingUnlock: boolean } };
    return body.success && body.data.pendingUnlock;
  } catch {
    return false;
  }
}

export async function claimLine(lineKey: string): Promise<boolean> {
  try {
    const res = await Taro.request({
      url: apiUrl('/api/checkin/claim-line'),
      method: 'POST',
      data: { lineKey },
    });
    const body = res.data as { success: boolean };
    return body.success === true;
  } catch {
    return false;
  }
}
