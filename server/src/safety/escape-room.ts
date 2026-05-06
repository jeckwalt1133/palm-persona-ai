/**
 * 逃生门 — 误报白名单恢复机制
 *
 * 当合规门禁拦截了非违规内容时，管理员可将误报词加入白名单。
 * ContentSafety.check() 命中白名单词时跳过违规判定。
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../..');

const DEFAULT_PATH = path.join(PROJECT_ROOT, 'memory/safety/escape-room.json');

export class EscapeRoom {
  private terms: Set<string>;
  private filePath: string;

  constructor(filePath?: string) {
    this.filePath = filePath ?? DEFAULT_PATH;
    this.terms = new Set();
    this.load();
  }

  check(term: string): boolean {
    return this.terms.has(term);
  }

  add(term: string): boolean {
    if (this.terms.has(term)) return false;
    this.terms.add(term);
    this.save();
    return true;
  }

  remove(term: string): boolean {
    const deleted = this.terms.delete(term);
    if (deleted) this.save();
    return deleted;
  }

  list(): string[] {
    return [...this.terms].sort();
  }

  count(): number {
    return this.terms.size;
  }

  private load(): void {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
        if (Array.isArray(data)) {
          for (const term of data) {
            if (typeof term === 'string') this.terms.add(term);
          }
        }
      }
    } catch {
      // 文件缺失或损坏时以空集合启动
    }
  }

  private save(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(this.list(), null, 2) + '\n');
    } catch (err) {
      console.warn('[EscapeRoom] 写入失败:', (err as Error).message);
    }
  }
}

export const defaultEscapeRoom = new EscapeRoom();
