#!/bin/bash
# SessionStart 自动恢复 — 生成恢复上下文注入 prompt
#
# 用法: bash scripts/sessionstart-recover.sh <role>
# 由 Claude Code SessionStart hook 自动调用
# 时间约束: < 30秒
#
# 设计原则: 读取 team-status.json + 最新快照 → 生成恢复摘要
#           不阻塞会话启动（30秒超时自动降级为最小恢复）

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MEMORY_DIR="$PROJECT_DIR/memory"
TEAM_STATUS="$MEMORY_DIR/team-status.json"
SNAPSHOTS_DIR="$MEMORY_DIR/snapshots"
BOOTSTRAP_MD="$MEMORY_DIR/bootstrap.md"
RECOVERY_OUTPUT="/tmp/claude-resume-context.md"
EVIDENCE_SCRIPT="$PROJECT_DIR/scripts/evidence-auto-verify.sh"

ROLE="${1:-teacher}"
TIMESTAMP=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

# ---- Step 1: 读取 team-status.json (~0.2s) ----
TASK_TITLE="未知"
TASK_STATUS="未知"
TASK_PROGRESS="未知"
NEXT_ACTION=""
BLOCKER=""
ASSIGNED_TO=""
PRIORITY_QUEUE=""
TEAM_NIE_STATUS="unknown"
TEAM_MA_STATUS="unknown"
TEAM_WANG_STATUS="unknown"
TEAM_ZHOU_STATUS="unknown"

if [ -f "$TEAM_STATUS" ]; then
  # 使用 Python 写入临时文件，一行一个字段，避免 bash read 分割含空格的文本
  TMP_FIELDS=$(mktemp)
  python3 -c "
import json
def s(val, default=''):
    '''安全取值，处理 JSON null → Python None'''
    return val if val is not None else default
with open('$TEAM_STATUS') as f:
    d = json.load(f)
ct = d.get('currentTask', {}) or {}
tm = d.get('teamMembers', {}) or {}
fields = [
    s(ct.get('title'), '未知'),
    s(ct.get('status'), '未知'),
    s(ct.get('progress'), '未知'),
    s(ct.get('nextAction'), ''),
    s(ct.get('blocker'), ''),
    s(ct.get('assignedTo'), ''),
    s(tm.get('nie', {}).get('status'), 'unknown') if tm.get('nie') else 'unknown',
    s(tm.get('ma', {}).get('status'), 'unknown') if tm.get('ma') else 'unknown',
    s(tm.get('wang', {}).get('status'), 'unknown') if tm.get('wang') else 'unknown',
    s(tm.get('zhou', {}).get('status'), 'unknown') if tm.get('zhou') else 'unknown',
]
with open('$TMP_FIELDS', 'w') as out:
    for field in fields:
        out.write(str(field) + '\n')
" 2>/dev/null

  mapfile -t FIELDS < "$TMP_FIELDS" 2>/dev/null || true
  TASK_TITLE="${FIELDS[0]:-未知}"
  TASK_STATUS="${FIELDS[1]:-未知}"
  TASK_PROGRESS="${FIELDS[2]:-未知}"
  NEXT_ACTION="${FIELDS[3]:-}"
  BLOCKER="${FIELDS[4]:-}"
  ASSIGNED_TO="${FIELDS[5]:-}"
  TEAM_NIE_STATUS="${FIELDS[6]:-unknown}"
  TEAM_MA_STATUS="${FIELDS[7]:-unknown}"
  TEAM_WANG_STATUS="${FIELDS[8]:-unknown}"
  TEAM_ZHOU_STATUS="${FIELDS[9]:-unknown}"
  rm -f "$TMP_FIELDS"

  PRIORITY_QUEUE=$(python3 -c "
import json
with open('$TEAM_STATUS') as f:
    d = json.load(f)
q = d.get('priorityQueue', [])
for i in q[:5]:
    assigned = i.get('assignedTo') or 'unassigned'
    print(f\"  #{i['rank']} {i['taskId']}: {i['title']} ({i['status']}) — assigned to {assigned}\")
" 2>/dev/null)
fi

# ---- Step 2: 读取最新快照 (~0.2s) ----
LATEST_SNAPSHOT_INFO="无历史快照"
if [ -d "$SNAPSHOTS_DIR" ]; then
  LATEST=$(find "$SNAPSHOTS_DIR" -name "*.json" -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -1 | awk '{print $2}')
  if [ -n "$LATEST" ]; then
    LATEST_SNAPSHOT_INFO=$(python3 -c "
import json
with open('$LATEST') as f:
    d = json.load(f)
g = d.get('git', {})
print(f\"session {d.get('sessionId','?')} @ {d.get('timestamp','?')}, branch={g.get('branch','?')}, last commit={g.get('lastCommit','?')[:50]}\")
" 2>/dev/null || echo "快照读取失败")
  fi
fi

# ---- Step 3: 快速证据验证（仅检查L3.1公网URL存活性，~10s） ----
# 完整验证太慢（跑vitest需要10s+），SessionStart只做最关键的检查
QUICK_EVIDENCE=""
if [ -f "$EVIDENCE_SCRIPT" ]; then
  # 只做L3.1公网检查（curl超时5s）
  URL=$(grep -oP 'https?://[a-zA-Z0-9.-]+\.lhr\.life' "$TEAM_STATUS" 2>/dev/null | tail -1 || echo "")
  if [ -z "$URL" ]; then
    URL=$(grep -oP 'https?://[a-zA-Z0-9.-]+\.lhr\.life' "$BOOTSTRAP_MD" 2>/dev/null | tail -1 || echo "")
  fi
  if [ -n "$URL" ]; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$URL" 2>/dev/null || echo "000")
    QUICK_EVIDENCE="L3.1公网: $URL → HTTP $HTTP_CODE"
  else
    QUICK_EVIDENCE="L3.1公网: 未找到URL"
  fi
fi

# ---- Step 4: Git 状态 (~0.5s) ----
cd "$PROJECT_DIR"
GIT_BRANCH=$(git branch --show-current 2>/dev/null || echo "?")
GIT_LAST=$(git log --oneline -3 2>/dev/null || echo "?")
GIT_UNCOMMITTED=$(git status --porcelain 2>/dev/null | wc -l)

# ---- Step 5: 学生任务检查（仅当 role=student 时） ----
STUDENT_TASK_HINT=""
if [ "$ROLE" = "student" ] || [ "$ROLE" = "ma" ]; then
  STUDENT_TASK_HINT=$(python3 -c "
import json, os
tasks_dir = '$MEMORY_DIR/tasks'
if os.path.exists(os.path.join(tasks_dir, 'active.json')):
    with open(os.path.join(tasks_dir, 'active.json')) as f:
        tasks = json.load(f)
    my_tasks = [t for t in tasks if t.get('assignedTo') == 'ma' and t.get('status') == 'assigned']
    if my_tasks:
        t = my_tasks[0]
        print(f\"[待执行] {t['taskId']}: {t['title']} — 验收: {'; '.join(t.get('acceptanceCriteria', []))}\")
    else:
        print('[待执行] 无分配给 ma 的 assigned 状态任务。报告：等待老师分配任务。')
else:
    print('[信息] tasks/active.json 尚未创建，等待 Phase 2')
" 2>/dev/null || echo "[信息] 任务队列模块未就绪")
fi

# ---- Step 6: 生成恢复上下文 Markdown ----
cat > "$RECOVERY_OUTPUT" <<RECOVERY
<!-- 自动生成于 $TIMESTAMP | 角色: $ROLE | 由 sessionstart-recover.sh 生成 -->
<!-- 请将以下内容注入到本次会话的初始上下文中 -->

## 会话恢复 — $ROLE

### 上次状态
- **当前任务**: $TASK_TITLE ($TASK_STATUS)
- **进度**: $TASK_PROGRESS
- **下一步**: ${NEXT_ACTION:-根据优先级队列选择下一个pending任务}
$([ -n "$BLOCKER" ] && echo "- **⚠ 阻塞**: $BLOCKER")
- **分配给**: ${ASSIGNED_TO:-未分配}

### 优先级队列
$PRIORITY_QUEUE

### 团队状态
- 聂富贵: $TEAM_NIE_STATUS | 马富贵: $TEAM_MA_STATUS | 王富贵: $TEAM_WANG_STATUS | 周富贵: $TEAM_ZHOU_STATUS

### 最新快照
- $LATEST_SNAPSHOT_INFO

### Git
- $GIT_BRANCH @ $GIT_LAST
- 未提交变更: $GIT_UNCOMMITTED 个文件

### 证据状态
- $QUICK_EVIDENCE

$([ -n "$STUDENT_TASK_HINT" ] && echo "### 学生任务
$STUDENT_TASK_HINT")

### 恢复指令
1. 读取 \`CLAUDE.md\` → \`memory/bootstrap.md\` → \`memory/team-status.json\`
2. 优先级队列中第一个 \`in_progress\` 或 \`pending\` 且分配给当前角色的任务 = 立即开始
3. 如果没有分配给当前角色的任务 → 报告并等待
RECOVERY

# ---- 汇总 ----
echo "[SessionStart] ✅ 恢复上下文已生成: $RECOVERY_OUTPUT"
echo "[SessionStart]    角色: $ROLE"
echo "[SessionStart]    当前任务: $TASK_TITLE ($TASK_STATUS)"
echo "[SessionStart]    Git: $GIT_BRANCH ($GIT_UNCOMMITTED uncommitted)"
echo "[SessionStart]    证据: $QUICK_EVIDENCE"

# 输出恢复上下文的路径，供 CLAUDE.md 恢复指令读取
echo "$RECOVERY_OUTPUT"
