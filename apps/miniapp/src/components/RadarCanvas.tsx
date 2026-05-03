import { View, Canvas } from '@tarojs/components';
import { useEffect, useRef } from 'react';
import Taro from '@tarojs/taro';
import './RadarCanvas.scss';

export interface RadarScore {
  label: string;
  score: number; // 0-100
}

interface RadarCanvasProps {
  scores?: RadarScore[];
  size?: number; // rpx
}

const DEFAULT_SCORES: RadarScore[] = [
  { label: '情绪频率', score: 0 },
  { label: '沟通同步', score: 0 },
  { label: '行动互补', score: 0 },
  { label: '信任潜力', score: 0 },
  { label: '摩擦风险', score: 0 },
];

function drawRadar(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  scores: RadarScore[],
) {
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(cx, cy) * 0.65;
  const n = scores.length;
  const angles = Array.from({ length: n }, (_, i) => (2 * Math.PI * i) / n - Math.PI / 2);

  // 5 concentric grid pentagons
  for (let lv = 1; lv <= 5; lv++) {
    const rr = (r * lv) / 5;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = cx + rr * Math.cos(angles[i]);
      const y = cy + rr * Math.sin(angles[i]);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = lv === 5 ? 'rgba(255,209,102,0.25)' : 'rgba(255,209,102,0.1)';
    ctx.lineWidth = lv === 5 ? 1.5 : 1;
    ctx.stroke();
  }

  // axes from center
  for (let i = 0; i < n; i++) {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + r * Math.cos(angles[i]), cy + r * Math.sin(angles[i]));
    ctx.strokeStyle = 'rgba(255,209,102,0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // data polygon
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const rr = (r * Math.max(0, Math.min(100, scores[i].score))) / 100;
    const x = cx + rr * Math.cos(angles[i]);
    const y = cy + rr * Math.sin(angles[i]);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();

  ctx.fillStyle = 'rgba(255,209,102,0.12)';
  ctx.fill();

  ctx.strokeStyle = '#FFD166';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // vertex glow dots + score labels
  const scoreFontSize = Math.round(w / 22);
  ctx.font = `bold ${scoreFontSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < n; i++) {
    const rr = (r * Math.max(0, Math.min(100, scores[i].score))) / 100;
    const x = cx + rr * Math.cos(angles[i]);
    const y = cy + rr * Math.sin(angles[i]);

    ctx.beginPath();
    ctx.arc(x, y, 5, 0, 2 * Math.PI);
    ctx.fillStyle = '#FFD166';
    ctx.shadowColor = 'rgba(255,209,102,0.6)';
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;

    // score value above the dot
    ctx.fillStyle = '#FFD166';
    ctx.fillText(String(scores[i].score), x, y - scoreFontSize - 8);
  }

  // dimension labels around the perimeter
  const labelFontSize = Math.round(w / 26);
  ctx.font = `${labelFontSize}px sans-serif`;

  for (let i = 0; i < n; i++) {
    const lr = r * 1.18;
    const lx = cx + lr * Math.cos(angles[i]);
    const ly = cy + lr * Math.sin(angles[i]);

    const cosA = Math.cos(angles[i]);
    const sinA = Math.sin(angles[i]);

    ctx.textAlign = cosA > 0.05 ? 'left' : cosA < -0.05 ? 'right' : 'center';
    ctx.textBaseline = sinA > 0.05 ? 'top' : sinA < -0.05 ? 'bottom' : 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(scores[i].label, lx, ly);
  }
}

export default function RadarCanvas({ scores = DEFAULT_SCORES, size = 580 }: RadarCanvasProps) {
  const canvasId = useRef(`radar_${Math.random().toString(36).slice(2, 8)}`).current;

  useEffect(() => {
    let sysInfo: Taro.getSystemInfoSync.Result;
    try {
      sysInfo = Taro.getSystemInfoSync();
    } catch {
      return;
    }
    const dpr = sysInfo.pixelRatio;

    Taro.nextTick(() => {
      const query = Taro.createSelectorQuery();
      query
        .select(`#${canvasId}`)
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res || !res[0]) return;
          const { node: canvas, width: cssW, height: cssH } = res[0] as {
            node: HTMLCanvasElement;
            width: number;
            height: number;
          };
          if (!canvas) return;

          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          canvas.width = Math.ceil(cssW * dpr);
          canvas.height = Math.ceil(cssH * dpr);
          ctx.scale(dpr, dpr);

          drawRadar(ctx, cssW, cssH, scores);
        });
    });
  }, [scores, canvasId]);

  return (
    <View className="radar-wrapper">
      <Canvas
        type="2d"
        id={canvasId}
        canvasId={canvasId}
        className="radar-canvas"
        style={{ width: `${size}rpx`, height: `${size}rpx` }}
      />
    </View>
  );
}
