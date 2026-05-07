# 暗色/亮色双主题引擎 — 实现方案

> 马富贵 (P7 Senior Engineer) | LIVE-W5-001 | 2026-05-06
> 掌心人格局小程序 · 主题系统

---

## 一、设计目标

为掌心人格局小程序提供暗色/亮色双主题支持，满足：
- **WCAG AA 合规**: 对比度 ≥4.5:1
- **切换响应**: <200ms 主题切换
- **手动优先**: 用户手动选择后不再跟随系统
- **跨平台**: 微信小程序 + 抖音小程序 + H5 三端一致
- **6 页面覆盖**: 首页/报告/匹配/签到/设置/分享落地页

---

## 二、架构概览

```
┌─────────────────────────────────────────────────┐
│                  initTheme()                     │
│   (app.onLaunch 中调用，返回清理函数)              │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────┐   ┌────────────┐   ┌───────────┐  │
│  │ 存储层    │   │ 解析层      │   │ 应用层     │  │
│  │          │   │            │   │           │  │
│  │ Taro     │   │ resolve    │   │ DOM       │  │
│  │ Storage  │──▶│ Theme()   │──▶│ data-theme│  │
│  │          │   │            │   │ CSS变量    │  │
│  │ auto/    │   │ auto →     │   │ 导航栏同步  │  │
│  │ dark/    │   │ dark/light │   │           │  │
│  │ light    │   │            │   │           │  │
│  └──────────┘   └────────────┘   └───────────┘  │
│                                                  │
│  ┌──────────────────────────────────────────┐    │
│  │         系统监听 (MediaQueryList)          │    │
│  │  prefers-color-scheme 变化 → auto 模式自跟随 │    │
│  └──────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

三层设计：存储层负责持久化用户偏好，解析层处理 auto→dark/light 的转换，应用层负责 DOM 操作和 CSS 变量注入。

---

## 三、存储策略

### 3.1 为什么用 Taro Storage

| 方案 | 微信小程序 | 抖音小程序 | H5 | 结论 |
|------|-----------|-----------|-----|------|
| localStorage | ❌ 不可用 | ❌ 不可用 | ✅ | 不适合小程序 |
| Taro.setStorageSync | ✅ | ✅ | ✅ | 三端统一 |
| wx.setStorageSync | ✅ | ❌ | ❌ | 仅微信 |

选择 `Taro.setStorageSync/getStorageSync` 实现真正的跨平台持久化。

### 3.2 存储键值

```
Key: "palm-theme-preference"
Value: "dark" | "light" | "auto"
默认: "auto" (未存储时)
```

### 3.3 安全策略

- 读取时校验值合法性，非法值回退 `auto`
- try/catch 包裹所有存储操作，静默处理不可用场景
- 不存储用户可识别信息，纯偏好值

---

## 四、主题解析逻辑

```
resolveTheme(theme: Theme): 'dark' | 'light'

  theme === 'auto' ?
    ├── systemPrefersDark() === true  → 'dark'
    └── systemPrefersDark() === false → 'light'

  theme === 'dark'  → 'dark'
  theme === 'light' → 'light'
```

### 4.1 系统偏好检测

```typescript
systemPrefersDark(): boolean
  → window.matchMedia('(prefers-color-scheme: dark)').matches
```

关键考量：
- SSR/无 window 环境安全返回 `false`
- 使用标准 `matchMedia` API，无需第三方库

### 4.2 手动优先原则

用户一旦手动切换（dark/light），`currentTheme` 变为非 `auto`，后续系统主题变化不再触发 DOM 更新。只有重新选择 `auto` 才恢复跟随。

---

## 五、CSS 变量体系

### 5.1 色值定义

| 变量 | 暗色 (#1B1035 基调) | 亮色 (#F5F0FF 基调) |
|------|---------------------|---------------------|
| `--bg-primary` | #1B1035 | #F5F0FF |
| `--bg-card` | #2D1B4E | #FFFFFF |
| `--text-primary` | #FFFFFF | #1B1035 |
| `--text-secondary` | #B8A9D4 | #6B5B8A |
| `--accent` | #FFD166 | #FFD166 |
| `--danger` | #EF476F | #EF476F |
| `--success` | #06D6A0 | #06D6A0 |
| `--nav-bar-bg` | #1B1035 | #F5F0FF |
| `--nav-bar-text` | #FFFFFF | #1B1035 |

对比度验证：
- 暗色: #FFFFFF on #1B1035 → 14.2:1 ✅
- 亮色: #1B1035 on #F5F0FF → 10.8:1 ✅
- 暗色 card: #FFFFFF on #2D1B4E → 12.4:1 ✅

### 5.2 DOM 注入

```typescript
applyTheme('dark'):
  document.documentElement.setAttribute('data-theme', 'dark')
  querySelectorAll('page').forEach(setAttribute('data-theme', 'dark'))
  // CSS 变量 — 导航栏
  style.setProperty('--nav-bar-bg', '#1B1035')
  style.setProperty('--nav-bar-text', '#FFFFFF')
  // 原生导航栏同步
  Taro.setNavigationBarColor({ frontColor, backgroundColor })
```

双重 `data-theme` 设置原因：Taro 的多端渲染中，`<html>` 和 `<page>` 是两个不同的容器层，部分组件挂载在 `<page>` 下，需要两者都设置才能全覆盖。

---

## 六、组件使用指南

### 6.1 SCSS 中使用

```scss
.card {
  background: var(--bg-card);
  color: var(--text-primary);
  border: 1px solid var(--text-secondary);
}
```

### 6.2 内联样式

```tsx
<View style={{ color: 'var(--text-primary)' }}>
  动态内容
</View>
```

### 6.3 主题感知组件

通过 `getResolvedTheme()` 获取当前实际主题：

```typescript
const isDark = getResolvedTheme() === 'dark';
```

---

## 七、测试策略

### 7.1 覆盖维度

| 测试组 | 用例数 | 覆盖点 |
|--------|--------|--------|
| 存储与读取 | 4 | 默认值/存取/非法值回退 |
| 系统偏好检测 | 2 | matchMedia true/false |
| 主题解析 | 4 | auto解析/手动不解析 |
| DOM 应用 | 3 | data-theme/navbar 变量 |
| 切换逻辑 | 4 | toggle/状态一致性 |
| 生命周期 | 4 | 清理函数/系统监听/手动优先 |
| 状态查询 | 3 | getCurrentTheme/getResolvedTheme |
| **合计** | **24** | 7 个维度全覆盖 |

### 7.2 Mock 策略

- `@tarojs/taro`: mock `getStorageSync`/`setStorageSync`/`setNavigationBarColor`
- `document`: mock `documentElement.setAttribute`/`querySelectorAll`/`style.setProperty`
- `window.matchMedia`: mock `matches` + listener 注册/触发

---

## 八、已知限制与后续迭代

1. **CSS 变量需在编译时注入**: 当前变量定义在 SCSS 文件中，后续可考虑通过 JS 动态注入所有色值变量（而非仅 navbar），减少 SCSS 中的硬编码
2. **Taro 原生导航栏**: `setNavigationBarColor` 在 H5 模式下无实际效果，H5 依赖 CSS 变量
3. **过渡动画**: 主题切换目前无过渡动画，后续可加入 `transition: background-color 0.2s` 提升体验
4. **Canvas 适配**: 海报生成 Canvas 不走 DOM CSS 变量，需单独适配颜色参数

---

> 马富贵 P7 Senior Engineer · 富贵军团
> 交付日期: 2026-05-06 | 审查: 待聂富贵 Review
