import { View, Text, Canvas } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState, useCallback } from 'react';
import './index.scss';

// 辅助标点页 — 引导用户标注手掌关键特征点
export default function PointsMarking() {
  const [markedPoints, setMarkedPoints] = useState<Array<{ x: number; y: number; label: string }>>([]);

  const handleCanvasTouch = useCallback((e: { detail: { x: number; y: number } }) => {
    const { x, y } = e.detail;
    if (markedPoints.length >= 7) return;
    const labels = ['指尖1', '指尖2', '指尖3', '指尖4', '掌心', '手腕', '拇指根'];
    const label = labels[markedPoints.length];
    setMarkedPoints((prev) => [...prev, { x, y, label }]);
  }, [markedPoints]);

  const handleReset = useCallback(() => {
    setMarkedPoints([]);
  }, []);

  const handleConfirm = useCallback(() => {
    if (markedPoints.length < 7) {
      Taro.showToast({ title: '请标注全部7个关键点', icon: 'none' });
      return;
    }
    Taro.showToast({ title: '标注完成，正在分析...', icon: 'success' });
    // Phase 8: 将标点数据传入分析引擎
    const eventChannel = Taro.getCurrentInstance().page?.getOpenerEventChannel?.();
    eventChannel?.emit?.('pointsMarked', { points: markedPoints });
    Taro.navigateBack();
  }, [markedPoints]);

  return (
    <View className="points-marking-page">
      <Text className="guide-text">请按提示依次点击手掌关键位置</Text>
      <View className="canvas-wrapper">
        <Canvas
          className="marking-canvas"
          canvasId="palmCanvas"
          onTouchEnd={handleCanvasTouch}
          disableScroll
        />
        {markedPoints.map((p, i) => (
          <View
            key={i}
            className="marker-dot"
            style={{ left: `${p.x}px`, top: `${p.y}px` }}
          >
            <Text className="marker-label">{p.label}</Text>
          </View>
        ))}
      </View>
      <View className="button-row">
        <View className="btn-reset" onClick={handleReset}>
          <Text>重新标注</Text>
        </View>
        <View className="btn-confirm" onClick={handleConfirm}>
          <Text>确认提交</Text>
        </View>
      </View>
    </View>
  );
}
