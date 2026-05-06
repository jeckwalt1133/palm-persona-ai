#!/bin/bash
# 闲置自检 — 无任务时自动回顾记忆，防止跑偏
# 用法: bash scripts/idle-review.sh
# 产出: /tmp/idle-review-context.md (可注入到会话上下文)
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MEMORY_DIR="$PROJECT_DIR/memory"
OUTPUT="/tmp/idle-review-context.md"

cat > "$OUTPUT" << 'REVIEW_EOF'
# 团队闲置自检报告

> 自动生成于 $(date '+%Y-%m-%d %H:%M:%S') | AI师生研究院 V7

## 当前状态

REVIEW_EOF

# 1. 读取团队仪表盘
if [ -f "$MEMORY_DIR/team-status.json" ]; then
  echo "### 团队任务状态" >> "$OUTPUT"
  python3 -c "
import json
with open('$MEMORY_DIR/team-status.json') as f:
    d = json.load(f)
ct = d.get('currentTask', {})
print(f\"- 当前任务: {ct.get('id','?')} — {ct.get('title','?')}\")
print(f\"- 状态: {ct.get('status','?')} | 进度: {ct.get('progress','?')}\")
print(f\"- 负责人: {ct.get('assignedTo','?')}\")
print(f\"- 下一步: {ct.get('nextAction','?')}\")
print()
print('### 团队状态')
for role, info in d.get('teamMembers', {}).items():
    print(f\"- {role}: {info.get('status','?')} | {info.get('currentFocus','?')}\")
print()
pq = d.get('priorityQueue', [])
print('### 优先级队列')
for item in pq[:8]:
    status = item.get('status','?')
    icon = '✅' if status == 'completed' else ('🔄' if status == 'in_progress' else ('📋' if status == 'dispatched' else '⏳'))
    print(f\"{icon} {item.get('id','?')} — {item.get('title','?')} [{item.get('assignee','?')}] ({status})\")
" >> "$OUTPUT" 2>/dev/null || echo "  (team-status.json 解析失败)" >> "$OUTPUT"
fi

# 2. 毕业状态
if [ -f "$PROJECT_DIR/curriculum/graduation-ladder.json" ]; then
  echo "" >> "$OUTPUT"
  echo "### 毕业进度" >> "$OUTPUT"
  python3 -c "
import json
with open('$PROJECT_DIR/curriculum/graduation-ladder.json') as f:
    d = json.load(f)
cs = d.get('currentStatus', {})
print(f\"- 已完成等级: {', '.join(cs.get('completedLevels', []))}\")
print(f\"- 进行中: {', '.join(cs.get('inProgressLevels', []))}\")
print(f\"- 当前焦点: {cs.get('currentFocus', '?')}\")
" >> "$OUTPUT" 2>/dev/null || echo "  (graduation-ladder.json 解析失败)" >> "$OUTPUT"
fi

# 3. 上次决策
if [ -f "$MEMORY_DIR/decisions.md" ]; then
  echo "" >> "$OUTPUT"
  echo "### 最近决策" >> "$OUTPUT"
  tail -20 "$MEMORY_DIR/decisions.md" | grep -E "^(##|D[0-9]+|-) " | tail -5 >> "$OUTPUT" 2>/dev/null || echo "  (无最近决策)" >> "$OUTPUT"
fi

# 4. 偏离检测
echo "" >> "$OUTPUT"
echo "### 偏离检测" >> "$OUTPUT"

# 检查是否偏离了方法论核心
PROTOCOL="$PROJECT_DIR/PROTOCOL.md"
if [ -f "$PROTOCOL" ]; then
  CORE_RULES=$(grep -c "教师不直接写代码\|学生独立工作\|三角互批判" "$PROTOCOL" 2>/dev/null || echo "0")
  echo "- 核心规则: PROTOCOL.md 定义了 ${CORE_RULES:-0} 条规则" >> "$OUTPUT"
fi

# 检查最近是否做了不该做的事
RECENT_DECISIONS=$(tail -30 "$MEMORY_DIR/decisions.md" 2>/dev/null | grep -c "产品\|用户测试\|文案库\|埋点" || echo "0")
if [ "${RECENT_DECISIONS:-0}" -gt 3 ]; then
  echo "- ⚠️  最近决策中产品相关条目较多(${RECENT_DECISIONS}条)。确认未偏离方法论纯化方向。" >> "$OUTPUT"
else
  echo "- 方法论纯化: 无偏离迹象" >> "$OUTPUT"
fi

# 4.5. 跨学习强制执行检查
echo "" >> "$OUTPUT"
echo "### 跨学习状态" >> "$OUTPUT"
CROSS_RESULT=$(bash "$PROJECT_DIR/scripts/cross-learning-check.sh" 2>&1) || true
VIOLATIONS=$(echo "$CROSS_RESULT" | grep -c "❌" 2>/dev/null | head -1) || VIOLATIONS=0
VIOLATIONS=${VIOLATIONS:-0}
echo "$CROSS_RESULT" >> "$OUTPUT"
if [ "${VIOLATIONS:-0}" -gt 0 ]; then
  echo "- 🟡 跨学习违规: ${VIOLATIONS}人无交叉审查记录。建议立即分配跨领域审查任务。" >> "$OUTPUT"
fi

# 5. 建议下一步
echo "" >> "$OUTPUT"
echo "### 建议下一步" >> "$OUTPUT"

# 检查是否有活跃P0任务
P0_PENDING=$(python3 -c "
import json
with open('$MEMORY_DIR/team-status.json') as f:
    d = json.load(f)
pq = d.get('priorityQueue', [])
p0_pending = [i for i in pq if i.get('status') in ('pending','assigned','dispatched')]
if p0_pending:
    print(f'还有 {len(p0_pending)} 个未完成任务。优先执行: {p0_pending[0][\"id\"]} {p0_pending[0][\"title\"]}')
else:
    ct = d.get('currentTask', {})
    if ct.get('status') == 'in_progress':
        print(f'继续执行当前任务: {ct[\"id\"]} — {ct.get(\"nextAction\",\"?\")}')
    else:
        print('没有活跃任务。检查 task-pool.json 选择下一个任务。')
" 2>/dev/null || echo "无法读取团队状态，请手动检查")

# 6. 自检提醒
cat >> "$OUTPUT" << 'REVIEW_EOF'

## 自检清单

回答以下问题（每次闲置时自问）：

1. **我在做什么？** — 当前任务是否清晰？
2. **为什么做这个？** — 这个任务对方法论进化有什么贡献？
3. **有没有跑偏？** — 有没有在做产品功能而非方法论优化？
4. **别人在做什么？** — 团队成员是否闲置？是否需要协作？
5. **上次停在哪？** — 如果刚恢复，上次做到哪一步了？

REVIEW_EOF

echo "闲置自检完成 → $OUTPUT"
echo "---"
head -50 "$OUTPUT"
