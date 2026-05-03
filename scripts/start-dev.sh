#!/bin/bash
# 启动开发环境：API 服务 + HTTPS 代理
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== 启动掌心人格局开发环境 ==="

# 1. 构建 server
echo "[1/3] 编译 server..."
cd "$PROJECT_DIR/server"
npx tsc

# 2. 启动 API 服务（后台）
echo "[2/3] 启动 API 服务 (port 3001)..."
kill $(lsof -t -i:3001) 2>/dev/null || true
DEEPSEEK_API_KEY=sk-29abfa7967ea4d5c97408a3f79c12d64 \
AI_PROVIDER=deepseek \
AI_MODEL=deepseek-v4-pro \
node dist/index.js &
sleep 3

# 3. 验证
echo "[3/3] 验证..."
curl -s http://localhost:3001/api/health && echo ""
echo "=== 就绪 ==="
echo "API: http://localhost:3001"
echo ""
echo "微信开发者工具导入: apps/miniapp/dist"
echo "确保勾选: 详情 → 本地设置 → 不校验合法域名"
