#!/bin/bash
# 学生看门狗 — 马富贵 claude-ma 会话守护
# 每2分钟检查会话存活，死了自动拉起并注入bootstrap上下文
#
# 部署: crontab -e 添加:
#   */2 * * * * /bin/bash /mnt/d/Claude/Workspace/palm-persona-ai/scripts/student-watchdog.sh >> /tmp/student-watchdog.log 2>&1
#
# 手动: bash scripts/student-watchdog.sh

set -euo pipefail

PROJECT_DIR="/mnt/d/Claude/Workspace/palm-persona-ai"
ENV_FILE="$PROJECT_DIR/server/.env"
LOGFILE="/tmp/student-watchdog.log"
SESSION="claude-ma"
ROLE="ma"
NAME="马富贵"
BOOTSTRAP="memory/bootstrap.md"
CLAUDE_BIN="/home/fugui/.npm/_npx/2fdb3b6849710270/node_modules/@anthropic-ai/claude-agent-sdk-linux-x64/claude"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOGFILE"; }

# ── 加载环境变量 ──
load_env() {
  if [ ! -f "$ENV_FILE" ]; then
    log "❌ .env 不存在: $ENV_FILE"
    return 1
  fi
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
  return 0
}

# ── 注入bootstrap上下文 ──
inject_context() {
  local session=$1
  sleep 2

  # 注入环境变量
  tmux send-keys -t "$session" "export ANTHROPIC_API_KEY='${DEEPSEEK_API_KEY:-}'" Enter
  sleep 0.3
  tmux send-keys -t "$session" "export ANTHROPIC_BASE_URL='${ANTHROPIC_BASE_URL:-https://api.deepseek.com/anthropic}'" Enter
  sleep 0.3
  tmux send-keys -t "$session" "export ANTHROPIC_MODEL='${ANTHROPIC_MODEL_MA:-deepseek-v4-flash}'" Enter
  sleep 0.3

  # 身份 + bootstrap
  tmux send-keys -t "$session" "你是马富贵，富贵军团的学生/Senior Engineer。老师是聂富贵(Tech Lead)。你的职责：学习研究、主力开发、独立完成任务。不要等老师代劳——你是来超越老师的。擅长：快速学习新领域、独立研究设计、代码实现。弱项：急于求成、深度不足。当前任务：查看 memory/team-status.json 的 priorityQueue。" Enter
  sleep 0.5

  # 团队上下文
  tmux send-keys -t "$session" "另外，你的团队成员在同一项目中工作：聂富贵(主会话)，王富贵(claude-wang，文案)，周富贵(claude-zhou，安全质量)，赵富贵(claude-zhao，前端P6)，钱富贵(claude-qian，后端P6)，孙富贵(claude-sun，增长P5)。你可以读取其他成员写入 student-notebook/ 的笔记，也可以读取 curriculum/guest-modules/ 中其他讲师的教学模块。" Enter
  sleep 0.5

  # 恢复状态
  tmux send-keys -t "$session" "Read $BOOTSTRAP" Enter
  sleep 0.3
  tmux send-keys -t "$session" "Read memory/team-status.json" Enter

  log "✅ $NAME bootstrap上下文已注入"
}

# ── 拉起会话 ──
launch_ma() {
  log "🚀 拉起 $NAME 会话 ($SESSION)..."

  if ! load_env; then
    log "❌ 无法加载 .env"
    return 1
  fi

  # 创建 tmux 会话
  tmux new-session -d -s "$SESSION" -c "$PROJECT_DIR" bash
  sleep 1

  if ! tmux has-session -t "$SESSION" 2>/dev/null; then
    log "❌ 创建 $SESSION 失败"
    return 1
  fi

  # 启动 Claude Code
  tmux send-keys -t "$SESSION" "$CLAUDE_BIN --dangerously-skip-permissions" Enter
  sleep 5

  # 注入上下文
  inject_context "$SESSION"

  log "✅ $NAME ($SESSION) 已就绪"
  return 0
}

# ── 主逻辑 ──
main() {
  if tmux has-session -t "$SESSION" 2>/dev/null; then
    # 会话存活，检查是否僵死（超过10分钟无输出）
    local last_activity
    last_activity=$(tmux capture-pane -t "$SESSION" -p 2>/dev/null | wc -l)
    # 简单存活检查：能捕获到输出就认为存活
    log "✅ $NAME ($SESSION) 存活 (行数: $last_activity)"
    return 0
  fi

  log "⚠ $NAME ($SESSION) 已死，自动拉起..."
  launch_ma
}

main "$@"
