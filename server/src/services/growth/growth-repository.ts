export interface CheckInRecord {
  userId: string;
  lastCheckInDate: string;
  consecutiveDays: number;
  totalDays: number;
}

export interface CheckInResult {
  checkedIn: boolean;
  consecutiveDays: number;
  totalDays: number;
  reward?: string;
}

export interface GrowthRepository {
  checkIn(userId: string, date: string): Promise<CheckInResult>;
  getRecord(userId: string): Promise<CheckInRecord | null>;
}

const DAY_REWARDS: Record<number, string> = {
  1: '今日金句解锁 ✨',
  3: '深度分析体验卡 ×1',
  5: '专属人格标签解锁',
  7: '完整掌心人格全景报告',
};

export class InMemoryGrowthRepository implements GrowthRepository {
  private store = new Map<string, CheckInRecord>();

  async checkIn(userId: string, date: string): Promise<CheckInResult> {
    const today = date;
    const record = this.store.get(userId);

    if (record && record.lastCheckInDate === today) {
      return {
        checkedIn: false,
        consecutiveDays: record.consecutiveDays,
        totalDays: record.totalDays,
      };
    }

    const yesterday = new Date(date);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const isConsecutive = record?.lastCheckInDate === yesterdayStr;
    const consecutiveDays = isConsecutive ? record.consecutiveDays + 1 : 1;
    const totalDays = (record?.totalDays ?? 0) + 1;

    const reward = DAY_REWARDS[consecutiveDays] ?? undefined;

    this.store.set(userId, {
      userId,
      lastCheckInDate: today,
      consecutiveDays,
      totalDays,
    });

    return { checkedIn: true, consecutiveDays, totalDays, reward };
  }

  async getRecord(userId: string): Promise<CheckInRecord | null> {
    return this.store.get(userId) ?? null;
  }
}

export const growthRepository = new InMemoryGrowthRepository();
