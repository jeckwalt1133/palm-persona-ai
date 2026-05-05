#!/bin/bash
# 记忆检索 — 搜索知识图谱+决策+能力清单
# 用法: bash scripts/memory-search.sh <关键词> [--domain <领域>] [--since <日期>]
# 示例: bash scripts/memory-search.sh 安全 --domain security
#       bash scripts/memory-search.sh 记忆 --since 2026-05-01

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
python3 "$SCRIPT_DIR/memory-search.py" "$@"
