#!/bin/bash
# 跨学习强制检查 — 确保每人至少审查1个非自己领域的产出
# 用法: bash scripts/cross-learning-check.sh [--report]
# 集成到 idle-review.sh

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TEAM_STATUS="$PROJECT_DIR/memory/team-status.json"
REPORT_FILE="/tmp/cross-learning-report.md"
OUTPUT_REPORT=false

[[ "${1:-}" == "--report" ]] && OUTPUT_REPORT=true

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 交叉审查矩阵: 每人应该审查谁的产出
declare -A CROSS_MATRIX
CROSS_MATRIX["nie"]="ma=工程/记忆,wang=文案/产品,zhou=安全/质量"
CROSS_MATRIX["ma"]="wang=文案/产品,zhou=安全/质量"
CROSS_MATRIX["wang"]="ma=工程/记忆,zhou=安全/质量"
CROSS_MATRIX["zhou"]="ma=工程/记忆,wang=文案/产品"

# 每个人的主领域
declare -A PRIMARY_DOMAIN
PRIMARY_DOMAIN["nie"]="methodology"
PRIMARY_DOMAIN["ma"]="engineering"
PRIMARY_DOMAIN["wang"]="product"
PRIMARY_DOMAIN["zhou"]="security"

echo "🔍 跨学习强制检查..."
echo ""

VIOLATIONS=0
COMPLIANT=0

check_member() {
  local member=$1
  local name=$2
  local target=$3

  # 检查 student-notebook/ 中是否有对target的审查笔记
  local REVIEWS=$(find "$PROJECT_DIR/student-notebook/" -name "*${member}*review*" -o -name "*${member}*audit*" -o -name "*cross*" 2>/dev/null | wc -l)

  # 检查是否有向target成员产出的交叉引用
  local CROSS_REFS=0
  for target_member in ma wang zhou nie; do
    [ "$target_member" = "$member" ] && continue
    if grep -rq "审查.*${target_member}\|review.*${target_member}\|audit.*${target_member}" "$PROJECT_DIR/student-notebook/" 2>/dev/null; then
      CROSS_REFS=$((CROSS_REFS + 1))
    fi
  done

  if [ "$REVIEWS" -ge 1 ] || [ "$CROSS_REFS" -ge 2 ]; then
    echo -e "  ${GREEN}✅${NC} ${name}: 交叉学习活跃 (审查${REVIEWS}份, 引用${CROSS_REFS}次)"
    COMPLIANT=$((COMPLIANT + 1))
  else
    echo -e "  ${RED}❌${NC} ${name}: 无交叉学习记录 — 需要审查${target}"
    VIOLATIONS=$((VIOLATIONS + 1))
  fi
}

# 检查每个成员 (排除老师自己)
check_member "ma" "马富贵" "王富贵或周富贵的产出"
check_member "wang" "王富贵" "马富贵或周富贵的产出"
check_member "zhou" "周富贵" "马富贵或王富贵的产出"

echo ""
if [ "$VIOLATIONS" -eq 0 ]; then
  echo -e "${GREEN}✅ 跨学习合规: 全部 ${COMPLIANT} 人通过${NC}"
else
  echo -e "${RED}⚠️ 跨学习违规: ${VIOLATIONS} 人无交叉记录${NC}"
  echo "  建议: 每人至少审查1个非自己领域的产出并写入 student-notebook/"
fi

# 生成报告
if $OUTPUT_REPORT; then
  cat > "$REPORT_FILE" << EOFREPORT
# 跨学习强制检查报告
> $(date '+%Y-%m-%d %H:%M:%S')

## 结果
- 合规: ${COMPLIANT}
- 违规: ${VIOLATIONS}

## 交叉审查矩阵
| 审查者 | 应审查对象 | 领域跨度 |
|--------|----------|---------|
| 聂富贵 | 马/王/周三人 | 全局→各领域 |
| 马富贵 | 王(文案)/周(安全) | 工程→产品/安全 |
| 王富贵 | 马(工程)/周(安全) | 产品→工程/安全 |
| 周富贵 | 马(工程)/王(文案) | 安全→工程/产品 |

## 违规详情
$([ "$VIOLATIONS" -gt 0 ] && echo "存在${VIOLATIONS}人无跨学习记录。触发PROTOCOL.md §6强制审查。" || echo "全部合规。")
EOFREPORT
  echo ""
  echo "报告已写入: $REPORT_FILE"
fi

exit 0
