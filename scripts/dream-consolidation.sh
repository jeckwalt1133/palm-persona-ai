#!/bin/bash
# 记忆巩固"做梦"引擎 — 空闲时随机回放旧记忆，建立跨领域连接
# 灵感: 海马体重放假说 (Hippocampal Replay) + DeepMind Generative Replay
# 用法: bash scripts/dream-consolidation.sh [dream-cycles]
# 产出: memory/dream-log/YYYY-MM-DD-HHMMSS-dream.md

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MEMORY_DIR="$PROJECT_DIR/memory"
SNAPSHOT_DIR="$MEMORY_DIR/snapshots"
DREAM_DIR="$MEMORY_DIR/dream-log"
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
NOW_SHORT=$(date -u +%Y-%m-%d-%H%M%S)
CYCLES="${1:-3}"  # 默认回放3个记忆片段

mkdir -p "$DREAM_DIR"

# ============================================================
# 阶段1: 随机采样记忆片段
# ============================================================

echo "🌙 进入记忆巩固阶段 — 回放 ${CYCLES} 个记忆片段..."

FRAGMENTS=()

# 从快照池随机采样
if [ -d "$SNAPSHOT_DIR" ] && [ "$(ls "$SNAPSHOT_DIR"/*.json 2>/dev/null | wc -l)" -gt 0 ]; then
  SNAPSHOT_COUNT=$(ls "$SNAPSHOT_DIR"/*.json 2>/dev/null | wc -l)
  SAMPLE_SIZE=$(( CYCLES < SNAPSHOT_COUNT ? CYCLES : SNAPSHOT_COUNT ))

  # 随机选择快照（用 shuf，没有就排序取最近）
  if command -v shuf &>/dev/null; then
    SELECTED=$(ls "$SNAPSHOT_DIR"/*.json 2>/dev/null | shuf -n "$SAMPLE_SIZE")
  else
    SELECTED=$(ls "$SNAPSHOT_DIR"/*.json 2>/dev/null | sort -R | head -n "$SAMPLE_SIZE")
  fi

  while IFS= read -r snap; do
    [ -n "$snap" ] && FRAGMENTS+=("$snap")
  done <<< "$SELECTED"
fi

# 从决策日志随机采样（补充快照）
DECISIONS_FILE="$MEMORY_DIR/decisions.md"
if [ -f "$DECISIONS_FILE" ]; then
  # 提取决策标题
  DECISION_TITLES=$(grep -E "^## D[0-9]+|^- D[0-9]+" "$DECISIONS_FILE" 2>/dev/null | tail -20 || true)
  if [ -n "$DECISION_TITLES" ]; then
    if command -v shuf &>/dev/null; then
      echo "$DECISION_TITLES" | shuf -n 2 >> "$DREAM_DIR/.tmp-decisions.txt" 2>/dev/null || true
    else
      echo "$DECISION_TITLES" | sort -R | head -n 2 >> "$DREAM_DIR/.tmp-decisions.txt" 2>/dev/null || true
    fi
  fi
fi

# ============================================================
# 阶段2: 生成做梦报告
# ============================================================

DREAM_FILE="$DREAM_DIR/${NOW_SHORT}-dream.md"

cat > "$DREAM_FILE" << DREAM_EOF
# 🧠 记忆巩固梦境 — $NOW

> 回放 ${CYCLES} 个记忆片段 | 海马体重放模式

## 回放的记忆片段

DREAM_EOF

FRAGMENT_INDEX=1
for fragment in "${FRAGMENTS[@]}"; do
  echo "### 片段 $FRAGMENT_INDEX: $(basename "$fragment")" >> "$DREAM_FILE"
  echo "" >> "$DREAM_FILE"

  # 提取快照关键信息
  python3 -c "
import json, sys
try:
    with open('$fragment') as f:
        d = json.load(f)
    print(f\"- 时间: {d.get('timestamp', '?')}\")
    print(f\"- 分支: {d.get('git', {}).get('branch', '?')}\")
    print(f\"- 最后提交: {d.get('git', {}).get('lastCommit', '?')}\")
    print(f\"- 未提交文件: {d.get('git', {}).get('uncommittedFiles', '?')}\")
    decisions = d.get('decisions', [])
    if decisions:
        print(f\"- 决策数: {len(decisions)}\")
    discoveries = d.get('discoveries', [])
    if discoveries:
        print(f\"- 发现数: {len(discoveries)}\")
        for disc in discoveries[:3]:
            print(f\"  - {disc.get('title', '?')}\")
    print()
except Exception as e:
    print(f'(解析失败: {e})')
" >> "$DREAM_FILE" 2>/dev/null || echo "(快照解析失败)" >> "$DREAM_FILE"

  FRAGMENT_INDEX=$((FRAGMENT_INDEX + 1))
done

# 附加随机决策
if [ -f "$DREAM_DIR/.tmp-decisions.txt" ]; then
  echo "### 随机决策回放" >> "$DREAM_FILE"
  echo "" >> "$DREAM_FILE"
  cat "$DREAM_DIR/.tmp-decisions.txt" >> "$DREAM_FILE"
  rm -f "$DREAM_DIR/.tmp-decisions.txt"
  echo "" >> "$DREAM_FILE"
fi

# ============================================================
# 阶段3: 整合洞察模板（供 Agent 填写）
# ============================================================

cat >> "$DREAM_FILE" << 'DREAM_EOF'

## 跨片段连接

> Agent 请在此回答以下问题：

1. **这些记忆片段之间有什么共同主题？**
   （待填写）

2. **有没有某个模式反复出现？**
   （待填写）

3. **有没有之前没注意到的关联？**
   （待填写）

4. **哪些记忆已经过时，可以归档？**
   （待填写）

## 巩固写入

> Agent 如果发现了有价值的洞察，请将整合后的知识写入以下位置：
> - 方法论洞察 → `memory/knowledge-graph.json`
> - 团队经验 → `memory/decisions.md`（新 D 条目）
> - 课程更新 → `curriculum/` 相关文件

---

*梦境引擎 V1 | 基于海马体重放假说 | AI师生研究院记忆系统*
DREAM_EOF

# ============================================================
# 阶段4: 剪枝建议
# ============================================================

# 标记30天以上的快照
OLD_SNAPSHOTS=$(find "$SNAPSHOT_DIR" -name "*.json" -mtime +30 2>/dev/null | wc -l || echo "0")

cat >> "$DREAM_FILE" << DREAM_EOF

## 记忆健康

- 快照总数: $(ls "$SNAPSHOT_DIR"/*.json 2>/dev/null | wc -l)
- 超过30天快照: ${OLD_SNAPSHOTS}（建议归档）
- 梦境日志: $(ls "$DREAM_DIR"/*-dream.md 2>/dev/null | wc -l)

DREAM_EOF

echo "✅ 梦境巩固完成 → $DREAM_FILE"
echo "---"
head -30 "$DREAM_FILE"
