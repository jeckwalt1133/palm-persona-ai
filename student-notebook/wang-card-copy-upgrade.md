---
name: 6张报告卡片文案逐张升级 — 全量审查+代码落地
author: 王富贵 (PM, 豆包 Seed-2.0-Pro)
taskId: V7-W4-008
date: 2026-05-06
methodology: 三模块方法论 — M01情感分层 / M02温度控制 / M03技术术语翻译
scope: 6张Canvas海报卡片的全部用户可见文案
---

# 6张报告卡片文案升级

## 审查方法论

每张卡片过4道关卡：
1. **M01 锚点检查** — 去掉形容词后，用户还能验证"这说的是我"吗？
2. **M02 温度检查** — 卡片场景的温度匹配吗？（身份卡温3-5°/刺痛卡热5-7°/建议卡温4-5°）
3. **M03 术语检查** — 有没有"AI视角"的词？有没有用户听不懂的术语？
4. **分享场景检查** — 这张卡片被朋友看到时，朋友能看懂吗？

---

## 卡片1: 人格身份证

### 当前文案来源
- coreTruth: `server/src/engine/resonance-narrative-engine.ts` buildCoreTruth() — 6条模板hook
- keywords: `server/src/engine/persona-templates.ts` keywordPool
- 卡片标题: `apps/miniapp/src/utils/reportUtils.ts` getCardTitle(1)
- 维度名称: `server/src/engine/persona-templates.ts` DIMENSIONS

### 审查发现

| 问题 | 位置 | 严重度 |
|------|------|--------|
| coreTruth hook #2: "${prominentMount}的弧度告诉我" — "金星丘/木星丘"等是中医/掌纹学术语，用户听不懂 | resonance-narrative-engine.ts:117 | P0 |
| coreTruth hook #5: "${clarityLabel}的掌心线条、${prominentMount}的弧度" — 同上 | resonance-narrative-engine.ts:120 | P0 |
| 身份徽章 badge #3: "${anchors.prominentMount}灵魂 · ${template.label}" — 同上 | resonance-narrative-engine.ts:139 | P1 |
| 卡片标题 "你的人格身份证" — "身份证"偏工具感，"画像"更有温度 | reportUtils.ts:58 | P2 |

### Before / After

**卡片标题**:
```
Before: 你的人格身份证
After:  你的人格画像
```

**coreTruth hook #2**:
```
Before: ${prominentMount}的弧度告诉我，你看起来${trait1}，实际上比谁都在意细节。
After:  你手掌的弧度告诉我，你看起来${trait1}，实际上比谁都在意细节。
```

**coreTruth hook #5**:
```
Before: ${clarityLabel}的掌心线条、${prominentMount}的弧度——这些细节拼出一个你：...
After:  ${clarityLabel}的掌心线条、手掌的整体轮廓——这些细节拼出一个你：...
```

**身份徽章 badge #3**:
```
Before: ${anchors.prominentMount}灵魂 · ${template.label}
After:  手掌形塑的 · ${template.label}
```

---

## 卡片2: 最被误解的地方

### 当前文案来源
- 卡片内容: `apps/miniapp/src/utils/reportUtils.ts` MISUNDERSTOOD_TEMPLATES — 5维度×2级(high/low) = 10条
- 卡片标题: `apps/miniapp/src/utils/reportUtils.ts` getCardTitle(2)

### 审查发现

| 问题 | 位置 | 严重度 |
|------|------|--------|
| 全部10条模板使用第三人称"TA"指代用户 — 分享海报时读者不知道"TA"是谁 | reportUtils.ts:15-35 | P0 |
| 部分模板缺少L1行为锚点，"眼泪和笑容"这种不如"不回消息时的沉默"具体 | — | P2 |

### Before / After (全部10条)

```
维度: emotionalResonance

Before (high): 你以为TA情绪化，其实TA只是不想在你面前藏。那些眼泪和笑容都是真的——TA对重要的人不设防。
After (high):  别人以为你情绪化，其实你只是不想在在乎的人面前藏。那些眼泪和笑容都是真的——你对重要的人不设防。

Before (low):  你以为TA不在乎，其实TA只是不习惯表达。TA心里已经翻了一百页，嘴上只翻了一页。
After (low):   别人以为你不在乎，其实你只是不习惯表达。心里已经翻了一百页，嘴上只翻了一页。

维度: communicationSync

Before (high): 你以为TA话多，其实TA是在意冷场。TA怕尴尬、怕沉默、怕你不舒服——TA的话痨是一种体贴。
After (high):  别人以为你话多，其实你是在意冷场。怕尴尬、怕沉默、怕别人不舒服——你的话痨是一种体贴。

Before (low):  你以为TA冷漠，其实TA只是还没想好怎么开口。TA的沉默不是拒绝，是没找到对的入口。
After (low):   别人以为你冷漠，其实你只是还没想好怎么开口。你的沉默不是拒绝，是没找到对的入口。

维度: actionComplement

Before (high): 你以为TA冲动，其实TA已经想了三遍才动手。TA的"快"是因为大脑跑得比嘴巴快。
After (high):  别人以为你冲动，其实你已经想了三遍才动手。你的"快"是因为大脑跑得比嘴巴快。

Before (low):  你以为TA犹豫，其实TA是在等最佳时机。TA不动不是怕，是在算最稳的那步。
After (low):   别人以为你犹豫，其实你是在等最佳时机。不动不是怕，是在算最稳的那步。

维度: trustPotential

Before (high): 你以为TA对人没防备，其实TA心里有一本账。TA的真诚是真的，但TA从不轻易交底。
After (high):  别人以为你对人没防备，其实你心里有一本账。你的真诚是真的，但你从不轻易交底。

Before (low):  你以为TA疏远，其实TA只是需要时间相信你。一旦信任成立，TA就是那种不会走的人。
After (low):   别人以为你疏远，其实你只是需要时间相信一个人。一旦信任成立，你就是那种不会走的人。

维度: frictionRisk

Before (high): 你以为TA脾气大，其实TA只是不忍了。TA忍了很久才发作——那不是脾气，是边界被踩穿的信号。
After (high):  别人以为你脾气大，其实你只是不忍了。忍了很久才发作——那不是脾气，是边界被踩穿的信号。

Before (low):  你以为TA没脾气，其实TA只是不想让你难堪。TA把不舒服都自己消化了——但容量再大也有上限。
After (low):   别人以为你没脾气，其实你只是不想让别人难堪。把不舒服都自己消化了——但容量再大也有上限。
```

---

## 卡片3: 关系频率密码

### 当前文案来源
- 全部4字段: `server/src/engine/persona-templates.ts` generateRelationshipCode()
- 卡片标题: `apps/miniapp/src/utils/reportUtils.ts` getCardTitle(3)

### 审查发现

| 问题 | 位置 | 严重度 |
|------|------|--------|
| 信号模式 "低频深海型" 的 label 用词 "深海" 与人格 "深海思考者" 重名，用户可能以为是同一种东西 | persona-templates.ts:344 | P0 |
| "静默深度传输" 技术感重（M03违规） | persona-templates.ts:358 | P1 |
| 卡片标题 "你的关系频率密码" 过长，海报空间紧张 | reportUtils.ts:60 | P2 |

### Before / After

**卡片标题**:
```
Before: 你的关系频率密码
After:  你的关系密码
```
理由："频率"对非技术用户无意义，"关系密码"4个字足够。对标DeepSeek极简。

**频率标签 label**:
```
Before (低频): 低频深海型 — 你的信号不嘈杂但传得很远，真正在乎你的人会调到你的频率
After (低频):  静水深流型 — 你的信号不嘈杂但传得很远，真正在乎你的人会调到你的频率
```
理由："深海"与人格类型"深海思考者"重名，换"静水深流"——保留水的意象，避免混淆。对标豆包"伙伴不助手"——用户能感受到"静水深流"描述的是自己而非AI。

**信号模式 "静默深度传输"**:
```
Before: 你的关系信号是"静默深度传输"——你不轻易发出信号，但一旦发出就是认真的
After:  你的关系信号是"慢热但持久"——你不轻易发出信号，但一旦发出就是认真的
```
理由："静默深度传输"像操作系统内核术语（M03违规）。"慢热但持久"——对标Claude的精确，6个字用户秒懂。

---

## 卡片4: AI从你的手掌读取到

### 当前文案来源
- opening: `server/src/engine/resonance-narrative-engine.ts` buildVisualAnchors() — 1条
- opening(备用): `server/src/engine/report-pipeline.ts` buildVisualAnchors() — 1条
- feature labels: 两处 buildVisualAnchors
- 卡片标题: `apps/miniapp/src/utils/reportUtils.ts` getCardTitle(4)

### 审查发现

| 问题 | 位置 | 严重度 |
|------|------|--------|
| "AI 读取到" — 机器视角（M03违规），应从用户视角"你的手掌"开场 | resonance-narrative-engine.ts:78 | P0 |
| "金星丘/木星丘/土星丘/太阳丘/水星丘" — 中医/掌纹学术语，用户完全不懂 | resonance-narrative-engine.ts:73-75 | P0 |
| "这通常与情感能量和自我表达有关" — 万能句、零锚点、踩合规线（接近"命运"暗示） | resonance-narrative-engine.ts:78 | P0 |
| report-pipeline.ts 的开场 "AI 读取到你的手掌宽度..." — 同样的问题 | report-pipeline.ts:71 | P0 |
| 卡片标题 "AI 从你的手掌读取到" — "读取"是机器动词 | reportUtils.ts:61 | P1 |

### Before / After

**卡片标题**:
```
Before: AI 从你的手掌读取到
After:  AI 从你的手掌看到
```

**resonance-narrative-engine.ts 的 opening**:
```
Before: AI 读取到你的手掌宽度${widthLabel}，${fingerLabel}，掌心纹路${clarityLabel}，主线条${lineCountLabel}。${maxMountName}区域较为突出——这通常与情感能量和自我表达有关。
After:  你的手掌${widthLabel}，${fingerLabel}，掌心纹路${clarityLabel}，线条${lineCountLabel}。手掌最饱满的区域透露了一些关于你的信息——不是你想的那种玄学，是手掌本身就在说话。
```
理由：
1. 去"AI 读取到"——对标Claude的用户视角（"你不需要知道AI做了什么"）
2. 去"XX丘"——替换为"手掌最饱满的区域"，用户看得见摸得着
3. 去"情感能量和自我表达"——替换为"手掌本身就在说话"，避免踩合规线（与"命运/性格预测"拉开距离）
4. "不是你想的那种玄学"——自嘲式品牌声音（对标V7-W3-011的"认真但不较真"）

**report-pipeline.ts 的 opening**:
```
Before: AI 读取到你的手掌宽度${w > 75 ? '偏宽厚' : w > 60 ? '适中' : '偏窄'}，比例${fl > 0.85 ? '修长' : '和谐'}，掌心纹路${c > 60 ? '清晰可见' : c > 35 ? '柔和可见' : '若隐若现'}，主线条脉络${lc > 5 ? '非常丰富' : lc > 3 ? '丰富' : '简洁'}。${maxMount}区域较为突出。
After:  你的手掌${w > 75 ? '偏宽厚' : w > 60 ? '适中' : '偏窄'}，${fl > 0.85 ? '手指修长' : '比例和谐'}，掌心纹路${c > 60 ? '清晰可见' : c > 35 ? '柔和可见' : '若隐若现'}，线条${lc > 5 ? '非常丰富' : lc > 3 ? '丰富' : '简洁'}。手掌最饱满的地方在${maxMount}——每个手掌的轮廓都不一样，这就是你的独特之处。
```
理由：去"AI 读取到"、"主线条脉络"（"脉络"给人文绉绉）、"区域较为突出"→"手掌最饱满的地方在XX"（更具体）。结尾强调"独特"而非"特征"。

---

## 卡片5: 名人同频彩蛋

### 当前文案来源
- 全部36条: `server/src/engine/persona-templates.ts` CELEBRITY_MAP
- 卡片标题: `apps/miniapp/src/utils/reportUtils.ts` getCardTitle(5)

### 审查发现

| 问题 | 位置 | 严重度 |
|------|------|--------|
| 部分reason文案"你的XX是他的XX"句式机械 | CELEBRITY_MAP | P1 |
| 村上春树 reason "你的沉淀力是他的特质" — 生硬 | persona-templates.ts:272 | P1 |
| Pharrell Williams reason "快乐也是一种生产力" — "生产力"是职场用语 | persona-templates.ts:278 | P1 |
| 大张伟 reason 过长且"经历过才选择开心"信息密度高 | persona-templates.ts:312 | P2 |

### Before / After（选最弱的8条改）

```
starry-dreamer / 村上春树:
Before: 独处中产出最深的东西——你的沉淀力是他的特质
After:  在独处中产出最打动人的东西——你的创造力和他来自同一个地方

flame-explorer / Pharrell Williams:
Before: 永远在跨界、永远有能量——快乐也是一种生产力
After:  永远在跨界、永远有能量——你的快乐不是不懂，是通透

sunshine-spark / 大张伟:
Before: 看起来在闹，其实比谁都通透——你的快乐是他那种"经历过才选择开心"的智慧
After:  看起来在闹，其实比谁都通透——你的快乐是选择，不是没心没肺

bridge-builder / 俞敏洪:
Before: 把一群人聚在一起朝一个方向走——你的凝聚力是他那种组织天赋
After:  把一群人团结在一起——你和他一样，知道"一个人走得快，一群人走得远"

sharp-pioneer / 董明珠:
Before: 不拖泥带水、说一不二——你的果断是她那样的领袖特质
After:  不拖泥带水——你的果断和她的风格一样：做了再说

quiet-mountain / 张艺谋:
Before: 话不多但每一部作品都在回应时代——你的沉默同样有重量
After:  话不多但每一次出手都让人记住——你的沉默是力量，不是空白

root-keeper / 汪涵:
Before: 守住了自己的节奏和标准——你对根基的重视是他那种老派但不过时的讲究
After:  守住了自己的节奏——你对根基的重视，是那种在快时代里慢下来的底气

root-keeper / 梅西:
Before: 忠诚、专注、把一件事做到极致——你的稳是冠军级别的
After:  忠诚、专注、把一件事做到极致——你的稳，是那种不需要喧哗的冠军心态
```

---

## 卡片6: 本周建议

### 当前文案来源
- quote: `server/src/engine/persona-templates.ts` QUOTE_ENTRIES (80条)
- weeklyAdvice: 引擎生成或默认值
- 卡片标题: `apps/miniapp/src/utils/reportUtils.ts` getCardTitle(6)

### 审查发现

| 问题 | 位置 | 严重度 |
|------|------|--------|
| 卡片标题 "本周给你的建议" — "给"字多余，"建议"偏工具感 | reportUtils.ts:63 | P2 |

### Before / After

**卡片标题**:
```
Before: 本周给你的建议
After:  本周给你的话
```
理由："话"比"建议"暖。对标豆包"伙伴"语气——朋友对你说的话，不是专家给你的建议。

---

## 涉及文件清单

| 文件 | 改动数 | 类型 |
|------|--------|------|
| `apps/miniapp/src/utils/reportUtils.ts` | 16处 | P0: 10条MISUNDERSTOOD → "你" / P1-P2: 5个卡片标题 |
| `server/src/engine/resonance-narrative-engine.ts` | 4处 | P0: 2条coreTruth hook + 1条opening + 1条badge |
| `server/src/engine/report-pipeline.ts` | 1处 | P0: opening文案 |
| `server/src/engine/persona-templates.ts` | 8处 | P1: CELEBRITY_MAP reason文案 |

---

*王富贵 | V7-W4-008 | AI师生研究院 Week 4*
*每张卡片都是一次传播机会——不能让朋友看到的文案带着"TA"和"金星丘"。*
