import { getDb } from './connection.js';
import { migrate } from './migrate.js';

/** 种子数据 — 仅在开发环境使用。生产环境通过管理后台录入。 */
export function seed(dbPath?: string): void {
  // 先执行迁移确保表存在
  migrate(dbPath);

  const db = getDb(dbPath);

  const userCount = db.prepare('SELECT COUNT(*) AS "c" FROM "user"').get() as { c: number };
  if (userCount.c > 0) {
    console.log('[seed] 数据库已有数据，跳过种子');
    return;
  }

  console.log('[seed] 写入种子数据...');

  const now = new Date().toISOString();

  // ─── 用户 ──────────────────────────────────────────
  const users = [
    { id: 'demo-user-001', nickname: '测试用户小掌', avatar_url: null },
    { id: 'demo-user-002', nickname: '云上旅人', avatar_url: null },
  ];

  const insertUser = db.prepare(
    'INSERT INTO "user"("id","nickname","avatar_url","palm_image_count","unlocked_lines_json","created_at","updated_at") VALUES(?,?,?,?,?,?,?)',
  );
  for (const u of users) {
    insertUser.run(u.id, u.nickname, u.avatar_url, 0, '[]', now, now);
  }

  // ─── 报告 ──────────────────────────────────────────
  const demoReport = {
    id: 'demo-report-001',
    userId: 'demo-user-001',
    personaType: 'explorer',
    personaLabel: '探索者',
    scoresJson: JSON.stringify([
      { dimension: '生命力', dimensionKey: 'life', score: 78, label: '活力充沛', description: '你拥有旺盛的好奇心' },
      { dimension: '思维力', dimensionKey: 'wisdom', score: 85, label: '深度思考', description: '善于从多角度分析问题' },
      { dimension: '情感力', dimensionKey: 'emotion', score: 72, label: '温和敏感', description: '感知力强但不易外露' },
      { dimension: '行动力', dimensionKey: 'career', score: 80, label: '果断执行', description: '有了方向就迅速行动' },
    ]),
    summary: '你是一个充满好奇心的探索者，拥有敏锐的洞察力和坚定的执行力。',
    insightsJson: JSON.stringify([
      '面对挑战时你展现出超常的韧性',
      '你的思维模式偏向系统化分析',
      '在人际互动中你更注重质量而非数量',
    ]),
    keywordsJson: JSON.stringify(['探索', '韧性', '洞察', '独立', '创造']),
    quote: '真正的发现之旅不在于寻找新风景，而在于拥有新的眼睛。',
    suspenseText: '你的手掌揭示了一个重要的秘密...',
    coreTruth: '你内心深处渴望自由和理解，这是驱动你前进的根本力量。',
    weeklyAdvice: '本周适合放慢脚步，给自己一些独处和反思的时间。',
    visualAnchorsJson: JSON.stringify({
      opening: '清晰的智慧线',
      widthLabel: '中等掌宽',
      fingerLabel: '修长手指',
      clarityLabel: '纹路清晰',
      lineCountLabel: '三主线分明',
      prominentMount: '金星丘饱满',
      palmWidth: 7.8,
      lineClarity: 0.85,
      lineCount: 3,
      fingerLengthRatio: 0.92,
      widthPercentile: '65%',
      clarityPercentile: '78%',
      lineCountPercentile: '50%',
      fingerPercentile: '72%',
    }),
    identityBadge: '🏅 探索者勋章',
    adTeaser: '想看看你与哪位名人最相似？',
    relationshipCodeJson: JSON.stringify({
      frequencyLabel: '深度对话型',
      signalPattern: '偶尔主动但每次都有深度',
      bestMatchType: '温和守护型',
      tensionPoint: '情绪表达的频率差异',
    }),
    celebrityMatchesJson: JSON.stringify([
      { name: '达芬奇', title: '文艺复兴全才', reason: '同样拥有永不满足的好奇心和跨领域思维' },
    ]),
    feedbackRating: null,
    feedbackComment: null,
    complianceChecked: 1,
  };

  const insertReport = db.prepare(
    `INSERT INTO "report"(
      "id","user_id","persona_type","persona_label","scores_json","summary",
      "insights_json","keywords_json","quote","suspense_text","core_truth",
      "weekly_advice","visual_anchors_json","identity_badge","ad_teaser",
      "relationship_code_json","celebrity_matches_json",
      "feedback_rating","feedback_comment","compliance_checked",
      "created_at","updated_at"
    ) VALUES(${Array(22).fill('?').join(',')})`,
  );
  insertReport.run(
    demoReport.id, demoReport.userId, demoReport.personaType, demoReport.personaLabel,
    demoReport.scoresJson, demoReport.summary,
    demoReport.insightsJson, demoReport.keywordsJson, demoReport.quote,
    demoReport.suspenseText, demoReport.coreTruth,
    demoReport.weeklyAdvice, demoReport.visualAnchorsJson, demoReport.identityBadge,
    demoReport.adTeaser,
    demoReport.relationshipCodeJson, demoReport.celebrityMatchesJson,
    demoReport.feedbackRating, demoReport.feedbackComment, demoReport.complianceChecked,
    now, now,
  );

  // ─── 签到 ──────────────────────────────────────────
  const dates = [];
  const baseDate = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }

  const insertCheckin = db.prepare(
    'INSERT INTO "checkin"("user_id","checkin_date","consecutive_days","total_days","reward","created_at") VALUES(?,?,?,?,?,?)',
  );
  for (let i = 0; i < dates.length; i++) {
    const consecutive = i + 1;
    let reward: string | null = null;
    if (consecutive === 1) reward = '今日金句解锁';
    else if (consecutive === 3) reward = '深度分析体验卡 ×1';
    else if (consecutive === 5) reward = '专属人格标签解锁';
    else if (consecutive === 7) reward = '自选深度维度资格';
    insertCheckin.run('demo-user-001', dates[i], consecutive, consecutive, reward, now);
  }

  // 更新用户的签到统计
  db.prepare('UPDATE "user" SET "palm_image_count"=? WHERE "id"=?').run(1, 'demo-user-001');

  // 更新 demo-user-001 的 unlocked_lines
  db.prepare('UPDATE "user" SET "unlocked_lines_json"=? WHERE "id"=?').run(
    JSON.stringify(['life']),
    'demo-user-001',
  );

  console.log(`[seed] ✓ 种子数据写入完成: ${users.length} 用户, 1 报告, ${dates.length} 签到`);
}

/** 独立运行: node --import tsx src/db/seed.ts */
if (process.argv[1]?.includes('seed')) {
  seed();
  console.log('[seed] 退出');
  process.exit(0);
}
