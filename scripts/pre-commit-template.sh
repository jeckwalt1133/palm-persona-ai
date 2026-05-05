#!/bin/bash
# =================================
#  掌心人格局 — Pre-commit 安全门禁（模板）
#  AI师生研究院 V7 | 周富贵
#
#  安装: cp scripts/pre-commit-template.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
#  注意: 本文件是模板，实际运行的 hook 在 .git/hooks/pre-commit
# =================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "🔒 安全门禁检查..."

# ---- 门禁1: 密钥扫描（阻断级） ----
STAGED=$(git diff --cached --name-only --diff-filter=ACMR)
KEY_FOUND=0

while IFS= read -r f; do
  [ -z "$f" ] && continue
  [[ "$f" =~ \.(png|jpg|jpeg|gif|svg|ico|woff2?|ttf|lock|sum)$ ]] && continue
  [[ "$f" =~ ^(node_modules|dist|\.next)/ ]] && continue

  # 只扫描新增行（+），不扫描删除行（-）。删除密钥是安全的
  DIFF=$(git diff --cached -- "$f" 2>/dev/null)
  if echo "$DIFF" | grep -E '^\+' | grep -qE 'sk-[a-zA-Z0-9]{20,}|AKIA[0-9A-Z]{16}|ghp_[a-zA-Z0-9]{36}' 2>/dev/null; then
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

  # 只扫描新增行（+），不扫描删除行（-）。删除密钥是安全的
  DIFF=$(git diff --cached -- "$f" 2>/dev/null)
  if echo "$DIFF" | grep -E '^\+' | grep -qE "console\.(log|info|warn)\(.*process\.env" 2>/dev/null; then
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
