/**
 * FTS5 记忆全文索引 — memory/ 目录内容搜索引擎
 * V7-W6-005 记忆索引方案
 *
 * 架构:
 *   memory_files     — 文件元数据 (path/mtime/size/type/checksum)
 *   memory_fts       — FTS5 虚拟表 (trigram 分词, 中文友好)
 *
 * 工作流: 扫描→提取文本→写入双表→FTS5 MATCH 查询
 */
import { getDb } from './connection.js';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// ═══════════════════════════════════════════════════════════════
// 类型
// ═══════════════════════════════════════════════════════════════

export interface MemoryFileMeta {
  path: string;
  mtime: number;
  size: number;
  type: 'md' | 'json' | 'jsonl' | 'other';
  checksum: string;
}

export interface SearchResult {
  path: string;
  type: string;
  rank: number;
  snippet: string;
  mtime: number;
  size: number;
}

export interface SearchOptions {
  limit?: number;
  offset?: number;
  type?: 'md' | 'json' | 'jsonl';
}

export interface IndexStats {
  totalFiles: number;
  totalSize: number;
  byType: Record<string, number>;
  lastBuilt: number | null;
}

// ═══════════════════════════════════════════════════════════════
// DDL
// ═══════════════════════════════════════════════════════════════

const DDL_MEMORY_FILES = `
CREATE TABLE IF NOT EXISTS "memory_files" (
  "path"      TEXT PRIMARY KEY NOT NULL,
  "mtime"     INTEGER NOT NULL,
  "size"      INTEGER NOT NULL,
  "type"      TEXT NOT NULL,
  "checksum"  TEXT NOT NULL
) STRICT;
`;

const DDL_MEMORY_FTS = `
CREATE VIRTUAL TABLE IF NOT EXISTS "memory_fts" USING fts5(
  "path",
  "type",
  "content",
  tokenize='trigram'
);
`;

// ═══════════════════════════════════════════════════════════════
// 内容提取
// ═══════════════════════════════════════════════════════════════

function stripFrontmatter(text: string): string {
  if (!text.startsWith('---')) return text;
  const end = text.indexOf('---', 3);
  if (end === -1) return text;
  return text.slice(end + 3).trim();
}

function extractMd(raw: string): string {
  // 去 YAML frontmatter，保留全部正文
  const body = stripFrontmatter(raw);
  // 去掉 markdown 链接语法但保留文字: [text](url) → text
  return body.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
}

function extractJson(raw: string): string {
  try {
    const obj = JSON.parse(raw);
    const parts: string[] = [];
    walk(obj, '');
    return parts.join('\n');

    function walk(node: unknown, prefix: string) {
      if (typeof node === 'string' && node.length > 0) {
        parts.push(node);
      } else if (Array.isArray(node)) {
        for (let i = 0; i < node.length; i++) {
          walk(node[i], `${prefix}[${i}]`);
        }
      } else if (node && typeof node === 'object') {
        for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
          walk(v, prefix ? `${prefix}.${k}` : k);
        }
      }
    }
  } catch {
    return raw;
  }
}

function extractJsonl(raw: string): string {
  const lines = raw.trim().split('\n');
  const parts: string[] = [];
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      const vals: string[] = [];
      collectStrings(obj, vals);
      if (vals.length > 0) parts.push(vals.join(' '));
    } catch {
      parts.push(line);
    }
  }
  return parts.join('\n');
}

function collectStrings(node: unknown, out: string[]) {
  if (typeof node === 'string' && node.length > 0) {
    out.push(node);
  } else if (Array.isArray(node)) {
    for (const item of node) collectStrings(item, out);
  } else if (node && typeof node === 'object') {
    for (const v of Object.values(node as Record<string, unknown>)) {
      collectStrings(v, out);
    }
  }
}

function extractContent(filePath: string, type: MemoryFileMeta['type']): string {
  const raw = fs.readFileSync(filePath, 'utf-8');
  switch (type) {
    case 'md':   return extractMd(raw);
    case 'json': return extractJson(raw);
    case 'jsonl':return extractJsonl(raw);
    default:     return raw.slice(0, 4096);
  }
}

// ═══════════════════════════════════════════════════════════════
// 工具
// ═══════════════════════════════════════════════════════════════

function checksum(content: string): string {
  return crypto.createHash('md5').update(content).digest('hex').slice(0, 12);
}

function parseFileType(ext: string): MemoryFileMeta['type'] {
  if (ext === '.md') return 'md';
  if (ext === '.json') return 'json';
  if (ext === '.jsonl') return 'jsonl';
  return 'other';
}

/**
 * 转义 FTS5 查询语法中的特殊字符
 * 策略: 用双引号包裹用户输入，防注入
 */
export function escapeFts5Query(input: string): string {
  // 移除已有的双引号，然后用双引号包裹
  const sanitized = input.replace(/"/g, '');
  return `"${sanitized}"`;
}

/**
 * 构建 FTS5 布尔查询
 * 多个词用 AND 连接
 */
export function buildFts5Query(input: string): string {
  const words = input
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 0)
    .map(w => escapeFts5Query(w));
  return words.join(' AND ');
}

// ═══════════════════════════════════════════════════════════════
// 核心 API
// ═══════════════════════════════════════════════════════════════

export class MemoryIndex {
  private db: ReturnType<typeof getDb>;

  constructor(dbPath?: string) {
    this.db = getDb(dbPath);
    this.initTables();
  }

  // ── 初始化 ─────────────────────────────────────────────────

  private initTables(): void {
    this.db.exec(DDL_MEMORY_FILES);
    // FTS5 CREATE VIRTUAL TABLE 不能包在 IF NOT EXISTS 内需要 try
    try {
      this.db.exec(DDL_MEMORY_FTS);
    } catch (_e) {
      // 表已存在则忽略
    }
  }

  // ── 索引构建 ───────────────────────────────────────────────

  /**
   * 扫描 memory/ 目录，增量更新索引
   * @param memoryDir 绝对路径
   * @param fullRebuild 默认 false（增量），true 强制全量重建
   */
  buildIndex(memoryDir: string, fullRebuild = false): { added: number; updated: number; deleted: number } {
    if (!fs.existsSync(memoryDir)) {
      throw new Error(`memory/ 目录不存在: ${memoryDir}`);
    }

    if (fullRebuild) {
      this.db.exec('DELETE FROM "memory_files"');
      this.db.exec('DELETE FROM "memory_fts"');
    }

    const diskFiles = this.scanDir(memoryDir);
    const dbFiles = new Set(
      this.db.prepare('SELECT "path" FROM "memory_files"').all()
        .map((r: unknown) => (r as Record<string, string>).path)
    );

    let added = 0, updated = 0, deleted = 0;

    const insertMeta = this.db.prepare(
      'INSERT OR REPLACE INTO "memory_files"("path","mtime","size","type","checksum") VALUES(?,?,?,?,?)'
    );
    const insertFts = this.db.prepare(
      'INSERT INTO "memory_fts"("path","type","content") VALUES(?,?,?)'
    );

    const deleteMeta = this.db.prepare('DELETE FROM "memory_files" WHERE "path"=?');
    const deleteFts = this.db.prepare('DELETE FROM "memory_fts" WHERE "path"=?');

    // 处理磁盘文件
    for (const [relPath, meta] of diskFiles) {
      const existing = dbFiles.has(relPath);
      dbFiles.delete(relPath);

      // 检查是否需要更新
      if (existing && !fullRebuild) {
        const stored = this.db.prepare(
          'SELECT "mtime","checksum" FROM "memory_files" WHERE "path"=?'
        ).get(relPath) as { mtime: number; checksum: string } | undefined;

        if (stored && stored.mtime === meta.mtime && stored.checksum === meta.checksum) {
          continue; // 未变化，跳过
        }

        // 有变化，先删旧条目
        deleteFts.run(relPath);
        updated++;
      } else if (!existing) {
        added++;
      }

      // 提取内容并写入
      const absPath = path.join(memoryDir, relPath);
      try {
        const content = extractContent(absPath, meta.type);
        insertMeta.run(relPath, meta.mtime, meta.size, meta.type, meta.checksum);
        insertFts.run(relPath, meta.type, content);
      } catch (err) {
        console.error(`[memory-index] 索引失败: ${relPath} — ${(err as Error).message}`);
      }
    }

    // 删除磁盘上不存在的文件
    for (const gone of dbFiles) {
      deleteMeta.run(gone);
      deleteFts.run(gone);
      deleted++;
    }

    return { added, updated, deleted };
  }

  // ── 搜索 ───────────────────────────────────────────────────

  search(query: string, opts: SearchOptions = {}): SearchResult[] {
    const { limit = 20, offset = 0, type } = opts;

    const ftsQuery = buildFts5Query(query);

    // 短词检测: trigram 分词器需要 ≥3 字符，≤2 字符降级为 LIKE
    const needsLikeFallback = query.trim().replace(/\s+/g, '').length <= 2;

    let rows: Record<string, unknown>[] = [];

    if (needsLikeFallback) {
      const likePattern = `%${query.trim()}%`;
      if (type) {
        const stmt = this.db.prepare(`
          SELECT mf."path", mf."type", mf."mtime", mf."size"
          FROM "memory_files" mf
          JOIN "memory_fts" ON "memory_fts"."path" = mf."path"
          WHERE "memory_fts"."content" LIKE ? AND mf."type" = ?
          ORDER BY length("memory_fts"."content")
          LIMIT ? OFFSET ?
        `);
        rows = stmt.all(likePattern, type, limit, offset) as unknown as Record<string, unknown>[];
      } else {
        const stmt = this.db.prepare(`
          SELECT mf."path", mf."type", mf."mtime", mf."size"
          FROM "memory_files" mf
          JOIN "memory_fts" ON "memory_fts"."path" = mf."path"
          WHERE "memory_fts"."content" LIKE ?
          ORDER BY length("memory_fts"."content")
          LIMIT ? OFFSET ?
        `);
        rows = stmt.all(likePattern, limit, offset) as unknown as Record<string, unknown>[];
      }
      return rows.map(r => ({
        path: r.path as string,
        type: r.type as string,
        rank: 0,
        snippet: '',
        mtime: r.mtime as number,
        size: r.size as number,
      }));
    }

    if (type) {
      const stmt = this.db.prepare(`
        SELECT "memory_fts"."path", "memory_fts"."type", "memory_fts".rank,
               snippet("memory_fts", 1, '<mark>', '</mark>', '…', 48) AS "snippet",
               mf."mtime", mf."size"
        FROM "memory_fts"
        JOIN "memory_files" mf ON mf."path" = "memory_fts"."path"
        WHERE "memory_fts" MATCH ? AND "memory_fts"."type" = ?
        ORDER BY rank
        LIMIT ? OFFSET ?
      `);
      rows = stmt.all(ftsQuery, type, limit, offset) as unknown as Record<string, unknown>[];
    } else {
      const stmt = this.db.prepare(`
        SELECT "memory_fts"."path", "memory_fts"."type", "memory_fts".rank,
               snippet("memory_fts", 1, '<mark>', '</mark>', '…', 48) AS "snippet",
               mf."mtime", mf."size"
        FROM "memory_fts"
        JOIN "memory_files" mf ON mf."path" = "memory_fts"."path"
        WHERE "memory_fts" MATCH ?
        ORDER BY rank
        LIMIT ? OFFSET ?
      `);
      rows = stmt.all(ftsQuery, limit, offset) as unknown as Record<string, unknown>[];
    }
    return rows.map(r => ({
      path: r.path as string,
      type: r.type as string,
      rank: r.rank as number,
      snippet: r.snippet as string,
      mtime: r.mtime as number,
      size: r.size as number,
    }));
  }

  /**
   * 列出索引中的所有文件
   */
  listFiles(type?: MemoryFileMeta['type']): MemoryFileMeta[] {
    if (type) {
      return this.db.prepare(
        'SELECT * FROM "memory_files" WHERE "type"=? ORDER BY "path"'
      ).all(type) as unknown as MemoryFileMeta[];
    }
    return this.db.prepare(
      'SELECT * FROM "memory_files" ORDER BY "path"'
    ).all() as unknown as MemoryFileMeta[];
  }

  // ── 删除 ───────────────────────────────────────────────────

  /**
   * 从索引中删除指定文件
   */
  deleteFile(relPath: string): boolean {
    const m = this.db.prepare('DELETE FROM "memory_files" WHERE "path"=?').run(relPath);
    const f = this.db.prepare('DELETE FROM "memory_fts" WHERE "path"=?').run(relPath);
    return (m.changes as number) > 0 || (f.changes as number) > 0;
  }

  // ── 统计 ───────────────────────────────────────────────────

  getStats(): IndexStats {
    const count = this.db.prepare(
      'SELECT COUNT(*) AS "c" FROM "memory_files"'
    ).get() as { c: number };
    const totalSize = this.db.prepare(
      'SELECT COALESCE(SUM("size"), 0) AS "s" FROM "memory_files"'
    ).get() as { s: number };
    const byType = this.db.prepare(
      'SELECT "type", COUNT(*) AS "c" FROM "memory_files" GROUP BY "type" ORDER BY "c" DESC'
    ).all() as { type: string; c: number }[];

    const typeMap: Record<string, number> = {};
    for (const row of byType) {
      typeMap[row.type] = row.c;
    }

    return {
      totalFiles: count.c,
      totalSize: totalSize.s,
      byType: typeMap,
      lastBuilt: Date.now(),
    };
  }

  // ── 优化 ───────────────────────────────────────────────────

  /**
   * FTS5 索引优化 (重建为最优 B-tree 结构)
   */
  vacuum(): void {
    this.db.exec('INSERT INTO "memory_fts"("memory_fts") VALUES(\'optimize\')');
    // 合并空闲页
    try {
      this.db.exec('INSERT INTO "memory_fts"("memory_fts") VALUES(\'merge\', 16)');
    } catch (_e) {
      // merge 命令在某些情况下可能失败
    }
  }

  /**
   * 清空全部索引数据
   */
  clear(): void {
    this.db.exec('DELETE FROM "memory_files"');
    this.db.exec('DELETE FROM "memory_fts"');
  }

  // ── 扫描工具 ───────────────────────────────────────────────

  private scanDir(dir: string): Map<string, MemoryFileMeta> {
    const result = new Map<string, MemoryFileMeta>();

    const walk = (currentDir: string) => {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const absPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          // 跳过隐藏目录和 node_modules
          if (!entry.name.startsWith('.')) {
            walk(absPath);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name);
          const type = parseFileType(ext);
          if (type !== 'other') {
            const stat = fs.statSync(absPath);
            const relPath = path.relative(dir, absPath);
            const raw = fs.readFileSync(absPath, 'utf-8');
            result.set(relPath, {
              path: relPath,
              mtime: Math.round(stat.mtimeMs),
              size: stat.size,
              type,
              checksum: checksum(raw),
            });
          }
        }
      }
    };

    walk(dir);
    return result;
  }
}

// ═══════════════════════════════════════════════════════════════
// 单例
// ═══════════════════════════════════════════════════════════════

let _instance: MemoryIndex | null = null;

export function getMemoryIndex(dbPath?: string): MemoryIndex {
  if (!_instance) {
    _instance = new MemoryIndex(dbPath);
  }
  return _instance;
}

export function closeMemoryIndex(): void {
  _instance = null;
}
