import Taro from '@tarojs/taro';
import { apiUrl } from './api';

export interface CheckInResult {
  checkedIn: boolean;
  consecutiveDays: number;
  totalDays: number;
  message: string;
  reward?: string | null;
}

/**
 * 每日签到 — 调用后端 API，展示 Toast 结果
 */
export async function dailyCheckIn(): Promise<CheckInResult | null> {
  try {
    const res = await Taro.request({
      url: apiUrl('/api/checkin'),
      method: 'POST',
    });

    const body = res.data as { success: boolean; data: CheckInResult };
    if (!body.success || !body.data) return null;

    const { checkedIn, consecutiveDays, message, reward } = body.data;

    if (checkedIn) {
      Taro.showToast({
        title: `签到成功！连签 ${consecutiveDays} 天${reward ? `🎁${reward}` : ''}`,
        icon: 'success',
        duration: 3000,
      });
    } else {
      Taro.showToast({
        title: message,
        icon: 'none',
        duration: 2000,
      });
    }

    return body.data;
  } catch {
    Taro.showToast({ title: '签到失败，请稍后重试', icon: 'none' });
    return null;
  }
}
