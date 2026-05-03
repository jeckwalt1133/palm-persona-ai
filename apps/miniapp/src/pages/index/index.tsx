import { View, Text, Button } from '@tarojs/components';
import './index.scss';

export default function IndexPage() {
  return (
    <View className="home-page">
      <View className="home-hero">
        <Text className="home-title">掌心人格局</Text>
        <Text className="home-subtitle">拍一张手掌，看看 AI 读出了怎样的你</Text>
      </View>

      <View className="home-disclaimer">
        <Text className="disclaimer-text">
          本产品为 AI 趣味分析工具，结果仅供娱乐和自我探索，不构成医学、法律、投资、婚恋或人生决策建议。
        </Text>
      </View>

      <Button className="home-btn">开始分析</Button>
    </View>
  );
}
