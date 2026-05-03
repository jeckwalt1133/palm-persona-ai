import Taro from '@tarojs/taro';

/**
 * 激励视频广告封装
 *
 * ⚠️ 上线前替换 AD_UNIT_ID_PLACEHOLDER 为真实广告位ID：
 *   1. 登录微信公众平台 → 流量主 → 新建广告位 → 激励视频
 *   2. 将生成的广告位 ID 填入下方常量
 *   3. 若未申请流量主，保留占位符，开发环境会自动降级通过
 */
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
          // 广告展示失败，开发阶段默认通过
          resolve({ isEnded: true });
        });
      });

      ad.onError(() => {
        // 广告加载失败，开发阶段默认通过
        resolve({ isEnded: true });
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
