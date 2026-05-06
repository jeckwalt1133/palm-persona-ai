# 周富贵 — CI安全Pipeline实施报告

**日期**: 2026-05-06
**任务**: V7-W5-019 — CI安全workflow三层防线实现
**作者**: 周富贵 QE

---

## 变更摘要

将 `.github/workflows/security-scan.yml` 从基础单步扫描升级为完整三层防线流水线，每层独立步骤 + 显式退出码 + PR评论 + SARIF集成。

### 产出

| 文件 | 行数 | 变更 |
|------|------|------|
| `.github/workflows/security-scan.yml` | 102→268行 | 单步→14步三层流水线 |
| `student-notebook/zhou-ci-implementation.md` | 本文件 | 实施报告 |

---

## 流水线架构 (14步)

```
Step 1-2: 准备
  ├─ checkout@v4 (fetch-depth:0 完整历史)
  ├─ setup-python@v5 (3.12)
  └─ cache@v4 (pip缓存)

Step 3: 扫描 (continue-on-error:true)
  └─ --ci-mode --json --output-file

Step 4: Artifact (if:always)
  └─ upload-artifact@v4 → 30天保留

Step 5: L1阻断层 (if:always)
  ├─ GitHub ::error annotations (PR内联标注)
  └─ blocked=true → exit 1 (CI Fail)

Step 6: L2警告层 (if:always)
  ├─ GitHub ::warning annotations (PR内联标注)
  └─ 始终 exit 0 (不阻断)

Step 7: L3记录层 (if:always)
  ├─ 规则分布统计 (Counter)
  └─ 始终 exit 0 (仅记录)

Step 8-9: SARIF
  ├─ --sarif 生成
  └─ upload-sarif@v3 → GitHub Code Scanning

Step 10: PR评论 (if:PR)
  ├─ 自动表格: L1/L2/L3状态
  ├─ L1发现详情 (文件/行号/匹配/修复建议)
  └─ 更新已有评论 (避免重复)

Step 11: 最终摘要 (if:always)
  └─ 格式化终端输出
```

## 关键设计决策

### 决策1: Artifact在L1检查之前上传

```
Step 4: 上传Artifact (always)
Step 5: L1检查 (可能exit 1)
```

**原因**: CI失败时artifact已经上传，开发者可以下载报告查看详情。如果先检查再上传，exit 1后artifact步骤不会执行。

### 决策2: GitHub Workflow Annotations

L1发现使用 `::error file=path,line=N::message` 格式，GitHub自动在PR的Files Changed标签页对应行显示红色标注。L2使用 `::warning` 黄色标注。

```bash
::error file=src/config.ts,line=42::[L1-07] JWT Secret/密钥硬编码: jwtSecret = '...'
::warning file=src/app.ts,line=15::[PAT-006] Slack Bot Token: xoxb-...
```

### 决策3: PR评论更新而非追加

使用 `actions/github-script@v7` 查找已有Bot评论并更新，避免每次push都追加新评论刷屏。

### 决策4: 三层独立步骤

L1/L2/L3各用一个 `- name:` 步骤，而非合并为一个。好处：
- CI日志中一眼看到哪层通过/失败
- GitHub Actions UI中每层独立显示耗时
- 未来可独立调整各层的 `if` 条件

### 决策5: 并发控制 + 超时保护

```yaml
concurrency:
  group: security-scan-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true
timeout-minutes: 5
```

同一PR连续push时自动取消旧扫描。5分钟超时防止git操作卡死。

---

## 验证证据

### 本地CI模拟 (全部9步)

```
[Step 3] 安全扫描 --ci-mode    → 退出码0, 54文件扫描 ✅
[Step 4] Artifact生成           → security-report.json (18307 bytes) ✅
[Step 5] L1阻断层              → L1=0, blocked=false ✅
[Step 6] L2警告层              → L2=0 ✅
[Step 7] L3记录层              → L3=36项, 规则分布正常 ✅
[Step 8] SARIF生成             → security-results.sarif (30037 bytes, 36 results) ✅
[Step 9] 最终摘要              → 通过 (可合并) ✅
```

### Workflow结构验证

```
14/14 功能检查通过:
  ✅ 检出代码(完整历史)  ✅ Python环境  ✅ CI模式扫描
  ✅ Artifact上传(always) ✅ SARIF生成  ✅ SARIF上传
  ✅ L1阻断(exit 1)      ✅ L2警告(::warning) ✅ L3记录(仅计数)
  ✅ PR评论              ✅ 最终摘要   ✅ 缓存
  ✅ 并发控制            ✅ 超时保护
```

### 测试套件零回归

```
python3 scripts/pre-commit-security.py --test
结果: 50/50 通过, 0 失败
```

---

## 三级防线CI行为矩阵

| 场景 | L1发现 | L2发现 | L3发现 | CI结果 | PR可合并 | 通知方式 |
|------|--------|--------|--------|--------|---------|---------|
| 完全干净 | 0 | 0 | 0 | Pass | ✅ | 无 |
| 仅L3记录 | 0 | 0 | >0 | Pass | ✅ | 静默记录 |
| L2警告 | 0 | >0 | 任意 | Pass | ✅ (复查建议) | PR评论黄色 |
| L1阻断 | >0 | 任意 | 任意 | **Fail** | ❌ | ::error + PR评论红色 + exit 1 |
| 扫描器崩溃 | — | — | — | Fail | ❌ | ::error |

---

## 逃生门 (CI中如何绕过L1阻断)

与pre-commit模式一致，CI也尊重白名单：

```bash
# 添加临时白名单（≤24h自动过期）
python3 scripts/pre-commit-security.py --whitelist-add L1-07 "src/config.ts" "安全评审通过" 24

# 重新push → CI重新扫描 → 白名单内文件被跳过 → CI Pass
```

白名单存储在 `.claude/security-whitelist.json`，被git追踪。CI checkout时会获取最新白名单。

---

## 后续演进

1. **全仓库定期扫描** (`schedule` trigger): 每周日凌晨全仓库扫描，不限于PR变更
2. **按规则门禁**: 允许特定L1规则在CI降级为L2 (emergency模式)
3. **CI指标接入L3趋势**: scan结果写入commit-log.jsonl
4. **Slack通知**: L1阻断时通知安全负责人
5. **Gitee Go适配**: 复用同一scanner，替换workflow平台特定部分

---

*实施工程师: 周富贵 QE | AI师生研究院 V7 | 2026-05-06*
*前序: V7-W5-013 (CI设计) + V7-W5-003 (L1+L3实现)*
