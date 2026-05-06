import { MatchInvite, CompatibilityResult } from '../engine/types.js';
import { getDb } from '../db/connection.js';
import type { MatchRow } from '../db/schema.js';
import type { DatabaseSync } from 'node:sqlite';

export interface MatchRepository {
  save(invite: MatchInvite): Promise<void>;
  findById(id: string): Promise<MatchInvite | null>;
  deleteById(id: string): Promise<boolean>;
  /** 清理过期匹配，返回清理数量 */
  cleanExpired(): Promise<number>;
}

function rowToInvite(row: MatchRow): MatchInvite {
  const invite: MatchInvite = {
    id: row.id,
    inviterReportId: row.inviter_report_id,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    status: row.status as MatchInvite['status'],
  };
  if (row.joiner_report_id) invite.joinerReportId = row.joiner_report_id;
  if (row.result_json) invite.result = JSON.parse(row.result_json) as CompatibilityResult;
  return invite;
}

/** 内存实现 — 仅用于测试 */
export class InMemoryMatchRepository implements MatchRepository {
  private matches = new Map<string, MatchInvite>();

  async save(invite: MatchInvite): Promise<void> {
    this.matches.set(invite.id, invite);
  }

  async findById(id: string): Promise<MatchInvite | null> {
    return this.matches.get(id) ?? null;
  }

  async deleteById(id: string): Promise<boolean> {
    return this.matches.delete(id);
  }

  async cleanExpired(): Promise<number> {
    const now = new Date().toISOString();
    let cleaned = 0;
    for (const [id, invite] of this.matches) {
      if (invite.expiresAt < now) {
        this.matches.delete(id);
        cleaned++;
      }
    }
    return cleaned;
  }
}

/** SQLite 持久化实现 — 生产环境使用 */
export class SqliteMatchRepository implements MatchRepository {
  private db: DatabaseSync;

  constructor(dbPath?: string) {
    this.db = getDb(dbPath);
  }

  async save(invite: MatchInvite): Promise<void> {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO "match"(
          "id","inviter_report_id","joiner_report_id","status","result_json",
          "created_at","expires_at"
        ) VALUES(?,?,?,?,?,?,?)`,
      )
      .run(
        invite.id,
        invite.inviterReportId,
        invite.joinerReportId ?? null,
        invite.status,
        invite.result ? JSON.stringify(invite.result) : null,
        invite.createdAt,
        invite.expiresAt,
      );
  }

  async findById(id: string): Promise<MatchInvite | null> {
    const row = this.db
      .prepare('SELECT * FROM "match" WHERE "id"=?')
      .get(id) as unknown as MatchRow | undefined;
    return row ? rowToInvite(row) : null;
  }

  async deleteById(id: string): Promise<boolean> {
    const result = this.db.prepare('DELETE FROM "match" WHERE "id"=?').run(id);
    return result.changes > 0;
  }

  async cleanExpired(): Promise<number> {
    const result = this.db
      .prepare('DELETE FROM "match" WHERE "expires_at" < ?')
      .run(new Date().toISOString());
    return Number(result.changes);
  }
}
