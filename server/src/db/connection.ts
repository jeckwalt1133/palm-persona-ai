import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const DB_PATH = path.resolve('data/palm-persona.db');

let instance: DatabaseSync | null = null;

/** 获取数据库单例 — 自动启用WAL模式+外键约束 */
export function getDb(dbPath?: string): DatabaseSync {
  if (!instance) {
    const target = dbPath ?? DB_PATH;
    const dir = path.dirname(target);
    // DatabaseSync 不会自动创建目录
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    instance = new DatabaseSync(target);
    instance.exec('PRAGMA journal_mode=WAL');
    instance.exec('PRAGMA foreign_keys=ON');
    instance.exec('PRAGMA busy_timeout=5000');
  }
  return instance;
}

/** 关闭数据库连接 */
export function closeDb(): void {
  if (instance) {
    instance.close();
    instance = null;
  }
}

/** 仅用于测试 — 重置单例 */
export function resetDb(): void {
  closeDb();
}
