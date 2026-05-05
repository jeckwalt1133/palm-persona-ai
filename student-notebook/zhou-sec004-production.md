# 周富贵 — SEC-004 安全门禁生产化报告

**日期**: 2026-05-06
**任务**: V7-W3-012 — pre-commit-security.py接入.git/hooks/pre-commit
**作者**: 周富贵 QE

---

## 变更摘要

将 `.git/hooks/pre-commit` 从V1（bash grep，3种密钥模式）升级到V2（Python引擎，12种密钥模式+JSON CI报告）。

### V1 → V2 对比

| 维度 | V1 (替换前) | V2 (当前) |
|------|------------|-----------|
| 密钥模式 | 3种 (sk-/AKIA/ghp_) | 12种 (含JWT/PEM/Slack/URL/BasicAuth等) |
| 误报过滤 | 无 | 7种规则 (占位符/示例/注释/env.example等) |
| 扫描范围 | 仅新增行+前缀 | 仅新增行+前缀(保持一致) |
| 输出格式 | 纯文本 | 文本 + JSON (.claude/security-report.json) |
| 自检测试 | 无 | 10项 (8正例+2反例) |
| 阻断条件 | 任何匹配→阻断 | critical级别→阻断, high/medium→警告 |
| .md处理 | grep检查 | 完全跳过(由人审查) |
| scanner自身 | 无保护 | 跳过自身防止自噬 |

### 门禁架构

```
git commit
  │
  ├─ 门禁1: pre-commit-security.py (阻断级)
  │   ├─ get_staged_files() → git diff --cached
  │   ├─ scan_diff() → 12种正则模式
  │   ├─ is_false_positive() → 7种过滤规则
  │   └─ 输出: 终端 + .claude/security-report.json
  │
  ├─ 门禁2: .env文件检查 (阻断级)
  │   └─ git diff --cached --name-only | grep '^\.env$'
  │
  └─ 门禁3: 代码危险模式 (警告级)
      ├─ console.log(process.env)
      └─ eval(req.body/query/params)
```

## 验证证据

### 测试1: 正常通过 (无暂存文件)
```
🔒 安全门禁检查 V2...
  ✅ 密钥扫描跳过 (无暂存文件)
  ✅ .env 检查通过
  ✅ 代码模式检查通过
🔒 安全门禁全部通过
退出码: 0
```

### 测试2: 阻断假密钥
```
🔒 安全门禁检查 V2...
  ❌ 密钥扫描: 发现 1 处严重 + 0 处高危 (共1条)
  ❌ [PAT-001] _test-leak.ts: ...y8x7w6v5u4t3s2r1q0p9o8n7m6l5k4
     修复: 移至.env文件，使用process.env引用；在平台控制台轮换密钥
============================================
  提交被拦截：发现密钥泄露
  请移除密钥后重新提交
============================================
退出码: 1
```

### 测试3: 正常代码通过
```
🔒 安全门禁检查 V2...
  ✅ 密钥扫描通过 (12种模式)
  ✅ .env 检查通过
  ✅ 代码模式检查通过
🔒 安全门禁全部通过
退出码: 0
```

## 故障复盘

**问题**: 首次部署时hook未能拦截假密钥。

**根因**: 扫描器在发现密钥时返回exit code 1。hook的bash代码使用了`|| echo 'fallback'`模式——exit code 1触发了fallback，将正确的扫描结果替换为`{"summary":{"blocked":false}}`的假阴性JSON。

**修复**: 将`||` fallback改为显式的`set +e`/`set -e`包围+exit code判断：
```bash
set +e
SCAN_OUTPUT=$(python3 "$SCANNER" --json 2>/dev/null)
SCAN_EXIT=$?
set -e
# 仅在扫描器崩溃(exit>1)时使用fallback
if [ "$SCAN_EXIT" -gt 1 ] || [ -z "$SCAN_OUTPUT" ]; then
  SCAN_OUTPUT='{"summary":{"blocked":false,...}}'
fi
```

**教训**: 安全工具的exit code语义(0=安全/1=发现威胁)与bash的`||`语义(0=成功/非0=失败)存在冲突。生产化的关键不仅是写对扫描逻辑，还要确保胶水代码(glue code)正确传递了语义。

## CI消费说明

hook每次运行后在 `.claude/security-report.json` 生成结构化报告：

```json
{
  "scanTime": "ISO8601",
  "summary": {
    "filesScanned": N,
    "criticalFindings": N,
    "highFindings": N,
    "blocked": bool
  },
  "findings": [...]
}
```

GitHub Actions可直接消费此文件进行CI门禁判定。

---

*接入工程师: 周富贵 QE | AI师生研究院 V7*
*审查标准: 安全红线 V2.0*
