#!/usr/bin/env bash
# 启动公网隧道（localhost.run 免费隧道）
# 用法: bash scripts/tunnel.sh [start|stop|status]
#
# 隧道地址会写入 /tmp/palm-tunnel-url.txt
# 每次启动 URL 会变化（免费版限制）

set -e

PID_FILE="/tmp/palm-tunnel.pid"
URL_FILE="/tmp/palm-tunnel-url.txt"
ACTION="${1:-start}"
LOCAL_PORT="${2:-3001}"

case "$ACTION" in
  start)
    if [ -f "$PID_FILE" ] && kill -0 $(cat "$PID_FILE") 2>/dev/null; then
      echo "隧道已在运行 (PID: $(cat "$PID_FILE"))"
      cat "$URL_FILE" 2>/dev/null
      exit 0
    fi
    echo "启动公网隧道 → localhost:$LOCAL_PORT"
    ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 \
        -R 80:localhost:$LOCAL_PORT nokey@localhost.run \
        > "$URL_FILE" 2>&1 &
    PID=$!
    echo $PID > "$PID_FILE"
    sleep 3
    if kill -0 $PID 2>/dev/null; then
      URL=$(grep -oP 'https://[a-z0-9]+\.lhr\.life' "$URL_FILE" 2>/dev/null | head -1)
      echo "✅ 隧道就绪: $URL"
      echo "PID: $PID"
    else
      echo "❌ 隧道启动失败"
      rm -f "$PID_FILE"
      exit 1
    fi
    ;;
  stop)
    if [ -f "$PID_FILE" ]; then
      kill $(cat "$PID_FILE") 2>/dev/null || true
      rm -f "$PID_FILE" "$URL_FILE"
      echo "隧道已停止"
    else
      echo "隧道未运行"
    fi
    ;;
  status)
    if [ -f "$PID_FILE" ] && kill -0 $(cat "$PID_FILE") 2>/dev/null; then
      echo "隧道运行中 (PID: $(cat "$PID_FILE"))"
      cat "$URL_FILE" 2>/dev/null
    else
      echo "隧道未运行"
    fi
    ;;
  *)
    echo "用法: bash scripts/tunnel.sh [start|stop|status]"
    ;;
esac
