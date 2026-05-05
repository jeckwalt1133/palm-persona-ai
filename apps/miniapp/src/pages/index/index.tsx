import { View, Text } from '@tarojs/components';
import Taro from '@tarojs/taro';
import './index.scss';

export default function IndexPage() {
  const goToCapture = () => {
    Taro.navigateTo({ url: '/pages/capture/index' });
  };

  return (
    <View className="home-page">
      {/* Hero */}
      <View className="home-hero">
        <Text className="home-title">掌心人格局</Text>
        <Text className="home-slogan">了解自己，是一种很酷的事</Text>
        <Text className="home-subtitle">
          拍一张手掌，AI 会告诉你掌心线条里藏着怎样的你
        </Text>
      </View>

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
