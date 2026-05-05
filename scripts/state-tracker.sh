#!/bin/bash
# PostToolUse 状态追踪 — 每次工具调用后更新会话检查点
# 要求: <200ms，不阻塞用户交互
set -euo pipefail
STATUS_FILE="/mnt/d/Claude/Workspace/palm-persona-ai/memory/team-status.json"
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)

[ -f "$STATUS_FILE" ] && python3 -c "
import json
with open('$STATUS_FILE') as f: d=json.load(f)
d.setdefault('session',{})['lastCheckpoint']='$NOW'
with open('$STATUS_FILE','w') as f: json.dump(d,f,indent=2,ensure_ascii=False)
"