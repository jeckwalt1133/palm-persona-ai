#!/usr/bin/env python3
"""pre-commit 安全扫描引擎 V3.1 — 三层防线(L1阻断/L2警告/L3记录) + JSON报告 + CI模式

用法:
  pre-commit模式: python3 scripts/pre-commit-security.py [--json]
  CI模式:         python3 scripts/pre-commit-security.py --ci-mode [--base-ref main]
  测试:           python3 scripts/pre-commit-security.py --test
  白名单:         python3 scripts/pre-commit-security.py --whitelist-add ...

CI模式说明:
  --ci-mode      扫描PR变更(非staged)，输出SARIF兼容JSON+退出码语义
  --base-ref     对比基线分支/commit (默认: origin/main)
  --output-file  将报告写入指定文件(CI artifact用)
  --sarif        输出SARIF格式(兼容GitHub Code Scanning)

架构: student-notebook/zhou-three-layer-defense.md
"""

import json
import re
import sys
import subprocess
from datetime import datetime, timezone
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parent.parent

# ─── 层级分配 (三层防线架构) ───────────────────────
# L1=阻断 L2=警告 L3=记录 (详见 student-notebook/zhou-three-layer-defense.md)
LAYER_ASSIGNMENT = {
    "PAT-001": "L1", "PAT-002": "L1", "PAT-003": "L1",
    "PAT-004": "L1", "PAT-005": "L1", "PAT-006": "L2",
    "PAT-007": "L2", "PAT-008": "L1", "PAT-009": "L2",
    "PAT-010": "L2", "PAT-011": "L2", "PAT-012": "L2",
    # L1 新增阻断规则 (V7-W5-003)
    "L1-07": "L1", "L1-08": "L1", "L1-09": "L1", "L1-10": "L1",
    # L3 信息记录层
    "L3-001": "L3", "L3-002": "L3", "L3-003": "L3",
    "L3-004": "L3", "L3-005": "L3", "L3-006": "L3",
}

# ─── 密钥检测模式库 ───────────────────────────────

PATTERNS = [
    {
        "id": "PAT-001",
        "name": "OpenAI/DeepSeek/Anthropic API Key",
        "pattern": r'sk-[a-zA-Z0-9]{20,}',
        "severity": "critical",
        "description": "OpenAI/DeepSeek/Anthropic API密钥，格式sk-开头+20位以上字母数字",
        "defenseLayer": "L1",
        "remediation": "移至.env文件，使用process.env引用；在平台控制台轮换密钥",
    },
    {
        "id": "PAT-002",
        "name": "AWS Access Key ID",
        "pattern": r'AKIA[0-9A-Z]{16}',
        "severity": "critical",
        "description": "AWS访问密钥ID，AKIA开头16位大写字母数字",
        "remediation": "使用IAM Role或环境变量；立即在AWS控制台作废该密钥",
    },
    {
        "id": "PAT-003",
        "name": "GitHub Personal Access Token (classic)",
        "pattern": r'ghp_[a-zA-Z0-9]{36}',
        "severity": "critical",
        "description": "GitHub经典个人访问令牌，ghp_开头36位",
        "remediation": "在GitHub Settings > Developer settings中作废并重新生成",
    },
    {
        "id": "PAT-004",
        "name": "GitHub OAuth Token",
        "pattern": r'gho_[a-zA-Z0-9]{36}',
        "severity": "critical",
        "description": "GitHub OAuth访问令牌",
        "remediation": "在GitHub授权应用中撤销",
    },
    {
        "id": "PAT-005",
        "name": "GitHub Fine-grained PAT",
        "pattern": r'github_pat_[a-zA-Z0-9_]{30,}',
        "severity": "critical",
        "description": "GitHub细粒度个人访问令牌(v2)",
        "remediation": "在GitHub Settings中作废",
    },
    {
        "id": "PAT-006",
        "name": "Slack Bot/User Token",
        "pattern": r'xox[baprs]-[a-zA-Z0-9-]{10,}',
        "severity": "high",
        "description": "Slack令牌：xoxb(Bot)/xoxp(User)/xoxa(App)/xoxr(Refresh)/xoxs(Sign)开头",
        "remediation": "在Slack App管理面板中重新生成",
    },
    {
        "id": "PAT-007",
        "name": "JWT Token (高置信度)",
        "pattern": r'eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}',
        "severity": "high",
        "description": "JWT令牌，eyJ开头三段base64url编码",
        "remediation": "检查令牌有效期；确认非生产环境令牌",
    },
    {
        "id": "PAT-008",
        "name": "PEM Private Key",
        "pattern": r'-----BEGIN (RSA|EC|DSA|OPENSSH|ENCRYPTED) PRIVATE KEY-----',
        "severity": "critical",
        "description": "PEM格式私钥，绝对不能提交到代码仓库",
        "remediation": "立即作废并重新生成密钥对；私钥使用密钥管理服务存储",
    },
    {
        "id": "PAT-009",
        "name": "Generic API Key Assignment",
        "pattern": r'(apiKey|api_key|apikey|API_KEY|SECRET_KEY|secretKey|ACCESS_KEY|accessToken)\s*[:=]\s*[\x27\x22]([a-zA-Z0-9_-]{16,})[\x27\x22]',
        "severity": "high",
        "description": "代码中直接赋值敏感变量（key/secret/token命名模式）",
        "remediation": "使用process.env替代硬编码值",
    },
    {
        "id": "PAT-010",
        "name": "Token in URL Query String",
        "pattern": r'[?&](token|access_token|api_key|apikey|secret)=[a-zA-Z0-9_-]{12,}',
        "severity": "high",
        "description": "URL查询参数中包含token/key（可能泄露在日志/代理中）",
        "remediation": "使用POST请求体或Authorization Header传递令牌",
    },
    {
        "id": "PAT-011",
        "name": "HTTP Basic Auth Header",
        "pattern": r'Authorization\s*:\s*Basic\s+[a-zA-Z0-9+/=]{16,}',
        "severity": "medium",
        "description": "HTTP Basic认证头（base64编码的用户名:密码），易解码",
        "remediation": "使用Bearer Token或OAuth 2.0替代Basic Auth",
    },
    {
        "id": "PAT-012",
        "name": "Package Registry Token",
        "pattern": r'(NPM_TOKEN|NUGET_KEY|DOCKER_PASSWORD|PYPI_TOKEN|REGISTRY_TOKEN)\s*[:=]\s*[\x27\x22]?([a-zA-Z0-9_-]{12,})',
        "severity": "high",
        "description": "包管理器注册表令牌（npm/docker/pypi/nuget）",
        "remediation": "使用CI Secret变量注入，本地开发用--registry配置",
    },
    # ─── L1 阻断层新增 (L1-07~L1-10, V7-W5-003) ───
    {
        "id": "L1-07",
        "name": "JWT Secret/密钥硬编码",
        "pattern": r'(jwtSecret|JWT_SECRET|jwt_secret|jwtKey|tokenSecret)\s*[:=]\s*[\x27\x22]?([a-zA-Z0-9_\-!@#$%^&*]{16,})[\x27\x22]?',
        "severity": "critical",
        "description": "JWT签名密钥硬编码在代码中，泄露后攻击者可伪造任意令牌",
        "remediation": "使用环境变量或密钥管理服务(KMS)存储JWT密钥，启动时加载",
    },
    {
        "id": "L1-08",
        "name": "数据库密码硬编码",
        "pattern": r'(password|passwd|db_password|DB_PASSWORD|mysql_password|pg_password)\s*[:=]\s*[\x27\x22]?([^\x27\x22\s]{6,})[\x27\x22]?',
        "severity": "critical",
        "description": "数据库密码直接写在代码中，是OWASP Top 10 A07认证失败类漏洞",
        "remediation": "密码放入.env并通过process.env引用；生产环境使用Vault/Secrets Manager",
    },
    {
        "id": "L1-09",
        "name": "内网地址/内部域名硬编码",
        "pattern": r'(host|HOST|endpoint|ENDPOINT|baseUrl|BASE_URL|apiUrl|API_URL)\s*[:=]\s*[\x27\x22](https?://)?(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?[\x27\x22]|(host|HOST|endpoint|ENDPOINT|baseUrl|BASE_URL|apiUrl|API_URL)\s*[:=]\s*[\x27\x22](https?://)?[a-zA-Z0-9_-]+\.(internal|corp|lan)[\x27\x22]',
        "severity": "critical",
        "description": "内网地址/.internal域硬编码，部署到公网后暴露内部拓扑",
        "remediation": "使用环境变量或服务发现机制(DNS SRV/Consul)替代硬编码地址",
    },
    {
        "id": "L1-10",
        "name": "CI/CD Pipeline Token泄露",
        "pattern": r'(CI_JOB_TOKEN|GITHUB_TOKEN|GITLAB_TOKEN|NPM_TOKEN|DOCKER_TOKEN|ARTIFACTORY_TOKEN|SONAR_TOKEN)\s*[:=]\s*[\x27\x22]?([a-zA-Z0-9_-]{12,})',
        "severity": "critical",
        "description": "CI/CD平台令牌泄露，攻击者可访问私有仓库/发布恶意包/篡改构建",
        "remediation": "使用CI平台的Secret变量功能(${{ secrets.XXX }})，绝不硬编码",
    },
    # ─── L3 记录层 (信息安全气味，不阻断不警告) ───
    {
        "id": "L3-001",
        "name": "硬编码内网地址",
        "pattern": r'(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3})\s*[:;,]',
        "severity": "info",
        "description": "代码中含内网地址，部署到生产环境时可能失效",
        "remediation": "使用环境变量或配置文件管理地址",
    },
    {
        "id": "L3-002",
        "name": "chmod 777 危险权限",
        "pattern": r'chmod\s+(777|a\+rwx|ugo\+rwx)',
        "severity": "info",
        "description": "文件权限设为所有人可读写执行，存在安全风险",
        "remediation": "使用最小权限原则：chmod 644(文件) 或 755(目录)",
    },
    {
        "id": "L3-003",
        "name": "TODO/HACK含安全关键词",
        "pattern": r'(TODO|FIXME|HACK|XXX|HACKY)\s*[:\-]?\s*.*(安全|security|密钥|token|secret|password|encrypt|crypto|漏洞|合规)',
        "severity": "info",
        "description": "标记了但未完成的安全相关修复/临时方案",
        "remediation": "在sprint中安排修复时间，或将TODO转为正式task",
    },
    {
        "id": "L3-004",
        "name": "已弃用API使用",
        "pattern": r'(substr\s*\(|escape\s*\(|unescape\s*\(|document\.write\s*\()',
        "severity": "info",
        "description": "使用了JavaScript已弃用的API (substr/escape/unescape/document.write)",
        "remediation": "substr→slice/substring, escape→encodeURIComponent, document.write→DOM API",
    },
    {
        "id": "L3-005",
        "name": "缺少输入长度校验",
        "pattern": r'\.(length|size|count)\s*(>|<|>=|<=)\s*\d{4,}(?!.*\.(length|size))',
        "severity": "info",
        "description": "发现大数值长度检查，需确认有输入长度限制防止DoS",
        "remediation": "在API入口添加输入长度校验（推荐zod/yup schema）",
    },
    {
        "id": "L3-006",
        "name": "console.log打印完整对象",
        "pattern": r'console\.(log|info|debug|warn)\((?!.*\.(length|toString|slice|substring))[^)]{30,}\)',
        "severity": "info",
        "description": "console输出长内容，检查是否包含敏感数据",
        "remediation": "生产环境使用专用logger并配置redact规则",
    },
]


def is_false_positive(line, pattern_id):
    """过滤已知误报：占位符、示例代码、教学文档、注释"""
    # 全相同字符
    if re.search(r'sk-x{20,}|sk-a{20,}', line, re.IGNORECASE):
        return True
    # 纯递增数字
    if re.search(r'sk-1{5,}2{5,}3{5,}', line):
        return True
    # 示例/测试标记
    if re.search(r'(placeholder|dummy|example|示例|假|占位|FAKE|fake_key|test[-_]leak|REDACTED|<)', line, re.IGNORECASE):
        return True
    # 注释或文档中的说明
    if re.search(r'(#|//|/\*)\s*.*(示例|假|占位|placeholder|example)', line):
        return True
    # .env.example 中的模板
    if '.env.example' in line or 'your-' in line.lower() or 'changeme' in line.lower():
        return True
    # process.env / secrets.XXX 引用 (非硬编码)
    if re.search(r'(process\.env\.|secrets\.\w+|CI_JOB_TOKEN\s*[:=]\s*\$\w+)', line):
        return True
    return False


# ─── 逃生门: 白名单机制 ───────────────────────────
WHITELIST_FILE = PROJECT_DIR / ".claude" / "security-whitelist.json"


def load_whitelist():
    """加载白名单，自动清除过期条目(>24h)"""
    if not WHITELIST_FILE.exists():
        return []
    try:
        data = json.loads(WHITELIST_FILE.read_text())
        entries = data.get("whitelist", [])
    except (json.JSONDecodeError, KeyError):
        return []

    now = datetime.now(timezone.utc)
    valid = []
    changed = False
    for entry in entries:
        try:
            expires = datetime.fromisoformat(entry.get("expires", ""))
            if expires > now:
                valid.append(entry)
            else:
                changed = True
        except (ValueError, TypeError):
            changed = True  # 无法解析的条目直接丢弃
            continue
    if changed:
        save_whitelist(valid)
    return valid


def save_whitelist(entries):
    """保存白名单到文件"""
    WHITELIST_FILE.parent.mkdir(parents=True, exist_ok=True)
    WHITELIST_FILE.write_text(json.dumps({"whitelist": entries, "updatedAt": datetime.now(timezone.utc).isoformat()}, ensure_ascii=False, indent=2))


def is_whitelisted(pattern_id, file_path, whitelist_entries):
    """检查发现是否在白名单中"""
    for entry in whitelist_entries:
        if entry.get("pattern") == pattern_id:
            entry_file = entry.get("file", "")
            if entry_file == file_path or entry_file == "*" or file_path.endswith(entry_file):
                return True
    return False


def add_whitelist_entry(pattern_id, file_path, reason, approver="nie", hours=24):
    """添加白名单条目 (逃生门API)"""
    entries = load_whitelist()
    expires = datetime.now(timezone.utc)
    from datetime import timedelta
    expires = (expires + timedelta(hours=hours)).isoformat()
    entries.append({
        "pattern": pattern_id,
        "file": file_path,
        "reason": reason,
        "expires": expires,
        "approver": approver,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    })
    save_whitelist(entries)
    return expires


def scan_diff(file_path, diff_content, whitelist_entries=None):
    """扫描单个文件的diff，返回发现的密钥列表"""
    if whitelist_entries is None:
        whitelist_entries = []
    findings = []
    lines = diff_content.split("\n")

    for line_num_offset, line in enumerate(lines):
        # 只检查新增行（+开头）
        if not line.startswith("+"):
            continue
        # 跳过纯 +++ 的文件头
        if line.startswith("+++"):
            continue
        # 去掉+前缀
        clean_line = line[1:]

        for pat in PATTERNS:
            for match in re.finditer(pat["pattern"], clean_line):
                matched_text = match.group(0)
                if is_false_positive(clean_line, pat["id"]):
                    continue
                if is_whitelisted(pat["id"], file_path, whitelist_entries):
                    continue
                findings.append({
                    "patternId": pat["id"],
                    "patternName": pat["name"],
                    "defenseLayer": LAYER_ASSIGNMENT.get(pat["id"], "L2"),
                    "severity": pat["severity"],
                    "file": file_path,
                    "line": f"+{line_num_offset + 1}",
                    "match": matched_text,
                    "context": clean_line.strip()[:120],
                    "remediation": pat["remediation"],
                })

    return findings


def get_staged_files():
    """获取暂存区文件列表"""
    result = subprocess.run(
        ["git", "-C", str(PROJECT_DIR), "diff", "--cached", "--name-only", "--diff-filter=ACMR"],
        capture_output=True, text=True, timeout=10
    )
    return [f for f in result.stdout.strip().split("\n") if f]


def should_scan(file_path):
    """判断文件是否需要扫描"""
    # 跳过自身 — C5自噬: 扫描器测试用例含假密钥会触发自身规则
    if file_path.startswith("scripts/pre-commit-security"):
        return False
    # 跳过二进制和依赖
    skip_exts = {".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".woff", ".woff2", ".ttf", ".lock", ".sum"}
    skip_dirs = {"node_modules", "dist", ".next", ".git", ".claude", "memory/security"}
    # 跳过扫描器自身的报告输出 (防止自引用)
    if "security-report.json" in file_path or "security-results.sarif" in file_path:
        return False
    ext = Path(file_path).suffix.lower()
    if ext in skip_exts:
        return False
    for d in skip_dirs:
        if file_path.startswith(d + "/"):
            return False
    return True


def get_diff(file_path):
    """获取单个文件的暂存diff"""
    result = subprocess.run(
        ["git", "-C", str(PROJECT_DIR), "diff", "--cached", "--", file_path],
        capture_output=True, text=True, timeout=10
    )
    return result.stdout


def run_scan():
    """主扫描逻辑"""
    staged = get_staged_files()
    whitelist = load_whitelist()
    all_findings = []
    scanned = 0
    skipped = 0

    for f in staged:
        if not should_scan(f):
            skipped += 1
            continue
        scanned += 1
        diff = get_diff(f)
        if diff:
            findings = scan_diff(f, diff, whitelist)
            all_findings.extend(findings)

    # 按层级+严重性排序
    layer_order = {"L1": 0, "L2": 1, "L3": 2}
    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
    all_findings.sort(key=lambda x: (
        layer_order.get(x.get("defenseLayer", "L2"), 5),
        severity_order.get(x.get("severity", "info"), 5),
    ))

    # 分层统计
    L1_findings = [f for f in all_findings if f.get("defenseLayer") == "L1"]
    L2_findings = [f for f in all_findings if f.get("defenseLayer") == "L2"]
    L3_findings = [f for f in all_findings if f.get("defenseLayer") == "L3"]

    l1_critical = sum(1 for f in L1_findings if f["severity"] == "critical")
    l2_high = sum(1 for f in L2_findings if f["severity"] in ("high", "critical"))

    report = {
        "scanTime": datetime.now(timezone.utc).isoformat(),
        "scanner": "pre-commit-security.py",
        "version": "3.0.0",
        "architecture": "三层防线 (L1阻断/L2警告/L3记录)",
        "defense": {
            "L1_blocked": l1_critical > 0,
            "L1_total": len(L1_findings),
            "L1_critical": l1_critical,
            "L2_total": len(L2_findings),
            "L2_warnings": l2_high,
            "L3_total": len(L3_findings),
        },
        "summary": {
            "filesScanned": scanned,
            "filesSkipped": skipped,
            "totalFindings": len(all_findings),
            "criticalFindings": l1_critical,
            "highFindings": l2_high,
            "infoRecords": len(L3_findings),
            "blocked": l1_critical > 0,
        },
        "findings": {
            "L1": L1_findings,
            "L2": L2_findings,
            "L3": L3_findings,
        },
    }

    return report


# ─── CI模式: PR全量扫描 ────────────────────────────

def get_pr_changed_files(base_ref="origin/main"):
    """获取PR变更的文件列表 (相对于base分支)"""
    result = subprocess.run(
        ["git", "-C", str(PROJECT_DIR), "diff", "--name-only", "--diff-filter=ACMR",
         f"{base_ref}...HEAD"],
        capture_output=True, text=True, timeout=15
    )
    if result.returncode != 0:
        # 尝试merge-base方式
        result2 = subprocess.run(
            ["git", "-C", str(PROJECT_DIR), "merge-base", base_ref, "HEAD"],
            capture_output=True, text=True, timeout=10
        )
        if result2.returncode == 0 and result2.stdout.strip():
            merge_base = result2.stdout.strip()
            result = subprocess.run(
                ["git", "-C", str(PROJECT_DIR), "diff", "--name-only", "--diff-filter=ACMR",
                 f"{merge_base}..HEAD"],
                capture_output=True, text=True, timeout=10
            )
        else:
            return [], f"无法确定base ref: {base_ref}"
    files = [f for f in result.stdout.strip().split("\n") if f]
    return files, None


def get_file_pr_diff(base_ref, file_path):
    """获取PR中单个文件的diff (相对于base)"""
    result = subprocess.run(
        ["git", "-C", str(PROJECT_DIR), "diff", f"{base_ref}...HEAD", "--", file_path],
        capture_output=True, text=True, timeout=15
    )
    if result.returncode != 0:
        result2 = subprocess.run(
            ["git", "-C", str(PROJECT_DIR), "merge-base", base_ref, "HEAD"],
            capture_output=True, text=True, timeout=10
        )
        if result2.returncode == 0 and result2.stdout.strip():
            merge_base = result2.stdout.strip()
            result = subprocess.run(
                ["git", "-C", str(PROJECT_DIR), "diff", f"{merge_base}..HEAD", "--", file_path],
                capture_output=True, text=True, timeout=10
            )
    return result.stdout


def run_ci_scan(base_ref="origin/main"):
    """CI模式扫描 — 扫描PR全部变更, 输出结构化报告"""
    files, error = get_pr_changed_files(base_ref)
    if error:
        return {
            "scanTime": datetime.now(timezone.utc).isoformat(),
            "scanner": "pre-commit-security.py",
            "version": "3.1.0",
            "mode": "ci",
            "baseRef": base_ref,
            "error": error,
            "summary": {"filesScanned": 0, "totalFindings": 0, "blocked": False},
            "findings": {"L1": [], "L2": [], "L3": []},
        }

    whitelist = load_whitelist()
    all_findings = []
    scanned = 0
    skipped = 0

    for f in files:
        if not should_scan(f):
            skipped += 1
            continue
        scanned += 1
        diff = get_file_pr_diff(base_ref, f)
        if diff:
            findings = scan_diff(f, diff, whitelist)
            all_findings.extend(findings)

    # 排序+分层
    layer_order = {"L1": 0, "L2": 1, "L3": 2}
    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
    all_findings.sort(key=lambda x: (
        layer_order.get(x.get("defenseLayer", "L2"), 5),
        severity_order.get(x.get("severity", "info"), 5),
    ))

    L1_findings = [f for f in all_findings if f.get("defenseLayer") == "L1"]
    L2_findings = [f for f in all_findings if f.get("defenseLayer") == "L2"]
    L3_findings = [f for f in all_findings if f.get("defenseLayer") == "L3"]
    l1_critical = sum(1 for f in L1_findings if f["severity"] == "critical")
    l2_high = sum(1 for f in L2_findings if f["severity"] in ("high", "critical"))

    report = {
        "scanTime": datetime.now(timezone.utc).isoformat(),
        "scanner": "pre-commit-security.py",
        "version": "3.1.0",
        "mode": "ci",
        "baseRef": base_ref,
        "architecture": "三层防线 (L1阻断/L2警告/L3记录)",
        "defense": {
            "L1_blocked": l1_critical > 0,
            "L1_total": len(L1_findings),
            "L1_critical": l1_critical,
            "L2_total": len(L2_findings),
            "L2_warnings": l2_high,
            "L3_total": len(L3_findings),
        },
        "summary": {
            "filesScanned": scanned,
            "filesSkipped": skipped,
            "filesChanged": len(files),
            "totalFindings": len(all_findings),
            "criticalFindings": l1_critical,
            "highFindings": l2_high,
            "infoRecords": len(L3_findings),
            "blocked": l1_critical > 0,
        },
        "findings": {"L1": L1_findings, "L2": L2_findings, "L3": L3_findings},
        "whitelist": {"active": len(whitelist)},
        "ciMetadata": {
            "branch": subprocess.run(["git", "-C", str(PROJECT_DIR), "branch", "--show-current"],
                                     capture_output=True, text=True).stdout.strip(),
            "commit": subprocess.run(["git", "-C", str(PROJECT_DIR), "rev-parse", "HEAD"],
                                     capture_output=True, text=True).stdout.strip()[:8],
            "baseRef": base_ref,
        },
    }
    return report


def generate_sarif(report):
    """将扫描报告转换为SARIF格式 (兼容GitHub Code Scanning)"""
    rules = []
    results = []
    rule_index = {}

    for finding_list in report.get("findings", {}).values():
        for f in finding_list:
            rid = f["patternId"]
            if rid not in rule_index:
                rule_index[rid] = len(rules)
                rules.append({
                    "id": rid,
                    "name": f["patternName"],
                    "shortDescription": {"text": f["patternName"]},
                    "fullDescription": {"text": f.get("remediation", "")},
                    "defaultConfiguration": {"level": "error" if f.get("defenseLayer") == "L1" else "warning"},
                    "properties": {
                        "defenseLayer": f.get("defenseLayer", ""),
                        "severity": f.get("severity", ""),
                    },
                })

            # SARIF要求region信息
            line_num = 1
            match_line = f.get("line", "+1")
            try:
                line_num = int(match_line.lstrip("+"))
            except ValueError:
                pass

            results.append({
                "ruleId": rid,
                "ruleIndex": rule_index[rid],
                "level": "error" if f.get("defenseLayer") == "L1" else "warning",
                "message": {
                    "text": f"[{rid}] {f['patternName']}: {f.get('match', '')[:80]}\n修复: {f.get('remediation', '')}"
                },
                "locations": [{
                    "physicalLocation": {
                        "artifactLocation": {"uri": f["file"]},
                        "region": {"startLine": line_num, "snippet": {"text": f.get("context", "")[:200]}},
                    }
                }],
            })

    sarif = {
        "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
        "version": "2.1.0",
        "runs": [{
            "tool": {
                "driver": {
                    "name": "掌心人格局 安全扫描引擎",
                    "organization": "AI师生研究院 V7",
                    "version": "3.1.0",
                    "rules": rules,
                }
            },
            "results": results,
        }],
    }
    return sarif


def run_tests():
    """自检测试用例——≥5种不同的密钥泄漏场景"""
    tests = []
    test_num = 0

    def add_test(name, code_snippet, expected_pattern, should_detect=True):
        nonlocal test_num
        test_num += 1
        tests.append({
            "id": f"TEST-{test_num:02d}",
            "name": name,
            "code": code_snippet,
            "expectedPattern": expected_pattern,
            "shouldDetect": should_detect,
        })

    # 测试1: DeepSeek API Key 硬编码
    add_test(
        "DeepSeek API Key硬编码赋值",
        'const deepseekKey = "sk-9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d";',
        "PAT-001",
        True,
    )

    # 测试2: AWS Access Key 在配置中
    add_test(
        "AWS Access Key ID配置文件",
        'aws_access_key_id = AKIAJ7K8L9M0N1P2Q3R4',
        "PAT-002",
        True,
    )

    # 测试3: GitHub Token 在环境变量赋值
    add_test(
        "GitHub Personal Access Token赋值",
        'GITHUB_TOKEN=ghp_1A2b3C4d5E6f7G8h9I0j1K2l3M4n5O6p7Q8r',
        "PAT-003",
        True,
    )

    # 测试4: Slack Bot Token
    add_test(
        "Slack Bot Token硬编码",
        'const slackToken = "xoxb-N0T-A-R3AL-T0K3N-F0R-T3ST1NG";',
        "PAT-006",
        True,
    )

    # 测试5: JWT Token 在测试文件中
    add_test(
        "JWT Bearer Token硬编码",
        'const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U";',
        "PAT-007",
        True,
    )

    # 测试6: PEM私钥
    add_test(
        "RSA Private Key写入代码",
        'const privateKey = `-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----`;',
        "PAT-008",
        True,
    )

    # 测试7: Generic API_KEY赋值
    add_test(
        "通用API_KEY变量赋值",
        'const API_KEY = "abcdef1234567890abcdef1234567890";',
        "PAT-009",
        True,
    )

    # 测试8: Token in URL
    add_test(
        "URL查询参数含token",
        'const url = "https://api.service.com/data?token=abcdef1234567890&format=json";',
        "PAT-010",
        True,
    )

    # ─── L1-07: JWT Secret 测试 (10条) ───
    add_test("JWT secret直接赋值", "const jwtSecret = 'abcdefghijklmnop123456';", "L1-07", True)
    add_test("JWT_SECRET环境变量式硬编码", 'JWT_SECRET=my-super-secret-key-123', "L1-07", True)
    add_test("jwtKey硬编码", 'const jwtKey = "myPrivateKey123456";', "L1-07", True)
    add_test("tokenSecret配置", 'tokenSecret: "another-secret-key-abc"', "L1-07", True)
    add_test("jwt_secret下划线风格", 'const jwt_secret = "topSecret2026!!!!";', "L1-07", True)
    add_test("JWT Secret 短值不应触发(<16字符)", "const jwtSecret = 'short';", "L1-07", False)
    add_test("JWT Secret process.env正常用法", "const jwtSecret = process.env.JWT_SECRET;", "L1-07", False)
    add_test("JWT Secret 注释说明", "// jwtSecret 应从环境变量加载", "L1-07", False)
    add_test("jwtSecret空字符串", "const jwtSecret = '';", "L1-07", False)
    add_test("jwt expiresIn 非secret", "const jwtExpiresIn = '3600';", "L1-07", False)

    # ─── L1-08: 数据库密码 测试 (10条) ───
    add_test("DB密码直接赋值", "const password = 'mydbpassword123';", "L1-08", True)
    add_test("DB_PASSWORD环境变量式", "DB_PASSWORD=superSecretDB2026!", "L1-08", True)
    add_test("mysql连接串密码", "mysql_password: 'root123456'", "L1-08", True)
    add_test("pg_password postgres", "pg_password='pgsql_secret_2026'", "L1-08", True)
    add_test("passwd变量", 'const passwd = "secr3tP4ss2026!";', "L1-08", True)
    add_test("短密码(<6字符)不应触发", "const password = '12345';", "L1-08", False)
    add_test("password process.env正常", "const password = process.env.DB_PASSWORD;", "L1-08", False)
    add_test("password空值", "const password = '';", "L1-08", False)
    add_test("passwordField字段名不触发", "const passwordField = 'input_password';", "L1-08", False)
    add_test("注释中的password说明", "// password 必须至少8个字符", "L1-08", False)

    # ─── L1-09: 内网地址 测试 (10条) ───
    add_test("HOST=10.x内网IP", "const HOST = '10.0.1.100';", "L1-09", True)
    add_test("API_URL=192.168内网", 'const API_URL = "https://192.168.1.50:8080";', "L1-09", True)
    add_test("baseUrl=.internal域名", 'const baseUrl = "http://api.internal";', "L1-09", True)
    add_test("endpoint .corp域名", 'const endpoint = "https://db.corp";', "L1-09", True)
    add_test("172.16 Docker内网", 'const host = "172.16.0.100";', "L1-09", True)
    add_test("公网IP不应触发", "const HOST = '203.0.113.50';", "L1-09", False)
    add_test("localhost开发说明(注释)", "// localhost is used for development", "L1-09", False)
    add_test("HOST=process.env正常", "const HOST = process.env.API_HOST;", "L1-09", False)
    add_test("非host字段含数字", "const port = 19216;", "L1-09", False)
    add_test(".local域不应触发(非.internal/corp)", 'const baseUrl = "http://myapp.local";', "L1-09", False)

    # ─── L1-10: CI/CD Token 测试 (10条) ───
    add_test("CI_JOB_TOKEN硬编码", "CI_JOB_TOKEN=token-abc123def456ghi", "L1-10", True)
    add_test("GITHUB_TOKEN赋值", 'const GITHUB_TOKEN = "ghp_ci_token_2026_xyz";', "L1-10", True)
    add_test("NPM_TOKEN发布令牌", "NPM_TOKEN=npm_abcdefghijklmnop", "L1-10", True)
    add_test("DOCKER_TOKEN容器注册表", "DOCKER_TOKEN=dkr_pat_2026secret", "L1-10", True)
    add_test("SONAR_TOKEN代码分析", 'SONAR_TOKEN: "squ_abc123def456ghi789"', "L1-10", True)
    add_test("CI token短值不应触发(<12字符)", "CI_JOB_TOKEN=short", "L1-10", False)
    add_test("GitHub Actions ${{ secrets }}", "GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}", "L1-10", False)
    add_test("注释中的Token说明", "// GITHUB_TOKEN is set by CI pipeline", "L1-10", False)
    add_test("GITLAB_TOKEN使用环境变量", "const token = process.env.GITLAB_TOKEN;", "L1-10", False)
    add_test("Token变量名不匹配", 'const myToken = "somevalue123456";', "L1-10", False)

    # 测试9: 正常代码(不应被检测) — 无害变量
    add_test(
        "正常变量赋值(应通过)",
        'const maxLength = 20;',
        "NONE",
        False,
    )

    # 测试10: 误报过滤 — 示例密钥
    add_test(
        "教学示例中的假密钥(应被过滤)",
        'const FAKE_KEY = "sk-test0000000000000000000000"; // 仅用于测试',
        "PAT-001",
        False,
    )

    # 运行测试
    print("=" * 60)
    print("  密钥扫描器 — 自检测试")
    print("=" * 60)
    print()

    passed = 0
    failed = 0

    for test in tests:
        # 构造一个虚拟diff
        fake_diff = f"+{test['code']}"
        findings = scan_diff("test-file.ts", fake_diff)

        detected = any(f["patternId"] == test["expectedPattern"] for f in findings)

        if test["shouldDetect"]:
            if detected:
                print(f"  ✅ {test['id']}: {test['name']} — 正确检测到 {test['expectedPattern']}")
                passed += 1
            else:
                print(f"  ❌ {test['id']}: {test['name']} — 未检测到 {test['expectedPattern']}! 漏报!")
                failed += 1
        else:
            if not detected:
                print(f"  ✅ {test['id']}: {test['name']} — 正确通过（无误报）")
                passed += 1
            else:
                print(f"  ❌ {test['id']}: {test['name']} — 误报! 错误匹配了模式")
                failed += 1

    print()
    print(f"  结果: {passed}/{len(tests)} 通过, {failed} 失败")
    print("=" * 60)

    return failed == 0


def main():
    import argparse
    parser = argparse.ArgumentParser(description="pre-commit 安全扫描引擎 V3.1")
    parser.add_argument("--json", action="store_true", help="输出JSON格式报告")
    parser.add_argument("--test", action="store_true", help="运行自检测试用例")
    parser.add_argument("--ci-mode", action="store_true", help="CI模式: 扫描PR变更(非staged)")
    parser.add_argument("--base-ref", default="origin/main", help="CI模式对比基线 (默认: origin/main)")
    parser.add_argument("--output-file", help="将扫描报告写入指定文件")
    parser.add_argument("--sarif", action="store_true", help="输出SARIF格式 (兼容GitHub Code Scanning)")
    parser.add_argument("--whitelist-add", nargs=4, metavar=("PATTERN", "FILE", "REASON", "HOURS"),
                        help="添加临时白名单: PATTERN FILE REASON HOURS")
    parser.add_argument("--whitelist-list", action="store_true", help="列出当前有效白名单")
    parser.add_argument("--whitelist-clean", action="store_true", help="清除所有过期白名单条目")
    args = parser.parse_args()

    if args.test:
        ok = run_tests()
        sys.exit(0 if ok else 1)

    # 白名单管理命令
    if args.whitelist_add:
        pattern_id, file_path, reason, hours = args.whitelist_add
        try:
            hrs = int(hours)
            if hrs > 24:
                print("错误: 白名单最长24小时")
                sys.exit(1)
            expires = add_whitelist_entry(pattern_id, file_path, reason, hours=hrs)
            print(f"白名单已添加: {pattern_id} @ {file_path}")
            print(f"过期时间: {expires}")
            print(f"审批人: nie (仓库管理员)")
        except ValueError:
            print("错误: HOURS必须是数字")
            sys.exit(1)
        sys.exit(0)

    if args.whitelist_list:
        entries = load_whitelist()
        if entries:
            print(f"当前有效白名单 ({len(entries)}条):")
            for e in entries:
                print(f"  [{e['pattern']}] {e['file']} -- {e['reason']} (过期: {e['expires'][:19]})")
        else:
            print("无有效白名单条目")
        sys.exit(0)

    if args.whitelist_clean:
        entries = load_whitelist()
        print(f"白名单已刷新: {len(entries)} 条仍然有效")
        sys.exit(0)

    # ─── CI模式 ───
    if args.ci_mode:
        report = run_ci_scan(args.base_ref)
        report["whitelist"] = {"active": len(load_whitelist())}

        # 写入输出文件
        if args.output_file:
            out_path = Path(args.output_file)
            out_path.parent.mkdir(parents=True, exist_ok=True)
            out_path.write_text(json.dumps(report, ensure_ascii=False, indent=2))

        # JSON输出 (CI消费)
        if args.json:
            print(json.dumps(report, ensure_ascii=False, indent=2))
            sys.exit(1 if report["summary"]["blocked"] else 0)

        # SARIF输出 (GitHub Code Scanning)
        if args.sarif:
            sarif = generate_sarif(report)
            print(json.dumps(sarif, ensure_ascii=False, indent=2))
            sys.exit(1 if report["summary"]["blocked"] else 0)

        # 非交互CI文本输出
        blocked = report["summary"]["blocked"]
        s = report["summary"]
        d = report["defense"]
        print(f"[SECURITY-SCAN] files={s['filesScanned']} changed={s.get('filesChanged', s['filesScanned'])} "
              f"L1={d['L1_total']} L2={d['L2_total']} L3={d['L3_total']} blocked={blocked}")
        if d["L1_critical"] > 0:
            print(f"[SECURITY-SCAN] FAIL: {d['L1_critical']} critical findings in L1 layer")
            for f in report["findings"]["L1"]:
                print(f"  [{f['patternId']}] {f['file']}:{f['line']}: {f['match'][:80]}")
        elif d["L2_warnings"] > 0:
            print(f"[SECURITY-SCAN] WARN: {d['L2_warnings']} warnings in L2 layer (non-blocking)")
        else:
            print("[SECURITY-SCAN] PASS: No security issues found")

        sys.exit(1 if blocked else 0)

    # ─── pre-commit模式 (默认) ───
    report = run_scan()
    report["whitelist"] = {"active": len(load_whitelist())}

    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        s = report["summary"]
        d = report["defense"]
        wl_count = report["whitelist"]["active"]
        print("🔒 安全门禁 V3 (三层防线)")
        print(f"  扫描文件: {s['filesScanned']} | 跳过: {s['filesSkipped']} | 白名单: {wl_count} 条")
        print()

        # L1 阻断层
        print("[L1 阻断层]")
        if report["findings"]["L1"]:
            for f in report["findings"]["L1"]:
                print(f"  ❌ [{f['patternId']}] {f['file']}: {f['match'][:50]}")
                print(f"     → {f['remediation']}")
        else:
            print("  ✅ 全部通过")
        print()

        # L2 警告层
        print("[L2 警告层]")
        if report["findings"]["L2"]:
            for f in report["findings"]["L2"]:
                print(f"  ⚠️  [{f['patternId']}] {f['file']}: {f['match'][:50]}")
                print(f"     → {f['remediation']}")
        else:
            print("  ✅ 全部通过")
        print()

        # L3 记录层 (静默，仅计数)
        print(f"[L3 记录层]")
        if report["findings"]["L3"]:
            print(f"  📊 {len(report['findings']['L3'])} 项记录已写入报告")
        else:
            print("  ✅ 无记录")
        print()

        # 判定
        if d["L1_blocked"]:
            print("❌ 提交被拦截 (L1阻断层发现严重威胁)")
        elif d["L2_warnings"] > 0:
            print(f"⚠️  放行 (L2有{d['L2_warnings']}个警告，请复查)")
        else:
            print("✅ 三层防线全部通过")

    # 退出码：critical级别阻断提交
    sys.exit(1 if report["summary"]["blocked"] else 0)


if __name__ == "__main__":
    main()
