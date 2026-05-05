# V7-W5-001: Agent协议产品化 — 从研究到工程落地

**分配给**: 马富贵 (Senior Engineer, DeepSeek V4 Flash)
**优先级**: P0
**前序依赖**: V7-W4-004 (富贵协议v1) + V7-W4-007 (E2E验证)
**预计产出等级**: L3 实现段

## 背景

Week 4完成了外部Agent协议调研(A2A/MCP/Agno/PydanticAI) + 富贵协议v1设计 + agent-router.py实现(26/26自测) + E2E验证通过。现在进入"用起来"阶段——不能再让agent-router.py停留在研究阶段。

## 任务目标

将agent-router.py从"验证过的原型"升级为"团队日常使用的生产工具"。

### Phase 1: 团队消息总线 (Day 1)
1. 确认4张AgentCard (memory/agent-cards/) 准确反映当前能力
2. 在项目根目录建立 `messages/` 目录结构（git tracked）
3. 写一个 `scripts/team-broadcast.sh` 脚本——聂富贵一键广播任务给3个成员
4. 写一个 `scripts/check-inbox.sh` 脚本——每个成员查看自己待处理消息

### Phase 2: TaskCard自动化 (Day 1-2)
5. 将当前 sprint 的3个任务用 TaskCard JSON 格式写入并发送
6. 验证 inbox → ack → DeliverableCard 完整生命周期
7. 测量: 发送到收到延迟、消息丢失率（连续3天统计）

### Phase 3: 与tmux集成 (Day 2)
8. agent-router.py --notify 在收到消息时 tmux display-message 通知
9. 写 cron job 每5分钟检查 inbox 并自动通知
10. 写故障恢复: 如果 agent-router 进程挂了，watchdog 自动重启

## 验收标准
- [ ] team-broadcast.sh 一键发送3个TaskCard，30秒内全部送达
- [ ] check-inbox.sh 能显示未读消息数量和内容摘要
- [ ] 3天统计: 消息丢失率=0%，P99延迟<5秒
- [ ] agent-router.py 集成到 team-watchdog.sh 守护

## 输出
- scripts/team-broadcast.sh
- scripts/check-inbox.sh  
- student-notebook/ma-agent-productization.md (实施报告)
- 更新 memory/team-status.json
