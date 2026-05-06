/**
 * 暗色/亮色双主题引擎 — LIVE-W5-001
 *
 * 基于 CSS 变量实现主题切换，跟随系统 prefers-color-scheme 自动切换。
 * 手动切换后不再跟随系统（用户偏好优先），存储到 localStorage。
 */

const STORAGE_KEY = 'palm-theme-preference';

export type Theme = 'dark' | 'light' | 'auto';

let currentTheme: Theme = 'auto';
let systemDarkQuery: MediaQueryList | null = null;

/** 获取 localStorage 存储的主题偏好 */
export function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light' || stored === 'auto') return stored;
  } catch { /* localStorage 不可用 */ }
  return 'auto';
}

/** 存储主题偏好 */
export function storeTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch { /* ignored */ }
}

/** 检测系统是否偏好暗色 */
export function systemPrefersDark(): boolean {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
}

/** 应用主题到 DOM (设置 data-theme 属性) */
export function applyTheme(resolved: 'dark' | 'light'): void {
  if (typeof document === 'undefined') return;

  // 在 <html> 和 <page> 上都设置属性（兼容 Taro 多端渲染）
  document.documentElement.setAttribute('data-theme', resolved);

  // Taro 小程序的 page 容器
  const pages = document.querySelectorAll('page');
  pages.forEach(p => p.setAttribute('data-theme', resolved));

  // 微信小程序 navigation bar 背景色
  // 暗色: #1B1035 / 亮色: #F5F0FF
  const navBg = resolved === 'dark' ? '#1B1035' : '#F5F0FF';
  const navText = resolved === 'dark' ? '#ffffff' : '#1B1035';
  document.documentElement.style.setProperty('--nav-bar-bg', navBg);
  document.documentElement.style.setProperty('--nav-bar-text', navText);
}

/** 解析 auto → 实际主题 */
export function resolveTheme(theme: Theme): 'dark' | 'light' {
  if (theme === 'auto') return systemPrefersDark() ? 'dark' : 'light';
  return theme;
}

/** 切换主题 (dark → light → dark) */
export function toggleTheme(): Theme {
  const resolved = resolveTheme(currentTheme);
  const next: Theme = resolved === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

/** 设置主题并生效 */
export function setTheme(theme: Theme): void {
  currentTheme = theme;
  storeTheme(theme);
  applyTheme(resolveTheme(theme));
}

/** 初始化主题引擎 — 在 app.onLaunch 中调用 */
export function initTheme(): () => void {
  currentTheme = getStoredTheme();
  applyTheme(resolveTheme(currentTheme));

  // 监听系统主题变化（仅在 auto 模式下生效）
  if (typeof window !== 'undefined' && window.matchMedia) {
    systemDarkQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const listener = (e: MediaQueryListEvent) => {
      if (currentTheme === 'auto') {
        applyTheme(e.matches ? 'dark' : 'light');
      }
    };

    // 兼容不同浏览器的监听方式
    if (systemDarkQuery.addEventListener) {
      systemDarkQuery.addEventListener('change', listener);
    } else {
      // @ts-ignore 兼容旧 API
      systemDarkQuery.addListener(listener);
    }

    return () => {
      if (systemDarkQuery) {
        if (systemDarkQuery.removeEventListener) {
          systemDarkQuery.removeEventListener('change', listener);
        } else {
          // @ts-ignore
          systemDarkQuery.removeListener(listener);
        }
      }
    };
  }

  return () => {};
}

/** 获取当前主题状态 */
export function getCurrentTheme(): Theme {
  return currentTheme;
}

/** 获取当前解析后的实际主题 */
export function getResolvedTheme(): 'dark' | 'light' {
  return resolveTheme(currentTheme);
}
