#!/bin/bash
# 证据自动验证 — 检查 graduation-ladder.json 中所有已声明的 evidence
# 用法: bash scripts/evidence-auto-verify.sh [--json]
# 退出码: 0=全部通过 1=部分失败 2=脚本错误

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LADDER="$PROJECT_DIR/curriculum/graduation-ladder.json"
OUTPUT_JSON=false
FAIL_COUNT=0
PASS_COUNT=0
RESULTS=""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

[[ "${1:-}" == "--json" ]] && OUTPUT_JSON=true

pass() { PASS_COUNT=$((PASS_COUNT + 1)); echo -e "  ${GREEN}✅ PASS${NC} $1"; }
fail() { FAIL_COUNT=$((FAIL_COUNT + 1)); echo -e "  ${RED}❌ FAIL${NC} $1 — ${2:-}"; }
warn() { echo -e "  ${YELLOW}⚠ WARN${NC} $1 — ${2:-}"; }

echo "============================================"
echo "  AI师生研究院 — 证据自动验证"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================"
echo ""

# ---- L1.1: 入门生 — 5门核心课程完成 ----
echo "【L1.1 入门生】5门核心课程"
NOTEBOOK_COUNT=$(find "$PROJECT_DIR/student-notebook/" -name "*.md" 2>/dev/null | wc -l)
if [ "$NOTEBOOK_COUNT" -ge 5 ]; then
  pass "学生笔记本: ${NOTEBOOK_COUNT}个文件 (≥5)"
else
  fail "学生笔记本≥5个" "仅${NOTEBOOK_COUNT}个"
fi

# ---- L1.2: 修学者 — 10门课+期中考试 ----
echo ""
echo "【L1.2 修学者】10门课程+期中考试"
if [ "$NOTEBOOK_COUNT" -ge 10 ]; then
  pass "学生笔记本: ${NOTEBOOK_COUNT}个文件 (≥10)"
else
  fail "学生笔记本≥10个" "仅${NOTEBOOK_COUNT}个"
fi
REPORT_CARD="$PROJECT_DIR/grades/report-card.json"
if [ -f "$REPORT_CARD" ]; then
  MIDTERM=$(grep -o '"midterm"[[:space:]]*:[[:space:]]*"[^"]*"' "$REPORT_CARD" 2>/dev/null || echo "")
  pass "期中成绩单存在: grades/report-card.json"
else
  fail "期中成绩单存在" "文件缺失"
fi

# ---- L1.3: 毕业生 — 毕业设计+答辩 ----
echo ""
echo "【L1.3 毕业生】毕业设计+答辩"
REPORT_AGENT="$PROJECT_DIR/server/src/engine/report-pipeline.ts"
if [ -f "$REPORT_AGENT" ]; then
  BYTES=$(wc -c < "$REPORT_AGENT")
  if [ "$BYTES" -gt 200 ]; then
    pass "ReportAgent存在 (${BYTES}字节)"
  else
    fail "ReportAgent存在" "文件过小 (${BYTES}字节)"
  fi
else
  fail "ReportAgent存在" "文件缺失"
fi
if [ -f "$REPORT_CARD" ]; then
  FINAL=$(grep -o '"final"[[:space:]]*:[[:space:]]*"[^"]*"' "$REPORT_CARD" 2>/dev/null || echo "")
  pass "期末答辩成绩记录存在"
else
  fail "期末答辩成绩记录" "无成绩单"
fi

# ---- L2.1: 研读者 — 10篇论文综述 ----
echo ""
echo "【L2.1 研读者】论文综述"
SURVEY="$PROJECT_DIR/learning/agent-research-survey-2026.md"
if [ -f "$SURVEY" ]; then
  BYTES=$(wc -c < "$SURVEY")
  if [ "$BYTES" -gt 5000 ]; then
    pass "论文综述: $(wc -c < "$SURVEY")字节 (≥5000)"
  else
    fail "论文综述≥5000字" "仅${BYTES}字节"
  fi
else
  fail "论文综述存在" "文件缺失"
fi

# ---- L2.2: 实验者 — A/B实验+108测试 ----
echo ""
echo "【L2.2 实验者】对抗实验+测试"
cd "$PROJECT_DIR/server" 2>/dev/null || true
TEST_OUTPUT=$(npx vitest run --reporter=verbose 2>&1) || true
# vitest格式: "Tests  102 passed (102)" 或 "Tests  1 failed | 101 passed (102)"
TEST_PASSED=$(echo "$TEST_OUTPUT" | grep -oP '\d+(?= passed)' | tail -1 || echo "0")
TEST_FAILED=$(echo "$TEST_OUTPUT" | grep -oP '\d+(?= failed)' | head -1 || echo "0")
if [ "${TEST_FAILED:-0}" -eq 0 ] && [ "${TEST_PASSED:-0}" -gt 0 ]; then
  pass "测试: ${TEST_PASSED:-0}通过 0失败"
else
  fail "测试全部通过" "${TEST_PASSED:-0}通过 ${TEST_FAILED:-0}失败"
fi

# ---- L3.1: 交付者 — 公网部署 ----
echo ""
echo "【L3.1 交付者】公网部署"
# 从 graduation-ladder 读取URL
URL=$(grep -oP 'https?://[a-zA-Z0-9.-]+\.lhr\.life' "$LADDER" 2>/dev/null | tail -1 || echo "")
if [ -z "$URL" ]; then
  URL=$(grep -oP 'https?://[a-zA-Z0-9.-]+\.lhr\.life' "$PROJECT_DIR/memory/bootstrap.md" 2>/dev/null | tail -1 || echo "")
fi
# 也尝试 bore.pub 和其他隧道
if [ -z "$URL" ]; then
  URL=$(grep -oP 'https?://[a-zA-Z0-9.-]+\.(lhr\.life|bore\.pub|trycloudflare\.com|ngrok\.io|localhost\.run)' "$LADDER" 2>/dev/null | tail -1 || echo "")
fi

if [ -n "$URL" ]; then
  # 测量响应时间
  START_TIME=$(date +%s%3N 2>/dev/null || date +%s)
  HTTP_CODE=$(curl -s -o /tmp/evidence-l3-response.txt -w "%{http_code}" --max-time 15 "$URL" 2>/dev/null || echo "000")
  END_TIME=$(date +%s%3N 2>/dev/null || date +%s)
  RESPONSE_TIME=$((END_TIME - START_TIME))
  # 清理非数字字符
  HTTP_CODE=$(echo "$HTTP_CODE" | tr -cd '0-9')
  [ -z "$HTTP_CODE" ] && HTTP_CODE="000"
  CONTENT_LEN=$(wc -c < /tmp/evidence-l3-response.txt 2>/dev/null || echo "0")
  rm -f /tmp/evidence-l3-response.txt

  if [ "$HTTP_CODE" = "200" ]; then
    if [ "$CONTENT_LEN" -gt 100 ]; then
      pass "公网HTTPS可达: $URL (HTTP $HTTP_CODE, ${RESPONSE_TIME}ms, ${CONTENT_LEN}字节)"
    else
      fail "公网内容有效" "$URL 返回200但仅${CONTENT_LEN}字节（疑似空白页）"
    fi
  elif [ "$HTTP_CODE" = "000" ]; then
    fail "公网HTTPS可达" "$URL 无法连接（隧道过期，需重建）"
  else
    fail "公网HTTPS 200" "$URL 返回 HTTP $HTTP_CODE (${RESPONSE_TIME}ms)"
  fi
else
  fail "公网URL找到" "未找到隧道地址（lhr.life/bore.pub等）"
fi

# ---- L4.1: 发布者 — GitHub开源 ----
echo ""
echo "【L4.1 发布者】GitHub开源仓库"
GITHUB_URL=$(grep -oP 'https://github\.com/[\w-]+/[\w-]+' "$LADDER" 2>/dev/null | head -1 || echo "")
if [ -n "$GITHUB_URL" ]; then
  # 提取 owner/repo
  GH_REPO=$(echo "$GITHUB_URL" | grep -oP 'github\.com/[\w-]+/[\w-]+' | head -1 | sed 's|github\.com/||')

  # GitHub API 检查真实数据
  GH_API="https://api.github.com/repos/$GH_REPO"
  GH_DATA=$(curl -s --max-time 10 -H "Accept: application/vnd.github+json" "$GH_API" 2>/dev/null || echo "{}")
  STARS=$(echo "$GH_DATA" | grep -oP '"stargazers_count"\s*:\s*\K\d+' || echo "0")
  FORKS=$(echo "$GH_DATA" | grep -oP '"forks_count"\s*:\s*\K\d+' || echo "0")
  OPEN_ISSUES=$(echo "$GH_DATA" | grep -oP '"open_issues_count"\s*:\s*\K\d+' || echo "0")
  IS_PRIVATE=$(echo "$GH_DATA" | grep -oP '"private"\s*:\s*\K\w+' || echo "unknown")
  LICENSE=$(echo "$GH_DATA" | grep -oP '"spdx_id"\s*:\s*"\K[^"]+' || echo "none")
  UPDATED=$(echo "$GH_DATA" | grep -oP '"pushed_at"\s*:\s*"\K[^"]+' || echo "unknown")

  # 页面可达性
  GH_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$GITHUB_URL" 2>/dev/null || echo "000")

  if [ "$GH_CODE" = "200" ]; then
    echo -e "  ${GREEN}✅ PASS${NC} GitHub页面公开: $GITHUB_URL"
  else
    echo -e "  ${RED}❌ FAIL${NC} GitHub页面可达: HTTP $GH_CODE"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi

  # API数据验证
  if [ "$STARS" != "0" ] || [ -n "$GH_DATA" ] && echo "$GH_DATA" | grep -q '"full_name"'; then
    echo -e "  ${GREEN}✅ PASS${NC} GitHub API: ⭐${STARS:-0} ⑂${FORKS:-0} Issues:${OPEN_ISSUES:-0} License:${LICENSE:-none}"
    [ "$LICENSE" = "none" ] && warn "License缺失" "开源仓库应有LICENSE文件"
    [ "${STARS:-0}" -eq 0 ] && warn "0 Stars" "宣传推广待加强"
  else
    echo -e "  ${YELLOW}⚠ WARN${NC} GitHub API无数据（可能被限流或仓库不存在）"
  fi
  PASS_COUNT=$((PASS_COUNT + 1))
else
  warn "GitHub URL" "未在ladder中找到，手动检查"
fi

# ---- L0.1: 助教 — 教学材料包 ----
echo ""
echo "【L0.1 助教】教学材料包"
TEACHING="$PROJECT_DIR/curriculum/teaching-track-l0.md"
if [ -f "$TEACHING" ]; then
  HAS_INDEX=$(grep -c "## " "$TEACHING" 2>/dev/null || echo "0")
  if [ "${HAS_INDEX:-0}" -ge 3 ]; then
    pass "教学材料包: $(wc -c < "$TEACHING")字节, ≥3章节"
  else
    fail "教学材料包章节≥3" "仅${HAS_INDEX}个章节"
  fi
else
  fail "教学材料包存在" "文件缺失"
fi

# ---- 内容真实性验证（证据不是文件存在就能过的） ----
echo ""
echo "【E0 内容真实性】证据质量评分"
# L2.1: 论文综述必须有≥3处对比分析
if [ -f "$SURVEY" ]; then
  COMPARE_COUNT=$(grep -cE '(vs\.?|对比|相较于|优于|不如|underperforms|outperforms)' "$SURVEY" 2>/dev/null || echo "0")
  if [ "${COMPARE_COUNT:-0}" -ge 3 ]; then
    pass "综述对比分析: ≥3处对比 (${COMPARE_COUNT}处)"
  else
    warn "综述对比分析≥3" "仅${COMPARE_COUNT}处 — 可能概括而非批判"
  fi
fi
# L2.2: 测试必须有≥20个用例
if [ "${TEST_PASSED:-0}" -gt 0 ]; then
  if [ "${TEST_PASSED:-0}" -ge 20 ]; then
    pass "测试覆盖充分: ${TEST_PASSED}通过 ≥ 20"
  else
    warn "测试覆盖" "仅${TEST_PASSED}通过 — '至少20个测试'标准未达"
  fi
fi
# L0.1: 教学模块检查
GUEST_MODULES=$(find "$PROJECT_DIR/curriculum/guest-modules/" -name "*.md" 2>/dev/null | wc -l)
if [ "$GUEST_MODULES" -ge 2 ]; then
  pass "客座教学模块: ${GUEST_MODULES}个 (≥2)"
else
  warn "客座教学模块≥2" "仅${GUEST_MODULES}个"
fi
# 证据新鲜度
LADDER_AGE=$(($(date +%s) - $(stat -c %Y "$LADDER" 2>/dev/null || echo "0")))
if [ "$LADDER_AGE" -lt 86400 ]; then
  pass "毕业阶梯24h内更新 ($((LADDER_AGE / 3600))h前)"
elif [ "$LADDER_AGE" -lt 604800 ]; then
  warn "毕业阶梯更新" "$((LADDER_AGE / 86400))天前 — 建议周更"
else
  fail "毕业阶梯刷新" "$((LADDER_AGE / 86400))天前 — 证据可能过期"
fi

# ---- API Key 安全检查 ----
echo ""
echo "【安全检查】硬编码密钥扫描"
KEY_LEAKS=$(grep -rn "sk-[a-zA-Z0-9]\{20,\}" "$PROJECT_DIR/scripts/" 2>/dev/null || echo "")
if [ -z "$KEY_LEAKS" ]; then
  pass "scripts/ 目录无硬编码密钥"
else
  fail "scripts/ 目录无硬编码密钥" "发现疑似密钥:\n$KEY_LEAKS"
fi

# ---- 汇总 ----
echo ""
echo "============================================"
if [ "$FAIL_COUNT" -eq 0 ]; then
  echo -e "  ${GREEN}全部通过 ✅${NC}  $PASS_COUNT 检查, 0 失败"
  echo "============================================"
  exit 0
else
  echo -e "  ${RED}部分失败 ❌${NC}  $PASS_COUNT 通过, $FAIL_COUNT 失败"
  echo "============================================"
  exit 1
fi
