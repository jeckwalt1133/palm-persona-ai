import { getDb } from './connection.js';
import {
  DDL_USER,
  DDL_REPORT,
  DDL_CHECKIN,
  DDL_INDEXES,
  DDL_MIGRATION,
} from './schema.js';

interface Migration {
  version: number;
  name: string;
  sql: string[];
}

/** 迁移注册表 — 按版本号顺序追加，永远不删除旧条目 */
const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'init_user_report_checkin',
    sql: [DDL_USER, DDL_REPORT, DDL_CHECKIN, DDL_MIGRATION, ...DDL_INDEXES],
  },
];

/** 执行所有未应用的迁移（幂等） */
export function migrate(dbPath?: string): void {
  const db = getDb(dbPath);

  // 确保迁移版本表存在（首次运行时的鸡生蛋问题）
  db.exec(DDL_MIGRATION);

  const currentVersion = db
    .prepare('SELECT COALESCE(MAX("version"), 0) AS "v" FROM "_migration"')
    .get() as { v: number };

  const pending = MIGRATIONS.filter((m) => m.version > currentVersion.v);

  if (pending.length === 0) {
    console.log(`[migrate] 数据库已是最新 (v${currentVersion.v})，无需迁移`);
    return;
  }

  for (const m of pending) {
    console.log(`[migrate] 执行迁移 v${m.version}: ${m.name}`);
    for (const sql of m.sql) {
      db.exec(sql);
    }
    db.prepare('INSERT INTO "_migration"("version","name") VALUES(?,?)').run(
      m.version,
      m.name,
    );
    console.log(`[migrate] ✓ v${m.version} 完成`);
  }

  console.log(`[migrate] 迁移完成: v${currentVersion.v} → v${pending.at(-1)!.version}`);
}

/** 独立运行: node --import tsx src/db/migrate.ts */
if (process.argv[1]?.includes('migrate')) {
  migrate();
  console.log('[migrate] 退出');
  process.exit(0);
}
