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
  pendingUnlock: boolean; // 用户达到里程碑但还没选解锁哪条线
}

export interface GrowthRepository {
  checkIn(userId: string, date: string): Promise<CheckInResult>;
  getRecord(userId: string): Promise<CheckInRecord | null>;
  getUnlockedLines(userId: string): Promise<string[]>;
  hasPendingUnlock(userId: string): Promise<boolean>;
  claimLine(userId: string, lineKey: string): Promise<boolean>;
}

const DAY_REWARDS: Record<number, string> = {
  1: '今日金句解锁 ✨',
  3: '深度分析体验卡 ×1',
  5: '专属人格标签解锁',
  7: '自选一条掌纹线（已获得资格）',
};

export const LINE_KEYS = ['life', 'wisdom', 'emotion', 'career'] as const;
export type LineKey = (typeof LINE_KEYS)[number];

export const LINE_LABELS: Record<string, string> = {
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

    // 检查是否达到解锁里程碑（第7天）
    if (consecutiveDays === 7) {
      const existing = this.unlocks.get(userId) ?? { userId, unlockedLines: [], pendingUnlock: false };
      if (!existing.pendingUnlock) {
        existing.pendingUnlock = true;
        this.unlocks.set(userId, existing);
        reward = '获得自选一条掌纹线的资格 🎉';
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

  async hasPendingUnlock(userId: string): Promise<boolean> {
    return this.unlocks.get(userId)?.pendingUnlock ?? false;
  }

  async claimLine(userId: string, lineKey: string): Promise<boolean> {
    if (!LINE_KEYS.includes(lineKey as LineKey)) return false;

    const existing = this.unlocks.get(userId);
    if (!existing || !existing.pendingUnlock) return false;

    if (existing.unlockedLines.includes(lineKey)) return false;

    existing.unlockedLines.push(lineKey);
    existing.pendingUnlock = false;
    this.unlocks.set(userId, existing);
    return true;
  }
}

export const growthRepository = new InMemoryGrowthRepository();
