#!/usr/bin/env bash
# ============================================================
# content-metrics.sh — 掌心人格局 内容营销数据回收脚本
# 孙富贵 P5 增长运营 | V7-W6-006 | 2026-05-07
#
# 用途：定义内容营销核心指标，从日志/埋点数据中回收关键数据
# 使用：bash scripts/content-metrics.sh [date|week|month]
# ============================================================

set -euo pipefail

# ---- 配置 ----
LOG_DIR="${LOG_DIR:-./logs}"
OUTPUT_DIR="${OUTPUT_DIR:-./reports/metrics}"
DATA_FILE="${OUTPUT_DIR}/content-metrics-$(date +%Y-%m-%d).jsonl"

# ---- 核心指标定义 ----
# 三级指标框架：曝光→互动→转化

declare -A METRIC_DEFS
METRIC_DEFS=(
  # L1 曝光层
  ["article_impressions"]="文章曝光量:公众号文章或推送的展示次数"
  ["article_reads"]="文章阅读量:实际打开并阅读文章的人数"
  ["push_sends"]="推送发送量:小程序订阅消息的发送总数"
  ["push_reach"]="推送到达量:实际触达用户设备的数量"

  # L2 互动层
  ["push_ctr"]="推送点击率:推送点击量/推送到达量 (%)"
  ["article_read_rate"]="文章阅读率:阅读量/曝光量 (%)"
  ["article_share_count"]="文章分享次数:用户分享文章或海报的次数"
  ["article_share_rate"]="文章分享率:分享次数/阅读量 (%)"
  ["avg_read_duration"]="平均阅读时长:用户阅读文章的平均秒数"
  ["comment_count"]="评论/反馈数:用户在文章下的留言或小程序内反馈"

  # L3 转化层
  ["mini_program_opens"]="小程序打开次数:从内容跳转到小程序的次数"
  ["conversion_rate"]="内容转化率:小程序打开次数/阅读量 (%)"
  ["new_user_from_content"]="内容新用户数:通过内容渠道首次打开小程序的用户数"
  ["match_creates_from_content"]="内容驱动匹配数:从内容入口进入后创建匹配的次数"
  ["report_completions_from_content"]="内容驱动报告完成数:从内容入口进入后完成报告分析次数"

  # L4 留存层
  ["d1_retention_from_content"]="次日留存(内容渠道):内容渠道新用户的次日回访率 (%)"
  ["d7_retention_from_content"]="7日留存(内容渠道):内容渠道新用户的7日回访率 (%)"
  ["content_channel_dau_share"]="内容渠道DAU占比:通过内容入口进入的DAU/总DAU (%)"
)

# ---- 核心指标计算函数 ----

calc_push_ctr() {
  # 推送点击率 = 推送点击量 / 推送到达量
  local clicks="${1:-0}"
  local reach="${2:-1}"
  echo "scale=2; $clicks * 100 / $reach" | bc
}

calc_conversion_rate() {
  # 内容转化率 = 小程序打开 / 文章阅读量
  local opens="${1:-0}"
  local reads="${2:-1}"
  echo "scale=2; $opens * 100 / $reads" | bc
}

calc_share_rate() {
  # 分享率 = 分享次数 / 阅读量
  local shares="${1:-0}"
  local reads="${2:-1}"
  echo "scale=2; $shares * 100 / $reads" | bc
}

calc_k_factor() {
  # K因子 = 邀请成功的新用户数 / 发起邀请的用户数
  local invited="${1:-0}"
  local inviters="${2:-1}"
  echo "scale=2; $invited / $inviters" | bc
}

# ---- 数据回收主函数 ----

collect_daily_metrics() {
  local target_date="${1:-$(date +%Y-%m-%d)}"

  mkdir -p "$OUTPUT_DIR"

  echo "=========================================="
  echo "  掌心人格局 内容数据回收"
  echo "  日期: $target_date"
  echo "  时间: $(date '+%Y-%m-%d %H:%M:%S')"
  echo "=========================================="

  # 初始化数据容器
  local push_clicks=0 push_reach=0 article_reads=0 article_shares=0
  local mp_opens=0 new_users=0 match_creates=0 report_done=0
  local article_impressions=0 push_sends=0

  # ---- 从日志文件提取数据 (模拟/示例) ----
  if [[ -f "$LOG_DIR/push.log" ]]; then
    push_sends=$(grep -c "push.sent" "$LOG_DIR/push.log" 2>/dev/null || echo 0)
    push_clicks=$(grep -c "push.click" "$LOG_DIR/push.log" 2>/dev/null || echo 0)
    push_reach=$(grep -c "push.delivered" "$LOG_DIR/push.log" 2>/dev/null || echo 0)
  fi

  if [[ -f "$LOG_DIR/miniprogram.log" ]]; then
    mp_opens=$(grep -c "mp.open.from_content" "$LOG_DIR/miniprogram.log" 2>/dev/null || echo 0)
    new_users=$(grep -c "mp.new_user.from_content" "$LOG_DIR/miniprogram.log" 2>/dev/null || echo 0)
    match_creates=$(grep -c "match.create.from_content" "$LOG_DIR/miniprogram.log" 2>/dev/null || echo 0)
    report_done=$(grep -c "report.complete.from_content" "$LOG_DIR/miniprogram.log" 2>/dev/null || echo 0)
  fi

  if [[ -f "$LOG_DIR/article.log" ]]; then
    article_impressions=$(grep -c "article.impression" "$LOG_DIR/article.log" 2>/dev/null || echo 0)
    article_reads=$(grep -c "article.read" "$LOG_DIR/article.log" 2>/dev/null || echo 0)
    article_shares=$(grep -c "article.share" "$LOG_DIR/article.log" 2>/dev/null || echo 0)
  fi

  # ---- 计算派生指标 ----
  local push_ctr_val=$(calc_push_ctr "$push_clicks" "$push_reach")
  local conversion_val=$(calc_conversion_rate "$mp_opens" "$article_reads")
  local share_rate_val=$(calc_share_rate "$article_shares" "$article_reads")
  local read_rate_val=$(calc_conversion_rate "$article_reads" "$article_impressions")

  # ---- 输出到JSONL ----
  cat >> "$DATA_FILE" << JSONL
{
  "date": "$target_date",
  "collected_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "metrics": {
    "L1_exposure": {
      "article_impressions": $article_impressions,
      "article_reads": $article_reads,
      "article_read_rate": $read_rate_val,
      "push_sends": $push_sends,
      "push_reach": $push_reach
    },
    "L2_engagement": {
      "push_ctr": $push_ctr_val,
      "article_share_count": $article_shares,
      "article_share_rate": $share_rate_val
    },
    "L3_conversion": {
      "mini_program_opens": $mp_opens,
      "conversion_rate": $conversion_val,
      "new_user_from_content": $new_users,
      "match_creates_from_content": $match_creates,
      "report_completions_from_content": $report_done
    }
  }
}
JSONL

  # ---- 终端输出摘要 ----
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  📊 今日内容数据摘要"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  printf "  %-20s %8s\n" "指标" "数值"
  echo "  ─────────────────────────────"
  printf "  %-20s %8s\n" "文章曝光量" "$article_impressions"
  printf "  %-20s %8s\n" "文章阅读量" "$article_reads"
  printf "  %-20s %7.1f%%\n" "文章阅读率" "$read_rate_val"
  printf "  %-20s %8s\n" "分享次数" "$article_shares"
  printf "  %-20s %7.1f%%\n" "分享率" "$share_rate_val"
  printf "  %-20s %8s\n" "推送发送量" "$push_sends"
  printf "  %-20s %7.1f%%\n" "推送点击率" "$push_ctr_val"
  printf "  %-20s %8s\n" "小程序打开量" "$mp_opens"
  printf "  %-20s %7.1f%%\n" "转化率" "$conversion_val"
  printf "  %-20s %8s\n" "内容新用户" "$new_users"
  printf "  %-20s %8s\n" "匹配创建数" "$match_creates"
  printf "  %-20s %8s\n" "报告完成数" "$report_done"
  echo ""
  echo "  数据文件: $DATA_FILE"
  echo ""
}

collect_weekly_metrics() {
  local end_date="${1:-$(date +%Y-%m-%d)}"
  local start_date=$(date -d "$end_date -7 days" +%Y-%m-%d 2>/dev/null || date -v-7d +%Y-%m-%d)

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  📊 周度内容数据汇总"
  echo "  周期: $start_date → $end_date"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  if [[ ! -f "$DATA_FILE" ]]; then
    echo "  ⚠ 未找到数据文件 $DATA_FILE，请先运行每日回收"
    return 1
  fi

  # 统计本周总数据 (简化版，实际应用使用jq聚合)
  local total_reads=$(grep "$start_date\|$end_date" "$DATA_FILE" 2>/dev/null | wc -l || echo 0)

  echo "  本周数据条目: $total_reads"
  echo "  提示: 使用 'jq' 聚合JSONL以获得完整周报"
  echo ""
  echo "  jq示例:"
  echo "  cat $DATA_FILE | jq -s 'group_by(.date) | map({date: .[0].date, reads: sum(.[].metrics.L1_exposure.article_reads)})'"
}

collect_monthly_metrics() {
  local end_date="${1:-$(date +%Y-%m-%d)}"
  local start_date=$(date -d "$end_date -30 days" +%Y-%m-%d 2>/dev/null || date -v-30d +%Y-%m-%d)

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  📊 月度内容数据汇总"
  echo "  周期: $start_date → $end_date"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  echo ""
  echo "  ┌─────────────────────────────────────┐"
  echo "  │ 月度内容营销核心KPI                 │"
  echo "  ├─────────────────────────────────────┤"
  echo "  │ 1. 日均DAU (内容渠道)    ≥ 150     │"
  echo "  │ 2. 内容转化率            ≥ 18%     │"
  echo "  │ 3. 文章平均分享率        ≥ 25%     │"
  echo "  │ 4. K因子                 ≥ 1.45    │"
  echo "  │ 5. 7日留存 (内容渠道)    ≥ 38%     │"
  echo "  │ 6. 月活MAU               ≥ 500     │"
  echo "  │ 7. 公众号粉丝月增长      ≥ 310     │"
  echo "  │ 8. 文章平均CTR (推送)    ≥ 12%     │"
  echo "  └─────────────────────────────────────┘"
  echo ""

  if [[ -f "$DATA_FILE" ]]; then
    echo "  月度数据条目: $(wc -l < "$DATA_FILE")"
    echo "  数据文件: $DATA_FILE"
  else
    echo "  ⚠ 暂无数据文件。首次运行 daily 模式开始收集。"
  fi
}

# ---- 指标定义查看 ----

show_definitions() {
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  📋 内容营销核心指标定义"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  for key in "${!METRIC_DEFS[@]}"; do
    printf "  %-35s %s\n" "$key" "${METRIC_DEFS[$key]}"
  done
  echo ""
}

# ---- 初始化数据目录 ----

init_metrics_dir() {
  mkdir -p "$OUTPUT_DIR"
  mkdir -p "$LOG_DIR"

  if [[ ! -f "$DATA_FILE" ]]; then
    echo '{"init":true,"created_at":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}' > "$DATA_FILE"
    echo "  ✅ 数据文件已创建: $DATA_FILE"
  else
    echo "  ℹ 数据文件已存在: $DATA_FILE"
  fi
}

# ---- 主入口 ----

main() {
  local mode="${1:-daily}"

  case "$mode" in
    init)
      init_metrics_dir
      ;;
    daily|day|d)
      collect_daily_metrics "${2:-}"
      ;;
    weekly|week|w)
      collect_weekly_metrics "${2:-}"
      ;;
    monthly|month|m)
      collect_monthly_metrics "${2:-}"
      ;;
    defs|definitions)
      show_definitions
      ;;
    *)
      echo "用法: $0 {init|daily|weekly|monthly|defs} [date]"
      echo ""
      echo "  init     — 初始化数据目录和文件"
      echo "  daily    — 收集当日内容数据"
      echo "  weekly   — 汇总近7日数据"
      echo "  monthly  — 汇总近30日数据"
      echo "  defs     — 显示所有指标定义"
      echo ""
      echo "示例:"
      echo "  $0 daily                    # 收集今天数据"
      echo "  $0 daily 2026-06-01         # 收集指定日期"
      echo "  $0 weekly                   # 本周汇总"
      echo "  $0 monthly                  # 本月汇总"
      exit 1
      ;;
  esac
}

main "$@"
