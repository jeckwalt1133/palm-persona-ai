/**
 * 暗色/亮色双主题引擎测试 — LIVE-W5-001
 *
 * 验证: 主题解析/存储/应用/DOM操作/系统监听/切换逻辑
 * 修复: 使用 Taro 存储 mock 替代 localStorage mock (B1)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Mock Taro 跨平台存储 ──────────────────────

const taroStore: Record<string, string> = {};

vi.mock('@tarojs/taro', () => ({
  default: {
    getStorageSync: vi.fn((key: string) => {
      return taroStore[key];
    }),
    setStorageSync: vi.fn((key: string, value: string) => {
      taroStore[key] = value;
    }),
    setNavigationBarColor: vi.fn(),
  },
}));

// ─── Mock DOM 环境 ─────────────────────────────

const docElAttrs: Record<string, string> = {};
const pageAttrs: Record<string, string>[] = [{}, {}];

const pageEls = pageAttrs.map(attrs => ({
  setAttribute: vi.fn((k: string, v: string) => { attrs[k] = v; }),
  attrs,
}));

const docMock = {
  documentElement: {
    setAttribute: vi.fn((k: string, v: string) => { docElAttrs[k] = v; }),
    style: {
      setProperty: vi.fn(),
    },
  },
  querySelectorAll: vi.fn(() => pageEls),
};

Object.defineProperty(globalThis, 'document', { value: docMock, writable: true });

// ─── Mock matchMedia ────────────────────────────

const listeners = new Set<(e: { matches: boolean }) => void>();

const mqlMock = {
  matches: false,
  addEventListener: vi.fn((_ev: string, fn: any) => { listeners.add(fn); }),
  removeEventListener: vi.fn((_ev: string, fn: any) => { listeners.delete(fn); }),
};

Object.defineProperty(globalThis, 'window', {
  value: {
    matchMedia: vi.fn(() => mqlMock),
  },
  writable: true,
});

// ─── 导入被测模块 ──────────────────────────────

import {
  getStoredTheme,
  storeTheme,
  systemPrefersDark,
  applyTheme,
  resolveTheme,
  toggleTheme,
  setTheme,
  initTheme,
  getCurrentTheme,
  getResolvedTheme,
  type Theme,
} from './dark-mode';

beforeEach(() => {
  Object.keys(taroStore).forEach(k => delete taroStore[k]);
  docElAttrs['data-theme'] = '';
  pageAttrs.forEach(a => a['data-theme'] = '');
  listeners.clear();
  mqlMock.matches = false;
  setTheme('auto');
});

// ─── 1. 存储与读取 ──────────────────────────

describe('getStoredTheme / storeTheme', () => {
  it('默认返回 auto', () => {
    expect(getStoredTheme()).toBe('auto');
  });

  it('存储并读取 dark', () => {
    storeTheme('dark');
    expect(getStoredTheme()).toBe('dark');
  });

  it('存储并读取 light', () => {
    storeTheme('light');
    expect(getStoredTheme()).toBe('light');
  });

  it('非法值返回 auto', () => {
    taroStore['palm-theme-preference'] = 'invalid';
    expect(getStoredTheme()).toBe('auto');
  });
});

// ─── 2. 系统偏好检测 ────────────────────────

describe('systemPrefersDark', () => {
  it('matchMedia 为 false 时返回 false', () => {
    mqlMock.matches = false;
    expect(systemPrefersDark()).toBe(false);
  });

  it('matchMedia 为 true 时返回 true', () => {
    mqlMock.matches = true;
    expect(systemPrefersDark()).toBe(true);
  });
});

// ─── 3. 主题解析 ────────────────────────────

describe('resolveTheme', () => {
  it('auto + 系统暗色 → dark', () => {
    mqlMock.matches = true;
    expect(resolveTheme('auto')).toBe('dark');
  });

  it('auto + 系统亮色 → light', () => {
    mqlMock.matches = false;
    expect(resolveTheme('auto')).toBe('light');
  });

  it('dark 直接返回 dark (不受系统影响)', () => {
    mqlMock.matches = false;
    expect(resolveTheme('dark')).toBe('dark');
  });

  it('light 直接返回 light (不受系统影响)', () => {
    mqlMock.matches = true;
    expect(resolveTheme('light')).toBe('light');
  });
});

// ─── 4. DOM 应用 ─────────────────────────────

describe('applyTheme', () => {
  it('在 documentElement 上设置 data-theme', () => {
    applyTheme('dark');
    expect(docElAttrs['data-theme']).toBe('dark');
  });

  it('在 page 元素上设置 data-theme', () => {
    applyTheme('light');
    pageAttrs.forEach(a => {
      expect(a['data-theme']).toBe('light');
    });
  });

  it('设置 navbar 颜色变量', () => {
    applyTheme('dark');
    expect(docMock.documentElement.style.setProperty).toHaveBeenCalledWith('--nav-bar-bg', '#1B1035');
    applyTheme('light');
    expect(docMock.documentElement.style.setProperty).toHaveBeenCalledWith('--nav-bar-bg', '#F5F0FF');
  });
});

// ─── 5. 切换逻辑 ─────────────────────────────

describe('toggleTheme', () => {
  it('dark → light', () => {
    setTheme('dark');
    const next = toggleTheme();
    expect(next).toBe('light');
    expect(getCurrentTheme()).toBe('light');
  });

  it('light → dark', () => {
    setTheme('light');
    const next = toggleTheme();
    expect(next).toBe('dark');
    expect(getCurrentTheme()).toBe('dark');
  });

  it('auto(系统暗色) → light', () => {
    mqlMock.matches = true;
    setTheme('auto');
    const next = toggleTheme();
    expect(next).toBe('light');
  });

  it('切换后 DOM 更新', () => {
    setTheme('dark');
    toggleTheme(); // → light
    expect(docElAttrs['data-theme']).toBe('light');
  });
});

// ─── 6. 生命周期 ──────────────────────────────

describe('initTheme / cleanup', () => {
  it('返回清理函数', () => {
    storeTheme('dark');
    const cleanup = initTheme();
    expect(typeof cleanup).toBe('function');
    expect(docElAttrs['data-theme']).toBe('dark');
  });

  it('清理函数可安全调用', () => {
    storeTheme('dark');
    const cleanup = initTheme();
    expect(() => cleanup()).not.toThrow();
  });

  it('auto 模式下系统切换触发 DOM 更新', () => {
    storeTheme('auto');
    mqlMock.matches = false;
    initTheme();

    mqlMock.matches = true;
    listeners.forEach(fn => fn({ matches: true }));
    expect(docElAttrs['data-theme']).toBe('dark');
  });

  it('手动模式下系统切换不触发 DOM 更新', () => {
    storeTheme('dark');
    mqlMock.matches = false;
    initTheme();
    expect(docElAttrs['data-theme']).toBe('dark');

    mqlMock.matches = true;
    listeners.forEach(fn => fn({ matches: true }));
    expect(docElAttrs['data-theme']).toBe('dark');
  });
});

// ─── 7. 状态查询 ─────────────────────────────

describe('getCurrentTheme / getResolvedTheme', () => {
  it('getCurrentTheme 返回原始值', () => {
    setTheme('auto');
    expect(getCurrentTheme()).toBe('auto');
  });

  it('getResolvedTheme 返回解析值', () => {
    mqlMock.matches = true;
    setTheme('auto');
    expect(getResolvedTheme()).toBe('dark');
  });

  it('手动 dark 时两者一致', () => {
    setTheme('dark');
    expect(getCurrentTheme()).toBe('dark');
    expect(getResolvedTheme()).toBe('dark');
  });
});
