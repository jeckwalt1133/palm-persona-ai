# 掌心人格分析算法（终版）

## 特征提取流程（两步）
1. **用户辅助标点** — 用户点击手掌 5-7 个关键点（生命线/智慧线/感情线起点、食指/小指根部、手腕中心、拇指/中指尖)
2. **几何计算** — 基于标点坐标计算相对比例、角度、长度 + 图片 hash 确定性微调 → 同一手掌结果稳定
3. 若标点缺失 → hash fallback，confidence 下降
4. confidence < 0.3 → 拒绝分析，返回 NON_PALM_IMAGE

## 15+ 核心特征维度
- 基础：handShape, palmWidthRatio, fingerLengthRatio, lineDensity, majorLineClarity, lineCurvature, textureComplexity, thumbOpenAngle
- 生命线：length, depth, branches, curve, startPosition(separate/touching/crossing)
- 智慧线：length, depth, curve, split, direction(straight/drop)
- 感情线：length, curve, branches, branchDirection(index/middle/both)
- 事业线：present, length, broken
- 太阳线/水星线：present, length
- 掌丘(6个)：venus, jupiter, saturn, apollo, mercury, moon
- 指型比例：indexToRing, middleToIndex, pinkyToRing
- imageQuality：brightness, sharpness, completeness, confidence

## 分析引擎流水线（5 阶段）
1. **PalmFeatureExtractor** → 图片+标点 → PalmFeatures(15+维度)
2. **PersonaScoringEngine** → PalmFeatures → PersonaScores(50条规则+交叉组合)
3. **InsightTemplateEngine** → Scores+Context → 选中模板+生成叙事草稿
4. **ResonanceNarrativeEngine** → 特征+分数+模板 → ReportSkeleton（含视觉锚点）
5. **ContentSafety** → 过滤禁词+弱化句式+附免责声明 → 最终 DeepPalmReport

**AI Provider 只增强叙事文案字段**，不参与分数计算。

## 50 条映射规则（含完整链路）
每条规则：特征组合 → 倾向标签 → 生活化解释 → 温和建议
- 生命线长+深+弧度大 → 精力充沛 → "你的生命线深长而流畅，通常意味着身体基础节奏稳健..."
- 生命线短+浅 → 精力需管理 → "你的生命线相对较短且浅，提示你需要更精细地管理自己的精力..."
- 智慧线下垂+长 → 直觉型决策 → "你的智慧线弧线较大且向月丘延伸，这是一种典型的直觉型思维特征..."
- 智慧线平直+短 → 务实思维 → "你的智慧线平直简短，对应一种注重实际、讲究效率的思维风格..."
- 感情线分叉指向食指 → 理想主义恋爱观 → "你的感情线末端分叉朝向食指，往往对应对关系有高标准期待..."
- 生命线+智慧线起点分离 → 独立意识强 → "你的生命线和智慧线起点明显分离，通常代表自我意识形成较早..."
- 三线起点重合 → 对亲近关系敏感 → "你的主要掌纹起点紧密，暗示你对家庭和亲密关系非常在意..."
- 金星丘饱满+感情线弧度大 → 情感充沛、保护欲 → "..."
- 月丘饱满+智慧线弧度大 → 感性直觉、创造性强 → "..."
（完整 50 条存于 PersonaScoringEngine.ts 注释和模板文件中）

## 视觉锚点机制
报告中每段人格分析须引用具体手掌特征：
"从你的手掌特征看，{特征描述}。这通常对应{人格倾向}。{生活化解释}。{温和建议}。"

## 问卷交叉验证
当 AnalysisContext 与 PalmFeatures 推论一致时，报告中明确点出：
"你在问卷中说自己{用户选择}，从手掌特征看，{对应特征}也印证了这一点。"

## 好友匹配
1. A 的 PersonaScores + B 的 PersonaScores → CompatibilityEngine（特征对比）
2. 五个维度：情绪频率、沟通同步、行动互补、信任潜力、摩擦风险
3. 双方特征差异对比 + 场景化相处建议
4. Engine + LLM → MatchResult（LLM 只润色文案）

## Mock 策略
- 基于图片 hash + 用户标点坐标 → 确定性输出，同一手掌永远相同结果
- 无标点时 hash fallback，confidence 下降但仍保证确定性
