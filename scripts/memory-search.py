#!/usr/bin/env python3
"""记忆检索 — 搜索 knowledge-graph.json + decisions.md + capability-inventory.json"""

import json
import sys
import argparse
import re
from datetime import datetime
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parent.parent
MEMORY_DIR = PROJECT_DIR / "memory"


def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def search_graph(keyword, domain=None):
    """搜索知识图谱：匹配节点+关联边"""
    kg = load_json(MEMORY_DIR / "knowledge-graph.json")
    nodes = kg.get("nodes", [])
    edges = kg.get("edges", [])

    matching_nodes = []
    for n in nodes:
        text = json.dumps(n, ensure_ascii=False).lower()
        if keyword.lower() in text:
            if domain and n.get("domain") != domain:
                continue
            matching_nodes.append(n)

    matching_ids = {n["id"] for n in matching_nodes}
    matching_edges = [e for e in edges if e["from"] in matching_ids or e["to"] in matching_ids]

    return matching_nodes, matching_edges


def search_decisions(keyword, since=None):
    """搜索 decisions.md：按关键词匹配决策条目"""
    path = MEMORY_DIR / "decisions.md"
    if not path.exists():
        return []

    content = path.read_text(encoding="utf-8")
    results = []

    # 解析决策块：### Dxxx 开头的条目
    pattern = re.compile(r"(### D\d+[^\n]*\n(?:[-*] \*\*[^*]+\*\*[^\n]*\n?)*)", re.MULTILINE)
    for match in pattern.finditer(content):
        block = match.group(1)
        if keyword.lower() in block.lower():
            # 时间筛选：从块中提取日期
            if since:
                date_match = re.search(r"(\d{4}-\d{2}-\d{2})", block)
                if date_match and date_match.group(1) < since:
                    continue
            results.append(block.strip())

    return results


def search_capabilities(keyword, domain=None):
    """搜索 capability-inventory.json：按关键词+领域匹配能力项"""
    path = MEMORY_DIR / "capability-inventory.json"
    if not path.exists():
        return []

    inv = load_json(path)
    results = []

    for dom_key, dom_data in inv.get("domains", {}).items():
        if domain and dom_key != domain:
            continue
        for cap in dom_data.get("capabilities", []):
            text = json.dumps(cap, ensure_ascii=False).lower()
            if keyword.lower() in text:
                results.append({"domain_name": dom_data["name"], "domain_key": dom_key, "cap": cap})

    return results


def format_output(keyword, nodes, edges, decisions, capabilities, max_lines=20):
    """格式化输出摘要，控制在max_lines行以内"""
    lines = []
    lines.append(f"=== 记忆检索: '{keyword}' ===")

    # 知识图谱节点
    if nodes:
        lines.append(f"\n── 知识图谱节点 ({len(nodes)}个) ──")
        for n in nodes[:5]:
            ntype = n.get("type", "")
            dom = n.get("domain", "")
            lines.append(f"  [{ntype}][{dom}] {n['label']} — {n.get('description','')[:60]}")

    # 知识图谱边
    if edges:
        lines.append(f"\n── 关联边 ({len(edges)}条) ──")
        for e in edges[:5]:
            lines.append(f"  {e['from']} --[{e['relation']}]--> {e['to']}")

    # 决策
    if decisions:
        lines.append(f"\n── 相关决策 ({len(decisions)}条) ──")
        for d in decisions[:3]:
            first_line = d.split("\n")[0][:80]
            lines.append(f"  {first_line}")

    # 能力清单
    if capabilities:
        lines.append(f"\n── 相关能力 ({len(capabilities)}项) ──")
        for c in capabilities[:4]:
            cap = c["cap"]
            lines.append(f"  [{c['domain_name']}] {cap['name']} (L{cap.get('level','?')[1:]}) — {cap.get('proficiency','')[:50]}")

    # 截断到max_lines (截断消息也计入行数)
    total_matches = len(nodes) + len(decisions) + len(capabilities)
    import sys as _sys; print(f"DEBUG_TRUNC: lines={len(lines)} max_lines={max_lines} trigger={len(lines) > max_lines}", file=_sys.stderr)
    if len(lines) > max_lines:
        trunc_msg = f"  ... (截断，总计{total_matches}条匹配)"
        lines = lines[:max_lines - 1]
        lines.append(trunc_msg)

    if not nodes and not decisions and not capabilities:
        lines.append(f"\n  未找到与 '{keyword}' 相关的记忆。")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="多源记忆检索")
    parser.add_argument("keyword", help="搜索关键词")
    parser.add_argument("--domain", "-d", help="按领域筛选 (memory/methodology/engineering/security/product/architecture)")
    parser.add_argument("--since", "-s", help="按时间筛选，格式YYYY-MM-DD (仅对decisions有效)")
    parser.add_argument("--max-lines", "-m", type=int, default=20, help="最大输出行数 (默认20)")
    args = parser.parse_args()

    nodes, edges = search_graph(args.keyword, args.domain)
    decisions = search_decisions(args.keyword, args.since)
    capabilities = search_capabilities(args.keyword, args.domain)

    output = format_output(args.keyword, nodes, edges, decisions, capabilities, args.max_lines)
    print(output)


if __name__ == "__main__":
    main()
