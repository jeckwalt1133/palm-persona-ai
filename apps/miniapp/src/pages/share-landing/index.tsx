import { View, Text } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import { useState } from 'react';
import { apiUrl } from '../../utils/api';
import { track, EventType } from '../../utils/analytics';
import { ShareLandingSkeleton } from '../../components/SkeletonScreen';
import './index.scss';

interface SharedReport {
  personaLabel: string;
  personaType: string;
  quote: string;
  coreTruth: string;
  keywordLabels?: string[];
}

// 12人格的接住文案——接收方看到的预热内容
const TEASER_BY_TYPE: Record<string, { hook: string; bridge: string }> = {
  'starry-dreamer': { hook: '一个浪漫而敏感的人刚分享了ta的手掌密码', bridge: 'ta的想象力让周围的世界都变轻了' },
  'silent-guardian': { hook: '一个沉默而可靠的人刚分享了ta的手掌密码', bridge: 'ta话不多，但行动永远比承诺先到' },
  'flame-explorer': { hook: '一个充满能量的人刚分享了ta的手掌密码', bridge: 'ta的好奇心让你也想走出舒适区' },
  'deep-thinker': { hook: '一个想得很深的人刚分享了ta的手掌密码', bridge: 'ta的脑子里有一个你还没见过的世界' },
  'gentle-healer': { hook: '一个温柔到骨子里的人刚分享了ta的手掌密码', bridge: 'ta让身边每个人都觉得自己被理解了' },
  'sharp-pioneer': { hook: '一个行动力爆表的人刚分享了ta的手掌密码', bridge: 'ta想到就做，做了再说——这种速度感很迷人' },
  'moon-artist': { hook: '一个灵魂里有颜料的人刚分享了ta的手掌密码', bridge: 'ta看到的世界比别人多了一层颜色' },
  'bridge-builder': { hook: '一个让所有人都感到舒服的人刚分享了ta的手掌密码', bridge: 'ta总能把不同的人拉到一起' },
  'quiet-mountain': { hook: '一个安静但有分量的人刚分享了ta的手掌密码', bridge: 'ta的存在本身就是一种稳定的力量' },
  'sunshine-spark': { hook: '一个像小太阳一样的人刚分享了ta的手掌密码', bridge: 'ta笑着面对生活的方式会传染给你' },
  'wind-wanderer': { hook: '一个自由随风的人刚分享了ta的手掌密码', bridge: 'ta不受框住的生活方式让很多人羡慕' },
  'root-keeper': { hook: '一个把家放在心上的人刚分享了ta的手掌密码', bridge: 'ta守护的东西不多，但每一样都很认真' },
};

export default function ShareLandingPage() {
  const [report, setReport] = useState<SharedReport | null>(null);
  const [loading, setLoading] = useState(true);

  useLoad((options) => {
    const rid = options?.rid ?? '';
    const ref = options?.ref ?? '';

    // 归因追踪: 记录分享来源
    track(EventType.SHARE_LANDING, { rid, ref, channel: 'miniapp' });

    if (!rid) {
      setLoading(false);
      Taro.showToast({ title: '链接不完整，直接去首页看看吧', icon: 'none' });
      setTimeout(() => Taro.reLaunch({ url: '/pages/index/index?from=share-expired' }), 1500);
      return;
    }

    // 获取分享报告只读数据
    Taro.request<SharedReport>({
      url: `${apiUrl}/api/report/shared/${rid}`,
      method: 'GET',
    }).then((res) => {
      setReport(res.data);
      setLoading(false);
    }).catch(() => {
      // 接口未就绪时使用本地文案兜底
      setReport(null);
      setLoading(false);
    });
  });

  const teaser = report?.personaType ? TEASER_BY_TYPE[report.personaType] : null;

  const goToCapture = () => {
    track(EventType.SHARE_CONVERT, {
      rid: report?.personaType ?? 'unknown',
      channel: 'share-landing',
    });
    Taro.navigateTo({ url: '/pages/capture/index?from=share-landing' });
  };

  if (loading) {
    return (
      <View className="share-landing-page">
        <ShareLandingSkeleton />
      </View>
    );
  }

  return (
    <View className="share-landing-page">
      {/* 品牌顶栏 */}
      <View className="sl-brand">
        <Text className="sl-brand-name">掌心人格局</Text>
        <Text className="sl-brand-sub">AI Personality Lab</Text>
      </View>

      {/* 主体内容 */}
      <View className="sl-body">
        {/* 分享者身份揭示 */}
        {teaser && (
          <View className="sl-teaser-card">
            <Text className="sl-teaser-pre">你的朋友刚刚分享了ta的手掌密码</Text>
            <View className="sl-teaser-divider" />
            <Text className="sl-teaser-hook">{teaser.hook}</Text>
            <Text className="sl-teaser-bridge">{teaser.bridge}</Text>
          </View>
        )}

        {/* 报告只读预览 */}
        {report ? (
          <View className="sl-report-preview">
            <View className="sl-badge">
              <Text className="sl-badge-label">「{report.personaLabel}」</Text>
            </View>
            {report.coreTruth && (
              <View className="sl-truth-card">
                <Text className="sl-truth-icon">"</Text>
                <Text className="sl-truth-text">{report.coreTruth}</Text>
              </View>
            )}
            {report.quote && (
              <Text className="sl-quote">"{report.quote}"</Text>
            )}
            {report.keywordLabels && report.keywordLabels.length > 0 && (
              <View className="sl-keywords">
                {report.keywordLabels.map((kw, i) => (
                  <Text key={i} className="sl-kw-tag">{kw}</Text>
                ))}
              </View>
            )}
          </View>
        ) : (
          /* 兜底: 接口未就绪时 */
          <View className="sl-report-preview">
            <Text className="sl-fallback-text">
              你的朋友通过AI手掌分析发现了自己的人格密码——ta觉得你可能也会感兴趣。
            </Text>
            <Text className="sl-fallback-sub">
              每个人的手掌线条都是独一无二的，AI从这些线条里读出了连本人都没说过的事。
            </Text>
          </View>
        )}

        {/* CTA */}
        <View className="sl-cta-card">
          <Text className="sl-cta-title">
            {report
              ? '想知道AI能从你的手掌里读到什么吗？'
              : '你的手掌也在等着说出那些你没说过的事'}
          </Text>
          <Text className="sl-cta-desc">
            30秒拍一张手掌照片，AI会生成你的专属人格报告。和你朋友的结果对比一下——看看你们是不是同一种人。
          </Text>
          <View className="sl-cta-btn" onClick={goToCapture}>
            <Text className="sl-cta-btn-text">免费拍一张，看看AI怎么说你</Text>
          </View>
        </View>

        {/* 社交证明 */}
        <View className="sl-social-proof">
          <Text className="sl-proof-num">128,634</Text>
          <Text className="sl-proof-label">人已经通过手掌了解了自己</Text>
        </View>
      </View>

      {/* 底部 */}
      <View className="sl-footer">
        <Text className="sl-footer-text">AI 趣味解读 · 认真但不较真</Text>
      </View>
    </View>
  );
}
