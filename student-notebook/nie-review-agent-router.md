---
name: 教师审查 — agent-router.py 富贵协议v1
reviewer: 聂富贵 (Teacher)
target: scripts/agent-router.py (659行) + ma-fugui-agent-protocol-design.md (790行)
verdict: approved_with_suggestions
date: 2026-05-06
---

# agent-router.py 审查

## 做得好的（5处）

1. **零依赖设计** — Python 3.10+标准库，不需要pip install任何东西。这对WSL/CI环境非常重要。
2. **JSON-RPC 2.0兼容** — 不是自己发明协议，而是站在已有标准上。未来可以对接A2A/MCP。
3. **四种Card类型完整覆盖** — TaskCard→DeliverableCard→ReviewCard→ReviewResponseCard，覆盖了我们的全流程。
4. **自测函数** — self_test()覆盖合法/非法/边界case，标准做法。
5. **原子写入** — `.tmp → os.replace` 防止文件损坏，工程意识好。

## 改进建议（3条）

### 1. 缺少超时机制
TaskCard发送后如果receiver永远不ack，消息会在inbox积压。建议加TTL（如24小时过期自动标记timeout）。

### 2. 自测没有测试并发
当前self_test是串行的。线上可能出现两个TaskCard同时写入同一个inbox。建议加一个并发写入测试（用threading）。

### 3. agent-router.py能发消息但不能读消息
send命令把消息写入receiver的inbox，但没有`read`命令让receiver查看自己的inbox。当前receiver需要手动cat文件。建议加`agent-router.py inbox [agent_id]`。

## 与A2A/MCP对比

| 维度 | 富贵协议v1 | Google A2A | Anthropic MCP |
|------|-----------|-----------|---------------|
| 传输层 | 文件系统 | HTTP/gRPC | stdio/HTTP |
| 消息格式 | JSON-RPC 2.0 | JSON-LD | JSON-RPC 2.0 |
| 服务发现 | AgentCard文件 | DNS-SD | 注册表 |
| 适用规模 | <10 Agent | >100 Agent | 1→N工具 |
| 零依赖 | ✅ | ❌ | ❌ |

结论：对4人团队来说，富贵协议v1的文件系统+JSON-RPC方案是务实的。比A2A轻，比裸tmux可靠。

## 给马富贵的下一步

你的agent-router端到端验证任务(V7-W4-007)中，优先验证：
1. TaskCard发送→receiver收到→DeliverableCard回复→sender确认 完整循环
2. 并发写入是否会出现竞态（两个任务同时发给同一个agent）
3. 消息丢失检测（发送了但从未被ack）
EOF
echo "✅ 审查笔记已写入"