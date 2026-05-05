#!/bin/bash
# PreCompact 快照生成 — 压缩前保存任务状态
#
# 用法: bash scripts/precompact-snapshot.sh <session-id> <role>
# 由 Claude Code PreCompact hook 自动调用
# 时间约束: < 3秒
#
# 设计原则: 只保存"对话中涌现的临时状态"的元数据，
#           不分析对话内容（由 PostToolUse watcher 异步完成）。

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MEMORY_DIR="$PROJECT_DIR/memory"
SNAPSHOTS_DIR="$MEMORY_DIR/snapshots"
TEAM_STATUS="$MEMORY_DIR/team-status.json"
DECISIONS_MD="$MEMORY_DIR/decisions.md"

SESSION_ID="${1:-unknown}"
ROLE="${2:-teacher}"
TIMESTAMP=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
SNAPSHOT_FILE="$SNAPSHOTS_DIR/$(date -u '+%Y-%m-%d-%H%M%S').json"

# ---- Step 1: 确保目录存在 ----
mkdir -p "$SNAPSHOTS_DIR"

# ---- Step 2: Git 状态快照 (~0.5s) ----
cd "$PROJECT_DIR"
BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
LAST_COMMIT=$(git log --oneline -1 2>/dev/null || echo "unknown")
UNCOMMITTED_COUNT=$(git status --porcelain 2>/dev/null | wc -l)
UNCOMMITTED_FILES=$(git status --porcelain 2>/dev/null | awk '{print $2}' | head -20 | tr '\n' ',' | sed 's/,$//')

# ---- Step 3: 当前任务状态 (从 team-status.json 读取) ----
CURRENT_TASK="{}"
if [ -f "$TEAM_STATUS" ]; then
  CURRENT_TASK=$(python3 -c "
import json, sys
try:
    d = json.load(open('$TEAM_STATUS'))
    ct = d.get('currentTask', {})
    print(json.dumps(ct, ensure_ascii=False))
except: print('{}')
" 2>/dev/null || echo "{}")
fi

# ---- Step 4: 生成快照 ----
cat > "$SNAPSHOT_FILE" <<SNAPSHOT
{
  "snapshotVersion": "1.0",
  "sessionId": "$SESSION_ID",
  "role": "$ROLE",
  "timestamp": "$TIMESTAMP",
  "git": {
    "branch": "$BRANCH",
    "lastCommit": "$LAST_COMMIT",
    "uncommittedCount": $UNCOMMITTED_COUNT,
    "uncommittedFiles": "$UNCOMMITTED_FILES"
  },
  "currentTask": $CURRENT_TASK
}
SNAPSHOT

# ---- Step 5: 更新 team-status.json 的 lastCheckpoint ----
if [ -f "$TEAM_STATUS" ]; then
  python3 -c "
import json
try:
    with open('$TEAM_STATUS', 'r') as f:
        d = json.load(f)
    d['session']['lastCheckpoint'] = '$TIMESTAMP'
    d['updated'] = '$TIMESTAMP'
    with open('$TEAM_STATUS', 'w') as f:
        json.dump(d, f, indent=2, ensure_ascii=False)
except Exception as e:
    print(f'WARN: team-status.json update failed: {e}', file=__import__('sys').stderr)
" 2>/dev/null || true
fi

# ---- Step 6: 如果有新决策，追加到 decisions.md ----
# 检查 team-status.json 中的 decisions 数组，将时间戳在最近1小时内的新决策追加到 decisions.md
if [ -f "$TEAM_STATUS" ]; then
  python3 -c "
import json, os
from datetime import datetime, timedelta, timezone

try:
    with open('$TEAM_STATUS', 'r') as f:
        d = json.load(f)
    new_decisions = []
    cutoff = datetime.now(timezone.utc) - timedelta(hours=1)
    for dec in d.get('decisions', []):
        ts = datetime.fromisoformat(dec['timestamp'].replace('Z', '+00:00'))
        if ts > cutoff:
            new_decisions.append(dec)

    if new_decisions:
        dec_file = '$DECISIONS_MD'
        existing_ids = set()
        if os.path.exists(dec_file):
            with open(dec_file, 'r') as f:
                for line in f:
                    if line.startswith('### D'):
                        existing_ids.add(line.split('### ')[1].split(':')[0].strip())

        with open(dec_file, 'a') as f:
            for dec in new_decisions:
                if dec['id'] not in existing_ids:
                    f.write(f\"\"\"
### {dec['id']}: {dec['summary']}
- **时间**: {dec['timestamp'][:10]} {dec['timestamp'][11:19]}
- **决策**: {dec['summary']}
- **理由**: {dec.get('rationale', '')}
- **替代方案**: {dec.get('alternatives', '')}
- **决策人**: {dec.get('decidedBy', '')}
\"\"\")
except Exception as e:
    pass
" 2>/dev/null || true
fi

# ---- Step 7: 清理30天前的旧快照 (~0.5s) ----
find "$SNAPSHOTS_DIR" -name "*.json" -mtime +30 -delete 2>/dev/null || true

# ---- 汇总 ----
SNAPSHOT_COUNT=$(find "$SNAPSHOTS_DIR" -name "*.json" | wc -l)
echo "[PreCompact] ✅ 快照已保存: $SNAPSHOT_FILE"
echo "[PreCompact]    Git: $BRANCH @ $LAST_COMMIT ($UNCOMMITTED_COUNT uncommitted)"
echo "[PreCompact]    快照总数: $SNAPSHOT_COUNT (30天滚动)"
