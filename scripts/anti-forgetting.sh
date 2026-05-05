#!/bin/bash
# 防遗忘系统 — 检测能力退化风险，触发间隔重复重放
# 灵感: 海马体重放 + Anki间隔重复 + learning-standards.md 退化规则
# 用法: bash scripts/anti-forgetting.sh [--rehearse]
# 产出: /tmp/anti-forgetting-report.md

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
INVENTORY="$PROJECT_DIR/memory/capability-inventory.json"
OUTPUT="/tmp/anti-forgetting-report.md"
NOW=$(date -u +%Y-%m-%d)
NOW_TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# 退化阈值（天）
L1_THRESHOLD=30
L2_THRESHOLD=60
L3_THRESHOLD=90
YELLOW_RATIO=0.7   # 阈值70%时黄色预警
RED_RATIO=1.0      # 阈值100%时红色警报

cat > "$OUTPUT" << EOF
# 防遗忘自检报告

> 生成于 $NOW_TS | 基于 capability-inventory.json

## 退化风险检测

EOF

AT_RISK_COUNT=0
CRITICAL_COUNT=0

python3 << PYEOF
import json, sys
from datetime import datetime, timedelta

with open('$INVENTORY') as f:
    inv = json.load(f)

L1_THRESHOLD = $L1_THRESHOLD
L2_THRESHOLD = $L2_THRESHOLD
L3_THRESHOLD = $L3_THRESHOLD
YELLOW_RATIO = $YELLOW_RATIO
NOW = datetime(2026, 5, 6)

at_risk = []
critical = []
never_used = []

for domain_id, domain in inv['domains'].items():
    for cap in domain['capabilities']:
        cap_id = cap['id']
        name = cap['name']
        level = cap['level']
        last_used = cap.get('lastUsed')

        if last_used is None:
            never_used.append({
                'id': cap_id,
                'name': name,
                'level': level,
                'domain': domain['name'],
                'daysUnused': '从未使用'
            })
            continue

        # 计算天数差
        try:
            last_date = datetime.strptime(last_used, '%Y-%m-%d')
            days_diff = (NOW - last_date).days
        except:
            continue

        threshold = {'L1': L1_THRESHOLD, 'L2': L2_THRESHOLD, 'L3': L3_THRESHOLD}.get(level, L1_THRESHOLD)
        ratio = days_diff / threshold if threshold > 0 else 0

        entry = {
            'id': cap_id,
            'name': name,
            'level': level,
            'domain': domain['name'],
            'daysUnused': days_diff,
            'threshold': threshold,
            'ratio': round(ratio, 2)
        }

        if ratio >= 1.0:
            critical.append(entry)
        elif ratio >= YELLOW_RATIO:
            at_risk.append(entry)

# 按风险比率排序（最危险的排前面）
critical.sort(key=lambda x: x['ratio'], reverse=True)
at_risk.sort(key=lambda x: x['ratio'], reverse=True)

# 输出到报告
with open('$OUTPUT', 'a') as f:
    if critical:
        f.write(f'### 🔴 红色警报 — 已超过退化阈值 ({len(critical)}项)\n\n')
        f.write('| ID | 能力 | 等级 | 闲置天数 | 阈值 | 风险 |\n')
        f.write('|----|------|------|----------|------|------|\n')
        for c in critical:
            action = {'L1': '退回未验证', 'L2': '退回L1', 'L3': '退回L2'}.get(c['level'], '?')
            f.write(f'| {c["id"]} | {c["name"]} | {c["level"]} | {c["daysUnused"]}d | {c["threshold"]}d | {action} |\n')
        f.write('\n')
    else:
        f.write('### 🔴 红色警报: 无\n\n')

    if at_risk:
        f.write(f'### 🟡 黄色预警 — 接近退化阈值 ({len(at_risk)}项)\n\n')
        f.write('| ID | 能力 | 等级 | 闲置天数 | 阈值 | 剩余 |\n')
        f.write('|----|------|------|----------|------|------|\n')
        for c in at_risk:
            remaining = c['threshold'] - c['daysUnused']
            f.write(f'| {c["id"]} | {c["name"]} | {c["level"]} | {c["daysUnused"]}d | {c["threshold"]}d | {remaining}d |\n')
        f.write('\n')
    else:
        f.write('### 🟡 黄色预警: 无\n\n')

    if never_used:
        f.write(f'### ⚪ 从未使用 — 新注册但未实践 ({len(never_used)}项)\n\n')
        f.write('| ID | 能力 | 等级 | 领域 |\n')
        f.write('|----|------|------|------|\n')
        for c in never_used:
            f.write(f'| {c["id"]} | {c["name"]} | {c["level"]} | {c["domain"]} |\n')
        f.write('\n')

    # 汇总统计
    total = sum(len(d['capabilities']) for d in inv['domains'].values())
    healthy = total - len(critical) - len(at_risk) - len(never_used)
    f.write(f'## 统计\n\n')
    f.write(f'- 总能力数: {total}\n')
    f.write(f'- ✅ 健康: {healthy}\n')
    f.write(f'- 🟡 预警: {len(at_risk)}\n')
    f.write(f'- 🔴 危险: {len(critical)}\n')
    f.write(f'- ⚪ 未实践: {len(never_used)}\n')
    f.write('\n')

    # 建议行动
    f.write(f'## 建议行动\n\n')
    if critical:
        f.write(f'### 立即重放（今日）\n')
        for c in critical[:3]:
            f.write(f'- **{c["id"]} {c["name"]}**: 闲置{c["daysUnused"]}天，已超{c["threshold"]}天阈值。需重新验证。\n')
    if at_risk:
        f.write(f'### 本周排入 rehearsal\n')
        for c in at_risk[:3]:
            remaining = c['threshold'] - c['daysUnused']
            f.write(f'- **{c["id"]} {c["name"]}**: {remaining}天后退化。建议本周安排一次实践。\n')
    if never_used:
        f.write(f'### 安排首次实践\n')
        for c in never_used[:3]:
            f.write(f'- **{c["id"]} {c["name"]}**: 从未实践过，建议分配入门任务。\n')
    if not critical and not at_risk and not never_used:
        f.write(f'所有能力健康，无退化风险。\n')

    # 输出JSON给后续处理
    alerts = {'critical': critical, 'atRisk': at_risk, 'neverUsed': never_used, 'timestamp': '$NOW_TS'}
    with open('/tmp/anti-forgetting-alerts.json', 'w') as af:
        json.dump(alerts, af, indent=2, ensure_ascii=False)

PYEOF

echo "✅ 防遗忘检测完成 → $OUTPUT"
head -30 "$OUTPUT"
