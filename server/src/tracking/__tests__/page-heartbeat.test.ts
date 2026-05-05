import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  PageHeartbeat,
  BrowserHost,
  HeartbeatEvent,
} from '../page-heartbeat.js';

// ── 测试用 Mock BrowserHost ──

class MockBrowserHost implements BrowserHost {
  private visibilityHandler: (() => void) | null = null;
  private pagehideHandler: ((e: { persisted: boolean }) => void) | null = null;
  private _hidden = false;
  private _now = 1000000; // 模拟时间戳起点
  public beaconCalls: Array<{ url: string; data: string }> = [];

  addEventListener(
    target: 'visibilitychange' | 'pagehide',
    handler: (...args: any[]) => void,
  ): void {
    if (target === 'visibilitychange') {
      this.visibilityHandler = handler as () => void;
    } else {
      this.pagehideHandler = handler as (e: { persisted: boolean }) => void;
    }
  }

  removeEventListener(target: 'visibilitychange' | 'pagehide'): void {
    if (target === 'visibilitychange') {
      this.visibilityHandler = null;
    } else {
      this.pagehideHandler = null;
    }
  }

  isHidden(): boolean {
    return this._hidden;
  }

  sendBeacon(url: string, data: BodyInit | null): boolean {
    this.beaconCalls.push({ url, data: typeof data === 'string' ? data : '' });
    return true;
  }

  now(): number {
    return this._now;
  }

  // ── 测试辅助方法 ──

  /** 模拟时间前进 */
  advanceTime(ms: number): void {
    this._now += ms;
  }

  /** 模拟切后台 */
  hide(): void {
    this._hidden = true;
    this.visibilityHandler?.();
  }

  /** 模拟回前台 */
  show(): void {
    this._hidden = false;
    this.visibilityHandler?.();
  }

  /** 模拟页面关闭 */
  pagehide(): void {
    this.pagehideHandler?.({ persisted: false });
  }
}

// ── 帮助函数：推进计时器 ──

function advanceTimers(ms: number): void {
  vi.advanceTimersByTime(ms);
}

// ── 测试 ──

describe('PageHeartbeat', () => {
  let host: MockBrowserHost;
  let events: HeartbeatEvent[];

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    host = new MockBrowserHost();
    events = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function createTracker(
    config: Partial<import('../page-heartbeat.js').HeartbeatConfig> = {},
  ): PageHeartbeat {
    return new PageHeartbeat(host, config, (e) => events.push(e));
  }

  // ── 1. 基本生命周期 ──

  describe('基本生命周期', () => {
    it('初始状态为 idle', () => {
      const t = createTracker();
      expect(t.getState()).toBe('idle');
      expect(t.getAccumulatedMs()).toBe(0);
    });

    it('init() 后状态变为 active 且发送 seq=1 心跳', () => {
      const t = createTracker();
      t.init();
      expect(t.getState()).toBe('active');
      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0].sequence).toBe(1);
      expect(events[0].state).toBe('active');
    });

    it('flush() 后状态变为 destroyed', () => {
      const t = createTracker();
      t.init();
      t.flush();
      expect(t.getState()).toBe('destroyed');
    });

    it('destroy() 后状态变为 destroyed', () => {
      const t = createTracker();
      t.init();
      t.destroy();
      expect(t.getState()).toBe('destroyed');
    });
  });

  // ── 2. 心跳时序 ──

  describe('心跳时序', () => {
    it('每 5 秒发送一次心跳', () => {
      const t = createTracker({ intervalMs: 5000 });
      t.init();
      const initialCount = events.length;

      host.advanceTime(5000);
      advanceTimers(5000);

      expect(events.length).toBeGreaterThanOrEqual(initialCount + 1);
      const last = events[events.length - 1];
      expect(last.accumulated_ms).toBeGreaterThanOrEqual(5000);
    });

    it('3 次心跳后 accumulated_ms 约 15 秒', () => {
      const t = createTracker({ intervalMs: 5000 });
      t.init();

      for (let i = 0; i < 3; i++) {
        host.advanceTime(5000);
        advanceTimers(5000);
      }

      const last = events[events.length - 1];
      expect(last.accumulated_ms).toBeGreaterThanOrEqual(14000);
      expect(last.accumulated_ms).toBeLessThanOrEqual(16000);
    });
  });

  // ── 3. 切后台 / 回前台 ──

  describe('切后台 / 回前台', () => {
    it('切后台期间时间不累计', () => {
      const t = createTracker({ intervalMs: 5000 });
      t.init();

      // 先运行 5 秒
      host.advanceTime(5000);
      advanceTimers(5000);
      const beforeHide = t.getAccumulatedMs();

      // 切后台
      host.hide();
      expect(t.getState()).toBe('background');

      // 后台期间时间前进 30 秒
      host.advanceTime(30000);

      // accumulated 不应增长
      expect(t.getAccumulatedMs()).toBe(beforeHide);

      // 回前台
      host.show();
      expect(t.getState()).toBe('active');

      // 回前台后再运行 5 秒
      host.advanceTime(5000);
      advanceTimers(5000);

      // accumulated 应该只有前台时间（~10秒，不是40秒）
      const total = t.getAccumulatedMs();
      expect(total).toBeGreaterThanOrEqual(9000);
      expect(total).toBeLessThanOrEqual(11000);
    });

    it('切后台时发送 background 状态心跳', () => {
      const t = createTracker({ intervalMs: 5000 });
      t.init();
      events = []; // 清空 init 心跳

      host.hide();

      const bgEvent = events.find((e) => e.state === 'background');
      expect(bgEvent).toBeDefined();
    });

    it('记录后台区间', () => {
      const t = createTracker({ intervalMs: 5000 });
      t.init();

      host.hide();
      host.advanceTime(20000); // 后台 20 秒
      host.show();

      const intervals = t.getBackgroundIntervals();
      expect(intervals.length).toBe(1);
      expect(intervals[0].from).toBeDefined();
      expect(intervals[0].to).toBeDefined();
      // 后台期间 from ≈ to（因为 accumulated 没增长）
      expect(intervals[0].to! - intervals[0].from).toBeLessThanOrEqual(100);
    });

    it('多次切后台累积多个区间', () => {
      const t = createTracker({ intervalMs: 5000 });
      t.init();

      // 第一次切后台
      host.hide();
      host.show();
      // 第二次切后台
      host.advanceTime(5000);
      advanceTimers(5000);
      host.hide();
      host.show();

      const intervals = t.getBackgroundIntervals();
      expect(intervals.length).toBe(2);
    });
  });

  // ── 4. sendBeacon ──

  describe('页面关闭 sendBeacon', () => {
    it('flush() 时调用 sendBeacon', () => {
      const t = createTracker();
      t.init();
      t.flush();

      expect(host.beaconCalls.length).toBe(1);
      const beaconData = JSON.parse(host.beaconCalls[0].data);
      expect(beaconData.state).toBe('final');
      expect(beaconData.version).toBe('1.0');
    });

    it('pagehide 事件触发 sendBeacon', () => {
      const t = createTracker();
      t.init();
      host.pagehide();

      const finalBeacon = host.beaconCalls.find((c) => {
        const d = JSON.parse(c.data);
        return d.state === 'final';
      });
      expect(finalBeacon).toBeDefined();
    });

    it('destroy() 不调用 sendBeacon（仅解绑事件）', () => {
      const t = createTracker();
      t.init();
      const beforeBeacon = host.beaconCalls.length;
      t.destroy();

      // destroy 不发送 beacon，flush 才发送
      expect(host.beaconCalls.length).toBe(beforeBeacon);
    });

    it('destroy 后 pagehide 不再触发 sendBeacon', () => {
      const t = createTracker();
      t.init();
      t.destroy();
      const beforeBeacon = host.beaconCalls.length;

      host.pagehide();
      expect(host.beaconCalls.length).toBe(beforeBeacon);
    });
  });

  // ── 5. pause / resume（滚动离开/回来） ──

  describe('pause / resume', () => {
    it('pause() 冻结计时，resume() 恢复', () => {
      const t = createTracker({ intervalMs: 5000 });
      t.init();

      // 运行 5s
      host.advanceTime(5000);
      advanceTimers(5000);
      const beforePause = t.getAccumulatedMs();

      t.pause();
      expect(t.getState()).toBe('background');

      // 暂停期间时间前进
      host.advanceTime(20000);
      advanceTimers(20000);
      expect(t.getAccumulatedMs()).toBe(beforePause);

      t.resume();
      expect(t.getState()).toBe('active');

      // 恢复后运行
      host.advanceTime(5000);
      advanceTimers(5000);

      expect(t.getAccumulatedMs()).toBeGreaterThan(beforePause);
    });

    it('idle 状态下 pause/resume 无效', () => {
      const t = createTracker();
      t.pause();
      expect(t.getState()).toBe('idle');
      t.resume();
      expect(t.getState()).toBe('idle');
    });
  });

  // ── 6. 边界情况 ──

  describe('边界情况', () => {
    it('重复 init() 不重复绑定事件', () => {
      const t = createTracker();
      t.init();
      t.init(); // 应被忽略
      expect(t.getState()).toBe('active');
    });

    it('flush() 后再次 flush() 不重复发送', () => {
      const t = createTracker();
      t.init();
      t.flush();
      const beaconCount = host.beaconCalls.length;
      t.flush(); // 应被忽略
      expect(host.beaconCalls.length).toBe(beaconCount);
    });

    it('未 init 就 flush 不发送 beacon', () => {
      const t = createTracker();
      t.flush();
      expect(host.beaconCalls.length).toBe(0);
    });

    it('session_id 唯一', () => {
      const t1 = createTracker();
      const t2 = createTracker();
      t1.init();
      t2.init();
      expect(t1.getSessionId()).not.toBe(t2.getSessionId());
    });

    it('最终心跳 accumulated_ms > 0（正常浏览）', () => {
      const t = createTracker({ intervalMs: 5000 });
      t.init();

      host.advanceTime(15000);
      advanceTimers(15000);

      t.flush();
      const beaconData = JSON.parse(
        host.beaconCalls[host.beaconCalls.length - 1].data,
      );
      expect(beaconData.accumulated_ms).toBeGreaterThan(0);
    });

    it('container 字段透传到心跳事件', () => {
      const t = createTracker({ container: 'report_copywriting' });
      t.init();
      t.flush();
      const beaconData = JSON.parse(host.beaconCalls[0].data);
      expect(beaconData.container).toBe('report_copywriting');
    });
  });

  // ── 7. 数据一致性 ──

  describe('数据一致性', () => {
    it('background_intervals 深拷贝不共享引用', () => {
      const t = createTracker({ intervalMs: 5000 });
      t.init();
      host.hide();
      host.show();

      const intervals1 = t.getBackgroundIntervals();
      intervals1[0].from = 999999; // 修改返回的副本

      const intervals2 = t.getBackgroundIntervals();
      expect(intervals2[0].from).not.toBe(999999);
    });

    it('sequential 心跳的 accumulated_ms 单调递增', () => {
      const t = createTracker({ intervalMs: 5000 });
      t.init();

      const recorded: number[] = [];
      const tracker = new PageHeartbeat(host, { intervalMs: 5000 }, (e) => {
        recorded.push(e.accumulated_ms);
      });
      tracker.init();

      host.advanceTime(5000);
      advanceTimers(5000);
      host.advanceTime(5000);
      advanceTimers(5000);

      for (let i = 1; i < recorded.length; i++) {
        expect(recorded[i]).toBeGreaterThanOrEqual(recorded[i - 1]);
      }
    });
  });
});
