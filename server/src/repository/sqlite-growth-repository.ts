import {
  GrowthRepository,
  CheckInRecord,
  CheckInResult,
  LINE_KEYS,
  type LineKey,
} from '../services/growth/growth-repository.js';
import { getDb } from '../db/connection.js';
import type { CheckinRow } from '../db/schema.js';
import type { DatabaseSync } from 'node:sqlite';

const DAY_REWARDS: Record<number, string> = {
  1: '今日金句解锁',
  3: '深度分析体验卡 ×1',
  5: '专属人格标签解锁',
  7: '自选深度维度资格',
};

export class SqliteGrowthRepository implements GrowthRepository {
  private db: DatabaseSync;

  constructor(dbPath?: string) {
    this.db = getDb(dbPath);
  }

  async checkIn(userId: string, date: string): Promise<CheckInResult> {
    // 确保用户存在
    this.ensureUser(userId);

    // 检查今天是否已签到
    const todayRow = this.db
      .prepare('SELECT * FROM "checkin" WHERE "user_id"=? AND "checkin_date"=?')
      .get(userId, date) as CheckinRow | undefined;

    if (todayRow) {
      return {
        checkedIn: false,
        consecutiveDays: todayRow.consecutive_days,
        totalDays: todayRow.total_days,
      };
    }

    // 查昨天的记录以判断连续性
    const yesterday = new Date(date);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const yesterdayRow = this.db
      .prepare('SELECT * FROM "checkin" WHERE "user_id"=? AND "checkin_date"=?')
      .get(userId, yesterdayStr) as CheckinRow | undefined;

    const consecutiveDays = yesterdayRow ? yesterdayRow.consecutive_days + 1 : 1;

    // 获取当前累计天数
    const maxRow = this.db
      .prepare('SELECT COALESCE(MAX("total_days"), 0) AS "m" FROM "checkin" WHERE "user_id"=?')
      .get(userId) as { m: number };
    const totalDays = maxRow.m + 1;

    let reward: string | undefined = DAY_REWARDS[consecutiveDays];

    // 第7天里程碑: 设置 pending unlock
    if (consecutiveDays === 7) {
      const userRow = this.db
        .prepare('SELECT "unlocked_lines_json" FROM "user" WHERE "id"=?')
        .get(userId) as { unlocked_lines_json: string } | undefined;
      if (userRow) {
        // pendingUnlock 状态通过 "有7的倍数签到但没有解锁新线" 来推断
        // unlocked_lines_json 已读取，此处验证用户行存在即可
      }
      reward = '获得自选深度维度的资格';
    }

    const now = new Date().toISOString();
    this.db
      .prepare(
        'INSERT INTO "checkin"("user_id","checkin_date","consecutive_days","total_days","reward","created_at") VALUES(?,?,?,?,?,?)',
      )
      .run(userId, date, consecutiveDays, totalDays, reward ?? null, now);

    return { checkedIn: true, consecutiveDays, totalDays, reward };
  }

  async getRecord(userId: string): Promise<CheckInRecord | null> {
    const row = this.db
      .prepare(
        'SELECT * FROM "checkin" WHERE "user_id"=? ORDER BY "checkin_date" DESC LIMIT 1',
      )
      .get(userId) as CheckinRow | undefined;

    if (!row) return null;

    return {
      userId: row.user_id,
      lastCheckInDate: row.checkin_date,
      consecutiveDays: row.consecutive_days,
      totalDays: row.total_days,
    };
  }

  async getUnlockedLines(userId: string): Promise<string[]> {
    const row = this.db
      .prepare('SELECT "unlocked_lines_json" FROM "user" WHERE "id"=?')
      .get(userId) as { unlocked_lines_json: string } | undefined;
    if (!row) return [];
    return JSON.parse(row.unlocked_lines_json) as string[];
  }

  async hasPendingUnlock(userId: string): Promise<boolean> {
    // pending unlock = 连续签到天数是7的倍数 且 还没解锁完所有线
    const record = await this.getRecord(userId);
    if (!record || record.consecutiveDays < 7) return false;

    const unlocked = await this.getUnlockedLines(userId);
    // 检查最近一个7天里程碑是否已领取
    const milestones = Math.floor(record.consecutiveDays / 7);
    return unlocked.length < milestones && unlocked.length < LINE_KEYS.length;
  }

  async claimLine(userId: string, lineKey: string): Promise<boolean> {
    if (!LINE_KEYS.includes(lineKey as LineKey)) return false;

    const hasPending = await this.hasPendingUnlock(userId);
    if (!hasPending) return false;

    const unlocked = await this.getUnlockedLines(userId);
    if (unlocked.includes(lineKey)) return false;

    unlocked.push(lineKey);
    const now = new Date().toISOString();
    this.db
      .prepare('UPDATE "user" SET "unlocked_lines_json"=?, "updated_at"=? WHERE "id"=?')
      .run(JSON.stringify(unlocked), now, userId);

    return true;
  }

  /** 确保用户行存在 — 签到前隐式创建用户 */
  private ensureUser(userId: string): void {
    const row = this.db.prepare('SELECT "id" FROM "user" WHERE "id"=?').get(userId);
    if (!row) {
      const now = new Date().toISOString();
      this.db
        .prepare(
          'INSERT INTO "user"("id","nickname","avatar_url","palm_image_count","unlocked_lines_json","created_at","updated_at") VALUES(?,?,?,?,?,?,?)',
        )
        .run(userId, null, null, 0, '[]', now, now);
    }
  }
}
