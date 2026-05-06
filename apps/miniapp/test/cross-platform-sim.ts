// 跨平台兼容性验证 — 模拟不同OS字体宽度测试 safeWrap 安全系数
// 用法: npx tsx test/cross-platform-sim.ts

// 模拟不同平台的字符宽度 (32px字号下单个CJK字符的measureText宽度)
const PLATFORM_FONTS = {
  ios:        { name: 'iOS (PingFang SC)',    cjkWidth: 32.0, latinWidth: 17.6 },
  android:    { name: 'Android (Noto Sans)',   cjkWidth: 32.5, latinWidth: 17.9 },
  windows:    { name: 'Windows (YaHei)',       cjkWidth: 33.1, latinWidth: 18.2 },
  linux:      { name: 'Linux (Noto Sans)',     cjkWidth: 32.3, latinWidth: 17.8 },
};

const FONT_SAFETY_FACTOR = 0.94;

interface SimCtx {
  measureText(text: string): { width: number };
}

function makeCtx(cjkWidth: number, latinWidth: number): SimCtx {
  return {
    measureText(text: string) {
      let w = 0;
      for (const ch of text) {
        w += /[一-鿿]/.test(ch) ? cjkWidth : latinWidth;
      }
      return { width: w };
    },
  };
}

// ─── 模拟 wrapText (与 textWrap.ts 完全一致的二分查找逻辑) ───
function simWrapText(ctx: SimCtx, text: string, maxWidth: number, maxLines = 8): string[] {
  const lines: string[] = [];
  let remaining = text;

  while (remaining.length > 0 && lines.length < maxLines) {
    let lo = 1;
    let hi = remaining.length;
    let bestLen = 0;

    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (ctx.measureText(remaining.slice(0, mid)).width <= maxWidth) {
        bestLen = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    if (bestLen === 0) bestLen = 1;
    lines.push(remaining.slice(0, bestLen));
    remaining = remaining.slice(bestLen);
  }

  return lines;
}

// ─── 模拟 truncateText (与 textWrap.ts 完全一致的二分查找逻辑) ───
function simTruncateText(ctx: SimCtx, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;

  let lo = 1;
  let hi = text.length;
  let bestLen = 0;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (ctx.measureText(text.slice(0, mid) + '...').width <= maxWidth) {
      bestLen = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  return text.slice(0, bestLen) + '...';
}

// ─── 测试用例 ───

interface TestCase {
  label: string;
  text: string;
  fontSize: number;
  maxWidth: number;
  maxLines: number;
  mode: 'wrap' | 'truncate';
}

const TEST_CASES: TestCase[] = [
  {
    label: '人格标签 personaLabel',
    text: '你是「沉默的守护者」',
    fontSize: 44,
    maxWidth: 630,
    maxLines: 1,
    mode: 'truncate',
  },
  {
    label: '核心真相 coreTruth',
    text: '你看起来很好说话，但心里有张严格的评分表，每一个细节都被默默记下。',
    fontSize: 32,
    maxWidth: 630,
    maxLines: 3,
    mode: 'wrap',
  },
  {
    label: '关系密码 signalPattern',
    text: '你的社交频率像潮汐——丰沛时温暖所有人，低落时需要独自恢复能量。',
    fontSize: 24,
    maxWidth: 630,
    maxLines: 3,
    mode: 'wrap',
  },
  {
    label: '分享文案 shareText',
    text: 'AI说我是「清醒恋爱脑」——在感性和理性之间反复横跳的那种。你也来测测？',
    fontSize: 24,
    maxWidth: 630,
    maxLines: 4,
    mode: 'wrap',
  },
  {
    label: '名人原因 reason',
    text: '你们的思维结构出奇相似——善于从混乱中找到隐藏的秩序',
    fontSize: 20,
    maxWidth: 470,
    maxLines: 1,
    mode: 'truncate',
  },
  {
    label: '视觉锚点 opening',
    text: 'AI从你的手掌纹路中读取到了四个关键特征，这些特征共同构成了你的视觉识别码。',
    fontSize: 24,
    maxWidth: 630,
    maxLines: 3,
    mode: 'wrap',
  },
  // ── 边界测试: 故意构造接近maxWidth的文本 ──
  {
    label: '🔴 边界: 超长coreTruth',
    text: '你看起来很好说话但心里有张严格的评分表每一个细节都被默默记下从不轻易说出来',
    fontSize: 32,
    maxWidth: 630,
    maxLines: 3,
    mode: 'wrap',
  },
  {
    label: '🔴 边界: 超长关系文本',
    text: '你的社交频率像潮汐丰沛时温暖所有人低落时需要独自恢复能量而这一面很少有人看到',
    fontSize: 24,
    maxWidth: 630,
    maxLines: 3,
    mode: 'wrap',
  },
  {
    label: '🔴 边界: 超宽名人reason',
    text: '你们的思维结构出奇相似善于从混乱中找到隐藏的秩序而这一点连你自己都未必意识到',
    fontSize: 20,
    maxWidth: 470,
    maxLines: 1,
    mode: 'truncate',
  },
];

// ─── 运行验证 ───

console.log('══════════════════════════════════════════════');
console.log('  跨平台字体兼容性验证');
console.log('  安全系数: FONT_SAFETY_FACTOR =', FONT_SAFETY_FACTOR);
console.log('══════════════════════════════════════════════\n');

let totalChecks = 0;
let passedChecks = 0;
let overflowRisks = 0;
let overflowFixedBySafety = 0;

for (const tc of TEST_CASES) {
  console.log(`┌─ ${tc.label}`);
  console.log(`│  原文: ${tc.text.slice(0, 50)}...`);
  console.log(`│  字号: ${tc.fontSize}px | 容器: ${tc.maxWidth}px | 最大行: ${tc.maxLines}`);
  console.log('│');

  const scale = tc.fontSize / 32; // 基于32px基准缩放字符宽度

  // 执行测试函数
  function runTest(maxW: number, safety: boolean): Record<string, { lines: number; overflow: boolean; maxLineW: number }> {
    const results: Record<string, { lines: number; overflow: boolean; maxLineW: number }> = {};
    const effectiveMaxW = safety ? maxW * FONT_SAFETY_FACTOR : maxW;

    for (const [key, pf] of Object.entries(PLATFORM_FONTS)) {
      const ctx = makeCtx(pf.cjkWidth * scale, pf.latinWidth * scale);

      if (tc.mode === 'truncate') {
        const result = simTruncateText(ctx, tc.text, effectiveMaxW);
        const w = ctx.measureText(result).width;
        results[key] = { lines: 1, overflow: w > tc.maxWidth + 0.5, maxLineW: w };
      } else {
        const lines = simWrapText(ctx, tc.text, effectiveMaxW, tc.maxLines);
        let maxLineW = 0;
        let overflow = false;
        for (const line of lines) {
          const w = ctx.measureText(line).width;
          if (w > tc.maxWidth + 0.5) overflow = true;
          if (w > maxLineW) maxLineW = w;
        }
        results[key] = { lines: lines.length, overflow, maxLineW };
      }
    }
    return results;
  }

  // 先测试: 无安全系数 (直接用 maxWidth)
  const noSafetyResults = runTest(tc.maxWidth, false);
  for (const key of Object.keys(PLATFORM_FONTS)) {
    totalChecks++;
    if (!noSafetyResults[key].overflow) passedChecks++;
    else overflowRisks++;
  }

  // 再测试: 有安全系数 (maxWidth * 0.94)
  const safetyResults = runTest(tc.maxWidth, true);
  for (const [key] of Object.entries(PLATFORM_FONTS)) {
    if (noSafetyResults[key].overflow && !safetyResults[key].overflow) {
      overflowFixedBySafety++;
    }
  }

  // 打印对比表
  console.log('│  ┌──────────┬──────────────┬──────────────┐');
  console.log('│  │  平台    │ 无安全系数   │ 有安全系数   │');
  console.log('│  ├──────────┼──────────────┼──────────────┤');
  for (const [key, pf] of Object.entries(PLATFORM_FONTS)) {
    const noS = noSafetyResults[key];
    const s = safetyResults[key];
    const noSFlag = noS.overflow ? '⚠️溢出' : '✅';
    const sFlag = s.overflow ? '⚠️溢出' : '✅';
    const nsInfo = tc.mode === 'truncate'
      ? `${noS.maxLineW.toFixed(0)}px`
      : `${noS.lines}行 ${noS.maxLineW.toFixed(0)}px`;
    const sInfo = tc.mode === 'truncate'
      ? `${s.maxLineW.toFixed(0)}px`
      : `${s.lines}行 ${s.maxLineW.toFixed(0)}px`;
    console.log(`│  │  ${pf.name.slice(0, 14).padEnd(8)} │ ${noSFlag} ${nsInfo.padEnd(8)} │ ${sFlag} ${sInfo.padEnd(8)} │`);
  }
  console.log('│  └──────────┴──────────────┴──────────────┘');
  console.log('');
}

// ─── 汇总 ───
console.log('══════════════════════════════════════════════');
console.log('  验证汇总');
console.log('══════════════════════════════════════════════');
console.log(`  总检查点: ${totalChecks}`);
console.log(`  无安全系数通过: ${passedChecks}/${totalChecks} (${(passedChecks/totalChecks*100).toFixed(0)}%)`);
console.log(`  溢出风险数: ${overflowRisks}`);
console.log(`  安全系数修复数: ${overflowFixedBySafety}`);
console.log(`  安全系数有效率: ${overflowRisks > 0 ? (overflowFixedBySafety/overflowRisks*100).toFixed(0) : 'N/A'}%`);
console.log('');

if (overflowFixedBySafety === overflowRisks && overflowRisks > 0) {
  console.log('  ✅ 结论: FONT_SAFETY_FACTOR=0.94 有效消除了所有跨平台溢出风险');
} else if (overflowRisks === 0) {
  console.log('  ✅ 结论: 当前测试文本在所有平台上均无溢出风险');
} else {
  console.log('  ⚠️  结论: 仍有溢出风险未解决，需调整安全系数');
}

console.log('');
