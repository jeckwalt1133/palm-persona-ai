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
 *
 * 降级策略：
 *   1. 占位广告位 → 模拟播放完成，避免 Taro API 挂死
 *   2. 真机/生产 → 走真实广告流程（含 30s 超时保护）
 */
export function playRewardedVideo(): Promise<RewardedVideoResult> {
  const isPlaceholder = AD_UNIT_ID_PLACEHOLDER === 'adunit-xxxxxxxxxxxxxxxx';

  // 占位广告位 → 降级通过，不调起广告
  if (isPlaceholder) {
    return Promise.resolve({ isEnded: true });
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({ isEnded: true });
    }, 30000); // 30s 超时保护

    try {
      const ad = Taro.createRewardedVideoAd({ adUnitId: AD_UNIT_ID_PLACEHOLDER });

      ad.onLoad(() => {
        ad.show().catch(() => {
          resolve({ isEnded: true });
        });
      });

      ad.onError((err) => {
        console.warn('[rewarded-video] 广告加载失败:', err);
        clearTimeout(timeout);
        resolve({ isEnded: true });
      });

      ad.onClose((res) => {
        clearTimeout(timeout);
        resolve({ isEnded: res?.isEnded ?? false });
      });
    } catch (err) {
      clearTimeout(timeout);
      console.warn('[rewarded-video] 广告创建失败:', err);
      resolve({ isEnded: true });
    }
  });
}
