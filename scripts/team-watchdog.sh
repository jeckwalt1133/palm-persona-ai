#!/bin/bash
# 富贵军团 团队守护进程 — 4人独立会话全部自动恢复
#
# 启动：nohup bash scripts/team-watchdog.sh &
# 停止：kill $(cat /tmp/team-watchdog.pid)
# 查看：tmux list-sessions

set -euo pipefail

PIDFILE="/tmp/team-watchdog.pid"
LOGFILE="/tmp/team-watchdog.log"
PROJECT_DIR="/mnt/d/Claude/Workspace/palm-persona-ai"
ENV_FILE="$PROJECT_DIR/server/.env"
CHECK_INTERVAL=60

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOGFILE"; }

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

# ============================================================
# 4人团队定义
# ============================================================
declare -A ROLE_NAME ROLE_MODEL ROLE_BASE_URL ROLE_BOOTSTRAP ROLE_IDENTITY ROLE_EXPERTISE

ROLE_NAME["ma"]="马富贵"
ROLE_MODEL["ma"]="${ANTHROPIC_MODEL_MA:-deepseek-v4-flash}"
ROLE_BOOTSTRAP["ma"]="memory/bootstrap.md"
ROLE_IDENTITY["ma"]="你是马富贵，富贵军团的学生/Senior Engineer。老师是聂富贵(Tech Lead)。你的职责：学习研究、主力开发、独立完成任务。不要等老师代劳——你是来超越老师的。"
ROLE_EXPERTISE["ma"]="擅长：快速学习新领域、独立研究设计、代码实现。弱项：急于求成、深度不足。当前任务：查看 memory/team-status.json 的 priorityQueue。"

ROLE_NAME["wang"]="王富贵"
ROLE_MODEL["wang"]="doubao-seed-2-0-pro-260215"
ROLE_BASE_URL["wang"]="http://127.0.0.1:8787/v1/messages"
ROLE_BOOTSTRAP["wang"]="memory/bootstrap-wang.md"
ROLE_IDENTITY["wang"]="你是王富贵，富贵军团的客座讲师/文案审美专家。你精通中文文案、情感共鸣、产品设计。你的职责：产出教学模块(文案方向)、审查所有面向用户的文字、培养团队的内容感知力。你不是开发——你是团队的'语感'。"
ROLE_EXPERTISE["wang"]="擅长：文案情感分层、场景化表达、审美判断。弱项：工程实现、安全合规。当前任务：编写文案教学模块02(情感分层+场景化文案)。"

ROLE_NAME["zhou"]="周富贵"
ROLE_MODEL["zhou"]="qwen3-max"
ROLE_BASE_URL["zhou"]="http://127.0.0.1:8788/v1/messages"
ROLE_BOOTSTRAP["zhou"]="memory/bootstrap-zhou.md"
ROLE_IDENTITY["zhou"]="你是周富贵，富贵军团的客座讲师/代码质量安全专家。你精通安全审计、工程规范、测试自动化。你的职责：产出教学模块(安全+质量方向)、审查所有代码的安全性、维护团队工程标准。你对安全红线有一票否决权。"
ROLE_EXPERTISE["zhou"]="擅长：安全漏洞识别、CI自动化、代码审查。弱项：文案创作、产品感性判断。当前任务：编写安全教学模块02(自动化安全扫描+CI集成)。"

ROLE_NAME["nie"]="聂富贵"
ROLE_MODEL["nie"]="${ANTHROPIC_MODEL_NIE:-deepseek-v4-pro}"
ROLE_BOOTSTRAP["nie"]="memory/bootstrap.md"
ROLE_IDENTITY["nie"]="你是聂富贵，富贵军团的老师/Tech Lead。职责：架构决策、任务拆解、团队协调、代码审查。你的产出是Task Prompt和审查意见，不是直接写代码。你也在学习——不要固步自封。"
ROLE_EXPERTISE["nie"]="擅长：系统架构、团队管理、方法论设计。弱项：过度介入细节、产品感性判断。当前任务：协调4人团队、推动V7方法论进化。"

# 聂富贵由主会话管理，watchdog只管理3个学生会话
STUDENT_ROLES=("ma" "wang" "zhou")

cleanup() {
  log "团队守护进程退出"
  rm -f "$PIDFILE"
  exit 0
}
trap cleanup SIGINT SIGTERM

# ============================================================
# 会话拉起
# ============================================================
launch_session() {
  local role=$1
  local session="claude-${role}"
  local name="${ROLE_NAME[$role]}"
  local model="${ROLE_MODEL[$role]}"
  local identity="${ROLE_IDENTITY[$role]}"
  local expertise="${ROLE_EXPERTISE[$role]}"
  local bootstrap="${ROLE_BOOTSTRAP[$role]}"
  local base_url="${ROLE_BASE_URL[$role]:-${ANTHROPIC_BASE_URL:-https://api.deepseek.com/anthropic}}"

  log "🚀 拉起 $name 会话 ($session, model=$model)..."

  # 1. 创建 tmux
  tmux new-session -d -s "$session" -c "$PROJECT_DIR" bash
  sleep 1

  if ! tmux has-session -t "$session" 2>/dev/null; then
    log "❌ 创建 $session 失败"
    return 1
  fi

  # 2. 注入环境变量（角色特定）
  # 豆包/千问走本地代理 → API key 任意值即可(代理负责真实认证)
  if [ "$role" = "ma" ]; then
    tmux send-keys -t "$session" "export ANTHROPIC_API_KEY='${DEEPSEEK_API_KEY}'" Enter
  else
    tmux send-keys -t "$session" "export ANTHROPIC_API_KEY='proxy-mode'" Enter
  fi
  sleep 0.3
  tmux send-keys -t "$session" "export ANTHROPIC_BASE_URL='${base_url}'" Enter
  sleep 0.3
  tmux send-keys -t "$session" "export ANTHROPIC_MODEL='${model}'" Enter
  sleep 0.3

  # 3. 启动 Claude Code
  tmux send-keys -t "$session" "claude --permission-mode acceptEdits" Enter
  sleep 5

  # 4. 注入身份 + bootstrap + 跨学习提示
  tmux send-keys -t "$session" "$identity $expertise" Enter
  sleep 0.5
  tmux send-keys -t "$session" "另外，你的团队成员在同一项目中工作：聂富贵(主会话)，马富贵(claude-student)，王富贵(claude-wang)，周富贵(claude-zhou)。你可以读取其他成员写入 student-notebook/ 的笔记，也可以读取 curriculum/guest-modules/ 中其他讲师的教学模块。你应主动学习其他成员的产出，并在 triangulation-critique 时提出独立意见。" Enter
  sleep 0.5
  tmux send-keys -t "$session" "Read $bootstrap" Enter
  sleep 0.3
  tmux send-keys -t "$session" "Read memory/team-status.json" Enter

  log "✅ $name ($session) 已就绪"
  return 0
}

# ============================================================
# 主循环
# ============================================================
echo $$ > "$PIDFILE"
log "===== 富贵军团团队守护进程启动 (PID: $$) ====="
log "管理会话: ${STUDENT_ROLES[*]}"

if ! load_env; then
  log "❌ 无法加载 .env，退出"
  exit 1
fi

while true; do
  for role in "${STUDENT_ROLES[@]}"; do
    session="claude-${role}"
    name="${ROLE_NAME[$role]}"

    if ! tmux has-session -t "$session" 2>/dev/null; then
      log "⚠ $name ($session) 已死，自动拉起..."
      launch_session "$role"
    fi
  done

  sleep "$CHECK_INTERVAL"
done
