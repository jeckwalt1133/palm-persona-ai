#!/bin/bash
# 同音字字典扩展 — 扫描合规红线→生成同音/形近/拆分变体→验证门禁覆盖
# 用法: bash scripts/homophone-dict-expand.sh
# 输出: memory/homophone-dict.json (50+变体)

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec python3 "$SCRIPT_DIR/homophone-dict-expand.py" "$@"
