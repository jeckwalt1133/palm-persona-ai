#!/bin/bash
# 富贵军团 inbox 检查器 — 查看待处理消息
#
# 用法:
#   check-inbox.sh                   显示当前 Agent 的 inbox (自动检测)
#   check-inbox.sh --agent ma        显示指定 Agent 的 inbox
#   check-inbox.sh --agent ma --ack  确认收到所有消息
#   check-inbox.sh --all             显示所有成员 inbox 状态
#   check-inbox.sh --watch           持续监控模式 (每30秒刷新)
#
# 依赖: scripts/agent-router.py

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ROUTER="$PROJECT_DIR/scripts/agent-router.py"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

usage() {
  cat << 'EOF'
Inbox 检查器 — 查看待处理消息

用法:
  check-inbox.sh [选项]

选项:
  --agent AGENT_ID    查看指定 Agent 的 inbox
  --ack               确认收到所有未读消息
  --all               显示所有成员 inbox 状态概览
  --watch             持续监控模式 (每30秒刷新, Ctrl+C 退出)

示例:
  check-inbox.sh --agent ma              马富贵的待处理消息
  check-inbox.sh --agent ma --ack        确认收到
  check-inbox.sh --all                   全员概览
  check-inbox.sh --watch                 持续监控
EOF
  exit 0
}

# ── 参数解析 ──
AGENT_ID=""
DO_ACK=false
SHOW_ALL=false
WATCH_MODE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --help|-h) usage ;;
    --agent) AGENT_ID="$2"; shift 2 ;;
    --ack) DO_ACK=true; shift ;;
    --all) SHOW_ALL=true; shift ;;
    --watch) WATCH_MODE=true; shift ;;
    *) echo "未知参数: $1"; usage ;;
  esac
done

# ── 自动检测当前 Agent ──
detect_agent() {
  local session
  session=$(tmux display-message -p '#S' 2>/dev/null || echo "")
  case "$session" in
    claude-ma|claude-student) echo "ma" ;;
    claude-wang) echo "wang" ;;
    claude-zhou) echo "zhou" ;;
    claude-nie) echo "nie" ;;
    *) echo "" ;;
  esac
}

# ── 单 Agent inbox 显示 ──
show_agent_inbox() {
  local agent="$1"
  local name="${2:-$agent}"

  echo -e "${BOLD}━━━ $name ($agent) ━━━${NC}"

  # 检查 inbox 目录
  local inbox_dir="$PROJECT_DIR/messages/inbox/$agent"
  if [[ ! -d "$inbox_dir" ]]; then
    echo "  (inbox 不存在)"
    return
  fi

  # 统计 .json 文件 (排除 .tmp)
  local json_count
  json_count=$(find "$inbox_dir" -maxdepth 1 -name '*.json' ! -name '*.tmp' 2>/dev/null | wc -l)
  local tmp_count
  tmp_count=$(find "$inbox_dir" -maxdepth 1 -name '*.tmp' 2>/dev/null | wc -l)

  if [[ $json_count -eq 0 ]]; then
    echo -e "  ${GREEN}(空 — 无待处理消息)${NC}"
    return
  fi

  echo "  消息数: $json_count"
  if [[ $tmp_count -gt 0 ]]; then
    echo -e "  ${YELLOW}⚠ 残留 .tmp 文件: $tmp_count (正在写入中?)${NC}"
  fi

  # 用 agent-router.py 列出
  echo ""
  "$ROUTER" inbox list --agent "$agent" 2>/dev/null || {
    # fallback: 直接读文件
    for f in "$inbox_dir"/*.json; do
      [[ -f "$f" ]] || continue
      local msg_id
      msg_id=$(python3 -c "import json; print(json.load(open('$f'))['id'])" 2>/dev/null || echo "?")
      local method
      method=$(python3 -c "import json; print(json.load(open('$f'))['method'])" 2>/dev/null || echo "?")
      echo "  $msg_id — $method"
    done
  }

  # 状态追踪
  if [[ -f "$PROJECT_DIR/messages/.state.json" ]]; then
    local delivered
    delivered=$(python3 -c "
import json
state = json.load(open('$PROJECT_DIR/messages/.state.json'))
agent_msgs = [m for m in state.values() if m.get('receiver') == '$agent']
delivered = sum(1 for m in agent_msgs if m.get('status') == 'delivered')
print(delivered)
" 2>/dev/null || echo "?")
    echo ""
    echo -e "  未确认: ${YELLOW}$delivered${NC} 条 | 总计: $json_count 条"
  fi
}

# ── 全员概览 ──
show_all_overview() {
  echo -e "${CYAN}═══ 富贵军团 Inbox 概览 ═══${NC}"
  echo ""

  local agents=("ma:马富贵" "wang:王富贵" "zhou:周富贵" "nie:聂富贵")
  local total_unread=0

  for entry in "${agents[@]}"; do
    local agent="${entry%%:*}"
    local name="${entry##*:}"
    local inbox_dir="$PROJECT_DIR/messages/inbox/$agent"
    local count=0

    if [[ -d "$inbox_dir" ]]; then
      count=$(find "$inbox_dir" -maxdepth 1 -name '*.json' ! -name '*.tmp' 2>/dev/null | wc -l)
    fi

    # 查状态
    local delivered=0
    if [[ -f "$PROJECT_DIR/messages/.state.json" ]]; then
      delivered=$(python3 -c "
import json
state = json.load(open('$PROJECT_DIR/messages/.state.json'))
print(sum(1 for m in state.values() if m.get('receiver')=='$agent' and m.get('status')=='delivered'))
" 2>/dev/null || echo "0")
    fi

    if [[ $count -eq 0 ]]; then
      echo -e "  ${GREEN}●${NC} $name ($agent): 无消息"
    elif [[ $delivered -gt 0 ]]; then
      echo -e "  ${YELLOW}●${NC} $name ($agent): $count 条消息 (${delivered} 未确认)"
      total_unread=$((total_unread + delivered))
    else
      echo -e "  ${GREEN}●${NC} $name ($agent): $count 条消息 (全部已确认)"
    fi
  done

  echo ""
  if [[ $total_unread -eq 0 ]]; then
    echo -e "${GREEN}✅ 全员 inbox 无积压${NC}"
  else
    echo -e "${YELLOW}⚠ 全队未确认消息: $total_unread 条${NC}"
  fi
}

# ── 确认收到 ──
ack_all() {
  local agent="$1"
  local inbox_dir="$PROJECT_DIR/messages/inbox/$agent"

  if [[ ! -d "$inbox_dir" ]]; then
    echo "inbox 不存在"
    return
  fi

  local acked=0
  for f in "$inbox_dir"/*.json; do
    [[ -f "$f" ]] || continue
    local msg_id
    msg_id=$(python3 -c "import json; print(json.load(open('$f'))['id'])" 2>/dev/null || echo "")
    if [[ -n "$msg_id" ]]; then
      "$ROUTER" ack "$msg_id" > /dev/null 2>&1 && acked=$((acked + 1))
    fi
  done

  echo -e "${GREEN}✅ 已确认 $acked 条消息${NC}"
}

# ── 主逻辑 ──

if $WATCH_MODE; then
  echo -e "${CYAN}持续监控模式 — 每30秒刷新 (Ctrl+C 退出)${NC}"
  echo ""
  while true; do
    clear 2>/dev/null || true
    echo -e "${CYAN}═══ Inbox 监控 $(date '+%H:%M:%S') ═══${NC}"
    echo ""
    if [[ -n "$AGENT_ID" ]]; then
      show_agent_inbox "$AGENT_ID"
    else
      show_all_overview
    fi
    sleep 30
  done
elif $SHOW_ALL; then
  show_all_overview
elif [[ -n "$AGENT_ID" ]]; then
  if $DO_ACK; then
    echo -e "${CYAN}确认 $AGENT_ID 的所有消息...${NC}"
    ack_all "$AGENT_ID"
  else
    show_agent_inbox "$AGENT_ID"
  fi
else
  # 自动检测
  AGENT_ID=$(detect_agent)
  if [[ -n "$AGENT_ID" ]]; then
    if $DO_ACK; then
      ack_all "$AGENT_ID"
    else
      show_agent_inbox "$AGENT_ID"
    fi
  else
    # 无法检测 → 显示全员概览
    show_all_overview
  fi
fi
