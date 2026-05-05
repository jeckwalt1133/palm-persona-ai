# 周富贵 — V7-003 安全审计报告

**审计日期**: 2026-05-06
**审计范围**: 马富贵 Phase 2 记忆系统交付物（knowledge-graph.json + memory-search.sh + memory-search.py + V7-003任务定义）
**审计标准**: 安全红线清单 + OWASP Top 10 + 项目安全规范

---

## 审计范围

| 文件 | 行数 | 类型 | 风险等级 |
|------|------|------|---------|
| memory/knowledge-graph.json | 308 | JSON数据 | 低 |
| scripts/memory-search.sh | 8 | Bash包装脚本 | 低 |
| scripts/memory-search.py | 145 | Python检索脚本 | 中 |
| curriculum/task-prompts/V7-003.json | 26 | JSON任务定义 | 低 |

---

## 自动化扫描结果

### 1. 密钥扫描

```
检查: memory/knowledge-graph.json   ✅ 通过
检查: scripts/memory-search.sh     ✅ 通过
检查: scripts/memory-search.py     ✅ 通过
检查: curriculum/task-prompts/V7-003.json ✅ 通过
```

**结论**: 四个文件均无硬编码密钥。✅

全仓库扫描：当前代码干净。误报过滤正确屏蔽了 `zhou-security-02.md` 中的教学示例密钥和 `agent-security-guard.ts` 中的占位符。

### 2. 危险命令扫描

```
检查: 全部文件 — rm -rf/sudo/chmod 777/eval()/exec()/subprocess/os.system
结果: ✅ 全部通过
```

**验证证据**:
- `memory-search.py`: 无 `eval()`/`exec()`/`subprocess`/`os.system` 调用
- `memory-search.sh`: 仅做 `cd` + `python3` 调用，无危险操作
- 所有文件路径通过 `Path(__file__).resolve().parent.parent` 动态计算，无硬编码绝对路径

### 3. .env / 敏感引用检查

```
检查: process.env / DOTENV / dotenv / API_KEY / SECRET / TOKEN
结果: ✅ 全部通过
```

---

## 深度代码审查

### memory-search.py — 安全评估

**路径安全** ✅
- 使用 `Path(__file__).resolve().parent.parent` 动态计算项目根目录
- 所有文件路径从 `MEMORY_DIR` 常量 + 固定文件名拼接：`MEMORY_DIR / "knowledge-graph.json"`
- 不接受用户输入的路径参数（`keyword`/`--domain`/`--since` 均为筛选条件，不参与路径构造）

**输入验证** ✅
- `keyword` 在 Python 内作为字符串使用（`.lower()`, `in`），无注入风险
- `--domain` 参数仅用于值比对（`n.get("domain") != domain`），无命令拼接
- `--since` 用于正则匹配 `re.search(r"(\d{4}-\d{2}-\d{2})", block)`，无可执行注入
- 使用 `argparse` 标准库，不直接拼接 sys.argv

**网络调用** ✅
- 纯本地文件读取，无 HTTP 请求、无 socket、无外部 API 调用

**命令执行** ✅
- 无 `os.system()`、`subprocess`、`eval()`、`exec()`

### 安全评分

| 维度 | 评分 | 依据 |
|------|------|------|
| 密钥安全 | 8/10 | 当前代码无泄漏，但Git历史有遗留密钥（-2分，非本次提交引入） |
| 输入验证 | 9/10 | 无注入风险点，keyword缺少长度限制（-1分，低风险） |
| 文件安全 | 10/10 | 路径固定，无路径遍历，无用户输入参与文件路径拼接 |
| 命令执行 | 10/10 | 无危险命令调用，纯Python标准库操作 |
| **总体** | **9.25/10** | 代码安全质量高，无安全问题由本次提交引入 |

---

## 发现的问题

### [高危] Git历史100次提交中存在真实API Key

**位置**: `git log --all -100 -p` 扫描结果（在 `scripts/security-scan-keys.sh` 输出中）
**描述**: 历史提交中存在至少3个不同的 DeepSeek API Key（已轮换，sk-<已轮换-01>...、sk-<已轮换-02>...、sk-<已轮换-03>...），在多次提交中重复出现
**证据**: 全仓库安全扫描输出显示8个历史匹配行（过滤掉1个占位符）
**影响**: 如果仓库公开，这些密钥已经泄露。即使轮换过密钥，历史提交中也暴露了密钥模式
**修复建议**:
```bash
# 1. 确认这些密钥已轮换（在DeepSeek控制台作废旧Key）
# 2. 使用 git-filter-repo 清除历史中的密钥
pip install git-filter-repo
git filter-repo --force --replace-text <(echo '<YOUR-LEAKED-KEY>==>REDACTED')
# 3. 通知团队轮换所有泄漏的密钥
```
**注意**: 此问题非马富贵 V7-003 引入，而是项目历史遗留。但审计义务要求我（周富贵）必须上报。

### [建议] memory-search.py 缺少JSON解析异常处理

**位置**: `scripts/memory-search.py:16-17` 和 `:70`
**描述**: `load_json()` 函数直接调用 `json.load(f)` 无 try/except。如果 `knowledge-graph.json` 被手动编辑损坏（格式错误），脚本会崩溃而非给出可读报错。
**风险等级**: 低（仅影响本地开发工具，不影响线上服务）
**修复建议**:
```python
def load_json(path):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, FileNotFoundError) as e:
        print(f"⚠️ 读取失败: {path} — {e}", file=sys.stderr)
        return {} if path.suffix == ".json" else []
```

### [建议] keyword 参数无长度限制

**位置**: `scripts/memory-search.py:130`
**描述**: `argparse` 未对 keyword 设置长度限制。恶意超长输入（如 1MB 字符串）可能导致 ReDoS（在 `re.search` 中）或 OOM。
**风险等级**: 极低（仅本地使用，非网络服务）
**修复建议**: 添加 `type=lambda s: s[:200]` 或显式长度检查。

---

## 一票否决项

| 红线 | 状态 |
|------|------|
| API Key 写入代码文件 | ✅ 未触发 — V7-003新增代码无密钥 |
| .env 提交到 Git | ✅ 未触发 — .env 未在暂存区 |
| 日志中打印 API Key | ✅ 未触发 — 无日志输出 |
| 公开文档含密钥代码 | ✅ 未触发 — knowledge-graph.json 为结构化数据，无可暴露信息 |
| 密钥泄露不报告 | ✅ 已报告 — 历史遗留密钥已在本文档上报 |

**结论: 无一票否决项触发。V7-003 通过安全审查。**

---

## 补充发现

### 正面评价

1. **knowledge-graph.json 数据结构设计良好** — 每个节点标注 `source` 字段指向源文件，可审计可追溯。边的 `relation` 类型有明确定义（precedes/supports/contradicts/derives_from + 3型扩展），非随意命名。

2. **memory-search.sh 正确使用参数透传** — `python3 "$SCRIPT_DIR/memory-search.py" "$@"` 使用 `"$@"` 而非裸 `$@`，正确处理含空格的参数。

3. **JSON + UTF-8 编码规范** — 所有文件使用 `encoding="utf-8"` 明确指定编码，`ensure_ascii=False` 保留中文可读性。

4. **非破坏性工具** — 所有操作均为只读查询，不修改任何项目文件。符合"安全默认"原则。

---

*审计员: 周富贵 (千问 Qwen3-Max) | AI师生研究院 V7*
*审查标准: 安全红线 V2.0 + OWASP Top 10 (2021)*
