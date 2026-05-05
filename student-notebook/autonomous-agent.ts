/**
 * 自主进化 Agent — 第7课实战
 *
 * 核心模式：Reflexion（自我反思）
 *   Act → Observe → Reflect → Learn → Improve
 *
 * 记忆系统：
 *   - 短期记忆（工作缓冲区，最近 N 条）
 *   - 长期记忆（持久化经验教训，反思输出）
 *   - 情景记忆（完整 episode 记录）
 *
 * 运行: npx tsx student-notebook/autonomous-agent.ts
 * (从 mcp-servers/palm-mcp-server 目录)
 */

import { queryReports } from '../mcp-servers/palm-mcp-server/src/report-bridge.js';
import { checkTextCompliance } from '../mcp-servers/palm-mcp-server/src/compliance-bridge.js';

// ─── 类型 ────────────────────────────────────────

interface Episode {
  id: number;
  task: string;
  action: string;
  score: number;
  issues: string[];
  reflection: string;
  lessons: string[];
  timestamp: number;
}

interface ShortTermMemory {
  recentEpisodes: Episode[];
  maxSize: number;
}

interface LongTermMemory {
  lessons: Map<string, { count: number; firstLearned: number; lastUsed: number; lesson: string }>;
}

interface AgentState {
  totalEpisodes: number;
  averageScore: number;
  topScore: number;
  consecutiveFailures: number;
  improvementRate: number;
}

// ─── 记忆系统 ────────────────────────────────────

class MemorySystem {
  shortTerm: ShortTermMemory = { recentEpisodes: [], maxSize: 10 };
  longTerm: LongTermMemory = { lessons: new Map() };

  addEpisode(ep: Episode): void {
    this.shortTerm.recentEpisodes.push(ep);
    if (this.shortTerm.recentEpisodes.length > this.shortTerm.maxSize) {
      this.shortTerm.recentEpisodes.shift();
    }
    for (const lesson of ep.lessons) {
      const key = lesson.slice(0, 40);
      if (this.longTerm.lessons.has(key)) {
        const existing = this.longTerm.lessons.get(key)!;
        existing.count++;
        existing.lastUsed = Date.now();
      } else {
        this.longTerm.lessons.set(key, { count: 1, firstLearned: Date.now(), lastUsed: Date.now(), lesson });
      }
    }
  }

  getTopLessons(n: number = 3): string[] {
    return [...this.longTerm.lessons.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, n)
      .map(([_, v]) => v.lesson);
  }

  getState(): AgentState {
    const eps = this.shortTerm.recentEpisodes;
    const avg = eps.length > 0 ? eps.reduce((s, e) => s + e.score, 0) / eps.length : 0;
    const top = eps.length > 0 ? Math.max(...eps.map(e => e.score)) : 0;
    const recentScores = eps.slice(-5).map(e => e.score);
    const improving = recentScores.length >= 2 && recentScores[recentScores.length - 1] > recentScores[0];
    return {
      totalEpisodes: this.shortTerm.recentEpisodes.length,
      averageScore: Math.round(avg),
      topScore: top,
      consecutiveFailures: eps.slice().reverse().filter(e => e.score < 60).length,
      improvementRate: improving ? 1 : 0,
    };
  }
}

// ─── 任务执行器 ──────────────────────────────────

function executeTask(task: string, useLessons: string[]): { output: string; issues: string[]; score: number } {
  const issues: string[] = [];

  // 如果长记忆里有教训，应用它们
  const appliedLessons: string[] = [];
  for (const lesson of useLessons) {
    if (lesson.includes('合规') || lesson.includes('禁用词')) {
      appliedLessons.push('应用教训: 检查禁用词');
    }
    if (lesson.includes('视觉锚点') || lesson.includes('特征')) {
      appliedLessons.push('应用教训: 添加视觉锚点');
    }
    if (lesson.includes('长度') || lesson.includes('字数') || lesson.includes('详细')) {
      appliedLessons.push('应用教训: 控制输出长度');
    }
  }

  // 模拟文案生成
  let output: string;
  if (task.includes('思虑守护者')) {
    output = appliedLessons.length > 0
      ? '你看起来温和好说话，但你心里一直在默默给每个人打分。别人以为你随和，其实你有一张清晰的评分表。'
      : '你是一个善良、敏感、有潜力的人。';
  } else {
    output = appliedLessons.length > 0
      ? '你看起来大大咧咧什么都无所谓，其实你的底线比谁都清晰，只是懒得争辩。'
      : '你是个很好的人。';
  }

  // 质量检查
  const compliance = checkTextCompliance(output);
  if (!compliance.safe) {
    issues.push(...compliance.violations.map(v => `禁用词: ${v}`));
  }

  const genericWords = ['善良', '有潜力', '很好'];
  if (genericWords.some(w => output.includes(w))) {
    issues.push('空泛表述');
  }

  const anchors = ['手掌', '掌心', '手指', '线条', '特征'];
  if (!anchors.some(a => output.includes(a))) {
    issues.push('缺少视觉锚点');
  }

  if (output.length < 20) {
    issues.push('文案太短');
  }

  // 评分
  let score = 100;
  if (issues.some(i => i.includes('禁用词'))) score -= 40;
  if (issues.some(i => i.includes('空泛'))) score -= 20;
  if (issues.some(i => i.includes('视觉锚点'))) score -= 15;
  if (issues.some(i => i.includes('太短'))) score -= 10;
  if (appliedLessons.length > 0) score += 10;

  return { output, issues, score: Math.min(100, Math.max(0, score)) };
}

// ─── 反思引擎 ────────────────────────────────────

function reflect(episode: { task: string; action: string; score: number; issues: string[] }): string[] {
  const lessons: string[] = [];

  if (episode.issues.some(i => i.includes('禁用词'))) {
    lessons.push('必须检查禁用词，避免使用"善良""有潜力"等空泛表述，用具体行为描述替代');
  }
  if (episode.issues.some(i => i.includes('视觉锚点'))) {
    lessons.push('每条文案必须引用具体手掌特征（手掌/掌心/手指/线条）作为视觉锚点');
  }
  if (episode.issues.some(i => i.includes('空泛'))) {
    lessons.push('避免空泛形容词，使用温和刺痛+精确共鸣的表述方式，让人想截图');
  }
  if (episode.issues.some(i => i.includes('太短'))) {
    lessons.push('文案长度需≥20字，提供足够的细节和场景感');
  }
  if (episode.score < 60) {
    lessons.push('低分任务需要检查合规性、锚点引用和表述质量三个维度');
  }
  if (episode.score >= 80) {
    lessons.push(`高质量输出模式: score=${episode.score}，保持当前策略`);
  }

  return lessons;
}

// ─── 自主进化 Agent ──────────────────────────────

class AutonomousAgent {
  private memory = new MemorySystem();
  private episodeCount = 0;

  async run(task: string): Promise<Episode> {
    this.episodeCount++;
    const topLessons = this.memory.getTopLessons(3);

    // Act
    const start = Date.now();
    const { output, issues, score } = executeTask(task, topLessons);

    // Observe
    const reflection = issues.length > 0
      ? `发现${issues.length}个问题: ${issues.join(', ')}`
      : '任务完成，无问题';

    // Reflect
    const lessons = reflect({ task, action: output, score, issues });
    const elapsed = Date.now() - start;

    const episode: Episode = {
      id: this.episodeCount,
      task,
      action: output,
      score,
      issues,
      reflection,
      lessons,
      timestamp: Date.now(),
    };

    // Learn
    this.memory.addEpisode(episode);

    return episode;
  }

  getMemory() { return this.memory; }
}

// ─── KPI 卡 ──────────────────────────────────────

function printKpi(agent: AutonomousAgent, episodes: Episode[]): void {
  const state = agent.getMemory().getState();
  const topLessons = agent.getMemory().getTopLessons(5);

  console.log('\n  ┌──────────────────────────────────────────────────────────────┐');
  console.log('  │ 🧠 自主进化 Agent — Reflexion 报告' + ' '.repeat(30) + '│');
  console.log('  ├──────────────────────────────────────────────────────────────┤');
  console.log(`  │ Agent 状态:  ${state.totalEpisodes} 轮 · 平均分 ${state.averageScore} · 最高 ${state.topScore}${' '.repeat(30)}│`);
  console.log(`  │ 持续改进:    ${state.improvementRate ? '✅ 正向' : '🔄 学习中'} · 连续失败 ${state.consecutiveFailures}${' '.repeat(22)}│`);
  console.log(`  │ 长期记忆:    ${agent.getMemory().longTerm.lessons.size} 条教训${' '.repeat(32)}│`);
  console.log('  ├──────────────────────────────────────────────────────────────┤');

  for (const ep of episodes) {
    const flag = ep.score >= 80 ? '✅' : ep.score >= 60 ? '⚠️' : '❌';
    const taskShort = ep.task.length > 20 ? ep.task.slice(0, 18) + '..' : ep.task;
    console.log(`  │ ${flag} #${ep.id} ${taskShort.padEnd(20)} ${ep.score}/100  教训:${ep.lessons.length}条${' '.repeat(18)}│`);
  }

  console.log('  ├──────────────────────────────────────────────────────────────┤');
  console.log('  │ 📚 沉淀的教训 (Long-Term Memory):' + ' '.repeat(28) + '│');
  if (topLessons.length === 0) {
    console.log('  │   (暂无，Agent 仍在探索)' + ' '.repeat(33) + '│');
  }
  for (const l of topLessons) {
    const line = l.length > 50 ? l.slice(0, 48) + '..' : l;
    console.log(`  │   • ${line}${' '.repeat(Math.max(1, 50 - line.length))}│`);
  }
  console.log('  └──────────────────────────────────────────────────────────────┘');

  // 知识映射
  console.log('\n  📋 课程映射:');
  console.log('    第7课 Reflexion:  ✓ Act→Observe→Reflect→Learn 闭环');
  console.log('    第7课 记忆系统:   ✓ 短期(10轮) + 长期(教训持久化)');
  console.log('    第7课 自改进:     ✓ Agent 从教训中学习，分数随轮次提升');
  console.log('    复用第6课:        ✓ 合规检查 integrated');
  console.log('    复用第2课:        ✓ report-bridge 数据源');

  // 生产增强
  console.log('\n  📋 生产级增强 TODO:');
  console.log('    [ ] 真正的 LLM 调用（当前是确定性规则引擎）');
  console.log('    [ ] DSPy 自动化 prompt 优化');
  console.log('    [ ] 记忆持久化到 SQLite');
  console.log('    [ ] Agent 自省（元认知监控）');
}

// ─── 主流程 ──────────────────────────────────────

async function main() {
  console.log('═'.repeat(64));
  console.log('  🧠 自主进化 Agent — 第7课: Reflexion + 记忆系统');
  console.log('═'.repeat(64));

  const agent = new AutonomousAgent();
  const episodes: Episode[] = [];

  // 加载报告数据作为任务背景
  const reports = queryReports({});
  const labels = reports.map(r => r.personaLabel);
  console.log(`  🤖 Agent 初始化: 加载 ${reports.length} 份报告数据`);
  console.log(`  人格类型: ${labels.join(', ')}`);

  // 多轮迭代：Agent 逐步改进
  const tasks = [
    `为${labels[0]}生成文案`,
    `为${labels[0]}生成文案，引用视觉特征`,
    `为${labels[0]}生成高质量文案`,
    `为${labels[1]}生成文案`,
    `为${labels[1]}生成高质量文案`,
  ];

  for (let i = 0; i < tasks.length; i++) {
    const ep = await agent.run(tasks[i]);
    episodes.push(ep);
    console.log(`  [${i + 1}/${tasks.length}] #${ep.id} "${ep.action.slice(0, 40)}..." → ${ep.score}/100 ${ep.lessons.length > 0 ? '🧠 learned' : ''}`);
  }

  // 分数趋势
  const scores = episodes.map(e => e.score);
  const trend = scores.length >= 2 && scores[scores.length - 1] > scores[0] ? '↗️  提升' : '→  持平';
  console.log(`  📈 趋势: ${scores.join(' → ')} ${trend}`);

  printKpi(agent, episodes);
}

main().catch(err => { console.error('❌', err); process.exit(1); });
