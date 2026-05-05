#!/bin/bash
# 记忆健康检查 — 检查方法论基础设施是否正常运行
# 用法: bash scripts/methodology-health-check.sh [--json]
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MEMORY_DIR="$PROJECT_DIR/memory"
OUTPUT_JSON=false
WARNINGS=0
FAILURES=0

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

[[ "${1:-}" == "--json" ]] && OUTPUT_JSON=true

pass() { echo -e "  ${GREEN}[PASS]${NC} $1"; }
warn() { WARNINGS=$((WARNINGS + 1)); echo -e "  ${YELLOW}[WARN]${NC} $1"; }
fail() { FAILURES=$((FAILURES + 1)); echo -e "  ${RED}[FAIL]${NC} $1"; }

echo "============================================"
echo "  AI师生研究院 — 方法论健康检查"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================"
echo ""

# 1. 三角批判运行检查
echo "【1. 三角批判机制】"
LAST_CRITIQUE=$(find "$MEMORY_DIR" -name "*triangulation*" -o -name "*critique*" 2>/dev/null | sort -r | head -1)
if [ -n "$LAST_CRITIQUE" ]; then
  AGE_DAYS=$(( ($(date +%s) - $(stat -c %Y "$LAST_CRITIQUE")) / 86400 ))
  if [ "$AGE_DAYS" -le 7 ]; then
    pass "上次三角批判: $(basename "$LAST_CRITIQUE") (${AGE_DAYS}天前)"
  else
    warn "上次三角批判: ${AGE_DAYS}天前 — 建议每7天运行一次"
  fi
else
  fail "无三角批判记录"
fi

# 2. 记忆三层健康
echo ""
echo "【2. 三层记忆系统】"
# Layer 1: 工作记忆 (当前会话)
if [ -f "$MEMORY_DIR/bootstrap.md" ]; then
  BOOTSTRAP_AGE=$(( ($(date +%s) - $(stat -c %Y "$MEMORY_DIR/bootstrap.md")) / 3600 ))
  if [ "$BOOTSTRAP_AGE" -le 24 ]; then
    pass "Layer 1 工作记忆: bootstrap.md (${BOOTSTRAP_AGE}h前)"
  else
    warn "Layer 1 工作记忆: bootstrap.md (${BOOTSTRAP_AGE}h前) — 超过24h未更新"
  fi
else
  fail "Layer 1 工作记忆: bootstrap.md 缺失"
fi

# Layer 2: 情景记忆
SESSION_COUNT=$(find "$MEMORY_DIR/sessions" -name "*.md" 2>/dev/null | wc -l || echo "0")
NOTES_COUNT=$(find "$MEMORY_DIR/notes" -name "*.md" 2>/dev/null | wc -l || echo "0")
LAYER2_TOTAL=$((SESSION_COUNT + NOTES_COUNT))
if [ "$LAYER2_TOTAL" -ge 3 ]; then
  pass "Layer 2 情景记忆: ${LAYER2_TOTAL}条 (sessions:${SESSION_COUNT} notes:${NOTES_COUNT})"
elif [ "$LAYER2_TOTAL" -ge 1 ]; then
  warn "Layer 2 情景记忆: 仅${LAYER2_TOTAL}条 — 数据稀疏"
else
  fail "Layer 2 情景记忆: 0条记录"
fi

# Layer 3: 语义记忆
if [ -f "$MEMORY_DIR/knowledge-graph.json" ]; then
  GRAPH_NODES=$(grep -c '"id"' "$MEMORY_DIR/knowledge-graph.json" 2>/dev/null || echo "0")
  if [ "${GRAPH_NODES:-0}" -ge 3 ]; then
    pass "Layer 3 语义记忆: ${GRAPH_NODES}个节点"
  else
    warn "Layer 3 语义记忆: 仅${GRAPH_NODES}个节点 — 知识图谱近乎空"
  fi
else
  fail "Layer 3 语义记忆: knowledge-graph.json 缺失"
fi

# 3. 学生24h产出检查
echo ""
echo "【3. 学生产出监控】"
STUDENT_RECENT=$(find "$PROJECT_DIR/student-notebook" -name "*.md" -mtime -1 2>/dev/null | wc -l || echo "0")
if [ "${STUDENT_RECENT:-0}" -gt 0 ]; then
  pass "学生24h产出: ${STUDENT_RECENT}个文件"
else
  warn "学生24h产出: 0个文件 — 可能闲置"
fi

# 4. 教师违约检测
echo ""
echo "【4. 教师违约检测】"
TEACHER_CODE_COMMITS=$(git -C "$PROJECT_DIR" log --author="聂富贵\|Claude" --since="24 hours ago" --oneline 2>/dev/null | wc -l || echo "0")
if [ "${TEACHER_CODE_COMMITS:-0}" -eq 0 ]; then
  pass "教师最近24h无代码提交 — 遵守了'教师不写代码'规则"
else
  warn "教师最近24h有${TEACHER_CODE_COMMITS}次代码提交 — 请确认是否为学生任务被代劳"
fi

# 5. 自动进化触发条件
echo ""
echo "【5. 自动进化触发】"
LADDER="$PROJECT_DIR/curriculum/graduation-ladder.json"
if [ -f "$LADDER" ]; then
  COMPLETED=$(grep -c '"completed"' "$LADDER" 2>/dev/null || echo "0")
  LAST_UPGRADE=$(find "$MEMORY_DIR" -name "v*.upgrade-plan.md" 2>/dev/null | sort -r | head -1)
  if [ -n "$LAST_UPGRADE" ]; then
    UPGRADE_AGE=$(( ($(date +%s) - $(stat -c %Y "$LAST_UPGRADE")) / 3600 ))
    pass "上次升级方案: $(basename "$LAST_UPGRADE") (${UPGRADE_AGE}h前) | 已完成等级: ${COMPLETED:-0}"
  else
    pass "已完成等级: ${COMPLETED:-0} | 尚未触发自动进化"
  fi
fi

# 6. API Key 安全扫描
echo ""
echo "【6. API Key 安全】"
KEY_LEAKS=$(grep -rn "sk-[a-zA-Z0-9]\{20,\}" "$PROJECT_DIR/scripts/" 2>/dev/null | grep -v ".env" || echo "")
if [ -z "$KEY_LEAKS" ]; then
  pass "scripts/ 无硬编码API Key"
else
  fail "发现硬编码API Key:\n$KEY_LEAKS"
fi

# 7. Git 状态
echo ""
echo "【7. Git 状态】"
UNCOMMITTED=$(git -C "$PROJECT_DIR" status --porcelain 2>/dev/null | wc -l || echo "?")
COMMITS_AHEAD=$(git -C "$PROJECT_DIR" rev-list --count HEAD 2>/dev/null || echo "?")
if [ "${UNCOMMITTED:-0}" -le 5 ]; then
  pass "未提交变更: ${UNCOMMITTED}个文件"
else
  warn "未提交变更: ${UNCOMMITTED}个文件 — 建议提交"
fi

# 汇总
echo ""
echo "============================================"
if [ "$FAILURES" -eq 0 ] && [ "$WARNINGS" -eq 0 ]; then
  echo -e "  ${GREEN}全部健康 ✅${NC}"
  echo "============================================"
  exit 0
elif [ "$FAILURES" -eq 0 ]; then
  echo -e "  ${YELLOW}${WARNINGS}个警告 — 建议关注${NC}"
  echo "============================================"
  exit 0
else
  echo -e "  ${RED}${FAILURES}个失败 ${YELLOW}${WARNINGS}个警告${NC}"
  echo "============================================"
  exit 1
fi
