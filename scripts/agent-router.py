#!/usr/bin/env python3
"""
富贵协议 v1 消息路由 — Agent 间的结构化消息传递胶水层

用法:
  agent-router.py validate <card.json>       验证 Card JSON Schema
  agent-router.py send <card.json> [--notify] 发送消息到接收者 inbox
  agent-router.py status [--agent AGENT_ID]   查看消息状态
  agent-router.py ack <messageId>             确认收到消息
  agent-router.py self-test                   运行自测

设计约束:
  - Python 3.10+ 标准库，零 pip 依赖
  - 文件系统作为消息总线
  - 原子写入（先 .tmp 再 os.replace）
"""

import argparse
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Optional

# ── 路径配置 ──

PROJECT_ROOT = Path(__file__).resolve().parent.parent
MESSAGES_DIR = PROJECT_ROOT / "messages"
INBOX_DIR = MESSAGES_DIR / "inbox"
OUTBOX_DIR = MESSAGES_DIR / "outbox"
STATE_FILE = MESSAGES_DIR / ".state.json"
AGENT_CARDS_DIR = PROJECT_ROOT / "memory" / "agent-cards"

VALID_AGENT_IDS = {"nie", "ma", "wang", "zhou"}

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
                    "sender": {
                        "type": "object",
                        "required": ["agentId", "name", "role"],
                    },
                    "receiver": {
                        "type": "object",
                        "required": ["agentId", "name", "role"],
                    },
                    "direction": {"type": "string", "enum": ["vertical", "horizontal"]},
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

    # 额外语义验证
    if card_type == "TaskCard":
        errors.extend(_validate_taskcard_semantics(card))
    elif card_type == "DeliverableCard":
        errors.extend(_validate_deliverable_card_semantics(card))
    elif card_type == "ReviewCard":
        errors.extend(_validate_reviewcard_semantics(card))

    return errors


def _drill(obj: dict, *keys: str) -> Any:
    """深层取值，任一层缺失返回 None"""
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
    direction = _drill(card, "params", "direction")

    if sender_id and sender_id not in VALID_AGENT_IDS:
        errors.append(f"sender.agentId '{sender_id}' 无效，合法值: {VALID_AGENT_IDS}")
    if receiver_id and receiver_id not in VALID_AGENT_IDS:
        errors.append(f"receiver.agentId '{receiver_id}' 无效，合法值: {VALID_AGENT_IDS}")
    if sender_id and receiver_id and sender_id == receiver_id:
        errors.append(f"发送者和接收者相同: {sender_id}")
    if direction and direction == "vertical":
        sender_role = _drill(card, "params", "sender", "role")
        receiver_role = _drill(card, "params", "receiver", "role")
        valid_vertical_sender = {"teacher", "tech_lead"}
        if sender_role not in valid_vertical_sender and receiver_role not in valid_vertical_sender:
            pass  # 允许 peer 之间纵向通信
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


def send_message(card: dict, notify: bool = False) -> tuple[bool, str]:
    """验证并发送消息到接收者 inbox。返回 (成功, 消息)。"""
    errors = validate_card(card)
    if errors:
        return False, "Schema 验证失败:\n  - " + "\n  - ".join(errors)

    receiver_id = _drill(card, "params", "receiver", "agentId")
    if not receiver_id:
        return False, "无法确定接收者 agentId"

    msg_id = card.get("id", f"msg-{int(time.time())}")
    card_type = _drill(card, "params", "cardType") or "unknown"

    # 写 inbox
    inbox = INBOX_DIR / receiver_id
    inbox.mkdir(parents=True, exist_ok=True)
    target = inbox / f"{msg_id}.json"
    tmp = inbox / f"{msg_id}.json.tmp"

    try:
        tmp.write_text(json.dumps(card, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(tmp, target)  # 原子操作
    except OSError as e:
        return False, f"写入失败: {e}"

    # 归档 outbox
    month = time.strftime("%Y-%m")
    outbox_month = OUTBOX_DIR / month
    outbox_month.mkdir(parents=True, exist_ok=True)
    archive = outbox_month / f"{msg_id}.json"
    archive.write_text(json.dumps(card, ensure_ascii=False, indent=2), encoding="utf-8")

    # 更新状态
    _update_state(msg_id, {
        "id": msg_id,
        "type": card_type,
        "sender": _drill(card, "params", "sender", "agentId"),
        "receiver": receiver_id,
        "status": "delivered",
        "sentAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    })

    # 可选通知
    if notify:
        tmux_session = _get_tmux_session(receiver_id)
        if tmux_session:
            cmd = f"Read messages/inbox/{receiver_id}/{msg_id}.json"
            subprocess.run(
                ["tmux", "send-keys", "-t", tmux_session, cmd, "Enter"],
                capture_output=True,
                timeout=5,
            )

    return True, f"✅ 消息 {msg_id} 已送达 {receiver_id}"


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
    """显示消息状态"""
    state = _load_state()
    if not state:
        return "(无消息记录)"

    lines = [f"{'消息ID':<45} {'类型':<18} {'发送者':<6} {'接收者':<6} {'状态':<14}"]
    lines.append("-" * 95)

    items = list(state.values())
    items.sort(key=lambda x: x.get("sentAt", ""), reverse=True)

    for item in items:
        if agent_id and item.get("receiver") != agent_id and item.get("sender") != agent_id:
            continue
        lines.append(
            f"{item['id']:<45} {item.get('type','?'):<18} "
            f"{item.get('sender','?'):<6} {item.get('receiver','?'):<6} "
            f"{item.get('status','?'):<14}"
        )

    # 统计
    delivered = sum(1 for i in items if i.get("status") == "delivered")
    acked = sum(1 for i in items if i.get("status") == "acknowledged")
    lines.append(f"\n总计: {len(items)} 条消息 (已送达: {delivered}, 已确认: {acked})")
    return "\n".join(lines)


def _get_tmux_session(agent_id: str) -> Optional[str]:
    """从 AgentCard 获取 tmux session"""
    card_path = AGENT_CARDS_DIR / f"{agent_id}.json"
    if card_path.exists():
        try:
            card = json.loads(card_path.read_text(encoding="utf-8"))
            return _drill(card, "contact", "tmuxSession")
        except (json.JSONDecodeError, OSError):
            pass

    # 回退到命名约定
    session_map = {
        "ma": "claude-ma",
        "wang": "claude-wang",
        "zhou": "claude-zhou",
        "nie": "claude-nie",
    }
    return session_map.get(agent_id)


def _load_state() -> dict:
    """加载消息状态"""
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            pass
    return {}


def _save_state(state: dict) -> None:
    """保存消息状态"""
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

    print("=== agent-router.py 自测 ===\n")

    # ── Schema 验证 ──
    print("[1] Schema 验证")

    # 合法 TaskCard
    valid_task = {
        "jsonrpc": "2.0",
        "id": "test-task-001",
        "method": "task.dispatch",
        "params": {
            "protocol": "fugui-v1",
            "cardType": "TaskCard",
            "task": {
                "id": "V7-TEST-001",
                "title": "测试任务",
                "domain": "engineering",
                "priority": "P0",
                "requirement": "测试需求",
                "acceptanceCriteria": ["条件1", "条件2"],
                "outputPath": "test/output.md",
            },
            "sender": {"agentId": "nie", "name": "聂富贵", "role": "teacher"},
            "receiver": {"agentId": "ma", "name": "马富贵", "role": "student"},
            "direction": "vertical",
        },
    }
    errors = validate_card(valid_task)
    check("合法 TaskCard 验证通过", len(errors) == 0, "; ".join(errors))

    # 发送者=接收者
    self_task = json.loads(json.dumps(valid_task))
    self_task["params"]["receiver"]["agentId"] = "nie"
    errors = validate_card(self_task)
    check("发送者=接收者被检测", any("相同" in e for e in errors))

    # 缺少必需字段
    missing_field = {"jsonrpc": "2.0", "method": "task.dispatch", "params": {}}
    errors = validate_card(missing_field)
    check("缺少必需字段被检测", len(errors) > 0)

    # 无效 agentId
    bad_agent = json.loads(json.dumps(valid_task))
    bad_agent["params"]["receiver"]["agentId"] = "alien"
    errors = validate_card(bad_agent)
    check("无效 agentId 被检测", any("无效" in e for e in errors))

    # 合法 DeliverableCard
    valid_deliver = {
        "jsonrpc": "2.0",
        "id": "test-deliver-001",
        "method": "deliverable.submit",
        "params": {
            "protocol": "fugui-v1",
            "cardType": "DeliverableCard",
            "taskId": "V7-TEST-001",
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

    # 合法 ReviewCard (无 suggestion → 应失败)
    review_no_suggestion = {
        "jsonrpc": "2.0",
        "id": "test-review-001",
        "method": "review.submit",
        "params": {
            "protocol": "fugui-v1",
            "cardType": "ReviewCard",
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

    # 合法 ReviewCard (含 suggestion)
    valid_review = json.loads(json.dumps(review_no_suggestion))
    valid_review["params"]["opinions"][0]["suggestion"] = "改进方案"
    errors = validate_card(valid_review)
    check("合法 ReviewCard 验证通过", len(errors) == 0, "; ".join(errors))

    print(f"\n  Schema 验证: {tests_run - failures}/{tests_run} 通过")

    # ── 消息路由 ──
    print("\n[2] 消息路由")

    initial_tests = tests_run

    # send (不通知)
    ok, msg = send_message(valid_task, notify=False)
    check("send TaskCard 成功", ok, msg)

    ok, msg = send_message(valid_deliver, notify=False)
    check("send DeliverableCard 成功", ok, msg)

    ok, msg = send_message(valid_review, notify=False)
    check("send ReviewCard 成功", ok, msg)

    # 检查文件已写入
    check("inbox/ma/ 目录已创建", (INBOX_DIR / "ma").exists())
    check("outbox 归档已创建", any(OUTBOX_DIR.iterdir()))

    # ack
    ok, msg = ack_message("test-task-001")
    check("ack 消息成功", ok, msg)

    # status
    status_output = show_status()
    check("status 包含消息记录", "test-task-001" in status_output)

    route_tests = tests_run - initial_tests
    print(f"\n  消息路由: {route_tests - (failures - (tests_run - route_tests - initial_tests))}/{route_tests} 通过")

    # ── 清理测试文件 ──
    print("\n[清理]")
    import shutil

    test_files = [
        INBOX_DIR / "ma" / "test-task-001.json",
        INBOX_DIR / "ma" / "test-deliver-001.json",
        INBOX_DIR / "ma" / "test-review-001.json",
    ]
    for f in test_files:
        if f.exists():
            f.unlink()
            print(f"  已删除: {f.name}")

    if STATE_FILE.exists():
        STATE_FILE.unlink()

    # 清理 outbox 测试文件
    for outbox_month in OUTBOX_DIR.iterdir():
        if outbox_month.is_dir():
            for f in outbox_month.iterdir():
                if f.name.startswith("test-"):
                    f.unlink()

    print(f"\n{'='*50}")
    print(f"总计: {tests_run - failures}/{tests_run} 通过" + (f", {failures} 失败" if failures else ""))
    print(f"{'='*50}")

    return failures


# ── CLI ──


def main() -> None:
    parser = argparse.ArgumentParser(
        description="富贵协议 v1 消息路由",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  agent-router.py validate task.json    验证 Card JSON
  agent-router.py send task.json        发送消息到接收者 inbox
  agent-router.py send task.json --notify  发送并 tmux 通知
  agent-router.py status                查看所有消息状态
  agent-router.py status --agent ma     只看马富贵的消息
  agent-router.py ack msg-001           确认收到消息
  agent-router.py self-test             运行自测
        """,
    )
    sub = parser.add_subparsers(dest="command", help="子命令")

    # validate
    p_validate = sub.add_parser("validate", help="验证 Card JSON Schema")
    p_validate.add_argument("card_file", help="Card JSON 文件路径")

    # send
    p_send = sub.add_parser("send", help="发送消息到接收者 inbox")
    p_send.add_argument("card_file", help="Card JSON 文件路径")
    p_send.add_argument("--notify", action="store_true", help="通过 tmux 通知接收者")

    # status
    p_status = sub.add_parser("status", help="查看消息状态")
    p_status.add_argument("--agent", help="按 Agent ID 过滤")

    # ack
    p_ack = sub.add_parser("ack", help="确认收到消息")
    p_ack.add_argument("message_id", help="消息 ID")

    # self-test
    sub.add_parser("self-test", help="运行自测")

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
        ok, msg = send_message(card, notify=args.notify)
        print(msg)
        sys.exit(0 if ok else 1)

    elif args.command == "status":
        print(show_status(args.agent))

    elif args.command == "ack":
        ok, msg = ack_message(args.message_id)
        print(msg)
        sys.exit(0 if ok else 1)

    elif args.command == "self-test":
        failures = self_test()
        sys.exit(0 if failures == 0 else 1)

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
