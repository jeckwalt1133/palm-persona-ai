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

export interface UnlockState {
  userId: string;
  unlockedLines: string[];
}

export interface GrowthRepository {
  checkIn(userId: string, date: string): Promise<CheckInResult>;
  getRecord(userId: string): Promise<CheckInRecord | null>;
  getUnlockedLines(userId: string): Promise<string[]>;
}

const DAY_REWARDS: Record<number, string> = {
  1: '今日金句解锁 ✨',
  3: '深度分析体验卡 ×1',
  5: '专属人格标签解锁',
  7: '生命线深度解读已解锁',
};

// 连签里程碑 → 解锁掌纹线 key
const LINE_UNLOCK_SCHEDULE: Record<number, string> = {
  7: 'life',
};

const LINE_LABELS: Record<string, string> = {
  life: '生命线',
  wisdom: '智慧线',
  emotion: '感情线',
  career: '事业线',
};

export class InMemoryGrowthRepository implements GrowthRepository {
  private store = new Map<string, CheckInRecord>();
  private unlocks = new Map<string, UnlockState>();

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

    let reward = DAY_REWARDS[consecutiveDays] ?? undefined;

    // 检查是否达到解锁里程碑
    const unlockLineKey = LINE_UNLOCK_SCHEDULE[consecutiveDays];
    if (unlockLineKey) {
      const existing = this.unlocks.get(userId) ?? { userId, unlockedLines: [] };
      if (!existing.unlockedLines.includes(unlockLineKey)) {
        existing.unlockedLines.push(unlockLineKey);
        this.unlocks.set(userId, existing);
        const label = LINE_LABELS[unlockLineKey] ?? unlockLineKey;
        reward = `解锁「${label}」深度解读`;
      }
    }

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

  async getUnlockedLines(userId: string): Promise<string[]> {
    return this.unlocks.get(userId)?.unlockedLines ?? [];
  }
}

export const growthRepository = new InMemoryGrowthRepository();
