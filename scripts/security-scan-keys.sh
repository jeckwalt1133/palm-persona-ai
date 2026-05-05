#!/bin/bash
# =================================
#  掌心人格局 — CI 全仓库密钥扫描
#  比 pre-commit 版本更彻底：扫描当前文件 + Git 历史
#  用法: bash scripts/security-scan-keys.sh
#  退出码: 0=通过 1=发现密钥 2=脚本错误
# =================================

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

LEAKS=0

echo "=== 全仓库密钥扫描 ==="
echo ""

# 密钥模式（与 pre-commit 保持一致，但更全面）
PATTERN='sk-[a-zA-Z0-9]{20,}|AKIA[0-9A-Z]{16}|ghp_[a-zA-Z0-9]{36}|gho_[a-zA-Z0-9]{36}|xox[baprs]-[a-zA-Z0-9-]+|-----BEGIN (RSA|EC|DSA|OPENSSH) PRIVATE KEY'

# 排除占位符/示例密钥（全是相同字符、递增数字、或明确标记为示例的模式）
is_false_positive() {
  local line="$1"
  # 占位符模式: sk-xxx...（全x）、sk-123456...（纯递增）、sk-aaaa...（全a）
  echo "$line" | grep -qE 'sk-x{20,}|sk-1{5,}2{5,}3{5,}|sk-a{20,}|sk-test|sk-dummy|sk-example|sk-<|REDACTED|sk-fake' && return 0
  # 注释或文档中的示例说明
  echo "$line" | grep -qE '(placeholder|dummy|example|示例|假|占位|FAKE_KEY|test-leak)' && return 0
  return 1
}

# ---- 1. 扫描当前所有跟踪的文件 ----
echo "--- 当前文件扫描 ---"
RAW_FOUND=$(git grep -nE "$PATTERN" -- ':!node_modules' ':!.git' ':!.env*' ':!*.lock' ':!*.sum' ':!*.sample' 2>/dev/null | grep -v '.env.example' || true)

# 过滤误报
FOUND=""
while IFS= read -r line; do
  [ -z "$line" ] && continue
  if is_false_positive "$line"; then
    echo "  ⏭️  跳过示例/占位符: $(echo "$line" | cut -c1-80)"
  else
    FOUND="${FOUND}${line}\n"
  fi
done <<< "$RAW_FOUND"

if [ -n "$FOUND" ]; then
  echo -e "${RED}❌ 当前代码中发现疑似密钥:${NC}"
  echo -e "$FOUND"
  LEAKS=$((LEAKS + $(echo -e "$FOUND" | grep -c 'sk-' || true)))
else
  echo -e "${GREEN}✅ 当前文件未发现密钥${NC}"
fi

# ---- 2. 扫描未跟踪文件中的密钥（新增的但未 git add 的文件） ----
echo ""
echo "--- 未跟踪文件扫描 ---"
# 只扫描代码类未跟踪文件
UNTRACKED_FOUND=0
while IFS= read -r f; do
  [ -z "$f" ] && continue
  [[ "$f" =~ \.(ts|tsx|js|jsx|sh|json|yml|yaml|md)$ ]] || continue
  [[ "$f" =~ node_modules|\.git ]] && continue

  while IFS= read -r match_line; do
    [ -z "$match_line" ] && continue
    if is_false_positive "$match_line"; then
      echo "  ⏭️  跳过示例/占位符: $f: $(echo "$match_line" | cut -c1-80)"
    else
      echo -e "${RED}❌ $f 中发现疑似密钥:${NC}"
      echo "$match_line"
      UNTRACKED_FOUND=$((UNTRACKED_FOUND + 1))
    fi
  done < <(grep -nE "$PATTERN" "$f" 2>/dev/null | grep -v '.env.example' || true)
done < <(git ls-files --others --exclude-standard 2>/dev/null || true)

if [ "$UNTRACKED_FOUND" -eq 0 ]; then
  echo -e "${GREEN}✅ 未跟踪文件未发现密钥${NC}"
else
  LEAKS=$((LEAKS + UNTRACKED_FOUND))
fi

# ---- 3. Git 历史扫描（最近100次提交） ----
echo ""
echo "--- Git 历史扫描（最近100次提交）---"
HIST_LEAKS=$(git log --all -100 -p | grep -onE "$PATTERN" 2>/dev/null | head -20 || true)

if [ -n "$HIST_LEAKS" ]; then
  echo -e "${YELLOW}⚠️  Git 历史中发现疑似密钥（仅显示前20条）:${NC}"
  echo "$HIST_LEAKS"
  echo ""
  echo -e "  ${YELLOW}注意：Git 历史中的密钥需要 git-filter-repo 清除${NC}"
  echo -e "  ${YELLOW}参考: https://github.com/newren/git-filter-repo${NC}"
else
  echo -e "${GREEN}✅ 最近100次提交未发现密钥${NC}"
fi

# ---- 汇总 ----
echo ""
echo "============================================"
if [ "$LEAKS" -eq 0 ]; then
  echo -e "  ${GREEN}全仓库密钥扫描通过 ✅${NC}"
  exit 0
else
  echo -e "  ${RED}全仓库密钥扫描发现 $LEAKS 处问题 ❌${NC}"
  exit 1
fi
