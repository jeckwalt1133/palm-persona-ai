/**
 * H5 页面停留时长的 PageHeartbeat 追踪器
 *
 * 仅在 H5 环境激活（weapp/tt 使用小程序原生生命周期）。
 * 使用 document.visibilitychange + window.pagehide + sendBeacon。
 *
 * 用法:
 *   import { startPageTracking, stopPageTracking } from '@/utils/heartbeat';
 *   // 页面曝光时
 *   const tracker = startPageTracking('report_page');
 *   // 页面离开时
 *   stopPageTracking(tracker);
 */

// ── 类型 ──

interface HeartbeatEvent {
  session_id: string;
  sequence: number;
  state: 'active' | 'background' | 'final';
  accumulated_ms: number;
  background_intervals: Array<{ from: number; to: number | null }>;
  timestamp: number;
  version: '1.0';
  container?: string;
}

export interface TrackerHandle {
  sessionId: string;
  pause: () => void;
  resume: () => void;
  flush: () => void;
}

// ── 配置 ──

const INTERVAL_MS = 5000;
const ENDPOINT = '/api/tracking/heartbeat';

// ── UUID ──

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ── 心跳发送 ──

function send(event: HeartbeatEvent, isFinal: boolean): void {
  if (isFinal) {
    navigator.sendBeacon(ENDPOINT, JSON.stringify(event));
  } else {
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
      keepalive: true,
    }).catch(() => {
      /* 静默 */
    });
  }
}

// ── 页面级追踪器 ──

export function startPageTracking(container?: string): TrackerHandle | null {
  // 仅 H5 环境生效
  if (typeof document === 'undefined' || typeof window === 'undefined') return null;

  const sessionId = uuid();
  let sequence = 0;
  let accumMs = 0;
  let lastTick = Date.now();
  let timerId: ReturnType<typeof setTimeout> | null = null;
  let bgIntervals: Array<{ from: number; to: number | null }> = [];
  let bgStart: number | null = null;
  let active = true;

  function tick(): void {
    if (!active) return;
    const now = Date.now();
    accumMs += now - lastTick;
    lastTick = now;
    sequence++;
    send(
      {
        session_id: sessionId,
        sequence,
        state: 'active',
        accumulated_ms: Math.round(accumMs),
        background_intervals: bgIntervals.map((i) => ({ ...i })),
        timestamp: now,
        version: '1.0',
        container,
      },
      false,
    );
  }

  function schedule(): void {
    timerId = setTimeout(() => {
      tick();
      schedule();
    }, INTERVAL_MS);
  }

  function freeze(): void {
    if (lastTick > 0) {
      accumMs += Date.now() - lastTick;
      lastTick = 0;
    }
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  }

  function onVisibilityChange(): void {
    if (document.hidden) {
      // → 后台
      freeze();
      active = false;
      bgStart = accumMs;
      // 发一次 background 心跳
      sequence++;
      send(
        {
          session_id: sessionId,
          sequence,
          state: 'background',
          accumulated_ms: Math.round(accumMs),
          background_intervals: bgIntervals.map((i) => ({ ...i })),
          timestamp: Date.now(),
          version: '1.0',
          container,
        },
        false,
      );
    } else {
      // → 前台
      if (bgStart !== null) {
        bgIntervals.push({ from: bgStart, to: accumMs });
        bgStart = null;
      }
      active = true;
      lastTick = Date.now();
      schedule();
    }
  }

  function onPageHide(): void {
    freeze();
    active = false;
    sequence++;
    send(
      {
        session_id: sessionId,
        sequence,
        state: 'final',
        accumulated_ms: Math.round(accumMs),
        background_intervals: bgIntervals.map((i) => ({ ...i })),
        timestamp: Date.now(),
        version: '1.0',
        container,
      },
      true, // sendBeacon
    );
  }

  // ── 绑定浏览器事件 ──

  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', onPageHide);

  // ── 启动 ──

  tick(); // 立即发送 seq=1
  schedule();

  // ── 返回句柄 ──

  return {
    sessionId,
    pause: () => {
      if (!active) return;
      freeze();
      active = false;
    },
    resume: () => {
      if (active) return;
      if (bgStart !== null) {
        bgIntervals.push({ from: bgStart, to: accumMs });
        bgStart = null;
      }
      active = true;
      lastTick = Date.now();
      schedule();
    },
    flush: () => {
      freeze();
      active = false;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onPageHide);
      sequence++;
      send(
        {
          session_id: sessionId,
          sequence,
          state: 'final',
          accumulated_ms: Math.round(accumMs),
          background_intervals: bgIntervals.map((i) => ({ ...i })),
          timestamp: Date.now(),
          version: '1.0',
          container,
        },
        true,
      );
    },
  };
}

export function stopPageTracking(handle: TrackerHandle | null): void {
  handle?.flush();
}
