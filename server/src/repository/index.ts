import { migrate } from '../db/migrate.js';
import { SqliteReportRepository } from './sqlite-report-repository.js';
import { SqliteGrowthRepository } from './sqlite-growth-repository.js';

// 模块加载时自动执行迁移（内存DB每次创建都需要）
migrate();

/** SQLite 仓库单例 — 替换原 InMemory 实现 */
export const reportRepo = new SqliteReportRepository();
export const growthRepo = new SqliteGrowthRepository();
