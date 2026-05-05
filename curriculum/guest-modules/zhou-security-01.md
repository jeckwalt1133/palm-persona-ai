---
name: 客座教学模块 — 安全基线
讲师: 周富贵 (千问 Qwen3-Max)
module: 01 / 03
targetLevel: L1 复现级
estimatedTime: 1h
prerequisites: onboarding.md Day 1
---

# 模块1：安全基线 — 你的代码不能成为事故

## 学习目标

完成本模块后，你能够：
1. 在项目中自动检测硬编码密钥
2. 理解并修复一个真实的安全漏洞
3. 写出不会引入新安全问题的代码

## 前置知识

- 完成了 onboarding Day 1
- 基本理解 `.env` 文件的作用

## 为什么安全是第一个模块

AI师生研究院 V7 Day 1 发现3处硬编码API Key。这些Key已经在Git历史中，需要轮换。在写任何新代码之前，你必须先学会**不引入新的安全问题**。

**安全不是"高级话题"，是第一天就要建立的肌肉记忆。**

## 核心概念

### 三条安全基线

```
基线1: 密钥永远不在代码中
基线2: .env 永远在 .gitignore 中
基线3: 提交前永远检查 git diff
```

### 常见的密钥泄露场景

| 场景 | 示例 | 怎么避免 |
|------|------|---------|
| 脚本硬编码 | `API_KEY=sk-xxx ./script.sh` | 从 .env 读取 |
| 配置文件硬编码 | settings.json 里的 apiKey | 使用环境变量引用 |
| 日志泄露 | `console.log(response)` 打印了包含token的请求 | 日志脱敏函数 |
| Git历史泄露 | 提交后删除文件但Git历史留着 | `git log -p \| grep sk-` 定期检查 |
| tmux历史泄露 | `export KEY=sk-xxx` 在终端历史中 | 使用 `read -s` 或在 .env 中配置 |

### 本项目中的真实案例（已修复）

```bash
# ❌ 错误（V7之前）：在 watchdog 脚本中硬编码
tmux send-keys "export ANTHROPIC_API_KEY='sk-f9a088...'" Enter

# ✅ 正确（V7 Day 1）：从 .env 读取
# shellcheck disable=SC2046
export $(grep -v '^\s*#' "$ENV_FILE" | xargs)
tmux send-keys "export ANTHROPIC_API_KEY='${DEEPSEEK_API_KEY}'" Enter
```

## 练习

### 练习1：安全扫描（15分钟）

在你的项目中运行以下命令，检查是否有硬编码密钥：

```bash
# 扫描所有脚本和代码中的API Key格式
grep -rn "sk-[a-zA-Z0-9]\{20,\}" --include="*.sh" --include="*.ts" --include="*.js" --include="*.json" . 2>/dev/null | grep -v node_modules | grep -v .env

# 检查 .env 是否在 .gitignore 中
grep "\.env" .gitignore

# 检查 Git 历史中是否有密钥
git log --all -p | grep -o "sk-[a-zA-Z0-9]\{20,\}" | sort -u
```

把扫描结果写入笔记本。如果发现任何密钥，**立即报告老师**，不要自己删除或修改。

### 练习2：补一个安全漏洞（20分钟）

以下是一个存在安全问题的代码片段。找出问题并写出修复方案：

```typescript
// server/src/api/debug.ts
app.get('/api/debug/config', (req, res) => {
  res.json({
    aiProvider: process.env.AI_PROVIDER,
    apiKey: process.env.DEEPSEEK_API_KEY,  // ← 问题在这里
    model: process.env.AI_MODEL,
    allEnv: process.env  // ← 这里也有问题
  });
});
```

要求：
1. 指出两处安全问题的具体风险
2. 写出修复后的代码
3. 解释为什么修复后的版本是安全的

### 练习3：编写安全提交检查清单（25分钟）

为你自己的日常开发编写一份个人安全检查清单。参考周富贵的通用清单，但针对你自己的工作习惯定制。

通用清单：
- [ ] `git diff` 中没有任何 API Key
- [ ] 新增文件没有硬编码密钥
- [ ] `.env` 在 `.gitignore` 中
- [ ] `console.log` 没有打印敏感信息
- [ ] 运行过 `bash scripts/evidence-auto-verify.sh` 安全章节

你的个人清单应该额外包含你容易犯的错误（自己知道自己的弱点）。

## 验收标准

- [ ] 练习1：扫描报告完整，无遗漏
- [ ] 练习2：正确识别两处安全问题+给出正确修复
- [ ] 练习3：个人安全清单 ≥5项，包含至少1个"自己容易犯的"错误
- [ ] 所有练习写入 `student-notebook/` 当日笔记

## 安全红线（一票否决）

以下行为，无论任何理由，直接判定违规：
1. 将API Key写入代码文件
2. 将.env提交到Git
3. 在日志中打印API Key
4. 在公开文档中粘贴包含密钥的代码片段
5. 发现密钥泄露后不报告

**V7 Day 1 已经发生过3次事故。不能再有第4次。**

---

*周富贵教学模块 01/03 | AI师生研究院 V7*
