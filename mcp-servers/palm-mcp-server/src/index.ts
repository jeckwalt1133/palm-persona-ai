#!/usr/bin/env node

/**
 * palm-mcp-server — 掌心人格局 MCP Server v1.0.0
 *
 * 3 Tools + 3 Resources + 3 Prompts
 * 传输层: STDIO | Streamable HTTP
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

const FORBIDDEN_TERMS: Record<string, string> = {
  '算命': '性格分析', '占卜': '趣味探索', '手相': '手掌特征',
  '看手相': '手掌观察', '掌纹': '掌心线条', '命运注定': '性格倾向',
  '天注定': '先天因素', '宿命': '人格底色', '改命': '自我成长',
  '改运': '调整状态', '开运': '开启新方向', '正缘': '深度匹配',
  '姻缘测算': '关系模式分析', '旺夫': '有益关系', '旺妻': '有益关系',
  '克夫': '需磨合', '克妻': '需磨合', '天生一对': '高度同频',
  '100%准确': '仅供娱乐', '比算命更准': '趣味解读', '必然': '倾向于',
  '一定会': '大概率会', '暴富': '财富增长', '寿命预测': '健康关注',
  '疾病预测': '健康提示', '灾祸预测': '风险提示', '财富暴富预测': '财富潜质分析'
};

const DIMENSIONS = [
  { key: 'openness', name: '开放性', description: '对新体验、新思想的接纳程度' },
  { key: 'conscientiousness', name: '尽责性', description: '自我约束、组织性和成就导向' },
  { key: 'extraversion', name: '外向性', description: '社交活跃度和正性情绪表达' },
  { key: 'agreeableness', name: '宜人性', description: '合作性、同情心和信任倾向' },
  { key: 'neuroticism', name: '情绪稳定性', description: '情绪调节能力和压力耐受度' }
];

const server = new Server(
  { name: 'palm-mcp-server', version: '1.0.0' },
  { capabilities: { tools: {}, resources: {}, prompts: {} } }
);

// Tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'check_compliance',
      description: '检查文本是否含禁用词(27项)，返回违规词和替换建议',
      inputSchema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: '待检查文本' }
        },
        required: ['text']
      }
    },
    {
      name: 'query_reports',
      description: '查询人格报告，可按ID/人格类型筛选',
      inputSchema: {
        type: 'object',
        properties: {
          reportId: { type: 'string' },
          personaType: { type: 'string' },
          limit: { type: 'number' }
        }
      }
    },
    {
      name: 'analyze_persona',
      description: '五维人格分析+社交文案生成',
      inputSchema: {
        type: 'object',
        properties: {
          openness: { type: 'number', minimum: 0, maximum: 100 },
          conscientiousness: { type: 'number', minimum: 0, maximum: 100 },
          extraversion: { type: 'number', minimum: 0, maximum: 100 },
          agreeableness: { type: 'number', minimum: 0, maximum: 100 },
          neuroticism: { type: 'number', minimum: 0, maximum: 100 }
        },
        required: ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism']
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  switch (name) {
    case 'check_compliance': {
      const text = args?.text;
      if (typeof text !== 'string' || !text) {
        throw new McpError(ErrorCode.InvalidParams, 'text 必填');
      }
      const violations: { word: string; replacement: string }[] = [];
      for (const [term, repl] of Object.entries(FORBIDDEN_TERMS)) {
        if (text.includes(term)) violations.push({ word: term, replacement: repl });
      }
      return { content: [{ type: 'text', text: JSON.stringify({
        safe: violations.length === 0,
        violations,
        suggestion: violations.length > 0
          ? `发现${violations.length}个禁用词，建议替换`
          : '文本合规'
      }, null, 2) }] };
    }
    case 'query_reports': {
      return { content: [{ type: 'text', text: JSON.stringify({
        reports: [],
        total: 0,
        note: '骨架版本。完整版连接真实报告数据库。'
      }, null, 2) }] };
    }
    case 'analyze_persona': {
      const scores = {
        openness: args?.openness as number,
        conscientiousness: args?.conscientiousness as number,
        extraversion: args?.extraversion as number,
        agreeableness: args?.agreeableness as number,
        neuroticism: args?.neuroticism as number
      };
      const entries = Object.entries(scores) as [string, number][];
      const max = entries.sort((a, b) => b[1] - a[1])[0];
      const min = entries.sort((a, b) => a[1] - b[1])[0];
      const dim = DIMENSIONS.find(d => d.key === max[0]);
      return { content: [{ type: 'text', text: JSON.stringify({
        dominant: { dimension: max[0], score: max[1], label: dim?.name },
        recessive: { dimension: min[0], score: min[1] },
        balance: Math.max(...Object.values(scores)) - Math.min(...Object.values(scores)) < 20 ? '均衡' : '鲜明',
        captions: {
          identity: `我是${dim?.name || '独特'}型人格`,
          truth: `你看起来平和，其实内心比大多数人更${dim?.name || '丰富'}`
        },
        disclaimer: '骨架版。完整版通过AI Provider生成深度报告。'
      }, null, 2) }] };
    }
    default:
      throw new McpError(ErrorCode.MethodNotFound, `未知工具: ${name}`);
  }
});

// Resources
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    { uri: 'palm://compliance/terms', name: '禁用词列表(27项)', mimeType: 'application/json' },
    { uri: 'palm://compliance/replacements', name: '替代表达对照表', mimeType: 'application/json' },
    { uri: 'palm://persona/dimensions', name: '五维人格维度', mimeType: 'application/json' }
  ]
}));

server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
  switch (req.params.uri) {
    case 'palm://compliance/terms':
      return { contents: [{ uri: req.params.uri, mimeType: 'application/json', text: JSON.stringify({
        total: Object.keys(FORBIDDEN_TERMS).length,
        categories: {
          '命理(5)': ['算命','占卜','手相','看手相','掌纹'],
          '命运(6)': ['命运注定','天注定','宿命','改命','改运','开运'],
          '关系(7)': ['正缘','姻缘测算','旺夫','旺妻','克夫','克妻','天生一对'],
          '绝对化(5)': ['100%准确','比算命更准','必然','一定会','暴富'],
          '灾祸(4)': ['寿命预测','疾病预测','灾祸预测','财富暴富预测']
        }
      }, null, 2) }] };
    case 'palm://compliance/replacements':
      return { contents: [{ uri: req.params.uri, mimeType: 'application/json', text: JSON.stringify(FORBIDDEN_TERMS, null, 2) }] };
    case 'palm://persona/dimensions':
      return { contents: [{ uri: req.params.uri, mimeType: 'application/json', text: JSON.stringify(DIMENSIONS, null, 2) }] };
    default:
      throw new McpError(ErrorCode.InvalidRequest, `未知资源: ${req.params.uri}`);
  }
});

// Prompts
server.setRequestHandler(ListPromptsRequestSchema, async () => ({
  prompts: [
    { name: 'analyze_report', description: '全面分析人格报告', arguments: [{ name: 'report_id', required: true }] },
    { name: 'draft_caption', description: '生成社交货币文案', arguments: [{ name: 'persona_type', required: true }, { name: 'platform', required: false }] },
    { name: 'compliance_check', description: '合规检查模板', arguments: [{ name: 'report_id', required: true }] }
  ]
}));

server.setRequestHandler(GetPromptRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  switch (name) {
    case 'analyze_report': {
      const id = args?.report_id;
      if (!id) throw new McpError(ErrorCode.InvalidParams, '缺少 report_id');
      return { messages: [{ role: 'user', content: { type: 'text', text: `分析报告 ${id}：人格概括+五维解读+核心真相+3条社交文案。禁用算命/占卜/手相/正缘等词。` } }] };
    }
    case 'draft_caption': {
      const type = args?.persona_type;
      const plat = (args?.platform as string) || 'weapp';
      if (!type) throw new McpError(ErrorCode.InvalidParams, '缺少 persona_type');
      const note = plat === 'tt' ? '抖音：中性轻快' : '微信：情绪走心';
      return { messages: [{ role: 'user', content: { type: 'text', text: `为"${type}"生成4条文案(身份标签/隐秘真相/关系洞察/对立反差)。${note}。禁用禁用词。` } }] };
    }
    case 'compliance_check': {
      const id = args?.report_id;
      if (!id) throw new McpError(ErrorCode.InvalidParams, '缺少 report_id');
      return { messages: [{ role: 'user', content: { type: 'text', text: `对报告 ${id} 三级检查：禁用词+空泛表述+结构完整性。输出结构化报告。` } }] };
    }
    default:
      throw new McpError(ErrorCode.MethodNotFound, `未知 Prompt: ${name}`);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[palm-mcp-server] v1.0.0 启动 | 3T+3R+3P | STDIO');
}

main().catch((err) => {
  console.error('[palm-mcp-server] 失败:', err);
  process.exit(1);
});
