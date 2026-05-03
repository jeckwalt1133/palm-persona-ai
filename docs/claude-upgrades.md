# Claude Code 升级配置包（最新·3轮学习 27课题精华）

## 最新发现（5/3 第三轮）

### 🚨 Claude Code v2.1.121 有 /perceive 命令——能看图了
这是最炸裂的更新。以后 Claude Code 可以直接看截图、分析 UI、读取掌纹图片。
```
/perceive 分析这张手掌图片的几何特征
```

### 💰 iOS 虚拟支付费率更正
之前说 20%，实际是 **15%**（苹果小程序合作伙伴计划）。非 iOS 端 1%（限时优惠）。

### 🔥 爆款传播路径验证
SBTI 爆火路径：**B站孵化创意 → 微信朋友圈放大传播**。这就是你产品的传播路径。

### ⚡ 审核加速
最快 **2 小时** 审核（第三方服务商预检通道）。

## 第四轮学习（GitHub 开源项目·5/3）

### 直接竞品参考
- **Divination（神机妙算）**：手相+面相+MBTI+八字+塔罗，DeepSeek驱动
- **Palm-Astro-Application**：U-Net+ResNet18 真·掌纹线检测（CV方案）
- **zhouwenwang（周文王）**：142⭐ AI占卜含手相分析

### 海报方案
- **Painter**：4,500⭐，JSON配置+类CSS，小程序海报金标准
- **taro-plugin-canvas**：Painter的Taro封装版，直接用

### Claude Code 配置
- **everything-claude-code**：153K⭐，生产级 agents/skills/hooks 全套
- **claude-code-best-practice**：32K⭐，86条实战技巧
- **Karpathy CLAUDE.md**：5.8K⭐，4条铁律

### SBTI开源版
- **pingfanfan/SBTI**：27种人格+雷达图，改JSON即可定制——我们的模板引擎可参考

### ⚠️ 社交类小程序红线
我们的产品属于"社交-熟人交友"类目——需要**属地网信办报备二次审核**。这是在之前审核分析中遗漏的关键点。

## 一、CLAUDE.md 重构（基于 Karpathy 63k⭐ 模板）

替换现有 CLAUDE.md 的核心原则为 Karpathy 四条铁律：
1. Think Before Coding — 不假设、有歧义先问
2. Simplicity First — 最小代码解决，不加未请求的抽象
3. Surgical Changes — 只动该动的地方，不顺手重构
4. Goal-Driven Execution — 任务转为可验证目标，自己闭环达标

每行遵循黄金法则："删掉这行会让 Claude 犯错吗？不会就删。"

## 二、UI 升级配方（直接喂给 Claude Code 的 CSS 指令）

### 深色毛玻璃卡片
```scss
.dark-glass-card {
  background: rgba(27, 16, 53, 0.6);   // 深紫底
  backdrop-filter: blur(16px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20rpx;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  will-change: transform;
  transform: translateZ(0);             // GPU 加速
}
```

### 动态渐变背景
```scss
.starry-bg {
  background: 
    radial-gradient(circle at 20% 30%, rgba(239, 71, 111, 0.08), transparent 60%),
    radial-gradient(circle at 80% 70%, rgba(6, 214, 160, 0.06), transparent 60%),
    linear-gradient(180deg, #1B1035, #0B0718);
}
```

### 卡片渐入动画
```scss
@keyframes cardReveal {
  from { opacity: 0; transform: translateY(24rpx) scale(0.96); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
.card-enter { animation: cardReveal 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
```

### 金句样式
```scss
.golden-quote {
  font-style: italic;
  color: #FFD166;           // 星光金
  text-shadow: 0 0 20px rgba(255, 209, 102, 0.3);
  font-size: 36rpx;
  text-align: center;
  padding: 32rpx;
}
```

### 参考组件库
- NutUI (6.4k⭐): @nutui/nutui-taro
- lkcn-ui（瑞幸同款）: npm install lkcn-ui

## 三、Canvas 海报高清方案

### 根因：DPR 未缩放
```javascript
const dpr = wx.getWindowInfo().pixelRatio;
canvas.width = logicalWidth * dpr * 2;
canvas.height = logicalHeight * dpr * 2;
ctx.scale(dpr * 2, dpr * 2);
```

### 导出高清
```javascript
wx.canvasToTempFilePath({
  canvas, destWidth: logicalWidth * dpr * 2, destHeight: logicalHeight * dpr * 2, quality: 0.92
});
```

### 推荐库：wxml2canvas-2d（CSS 最完整，活跃维护）

## 四、DeepSeek 识图 API（替代 Mock Provider）

```python
from openai import OpenAI
client = OpenAI(api_key="sk-xxx", base_url="https://api.deepseek.com")

response = client.chat.completions.create(
    model="deepseek-v4-pro",
    messages=[{"role": "user", "content": [
        {"type": "text", "text": "请分析这张手掌图片的几何特征"},
        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_data}"}}
    ]}],
    max_tokens=4096
)
```

### 关键配置
- 图片压缩到 1280px 宽，quality 85，避免 413
- 开启深度思考: `extra_body={"thinking": True}`
- 定价：V4 Pro 缓存 0.025 元/百万 tokens

## 五、Prompt 工程优化（人格报告生成）

### 四位一体公式
```
你是谁？+ 要做啥？+ 希望得到什么效果？+ 你担心啥？
```

### 手掌分析专用 System Prompt 模板
```
你是 AI 掌心人格分析师。基于手掌几何特征输出报告。
规则：
1. 所有结论引用具体特征（"从智慧线弧度和金星丘饱满度看..."）
2. 禁用：算命/占卜/命运/正缘/姻缘/100%准确/必然/一定
3. 替代表达：倾向于/更容易/趣味语境下/手掌特征显示
4. 每段分析不超过 2 句，有画面感，不制造焦虑
5. 输出严格 JSON，无 markdown
```

## 六、竞品参考（避坑）

- 测测 5500 万用户——但无 AI 手相核心功能（我们的切入点）
- 准了 95% 付费被大量吐槽——免费+增值是差异化
- Yuan/Destiny 开源——八字/紫微 Prompt 结构可参考，合规坑要避开

## 七、留存机制（克莱德效应 + 签到）

- 签到 7 天解锁深度分析（利用蔡格尼克效应）
- 报告"未完待续"悬念（"明天同一时间，AI 会给你一条新发现"）
- 勋章系统 8 种稀有度（收集欲驱动复测）

## 八、审核避坑清单

- 类目：工具→图片处理（严禁婚庆/宗教）
- 提交时机：工作日上午 10 点（避开周五/节假日）
- 审核版关闭 UGC 和营销功能
- 提供测试账号
- 不出现：测试/社区/社群/分享/区块链等敏感词
