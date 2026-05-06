import { View, Text, Image } from '@tarojs/components';
import { useState, useMemo } from 'react';

// 手掌特征标注图组件 — 在手掌照片上叠加特征标注点
// 展示关键几何特征位置，作为视觉锚点增强报告可信度

export interface FeatureMarker {
  id: string;
  x: number;       // 相对位置 0-100%
  y: number;
  label: string;
  description: string;
}

interface PalmFeatureMarkerProps {
  imageSrc: string;
  features: FeatureMarker[];
  activeFeatureId?: string;
  onFeatureClick?: (feature: FeatureMarker) => void;
}

const FEATURE_COLORS: Record<string, string> = {
  finger: '#FFD166',
  palm: '#06D6A0',
  line: '#EF476F',
  default: '#FFD166',
};

export default function PalmFeatureMarker({
  imageSrc,
  features,
  activeFeatureId,
  onFeatureClick,
}: PalmFeatureMarkerProps) {
  const [showAll, setShowAll] = useState(true);

  const visibleFeatures = useMemo(() => {
    if (!showAll && activeFeatureId) {
      return features.filter((f) => f.id === activeFeatureId);
    }
    return features;
  }, [showAll, activeFeatureId, features]);

  const getColor = (feature: FeatureMarker) => {
    if (feature.id === activeFeatureId) return '#EF476F';
    if (feature.id.startsWith('finger')) return FEATURE_COLORS.finger;
    if (feature.id.startsWith('line')) return FEATURE_COLORS.line;
    if (feature.id.startsWith('palm')) return FEATURE_COLORS.palm;
    return FEATURE_COLORS.default;
  };

  return (
    <View className="palm-feature-marker">
      <View className="marker-image-container">
        <Image
          className="palm-image"
          src={imageSrc}
          mode="aspectFit"
          lazyLoad
        />
        {visibleFeatures.map((feature) => (
          <View
            key={feature.id}
            className={`feature-dot ${feature.id === activeFeatureId ? 'active' : ''}`}
            style={{
              left: `${feature.x}%`,
              top: `${feature.y}%`,
              backgroundColor: getColor(feature),
              borderColor: feature.id === activeFeatureId ? '#FFFFFF' : 'transparent',
            }}
            onClick={() => onFeatureClick?.(feature)}
          >
            <Text className="dot-label">{feature.label}</Text>
          </View>
        ))}
      </View>
      <View className="legend-row">
        <View className="legend-item">
          <View className="legend-dot" style={{ backgroundColor: FEATURE_COLORS.finger }} />
          <Text className="legend-text">手指特征</Text>
        </View>
        <View className="legend-item">
          <View className="legend-dot" style={{ backgroundColor: FEATURE_COLORS.palm }} />
          <Text className="legend-text">掌型特征</Text>
        </View>
        <View className="legend-item">
          <View className="legend-dot" style={{ backgroundColor: FEATURE_COLORS.line }} />
          <Text className="legend-text">线条特征</Text>
        </View>
        <View className="legend-toggle" onClick={() => setShowAll(!showAll)}>
          <Text className="legend-text">{showAll ? '收起' : '全部'}</Text>
        </View>
      </View>
    </View>
  );
}
