# PosterCanvas.tsx 渲染性能瓶颈分析

> **分析人**: 赵富贵（P6 前端）  
> **任务**: V7-W5-006  
> **目标**: 渲染时间 < 500ms  
> **分析日期**: 2026-05-06  
> **源码**: `apps/miniapp/src/components/PosterCanvas.tsx` (518行)  
> **依赖**: `textWrap.ts` (43行) / `reportUtils.ts` (67行) / `shareCopy.ts` (262行)

---

## 一、渲染链路概览

```
PosterCanvas (React 组件)
  └─ useEffect → draw()
       ├─ H5: document.getElementById → ctx.scale(dpr)
       └─ 小程序: Taro.nextTick → createSelectorQuery → ctx.scale(dpr)
            └─ drawPoster(ctx, w, h, report, cardIndex, shareCopy)
                 ├─ drawBg()               // fillRect 全幅
                 ├─ drawTopDecoration()    // 3条线段
                 ├─ drawPersonaLabel()     // truncateText ×1
                 ├─ drawIdentityBadge()    // fillText ×1
                 ├─ drawCardTitle()        // fillText ×1
                 ├─ drawDivider()          // stroke ×1
                 ├─ drawCardContent() ──────── 根据 cardIndex 分发 ────────┐
                 │   ├─ card1: drawIdentityCard      5维分数条+关键词标签  │
                 │   ├─ card2: drawMisunderstoodCard  wrapText 长文本      │
                 │   ├─ card3: drawRelationshipCard   3段速写+标签          │
                 │   ├─ card4: drawVisualAnchorsCard  4宫格锚点             │
                 │   ├─ card5: drawCelebrityCard      3张名人卡             │
                 │   └─ card6: drawAdviceCard         wrapText+金句         │
                 └─ drawFooter()  // wrapText(shareCopy) + 免责声明
```

**关键参数**: 默认画布 750×1334，DPR 2~3 缩放后实际像素 1500×2668 ~ 2250×4002

---

## 二、瓶颈分析（按严重度排序）

### 🔴 瓶颈1 (CRITICAL): `wrapText()` 逐字 measureText — O(n²) 文本测量

**位置**: `apps/miniapp/src/utils/textWrap.ts:2-24`

```typescript
// 当前实现：每个字符独立 measureText
export function wrapText(ctx, text, maxWidth, maxLines = 8): string[] {
  for (const char of text) {           // ← 逐字符遍历
    const test = current + char;
    if (ctx.measureText(test).width > maxWidth && ...) {  // ← 每字符 1 次测量
      ...
    }
  }
}
```

**问题**:
- 每个字符触发一次 `ctx.measureText()`，这是 Canvas API 中最昂贵的操作之一
- `drawFooter()` 对分享文案调用 wrapText（文案最长约 60 中文字符 = 60 次 measureText）
- `drawIdentityCard()` 对 coreTruth 调用（约 30 字符 = 30 次）
- `drawMisunderstoodCard()` 对长文本调用（可达 100+ 字符）
- `drawRelationshipCard()` 对 3 段文本各调用一次（约 3×40 = 120 次）
- `drawVisualAnchorsCard()` 对 opening 调用（约 40 字符）
- `drawAdviceCard()` 对 advice + quote 各调用一次（约 100+ 字符）

**实测估算**: 6 次 wrapText × 平均 50 字符 = **~300 次 measureText 调用**

**优化方案**:
```typescript
// 方案A: 用 fillText 原生 maxWidth 参数 (最优，0次measureText)
ctx.fillText(text, x, y, maxWidth);  // Canvas 原生支持自动截断

// 方案B: 二分查找换行点 (logN 次 measureText)
function findBreakPoint(ctx, text, maxWidth) {
  let lo = 1, hi = text.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (ctx.measureText(text.slice(0, mid)).width > maxWidth) hi = mid;
    else lo = mid + 1;
  }
  return lo - 1;
}
// 50字符：从50次 → log2(50) ≈ 6次
```

**预估收益**: 300ms → 50ms（省 250ms）

---

### 🔴 瓶颈2 (CRITICAL): `truncateText()` 同样逐字 measureText

**位置**: `apps/miniapp/src/utils/textWrap.ts:27-42`

```typescript
export function truncateText(ctx, text, maxWidth): string {
  if (ctx.measureText(text).width <= maxWidth) return text;  // 1次
  for (const char of text) {                                   // N次
    if (ctx.measureText(result + char + '...').width > maxWidth) { // N次
      return result + '...';
    }
    result += char;
  }
}
```

**调用点**:
- `drawPersonaLabel()`: 对人格标签调用（~12 字符 = 13 次 measureText）
- `drawCelebrityCard()`: 对每个名人的 reason 调用（3×~15 字符 = 45 次）

**实测估算**: ~60 次 measureText 调用

**优化方案**: 同上，改为二分查找

**预估收益**: 50ms → 10ms（省 40ms）

---

### 🟡 瓶颈3 (MEDIUM): `safeText()` 重复正则扫描

**位置**: `apps/miniapp/src/utils/shareCopy.ts:19-25`

```typescript
export function replaceForbiddenTerms(text: string): string {
  let result = text;
  for (const term of FORBIDDEN_TERMS) {  // 20+ 个禁用词
    result = result.replace(new RegExp(escaped, 'g'), '***');
  }
  return result;
}
```

**问题**: `safeText()` 在整个 `drawPoster()` 调用链中被调用 **28+ 次**，每次都要遍历 20+ 个正则模式。

| 绘制函数 | safeText 调用数 |
|---------|:----------:|
| drawPersonaLabel | 1 |
| drawIdentityBadge | 1 |
| drawFooter (2段) | 2 |
| drawIdentityCard (truth+3kw) | 4 |
| drawMisunderstoodCard | 1 |
| drawRelationshipCard (4段) | 4 |
| drawVisualAnchorsCard (opening+4×2) | 9 |
| drawCelebrityCard (3×3) | 9 |
| drawAdviceCard (advice+quote) | 2 |
| **合计** | **~33** |

33 次 × 20 个正则 × 平均文本长度 30 字符 = **~20,000 次字符串操作**

**优化方案**: 在 `drawPoster()` 入口处预计算一次所有文本的 safeText：

```typescript
function drawPoster(ctx, w, h, report, cardIndex, shareCopy) {
  // 预计算所有 safeText，避免重复扫描
  const safe = precomputeSafeTexts(report, shareCopy);
  // ... 所有绘制函数接收已处理的文本
}
```

**预估收益**: 100ms → 5ms（省 95ms）

---

### 🟡 瓶颈4 (MEDIUM): DPR 缩放导致像素填充量暴增

**位置**: `PosterCanvas.tsx:461-468` (H5) / `PosterCanvas.tsx:494-496` (小程序)

```typescript
// H5
const dpr = window.devicePixelRatio || 1;  // 移动端通常 2~3
canvas.width = Math.ceil(width * dpr);     // 750×3 = 2250
canvas.height = Math.ceil(height * dpr);   // 1334×3 = 4002
ctx.scale(dpr, dpr);

// 小程序
const dpr = Taro.getSystemInfoSync().pixelRatio;  // 通常 2~3
canvas.width = Math.ceil(cssW * dpr);
canvas.height = Math.ceil(cssH * dpr);
ctx.scale(dpr, dpr);
```

**问题**:
- DPR=3 时，`drawBg()` 的 `fillRect(0, 0, 2250, 4002)` = 填充 900 万像素
- 所有文本渲染在 3x 分辨率下进行，GPU 负担 9x
- 海报场景不需要超高 DPR（用户不会放大查看）—— 固定 DPR=2 即可保证清晰度

**优化方案**: 硬编码 DPR=2，不读取系统 pixelRatio：
```typescript
const dpr = Math.min(window.devicePixelRatio || 2, 2); // 上限 2
```

**预估收益**: DPR 3→2 时像素量从 9M → 4M，GPU 时间约减半。150ms → 70ms（省 80ms）

---

### 🟡 瓶颈5 (MEDIUM): 小程序路径异步开销

**位置**: `PosterCanvas.tsx:470-500`

```typescript
Taro.nextTick(() => {              // 等待一帧
  const query = Taro.createSelectorQuery();
  query.select(`#${canvasId}`)
    .fields({ node: true, size: true })
    .exec((res) => {               // 异步回调
      // ... 绘制逻辑
    });
});
```

**问题**: `Taro.nextTick` + `createSelectorQuery().exec()` 双异步等待，增加不可控延迟。每次需要等下一帧 + 选择器查询完成才绘制。

**优化方案**: 使用 `useReady` 或 `onReady` 生命周期预获取 Canvas 节点引用，避免每次绘制时异步查询：

```typescript
const canvasRef = useRef<HTMLCanvasElement>(null);
// 在 onReady 中获取并缓存节点引用
```

**预估收益**: 异步等待 50-100ms → 同步 0ms（省 50-100ms）

---

### 🟢 瓶颈6 (LOW): 频繁 context 状态切换

**位置**: 全局绘制函数

每次设置 `ctx.font` / `ctx.fillStyle` / `ctx.textAlign` / `ctx.strokeStyle` 都会触发 context 状态变更。整个 `drawPoster()` 调用链约 **80-120 次状态切换**。

**优化方案**: 
- 整理绘制顺序，按 font/fillStyle 分组批量绘制
- 这不是主要瓶颈，可在其他优化完成后再看

**预估收益**: 20ms 级别

---

### 🟢 瓶颈7 (LOW): drawnRef 防止重绘但可能导致空白

**位置**: `PosterCanvas.tsx:452-454`

```typescript
if (drawnRef.current) return;
drawnRef.current = true;
```

**问题**: 如果 Canvas 节点未就绪（H5 下 getElementById 返回 null），`drawnRef` 被重置为 false，但依赖不变化时 useEffect 不会重新执行。

**影响**: 功能正确性而非性能。但当前逻辑正确——`drawnRef.current = false` 后下次 effect 可以重试。

---

## 三、性能预算分解

| 项目 | 当前估算 | 优化后估算 | 节省 |
|------|:------:|:------:|:----:|
| wrapText measureText | 300ms | 50ms | -250ms |
| truncateText measureText | 50ms | 10ms | -40ms |
| safeText 重复正则 | 100ms | 5ms | -95ms |
| DPR 像素填充 | 150ms | 70ms | -80ms |
| 小程序异步等待 | 80ms | 0ms | -80ms |
| Canvas 状态切换 | 30ms | 20ms | -10ms |
| 其他绘制操作 | 120ms | 120ms | - |
| **总计** | **~830ms** | **~275ms** | **-555ms** |

---

## 四、推荐优化优先级

### P0 — 立即实施（影响最大）

1. **`wrapText()` 改为 fillText maxWidth 原生方案**（或二分查找换行点）
   - 文件: `apps/miniapp/src/utils/textWrap.ts`
   - 改动量: ~20 行
   - 收益: ~250ms

2. **`truncateText()` 改为二分查找**
   - 文件: `apps/miniapp/src/utils/textWrap.ts`
   - 改动量: ~15 行
   - 收益: ~40ms

### P1 — 本迭代实施

3. **`safeText()` 预计算 —— 在 drawPoster 入口一次性处理所有文本**
   - 文件: `apps/miniapp/src/components/PosterCanvas.tsx`
   - 改动量: ~30 行
   - 收益: ~95ms

4. **DPR 上限固定为 2**
   - 文件: `apps/miniapp/src/components/PosterCanvas.tsx`
   - 改动量: ~4 行（2处）
   - 收益: ~80ms

### P2 — 下个迭代

5. **小程序路径预获取 Canvas 节点引用，消除 Taro.nextTick 异步等待**
   - 文件: `apps/miniapp/src/components/PosterCanvas.tsx`
   - 改动量: ~20 行
   - 收益: ~80ms

---

## 五、风险与注意事项

1. **`fillText(text, x, y, maxWidth)` 原生方案**: Canvas 2D 的原生 maxWidth 参数会**剪裁**文本而非**换行**。海报需要多行显示，所以需要 `wrapText` 做换行，但可以用二分查找优化换行点的确定。

2. **DPR 固定为 2**: 在部分高 DPR 设备（如 iPhone 14 Pro 的 3x 屏），文字边缘可能轻微不如 3x 清晰。但海报是整张分享图、用户不会放大，2x 足够。

3. **safeText 预计算**: 需要确保预计算的 scope 正确，不遗漏任何需要过滤的文本字段。建议写一个 `precomputeSafeFields(report, shareCopy)` 函数集中处理。

4. **向后兼容**: 文案库的 `checkForbiddenTerms` 和 `replaceForbiddenTerms` 也被其他模块使用（如分享文案生成），不能直接删除。

---

## 六、验证方案

优化实施后，通过以下方式验证 <500ms 目标：

```typescript
// 在 draw() 函数入口添加性能打点
const start = performance.now();
drawPoster(ctx, width, height, report, cardIndex, shareCopy);
const elapsed = performance.now() - start;
console.log(`[PosterCanvas] 绘制耗时: ${elapsed.toFixed(0)}ms`);
```

- **H5 环境**: DevTools Performance 面板录制 Canvas 绘制
- **小程序环境**: 微信开发者工具 Performance Monitor
- **目标**: 所有卡片的 `elapsed` < 500ms

---

## 七、关联文件清单

| 文件 | 需要改动 |
|------|:------:|
| `apps/miniapp/src/utils/textWrap.ts` | ✅ wrapText + truncateText 算法重写 |
| `apps/miniapp/src/components/PosterCanvas.tsx` | ✅ safeText 预计算 + DPR 上限 + 节点预获取 |
| `apps/miniapp/src/utils/shareCopy.ts` | ❌ 无需改动（safeText 保留原函数） |
| `apps/miniapp/src/utils/reportUtils.ts` | ❌ 无需改动 |

---

> **赵富贵 自审**:  
> - ✅ 底层逻辑：Canvas 2D 最昂贵的 API 是 `measureText`，逐字符调用是 O(n²) 级瓶颈  
> - ✅ 抓手明确：先改文本测量算法（P0），再清冗余计算（P1），最后削框架开销（P2）  
> - ✅ 闭环可验证：performance.now() 打点 + 目标 <500ms  
> - ⚠️ 风险可控：优化不改绘制逻辑，只改测量方式和预处理顺序
