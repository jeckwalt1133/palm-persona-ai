#!/bin/bash
# pre-commit 安全扫描 — ≥8种密钥模式 + 暂存区扫描 + JSON报告
# 用法: bash scripts/pre-commit-security.sh [--json] [--test]
# 退出码: 0=通过 1=发现严重密钥

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec python3 "$SCRIPT_DIR/pre-commit-security.py" "$@"
