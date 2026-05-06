import { PersonaReport } from '../types/report.js';
import { ReportRepository } from './report-repository.js';
import { getDb } from '../db/connection.js';
import type { ReportRow } from '../db/schema.js';
import type { DatabaseSync } from 'node:sqlite';

function rowToReport(row: ReportRow): PersonaReport {
  return {
    id: row.id,
    createdAt: row.created_at,
    personaType: row.persona_type,
    personaLabel: row.persona_label,
    scores: JSON.parse(row.scores_json),
    summary: row.summary,
    insights: JSON.parse(row.insights_json),
    keywords: JSON.parse(row.keywords_json),
    quote: row.quote,
    suspenseText: row.suspense_text,
    coreTruth: row.core_truth,
    weeklyAdvice: row.weekly_advice,
    ...(row.visual_anchors_json && { visualAnchors: JSON.parse(row.visual_anchors_json) }),
    ...(row.identity_badge != null && { identityBadge: row.identity_badge }),
    ...(row.ad_teaser != null && { adTeaser: row.ad_teaser }),
    ...(row.relationship_code_json && { relationshipCode: JSON.parse(row.relationship_code_json) }),
    ...(row.celebrity_matches_json && { celebrityMatches: JSON.parse(row.celebrity_matches_json) }),
  };
}

export class SqliteReportRepository implements ReportRepository {
  private db: DatabaseSync;

  constructor(dbPath?: string) {
    this.db = getDb(dbPath);
  }

  async save(report: PersonaReport): Promise<void> {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT OR REPLACE INTO "report"(
          "id","user_id","persona_type","persona_label","scores_json","summary",
          "insights_json","keywords_json","quote","suspense_text","core_truth",
          "weekly_advice","visual_anchors_json","identity_badge","ad_teaser",
          "relationship_code_json","celebrity_matches_json",
          "compliance_checked","created_at","updated_at"
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .run(
        report.id,
        '', // user_id 由调用方在保存前设置（或后续关联）
        report.personaType,
        report.personaLabel,
        JSON.stringify(report.scores),
        report.summary,
        JSON.stringify(report.insights),
        JSON.stringify(report.keywords),
        report.quote,
        report.suspenseText,
        report.coreTruth,
        report.weeklyAdvice,
        (report as any).visualAnchors ? JSON.stringify((report as any).visualAnchors) : null,
        (report as any).identityBadge ?? null,
        (report as any).adTeaser ?? null,
        (report as any).relationshipCode ? JSON.stringify((report as any).relationshipCode) : null,
        (report as any).celebrityMatches ? JSON.stringify((report as any).celebrityMatches) : null,
        0, // compliance_checked 默认 0
        report.createdAt || now,
        now,
      );
  }

  async findById(id: string): Promise<PersonaReport | null> {
    const row = this.db
      .prepare('SELECT * FROM "report" WHERE "id"=?')
      .get(id) as unknown as ReportRow | undefined;
    return row ? rowToReport(row) : null;
  }

  async findAll(): Promise<PersonaReport[]> {
    const rows = this.db
      .prepare('SELECT * FROM "report" ORDER BY "created_at" DESC')
      .all() as unknown as ReportRow[];

    return rows.map(rowToReport);
  }

  async deleteById(id: string): Promise<boolean> {
    const result = this.db.prepare('DELETE FROM "report" WHERE "id"=?').run(id);
    return result.changes > 0;
  }

  /** 按用户ID查询所有报告 */
  async findByUserId(userId: string): Promise<PersonaReport[]> {
    const rows = this.db
      .prepare('SELECT * FROM "report" WHERE "user_id"=? ORDER BY "created_at" DESC')
      .all(userId) as unknown as ReportRow[];
    return rows.map(rowToReport);
  }

  /** 更新报告的合规检查状态 */
  async setComplianceChecked(id: string, checked: boolean): Promise<boolean> {
    const result = this.db
      .prepare('UPDATE "report" SET "compliance_checked"=?, "updated_at"=? WHERE "id"=?')
      .run(checked ? 1 : 0, new Date().toISOString(), id);
    return result.changes > 0;
  }

  /** 更新报告的反馈 */
  async setFeedback(id: string, rating: number, comment?: string): Promise<boolean> {
    const result = this.db
      .prepare(
        'UPDATE "report" SET "feedback_rating"=?, "feedback_comment"=?, "updated_at"=? WHERE "id"=?',
      )
      .run(rating, comment ?? null, new Date().toISOString(), id);
    return result.changes > 0;
  }
}
