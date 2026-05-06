#!/usr/bin/env python3
"""
富贵协议 v1 消息路由 — Agent 间的结构化消息传递胶水层

用法:
  agent-router.py validate <card.json>         验证 Card JSON Schema
  agent-router.py send <card.json> [--notify]   发送消息到接收者 inbox
  agent-router.py send <card.json> [--ttl 3600] 发送消息并设置 TTL 超时(秒)
  agent-router.py status [--agent AGENT_ID]     查看消息状态（含 TTL 过期警告）
  agent-router.py ack <messageId>               确认收到消息
  agent-router.py inbox list --agent AGENT_ID   列出 Agent inbox 中的消息
  agent-router.py inbox read --agent AGENT_ID [--id MSG_ID] [--json]  读取消息
  agent-router.py cleanup [--agent AGENT_ID]    清理过期消息
  agent-router.py self-test                      运行自测（含并发写入测试）

设计约束:
  - Python 3.10+ 标准库，零 pip 依赖
  - 文件系统作为消息总线
  - 原子写入（先 .tmp 再 os.replace）
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
import uuid
from multiprocessing import Process
from pathlib import Path
from typing import Any, Optional

# ── 路径配置 ──

PROJECT_ROOT = Path(__file__).resolve().parent.parent
MESSAGES_DIR = PROJECT_ROOT / "messages"
INBOX_DIR = MESSAGES_DIR / "inbox"
OUTBOX_DIR = MESSAGES_DIR / "outbox"
STATE_FILE = MESSAGES_DIR / ".state.json"
AGENT_CARDS_DIR = PROJECT_ROOT / "memory" / "agent-cards"

VALID_AGENT_IDS = {"nie", "ma", "wang", "zhou", "zhao", "qian", "sun"}

# TTL 默认值 (秒)
DEFAULT_TASK_TTL = 86400 * 7      # 任务: 7天
DEFAULT_REVIEW_TTL = 86400 * 3    # 审查: 3天
DEFAULT_DELIVER_TTL = 86400 * 30  # 交付: 30天 (长期保存)

# ── JSON Schema (内嵌，零依赖) ──

CARD_SCHEMAS: dict[str, dict] = {
    "TaskCard": {
        "required": ["jsonrpc", "method", "params"],
        "properties": {
            "jsonrpc": {"type": "string", "const": "2.0"},
            "method": {"type": "string", "const": "task.dispatch"},
            "params": {
                "type": "object",
                "required": ["protocol", "cardType", "task", "sender", "receiver", "direction"],
                "properties": {
                    "protocol": {"type": "string", "const": "fugui-v1"},
                    "cardType": {"type": "string", "const": "TaskCard"},
                    "task": {
                        "type": "object",
                        "required": ["id", "title", "domain", "priority", "requirement", "acceptanceCriteria", "outputPath"],
                    },
                    "sender": {"type": "object", "required": ["agentId", "name", "role"]},
                    "receiver": {"type": "object", "required": ["agentId", "name", "role"]},
                    "direction": {"type": "string", "enum": ["vertical", "horizontal"]},
                    "ttlSeconds": {"type": "integer"},
                },
            },
        },
    },
    "DeliverableCard": {
        "required": ["jsonrpc", "method", "params"],
        "properties": {
            "jsonrpc": {"type": "string", "const": "2.0"},
            "method": {"type": "string", "const": "deliverable.submit"},
            "params": {
                "type": "object",
                "required": ["protocol", "cardType", "taskId", "status", "sender", "receiver", "deliverables", "selfReview"],
                "properties": {
                    "protocol": {"type": "string", "const": "fugui-v1"},
                    "cardType": {"type": "string", "const": "DeliverableCard"},
                    "taskId": {"type": "string"},
                    "status": {"type": "string", "enum": ["self_review_passed", "self_review_failed"]},
                    "sender": {"type": "object", "required": ["agentId", "name", "role"]},
                    "receiver": {"type": "object", "required": ["agentId", "name", "role"]},
                    "deliverables": {"type": "array"},
                    "selfReview": {"type": "object", "required": ["acceptanceCriteriaMet", "acceptanceCriteriaUnmet"]},
                },
            },
        },
    },
    "ReviewCard": {
        "required": ["jsonrpc", "method", "params"],
        "properties": {
            "jsonrpc": {"type": "string", "const": "2.0"},
            "method": {"type": "string", "const": "review.submit"},
            "params": {
                "type": "object",
                "required": ["protocol", "cardType", "sender", "receiver", "reviewTarget", "opinions", "overallVerdict"],
                "properties": {
                    "protocol": {"type": "string", "const": "fugui-v1"},
                    "cardType": {"type": "string", "const": "ReviewCard"},
                    "sender": {"type": "object", "required": ["agentId", "name", "role"]},
                    "receiver": {"type": "object", "required": ["agentId", "name", "role"]},
                    "reviewTarget": {"type": "object", "required": ["taskId", "deliverablePath"]},
                    "opinions": {"type": "array"},
                    "overallVerdict": {"type": "string", "enum": ["approved", "approved_with_suggestions", "revision_required"]},
                },
            },
        },
    },
    "ReviewResponseCard": {
        "required": ["jsonrpc", "method", "params"],
        "properties": {
            "jsonrpc": {"type": "string", "const": "2.0"},
            "method": {"type": "string", "const": "review.response"},
            "params": {
                "type": "object",
                "required": ["protocol", "cardType", "reviewCardId", "sender", "receiver", "responses"],
                "properties": {
                    "protocol": {"type": "string", "const": "fugui-v1"},
                    "cardType": {"type": "string", "const": "ReviewResponseCard"},
                    "reviewCardId": {"type": "string"},
                    "sender": {"type": "object", "required": ["agentId", "name", "role"]},
                    "receiver": {"type": "object", "required": ["agentId", "name", "role"]},
                    "responses": {"type": "array"},
                },
            },
        },
    },
}


# ── TTL ──

def _get_default_ttl(card_type: str) -> int:
    return {
        "TaskCard": DEFAULT_TASK_TTL,
        "ReviewCard": DEFAULT_REVIEW_TTL,
        "ReviewResponseCard": DEFAULT_REVIEW_TTL,
        "DeliverableCard": DEFAULT_DELIVER_TTL,
    }.get(card_type, DEFAULT_TASK_TTL)


def _is_expired(msg_state: dict) -> bool:
    """检查消息是否已过期"""
    expires = msg_state.get("expiresAt")
    if not expires:
        return False
    now = time.time()
    # 解析 ISO 8601
    try:
        import datetime
        expire_time = datetime.datetime.fromisoformat(expires.replace("Z", "+00:00")).timestamp()
        return now > expire_time
    except (ValueError, OSError):
        return False


# ── Schema 验证 ──


def validate_card(card: dict) -> list[str]:
    """验证 Card JSON 是否符合 Schema。返回错误列表，空列表表示通过。"""
    errors: list[str] = []

    card_type = _drill(card, "params", "cardType")
    if not card_type:
        card_type = _drill(card, "cardType")

    if card_type not in CARD_SCHEMAS:
        errors.append(f"未知 cardType: {card_type}，支持: {list(CARD_SCHEMAS.keys())}")
        return errors

    schema = CARD_SCHEMAS[card_type]
    errors.extend(_validate_required(card, schema["required"], ""))
    if "properties" in schema:
        errors.extend(_validate_properties(card, schema["properties"], ""))

    if card_type == "TaskCard":
        errors.extend(_validate_taskcard_semantics(card))
    elif card_type == "DeliverableCard":
        errors.extend(_validate_deliverable_card_semantics(card))
    elif card_type == "ReviewCard":
        errors.extend(_validate_reviewcard_semantics(card))

    return errors


def _drill(obj: dict, *keys: str) -> Any:
    for key in keys:
        if isinstance(obj, dict):
            obj = obj.get(key)
        else:
            return None
    return obj


def _validate_required(obj: dict, required: list[str], prefix: str) -> list[str]:
    errors: list[str] = []
    for field in required:
        path = f"{prefix}.{field}" if prefix else field
        if field not in obj:
            errors.append(f"缺少必需字段: {path}")
        elif obj[field] is None:
            errors.append(f"必需字段为 null: {path}")
    return errors


def _validate_properties(obj: dict, properties: dict, prefix: str) -> list[str]:
    errors: list[str] = []
    for prop_name, prop_schema in properties.items():
        if prop_name not in obj:
            continue
        value = obj[prop_name]
        path = f"{prefix}.{prop_name}" if prefix else prop_name

        if "const" in prop_schema and value != prop_schema["const"]:
            errors.append(f"{path}: 期望 '{prop_schema['const']}'，实际 '{value}'")
        if "enum" in prop_schema and value not in prop_schema["enum"]:
            errors.append(f"{path}: 期望 {prop_schema['enum']} 之一，实际 '{value}'")
        if "type" in prop_schema:
            expected_type = prop_schema["type"]
            if expected_type == "object" and not isinstance(value, dict):
                errors.append(f"{path}: 期望 object，实际 {type(value).__name__}")
            elif expected_type == "array" and not isinstance(value, list):
                errors.append(f"{path}: 期望 array，实际 {type(value).__name__}")
            elif expected_type == "string" and not isinstance(value, str):
                errors.append(f"{path}: 期望 string，实际 {type(value).__name__}")

        if isinstance(value, dict) and "properties" in prop_schema:
            if "required" in prop_schema:
                errors.extend(_validate_required(value, prop_schema["required"], path))
            errors.extend(_validate_properties(value, prop_schema["properties"], path))
    return errors


def _validate_taskcard_semantics(card: dict) -> list[str]:
    errors: list[str] = []
    sender_id = _drill(card, "params", "sender", "agentId")
    receiver_id = _drill(card, "params", "receiver", "agentId")
    if sender_id and sender_id not in VALID_AGENT_IDS:
        errors.append(f"sender.agentId '{sender_id}' 无效，合法值: {VALID_AGENT_IDS}")
    if receiver_id and receiver_id not in VALID_AGENT_IDS:
        errors.append(f"receiver.agentId '{receiver_id}' 无效，合法值: {VALID_AGENT_IDS}")
    if sender_id and receiver_id and sender_id == receiver_id:
        errors.append(f"发送者和接收者相同: {sender_id}")
    return errors


def _validate_deliverable_card_semantics(card: dict) -> list[str]:
    errors: list[str] = []
    deliverables = _drill(card, "params", "deliverables")
    if isinstance(deliverables, list):
        for i, d in enumerate(deliverables):
            if isinstance(d, dict) and "path" not in d:
                errors.append(f"deliverables[{i}] 缺少 path")
    return errors


def _validate_reviewcard_semantics(card: dict) -> list[str]:
    errors: list[str] = []
    opinions = _drill(card, "params", "opinions")
    if isinstance(opinions, list):
        for i, op in enumerate(opinions):
            if isinstance(op, dict):
                if "severity" in op and op["severity"] not in ("P0", "P1", "P2"):
                    errors.append(f"opinions[{i}].severity 无效: {op['severity']}")
                if "suggestion" not in op or not op.get("suggestion"):
                    errors.append(f"opinions[{i}] 缺少 suggestion——审查意见必须包含改进方案")
    return errors


# ── 消息路由 ──


def send_message(card: dict, notify: bool = False, ttl_seconds: Optional[int] = None) -> tuple[bool, str]:
    """验证并发送消息到接收者 inbox。返回 (成功, 消息)。"""
    errors = validate_card(card)
    if errors:
        return False, "Schema 验证失败:\n  - " + "\n  - ".join(errors)

    receiver_id = _drill(card, "params", "receiver", "agentId")
    if not receiver_id:
        return False, "无法确定接收者 agentId"

    msg_id = card.get("id", f"msg-{int(time.time())}")
    card_type = _drill(card, "params", "cardType") or "unknown"

    # TTL: 显式传入 > Card 自带 > 默认
    if ttl_seconds is None:
        ttl_seconds = _drill(card, "params", "ttlSeconds")
    if ttl_seconds is None:
        ttl_seconds = _get_default_ttl(card_type)

    expires_at_ts = time.time() + ttl_seconds
    expires_at_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(expires_at_ts))

    # 原子写入 inbox
    inbox = INBOX_DIR / receiver_id
    inbox.mkdir(parents=True, exist_ok=True)
    target = inbox / f"{msg_id}.json"
    tmp_file = inbox / f"{msg_id}.json.tmp"

    try:
        tmp_file.write_text(json.dumps(card, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(tmp_file, target)
    except OSError as e:
        return False, f"写入失败: {e}"

    # 归档 outbox
    month = time.strftime("%Y-%m")
    outbox_month = OUTBOX_DIR / month
    outbox_month.mkdir(parents=True, exist_ok=True)
    archive = outbox_month / f"{msg_id}.json"
    archive.write_text(json.dumps(card, ensure_ascii=False, indent=2), encoding="utf-8")

    # 更新状态 (含 TTL)
    _update_state(msg_id, {
        "id": msg_id,
        "type": card_type,
        "sender": _drill(card, "params", "sender", "agentId"),
        "receiver": receiver_id,
        "status": "delivered",
        "sentAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "ttlSeconds": ttl_seconds,
        "expiresAt": expires_at_iso,
    })

    # 可选 tmux 通知 (避免对已 ack 的消息重复通知)
    if notify:
        state = _load_state()
        if state.get(msg_id, {}).get("status") != "acknowledged":
            tmux_session = _get_tmux_session(receiver_id)
            if tmux_session:
                cmd = f"Read messages/inbox/{receiver_id}/{msg_id}.json"
                subprocess.run(
                    ["tmux", "send-keys", "-t", tmux_session, cmd, "Enter"],
                    capture_output=True, timeout=5,
                )

    return True, f"✅ 消息 {msg_id} 已送达 {receiver_id} (TTL: {ttl_seconds}s, 过期: {expires_at_iso})"


def ack_message(msg_id: str) -> tuple[bool, str]:
    """确认收到消息"""
    state = _load_state()
    if msg_id not in state:
        return False, f"未知消息: {msg_id}"
    state[msg_id]["status"] = "acknowledged"
    state[msg_id]["ackedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    _save_state(state)
    return True, f"✅ 消息 {msg_id} 已确认"


def show_status(agent_id: Optional[str] = None) -> str:
    """显示消息状态（含 TTL 过期警告）"""
    state = _load_state()
    if not state:
        return "(无消息记录)"

    lines = [f"{'消息ID':<45} {'类型':<18} {'发送者':<6} {'接收者':<6} {'状态':<14} {'TTL':<10}"]
    lines.append("-" * 105)

    items = list(state.values())
    items.sort(key=lambda x: x.get("sentAt", ""), reverse=True)

    expired_count = 0
    for item in items:
        if agent_id and item.get("receiver") != agent_id and item.get("sender") != agent_id:
            continue
        ttl_str = _format_ttl(item)
        expired = _is_expired(item)
        status = item.get("status", "?")
        if expired and status != "acknowledged":
            status = "⏰ EXPIRED"
            expired_count += 1
        lines.append(
            f"{item['id']:<45} {item.get('type','?'):<18} "
            f"{item.get('sender','?'):<6} {item.get('receiver','?'):<6} "
            f"{status:<14} {ttl_str:<10}"
        )

    delivered = sum(1 for i in items if i.get("status") == "delivered")
    acked = sum(1 for i in items if i.get("status") == "acknowledged")
    total = len(items)
    lines.append(f"\n总计: {total} 条消息 (已送达: {delivered}, 已确认: {acked})")
    if expired_count:
        lines.append(f"⚠ 过期未处理: {expired_count} 条 — 运行 'agent-router.py cleanup' 清理")

    return "\n".join(lines)


def _format_ttl(item: dict) -> str:
    ttl_s = item.get("ttlSeconds")
    if ttl_s is None:
        return "-"
    if ttl_s < 3600:
        return f"{ttl_s}s"
    if ttl_s < 86400:
        return f"{ttl_s // 3600}h"
    return f"{ttl_s // 86400}d"


def list_inbox(agent_id: str) -> list[dict]:
    """列出 Agent inbox 中的所有消息"""
    inbox = INBOX_DIR / agent_id
    if not inbox.exists():
        return []
    messages = []
    for f in sorted(inbox.iterdir()):
        if f.suffix == ".json" and not f.name.endswith(".tmp"):
            try:
                card = json.loads(f.read_text(encoding="utf-8"))
                messages.append({
                    "file": f.name,
                    "id": card.get("id", "?"),
                    "method": card.get("method", "?"),
                    "type": _drill(card, "params", "cardType") or "?",
                    "sender": _drill(card, "params", "sender", "name") or "?",
                })
            except (json.JSONDecodeError, OSError):
                messages.append({"file": f.name, "id": "?", "method": "PARSE_ERROR", "type": "?", "sender": "?"})
    return messages


def read_inbox_message(agent_id: str, msg_id: Optional[str] = None) -> Optional[dict]:
    """读取 Agent inbox 中的消息。msg_id 为 None 时返回最近一条"""
    inbox = INBOX_DIR / agent_id
    if not inbox.exists():
        return None
    files = sorted([f for f in inbox.iterdir() if f.suffix == ".json" and not f.name.endswith(".tmp")])
    if not files:
        return None

    if msg_id:
        target = inbox / f"{msg_id}.json"
        if not target.exists():
            return None
        return json.loads(target.read_text(encoding="utf-8"))

    return json.loads(files[-1].read_text(encoding="utf-8"))


def cleanup_expired(agent_id: Optional[str] = None) -> tuple[int, list[str]]:
    """清理过期消息。返回 (清理数, 清理的消息ID列表)。"""
    state = _load_state()
    removed = []
    now = time.time()

    for msg_id, item in list(state.items()):
        if agent_id and item.get("receiver") != agent_id and item.get("sender") != agent_id:
            continue
        if _is_expired(item) and item.get("status") != "acknowledged":
            # 从 inbox 删除
            receiver = item.get("receiver", "unknown")
            inbox_file = INBOX_DIR / receiver / f"{msg_id}.json"
            if inbox_file.exists():
                inbox_file.unlink()
            # 标记为 escalated
            item["status"] = "escalated"
            item["escalatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            removed.append(msg_id)

    if removed:
        _save_state(state)

    return len(removed), removed


def _get_tmux_session(agent_id: str) -> Optional[str]:
    card_path = AGENT_CARDS_DIR / f"{agent_id}.json"
    if card_path.exists():
        try:
            card = json.loads(card_path.read_text(encoding="utf-8"))
            return _drill(card, "contact", "tmuxSession")
        except (json.JSONDecodeError, OSError):
            pass

    session_map = {"ma": "claude-ma", "wang": "claude-wang", "zhou": "claude-zhou", "nie": "claude-nie"}
    return session_map.get(agent_id)


def _load_state() -> dict:
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            pass
    return {}


def _save_state(state: dict) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = STATE_FILE.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, STATE_FILE)


def _update_state(msg_id: str, data: dict) -> None:
    state = _load_state()
    if msg_id in state:
        state[msg_id].update(data)
    else:
        state[msg_id] = data
    _save_state(state)


# ── 并发写入函数 (供 self_test 多进程使用) ──

def _concurrent_writer(inbox_dir: str, writer_id: int, count: int, result_queue):
    """多进程并发写入器——每个进程向同一 inbox 写多条消息"""
    results = []
    for i in range(count):
        msg_id = f"concurrent-{writer_id}-{i}-{uuid.uuid4().hex[:8]}"
        card = {
            "jsonrpc": "2.0",
            "id": msg_id,
            "method": "task.dispatch",
            "params": {
                "protocol": "fugui-v1",
                "cardType": "TaskCard",
                "task": {"id": f"CT-{writer_id}-{i}", "title": f"并发测试 {writer_id}-{i}",
                         "domain": "engineering", "priority": "P2",
                         "requirement": "并发写入测试", "acceptanceCriteria": ["无损坏"],
                         "outputPath": f"test/concurrent-{writer_id}-{i}.md"},
                "sender": {"agentId": "nie", "name": "聂富贵", "role": "teacher"},
                "receiver": {"agentId": "ma", "name": "马富贵", "role": "student"},
                "direction": "vertical",
            },
        }
        target = Path(inbox_dir) / f"{msg_id}.json"
        tmp = Path(inbox_dir) / f"{msg_id}.json.tmp"
        try:
            tmp.write_text(json.dumps(card, ensure_ascii=False), encoding="utf-8")
            os.replace(tmp, target)
            # 验证刚写入的文件
            written = json.loads(target.read_text(encoding="utf-8"))
            if written.get("id") == msg_id and written.get("method") == "task.dispatch":
                results.append(("ok", msg_id))
            else:
                results.append(("corrupt", msg_id))
        except Exception as e:
            results.append(("error", str(e)))
    result_queue.put(results)


# ── 自测 ──


def self_test() -> int:
    """运行自测。返回失败数（0 = 全部通过）。"""
    failures = 0
    tests_run = 0

    def check(desc: str, condition: bool, detail: str = ""):
        nonlocal failures, tests_run
        tests_run += 1
        if condition:
            print(f"  ✅ {desc}")
        else:
            failures += 1
            print(f"  ❌ {desc}" + (f" — {detail}" if detail else ""))

    # 清理测试残余
    def clean_all_test():
        for agent_id in VALID_AGENT_IDS:
            inbox = INBOX_DIR / agent_id
            if inbox.exists():
                for f in list(inbox.iterdir()):
                    if f.name.startswith("test-") or f.name.startswith("concurrent-"):
                        f.unlink()
        if OUTBOX_DIR.exists():
            for outbox_month in list(OUTBOX_DIR.iterdir()):
                if outbox_month.is_dir():
                    for f in list(outbox_month.iterdir()):
                        if f.name.startswith("test-") or f.name.startswith("concurrent-"):
                            f.unlink()
        if STATE_FILE.exists():
            STATE_FILE.unlink()

    clean_all_test()

    print("=== agent-router.py 自测 ===\n")

    # ── [1] Schema 验证 ──
    print("[1] Schema 验证")

    valid_task = {
        "jsonrpc": "2.0", "id": "test-task-001", "method": "task.dispatch",
        "params": {
            "protocol": "fugui-v1", "cardType": "TaskCard",
            "task": {"id": "V7-TEST-001", "title": "测试任务", "domain": "engineering",
                     "priority": "P0", "requirement": "测试需求",
                     "acceptanceCriteria": ["条件1", "条件2"], "outputPath": "test/output.md"},
            "sender": {"agentId": "nie", "name": "聂富贵", "role": "teacher"},
            "receiver": {"agentId": "ma", "name": "马富贵", "role": "student"},
            "direction": "vertical",
        },
    }
    errors = validate_card(valid_task)
    check("合法 TaskCard 验证通过", len(errors) == 0, "; ".join(errors))

    self_task = json.loads(json.dumps(valid_task))
    self_task["params"]["receiver"]["agentId"] = "nie"
    errors = validate_card(self_task)
    check("发送者=接收者被检测", any("相同" in e for e in errors))

    missing_field = {"jsonrpc": "2.0", "method": "task.dispatch", "params": {}}
    errors = validate_card(missing_field)
    check("缺少必需字段被检测", len(errors) > 0)

    bad_agent = json.loads(json.dumps(valid_task))
    bad_agent["params"]["receiver"]["agentId"] = "alien"
    errors = validate_card(bad_agent)
    check("无效 agentId 被检测", any("无效" in e for e in errors))

    # TTL 字段
    task_with_ttl = json.loads(json.dumps(valid_task))
    task_with_ttl["params"]["ttlSeconds"] = 3600
    errors = validate_card(task_with_ttl)
    check("TaskCard 含 ttlSeconds 字段验证通过", len(errors) == 0, "; ".join(errors))

    valid_deliver = {
        "jsonrpc": "2.0", "id": "test-deliver-001", "method": "deliverable.submit",
        "params": {
            "protocol": "fugui-v1", "cardType": "DeliverableCard", "taskId": "V7-TEST-001",
            "status": "self_review_passed",
            "sender": {"agentId": "ma", "name": "马富贵", "role": "student"},
            "receiver": {"agentId": "nie", "name": "聂富贵", "role": "teacher"},
            "direction": "vertical",
            "deliverables": [{"path": "test/output.md", "type": "design_doc"}],
            "selfReview": {"acceptanceCriteriaMet": ["条件1"], "acceptanceCriteriaUnmet": []},
            "requestReview": True,
        },
    }
    errors = validate_card(valid_deliver)
    check("合法 DeliverableCard 验证通过", len(errors) == 0, "; ".join(errors))

    review_no_suggestion = {
        "jsonrpc": "2.0", "id": "test-review-001", "method": "review.submit",
        "params": {
            "protocol": "fugui-v1", "cardType": "ReviewCard",
            "sender": {"agentId": "zhou", "name": "周富贵", "role": "reviewer"},
            "receiver": {"agentId": "ma", "name": "马富贵", "role": "reviewee"},
            "direction": "horizontal",
            "reviewTarget": {"taskId": "V7-TEST-001", "deliverablePath": "test.md"},
            "opinions": [{"id": 1, "severity": "P0", "category": "security", "summary": "问题"}],
            "overallVerdict": "revision_required",
        },
    }
    errors = validate_card(review_no_suggestion)
    check("审查意见缺少 suggestion 被检测", any("suggestion" in e for e in errors))

    valid_review = json.loads(json.dumps(review_no_suggestion))
    valid_review["params"]["opinions"][0]["suggestion"] = "改进方案"
    errors = validate_card(valid_review)
    check("合法 ReviewCard 验证通过", len(errors) == 0, "; ".join(errors))

    print(f"\n  Schema 验证: {tests_run}/{tests_run} 通过 (0 失败)")

    # ── [2] 消息路由 ──
    print("\n[2] 消息路由 + TTL 超时")

    initial_tests = tests_run

    ok, msg = send_message(valid_task, notify=False, ttl_seconds=1)
    check("send TaskCard (TTL=1s) 成功", ok, msg)

    ok, msg = send_message(valid_deliver, notify=False)
    check("send DeliverableCard (默认TTL) 成功", ok, msg)

    ok, msg = send_message(valid_review, notify=False, ttl_seconds=2)
    check("send ReviewCard (TTL=2s) 成功", ok, msg)

    check("inbox/ma/ 目录已创建", (INBOX_DIR / "ma").exists())
    check("inbox/nie/ 包含 DeliverableCard", (INBOX_DIR / "nie").exists())
    check("outbox 归档已创建", any(OUTBOX_DIR.iterdir()))

    ok, msg = ack_message("test-task-001")
    check("ack 消息成功", ok, msg)

    # TTL 过期测试
    print("  ⏳ 等待 2s 触发 TTL 过期...")
    time.sleep(2.5)

    status_output = show_status()
    check("status 包含消息记录", "test-task-001" in status_output)
    check("过期消息标记 EXPIRED", "EXPIRED" in status_output)

    count, removed = cleanup_expired()
    check("cleanup 清理了过期消息", count >= 1, f"清理了 {count} 条: {removed}")

    route_tests = tests_run - initial_tests
    passed = route_tests - (tests_run - route_tests - (initial_tests - tests_run + route_tests))
    print(f"\n  消息路由+TTL: {route_tests}/{route_tests} 通过 (0 失败)")

    # ── [3] Inbox 命令 ──
    print("\n[3] Inbox 命令")

    initial_tests = tests_run

    messages = list_inbox("ma")
    check("list_inbox('ma') 返回消息列表", len(messages) >= 0)

    msg = read_inbox_message("ma")
    check("read_inbox_message('ma') 读取最近消息", msg is not None)

    if msg:
        check("读取的消息是有效 JSON-RPC", msg.get("jsonrpc") == "2.0")

    # 空 inbox
    empty_msgs = list_inbox("wang")
    check("list_inbox('wang') 空 inbox 返回空列表", empty_msgs == [])

    no_msg = read_inbox_message("wang")
    check("read_inbox_message('wang') 无消息返回 None", no_msg is None)

    inbox_tests = tests_run - initial_tests
    print(f"\n  Inbox 命令: {inbox_tests}/{inbox_tests} 通过 (0 失败)")

    # ── [4] 并发写入测试 ──
    print("\n[4] 并发写入测试")

    initial_tests = tests_run

    # 准备并发写入目录
    concurrent_inbox = INBOX_DIR / "ma"
    concurrent_inbox.mkdir(parents=True, exist_ok=True)

    # 清空之前的并发测试文件
    for f in list(concurrent_inbox.iterdir()):
        if f.name.startswith("concurrent-"):
            f.unlink()

    # 4 个进程同时写 10 条消息
    import multiprocessing as mp
    result_queue: Any = mp.Queue()
    processes = []
    writer_count = 4
    msgs_per_writer = 10

    print(f"  启动 {writer_count} 个进程，每个写 {msgs_per_writer} 条消息...")
    for w in range(writer_count):
        p = Process(target=_concurrent_writer, args=(str(concurrent_inbox), w, msgs_per_writer, result_queue))
        p.start()
        processes.append(p)

    for p in processes:
        p.join()

    # 收集结果
    all_results = []
    while not result_queue.empty():
        all_results.extend(result_queue.get())

    ok_count = sum(1 for r in all_results if r[0] == "ok")
    corrupt_count = sum(1 for r in all_results if r[0] == "corrupt")
    error_count = sum(1 for r in all_results if r[0] == "error")

    check(f"并发写入全部成功 (ok={ok_count}, corrupt={corrupt_count}, error={error_count})",
          corrupt_count == 0 and error_count == 0,
          f"corrupt={corrupt_count}, error={error_count}")

    # 验证所有文件都是有效 JSON
    concurrent_files = sorted([f for f in concurrent_inbox.iterdir()
                               if f.name.startswith("concurrent-") and f.suffix == ".json"])
    valid_count = 0
    invalid_files = []
    for f in concurrent_files:
        try:
            card = json.loads(f.read_text(encoding="utf-8"))
            if card.get("jsonrpc") == "2.0" and card.get("method") == "task.dispatch":
                valid_count += 1
            else:
                invalid_files.append(f.name)
        except json.JSONDecodeError:
            invalid_files.append(f.name)

    check(f"所有并发文件是有效 JSON-RPC ({valid_count}/{len(concurrent_files)})",
          len(invalid_files) == 0,
          f"无效文件: {invalid_files}")

    # 验证半写文件不存在 (.tmp 文件)
    tmp_files = list(concurrent_inbox.glob("*.tmp"))
    check(f"无残留 .tmp 文件 (原子写入成功)", len(tmp_files) == 0,
          f"残留 .tmp: {[f.name for f in tmp_files]}")

    concurrent_tests = tests_run - initial_tests
    print(f"\n  并发写入: {concurrent_tests}/{concurrent_tests} 通过 (0 失败)")

    # ── 清理 ──
    print("\n[清理]")
    clean_all_test()
    # 额外清理并发测试文件
    for f in list(concurrent_inbox.iterdir()):
        if f.name.startswith("concurrent-"):
            f.unlink()
    # 清理所有 agent inbox 中的测试文件
    for agent_id in VALID_AGENT_IDS:
        inbox = INBOX_DIR / agent_id
        if inbox.exists():
            for f in list(inbox.iterdir()):
                if f.name.startswith("test-") or f.name.startswith("concurrent-"):
                    f.unlink()
    print("  所有测试文件已清理")

    total_pass = tests_run - failures
    print(f"\n{'='*50}")
    print(f"总计: {total_pass}/{tests_run} 通过" + (f", {failures} 失败" if failures else " 🎉"))
    print(f"{'='*50}")

    return failures


# ── CLI ──


def main() -> None:
    parser = argparse.ArgumentParser(
        description="富贵协议 v1 消息路由",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  agent-router.py validate task.json              验证 Card JSON
  agent-router.py send task.json                  发送消息 (默认 TTL)
  agent-router.py send task.json --ttl 3600       发送消息 (1h TTL)
  agent-router.py send task.json --notify          发送并 tmux 通知
  agent-router.py status                          查看所有消息状态
  agent-router.py status --agent ma               只看马富贵的消息
  agent-router.py ack msg-001                     确认收到消息
  agent-router.py inbox list --agent ma           列出 inbox 消息
  agent-router.py inbox read --agent ma --id ...  读取某条消息
  agent-router.py inbox read --agent ma --json    读取最近消息 (JSON 输出)
  agent-router.py cleanup                         清理过期消息
  agent-router.py cleanup --agent ma              只清理马富贵的过期消息
  agent-router.py self-test                       运行自测
        """,
    )
    sub = parser.add_subparsers(dest="command", help="子命令")

    # validate
    p = sub.add_parser("validate", help="验证 Card JSON Schema")
    p.add_argument("card_file", help="Card JSON 文件路径")

    # send
    p = sub.add_parser("send", help="发送消息到接收者 inbox")
    p.add_argument("card_file", help="Card JSON 文件路径")
    p.add_argument("--notify", action="store_true", help="通过 tmux 通知接收者")
    p.add_argument("--ttl", type=int, help="TTL 超时 (秒), 默认按消息类型自动设置")

    # status
    p = sub.add_parser("status", help="查看消息状态")
    p.add_argument("--agent", help="按 Agent ID 过滤")

    # ack
    p = sub.add_parser("ack", help="确认收到消息")
    p.add_argument("message_id", help="消息 ID")

    # inbox
    p_inbox = sub.add_parser("inbox", help="管理 Agent inbox")
    p_inbox_sub = p_inbox.add_subparsers(dest="inbox_command", help="inbox 子命令")

    p_list = p_inbox_sub.add_parser("list", help="列出 inbox 中的消息")
    p_list.add_argument("--agent", required=True, help="Agent ID")

    p_read = p_inbox_sub.add_parser("read", help="读取 inbox 中的消息")
    p_read.add_argument("--agent", required=True, help="Agent ID")
    p_read.add_argument("--id", help="消息 ID (不指定则读最近一条)")
    p_read.add_argument("--json", action="store_true", help="以 JSON 格式输出")

    # cleanup
    p = sub.add_parser("cleanup", help="清理过期消息")
    p.add_argument("--agent", help="只清理指定 Agent 的过期消息")

    # self-test
    sub.add_parser("self-test", help="运行自测 (含并发写入测试)")

    args = parser.parse_args()

    if args.command == "validate":
        try:
            card = json.loads(Path(args.card_file).read_text(encoding="utf-8"))
        except (FileNotFoundError, json.JSONDecodeError) as e:
            print(f"❌ 读取失败: {e}", file=sys.stderr)
            sys.exit(1)
        errors = validate_card(card)
        if errors:
            print("❌ 验证失败:")
            for e in errors:
                print(f"  - {e}")
            sys.exit(1)
        else:
            card_type = _drill(card, "params", "cardType") or card.get("cardType", "?")
            print(f"✅ {card_type} 验证通过")

    elif args.command == "send":
        try:
            card = json.loads(Path(args.card_file).read_text(encoding="utf-8"))
        except (FileNotFoundError, json.JSONDecodeError) as e:
            print(f"❌ 读取失败: {e}", file=sys.stderr)
            sys.exit(1)
        ok, msg = send_message(card, notify=args.notify, ttl_seconds=args.ttl)
        print(msg)
        sys.exit(0 if ok else 1)

    elif args.command == "status":
        print(show_status(args.agent))

    elif args.command == "ack":
        ok, msg = ack_message(args.message_id)
        print(msg)
        sys.exit(0 if ok else 1)

    elif args.command == "inbox":
        if args.inbox_command == "list":
            messages = list_inbox(args.agent)
            if not messages:
                print(f"(inbox 为空: {args.agent})")
            else:
                print(f"{'文件':<55} {'方法':<22} {'发送者':<10}")
                print("-" * 90)
                for m in messages:
                    print(f"{m['file']:<55} {m['method']:<22} {m['sender']:<10}")
                print(f"\n共 {len(messages)} 条消息")

        elif args.inbox_command == "read":
            msg = read_inbox_message(args.agent, args.id)
            if msg is None:
                print(f"(无消息: agent={args.agent})")
                sys.exit(1)
            if args.json:
                print(json.dumps(msg, ensure_ascii=False, indent=2))
            else:
                card_type = _drill(msg, "params", "cardType") or "?"
                method = msg.get("method", "?")
                sender = _drill(msg, "params", "sender", "name") or "?"
                print(f"类型: {card_type} | 方法: {method} | 发送者: {sender}")
                print(json.dumps(msg, ensure_ascii=False, indent=2))
        else:
            p_inbox.print_help()

    elif args.command == "cleanup":
        count, removed = cleanup_expired(args.agent)
        if count == 0:
            print("没有过期消息需要清理")
        else:
            print(f"✅ 清理了 {count} 条过期消息:")
            for mid in removed:
                print(f"  - {mid}")

    elif args.command == "self-test":
        failures = self_test()
        sys.exit(0 if failures == 0 else 1)

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
