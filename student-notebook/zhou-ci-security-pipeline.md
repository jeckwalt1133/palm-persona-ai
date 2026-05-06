# 周富贵 — CI安全扫描Pipeline设计

**日期**: 2026-05-06
**任务**: V7-W5-013 — pre-commit安全检查升级到CI Pipeline
**作者**: 周富贵 QE
**版本**: 1.0.0

---

## 设计动机

### 为什么pre-commit hook不够

pre-commit hook是本地防线，依赖开发者自觉安装。以下场景会导致hook失效：

| 失效场景 | 概率 | 后果 |
|---------|------|------|
| 新成员未安装hook | 高 | 密钥直接提交到仓库 |
| `git commit --no-verify` | 中 | 绕过所有检查 |
| hook文件被误删/未执行权限 | 低 | 静默失效 |
| WSL/Windows文件系统权限问题 | 中 | chmod无效, hook不触发 |
| CI中直接生成代码并提交 | 中 | 绕过了开发者机器 |

**核心原则: 本地hook是第一道防线(可选)，CI Pipeline是最后防线(强制)。**

### 防线模型

```
开发者本地                  CI Pipeline                生产环境
    │                           │                          │
    ├─ pre-commit hook          ├─ PR安全扫描 (本设计)      ├─ WAF/速率限制
    │  (本地, 可跳过)             │  (远程, 强制, 不可绕过)    │  (模块03)
    │                           │                          │
    ├─ pre-push 依赖审计         ├─ SARIF → Code Scanning   │
    │  (本地, 可选)              │  (GitHub原生仪表盘)        │
    │                           │                          │
    └─ 手工 git diff 检查        └─ Artifact报告(审计追溯)   │
       (依赖开发者习惯)                                       │
```

## 架构设计

### 扫描器改造: --ci-mode

`scripts/pre-commit-security.py` 新增CI模式, 与pre-commit模式共享检测引擎, 区别在于输入源和输出格式:

| 维度 | pre-commit模式 | CI模式 |
|------|---------------|--------|
| 输入源 | `git diff --cached` (暂存区) | `git diff base...HEAD` (PR全量变更) |
| 基线确定 | 当前HEAD | 可指定`--base-ref` (默认origin/main) |
| 输出格式 | 终端emoji + 文本 | 单行log + JSON + SARIF |
| 退出码 | 0=安全, 1=阻断 | 0=安全, 1=阻断 (CI可消费) |
| 白名单 | 读取`.claude/security-whitelist.json` | 同 (CI也尊重逃生门) |
| 报告持久化 | `.claude/security-report.json` | `--output-file` 指定路径 |

#### 关键实现细节

**Git三方合并范围**: 使用`base...HEAD`三点语法(非`base..HEAD`两点)，确保只扫描PR带来的新变更，不扫描base分支上的新commit。

```bash
# 三点语法: PR分支独有的变更
git diff --name-only origin/main...HEAD

# merge-base回退: 当三点语法不可用时
MERGE_BASE=$(git merge-base origin/main HEAD)
git diff --name-only $MERGE_BASE..HEAD
```

**SARIF兼容**: 输出符合SARIF 2.1.0规范，可直接导入GitHub Code Scanning。每条finding映射为:
```json
{
  "ruleId": "L1-07",
  "level": "error",
  "message": {"text": "[L1-07] JWT Secret/密钥硬编码: ..."},
  "locations": [{
    "physicalLocation": {
      "artifactLocation": {"uri": "src/config.ts"},
      "region": {"startLine": 42}
    }
  }]
}
```

### CI Workflow设计

#### 触发策略

```yaml
on:
  pull_request:           # PR触发 (主流程)
    branches: [main]
    types: [opened, synchronize, reopened]
  push:
    branches: [main]      # main分支push也扫描
    paths-ignore:         # 排除纯文档变更
      - '**.md'
      - 'memory/**'
      - 'student-notebook/**'
```

**设计决策**:
- PR触发: 每次push到PR分支都重新扫描 (synchronize)
- main push: 也触发扫描(防止直接push到main绕过PR)
- paths-ignore: 排除纯文档/记忆文件, 减少无效CI运行
- concurrency: 同一PR的新push取消旧扫描, 节省CI资源

#### 流水线步骤

```
Step 1: Checkout (fetch-depth: 0)
  └─ 获取完整Git历史, 确保 git diff base...HEAD 可用

Step 2: Setup Python 3.12

Step 3: 安全扫描 (--ci-mode --json --output-file)
  └─ 退出码可能为1, 设置 continue-on-error: true
  └─ 生成 security-report.json

Step 4: 上传Artifact (always)
  └─ security-report.json 保留30天
  └─ 用于审计追溯 + 趋势分析

Step 5: 生成SARIF + 上传GitHub Code Scanning (always)
  └─ security-results.sarif
  └─ Code Scanning仪表盘可查看历史趋势

Step 6: L1阻断判定 (always)
  └─ 解析report中的 blocked 字段
  └─ blocked=true → exit 1 (CI失败, PR不可合并)
  └─ blocked=false → pass

Step 7: 扫描摘要 (always)
  └─ 打印文件数/L1/L2/L3统计
```

### 退出码语义

| 退出码 | 含义 | CI行为 | 说明 |
|--------|------|--------|------|
| 0 | 安全: 无L1发现 | Pass | PR可合并 |
| 1 | 阻断: 发现L1严重威胁 | Fail | PR被阻止, 需修复 |
| >1 | 扫描器异常 | Fail | 配置错误, 需修复CI |

## Gitee CI兼容方案

GitHub Actions和Gitee Go的差异:

| 差异点 | GitHub Actions | Gitee Go |
|--------|---------------|----------|
| 配置文件 | `.github/workflows/*.yml` | `.gitee/workflows/*.yml` |
| checkout | `actions/checkout@v4` | `gitee-checkout@v1` |
| artifact | `actions/upload-artifact@v4` | 不支持, 改用文件持久化或curl上传 |
| SARIF | `github/codeql-action/upload-sarif@v3` | 不支持, 跳过或替换为注释 |

**适配策略**: 复用同一扫描器(`--ci-mode`)，仅替换workflow文件的平台特定部分。核心扫描逻辑零改动。

```yaml
# .gitee/workflows/security-scan.yml (示例)
name: 安全扫描
on:
  pull_request:
    branches: [main]
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: gitee-checkout@v1
      - run: |
          python3 scripts/pre-commit-security.py \
            --ci-mode --base-ref "origin/${{ gitee.event.pull_request.base.ref }}" \
            --output-file security-report.json --json
      - run: |
          BLOCKED=$(python3 -c "import json; print(json.load(open('security-report.json'))['summary']['blocked'])")
          [ "$BLOCKED" = "True" ] && exit 1 || exit 0
```

## 与L3记录层集成

CI扫描结果可对接`memory/security/commit-log.jsonl`趋势系统:

```
CI security-report.json
  │
  ├─ Artifact保存(30天) → 审计追溯
  │
  ├─ SARIF上传 → GitHub Code Scanning仪表盘
  │
  └─ (未来) 写入L3 JSONL → security-trend.sh 趋势分析
       └─ CI扫描指标: PR通过率/高频规则/修复耗时
```

## 验收标准

- [x] `--ci-mode` 扫描PR变更(非staged)，支持 `--base-ref` 指定基线
- [x] `--sarif` 输出SARIF 2.1.0兼容格式
- [x] `--output-file` 将报告写入指定文件
- [x] GitHub Actions workflow: PR触发→扫描→上传artifact→SARIF→阻断判定
- [x] CI失败时security-report.json可作为artifact下载
- [x] 50条自测用例零回归
- [x] 设计文档本文件

### 验证证据

```bash
# CI JSON模式
$ python3 scripts/pre-commit-security.py --ci-mode --base-ref HEAD~10 --json
{"mode": "ci", "summary": {"filesScanned": 44, "blocked": false}, ...}

# CI SARIF模式
$ python3 scripts/pre-commit-security.py --ci-mode --base-ref HEAD~10 --sarif
{"$schema": "...sarif-2.1.0.json", "version": "2.1.0", "runs": [...]}

# 测试套件
$ python3 scripts/pre-commit-security.py --test
结果: 50/50 通过, 0 失败
```

## 后续演进

1. **全仓库扫描模式** (`--full-scan`): 不限于PR变更，扫描仓库所有代码文件，用于定期安全审计
2. **CI指标接入L3**: CI扫描数据写入commit-log.jsonl，`security-trend.sh` 增加CI维度
3. **自动修复建议**: L2发现自动在PR评论中生成修复建议 (GitHub Actions `marocchino/sticky-pull-request-comment`)
4. **Slack/飞书通知**: L1阻断时自动通知安全负责人
5. **按规则门禁**: 允许特定规则降级为warning (不阻断CI)，类似L2逻辑在CI层的复现

---

*设计: 周富贵 QE | AI师生研究院 V7 | 2026-05-06*
*前序依赖: V7-W5-003 (L1+L3安全实现) + V7-W3-012 (pre-commit V2)*
