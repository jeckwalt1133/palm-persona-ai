/**
 * 掌心人格局研究生院 — 课时调度器 v3
 *
 * 每节 ~15 分钟，6 节 = 1 个上课日（~90 分钟）
 *  第1节: 班主任讲授 → 第2节: 学生自学 → 第3节: 批改答疑
 *  → 第4节: 客座讲师 → 第5节: 学生实践 → 第6节: 总结+预习
 *
 * 上课日: 周二/三/五 (cron: 0 9 * * 2,3,5)
 */

const SCHEDULE = [
  { num: 1, name: '班主任讲授', durationMin: 15, action: 'lecture' },
  { num: 2, name: '学生自学+笔记', durationMin: 15, action: 'self_study' },
  { num: 3, name: '班主任批改答疑', durationMin: 15, action: 'grade_qa' },
  { num: 4, name: '客座讲师课', durationMin: 15, action: 'guest_lecture' },
  { num: 5, name: '学生实践', durationMin: 15, action: 'practice' },
  { num: 6, name: '总结+布置预习', durationMin: 15, action: 'summary' },
];

const GUEST_LECTURERS = {
  doubao: { name: '豆包 Seed-2.0-Pro', specialty: '文案审美' },
  qwen: { name: 'Qwen3.6-Flash', specialty: '代码审查/工程质量' },
};

// 根据课程号决定客座讲师
function pickGuestLecturer(lessonNum: number): 'doubao' | 'qwen' {
  // 奇数课: 豆包(文案), 偶数课: 千问(代码)
  return lessonNum % 2 === 1 ? 'doubao' : 'qwen';
}

// 每节课的 Prompt 模板
const SESSION_PROMPTS: Record<string, (lesson: number, topic: string) => string> = {
  lecture: (lesson, topic) =>
    `【第${lesson}课 第1节 — 班主任讲授】
你是班主任。请讲授以下主题的新概念和核心知识：
"${topic}"
要求：15分钟量级，概念清晰，有架构图（ASCII），有代码示例，有常见陷阱。结尾布置本节自学方向。`,

  self_study: (lesson, topic) =>
    `【第${lesson}课 第2节 — 学生自学】
请基于第1节讲授的内容，搜索学习更多细节和最新进展（2026年）。
笔记本铁律：所有知识点写入 student-notebook/yyyy-mm-dd-<topic-slug>.md
要求：至少3个外部来源、至少1个代码示例、至少2个批判性观点。`,

  grade_qa: (lesson, _topic) =>
    `【第${lesson}课 第3节 — 批改答疑】
班主任模式。请审查学生刚写的笔记本文件（student-notebook/ 下最新文件）。
指出：1.错误或理解偏差 2.遗漏的重要知识点 3.改进建议。
给出本节评分（A+到F），更新到成绩单。`,

  guest_lecture: (lesson, topic) =>
    `【第${lesson}课 第4节 — 客座讲师课】
客座讲师将讲授与"${topic}"相关的专业内容。请学生认真听讲并记录笔记。`,

  practice: (lesson, topic) =>
    `【第${lesson}课 第5节 — 学生实践】
请基于前4节所学，完成实践任务：
为掌心人格局项目写可运行代码（TypeScript），验证本节知识点。
交付：代码提交 + student-notebook/ 更新实践心得。
时间：15分钟。`,

  summary: (lesson, topic) =>
    `【第${lesson}课 第6节 — 总结+预习】
班主任模式。请：
1. 总结本节核心收获（3点）
2. 自我评价掌握程度
3. 预习下一课内容
下一课主题提示：${topic}
更新 student-notebook/ 的学习日志。`,
};

export { SCHEDULE, GUEST_LECTURERS, pickGuestLecturer, SESSION_PROMPTS };
