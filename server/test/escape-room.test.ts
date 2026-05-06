import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EscapeRoom } from '../src/safety/escape-room.js';
import { ContentSafety } from '../src/safety/content-safety.js';
import fs from 'fs';
import os from 'os';
import path from 'path';

function tmpPath(): string {
  return path.join(os.tmpdir(), `escape-room-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
}

describe('EscapeRoom', () => {
  let filePath: string;
  let room: EscapeRoom;

  beforeEach(() => {
    filePath = tmpPath();
    room = new EscapeRoom(filePath);
  });

  afterEach(() => {
    try { fs.unlinkSync(filePath); } catch { /* 清理临时文件 */ }
  });

  it('add() 添加词并持久化', () => {
    expect(room.add('算命')).toBe(true);
    expect(room.check('算命')).toBe(true);
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(raw).toContain('算命');
  });

  it('add() 对重复词返回 false', () => {
    room.add('算命');
    expect(room.add('算命')).toBe(false);
  });

  it('remove() 删除词并持久化', () => {
    room.add('算命');
    expect(room.remove('算命')).toBe(true);
    expect(room.check('算命')).toBe(false);
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(raw).not.toContain('算命');
  });

  it('remove() 对不存在词返回 false', () => {
    expect(room.remove('不存在')).toBe(false);
  });

  it('check() 白名单词返回 true，其他返回 false', () => {
    room.add('占卜');
    expect(room.check('占卜')).toBe(true);
    expect(room.check('算命')).toBe(false);
  });

  it('list() 返回排序后的数组', () => {
    room.add('占卜');
    room.add('掌纹');
    room.add('算命');
    expect(room.list()).toEqual(['占卜', '掌纹', '算命']);
  });

  it('count() 正确计数', () => {
    expect(room.count()).toBe(0);
    room.add('算命');
    room.add('占卜');
    expect(room.count()).toBe(2);
    room.remove('算命');
    expect(room.count()).toBe(1);
  });

  it('从已存在的 JSON 文件恢复', () => {
    fs.writeFileSync(filePath, '["算命","占卜"]');
    const r = new EscapeRoom(filePath);
    expect(r.check('算命')).toBe(true);
    expect(r.check('占卜')).toBe(true);
    expect(r.count()).toBe(2);
  });

  it('缺失文件时以空集合启动', () => {
    const r = new EscapeRoom('/nonexistent/path.json');
    expect(r.count()).toBe(0);
    expect(r.list()).toHaveLength(0);
  });

  it('损坏 JSON 以空集合启动', () => {
    fs.writeFileSync(filePath, 'not json at all');
    const r = new EscapeRoom(filePath);
    expect(r.count()).toBe(0);
  });

  it('ContentSafety.check() 跳过白名单词违规', () => {
    room.add('算命');
    const safety = new ContentSafety(true, room);
    const result = safety.check('这是算命的内容');
    expect(result.safe).toBe(true);
    expect(result.violations).not.toContain('算命');
  });

  it('ContentSafety.check() 仍然检测非白名单词', () => {
    room.add('算命');
    const safety = new ContentSafety(true, room);
    const result = safety.check('这是占卜的内容');
    expect(result.safe).toBe(false);
    expect(result.violations).toContain('占卜');
  });

  it('结构化攻击不被白名单豁免', () => {
    room.add('零宽字符');
    const safety = new ContentSafety(true, room);
    const result = safety.check('正常文本​隐藏字符');
    expect(result.safe).toBe(false);
    expect(result.violations).toContain('检测到零宽字符攻击');
  });
});
