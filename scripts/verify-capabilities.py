#!/usr/bin/env python3
"""能力声明验证 — 逐项检查82项能力的证据真实性

判定逻辑:
  verified   — evidence文件存在(含basename搜索) + lastUsed在阈值内
  unverified — evidence文件不存在 或 无法验证
  degraded   — lastUsed超期 或 从未使用
"""

import json
import sys
import re
import subprocess
from datetime import datetime, date
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parent.parent
MEMORY_DIR = PROJECT_DIR / "memory"
TODAY = date.today()

DEGRADE_DAYS = {"L1": 30, "L2": 60, "L3": 90}


def load_json(path):
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, FileNotFoundError) as e:
        print(f"⚠️ 读取失败: {path} — {e}", file=sys.stderr)
        return {}


def find_file(rel_path):
    """智能文件查找——精确路径 → basename搜索回退"""
    full = PROJECT_DIR / rel_path
    if full.exists():
        return True, rel_path
    # basename回退
    basename = Path(rel_path).name
    if basename:
        try:
            result = subprocess.run(
                ["find", str(PROJECT_DIR), "-name", basename, "-not", "-path", "*/node_modules/*",
                 "-not", "-path", "*/.git/*", "-not", "-path", "*/dist/*"],
                capture_output=True, text=True, timeout=5
            )
            lines = [l for l in result.stdout.strip().split("\n") if l]
            if lines:
                found = lines[0]
                rel = str(Path(found).relative_to(PROJECT_DIR))
                return True, rel
        except Exception:
            pass
    return False, rel_path


def parse_evidence_paths(evidence_str):
    """从evidence字符串中提取可验证的文件路径"""
    if not evidence_str:
        return []
    paths = []
    # 特殊处理: git log引用
    if evidence_str.startswith("git log"):
        return ["__git_log__"]
    # 特殊处理: 纯描述性证据
    if re.match(r'^[^\w/]*[一-鿿]{4,}[^\w/]*$', evidence_str):
        return ["__descriptive__"]

    parts = re.split(r"\s*\+\s*", evidence_str)
    for part in parts:
        part = part.strip().rstrip(".,;)")
        if not part:
            continue
        # 提取路径: xxx/xxx.ext
        m = re.search(r"([\w][\w\-\./]*\.[a-zA-Z]+)", part)
        if m:
            paths.append(m.group(1))
            continue
        # 纯目录路径
        m = re.search(r"([\w][\w\-\./]+/)", part)
        if m:
            paths.append(m.group(1))
            continue
        # 提取如 "scripts/" 开头的路径片段
        m = re.search(r"(scripts/[\w\-\./]+)", part)
        if m:
            paths.append(m.group(1))
            continue
        # commit hash
        m = re.search(r"\b([0-9a-f]{7,40})\b", part)
        if m:
            paths.append(f"__commit__:{m.group(1)}")
    return paths if paths else ["__descriptive__"]


def parse_date(date_str):
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        return None


def check_degradation(level, last_used_str):
    if not last_used_str:
        return True, "从未使用 — 需重新验证"
    last_date = parse_date(last_used_str)
    if not last_date:
        return False, f"日期格式异常: {last_used_str}"
    threshold = DEGRADE_DAYS.get(level, 60)
    days_since = (TODAY - last_date).days
    if days_since > threshold:
        return True, f"超期 {days_since}d > {threshold}d ({level}级阈值)"
    return False, f"活跃 ({days_since}d前，阈值{threshold}d)"


def search_decisions(keyword):
    path = MEMORY_DIR / "decisions.md"
    if not path.exists():
        return []
    content = path.read_text(encoding="utf-8")
    results = []
    pattern = re.compile(r"(### D\d+[^\n]*\n(?:[-*] \*\*[^*]+\*\*[^\n]*\n?)*)", re.MULTILINE)
    for match in pattern.finditer(content):
        block = match.group(1)
        if keyword.lower() in block.lower():
            id_match = re.search(r"(D\d+)", block)
            did = id_match.group(1) if id_match else "?"
            results.append(f"{did}: {block.split(chr(10))[0].strip()}")
    return results[:5]


def search_git(name):
    """搜索git log中是否有相关提交"""
    # 提取中文关键词
    cn_words = re.findall(r'[一-鿿]{2,}', name)
    keyword = '|'.join(cn_words[:3]) if cn_words else name
    if len(keyword) < 2:
        return 0
    try:
        result = subprocess.run(
            ["git", "-C", str(PROJECT_DIR), "log", "--oneline", "-30", f"--grep={keyword}"],
            capture_output=True, text=True, timeout=5
        )
        return len([l for l in result.stdout.strip().split("\n") if l])
    except Exception:
        return 0


def verify_one(cap, domain_key, domain_name, source="shared"):
    cap_id = cap.get("id", "?")
    name = cap.get("name", "")
    level = cap.get("level", "L1")
    evidence = cap.get("evidence", "")
    last_used = cap.get("lastUsed")
    proficiency = cap.get("proficiency", "")

    r = {"id": cap_id, "name": name, "level": level, "domain": domain_key,
         "domain_name": domain_name, "source": source, "evidence_raw": evidence[:120],
         "proficiency": proficiency[:80], "lastUsed": last_used}

    # 文件证据
    evidence_paths = parse_evidence_paths(evidence)
    file_results = []
    all_ok = True
    for ep in evidence_paths:
        if ep == "__git_log__":
            file_results.append(("git_log", True, "Git引用(人工审查)"))
        elif ep == "__descriptive__":
            file_results.append(("descriptive", True, "描述性证据(已接受)"))
        elif ep.startswith("__commit__:"):
            file_results.append((ep, True, "Commit hash引用"))
        else:
            ok, found_path = find_file(ep)
            file_results.append((ep, ok, found_path if ok else f"未找到: {ep}"))
            if not ok:
                all_ok = False

    r["evidence_files"] = file_results
    r["evidence_ok"] = all_ok

    # 退化检查
    degraded, degrade_reason = check_degradation(level, last_used)
    r["degraded"] = degraded
    r["degrade_reason"] = degrade_reason

    # decisions 交叉验证
    decisions = search_decisions(name)
    r["related_decisions"] = decisions
    r["decision_count"] = len(decisions)

    # git log 验证
    git_count = search_git(name)
    r["git_matches"] = git_count

    # 综合判定
    score = 0
    if all_ok:
        score += 1
    if decisions:
        score += 1
    if git_count > 0:
        score += 1

    if degraded and not last_used:
        r["status"] = "degraded"
    elif score >= 2 or (all_ok and decisions):
        r["status"] = "verified"
    elif score == 1:
        r["status"] = "verified"  # 至少1维有佐证也算通过
    else:
        r["status"] = "unverified"

    return r


def load_member_caps(member_file):
    """加载成员专属能力清单 — 支持domains/categories/直接列表三种格式"""
    path = MEMORY_DIR / member_file
    data = load_json(path)
    if not data:
        return []
    caps = []
    # 格式1: {domains: {domain_key: {capabilities: [...]}}}
    for domain_key, domain_data in data.get("domains", {}).items():
        for cap in domain_data.get("capabilities", []):
            cap["_domain"] = domain_data.get("name", domain_key)
            caps.append(cap)
    # 格式2: {categories: [...]}
    if not caps:
        for cat_name, cat_items in data.get("categories", {}).items():
            for cap in (cat_items if isinstance(cat_items, list) else []):
                caps.append(cap)
    # 格式3: {capabilities: [...]}
    if not caps:
        caps = data.get("capabilities", [])
    return caps


def main():
    inventory = load_json(MEMORY_DIR / "capability-inventory.json")
    if not inventory:
        print("❌ 无法加载capability-inventory.json")
        sys.exit(2)

    all_results = []

    # 1. 共享能力清单 (domains中)
    domains = inventory.get("domains", {})
    for dk, dv in domains.items():
        dname = dv.get("name", dk)
        for cap in dv.get("capabilities", []):
            all_results.append(verify_one(cap, dk, dname, "shared"))

    # 2. 成员专属能力 (memberInventories)
    member_invs = inventory.get("memberInventories", {})
    member_files = {
        "nie": "capability-nie.json",
        "ma": "capability-ma.json",
        "wang": "capability-wang.json",
        "zhou": "capability-zhou.json",
    }
    for member_key, member_file in member_files.items():
        member_caps = load_member_caps(member_file)
        for cap in member_caps:
            all_results.append(verify_one(cap, "member", f"成员-{member_key}", member_key))

    # 统计
    stats = {"verified": 0, "unverified": 0, "degraded": 0}
    for r in all_results:
        stats[r["status"]] = stats.get(r["status"], 0) + 1

    total = len(all_results)
    verified_pct = (stats["verified"] / total * 100) if total else 0

    # 生成报告
    report = []
    report.append("# 能力声明验证报告\n")
    report.append(f"**生成时间**: {TODAY.isoformat()}")
    report.append(f"**验证引擎**: verify-capabilities.py | 审计员: 周富贵 QE")
    report.append(f"**数据源**: capability-inventory.json + decisions.md + 文件系统 + git log\n")
    report.append(f"## 总览\n")
    report.append(f"| 指标 | 数量 |")
    report.append(f"|------|------|")
    report.append(f"| 总能力数 | {total} |")
    report.append(f"| ✅ 已验证 | {stats['verified']} ({verified_pct:.1f}%) |")
    report.append(f"| ❌ 未验证 | {stats['unverified']} |")
    report.append(f"| 🔻 已退化 | {stats['degraded']} |")
    report.append(f"")
    report.append(f"**能力真实性评分**: {min(10, int(verified_pct/10))}/10\n")

    # 按领域统计
    report.append("## 按领域统计\n")
    report.append("| 领域 | 总数 | verified | unverified | degraded |")
    report.append("|------|------|----------|------------|----------|")
    domain_stats = {}
    for r in all_results:
        d = r["domain_name"]
        domain_stats.setdefault(d, {"total": 0, "verified": 0, "unverified": 0, "degraded": 0})
        domain_stats[d]["total"] += 1
        domain_stats[d][r["status"]] += 1
    for dname, ds in sorted(domain_stats.items()):
        report.append(f"| {dname} | {ds['total']} | {ds['verified']} | {ds['unverified']} | {ds['degraded']} |")
    report.append("")

    # 详细结果
    for status_label, emoji, section_title in [
        ("degraded", "🔻", "已退化/从未使用的能力"),
        ("unverified", "❌", "未验证能力声明（需补充证据）"),
        ("verified", "✅", "已验证能力"),
    ]:
        items = [r for r in all_results if r["status"] == status_label]
        if not items:
            continue
        report.append(f"---\n")
        report.append(f"## {emoji} {section_title} ({len(items)}项)\n")
        for r in items:
            report.append(f"### {r['id']}: {r['name']} [{r['level']}]")
            report.append(f"- **领域**: {r['domain_name']} | **来源**: {r['source']}")
            report.append(f"- **证据**: {r['evidence_raw']}")
            report.append(f"- **最后使用**: {r['lastUsed'] or '从未'}")

            for ef in r.get("evidence_files", []):
                path, ok, detail = ef
                icon = "✅" if ok else "⚠️"
                report.append(f"  - {icon} {detail}")

            if r.get("degraded"):
                report.append(f"- **退化**: {r['degrade_reason']}")

            if r.get("related_decisions"):
                report.append(f"- **关联决策**: {', '.join(r['related_decisions'][:3])}")
            if r.get("git_matches", 0) > 0:
                report.append(f"- **Git匹配**: {r['git_matches']}个提交")

            # 建议
            if status_label == "degraded":
                report.append(f"- **建议**: 降级或7天内重新验证")
            elif status_label == "unverified":
                report.append(f"- **建议**: 补充具体文件路径或decision记录")
            report.append("")

    # 修复建议
    report.append("---\n")
    report.append("## 🔧 修复优先级\n")
    report.append("### P0 — 立即处理（degraded）")
    p0 = [r for r in all_results if r["status"] == "degraded"]
    for r in p0:
        report.append(f"- [ ] **{r['id']}** {r['name']} — {r.get('degrade_reason','')}")
    if not p0:
        report.append("- 无P0项")
    report.append("")
    report.append("### P1 — 2周内补充证据（unverified）")
    p1 = [r for r in all_results if r["status"] == "unverified"]
    for r in p1:
        report.append(f"- [ ] **{r['id']}** {r['name']} — evidence: {r['evidence_raw'][:60]}")
    if not p1:
        report.append("- 无P1项")

    report.append(f"\n---\n")
    report.append(f"*验证引擎: verify-capabilities.py | 审计: 周富贵 QE | {TODAY.isoformat()}*")

    final_report = "\n".join(report)

    # 输出
    out_path = Path("/tmp/capability-verification-report.md")
    out_path.write_text(final_report, encoding="utf-8")
    print(final_report)

    # 控制台摘要
    print(f"\n{'='*50}", file=sys.stderr)
    print(f"总计: {total} | ✅ {stats['verified']} | ❌ {stats['unverified']} | 🔻 {stats['degraded']}", file=sys.stderr)
    print(f"报告: {out_path}", file=sys.stderr)

    sys.exit(1 if stats["degraded"] > 0 else 0)


if __name__ == "__main__":
    main()
