import { View } from '@tarojs/components';
import './SkeletonScreen.scss';

type SkeletonVariant = 'text' | 'title' | 'circle' | 'rect' | 'card';

interface SkeletonProps {
  variant?: SkeletonVariant;
  width?: string;    // 如 '100%', '200rpx', '48rpx'
  height?: string;
  borderRadius?: string;
  animated?: boolean;
}

const variantDefaults: Record<SkeletonVariant, { height: string; borderRadius: string }> = {
  text:    { height: '26rpx', borderRadius: '8rpx' },
  title:   { height: '36rpx', borderRadius: '10rpx' },
  circle:  { height: '96rpx', borderRadius: '50%' },
  rect:    { height: '200rpx', borderRadius: '16rpx' },
  card:    { height: '320rpx', borderRadius: '20rpx' },
};

export default function SkeletonScreen({
  variant = 'text',
  width = '100%',
  height,
  borderRadius,
  animated = true,
}: SkeletonProps) {
  const defaults = variantDefaults[variant];
  const h = height || defaults.height;
  const br = borderRadius || (variant === 'circle' ? '50%' : defaults.borderRadius);

  return (
    <View
      className={`skeleton-block ${animated ? 'skeleton-animated' : ''}`}
      style={{
        width,
        height: h,
        borderRadius: br,
      }}
    />
  );
}

/* 组合骨架屏: 报告卡片加载态 */
export function ReportCardSkeleton() {
  return (
    <View className="skeleton-report-card">
      {/* 标签 */}
      <View className="skeleton-report-header">
        <SkeletonScreen variant="text" width="160rpx" height="40rpx" borderRadius="24rpx" />
      </View>
      {/* 核心真相 */}
      <SkeletonScreen variant="rect" width="100%" height="120rpx" borderRadius="16rpx" />
      {/* 名人匹配 */}
      <SkeletonScreen variant="text" width="70%" />
      <SkeletonScreen variant="text" width="85%" />
      <SkeletonScreen variant="text" width="60%" />
      {/* 维度得分 */}
      <View style={{ display: 'flex', flexDirection: 'column', gap: '20rpx', marginTop: '16rpx' }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={{ display: 'flex', alignItems: 'center', gap: '16rpx' }}>
            <SkeletonScreen variant="text" width="120rpx" />
            <SkeletonScreen variant="text" width={`${100 - i * 12}%`} height="20rpx" borderRadius="10rpx" />
          </View>
        ))}
      </View>
    </View>
  );
}

/* 组合骨架屏: 首页预览卡片加载态 */
export function IndexCardSkeleton() {
  return (
    <View className="skeleton-index-cards">
      {[1, 2, 3].map((i) => (
        <View key={i} className="skeleton-index-row">
          <SkeletonScreen variant="circle" width="48rpx" height="48rpx" />
          <View style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10rpx' }}>
            <SkeletonScreen variant="title" width="65%" />
            <SkeletonScreen variant="text" width="90%" />
          </View>
        </View>
      ))}
    </View>
  );
}

/* 组合骨架屏: 分享落地页加载态 */
export function ShareLandingSkeleton() {
  return (
    <View className="skeleton-share-landing">
      {/* 品牌区 */}
      <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8rpx', padding: '48rpx 0 24rpx' }}>
        <SkeletonScreen variant="title" width="200rpx" />
        <SkeletonScreen variant="text" width="140rpx" />
      </View>
      {/* 卡片 */}
      <SkeletonScreen variant="card" width="100%" height="180rpx" />
      {/* 预览 */}
      <SkeletonScreen variant="rect" width="100%" height="240rpx" borderRadius="20rpx" />
      {/* CTA */}
      <SkeletonScreen variant="rect" width="100%" height="120rpx" borderRadius="24rpx" />
      {/* 社交证明 */}
      <View style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4rpx', padding: '20rpx' }}>
        <SkeletonScreen variant="title" width="120rpx" />
        <SkeletonScreen variant="text" width="200rpx" />
      </View>
    </View>
  );
}
