/**
 * PageHeartbeat — H5 页面停留时长可靠追踪
 *
 * 替代简单 enter/leave 事件对，用定时心跳 + visibilitychange 切后台冻结 +
 * pagehide + sendBeacon 卸载前最后一搏，将移动端有效数据率从 ~70% 提升至 ~93%。
 *
 * 基于 student-notebook/ma-heartbeat-research.md 的协议设计。
 */

// ── 类型定义 ──

export interface HeartbeatEvent {
  session_id: string;
  sequence: number;
  state: 'active' | 'background' | 'final';
  /** 累计激活停留时长（毫秒），不包含后台时间 */
  accumulated_ms: number;
  /** 此次会话中所有切后台时间段 */
  background_intervals: Array<{ from: number; to: number | null }>;
  timestamp: number;
  version: '1.0';
  /** 可选：被追踪的容器标识（如 'report_copywriting'） */
  container?: string;
}

export type HeartbeatState = 'idle' | 'active' | 'background' | 'destroyed';

// ── 浏览器 API 抽象（便于测试注入） ──

export interface BrowserHost {
  addEventListener(
    target: 'visibilitychange' | 'pagehide',
    handler: (...args: any[]) => void,
  ): void;
  removeEventListener(target: 'visibilitychange' | 'pagehide'): void;
  isHidden(): boolean;
  sendBeacon(url: string, data: string | null): boolean;
  now(): number;
}

interface PageHideEvent {
  persisted: boolean;
  preventDefault(): void;
}

/** 生产环境 BrowserHost —— 封装浏览器原生 API */
export class RealBrowserHost implements BrowserHost {
  private visibilityHandler: (() => void) | null = null;
  private pagehideHandler: ((e: PageHideEvent) => void) | null = null;

  addEventListener(
    target: 'visibilitychange' | 'pagehide',
    handler: (...args: any[]) => void,
  ): void {
    if (target === 'visibilitychange') {
      this.visibilityHandler = handler as () => void;
      document.addEventListener('visibilitychange', this.visibilityHandler);
    } else {
      this.pagehideHandler = handler as (e: PageHideEvent) => void;
      window.addEventListener('pagehide', this.pagehideHandler);
    }
  }

  removeEventListener(target: 'visibilitychange' | 'pagehide'): void {
    if (target === 'visibilitychange' && this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
    } else if (target === 'pagehide' && this.pagehideHandler) {
      window.removeEventListener('pagehide', this.pagehideHandler);
    }
  }

  isHidden(): boolean {
    return document.hidden;
  }

  sendBeacon(url: string, data: string | null): boolean {
    return navigator.sendBeacon(url, data);
  }

  now(): number {
    return Date.now();
  }
}

// ── 配置 ──

export interface HeartbeatConfig {
  /** 心跳间隔（毫秒），默认 5000 */
  intervalMs: number;
  /** 心跳接收端点 */
  endpoint: string;
  /** 被追踪的容器标识（可选） */
  container?: string;
}

const DEFAULT_CONFIG: HeartbeatConfig = {
  intervalMs: 5000,
  endpoint: '/api/tracking/heartbeat',
};

// ── UUID 生成（无外部依赖） ──

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ── 核心类 ──

export class PageHeartbeat {
  private config: HeartbeatConfig;
  private host: BrowserHost;
  private sessionId: string;
  private state: HeartbeatState = 'idle';
  private sequence = 0;
  private accumulatedMs = 0;
  private lastTick = 0; // 最后一次 tick 的 host.now()
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private backgroundIntervals: Array<{ from: number; to: number | null }> = [];
  private currentBgStart: number | null = null; // 当前切后台时的 accumulated 快照
  private onHeartbeat?: (event: HeartbeatEvent) => void; // 测试/调试回调
  private boundOnVisibility: () => void;
  private boundOnPagehide: (e: PageHideEvent) => void;

  constructor(
    host: BrowserHost = new RealBrowserHost(),
    config: Partial<HeartbeatConfig> = {},
    onHeartbeat?: (event: HeartbeatEvent) => void,
  ) {
    this.host = host;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.sessionId = generateUUID();
    this.onHeartbeat = onHeartbeat;

    this.boundOnVisibility = this.handleVisibilityChange.bind(this);
    this.boundOnPagehide = this.handlePagehide.bind(this);
  }

  // ── 公开 API ──

  /** 启动追踪。调用时机：页面 onShow / 文案区域曝光 */
  init(): void {
    if (this.state !== 'idle') return;
    this.state = 'active';
    this.lastTick = this.host.now();
    this.bindHostEvents();
    this.tick(); // 立即发送 seq=1 心跳
    this.scheduleNextTick();
  }

  /** 暂停计时（用户滚动离开文案区域，但页面仍在） */
  pause(): void {
    if (this.state !== 'active') return;
    this.freezeTimer();
    this.state = 'background';
  }

  /** 恢复计时（用户滚动回文案区域） */
  resume(): void {
    if (this.state !== 'background') return;
    this.state = 'active';
    // 关闭当前后台区间（如果有切后台导致的未关闭区间）
    if (this.currentBgStart !== null) {
      this.backgroundIntervals.push({
        from: this.currentBgStart,
        to: this.accumulatedMs,
      });
      this.currentBgStart = null;
    }
    this.lastTick = this.host.now();
    this.scheduleNextTick();
  }

  /** 正常停止并发送最终数据 */
  flush(): void {
    if (this.state === 'idle' || this.state === 'destroyed') return;
    this.freezeTimer();
    this.sendHeartbeat('final');
    this.state = 'destroyed';
  }

  /** 完全销毁，解绑所有事件 */
  destroy(): void {
    this.freezeTimer();
    this.unbindHostEvents();
    this.state = 'destroyed';
  }

  /** 获取当前状态（测试用） */
  getState(): HeartbeatState {
    return this.state;
  }

  /** 获取累计停留时长（测试用） */
  getAccumulatedMs(): number {
    return this.accumulatedMs;
  }

  /** 获取后台区间（测试用） */
  getBackgroundIntervals(): Array<{ from: number; to: number | null }> {
    return this.backgroundIntervals.map((i) => ({ ...i }));
  }

  /** 获取会话 ID（测试用） */
  getSessionId(): string {
    return this.sessionId;
  }

  // ── 内部方法 ──

  private tick(): void {
    const now = this.host.now();
    const delta = now - this.lastTick;
    this.accumulatedMs += delta;
    this.lastTick = now;
    this.sequence++;
    this.sendHeartbeat('active');
  }

  private scheduleNextTick(): void {
    this.timerId = setTimeout(() => {
      if (this.state === 'active') {
        this.tick();
        this.scheduleNextTick();
      }
    }, this.config.intervalMs);
  }

  private freezeTimer(): void {
    // 计入当前 tick 周期中未上报的 delta
    if (this.lastTick > 0) {
      const delta = this.host.now() - this.lastTick;
      this.accumulatedMs += delta;
      this.lastTick = 0; // 标记计时器已冻结
    }
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  private sendHeartbeat(state: 'active' | 'background' | 'final'): void {
    const event: HeartbeatEvent = {
      session_id: this.sessionId,
      sequence: this.sequence,
      state,
      accumulated_ms: Math.round(this.accumulatedMs),
      background_intervals: this.backgroundIntervals.map((i) => ({ ...i })),
      timestamp: this.host.now(),
      version: '1.0',
      container: this.config.container,
    };

    this.onHeartbeat?.(event);

    if (state === 'final') {
      // 最终心跳：sendBeacon 不等待响应（传 string，Blob 也可但测试解析成本高）
      this.host.sendBeacon(
        this.config.endpoint,
        JSON.stringify(event),
      );
    } else {
      // 常规心跳：fetch + keepalive 确保短时间内的可靠性
      fetch(this.config.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
        keepalive: true,
      }).catch(() => {
        /* 静默——心跳丢失不影响用户体验 */
      });
    }
  }

  // ── 浏览器事件处理 ──

  private handleVisibilityChange(): void {
    if (this.state === 'destroyed') return;

    if (this.host.isHidden()) {
      // 切后台
      if (this.state === 'active') {
        this.freezeTimer();
        this.state = 'background';
        this.currentBgStart = this.accumulatedMs;
        // 切后台后不依赖 setTimeout——sendBeacon 发最后一次心跳
      }
      // 切后台时发一次 background 心跳（不阻塞，因为可能即将被挂起）
      this.sendHeartbeat('background');
    } else {
      // 回前台
      if (this.state === 'background') {
        if (this.currentBgStart !== null) {
          this.backgroundIntervals.push({
            from: this.currentBgStart,
            to: this.accumulatedMs,
          });
          this.currentBgStart = null;
        }
        this.state = 'active';
        this.lastTick = this.host.now();
        this.scheduleNextTick();
      }
    }
  }

  private handlePagehide(_e: PageHideEvent): void {
    if (this.state === 'idle' || this.state === 'destroyed') return;
    this.freezeTimer();
    this.sendHeartbeat('final');
    this.state = 'destroyed';
  }

  private bindHostEvents(): void {
    this.host.addEventListener('visibilitychange', this.boundOnVisibility);
    this.host.addEventListener('pagehide', this.boundOnPagehide);
  }

  private unbindHostEvents(): void {
    this.host.removeEventListener('visibilitychange');
    this.host.removeEventListener('pagehide');
  }
}
