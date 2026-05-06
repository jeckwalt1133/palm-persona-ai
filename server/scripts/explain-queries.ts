/**
 * SQLite EXPLAIN QUERY PLAN 全查询分析
 * V7-W6-005 慢查询优化
 */
import { getDb, closeDb } from '../src/db/connection.js';
import { migrate } from '../src/db/migrate.js';
import { seed } from '../src/db/seed.js';

// 使用临时DB
const testDb = '/tmp/palm-explain.db';
import fs from 'node:fs';
for (const f of [testDb, testDb + '-wal', testDb + '-shm']) {
  if (fs.existsSync(f)) fs.unlinkSync(f);
}

migrate(testDb);
seed(testDb);
const db = getDb(testDb);

const QUERIES: { name: string; sql: string; params?: unknown[] }[] = [
  // report 表
  { name: 'report.findById', sql: 'SELECT * FROM "report" WHERE "id"=?' },
  { name: 'report.findAll', sql: 'SELECT * FROM "report" ORDER BY "created_at" DESC' },
  { name: 'report.findByUserId', sql: 'SELECT * FROM "report" WHERE "user_id"=? ORDER BY "created_at" DESC' },
  { name: 'report.deleteById', sql: 'DELETE FROM "report" WHERE "id"=?' },
  { name: 'report.setCompliance', sql: 'UPDATE "report" SET "compliance_checked"=?, "updated_at"=? WHERE "id"=?' },
  { name: 'report.setFeedback', sql: 'UPDATE "report" SET "feedback_rating"=?, "feedback_comment"=?, "updated_at"=? WHERE "id"=?' },

  // checkin 表
  { name: 'checkin.todayCheck', sql: 'SELECT * FROM "checkin" WHERE "user_id"=? AND "checkin_date"=?' },
  { name: 'checkin.yesterdayCheck', sql: 'SELECT * FROM "checkin" WHERE "user_id"=? AND "checkin_date"=?' },
  { name: 'checkin.maxTotal', sql: 'SELECT COALESCE(MAX("total_days"), 0) AS "m" FROM "checkin" WHERE "user_id"=?' },
  { name: 'checkin.latestRecord', sql: 'SELECT * FROM "checkin" WHERE "user_id"=? ORDER BY "checkin_date" DESC LIMIT 1' },
  { name: 'checkin.insert', sql: 'INSERT INTO "checkin"("user_id","checkin_date","consecutive_days","total_days","reward","created_at") VALUES(?,?,?,?,?,?)' },

  // user 表
  { name: 'user.findById', sql: 'SELECT "id" FROM "user" WHERE "id"=?' },
  { name: 'user.getUnlocked', sql: 'SELECT "unlocked_lines_json" FROM "user" WHERE "id"=?' },
  { name: 'user.updateUnlocked', sql: 'UPDATE "user" SET "unlocked_lines_json"=?, "updated_at"=? WHERE "id"=?' },
  { name: 'user.ensure', sql: 'INSERT INTO "user"("id","nickname","avatar_url","palm_image_count","unlocked_lines_json","created_at","updated_at") VALUES(?,?,?,?,?,?,?)' },
  { name: 'user.count', sql: 'SELECT COUNT(*) AS "c" FROM "user"' },

  // match 表
  { name: 'match.findById', sql: 'SELECT * FROM "match" WHERE "id"=?' },

  // 关联查询
  { name: 'join.reportUser', sql: 'SELECT r."id" as rid, u."nickname" as uname FROM "report" r JOIN "user" u ON r."user_id"=u."id" WHERE r."id"=?' },
];

console.log('═'.repeat(70));
console.log('SQLite EXPLAIN QUERY PLAN 全量分析');
console.log('═'.repeat(70));

let withIndex = 0;
let withoutIndex = 0;

for (const q of QUERIES) {
  console.log(`\n── ${q.name} ──`);
  console.log(`SQL: ${q.sql.slice(0, 80)}...`);

  try {
    const plan = db.prepare(`EXPLAIN QUERY PLAN ${q.sql}`).all(...(q.params ?? []));
    for (const row of plan as Record<string, unknown>[]) {
      const detail = (row.detail as string) || '';
      const used = detail.includes('USING INDEX') || detail.includes('USING COVERING INDEX') || detail.includes('PRIMARY KEY');
      const marker = used ? '✅' : '⚠️ ';
      if (used) withIndex++;
      else withoutIndex++;
      console.log(`  ${marker} id=${row.id} parent=${row.parent} ${detail}`);
    }
  } catch (e) {
    console.log(`  ❌ ERROR: ${(e as Error).message}`);
  }
}

console.log(`\n${'═'.repeat(70)}`);
console.log(`索引命中: ${withIndex}  全表扫描: ${withoutIndex}`);
console.log(`索引覆盖率: ${((withIndex / (withIndex + withoutIndex)) * 100).toFixed(0)}%`);
console.log(`数据库文件: ${testDb}`);

closeDb();
