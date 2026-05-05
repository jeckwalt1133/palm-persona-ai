/**
 * 客座讲师调用模块 — 豆包 + 千问
 *
 * 使用方式:
 *   npx tsx scripts/guest-lecture.ts doubao "请讲授MCP协议的传输层设计"
 *   npx tsx scripts/guest-lecture.ts qwen "请审查这段代码的安全性"
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 从 server/.env 读取密钥 (与 server/src/config 同一数据源)
function loadEnv(): Record<string, string> {
  const envPath = resolve(__dirname, '../server/.env');
  const content = readFileSync(envPath, 'utf-8');
  const env: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return env;
}

interface LecturerConfig {
  name: string;
  model: string;
  apiKey: string;
  baseUrl: string;
  systemPrompt: string;
}

function getLecturer(which: 'doubao' | 'qwen', env: Record<string, string>): LecturerConfig {
  switch (which) {
    case 'doubao':
      return {
        name: '豆包 Seed-2.0-Pro（旗舰）',
        model: 'doubao-seed-2-0-pro-260215',
        apiKey: env.DOUBAO_API_KEY || '',
        baseUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
        systemPrompt:
          '你是掌心人格局研究生院的客座讲师，专长是文案审美与内容创意。你的讲授风格生动、有感染力，善用比喻和案例。每次讲授控制在500字以内，结尾留一个思考题。',
      };
    case 'qwen':
      return {
        name: '千问 Qwen3-Max（旗舰）',
        model: 'qwen3-max',
        apiKey: env.DASHSCOPE_API_KEY || '',
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
        systemPrompt:
          '你是掌心人格局研究生院的客座讲师，专长是代码审查与工程质量。你的讲授风格严谨、结构化，善用对比和代码示例。每次讲授控制在500字以内，结尾留一个审查练习题。',
      };
  }
}

async function callLecturer(config: LecturerConfig, topic: string): Promise<string> {
  const resp = await fetch(config.baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: config.systemPrompt },
        {
          role: 'user',
          content: `今天的教学主题：${topic}\n\n请以客座讲师身份，给学生讲一堂课。要求：有观点、有案例、有可操作建议。500字以内。`,
        },
      ],
      max_tokens: 1200,
      temperature: 0.8,
    }),
  });

  if (!resp.ok) {
    const errBody = await resp.text().catch(() => '');
    throw new Error(`${config.name} API 返回 ${resp.status}: ${errBody.slice(0, 200)}`);
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content || '(客座讲师返回空内容)';
}

// ─── CLI ───────────────────────────────────────────────────────────────────────

async function main() {
  const [lecturer, ...topicParts] = process.argv.slice(2);
  const topic = topicParts.join(' ');

  if (!lecturer || !topic) {
    console.log('用法: node --loader tsx scripts/guest-lecture.ts <doubao|qwen> "<topic>"');
    process.exit(1);
  }

  if (lecturer !== 'doubao' && lecturer !== 'qwen') {
    console.error('讲师只能是 doubao 或 qwen');
    process.exit(1);
  }

  const env = loadEnv();
  const config = getLecturer(lecturer, env);

  if (!config.apiKey) {
    console.error(`${config.name} API Key 未配置 (检查 server/.env)`);
    process.exit(1);
  }

  console.log(`\n${config.name} 客座讲授中... 课题: ${topic}`);
  console.log('─'.repeat(50));

  try {
    const result = await callLecturer(config, topic);
    console.log(result);
    console.log('─'.repeat(50));
    console.log(`${config.name} 客座讲授完毕`);
  } catch (err: any) {
    console.error(`${config.name} 调用失败:`, err.message);
    process.exit(1);
  }
}

main();
