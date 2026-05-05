#!/bin/bash
# 富贵军团团队广播 — 一键发送 TaskCard 给多个成员
#
# 用法:
#   team-broadcast.sh <task-card.json>                    发送给指定接收者 (JSON 中定义)
#   team-broadcast.sh <task-card.json> --all              发送给全体3个学生成员
#   team-broadcast.sh <task-card.json> --to ma,wang       发送给指定成员
#   team-broadcast.sh <task-card.json> --dry-run          仅验证不发送
#
# 示例:
#   team-broadcast.sh tasks/week5-review.json --all
#   team-broadcast.sh tasks/week5-review.json --to ma,zhou --notify
#
# 依赖: scripts/agent-router.py

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROUTER="$PROJECT_DIR/scripts/agent-router.py"
START_TIME=$(date +%s%3N)

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

usage() {
  cat << 'EOF'
团队广播 — 一键发送 TaskCard 给多个成员

用法:
  team-broadcast.sh <task-card.json> [选项]

选项:
  --all                 发送给全体学生成员 (ma, wang, zhou)
  --to ma,wang,zhou     发送给指定成员 (逗号分隔)
  --notify              同时 tmux 通知接收者
  --dry-run             仅验证不发送
  --ttl SECONDS         TTL 超时 (默认使用 Card 自带 ttlSeconds 或默认值)

示例:
  team-broadcast.sh tasks/week5-review.json --all --notify
  team-broadcast.sh tasks/week5-review.json --to ma,zhou
  team-broadcast.sh tasks/week5-review.json --all --dry-run
EOF
  exit 0
}

# ── 参数解析 ──
CARD_FILE=""
TARGETS=()
NOTIFY=""
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --help|-h) usage ;;
    --all) TARGETS=(ma wang zhou); shift ;;
    --to)
      IFS=',' read -ra TARGETS <<< "$2"
      shift 2 ;;
    --notify) NOTIFY="--notify"; shift ;;
    --dry-run) DRY_RUN=true; shift ;;
    --ttl) TTL_ARG="--ttl $2"; shift 2 ;;
    *)
      if [[ -z "$CARD_FILE" ]]; then
        CARD_FILE="$1"
        shift
      else
        echo "未知参数: $1"
        usage
      fi ;;
  esac
done

if [[ -z "$CARD_FILE" ]]; then
  echo "❌ 缺少 task-card.json 参数"
  usage
fi

if [[ ! -f "$CARD_FILE" ]]; then
  echo "❌ 文件不存在: $CARD_FILE"
  exit 1
fi

if [[ ${#TARGETS[@]} -eq 0 ]]; then
  # 没有 --all/--to → 直接用 Card 自带的 receiver
  TARGETS=("__FROM_CARD__")
fi

# ── 验证 ──
echo -e "${CYAN}═══ 富贵军团团队广播 ═══${NC}"
echo "Card: $CARD_FILE"
echo "目标: ${TARGETS[*]}"
echo ""

# 先验证原始 Card
echo -n "验证 Card Schema... "
VALIDATE_OUT=$("$ROUTER" validate "$CARD_FILE" 2>&1) && VALIDATE_OK=true || VALIDATE_OK=false
if $VALIDATE_OK; then
  echo -e "${GREEN}✅ 通过${NC}"
else
  echo -e "${RED}❌ 失败${NC}"
  echo "$VALIDATE_OUT"
  exit 1
fi

if $DRY_RUN; then
  echo ""
  echo -e "${YELLOW}[DRY RUN] 不实际发送。Card 验证通过，准备就绪。${NC}"
  exit 0
fi

# ── 读取原始 Card ──
CARD_JSON=$(cat "$CARD_FILE")

# ── 发送 ──
SUCCESS_COUNT=0
FAIL_COUNT=0
declare -A RESULTS
declare -A LATENCIES

for target in "${TARGETS[@]}"; do
  echo ""
  echo -n "  ▶ 发送给 $target ... "

  SEND_START=$(date +%s%3N)

  if [[ "$target" == "__FROM_CARD__" ]]; then
    # 使用 Card 自带的 receiver
    SEND_OUT=$("$ROUTER" send "$CARD_FILE" ${NOTIFY} ${TTL_ARG:-} 2>&1) && SEND_OK=true || SEND_OK=false
    # 从输出中提取 receiver
    target=$(echo "$CARD_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['params']['receiver']['agentId'])" 2>/dev/null || echo "unknown")
  else
    # 替换 receiver 为当前目标
    MODIFIED_CARD=$(echo "$CARD_JSON" | python3 -c "
import json, sys
card = json.load(sys.stdin)
card['params']['receiver'] = {
    'agentId': '$target',
    'name': {'ma': '马富贵', 'wang': '王富贵', 'zhou': '周富贵', 'nie': '聂富贵'}.get('$target', '$target'),
    'role': {'ma': 'student', 'wang': 'product_manager', 'zhou': 'quality_engineer', 'nie': 'teacher'}.get('$target', 'unknown')
}
# 更新消息 ID 以避免冲突
import time
card['id'] = card['id'] + '-$target'
print(json.dumps(card, ensure_ascii=False))
")
    TMP_CARD="/tmp/broadcast-$$-$target.json"
    echo "$MODIFIED_CARD" > "$TMP_CARD"
    SEND_OUT=$("$ROUTER" send "$TMP_CARD" ${NOTIFY} ${TTL_ARG:-} 2>&1) && SEND_OK=true || SEND_OK=false
    rm -f "$TMP_CARD"
  fi

  SEND_END=$(date +%s%3N)
  LATENCY=$((SEND_END - SEND_START))

  if $SEND_OK; then
    echo -e "${GREEN}✅ 送达 (${LATENCY}ms)${NC}"
    echo "     $SEND_OUT"
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    RESULTS["$target"]="✅"
    LATENCIES["$target"]=$LATENCY
  else
    echo -e "${RED}❌ 失败${NC}"
    echo "     $SEND_OUT"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    RESULTS["$target"]="❌"
    LATENCIES["$target"]=$LATENCY
  fi
done

# ── 汇总 ──
TOTAL_TIME=$(($(date +%s%3N) - START_TIME))
echo ""
echo -e "${CYAN}═══ 广播结果 ═══${NC}"
for target in "${!RESULTS[@]}"; do
  echo -e "  ${RESULTS[$target]} $target — ${LATENCIES[$target]}ms"
done
echo ""
echo -e "成功: ${GREEN}$SUCCESS_COUNT${NC} / 失败: ${RED}$FAIL_COUNT${NC} / 总耗时: ${TOTAL_TIME}ms"

if [[ $SUCCESS_COUNT -gt 0 && $FAIL_COUNT -eq 0 ]]; then
  echo -e "${GREEN}✅ 全部送达${NC}"
  exit 0
elif [[ $SUCCESS_COUNT -gt 0 ]]; then
  echo -e "${YELLOW}⚠ 部分成功${NC}"
  exit 2
else
  echo -e "${RED}❌ 全部失败${NC}"
  exit 1
fi
