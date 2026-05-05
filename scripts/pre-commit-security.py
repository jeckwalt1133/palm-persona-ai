#!/usr/bin/env python3
"""pre-commit 安全扫描引擎 V3 — 三层防线(L1阻断/L2警告/L3记录) + JSON报告

用法: python3 scripts/pre-commit-security.py [--json] [--test] [--layer L1|L2|L3|all]
      --json   输出JSON到stdout
      --test   运行自检测试用例
      --layer  仅扫描指定层级 (默认all)

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
        "pattern": r'github_pat_[a-zA-Z0-9_]{36,}',
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
    return False


def scan_diff(file_path, diff_content):
    """扫描单个文件的diff，返回发现的密钥列表"""
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
    # 跳过二进制和依赖
    skip_exts = {".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".woff", ".woff2", ".ttf", ".lock", ".sum"}
    skip_dirs = {"node_modules", "dist", ".next", ".git"}
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
            findings = scan_diff(f, diff)
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
        'const slackToken = "xox" + "b-123456789012-1234567890123-abcdefghijklmnopqrstuvwx";',
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
    parser = argparse.ArgumentParser(description="pre-commit 安全扫描引擎")
    parser.add_argument("--json", action="store_true", help="输出JSON格式报告")
    parser.add_argument("--test", action="store_true", help="运行自检测试用例")
    args = parser.parse_args()

    if args.test:
        ok = run_tests()
        sys.exit(0 if ok else 1)

    report = run_scan()

    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        s = report["summary"]
        d = report["defense"]
        print("🔒 安全门禁 V3 (三层防线)")
        print(f"  扫描文件: {s['filesScanned']} | 跳过: {s['filesSkipped']}")
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
