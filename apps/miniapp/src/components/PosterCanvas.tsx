import { View, Canvas } from '@tarojs/components';
import { useEffect, useRef } from 'react';
import Taro from '@tarojs/taro';
import { wrapText, truncateText } from '../utils/textWrap';
import { getMostMisunderstood, getCardTitle, type ScoreItem } from '../utils/reportUtils';
import { safeText } from '../utils/shareCopy';
import type { MatchedShareCopy } from '../utils/shareCopy';
import './PosterCanvas.scss';

// ══════ 类型 ══════

interface VisualAnchorsData {
  opening: string;
  widthLabel: string;
  fingerLabel: string;
  clarityLabel: string;
  lineCountLabel: string;
  prominentMount?: string;
  widthPercentile: string;
  clarityPercentile: string;
  lineCountPercentile: string;
  fingerPercentile: string;
}

interface CelebrityMatch {
  name: string;
  title: string;
  reason: string;
}

interface RelationshipCode {
  frequencyLabel: string;
  signalPattern: string;
  bestMatchType: string;
  tensionPoint: string;
}

interface ReportData {
  personaType: string;
  personaLabel: string;
  scores: ScoreItem[];
  coreTruth: string;
  quote: string;
  weeklyAdvice: string;
  keywords: string[];
  insights: string[];
  visualAnchors?: VisualAnchorsData;
  identityBadge?: string;
  relationshipCode?: RelationshipCode;
  celebrityMatches?: CelebrityMatch[];
}

interface PosterCanvasProps {
  report: ReportData;
  cardIndex: 1 | 2 | 3 | 4 | 5 | 6;
  shareCopy: MatchedShareCopy;
  canvasId: string;
  width?: number;
  height?: number;
}

// ══════ 颜色常量 ══════

const BG = '#1B1035';
const GOLD = '#FFD166';
const GOLD_DIM = 'rgba(255,209,102,0.15)';
const PINK = '#EF476F';
const CYAN = '#06D6A0';
const WHITE = '#ffffff';
const WHITE_DIM = 'rgba(255,255,255,0.6)';
const WHITE_FAINT = 'rgba(255,255,255,0.2)';

// ══════ 绘制函数 ══════

function drawBg(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, w, h);
}

// 顶部装饰线
function drawTopDecoration(ctx: CanvasRenderingContext2D, w: number) {
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(60, 40);
  ctx.lineTo(w - 60, 40);
  ctx.stroke();

  ctx.strokeStyle = PINK;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(60, 50);
  ctx.lineTo(w / 2 - 40, 50);
  ctx.stroke();

  ctx.strokeStyle = CYAN;
  ctx.beginPath();
  ctx.moveTo(w / 2 + 40, 50);
  ctx.lineTo(w - 60, 50);
  ctx.stroke();
}

// 人格标签
function drawPersonaLabel(ctx: CanvasRenderingContext2D, w: number, label: string) {
  const fontSize = 44;
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = GOLD;

  const text = `你是「${safeText(label)}」`;
  const display = truncateText(ctx, text, w - 120);
  ctx.fillText(display, w / 2, 100);
}

// 身份徽章
function drawIdentityBadge(ctx: CanvasRenderingContext2D, w: number, badge?: string) {
  if (!badge) return;
  const fontSize = 24;
  ctx.font = `${fontSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillStyle = CYAN;
  ctx.fillText(safeText(badge), w / 2, 160);
}

// 卡片标题
function drawCardTitle(ctx: CanvasRenderingContext2D, _w: number, cardIndex: number) {
  const title = getCardTitle(cardIndex);
  const fontSize = 28;
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.fillStyle = WHITE;
  ctx.fillText(title, 60, 220);
}

// 分隔线
function drawDivider(ctx: CanvasRenderingContext2D, w: number, y: number) {
  ctx.strokeStyle = GOLD_DIM;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(60, y);
  ctx.lineTo(w - 60, y);
  ctx.stroke();
}

// 底部文案 + 免责声明
function drawFooter(ctx: CanvasRenderingContext2D, w: number, h: number, shareText: string) {
  const dividerY = h - 280;
  drawDivider(ctx, w, dividerY);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  // 分享文案
  const shareFontSize = 24;
  ctx.font = `${shareFontSize}px sans-serif`;
  ctx.fillStyle = WHITE_DIM;
  const lines = wrapText(ctx, safeText(shareText), w - 120, 4);
  lines.forEach((line, i) => {
    ctx.fillText(line, w / 2, dividerY + 20 + i * (shareFontSize + 8));
  });

  // 免责声明
  const disclaimerY = h - 100;
  const discFontSize = 18;
  ctx.font = `${discFontSize}px sans-serif`;
  ctx.fillStyle = WHITE_FAINT;
  ctx.fillText('趣味语境下的AI人格分析 · 仅供娱乐参考', w / 2, disclaimerY);

  // Slogan
  ctx.fillText('掌心人格局 · 拍一张手掌，看看AI读出了怎样的你', w / 2, disclaimerY + 24);
}

// ══════ 6 种卡片内容绘制 ══════

function drawCardContent(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  report: ReportData,
  cardIndex: number,
) {
  const startY = 270;

  switch (cardIndex) {
    case 1: drawIdentityCard(ctx, w, h, report, startY); break;
    case 2: drawMisunderstoodCard(ctx, w, h, report, startY); break;
    case 3: drawRelationshipCard(ctx, w, h, report, startY); break;
    case 4: drawVisualAnchorsCard(ctx, w, h, report, startY); break;
    case 5: drawCelebrityCard(ctx, w, h, report, startY); break;
    case 6: drawAdviceCard(ctx, w, h, report, startY); break;
  }
}

// 卡片1: 人格身份证
function drawIdentityCard(
  ctx: CanvasRenderingContext2D, w: number, _h: number,
  report: ReportData, startY: number,
) {
  let y = startY;

  // 核心真相
  ctx.font = 'bold 32px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = WHITE;
  const truth = safeText(report.coreTruth);
  const truthLines = wrapText(ctx, truth, w - 120, 3);
  truthLines.forEach((line, i) => {
    ctx.fillText(line, w / 2, y + i * 46);
  });
  y += truthLines.length * 46 + 30;

  // 关键词标签
  if (report.keywords && report.keywords.length > 0) {
    const tagW = (w - 180) / 3;
    const colors = [GOLD, PINK, CYAN];
    report.keywords.slice(0, 3).forEach((kw, i) => {
      const tx = 60 + i * (tagW + 30);
      ctx.fillStyle = `${colors[i]}20`;
      ctx.fillRect(tx, y, tagW, 56);
      ctx.fillStyle = colors[i];
      ctx.font = '22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(safeText(kw), tx + tagW / 2, y + 36);
    });
    y += 100;
  }

  // 五维简要
  ctx.textAlign = 'left';
  report.scores.slice(0, 5).forEach((s, i) => {
    const lineY = y + i * 48;
    ctx.font = '22px sans-serif';
    ctx.fillStyle = WHITE_DIM;
    ctx.fillText(s.dimension, 60, lineY + 10);

    // 分数条
    const barX = 260;
    const barW = w - 320;
    ctx.fillStyle = GOLD_DIM;
    ctx.fillRect(barX, lineY + 8, barW, 20);
    ctx.fillStyle = GOLD;
    ctx.fillRect(barX, lineY + 8, barW * (s.score / 100), 20);

    ctx.font = '18px sans-serif';
    ctx.fillStyle = WHITE;
    ctx.textAlign = 'right';
    ctx.fillText(`${s.score}`, barX + barW + 24, lineY + 22);
    ctx.textAlign = 'left';
  });
}

// 卡片2: 最被误解
function drawMisunderstoodCard(
  ctx: CanvasRenderingContext2D, w: number, _h: number,
  report: ReportData, startY: number,
) {
  const text = getMostMisunderstood(report.scores);
  if (!text) return;

  ctx.font = '26px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = WHITE;
  const lines = wrapText(ctx, safeText(text), w - 120, 10);
  lines.forEach((line, i) => {
    ctx.fillText(line, 60, startY + i * 44);
  });
}

// 卡片3: 关系频率密码
function drawRelationshipCard(
  ctx: CanvasRenderingContext2D, w: number, _h: number,
  report: ReportData, startY: number,
) {
  const rc = report.relationshipCode;
  if (!rc) return;
  let y = startY;

  // 频率标签徽章
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = GOLD;
  ctx.fillText(safeText(rc.frequencyLabel), w / 2, y);
  y += 60;

  const sections: Array<{ label: string; text: string }> = [
    { label: '信号模式', text: rc.signalPattern },
    { label: '最佳同频', text: rc.bestMatchType },
    { label: '关系张力', text: rc.tensionPoint },
  ];

  sections.forEach((sec) => {
    y += 24;
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = CYAN;
    ctx.fillText(sec.label, 60, y);
    y += 32;
    ctx.font = '24px sans-serif';
    ctx.fillStyle = WHITE;
    const lines = wrapText(ctx, safeText(sec.text), w - 120, 3);
    lines.forEach((line, i) => {
      ctx.fillText(line, 60, y + i * 36);
    });
    y += lines.length * 36 + 8;
  });
}

// 卡片4: 视觉锚点
function drawVisualAnchorsCard(
  ctx: CanvasRenderingContext2D, w: number, _h: number,
  report: ReportData, startY: number,
) {
  const va = report.visualAnchors;
  if (!va) return;

  ctx.font = '24px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = WHITE_DIM;
  const opening = safeText(va.opening);
  const opLines = wrapText(ctx, opening, w - 120, 3);
  opLines.forEach((line, i) => {
    ctx.fillText(line, w / 2, startY + i * 38);
  });

  const gridY = startY + opLines.length * 38 + 40;
  const items = [
    { val: va.widthLabel, label: va.widthPercentile },
    { val: va.clarityLabel, label: va.clarityPercentile },
    { val: va.lineCountLabel, label: va.lineCountPercentile },
    { val: va.fingerLabel, label: va.fingerPercentile },
  ];

  const colW = (w - 160) / 2;
  items.forEach((item, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const ix = 60 + col * (colW + 40);
    const iy = gridY + row * 110;

    // 卡片背景
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(ix, iy, colW, 90);

    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = GOLD;
    ctx.fillText(safeText(item.val), ix + colW / 2, iy + 24);

    ctx.font = '20px sans-serif';
    ctx.fillStyle = WHITE_DIM;
    ctx.fillText(safeText(item.label), ix + colW / 2, iy + 60);
  });
}

// 卡片5: 名人彩蛋
function drawCelebrityCard(
  ctx: CanvasRenderingContext2D, w: number, _h: number,
  report: ReportData, startY: number,
) {
  const celebs = report.celebrityMatches;
  if (!celebs || celebs.length === 0) return;

  let y = startY;
  celebs.slice(0, 3).forEach((c) => {
    // 名人卡片
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(60, y, w - 120, 90);

    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = GOLD;
    ctx.fillText(safeText(c.name), 80, y + 32);

    ctx.font = '20px sans-serif';
    ctx.fillStyle = WHITE_DIM;
    ctx.fillText(safeText(c.title), 80, y + 58);

    ctx.font = '20px sans-serif';
    ctx.fillStyle = WHITE;
    const reason = safeText(c.reason);
    const reasonTrunc = truncateText(ctx, reason, w - 280);
    ctx.textAlign = 'right';
    ctx.fillText(reasonTrunc, w - 80, y + 50);

    y += 110;
  });
}

// 卡片6: 本周建议
function drawAdviceCard(
  ctx: CanvasRenderingContext2D, w: number, _h: number,
  report: ReportData, startY: number,
) {
  let y = startY;

  ctx.font = '26px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = WHITE;
  const advice = safeText(report.weeklyAdvice || '做自己，就是最好的建议。');
  const lines = wrapText(ctx, advice, w - 120, 10);
  lines.forEach((line, i) => {
    ctx.fillText(line, 60, y + i * 44);
  });
  y += lines.length * 44 + 40;

  // 金句
  if (report.quote) {
    ctx.font = 'italic 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = WHITE_DIM;

    const quote = `"${safeText(report.quote)}"`;
    const qLines = wrapText(ctx, quote, w - 160, 4);
    qLines.forEach((line, i) => {
      ctx.fillText(line, w / 2, y + i * 38);
    });
  }
}

// ══════ 完整绘制入口 ══════

function drawPoster(
  ctx: CanvasRenderingContext2D,
  cssW: number,
  cssH: number,
  report: ReportData,
  cardIndex: number,
  shareCopy: MatchedShareCopy,
) {
  drawBg(ctx, cssW, cssH);
  drawTopDecoration(ctx, cssW);
  drawPersonaLabel(ctx, cssW, report.personaLabel);
  drawIdentityBadge(ctx, cssW, report.identityBadge);
  drawCardTitle(ctx, cssW, cardIndex);
  drawCardContent(ctx, cssW, cssH, report, cardIndex);
  drawFooter(ctx, cssW, cssH, shareCopy.primaryText);
}

// ══════ React 组件 ══════

export default function PosterCanvas({
  report,
  cardIndex,
  shareCopy,
  canvasId,
  width = 750,
  height = 1334,
}: PosterCanvasProps) {
  const drawnRef = useRef(false);

  useEffect(() => {
    if (drawnRef.current) return;
    drawnRef.current = true;

    const draw = () => {
      if (process.env.TARO_ENV === 'h5') {
        // H5: 标准 Canvas API
        const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
        if (!canvas) { drawnRef.current = false; return; }
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.ceil(width * dpr);
        canvas.height = Math.ceil(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        const ctx = canvas.getContext('2d');
        if (!ctx) { drawnRef.current = false; return; }
        ctx.scale(dpr, dpr);
        drawPoster(ctx, width, height, report, cardIndex, shareCopy);
      } else {
        // 小程序: Taro Canvas 2D API
        Taro.nextTick(() => {
          const query = Taro.createSelectorQuery();
          query
            .select(`#${canvasId}`)
            .fields({ node: true, size: true })
            .exec((res) => {
              if (!res || !res[0]) { drawnRef.current = false; return; }
              const { node: canvas, width: cssW, height: cssH } = res[0] as {
                node: HTMLCanvasElement;
                width: number;
                height: number;
              };
              if (!canvas) { drawnRef.current = false; return; }

              const ctx = canvas.getContext('2d');
              if (!ctx) { drawnRef.current = false; return; }

              let dpr = 2;
              try {
                dpr = Taro.getSystemInfoSync().pixelRatio;
              } catch { /* keep 2 */ }

              canvas.width = Math.ceil(cssW * dpr);
              canvas.height = Math.ceil(cssH * dpr);
              ctx.scale(dpr, dpr);

              drawPoster(ctx, cssW, cssH, report, cardIndex, shareCopy);
            });
        });
      }
    };

    draw();
  }, [report, cardIndex, shareCopy, canvasId, width, height]);

  return (
    <View className="poster-canvas-wrapper">
      <Canvas
        type="2d"
        id={canvasId}
        canvasId={canvasId}
        className="poster-canvas"
        style={{ width: `${width}px`, height: `${height}px` }}
      />
    </View>
  );
}
