import Taro from '@tarojs/taro';

/**
 * 激励视频广告封装
 *
 * ⚠️ 上线前替换 AD_UNIT_ID_PLACEHOLDER 为真实广告位ID：
 *   1. 登录微信公众平台 → 流量主 → 新建广告位 → 激励视频
 *   2. 将生成的广告位 ID 填入下方常量
 */
const AD_UNIT_ID_PLACEHOLDER = 'adunit-xxxxxxxxxxxxxxxx';

interface RewardedVideoResult {
  isEnded: boolean;
}

/**
 * 播放激励视频广告
 * 开发环境（占位广告位）自动降级通过，不调起广告。
 */
export function playRewardedVideo(): Promise<RewardedVideoResult> {
  // 开发环境：占位广告位直接降级，避免 onLoad/onError 永不触发导致 Promise 挂死
  if (AD_UNIT_ID_PLACEHOLDER === 'adunit-xxxxxxxxxxxxxxxx') {
    return Promise.resolve({ isEnded: true });
  }

  return new Promise((resolve) => {
    try {
      const ad = Taro.createRewardedVideoAd({ adUnitId: AD_UNIT_ID_PLACEHOLDER });

      ad.onLoad(() => {
        ad.show().catch(() => {
          resolve({ isEnded: true });
        });
      });

      ad.onError(() => {
        resolve({ isEnded: true });
      });

      ad.onClose((res) => {
        resolve({ isEnded: res?.isEnded ?? false });
      });
    } catch {
      resolve({ isEnded: true });
    }
  });
}
