#!/usr/bin/env python3
"""
Anthropic → OpenAI 翻译代理
让 Claude Code 会话能使用非 Anthropic 兼容的模型（豆包、千问）
用法:
  千问: python3 scripts/anthropic-proxy.py --provider qwen --port 8788
  豆包: python3 scripts/anthropic-proxy.py --provider doubao --port 8787
"""
import json, sys, os, argparse
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.request import Request, urlopen
from urllib.error import HTTPError

# ============================================================
# Provider 配置
# ============================================================
PROVIDERS = {
    "doubao": {
        "api_base": "https://ark.cn-beijing.volces.com/api/v3",
        "model": "doubao-seed-2-0-pro-260215",
        "env_key": "DOUBAO_API_KEY",
    },
    "qwen": {
        "api_base": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "model": "qwen3-max",
        "env_key": "DASHSCOPE_API_KEY",
    },
}

# 从项目 .env 加载
def load_api_key(provider):
    env_file = os.path.join(os.path.dirname(__file__), "..", "server", ".env")
    key_name = PROVIDERS[provider]["env_key"]
    if os.path.exists(env_file):
        with open(env_file) as f:
            for line in f:
                line = line.strip()
                if line.startswith(f"{key_name}="):
                    return line.split("=", 1)[1].strip('"').strip("'")
    return os.environ.get(key_name)


class ProxyHandler(BaseHTTPRequestHandler):
    provider = None
    api_key = None
    api_base = None
    model = None

    def do_POST(self):
        if self.path not in ("/v1/messages", "/v1/messages/stream", "/api/anthropic/v1/messages"):
            self.send_error(404)
            return

        # 读取 Anthropic 请求
        body_len = int(self.headers.get("Content-Length", 0))
        anthropic_req = json.loads(self.rfile.read(body_len))

        # 翻译 → OpenAI 格式
        openai_req = self._translate_to_openai(anthropic_req)
        stream = anthropic_req.get("stream", False)

        # 转发到目标 API
        try:
            openai_resp = self._call_openai(openai_req, stream)
            if stream:
                self._handle_stream(openai_resp)
            else:
                anthropic_resp = self._translate_from_openai(json.loads(openai_resp))
                self._send_json(200, anthropic_resp)
        except HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace")
            print(f"[proxy] API error {e.code}: {err_body[:200]}", file=sys.stderr)
            self._send_json(e.code, {
                "type": "error",
                "error": {"type": "api_error", "message": f"Upstream {e.code}: {err_body[:300]}"}
            })
        except Exception as e:
            print(f"[proxy] error: {e}", file=sys.stderr)
            self._send_json(500, {
                "type": "error",
                "error": {"type": "proxy_error", "message": str(e)}
            })

    def do_GET(self):
        if self.path == "/health":
            self._send_json(200, {"status": "ok", "provider": self.provider, "model": self.model})
        else:
            self.send_error(404)

    def _translate_to_openai(self, req):
        messages = []
        system = req.get("system")
        if system:
            if isinstance(system, str):
                messages.append({"role": "system", "content": system})
            elif isinstance(system, list):
                text = " ".join(c.get("text", "") for c in system if c.get("type") == "text")
                messages.append({"role": "system", "content": text})

        for msg in req.get("messages", []):
            role = msg.get("role", "user")
            content = msg.get("content", "")
            if isinstance(content, list):
                text = " ".join(c.get("text", "") for c in content if c.get("type") == "text")
                content = text
            messages.append({"role": role, "content": content})

        return {
            "model": self.model,
            "messages": messages,
            "max_tokens": req.get("max_tokens", 4096),
            "temperature": req.get("temperature", 0.7),
            "stream": req.get("stream", False),
        }

    def _translate_from_openai(self, resp):
        choice = resp.get("choices", [{}])[0]
        msg = choice.get("message", {})
        content = msg.get("content", "")
        return {
            "id": resp.get("id", "proxy-0"),
            "type": "message",
            "role": "assistant",
            "model": self.model,
            "content": [{"type": "text", "text": content}],
            "stop_reason": choice.get("finish_reason", "stop"),
            "usage": {
                "input_tokens": resp.get("usage", {}).get("prompt_tokens", 0),
                "output_tokens": resp.get("usage", {}).get("completion_tokens", 0),
            },
        }

    def _call_openai(self, req, stream=False):
        url = f"{self.api_base}/chat/completions"
        body = json.dumps(req).encode("utf-8")
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }
        r = Request(url, data=body, headers=headers, method="POST")
        return urlopen(r, timeout=120)

    def _handle_stream(self, resp):
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.end_headers()
        for line in resp:
            line = line.decode("utf-8", errors="replace").strip()
            if line.startswith("data: "):
                data_str = line[6:]
                if data_str == "[DONE]":
                    self.wfile.write(b"data: [DONE]\n\n")
                    break
                try:
                    openai_chunk = json.loads(data_str)
                    choice = openai_chunk.get("choices", [{}])[0]
                    delta = choice.get("delta", {})
                    content = delta.get("content", "")
                    if content:
                        chunk = json.dumps({
                            "type": "content_block_delta",
                            "delta": {"type": "text_delta", "text": content}
                        })
                        self.wfile.write(f"data: {chunk}\n\n".encode())
                except json.JSONDecodeError:
                    pass

    def _send_json(self, code, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", len(body))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        print(f"[proxy] {args[0]}", file=sys.stderr)


def main():
    parser = argparse.ArgumentParser(description="Anthropic → OpenAI 翻译代理")
    parser.add_argument("--provider", required=True, choices=["doubao", "qwen"])
    parser.add_argument("--port", type=int, required=True)
    args = parser.parse_args()

    cfg = PROVIDERS[args.provider]
    api_key = load_api_key(args.provider)
    if not api_key:
        print(f"❌ 找不到 {cfg['env_key']}，请检查 server/.env", file=sys.stderr)
        sys.exit(1)

    ProxyHandler.provider = args.provider
    ProxyHandler.api_key = api_key
    ProxyHandler.api_base = cfg["api_base"]
    ProxyHandler.model = cfg["model"]

    server = HTTPServer(("127.0.0.1", args.port), ProxyHandler)
    mask_key = api_key[:8] + "..." + api_key[-4:]
    print(f"🔌 代理启动: 127.0.0.1:{args.port} → {cfg['api_base']}/chat/completions", file=sys.stderr)
    print(f"   模型: {cfg['model']} | Key: {mask_key}", file=sys.stderr)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n代理停止", file=sys.stderr)
        server.shutdown()


if __name__ == "__main__":
    main()
