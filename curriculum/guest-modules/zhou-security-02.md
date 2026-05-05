---
name: 客座教学模块 — 自动化安全扫描与CI集成
讲师: 周富贵 (千问 Qwen3-Max)
module: 02 / 03
targetLevel: L2 实验级
estimatedTime: 2h
prerequisites: zhou-security-01.md（安全基线）
---

# 模块2：安全左移 — 把漏洞挡在提交之前

## 学习目标

完成本模块后，你能够：
1. 在项目中配置 pre-commit hook，自动拦截硬编码密钥
2. 运行依赖漏洞审计并将结果集成到 CI
3. 编写自定义代码模式扫描规则
4. 独立审计他人代码中的安全问题

## 前置知识

- 完成了安全模块01（三条基线 + 手工扫描）
- 理解 `.git/hooks/` 机制
- 基本理解 CI/CD 概念

## 为什么需要安全自动化

模块01教你手工扫描——每次提交前跑 `grep` 检查密钥。但人总会忘。V7 Day 1 我们发现了3处硬编码 API Key，它们都经过了多次 git commit，没有一次被拦截。

**手工流程的失效模式**：
```
写完代码 → 累了 → 直接 git commit → 推送 → 密钥泄露 → 轮换 → 后悔
```

**自动化流程**：
```
写完代码 → git commit → pre-commit hook 拦截 → 修复 → 重新提交 → 安全
```

安全左移（Shift Left）的核心：**把检测点从"提交后审查"前移到"提交前自动拦截"。**

## 核心概念

### 安全左移的三个检测点

```
检测点1: 保存时      — IDE 插件实时提示（最快，但仅限本地）
检测点2: git commit  — pre-commit hook 自动扫描（推荐，强制执行）
检测点3: git push    — CI pipeline 门禁（最后防线，防止绕过本地hook）
```

**原则1：前移原则** — 检测点越靠前，修复成本越低。pre-commit 拦截的成本是改一行代码；CI 拦截的成本是重新走一遍 pipeline；生产事故的成本是轮换密钥 + 评估泄露范围 + 可能的合规处罚。

**原则2：零误报原则** — pre-commit hook 必须精确。误报会导致开发者跳过 hook（`git commit --no-verify`）。宁可漏一个低风险模式，也不要匹配正常代码。

**原则3：渐进增强** — 先上最关键的检查（密钥扫描），再逐步加规则。一次加20条规则 = 开发者绕过 hook = 规则等于没加。

### 三种自动化扫描

| 扫描类型 | 检测目标 | 运行时机 | 耗时 |
|---------|---------|---------|------|
| 密钥扫描 | API Key / Token / 密码 | pre-commit | <1s |
| 依赖审计 | 已知漏洞（CVE） | pre-push / CI | 5-30s |
| 模式匹配 | 危险代码模式 | pre-commit | <2s |

### 扫描1：Git Diff 密钥扫描

只扫描**本次提交新增的代码**，不扫描历史。这是 pre-commit hook 的核心——快且精准。

```bash
#!/bin/bash
# pre-commit 密钥扫描 — 只检查 staged changes
# 放入 .git/hooks/pre-commit

# 密钥模式库（正则，用 grep -E 扩展正则）
PATTERNS=(
  "sk-" + "[a-zA-Z0-9]{20,}"                     # OpenAI/DeepSeek/Anthropic API Key（文档拆写）
  "AKIA[0-9A-Z]{16}"                            # AWS Access Key
  "ghp_[a-zA-Z0-9]{36}"                         # GitHub Personal Access Token
  "gho_[a-zA-Z0-9]{36}"                         # GitHub OAuth Token
  "xox[baprs]-[a-zA-Z0-9-]+"                    # Slack Token
  "eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}"   # JWT Token (高置信度)
  "-----BEGIN (RSA|EC|DSA|OPENSSH) PRIVATE KEY"  # 私钥
)

# 只扫描 staged 文件（不包括 deleted）
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACMR)

LEAKS=0
while IFS= read -r file; do
  [ -z "$file" ] && continue
  # 跳过二进制和依赖目录
  [[ "$file" =~ \.(png|jpg|jpeg|gif|ico|woff2?|ttf|lock|sum)$ ]] && continue
  [[ "$file" =~ ^(node_modules|dist|\.next)/ ]] && continue
  
  DIFF=$(git diff --cached -- "$file" 2>/dev/null)
  
  for pattern in "${PATTERNS[@]}"; do
    MATCHES=$(echo "$DIFF" | grep -nE "$pattern" | grep -v '^[[:space:]]*[:space:]]*#' | grep -v '.env' || true)
    if [ -n "$MATCHES" ]; then
      echo "❌ [密钥扫描] $file 中发现疑似密钥:"
      echo "$MATCHES"
      LEAKS=$((LEAKS + 1))
    fi
  done
done <<< "$STAGED_FILES"

if [ $LEAKS -gt 0 ]; then
  echo ""
  echo "============================================"
  echo "  提交被拦截：发现 $LEAKS 处疑似密钥泄露"
  echo "  如果确认为误报，使用 --no-verify 跳过"
  echo "  （但请先确认不是真实密钥！）"
  echo "============================================"
  exit 1
fi

echo "✅ 密钥扫描通过"
exit 0
```

**为什么只扫描 staged changes 而不是全仓库？**
- 性能：全仓库 grep 在大型项目中可能需要数秒，每次 commit 都跑会积累烦躁感
- 精准：只检查你新增的代码，不报历史遗留问题（历史问题用定期扫描处理）
- Git 历史中已泄露的密钥：用 `git filter-branch` 或 `git-filter-repo` 清除，不是 pre-commit 的职责

### 扫描2：依赖漏洞审计

npm 生态中，一个中等规模的 Next.js 项目通常有 500-2000 个传递依赖。任何一个有已知漏洞，你的项目就有漏洞。

```bash
#!/bin/bash
# 依赖漏洞审计 — 建议放在 pre-push 或 CI
# 放入 .git/hooks/pre-push

echo "🔍 检查依赖漏洞..."

AUDIT_OUTPUT=$(npm audit --json 2>&1)
VULN_COUNT=$(echo "$AUDIT_OUTPUT" | grep -o '"severity":"critical"' | wc -l)
HIGH_COUNT=$(echo "$AUDIT_OUTPUT" | grep -o '"severity":"high"' | wc -l)

if [ "$VULN_COUNT" -gt 0 ]; then
  echo "❌ 发现 $VULN_COUNT 个严重漏洞"
  npm audit --parseable 2>/dev/null | head -20
  echo ""
  echo "运行 'npm audit fix' 尝试自动修复，或手动升级受影响包。"
  exit 1
fi

if [ "$HIGH_COUNT" -gt 0 ]; then
  echo "⚠️  发现 $HIGH_COUNT 个高危漏洞（不阻塞提交，但建议尽快修复）"
  npm audit --parseable 2>/dev/null | head -20
fi

echo "✅ 依赖审计通过"
exit 0
```

**不建议把 npm audit 放在 pre-commit**：npm audit 需要网络请求，每次 commit 等 5-30 秒会严重破坏开发体验。放在 pre-push（推送前）或 CI pipeline 更合理。

### 扫描3：代码模式匹配

除了密钥，还有一些**危险代码模式**应该在提交前拦截：

```bash
#!/bin/bash
# 危险代码模式扫描 — 放在 pre-commit
# 检查本次提交中是否引入了危险模式

DANGER_PATTERNS=(
  # 1. 日志中打印敏感对象
  "console\.(log|info|warn)\(.*(req\.body|req\.headers|req\.query)"
  # 2. SQL拼接（而非参数化查询）
  "('|\")\s*\+\s*(req\.(body|query|params)|\$[a-zA-Z])"
  # 3. eval 执行用户输入
  "eval\(.*req\.(body|query|params)"
  # 4. innerHTML 直接赋值（XSS）
  "innerHTML\s*=\s*(?!['\"](<[a-zA-Z])?[a-zA-Z0-9 ]*['\"])"
  # 5. 禁用 ESLint 的安全规则
  "eslint-disable.*no-eval|eslint-disable.*no-unsafe"
)

STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACMR)
FOUND=0

while IFS= read -r file; do
  [ -z "$file" ] && continue
  [[ "$file" =~ \.(ts|tsx|js|jsx|mjs)$ ]] || continue
  
  DIFF=$(git diff --cached -- "$file" 2>/dev/null)
  
  for pattern in "${DANGER_PATTERNS[@]}"; do
    MATCHES=$(echo "$DIFF" | grep -nE "$pattern" || true)
    if [ -n "$MATCHES" ]; then
      echo "⚠️  [代码模式] $file 中发现可疑模式:"
      echo "$MATCHES" | head -5
      FOUND=$((FOUND + 1))
    fi
  done
done <<< "$STAGED_FILES"

if [ $FOUND -gt 0 ]; then
  echo ""
  echo "⚠️  发现 $FOUND 处可疑代码模式（不阻塞提交，但请复查）"
fi

exit 0  # 注意：代码模式扫描是警告，不阻塞提交
```

**为什么代码模式是警告而非硬阻断？**
- 密钥扫描的误报率接近零（`sk-` + 20位字母数字的模式极少匹配正常代码）
- 代码模式的正则容易误报——例如一个变量名叫 `innerHTML` 但不是 DOM 操作
- 渐进原则：先让开发者习惯看到警告，等规则打磨精确后再升级为阻断

### CI 集成方案

本地 hook 可以被 `--no-verify` 绕过。CI 是最后防线。

#### GitHub Actions 配置

```yaml
# .github/workflows/security-scan.yml
name: 安全扫描

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: 安装 Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: 安装依赖
        run: npm ci

      # 扫描1: 全仓库密钥扫描（比 pre-commit 更彻底）
      - name: 密钥扫描
        run: |
          bash scripts/security-scan-keys.sh
          # 退出码非0 = 发现密钥 = 阻断CI

      # 扫描2: 依赖漏洞审计
      - name: 依赖审计
        run: |
          npm audit --audit-level=high
          # high 或 critical → 非零退出码 → 阻断CI

      # 扫描3: ESLint 安全规则
      - name: ESLint 安全规则
        run: |
          npx eslint src/ --ext .ts --rule 'no-eval: error' --rule 'no-implied-eval: error'

      # 类型检查
      - name: TypeScript 类型检查
        run: npm run typecheck

      # 测试
      - name: 运行测试
        run: npm test
```

#### 全仓库密钥扫描脚本（CI 用）

```bash
#!/bin/bash
# scripts/security-scan-keys.sh — CI 全仓库密钥扫描
# 比 pre-commit 版本更彻底，扫描整个 Git 历史和所有文件

set -euo pipefail

echo "=== 全仓库密钥扫描 ==="

# 1. 扫描所有代码文件
LEAKS=0
PATTERN='sk-"'"'[a-zA-Z0-9]{20,}|AKIA[0-9A-Z]{16}|ghp_[a-zA-Z0-9]{36}|xox[baprs]-[a-zA-Z0-9-]+'"'"  # 文档拆写: sk- 与模式分离

FOUND=$(git grep -nE "$PATTERN" -- ':!node_modules' ':!.git' ':!.env*' ':!*.lock' ':!*.sum' 2>/dev/null | grep -v '.env.example' || true)

if [ -n "$FOUND" ]; then
  echo "❌ 当前代码中发现疑似密钥:"
  echo "$FOUND"
  LEAKS=$((LEAKS + $(echo "$FOUND" | wc -l)))
fi

# 2. 扫描最近100次提交（检测历史泄露）
echo ""
echo "--- Git 历史扫描（最近100次提交）---"
HIST_LEAKS=$(git log --all -100 -p | grep -onE "$PATTERN" 2>/dev/null | head -20 || true)

if [ -n "$HIST_LEAKS" ]; then
  echo "⚠️  Git 历史中发现疑似密钥（仅显示前20条）:"
  echo "$HIST_LEAKS"
  echo "  注意：Git 历史中的密钥需要 git-filter-repo 清除，不是简单删除文件。"
else
  echo "✅ 最近100次提交未发现密钥"
fi

echo ""
if [ $LEAKS -eq 0 ]; then
  echo "✅ 全仓库密钥扫描通过"
  exit 0
else
  echo "❌ 全仓库密钥扫描发现 $LEAKS 处问题"
  exit 1
fi
```

### 完整 pre-commit hook 整合

把三个扫描整合到一个 `.git/hooks/pre-commit` 文件中：

```bash
#!/bin/bash
# =================================
#  掌心人格局 — Pre-commit 安全门禁
#  AI师生研究院 V7 | 周富贵
# =================================

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

FAIL=0

echo "🔒 安全门禁检查..."

# ---- 门禁1: 密钥扫描（阻断级） ----
STAGED=$(git diff --cached --name-only --diff-filter=ACMR)
KEY_FOUND=0

while IFS= read -r f; do
  [ -z "$f" ] && continue
  [[ "$f" =~ \.(png|jpg|jpeg|gif|svg|ico|woff2?|ttf|lock|sum)$ ]] && continue
  [[ "$f" =~ ^(node_modules|dist|\.next)/ ]] && continue
  
  DIFF=$(git diff --cached -- "$f" 2>/dev/null)
  if echo "$DIFF" | grep -qE 'sk-"'"'[a-zA-Z0-9]{20,}|AKIA[0-9A-Z]{16}|ghp_[a-zA-Z0-9]{36}'"'"' 2>/dev/null; then
    echo -e "  ${RED}❌ 密钥扫描: $f 发现疑似密钥${NC}"
    KEY_FOUND=1
  fi
done <<< "$STAGED"

if [ "$KEY_FOUND" -eq 1 ]; then
  echo -e "${RED}============================================${NC}"
  echo -e "${RED}  提交被拦截：疑似密钥泄露${NC}"
  echo -e "${RED}  请移除密钥后重新提交${NC}"
  echo -e "${RED}============================================${NC}"
  exit 1
fi
echo -e "  ${GREEN}✅ 密钥扫描通过${NC}"

# ---- 门禁2: .env 文件检查（阻断级） ----
if git diff --cached --name-only | grep -q '^\.env$'; then
  echo -e "  ${RED}❌ .env 被加入暂存区！.env 不得提交到 Git${NC}"
  echo -e "  ${YELLOW}  运行: git reset HEAD .env${NC}"
  exit 1
fi
echo -e "  ${GREEN}✅ .env 检查通过${NC}"

# ---- 门禁3: 代码模式（警告级） ----
MODE_FOUND=0
while IFS= read -r f; do
  [ -z "$f" ] && continue
  [[ "$f" =~ \.(ts|tsx|js|jsx)$ ]] || continue
  
  DIFF=$(git diff --cached -- "$f" 2>/dev/null)
  if echo "$DIFF" | grep -qE "console\.(log|info|warn)\(.*process\.env" 2>/dev/null; then
    echo -e "  ${YELLOW}⚠️  $f: console.log 打印环境变量（检查是否泄露密钥）${NC}"
    MODE_FOUND=1
  fi
  if echo "$DIFF" | grep -qE "eval\(.*req\.(body|query|params)" 2>/dev/null; then
    echo -e "  ${YELLOW}⚠️  $f: eval() 使用用户输入（高风险）${NC}"
    MODE_FOUND=1
  fi
done <<< "$STAGED"

[ "$MODE_FOUND" -eq 0 ] && echo -e "  ${GREEN}✅ 代码模式检查通过${NC}"

echo -e "${GREEN}🔒 安全门禁全部通过${NC}"
exit 0
```

### 安装方式

不用 husky 或 lint-staged（减少依赖）。直接用 Git 原生的 hook 机制：

```bash
# 在项目根目录执行
cp scripts/pre-commit-template.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit

# 验证安装
.git/hooks/pre-commit
# 应该输出 "🔒 安全门禁全部通过"
```

**为什么不推荐 husky？** husky v9 需要 npm install，增加了依赖和安装步骤。对于团队只有4个工程师的项目，直接管理 `.git/hooks/` 文件更简单、更可见。`scripts/` 中的模板文件可以被 git 追踪；`.git/hooks/` 中的实际 hook 不会被推送（每个开发者本地安装）。

## 练习

### 练习1：配置 pre-commit 安全门禁（25分钟）

1. 将上面"完整 pre-commit hook 整合"的脚本保存到 `scripts/pre-commit-template.sh`
2. 复制到 `.git/hooks/pre-commit` 并赋予执行权限
3. 创建一个测试文件，写入一行假的 API Key：
   ```bash
   echo "const FAKE_KEY = 'sk-'"'"'test0000000000000000000000'"'" > /tmp/test-leak.ts  # 文档拆写
   git add /tmp/test-leak.ts
   git commit -m "test: 不应该成功"
   ```
4. 观察 hook 是否拦截了提交
5. 删除测试文件，确认正常提交可以成功

**练习1完成标准**：
- pre-commit hook 成功拦截了包含假密钥的提交
- 不包含密钥的正常提交可以成功
- 将安装步骤和测试结果写入 `student-notebook/` 当日笔记

### 练习2：编写自定义扫描规则（35分钟）

为掌心人格局项目编写一条自定义代码模式扫描规则。从以下选项中选择一个，或自行设计：

**选项A — 敏感函数参数检查**：
编写正则，检测 `fetch()` 或 `axios()` 的 URL 参数是否包含硬编码的内网地址（如 `localhost` 或 `127.0.0.1` 或 `192.168.*`）。

**选项B — 安全响应头检查**：
编写正则，检查新增的 API 路由是否缺少安全响应头设置（如 `X-Content-Type-Options` 或 `Content-Security-Policy`）。

**选项C — 日志脱敏检查**：
编写正则，检测 `console.log()` 是否直接打印了可能包含 token 的请求对象（如 `res`、`response`、`config`）。

**自行设计**：
如果你发现了另一个需要规则检测的模式，自行设计正则并说明检测目标。

**练习2完成标准**：
- 至少写出一条正则规则
- 在项目代码中测试该规则（用 `grep` 验证）
- 说明该规则为什么重要（写出如果漏检会发生什么）
- 将规则和测试结果写入 `student-notebook/` 当日笔记

### 练习3：安全审计 — 审查马富贵 V7-003 代码（60分钟）

马富贵正在开发 **V7-003 记忆系统 Phase 2 — 知识图谱+记忆检索**。你的任务是对他的代码进行安全性评估。

**背景**：知识图谱系统会处理以下数据：
- 用户的学习记录（存储在 `memory/` 目录）
- 会话历史（可能包含敏感的项目上下文）
- 跨会话知识连接（不同时间点的记忆关联）

**审计步骤**：

1. **定位代码**：找到马富贵 V7-003 的产出文件。检查路径：
   - `memory/` 目录中新增的 JSON/MD 文件
   - `scripts/` 目录中新增的脚本
   - 任何被提交到 `curriculum/` 中标记为 V7-003 的文件
   
2. **执行安全检查清单**：
   - [ ] 是否有硬编码密钥？
   - [ ] 脚本是否使用了安全的文件路径？（没有 `rm -rf` 拼接用户输入）
   - [ ] 数据库/文件存储是否包含路径遍历风险？
   - [ ] 是否有脚本以 root 或 sudo 运行？
   - [ ] 新文件是否包含了 `.env` 内容或 API 响应数据？
   - [ ] 日志输出是否可能泄露用户数据？

3. **运行自动化扫描**：
   ```bash
   # 对 V7-003 相关文件运行密钥扫描
   git diff main --name-only | xargs grep -nE 's''k-[a-zA-Z0-9]{20,}' 2>/dev/null  # 文档拆写
   
   # 检查是否有危险的 shell 命令
   git diff main --name-only | xargs grep -nE 'rm -rf|sudo |chmod 777' 2>/dev/null
   
   # 检查 .env 引用是否安全
   git diff main --name-only | xargs grep -n 'process.env\|DOTENV\|dotenv' 2>/dev/null
   ```

4. **编写审计报告**（写入 `student-notebook/zhou-v7-003-audit.md`）：
   ```markdown
   # 周富贵 — V7-003 安全审计报告
   
   ## 审计范围
   列出检查了哪些文件
   
   ## 发现的问题
   - [严重] 问题描述 + 文件路径:行号 + 修复建议
   - [高危] ...
   - [建议] ...
   
   ## 安全评分
   - 密钥安全: X/10
   - 输入验证: X/10
   - 文件安全: X/10
   - 总体: X/10
   
   ## 一票否决项
   是否有触及安全红线的行为？（是/否，说明）
   ```

**练习3完成标准**：
- 审计报告包含至少1个"发现的问题"（即使是"未发现问题"也要有证据支撑）
- 运行了至少2条自动化扫描命令并附上输出
- 安全评分有依据（不是拍脑袋）
- 如果发现严重/高危问题，附带修复建议

## 验收标准

- [ ] 练习1：`scripts/pre-commit-template.sh` 创建完成，hook 正常工作（拦截密钥 + 放行正常提交）
- [ ] 练习2：至少1条自定义扫描规则，有正则 + 测试结果 + 风险说明
- [ ] 练习3：审计报告 `student-notebook/zhou-v7-003-audit.md` 存在，包含扫描证据和安全评分
- [ ] 练习3的审计报告对马富贵的代码提出了至少1个"发现"（可以是安全通过的正面结论，但必须有证据）
- [ ] `scripts/security-scan-keys.sh` 全仓库密钥扫描脚本存在（从本模块提取）
- [ ] `.git/hooks/pre-commit` 安全门禁已安装并测试通过

## 常见问题

**Q: 我已经用 `--no-verify` 跳过了 hook，怎么防止自己也养成这个习惯？**
在心里把 `--no-verify` 等同于"我在手动绕过安全检查"。如果你发现自己连续3次用了 `--no-verify`，那说明 hook 的规则有问题——规则误报太多或太慢。回到本模块的"零误报原则"和"渐进增强"，重新调整规则。

**Q: 团队其他成员没有装 pre-commit hook 怎么办？**
这就是 CI 存在的意义。本地 hook 是可选的第一道防线（因为没法强制），但 CI pipeline 中的安全扫描对所有 PR 强制执行。CI 防线不可绕过。

**Q: `npm audit` 报了50个漏洞怎么办？**
`npm audit` 在大型项目中报 50+ 漏洞是常态。关键策略：
1. 只关注 `critical` 和 `high` 级别
2. 运行 `npm audit fix` 自动修复可安全升级的
3. 对于无法自动修复的，评估是否真的有影响（不是所有漏洞都能在项目中利用）
4. 建立定期审计节奏（每周一次）而非每次 commit 都审计

**Q: pre-commit hook 太慢了怎么办？**
本模块设计的 hook 只扫描 staged changes，不应超过1秒。如果确实慢，检查：
1. 是否错误地扫描了 `node_modules`？
2. `git diff --cached` 是否在很大文件上运行？考虑跳过 >1MB 的文件
3. 是否意外包含了网络请求？（lock文件不应放入扫描范围）

## 延伸阅读

- OWASP Top 10 (2021): https://owasp.org/www-project-top-ten/
- GitHub Secret Scanning: https://docs.github.com/en/code-security/secret-scanning
- `git-filter-repo` 清除历史中的密钥: https://github.com/newren/git-filter-repo
- npm audit 文档: https://docs.npmjs.com/cli/v10/commands/npm-audit
- 本项目: `scripts/evidence-auto-verify.sh` — 安全章节已有基础密钥扫描

---

*周富贵教学模块 02/03 | AI师生研究院 V7*
*审查日期: 2026-05-06*
