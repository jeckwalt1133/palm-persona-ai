#!/bin/bash
# 马富贵 守护进程 — 会话崩溃自动恢复
#
# 启动：nohup bash /mnt/d/Claude/Workspace/palm-persona-ai/scripts/student-watchdog.sh &
# 停止：kill $(cat /tmp/student-watchdog.pid)

PIDFILE="/tmp/student-watchdog.pid"
LOGFILE="/tmp/student-watchdog.log"
SESSION="claude-student"
CHECK_INTERVAL=120
PROJECT_DIR="/mnt/d/Claude/Workspace/palm-persona-ai"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOGFILE"; }

cleanup() {
  log "守护进程退出"
  rm -f "$PIDFILE"
  exit 0
}
trap cleanup SIGINT SIGTERM

echo $$ > "$PIDFILE"
log "===== 马富贵守护进程启动 (PID: $$) ====="
log "会话: $SESSION | 项目: $PROJECT_DIR | 间隔: ${CHECK_INTERVAL}s"

while true; do
  if tmux has-session -t "$SESSION" 2>/dev/null; then
    sleep "$CHECK_INTERVAL"
    continue
  fi

  log "⚠ $SESSION 已死，拉起中..."

  # Step 1: 创建 tmux + bash
  tmux new-session -d -s "$SESSION" -c "$PROJECT_DIR" bash
  sleep 1

  if ! tmux has-session -t "$SESSION" 2>/dev/null; then
    log "❌ 创建 tmux 失败"
    sleep "$CHECK_INTERVAL"
    continue
  fi

  # Step 2: 注入环境变量
  tmux send-keys -t "$SESSION" "export ANTHROPIC_API_KEY='sk-f9a088e647ac427d94ab5249673f76f6'" Enter
  sleep 0.3
  tmux send-keys -t "$SESSION" "export ANTHROPIC_BASE_URL='https://api.deepseek.com/anthropic'" Enter
  sleep 0.3
  tmux send-keys -t "$SESSION" "export ANTHROPIC_MODEL='deepseek-v4-pro'" Enter
  sleep 0.3

  # Step 3: 启动 Claude Code
  tmux send-keys -t "$SESSION" "claude --permission-mode acceptEdits" Enter
  sleep 5

  # Step 4: 注入身份 + bootstrap
  tmux send-keys -t "$SESSION" "你叫马富贵，是富贵军团的学生/Senior Engineer。你的老师是聂富贵(Tech Lead)，客座讲师是王富贵(豆包·文案审美)和周富贵(千问·代码质量)。会话崩溃后已自动恢复——请先执行 Read memory/bootstrap.md 恢复项目上下文，然后继续被打断的学习任务。" Enter
  sleep 0.5
  tmux send-keys -t "$SESSION" "Read memory/bootstrap.md" Enter

  log "✅ $SESSION 已拉起，bootstrap 已注入"

  sleep "$CHECK_INTERVAL"
done
