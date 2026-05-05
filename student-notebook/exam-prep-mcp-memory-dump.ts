/**
 * 期中考试实战模拟 — MCP Server 默写
 *
 * 条件：不参考源码，全凭记忆手写
 * 要求：5分钟内写完一个可用 MCP Server（1 Tool + 1 Resource + 1 Prompt）
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  McpError,
  ErrorCode,
} from '@modelcontextprotocol/sdk/types.js';

// 合规检查函数（模拟 import from shared-safety）
const FORBIDDEN = ['算命', '占卜', '手相', '正缘'];
function checkText(text: string) {
  const found = FORBIDDEN.filter(t => text.includes(t));
  return {
    safe: found.length === 0,
    violations: found,
    filtered: found.reduce((t, f) => t.replaceAll(f, '***'), text),
  };
}

// 创建 Server
const server = new Server(
  { name: 'exam-mcp-server', version: '1.0.0' },
  { capabilities: { tools: {}, resources: {}, prompts: {} } },
);

// ─── Tools ──────────────────────────────────────
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: 'check_compliance',
    description: '检查文本是否含禁用词',
    inputSchema: {
      type: 'object',
      properties: { text: { type: 'string' } },
      required: ['text'],
    },
  }],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  if (req.params.name === 'check_compliance') {
    const text = req.params.arguments?.text;
    if (typeof text !== 'string') throw new McpError(ErrorCode.InvalidParams, 'text 必填');
    return { content: [{ type: 'text', text: JSON.stringify(checkText(text)) }] };
  }
  throw new McpError(ErrorCode.MethodNotFound, '未知工具');
});

// ─── Resources ──────────────────────────────────
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [{
    uri: 'palm://compliance/terms',
    name: '禁用词列表',
    mimeType: 'application/json',
  }],
}));

server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
  if (req.params.uri === 'palm://compliance/terms') {
    return { contents: [{ uri: req.params.uri, mimeType: 'application/json', text: JSON.stringify(FORBIDDEN) }] };
  }
  throw new McpError(ErrorCode.InvalidRequest, '未知资源');
});

// ─── Prompts ────────────────────────────────────
server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: [{
    name: 'analyze_report',
    description: '分析人格报告',
    arguments: [{ name: 'report_id', required: true }],
  }],
}));

server.setRequestHandler(GetPromptRequestSchema, async (req) => {
  if (req.params.name === 'analyze_report') {
    const id = req.params.arguments?.report_id;
    if (!id) throw new McpError(ErrorCode.InvalidParams, '缺少 report_id');
    return {
      messages: [{
        role: 'user',
        content: { type: 'text', text: `请分析报告 ${id}，输出综合解读和分享文案` },
      }],
    };
  }
  throw new McpError(ErrorCode.MethodNotFound, '未知 Prompt');
});

// ─── 启动 ──────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[exam-mcp] 启动成功: 1 Tool + 1 Resource + 1 Prompt');
}

main().catch((err) => {
  console.error('[exam-mcp] 错误:', err);
  process.exit(1);
});
