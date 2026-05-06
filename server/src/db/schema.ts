// SQLite 三表 DDL + TypeScript 行类型
// 表: user / report / checkin

// ─── DDL ───────────────────────────────────────────────

export const DDL_USER = `
CREATE TABLE IF NOT EXISTS "user" (
  "id"                  TEXT PRIMARY KEY NOT NULL,
  "nickname"            TEXT,
  "avatar_url"          TEXT,
  "palm_image_count"    INTEGER NOT NULL DEFAULT 0,
  "unlocked_lines_json" TEXT NOT NULL DEFAULT '[]',
  "created_at"          TEXT NOT NULL,
  "updated_at"          TEXT NOT NULL
) STRICT;
`;

export const DDL_REPORT = `
CREATE TABLE IF NOT EXISTS "report" (
  "id"                     TEXT PRIMARY KEY NOT NULL,
  "user_id"                TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "persona_type"           TEXT NOT NULL,
  "persona_label"          TEXT NOT NULL,
  "scores_json"            TEXT NOT NULL,
  "summary"                TEXT NOT NULL,
  "insights_json"          TEXT NOT NULL,
  "keywords_json"          TEXT NOT NULL,
  "quote"                  TEXT NOT NULL,
  "suspense_text"          TEXT NOT NULL,
  "core_truth"             TEXT NOT NULL,
  "weekly_advice"          TEXT NOT NULL,
  "visual_anchors_json"    TEXT,
  "identity_badge"         TEXT,
  "ad_teaser"              TEXT,
  "relationship_code_json" TEXT,
  "celebrity_matches_json" TEXT,
  "feedback_rating"        INTEGER,
  "feedback_comment"       TEXT,
  "compliance_checked"     INTEGER NOT NULL DEFAULT 0,
  "created_at"             TEXT NOT NULL,
  "updated_at"             TEXT NOT NULL
) STRICT;
`;

export const DDL_CHECKIN = `
CREATE TABLE IF NOT EXISTS "checkin" (
  "id"               INTEGER PRIMARY KEY AUTOINCREMENT,
  "user_id"          TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "checkin_date"     TEXT NOT NULL,
  "consecutive_days" INTEGER NOT NULL,
  "total_days"       INTEGER NOT NULL,
  "reward"           TEXT,
  "created_at"       TEXT NOT NULL,
  UNIQUE("user_id", "checkin_date")
) STRICT;
`;

export const DDL_MATCH = `
CREATE TABLE IF NOT EXISTS "match" (
  "id"                TEXT PRIMARY KEY NOT NULL,
  "inviter_report_id" TEXT NOT NULL REFERENCES "report"("id") ON DELETE CASCADE,
  "joiner_report_id"  TEXT REFERENCES "report"("id") ON DELETE SET NULL,
  "status"            TEXT NOT NULL DEFAULT 'pending',
  "result_json"       TEXT,
  "created_at"        TEXT NOT NULL,
  "expires_at"        TEXT NOT NULL
) STRICT;
`;

// ─── 索引 ───────────────────────────────────────────────

export const DDL_INDEXES = [
  'CREATE INDEX IF NOT EXISTS "idx_report_user_id" ON "report"("user_id")',
  'CREATE INDEX IF NOT EXISTS "idx_report_created_at" ON "report"("created_at")',
  'CREATE INDEX IF NOT EXISTS "idx_checkin_user_id" ON "checkin"("user_id")',
  'CREATE INDEX IF NOT EXISTS "idx_checkin_date" ON "checkin"("checkin_date")',
  'CREATE INDEX IF NOT EXISTS "idx_checkin_user_date" ON "checkin"("user_id", "checkin_date")',
];

// ─── 迁移版本表 ─────────────────────────────────────────

export const DDL_MIGRATION = `
CREATE TABLE IF NOT EXISTS "_migration" (
  "version"   INTEGER PRIMARY KEY NOT NULL,
  "name"      TEXT NOT NULL,
  "applied_at" TEXT NOT NULL DEFAULT (datetime('now'))
) STRICT;
`;

// ─── TypeScript 行类型 ──────────────────────────────────

export interface UserRow {
  id: string;
  nickname: string | null;
  avatar_url: string | null;
  palm_image_count: number;
  unlocked_lines_json: string;
  created_at: string;
  updated_at: string;
}

export interface ReportRow {
  id: string;
  user_id: string;
  persona_type: string;
  persona_label: string;
  scores_json: string;
  summary: string;
  insights_json: string;
  keywords_json: string;
  quote: string;
  suspense_text: string;
  core_truth: string;
  weekly_advice: string;
  visual_anchors_json: string | null;
  identity_badge: string | null;
  ad_teaser: string | null;
  relationship_code_json: string | null;
  celebrity_matches_json: string | null;
  feedback_rating: number | null;
  feedback_comment: string | null;
  compliance_checked: number;
  created_at: string;
  updated_at: string;
}

export interface CheckinRow {
  id: number;
  user_id: string;
  checkin_date: string;
  consecutive_days: number;
  total_days: number;
  reward: string | null;
  created_at: string;
}

export interface MatchRow {
  id: string;
  inviter_report_id: string;
  joiner_report_id: string | null;
  status: string;
  result_json: string | null;
  created_at: string;
  expires_at: string;
}

export interface MigrationRow {
  version: number;
  name: string;
  applied_at: string;
}
