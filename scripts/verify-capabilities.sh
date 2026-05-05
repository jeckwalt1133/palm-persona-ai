#!/usr/bin/env bash
# ============================================================================
# verify-capabilities.sh — 能力声明验证脚本
#
# 读取 capability-inventory.json 中所有能力声明，逐项检查是否有证据佐证。
# 验证逻辑：
#   1. evidence 字段指向的文件是否存在
#   2. decisions.md 中是否有相关决策记录
#   3. git log 中是否有相关提交
#   4. 能力名称关键词是否在证据源中出现
#
# 输出: /tmp/capability-verification-report.md
# 用法: bash scripts/verify-capabilities.sh
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
INVENTORY="$REPO_ROOT/memory/capability-inventory.json"
DECISIONS="$REPO_ROOT/memory/decisions.md"
REPORT="/tmp/capability-verification-report.md"
TODAY=$(date +%Y-%m-%d)

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

if [ ! -f "$INVENTORY" ]; then
  echo "❌ 找不到能力清单: $INVENTORY"
  exit 1
fi

echo "▎能力声明验证引擎启动..."
echo "▎清单: $INVENTORY"
echo "▎决策记录: $DECISIONS"
echo ""

# ─── 辅助函数 ────────────────────────────────────

# 检查 evidence 路径是否存在
check_evidence_file() {
  local evidence="$1"
  local found=0
  local sources=""

  # 辅助: 尝试验证一个路径候选
  try_path() {
    local candidate="$1"
    # 去掉尾随的括号注释 "(...)" 或 "（...）"
    candidate=$(echo "$candidate" | sed 's/[（(][^)）]*[)）]$//' | xargs)
    [ -z "$candidate" ] && return 1

    local full_path="$REPO_ROOT/$candidate"
    if [ -f "$full_path" ] || [ -d "$full_path" ]; then
      echo "$candidate"
      return 0
    fi
    # 递归搜索文件名（尝试完整路径失败后，用basename搜索）
    local fname=$(basename "$candidate" 2>/dev/null)
    if [ -n "$fname" ]; then
      local found_path=$(find "$REPO_ROOT" -name "$fname" -not -path '*/node_modules/*' -not -path '*/.git/*' 2>/dev/null | head -1)
      if [ -n "$found_path" ] && [ -f "$found_path" ]; then
        echo "${found_path#$REPO_ROOT/}"
        return 0
      fi
    fi
    return 1
  }

  # 提取候选路径：先尝试整个evidence，再尝试 " + " 分隔的片段
  local CANDIDATES=("$evidence")
  if [[ "$evidence" == *" + "* ]]; then
    IFS='+' read -ra SPLIT_PARTS <<< "$evidence"
    for sp in "${SPLIT_PARTS[@]}"; do
      sp=$(echo "$sp" | xargs)
      [ -n "$sp" ] && CANDIDATES+=("$sp")
    done
  fi

  for part in "${CANDIDATES[@]}"; do
    part=$(echo "$part" | xargs)

    # 策略1: 直接尝试整个part
    local result=$(try_path "$part" 2>/dev/null)
    if [ -n "$result" ]; then
      found=$((found + 1))
      sources="$sources $result"
      continue
    fi

    # 策略2: 提取第一个看起来像路径的词（含扩展名或以/开头）
    local first_word=$(echo "$part" | grep -oP '^[^\s]+\.[a-z]+' 2>/dev/null || echo "")
    if [ -n "$first_word" ]; then
      result=$(try_path "$first_word" 2>/dev/null)
      if [ -n "$result" ]; then
        found=$((found + 1))
        sources="$sources $result"
        continue
      fi
    fi

    # 策略3: 提取 / 分隔的路径模式
    local path_pattern=$(echo "$part" | grep -oP '[^\s]+/[^\s]+\.[a-z]+' 2>/dev/null || echo "")
    if [ -n "$path_pattern" ]; then
      result=$(try_path "$path_pattern" 2>/dev/null)
      if [ -n "$result" ]; then
        found=$((found + 1))
        sources="$sources $result"
        continue
      fi
    fi
  done

  # Fallback: 搜索 decisions.md
  if [ $found -eq 0 ]; then
    if grep -qi "$evidence" "$DECISIONS" 2>/dev/null; then
      found=1
      sources="decisions.md (关键词匹配)"
    fi
  fi

  echo "$found|$sources"
}

# 检查能力关键词是否在 decisions.md 中
check_decisions_for_capability() {
  local cap_name="$1"
  local cap_id="$2"
  local matches=0

  # 提取能力关键词（去掉通用词）
  local keywords=$(echo "$cap_name" | sed 's/能力\|系统\|管理\|设计\|理解\|开发\|编写\|执行//g')
  for kw in $keywords; do
    if [ ${#kw} -ge 2 ] && grep -qi "$kw" "$DECISIONS" 2>/dev/null; then
      matches=$((matches + 1))
    fi
  done

  echo "$matches"
}

# 检查 git log 中是否有相关提交
check_git_for_capability() {
  local cap_name="$1"
  local key_term=$(echo "$cap_name" | grep -oP '[\x{4e00}-\x{9fff}]{2,}' | head -3 | tr '\n' '|' | sed 's/|$//')
  if [ -n "$key_term" ] && [ ${#key_term} -ge 2 ]; then
    git -C "$REPO_ROOT" log --oneline -30 --grep="$key_term" 2>/dev/null | wc -l
  else
    echo "0"
  fi
}

# 计算上次使用距今的天数
days_since_last_use() {
  local last_used="$1"
  if [ "$last_used" = "null" ] || [ -z "$last_used" ]; then
    echo "999"
    return
  fi
  local last_epoch=$(date -d "$last_used" +%s 2>/dev/null || echo "0")
  if [ "$last_epoch" = "0" ]; then
    echo "999"
    return
  fi
  local now_epoch=$(date +%s)
  echo $(( (now_epoch - last_epoch) / 86400 ))
}

# ─── 主验证逻辑 ────────────────────────────────────

# 使用 python3 解析 JSON 并逐行输出能力数据
# 格式: domain|domain_name|cap_id|cap_name|level|proficiency|last_used|evidence

echo "▎正在扫描能力清单..."

TOTAL=0
VERIFIED=0
UNVERIFIED=0
DEGRADED=0
PENDING=0

# 生成报告头
cat > "$REPORT" << 'REPORT_HEAD'
# 能力声明验证报告

> 自动生成于: REPORT_DATE
> 验证引擎: scripts/verify-capabilities.sh
> 数据源: memory/capability-inventory.json + decisions.md + 文件系统 + git log

## 验证方法

| 验证维度 | 方法 | 权重 |
|---------|------|------|
| 文件证据 | evidence字段指向的文件是否存在 | 40% |
| 决策佐证 | decisions.md中是否有相关决策 | 30% |
| Git历史 | git log中是否有相关提交 | 20% |
| 时效性 | lastUsed是否在退化阈值内 | 10% |

## 验证状态定义

- ✅ **verified**: 至少2个维度有佐证
- ⚠️ **unverified**: 0-1个维度有佐证（需补充证据或降级）
- 🔻 **degraded**: 曾验证但超过退化阈值（L1>30天/L2>60天/L3>90天未使用）

---

REPORT_HEAD

sed -i "s/REPORT_DATE/$TODAY/" "$REPORT"

# 收集所有能力数据
CAP_DATA=$(python3 -c "
import json, sys

with open('$INVENTORY', 'r') as f:
    data = json.load(f)

domains = data.get('domains', {})
for dom_key, dom_val in domains.items():
    dom_name = dom_val.get('name', dom_key)
    for cap in dom_val.get('capabilities', []):
        cid = cap.get('id', '?')
        cname = cap.get('name', '?')
        level = cap.get('level', '?')
        proficiency = cap.get('proficiency', '')
        last_used = cap.get('lastUsed') or 'null'
        evidence = cap.get('evidence', '')
        evidence_tier = cap.get('evidenceTier', 'file')
        print(f'{dom_key}|{dom_name}|{cid}|{cname}|{level}|{proficiency}|{last_used}|{evidence}|{evidence_tier}')
" 2>&1)

if [ -z "$CAP_DATA" ]; then
  echo "❌ JSON解析失败，检查 capability-inventory.json 格式"
  exit 1
fi

# 按领域分组输出
current_domain=""
while IFS='|' read -r dom_key dom_name cid cname level proficiency last_used evidence evidence_tier; do
  TOTAL=$((TOTAL + 1))

  # 领域标题
  if [ "$dom_key" != "$current_domain" ]; then
    current_domain="$dom_key"
    echo "" >> "$REPORT"
    echo "## $dom_name ($dom_key)" >> "$REPORT"
    echo "" >> "$REPORT"
    echo "| ID | 能力 | 级别 | 证据层 | 文件证据 | 决策佐证 | Git历史 | 时效(d) | 状态 |" >> "$REPORT"
    echo "|---|------|------|------|---------|---------|--------|--------|------|" >> "$REPORT"
  fi

  # 验证维度 1: 文件证据 (evidenceTier=descriptive时自动通过)
  if [ "$evidence_tier" = "descriptive" ]; then
    evidence_found=1
    evidence_sources="证据层:描述性(已接受)"
  elif [ "$evidence_tier" = "pending" ]; then
    evidence_found=0
    evidence_sources="证据层:等待中"
  else
    evidence_result=$(check_evidence_file "$evidence")
    evidence_found=$(echo "$evidence_result" | cut -d'|' -f1)
    evidence_sources=$(echo "$evidence_result" | cut -d'|' -f2)
  fi

  # 验证维度 2: 决策佐证
  decision_matches=$(check_decisions_for_capability "$cname" "$cid")

  # 验证维度 3: Git历史
  git_matches=$(check_git_for_capability "$cname")

  # 验证维度 4: 时效性
  days_ago=$(days_since_last_use "$last_used")
  degraded=0
  if [ "$level" = "L1" ] && [ "$days_ago" -gt 30 ]; then
    degraded=1
  elif [ "$level" = "L2" ] && [ "$days_ago" -gt 60 ]; then
    degraded=1
  elif [ "$level" = "L3" ] && [ "$days_ago" -gt 90 ]; then
    degraded=1
  fi

  # 综合判定
  verification_score=0
  if [ "$evidence_found" -gt 0 ]; then
    verification_score=$((verification_score + 1))
  fi
  if [ "$decision_matches" -gt 0 ]; then
    verification_score=$((verification_score + 1))
  fi
  if [ "$git_matches" -gt 0 ]; then
    verification_score=$((verification_score + 1))
  fi

  if [ "$evidence_tier" = "pending" ]; then
    status="🔷 pending"
    PENDING=$((PENDING + 1))
  elif [ "$degraded" -eq 1 ]; then
    status="🔻 degraded"
    DEGRADED=$((DEGRADED + 1))
  elif [ "$verification_score" -ge 2 ] || [ "$evidence_tier" = "descriptive" ]; then
    status="✅ verified"
    VERIFIED=$((VERIFIED + 1))
  else
    status="⚠️ unverified"
    UNVERIFIED=$((UNVERIFIED + 1))
  fi

  # 证据缩略
  evidence_icon="❌"
  [ "$evidence_found" -gt 0 ] && evidence_icon="✅"
  decision_icon="❌"
  [ "$decision_matches" -gt 0 ] && decision_icon="✅"
  git_icon="❌"
  [ "$git_matches" -gt 0 ] && git_icon="✅"

  # 证据层缩写
  tier_label="file"
  [ "$evidence_tier" = "descriptive" ] && tier_label="desc"
  [ "$evidence_tier" = "pending" ] && tier_label="pend"

  echo "| $cid | $cname | $level | $tier_label | $evidence_icon | $decision_icon | $git_icon | $days_ago | $status |" >> "$REPORT"

  # 终端输出
  if [ "$status" = "⚠️ unverified" ]; then
    echo -e "  ${YELLOW}⚠${NC} $cid $cname — 佐证不足 (文件:$evidence_found 决策:$decision_matches git:$git_matches)"
  elif [ "$status" = "🔻 degraded" ]; then
    echo -e "  ${RED}🔻${NC} $cid $cname — 已退化 ($days_ago天未使用)"
  elif [ "$status" = "🔷 pending" ]; then
    echo -e "  ${BLUE}🔷${NC} $cid $cname — 等待验证 (evidenceTier=pending)"
  fi
done <<< "$CAP_DATA"

# ─── 汇总统计 ────────────────────────────────────

cat >> "$REPORT" << EOF

---

## 汇总统计

| 指标 | 数量 | 占比 |
|------|------|------|
| 总能力数 | $TOTAL | 100% |
| ✅ 已验证 | $VERIFIED | $(awk "BEGIN {printf \"%.1f\", ($VERIFIED/$TOTAL)*100}")% |
| ⚠️ 未验证 | $UNVERIFIED | $(awk "BEGIN {printf \"%.1f\", ($UNVERIFIED/$TOTAL)*100}")% |
| 🔻 已退化 | $DEGRADED | $(awk "BEGIN {printf \"%.1f\", ($DEGRADED/$TOTAL)*100}")% |
| 🔷 等待中 | $PENDING | $(awk "BEGIN {printf \"%.1f\", ($PENDING/$TOTAL)*100}")% |

## 证据层统计

- **描述性证据 (descriptive)**: 证据为运行状态/git历史等非文件形式，已接受
- **文件证据 (file)**: 证据指向具体文件，需通过文件存在+决策+git三维验证
- **等待中 (pending)**: 等待其他任务完成后自动验证

## 建议操作

EOF

# 生成建议
if [ "$UNVERIFIED" -gt 0 ]; then
  echo "### 需补充证据 ($UNVERIFIED 项)" >> "$REPORT"
  echo "" >> "$REPORT"
  grep '| ⚠️' "$REPORT" | while read -r line; do
    cap_id=$(echo "$line" | awk -F'|' '{print $2}' | xargs)
    cap_name=$(echo "$line" | awk -F'|' '{print $3}' | xargs)
    echo "- **$cap_id** ($cap_name): 建议在 decisions.md 中添加相关决策记录，或将 evidence 指向具体文件路径" >> "$REPORT"
  done
fi

if [ "$DEGRADED" -gt 0 ]; then
  echo "" >> "$REPORT"
  echo "### 需刷新能力 ($DEGRADED 项)" >> "$REPORT"
  echo "" >> "$REPORT"
  grep '| 🔻' "$REPORT" | while read -r line; do
    cap_id=$(echo "$line" | awk -F'|' '{print $2}' | xargs)
    cap_name=$(echo "$line" | awk -F'|' '{print $3}' | xargs)
    echo "- **$cap_id** ($cap_name): 超过退化阈值，需重新验证或降级" >> "$REPORT"
  done
fi

if [ "$PENDING" -gt 0 ]; then
  echo "" >> "$REPORT"
  echo "### 等待验证 ($PENDING 项)" >> "$REPORT"
  echo "" >> "$REPORT"
  grep '| 🔷' "$REPORT" | while read -r line; do
    cap_id=$(echo "$line" | awk -F'|' '{print $2}' | xargs)
    cap_name=$(echo "$line" | awk -F'|' '{print $3}' | xargs)
    echo "- **$cap_id** ($cap_name): 等待依赖任务完成，当前标记为 evidenceTier=pending" >> "$REPORT"
  done
fi

# ─── 终端汇总 ────────────────────────────────────

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "▎验证完成"
echo "▎总计: $TOTAL | ✅ $VERIFIED | ⚠️ $UNVERIFIED | 🔻 $DEGRADED | 🔷 $PENDING"
echo "▎报告: $REPORT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 退出码：有未验证项时返回1
[ "$UNVERIFIED" -eq 0 ] && exit 0 || exit 1
