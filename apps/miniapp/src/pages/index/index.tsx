import { View, Text } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import { useState, useEffect } from 'react';
import { getResolvedTheme, toggleTheme } from '../../theme/dark-mode';
import { track, EventType } from '../../utils/analytics';
import './index.scss';

const ONBOARDING_SHOWN_KEY = 'palm_onboarding_shown';
const SHARE_REF_KEY = 'palm_share_ref';

interface OnboardingStep {
  step: number;
  title: string;
  lines: string[];
  cta: string;
}

// 3步Onboarding文案 — 来自 V7-W5-012 设计
const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    step: 1,
    title: '伸出手掌，对着镜头',
    lines: [
      '就像在看自己的手纹一样自然。',
      '不需要摆姿势，不需要调角度，手掌张开就行。',
      'AI 会从你的掌心线条里读到一些你从没说过的事。',
    ],
    cta: '知道了，下一步',
  },
  {
    step: 2,
    title: '这些线条每个人都不一样',
    lines: [
      '正在读取你的掌心——AI 看到了几条关键纹路。',
      '别急，AI 正在把它们拼成你的故事。',
      '快了——你第一次看到的结果，往往是最准的那一次。',
    ],
    cta: '然后呢？',
  },
  {
    step: 3,
    title: '比聊天更接近真实的你',
    lines: [
      'AI 读到的这几行字，可能比你跟朋友说了一晚上的话还准。',
      '这只是你人格的一个切面——下次再测，可能会看到不一样的自己。',
      '如果你想到了某个人——发给ta。有些话AI替你说出来了。',
    ],
    cta: '开始拍手掌',
  },
];

export default function IndexPage() {
  const [onboardingStep, setOnboardingStep] = useState(0); // 0=不显示, 1/2/3=步骤
  const [onboardingVisible, setOnboardingVisible] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(getResolvedTheme());
  const [invitedBy, setInvitedBy] = useState<string | null>(null); // P0-1: 分享归因

  // P0-1: 检测分享入口参数
  useLoad((options) => {
    const from = options?.from ?? '';
    const ref = options?.ref ?? '';
    const rid = options?.rid ?? '';

    if (from === 'share' || from === 'timeline') {
      track(EventType.SHARE_ENTRY, { from, ref, rid, channel: 'miniapp' });
      if (ref) {
        setInvitedBy(ref);
        try { localStorage?.setItem(SHARE_REF_KEY, ref); } catch { /* noop */ }
      }
    }
  });

  useEffect(() => {
    try {
      const shown = localStorage?.getItem(ONBOARDING_SHOWN_KEY);
      if (!shown) {
        setOnboardingVisible(true);
        setOnboardingStep(1);
      }
    } catch { /* H5 only */ }
  }, []);

  const handleNext = () => {
    if (onboardingStep < 3) {
      setOnboardingStep((s) => s + 1);
    } else {
      // 最后一步：关闭弹窗，记录已展示
      try { localStorage?.setItem(ONBOARDING_SHOWN_KEY, '1'); } catch { /* noop */ }
      setOnboardingVisible(false);
      setOnboardingStep(0);
    }
  };

  const handleSkip = () => {
    try { localStorage?.setItem(ONBOARDING_SHOWN_KEY, '1'); } catch { /* noop */ }
    setOnboardingVisible(false);
    setOnboardingStep(0);
  };

  const goToCapture = () => {
    Taro.navigateTo({ url: '/pages/capture/index' });
  };

  const handleToggleTheme = () => {
    const next = toggleTheme();
    setTheme(next as 'dark' | 'light');
  };

  const currentStep = ONBOARDING_STEPS[onboardingStep - 1];

  return (
    <View className="home-page">
      {/* ══════ 首次用户Onboarding弹窗 ══════ */}
      {onboardingVisible && currentStep && (
        <View className="onboarding-overlay">
          <View className="onboarding-modal">
            {/* 步骤指示器 */}
            <View className="onboarding-steps">
              {[1, 2, 3].map((s) => (
                <View
                  key={s}
                  className={`onboarding-step-dot ${s === onboardingStep ? 'step-active' : ''} ${s < onboardingStep ? 'step-done' : ''}`}
                >
                  <Text>{s < onboardingStep ? '✓' : String(s)}</Text>
                </View>
              ))}
            </View>

            {/* 内容 */}
            <View className="onboarding-body">
              <Text className="onboarding-step-label">第{currentStep.step}步</Text>
              <Text className="onboarding-title">{currentStep.title}</Text>
              {currentStep.lines.map((line, i) => (
                <Text key={i} className="onboarding-line">{line}</Text>
              ))}
            </View>

            {/* 按钮 */}
            <View className="onboarding-actions">
              <View className="onboarding-btn-primary" onClick={handleNext}>
                <Text>{currentStep.cta}</Text>
              </View>
              <View className="onboarding-btn-skip" onClick={handleSkip}>
                <Text>跳过引导，直接开始</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Hero */}
      <View className="home-hero">
        <View className="theme-toggle" onClick={handleToggleTheme}>
          <Text className="theme-toggle-icon">{theme === 'dark' ? '☀' : '☾'}</Text>
          <Text className="theme-toggle-label">{theme === 'dark' ? '亮色' : '暗色'}</Text>
        </View>
        <Text className="home-title">掌心人格局</Text>
        <Text className="home-slogan">了解自己，是一种很酷的事</Text>
        <Text className="home-subtitle">
          拍一张手掌，AI 会告诉你掌心线条里藏着怎样的你
        </Text>
      </View>

      {/* P0-1: 好友邀请提示 */}
      {invitedBy && (
        <View className="invited-banner">
          <View className="invited-icon-wrap">
            <Text className="invited-icon">@</Text>
          </View>
          <View className="invited-body">
            <Text className="invited-title">你的朋友已经在这里发现了自己</Text>
            <Text className="invited-desc">ta觉得你可能会感兴趣——拍一张手掌，看看你们的频率是不是同一个频道</Text>
          </View>
          <View className="invited-close" onClick={() => setInvitedBy(null)}>
            <Text>×</Text>
          </View>
        </View>
      )}

      {/* 社交证明 */}
      <View className="home-social-proof">
        <Text className="social-proof-num">128,634</Text>
        <Text className="social-proof-label">人已经通过手掌了解了自己</Text>
      </View>

      {/* 报告预览卡片 */}
      <View className="home-preview-section">
        <Text className="preview-section-title">拍一张手掌，你会得到</Text>

        <View className="preview-card">
          <View className="preview-card-icon">
            <Text className="preview-icon-text">1</Text>
          </View>
          <View className="preview-card-body">
            <Text className="preview-card-title">你的专属人格标签</Text>
            <Text className="preview-card-desc">
              像"锐意开拓者·行动派型"这样让你想截图发朋友圈的身份卡
            </Text>
          </View>
        </View>

        <View className="preview-card">
          <View className="preview-card-icon">
            <Text className="preview-icon-text">2</Text>
          </View>
          <View className="preview-card-body">
            <Text className="preview-card-title">一句戳中你的核心真相</Text>
            <Text className="preview-card-desc">
              AI 从你的掌纹中找出那句你最想发给某个人的话
            </Text>
          </View>
        </View>

        <View className="preview-card">
          <View className="preview-card-icon">
            <Text className="preview-icon-text">3</Text>
          </View>
          <View className="preview-card-body">
            <Text className="preview-card-title">你最容易被误解的地方</Text>
            <Text className="preview-card-desc">
              那些别人看不到的、只有你自己知道的另一面
            </Text>
          </View>
        </View>
      </View>

      {/* CTA */}
      <View className="home-cta" onClick={goToCapture}>
        <Text className="home-cta-text">免费拍一张，看看 AI 怎么说你</Text>
      </View>

      {/* 免责声明 */}
      <View className="home-disclaimer">
        <Text className="disclaimer-text">
          AI 趣味解读 · 认真但不较真。照片仅用于本次分析，用完即删。
        </Text>
      </View>
    </View>
  );
}
