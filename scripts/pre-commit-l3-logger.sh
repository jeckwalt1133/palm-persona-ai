#!/usr/bin/env bash
# pre-commit-l3-logger.sh — L3记录层: 每次commit记录到JSONL
# 由 .git/hooks/pre-commit 在扫描完成后调用
# 用法: source scripts/pre-commit-l3-logger.sh
#       l3_log_commit <json_report_path> <scan_duration_ms>
#
# 架构: student-notebook/zhou-three-layer-defense.md
# 任务: V7-W5-003 Phase 2

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_FILE="$PROJECT_DIR/memory/security/commit-log.jsonl"

# 确保日志目录存在
mkdir -p "$(dirname "$LOG_FILE")"

l3_log_commit() {
    local report_file="${1:-}"
    local scan_duration_ms="${2:-0}"
    local timestamp
    timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)

    # 获取Git上下文
    local author
    author=$(git config user.name 2>/dev/null || echo "unknown")
    local branch
    branch=$(git branch --show-current 2>/dev/null || echo "unknown")
    local commit_hash
    commit_hash=$(git rev-parse HEAD 2>/dev/null || echo "0000000")

    # 默认值
    local files_scanned=0
    local lines_changed=0
    local l1_findings=0
    local l2_findings=0
    local l3_findings=0
    local blocked="false"
    local matched_rules="[]"
    local l3_rules_hit="[]"

    # 从JSON报告读取统计
    if [ -n "$report_file" ] && [ -f "$report_file" ]; then
        if command -v python3 &>/dev/null; then
            local extracted
            extracted=$(python3 -c "
import json, sys
try:
    with open('$report_file') as f:
        r = json.load(f)
    s = r.get('summary', {})
    d = r.get('defense', {})
    # 统计行数
    lc = r.get('linesChanged', 0)
    # 收集L3规则命中的ID列表
    l3_hits = [f.get('patternId','?') for f in r.get('findings', {}).get('L3', [])]
    print(json.dumps({
        'files': s.get('filesScanned', 0),
        'lines': lc,
        'l1': d.get('L1_total', 0),
        'l2': d.get('L2_total', 0),
        'l3': d.get('L3_total', 0),
        'blocked': d.get('L1_blocked', False),
        'l1_rules': list(set(f.get('patternId','?') for f in r.get('findings', {}).get('L1', []))),
        'l2_rules': list(set(f.get('patternId','?') for f in r.get('findings', {}).get('L2', []))),
        'l3_rules': list(set(f.get('patternId','?') for f in r.get('findings', {}).get('L3', []))),
    }))
except Exception as e:
    print(json.dumps({'error': str(e)}))
" 2>/dev/null)
            if [ -n "$extracted" ]; then
                files_scanned=$(echo "$extracted" | python3 -c "import json,sys; print(json.load(sys.stdin).get('files',0))" 2>/dev/null || echo 0)
                lines_changed=$(echo "$extracted" | python3 -c "import json,sys; print(json.load(sys.stdin).get('lines',0))" 2>/dev/null || echo 0)
                l1_findings=$(echo "$extracted" | python3 -c "import json,sys; print(json.load(sys.stdin).get('l1',0))" 2>/dev/null || echo 0)
                l2_findings=$(echo "$extracted" | python3 -c "import json,sys; print(json.load(sys.stdin).get('l2',0))" 2>/dev/null || echo 0)
                l3_findings=$(echo "$extracted" | python3 -c "import json,sys; print(json.load(sys.stdin).get('l3',0))" 2>/dev/null || echo 0)
                blocked=$(echo "$extracted" | python3 -c "import json,sys; print('true' if json.load(sys.stdin).get('blocked') else 'false')" 2>/dev/null || echo "false")
                matched_rules=$(echo "$extracted" | python3 -c "import json,sys; print(json.dumps(json.load(sys.stdin).get('l1_rules',[])+json.load(sys.stdin).get('l2_rules',[])))" 2>/dev/null || echo "[]")
                l3_rules_hit=$(echo "$extracted" | python3 -c "import json,sys; print(json.dumps(json.load(sys.stdin).get('l3_rules',[])))" 2>/dev/null || echo "[]")
            fi
        fi
    fi

    # 构造JSONL条目
    local entry
    entry=$(cat <<EOF
{"ts":"$timestamp","author":"$author","branch":"$branch","commit":"$commit_hash","files":$files_scanned,"lines":$lines_changed,"scanMs":$scan_duration_ms,"L1":$l1_findings,"L2":$l2_findings,"L3":$l3_findings,"blocked":$blocked,"rulesHit":$matched_rules,"L3rulesHit":$l3_rules_hit}
EOF
)

    # 追加到日志
    echo "$entry" >> "$LOG_FILE"
    echo "[L3] 已记录: $LOG_FILE (${files_scanned}文件, ${l1_findings}L1/${l2_findings}L2/${l3_findings}L3)"
}

# 统计信息
l3_log_stats() {
    if [ ! -f "$LOG_FILE" ]; then
        echo "L3日志文件不存在: $LOG_FILE"
        return 1
    fi
    local total
    total=$(wc -l < "$LOG_FILE")
    echo "L3日志统计: 共 $total 次commit记录"
    echo "日志文件: $LOG_FILE ($(du -h "$LOG_FILE" | cut -f1))"
}

# 如果直接执行(非source)，显示帮助
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
    echo "L3记录层 — pre-commit-l3-logger.sh"
    echo "用法: source scripts/pre-commit-l3-logger.sh"
    echo "      l3_log_commit <report_json_path> <scan_ms>"
    echo "      l3_log_stats"
    exit 0
fi
