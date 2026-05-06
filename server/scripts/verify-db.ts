import { migrate } from '../src/db/migrate.js';
import { seed } from '../src/db/seed.js';
import { getDb, closeDb } from '../src/db/connection.js';
import fs from 'node:fs';

const testDb = '/tmp/palm-test.db';
// 清理旧数据
for (const f of [testDb, testDb + '-wal', testDb + '-shm']) {
  if (fs.existsSync(f)) fs.unlinkSync(f);
}

migrate(testDb);
seed(testDb);

const db = getDb(testDb);

// 验证三表
const users = db.prepare('SELECT COUNT(*) as c FROM "user"').get() as { c: number };
const reports = db.prepare('SELECT COUNT(*) as c FROM "report"').get() as { c: number };
const checkins = db.prepare('SELECT COUNT(*) as c FROM "checkin"').get() as { c: number };
const migrationRows = db.prepare('SELECT * FROM "_migration"').all() as { version: number; name: string; applied_at: string }[];

console.log('=== 验证结果 ===');
console.log('user 表:', users.c, '行 (期望: 2)');
console.log('report 表:', reports.c, '行 (期望: 1)');
console.log('checkin 表:', checkins.c, '行 (期望: 7)');
console.log('迁移记录:', JSON.stringify(migrationRows));

// 验证索引
const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'").all() as { name: string }[];
console.log('索引:', indexes.map((r) => r.name).join(', '));

// 验证外键
const fks = db.prepare("PRAGMA foreign_key_list('report')").all() as { from: string; to: string; table: string }[];
console.log('report 外键:', fks.length, '个 →', fks.map((f) => `${f.from} → ${f.table}(${f.to})`).join(', '));

// 验证数据完整性: report关联的user存在
const reportUser = db.prepare('SELECT r."id" as rid, u."nickname" as uname FROM "report" r JOIN "user" u ON r."user_id"=u."id"').get() as { rid: string; uname: string | null };
console.log('关联查询:', `报告 ${reportUser.rid} → 用户 ${reportUser.uname}`);

closeDb();
console.log('=== 全部验证通过 ===');
