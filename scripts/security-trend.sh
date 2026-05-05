#!/usr/bin/env bash
# security-trend.sh — L3记录层趋势分析
# 解析 commit-log.jsonl → 输出7天/30天趋势报告
#
# 用法:
#   bash scripts/security-trend.sh [7|30]          # 终端报告
#   bash scripts/security-trend.sh --json [7|30]    # JSON输出(供CI/仪表盘消费)
#   bash scripts/security-trend.sh --upgrade-check   # L3→L2升级建议
#
# 架构: student-notebook/zhou-three-layer-defense.md
# 任务: V7-W5-003 Phase 2

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_FILE="$PROJECT_DIR/memory/security/commit-log.jsonl"
DAYS="${2:-30}"
if [ "$1" = "7" ] || [ "$1" = "30" ]; then
    DAYS="$1"
fi
JSON_MODE=false
UPGRADE_CHECK=false

for arg in "$@"; do
    case "$arg" in
        --json) JSON_MODE=true ;;
        --upgrade-check) UPGRADE_CHECK=true ;;
    esac
done

if [ ! -f "$LOG_FILE" ]; then
    if $JSON_MODE; then
        echo '{"error":"no_data","message":"commit-log.jsonl 不存在"}'
    else
        echo "📊 L3趋势报告"
        echo "============================================"
        echo "暂无数据: commit-log.jsonl 不存在"
        echo "日志路径: $LOG_FILE"
    fi
    exit 0
fi

# 用Python解析JSONL并计算趋势
run_analysis() {
    LOG_FILE="$LOG_FILE" DAYS="$DAYS" JSON_MODE="$JSON_MODE" UPGRADE_CHECK="$UPGRADE_CHECK" python3 << 'PYEOF'
import json, sys, os
from datetime import datetime, timezone, timedelta

log_file = os.environ["LOG_FILE"]
days = int(os.environ["DAYS"])
json_mode = os.environ["JSON_MODE"] == "true"
upgrade_check = os.environ["UPGRADE_CHECK"] == "true"

# 读取所有日志
entries = []
with open(log_file) as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        try:
            entries.append(json.loads(line))
        except json.JSONDecodeError:
            continue

if not entries:
    if json_mode:
        print(json.dumps({"error": "empty_log"}))
    else:
        print("日志为空")
    sys.exit(0)

# 时间窗口
now = datetime.now(timezone.utc)
cutoff = now - timedelta(days=days)

# 筛选窗口内条目
window = [e for e in entries if e.get("ts") and datetime.fromisoformat(e["ts"]) > cutoff]
outside = len(entries) - len(window)

# 基础统计
total_scanned = sum(e.get("files", 0) for e in window)
total_lines = sum(e.get("lines", 0) for e in window)
total_findings_l1 = sum(e.get("L1", 0) for e in window)
total_findings_l2 = sum(e.get("L2", 0) for e in window)
total_findings_l3 = sum(e.get("L3", 0) for e in window)
blocks = sum(1 for e in window if e.get("blocked"))

# 按天汇总
from collections import defaultdict
daily = defaultdict(lambda: {"commits": 0, "files": 0, "lines": 0, "L1": 0, "L2": 0, "L3": 0, "scanMs": [], "blocked": 0})
for e in window:
    try:
        day = datetime.fromisoformat(e["ts"]).strftime("%Y-%m-%d")
    except (ValueError, KeyError):
        continue
    daily[day]["commits"] += 1
    daily[day]["files"] += e.get("files", 0)
    daily[day]["lines"] += e.get("lines", 0)
    daily[day]["L1"] += e.get("L1", 0)
    daily[day]["L2"] += e.get("L2", 0)
    daily[day]["L3"] += e.get("L3", 0)
    daily[day]["scanMs"].append(e.get("scanMs", 0))
    if e.get("blocked"):
        daily[day]["blocked"] += 1

active_days = len(daily)
daily_commits = len(window) / max(days, 1)
avg_scan_ms = sum(e.get("scanMs", 0) for e in window) / max(len(window), 1)

# 规则频率排行
from collections import Counter
rule_counter = Counter()
l3_counter = Counter()
for e in window:
    for r in e.get("rulesHit", []):
        rule_counter[r] += 1
    for r in e.get("L3rulesHit", []):
        l3_counter[r] += 1

top5 = rule_counter.most_common(5)
top5_l3 = l3_counter.most_common(5)

# L3→L2 升级建议
upgrade_candidates = []
l3_rule_history = defaultdict(lambda: {"total_hits": 0, "commits_with_hits": 0, "days_seen": set()})

for e in entries:
    for r in e.get("L3rulesHit", []):
        l3_rule_history[r]["total_hits"] += 1
        l3_rule_history[r]["commits_with_hits"] += 1
        try:
            day = datetime.fromisoformat(e["ts"]).strftime("%Y-%m-%d")
            l3_rule_history[r]["days_seen"].add(day)
        except (ValueError, KeyError):
            pass

for rule_id, stats in l3_rule_history.items():
    active_days_rule = len(stats["days_seen"])
    if active_days_rule >= 30 and stats["commits_with_hits"] >= 30:
        upgrade_candidates.append({
            "ruleId": rule_id,
            "totalHits": stats["total_hits"],
            "activeDays": active_days_rule,
            "avgPerDay": round(stats["total_hits"] / max(active_days_rule, 1), 1),
        })

# 输出
if upgrade_check:
    if json_mode:
        print(json.dumps({"upgradeCandidates": upgrade_candidates}, ensure_ascii=False, indent=2))
    else:
        print(f"📈 L3→L2 升级检查")
        print("=" * 50)
        if upgrade_candidates:
            for c in sorted(upgrade_candidates, key=lambda x: x["totalHits"], reverse=True):
                print(f"  [{c['ruleId']}] 命中{c['totalHits']}次, 活跃{c['activeDays']}天, 日均{c['avgPerDay']}")
                print(f"    → 建议升级到L2 (连续活跃≥30天)")
        else:
            print("  无符合条件的L3→L2升级候选")
            print("  (需要: 连续30天出现 + ≥30次commit命中)")
    sys.exit(0)

if json_mode:
    output = {
        "reportType": f"{days}d",
        "generatedAt": now.isoformat(),
        "period": {"from": cutoff.isoformat(), "to": now.isoformat()},
        "summary": {
            "totalCommits": len(window),
            "outsideWindow": outside,
            "activeDays": active_days,
            "dailyAvgCommits": round(daily_commits, 1),
            "avgScanMs": round(avg_scan_ms, 0),
            "totalFilesScanned": total_scanned,
            "totalLinesChanged": total_lines,
        },
        "findings": {
            "L1_blocked": blocks,
            "L1_total": total_findings_l1,
            "L2_total": total_findings_l2,
            "L3_total": total_findings_l3,
        },
        "topRules": [{"rule": r, "hits": c} for r, c in top5],
        "topL3Rules": [{"rule": r, "hits": c} for r, c in top5_l3],
        "upgradeCandidates": upgrade_candidates,
        "daily": {k: dict(v) for k, v in sorted(daily.items())},
    }
    print(json.dumps(output, ensure_ascii=False, indent=2))
else:
    print(f"📊 L3安全趋势报告 ({days}天)")
    print("=" * 50)
    print(f"  统计周期: {cutoff.strftime('%Y-%m-%d')} → {now.strftime('%Y-%m-%d')}")
    print(f"  提交次数: {len(window)} (日均 {daily_commits:.1f})")
    print(f"  活跃天数: {active_days}")
    print(f"  扫描文件: {total_scanned} | 变更行: {total_lines}")
    print(f"  平均耗时: {avg_scan_ms:.0f}ms/次")
    print()
    print("  ── 发现统计 ──")
    print(f"  L1阻断: {blocks} 次 | L1发现: {total_findings_l1}")
    print(f"  L2警告: {total_findings_l2} | L3记录: {total_findings_l3}")
    print()
    print("  ── 规则TOP5 ──")
    for i, (rule, count) in enumerate(top5, 1):
        bar = "█" * min(count, 30)
        print(f"  {i}. {rule}: {count} {bar}")
    if top5_l3:
        print()
        print("  ── L3规则TOP5 ──")
        for i, (rule, count) in enumerate(top5_l3, 1):
            print(f"  {i}. {rule}: {count}")
    if upgrade_candidates:
        print()
        print("  ── L3→L2 升级建议 ──")
        for c in sorted(upgrade_candidates, key=lambda x: x["totalHits"], reverse=True)[:3]:
            print(f"  [{c['ruleId']}] 命中{c['totalHits']}次/活跃{c['activeDays']}天 → 建议升级到L2")
PYEOF
}

run_analysis
