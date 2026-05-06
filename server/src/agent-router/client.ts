/**
 * Agent Router TypeScript 客户端 — 封装 agent-router.py 调用
 *
 * 职责:
 *   1. dispatchTask() — 派发 TaskCard 到目标 Agent
 *   2. waitForDeliverable() — 轮询 inbox 等待 DeliverableCard
 *   3. submitDeliverable() — 作为 Worker 提交交付物
 *   4. checkInbox() — 列出 Agent inbox 消息
 *
 * 设计约束:
 *   - 零 npm 依赖，仅用 child_process + fs
 *   - 文件系统作为消息总线（与 agent-router.py 共享 messages/ 目录）
 *   - JSON-RPC 2.0 + 富贵协议 v1
 */

import { execFile } from 'child_process';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// ── 配置 ─────────────────────────────────────────

const PROJECT_ROOT = join(import.meta.dirname, '..', '..', '..');
const SCRIPTS_DIR = join(PROJECT_ROOT, 'scripts');
const MESSAGES_DIR = join(PROJECT_ROOT, 'messages');
const AGENT_ROUTER = join(SCRIPTS_DIR, 'agent-router.py');
const PYTHON_BIN = 'python3';

// ── 类型 ─────────────────────────────────────────

export interface AgentIdentity {
  agentId: string;
  name: string;
  role: string;
}

export interface TaskDefinition {
  id: string;
  title: string;
  domain: string;
  priority: 'P0' | 'P1' | 'P2';
  requirement: string;
  acceptanceCriteria: string[];
  outputPath: string;
  /** 传递给 Worker 的 payload（如五维分数、视觉锚点） */
  payload?: Record<string, unknown>;
}

export interface TaskCardInput {
  sender: AgentIdentity;
  receiver: AgentIdentity;
  task: TaskDefinition;
  direction: 'vertical' | 'horizontal';
  ttlSeconds?: number;
}

export interface DeliverableResult {
  taskId: string;
  status: 'self_review_passed' | 'self_review_failed';
  deliverables: Array<{ path: string; type: string; content?: unknown }>;
  selfReview: {
    acceptanceCriteriaMet: string[];
    acceptanceCriteriaUnmet: string[];
  };
  sender: AgentIdentity;
}

export interface InboxMessage {
  file: string;
  id: string;
  method: string;
  type: string;
  sender: string;
}

export interface AgentRouterResponse {
  success: boolean;
  messageId: string;
  message: string;
}

// ── 核心 API ─────────────────────────────────────

/**
 * 调用 agent-router.py CLI。所有高层 API 的基础。
 */
async function callRouter(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const { stdout, stderr } = await execFileAsync(PYTHON_BIN, [AGENT_ROUTER, ...args], {
      cwd: PROJECT_ROOT,
      maxBuffer: 10 * 1024 * 1024,
      timeout: 30000,
    });
    return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: (e.stdout || '').trim(),
      stderr: (e.stderr || '').trim(),
      exitCode: e.code ?? 1,
    };
  }
}

/**
 * 派发 TaskCard 到目标 Agent。
 * 原子流程: 构建 Card JSON → 写入 tmp 文件 → agent-router.py send → 清理 tmp
 */
export async function dispatchTask(input: TaskCardInput): Promise<AgentRouterResponse> {
  const messageId = `pipeline-${input.task.id}-${Date.now()}`;

  const card = {
    jsonrpc: '2.0',
    id: messageId,
    method: 'task.dispatch',
    params: {
      protocol: 'fugui-v1',
      cardType: 'TaskCard',
      task: {
        id: input.task.id,
        title: input.task.title,
        domain: input.task.domain,
        priority: input.task.priority,
        requirement: input.task.requirement,
        acceptanceCriteria: input.task.acceptanceCriteria,
        outputPath: input.task.outputPath,
        ...(input.task.payload ? { payload: input.task.payload } : {}),
      },
      sender: input.sender,
      receiver: input.receiver,
      direction: input.direction,
      ...(input.ttlSeconds ? { ttlSeconds: input.ttlSeconds } : {}),
    },
  };

  // 写入临时 JSON 文件
  const tmpDir = join(MESSAGES_DIR, '.tmp');
  const { mkdirSync } = await import('fs');
  mkdirSync(tmpDir, { recursive: true });
  const tmpFile = join(tmpDir, `${messageId}.json`);
  const { writeFileSync } = await import('fs');
  writeFileSync(tmpFile, JSON.stringify(card, null, 2), 'utf-8');

  // 调用 agent-router.py send
  const args = ['send', tmpFile];
  if (input.ttlSeconds) {
    args.push('--ttl', String(input.ttlSeconds));
  }

  const { stdout, exitCode } = await callRouter(args);

  // 清理临时文件
  try { (await import('fs')).unlinkSync(tmpFile); } catch { /* ignore */ }

  return {
    success: exitCode === 0,
    messageId,
    message: stdout || `exitCode=${exitCode}`,
  };
}

/**
 * 轮询 inbox 等待 DeliverableCard 响应。
 *
 * @param taskId   — TaskCard 中的 task.id，匹配 DeliverableCard.taskId
 * @param timeoutMs — 最大等待时间 (ms)，默认 60s
 * @param pollIntervalMs — 轮询间隔 (ms)，默认 500ms
 * @returns DeliverableResult 或 null（超时）
 */
export async function waitForDeliverable(
  taskId: string,
  timeoutMs = 60000,
  pollIntervalMs = 500,
): Promise<DeliverableResult | null> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    // 列出当前 Agent 的 inbox (pipeline 是 caller, 等待 receiver 的响应)
    // 但也可能 deliverable 发送到 nie inbox (因为是 nie 发起的 task)
    const agents = ['nie', 'ma', 'wang', 'zhou'];

    for (const agentId of agents) {
      const inboxDir = join(MESSAGES_DIR, 'inbox', agentId);
      if (!existsSync(inboxDir)) continue;

      const files = readdirSync(inboxDir)
        .filter(f => f.endsWith('.json') && !f.endsWith('.tmp'))
        .sort();

      for (const file of files) {
        const filePath = join(inboxDir, file);
        try {
          // 跳过太新的文件（可能还在写入中）
          const age = Date.now() - statSync(filePath).mtimeMs;
          if (age < 200) continue; // 200ms 内可能仍在写入

          const card = JSON.parse(readFileSync(filePath, 'utf-8'));

          if (
            card.jsonrpc === '2.0' &&
            card.method === 'deliverable.submit' &&
            card.params?.taskId === taskId
          ) {
            // 找到匹配的 DeliverableCard，确认收到
            await callRouter(['ack', card.id]);

            return {
              taskId: card.params.taskId,
              status: card.params.status,
              deliverables: card.params.deliverables || [],
              selfReview: card.params.selfReview || {
                acceptanceCriteriaMet: [],
                acceptanceCriteriaUnmet: [],
              },
              sender: card.params.sender || { agentId: '?', name: '?', role: '?' },
            };
          }
        } catch {
          // JSON 解析失败，跳过
          continue;
        }
      }
    }

    // 等待后再轮询
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  return null; // 超时
}

/**
 * 提交 DeliverableCard（Worker 端使用）。
 * 当 Agent 完成任务后，通过此函数提交交付物。
 */
export async function submitDeliverable(
  taskId: string,
  sender: AgentIdentity,
  receiver: AgentIdentity,
  deliverables: Array<{ path: string; type: string; content?: unknown }>,
  status: 'self_review_passed' | 'self_review_failed',
  selfReview: { acceptanceCriteriaMet: string[]; acceptanceCriteriaUnmet: string[] },
): Promise<AgentRouterResponse> {
  const messageId = `deliver-${taskId}-${Date.now()}`;

  const card = {
    jsonrpc: '2.0',
    id: messageId,
    method: 'deliverable.submit',
    params: {
      protocol: 'fugui-v1',
      cardType: 'DeliverableCard',
      taskId,
      status,
      sender,
      receiver,
      direction: 'vertical',
      deliverables,
      selfReview,
      requestReview: true,
    },
  };

  const tmpDir = join(MESSAGES_DIR, '.tmp');
  const { mkdirSync } = await import('fs');
  mkdirSync(tmpDir, { recursive: true });
  const tmpFile = join(tmpDir, `${messageId}.json`);
  const { writeFileSync } = await import('fs');
  writeFileSync(tmpFile, JSON.stringify(card, null, 2), 'utf-8');

  const { stdout, exitCode } = await callRouter(['send', tmpFile]);

  try { (await import('fs')).unlinkSync(tmpFile); } catch { /* ignore */ }

  return {
    success: exitCode === 0,
    messageId,
    message: stdout || `exitCode=${exitCode}`,
  };
}

/**
 * 检查 Agent 的 inbox。
 */
export async function checkInbox(agentId: string): Promise<InboxMessage[]> {
  const { stdout } = await callRouter(['inbox', 'list', '--agent', agentId]);
  if (!stdout || stdout.includes('inbox 为空')) return [];

  const messages: InboxMessage[] = [];
  const lines = stdout.split('\n').slice(2); // 跳过表头
  for (const line of lines) {
    const parts = line.trim().split(/\s{2,}/);
    if (parts.length >= 3) {
      messages.push({
        file: parts[0].trim(),
        id: parts[0].trim().replace('.json', ''),
        method: parts[1]?.trim() || '?',
        type: '?',
        sender: parts[2]?.trim() || '?',
      });
    }
  }
  return messages;
}

/**
 * 运行 agent-router.py 自测。
 */
export async function runSelfTest(): Promise<{ passed: number; total: number; output: string }> {
  const { stdout, stderr } = await callRouter(['self-test']);
  const output = stdout + (stderr ? '\n' + stderr : '');

  const totalMatch = output.match(/(\d+)\/(\d+)\s*通过/);
  const total = totalMatch ? parseInt(totalMatch[2], 10) : 0;
  const passed = totalMatch ? parseInt(totalMatch[1], 10) : 0;

  return { passed, total, output };
}

/**
 * 清理过期消息。
 */
export async function cleanup(agentId?: string): Promise<number> {
  const args = ['cleanup'];
  if (agentId) args.push('--agent', agentId);
  const { stdout } = await callRouter(args);
  const match = stdout.match(/清理了\s*(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}
