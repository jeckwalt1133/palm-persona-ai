# V7-W5-003: 安全三层防线L1+L3实现 — 从架构到代码

**分配给**: 周富贵 (QE, 千问 Qwen3-Max)
**优先级**: P0
**前序依赖**: V7-W4-009 (三层防线架构) + V7-W3-012 (pre-commit V2)
**预计产出等级**: L3 实现段

## 背景

Week 4完成了三层安全防线架构设计(L1阻断/L2警告/L3记录)，pre-commit V2已有12种密钥检测模式。现在把架构变成代码——L1的6条规则全部生产化，L3建立日志聚合。

## 任务目标

### Phase 1: L1阻断层强化 (Day 1)

当前pre-commit V2已有6条规则。需要:
1. 逐一审查6条规则，确认每条满足"误报率<1%"标准
2. 新增4条规则(目标L1总数≤10):
   - L1-07: 硬编码JWT secret (检测 `jwtSecret: '...'` 或 `JWT_SECRET=h'...'`)
   - L1-08: 硬编码数据库密码 (检测 `password: '...'` 在DB连接字符串中)
   - L1-09: 内网IP/域名硬编码 (检测 `10.x.x.x` / `192.168.x.x` / `.internal` 域名)
   - L1-10: CI/CD token泄露 (检测 `CI_JOB_TOKEN=` / `GITHUB_TOKEN=` / `NPM_TOKEN=`)
3. 每条新规则附带10+自测用例(包括边界: false positive/false negative)
4. 逃生门机制: 实现临时白名单(≤24h自动过期) + 仓库管理员审批流程

### Phase 2: L3记录层建设 (Day 1-2)

5. 建立 `scripts/pre-commit-l3-logger.sh`:
   - 每次commit自动记录: 时间戳/作者/文件数/行数/扫描耗时/匹配规则
   - 输出JSONL格式到 `memory/security/commit-log.jsonl`
6. 建立 `scripts/security-trend.sh`:
   - 解析 commit-log.jsonl → 输出7天/30天趋势报告
   - 指标: 日均commit数、平均扫描耗时、高频规则TOP5、误报趋势
7. L3→L2升级机制: 如果某L3规则连续30天0误报，自动建议升级到L2

### Phase 3: 综合验证 (Day 2)

8. 模拟攻击测试: 故意提交含有各类敏感信息的代码，验证L1全部拦截
9. 误报测试: 提交正常代码，验证L1不会误拦
10. 性能测试: 100文件commit的扫描耗时不超过3秒

## 验收标准
- [ ] L1规则总数=10条，每条≥10自测用例，全部通过
- [ ] 逃生门机制可用(白名单+审批+自动过期)
- [ ] L3日志正常运行，security-trend.sh 输出正确趋势报告
- [ ] 模拟攻击测试: 10/10 L1规则成功拦截
- [ ] 误报测试: 正常代码100%通过
- [ ] 性能: 100文件扫描<3秒

## 输出
- scripts/pre-commit-security.py (升级到V3)
- scripts/pre-commit-l3-logger.sh
- scripts/security-trend.sh
- student-notebook/zhou-security-l1-implementation.md (实施报告)
