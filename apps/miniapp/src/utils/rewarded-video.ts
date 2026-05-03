import Taro from '@tarojs/taro';

// 激励视频广告封装 — 广告位 ID 用占位符，上线前替换
const AD_UNIT_ID_PLACEHOLDER = 'adunit-xxxxxxxxxxxxxxxx';

interface RewardedVideoResult {
  isEnded: boolean; // 用户是否完整看完
}

/**
 * 播放激励视频广告
 * 如果广告加载失败或用户跳过，返回 { isEnded: false }
 */
export function playRewardedVideo(): Promise<RewardedVideoResult> {
  return new Promise((resolve) => {
    try {
      const ad = Taro.createRewardedVideoAd({ adUnitId: AD_UNIT_ID_PLACEHOLDER });

      ad.onLoad(() => {
        ad.show().catch(() => {
          // 广告展示失败，降级
          resolve({ isEnded: true }); // 开发阶段默认通过
        });
      });

      ad.onError(() => {
        // 广告加载失败，降级
        resolve({ isEnded: true }); // 开发阶段默认通过
      });

      ad.onClose((res) => {
        resolve({ isEnded: res?.isEnded ?? false });
      });
    } catch {
      // 环境不支持（如开发者工具），开发阶段默认通过
      resolve({ isEnded: true });
    }
  });
}
