// 全链路埋点 — 用户行为事件追踪
// 小程序端通过 Taro.request 发送，服务端 /api/analytics 消费

import Taro from '@tarojs/taro';

type Platform = 'weapp' | 'tt';

interface AnalyticsEvent {
  event: string;
  userId: string;
  timestamp: string;
  platform: Platform;
  properties?: Record<string, string | number | boolean>;
}

// 埋点事件类型枚举
export const EventType = {
  PAGE_VIEW: 'page_view',
  UPLOAD_PHOTO: 'upload_photo',
  REPORT_GENERATE: 'report_generate',
  SHARE_CLICK: 'share_click',
  SHARE_LANDING: 'share_landing',
  SHARE_ENTRY: 'share_entry',
  SHARE_CONVERT: 'share_convert',
  MATCH_INVITE: 'match_invite',
  MATCH_JOIN: 'match_join',
  FEEDBACK_SUBMIT: 'feedback_submit',
  RESHARE_FROM_FRIEND: 'reshare_from_friend',
} as const;

const ANALYTICS_ENDPOINT = '/api/analytics';
const BATCH_SIZE = 10;
const DEBUG = false;

// 本地事件队列（避免频繁网络请求）
const eventQueue: AnalyticsEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function getUserId(): string {
  try {
    const stored = Taro.getStorageSync('palm_user_id');
    if (stored && typeof stored === 'string') return stored;
  } catch { /* 静默 */ }
  return 'unknown';
}

function getPlatform(): Platform {
  try {
    const systemInfo = Taro.getSystemInfoSync();
    return systemInfo.platform === 'tt' ? 'tt' : 'weapp';
  } catch { return 'weapp'; }
}

function sendBatch(events: AnalyticsEvent[]): void {
  if (events.length === 0) return;
  Taro.request({
    url: ANALYTICS_ENDPOINT,
    method: 'POST',
    header: { 'content-type': 'application/json' },
    data: { events },
    success: () => { /* 静默 */ },
    fail: () => { /* 失败丢弃，避免积压 */ },
  });
}

function flush(): void {
  if (eventQueue.length === 0) return;
  const batch = eventQueue.splice(0, BATCH_SIZE);
  sendBatch(batch);
  if (eventQueue.length > 0) {
    setTimeout(flush, 500);
  }
}

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, 3000);
}

// 公共 API：记录事件
export function track(
  event: string,
  properties?: Record<string, string | number | boolean>,
): void {
  const evt: AnalyticsEvent = {
    event,
    userId: getUserId(),
    timestamp: new Date().toISOString(),
    platform: getPlatform(),
    properties,
  };

  eventQueue.push(evt);
  scheduleFlush();

  // 关键事件立即发送
  if (event === EventType.REPORT_GENERATE || event === EventType.SHARE_CLICK) {
    flush();
    return;
  }

  // 开发环境打印日志
  if (DEBUG) {
    console.log('[Analytics]', evt.event, evt.properties);
  }
}

// 页面浏览快捷方法
export function trackPageView(pageName: string): void {
  track(EventType.PAGE_VIEW, { page: pageName });
}

// 手动刷新（页面隐藏/卸载时调用）
export function flushAnalytics(): void {
  flush();
}
