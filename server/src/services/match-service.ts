import { CompatibilityEngine, MockCompatibilityEngine } from '../engine/compatibility-engine.js';
import { MatchRepository, SqliteMatchRepository } from '../repository/match-repository.js';
import { ContentSafety, defaultSafety } from '../safety/content-safety.js';
import { MatchInvite, CompatibilityResult, PersonaReport } from '../engine/types.js';
import { simpleHash } from '../utils/hash.js';

// 报告查询接口（由 analysisService 实现，避免仓库分裂）
export interface ReportLookup {
  getReport(id: string): Promise<PersonaReport | null>;
}

export interface MatchService {
  createInvite(reportId: string): Promise<MatchInvite>;
  joinMatch(matchId: string, reportId: string): Promise<MatchInvite>;
  getMatchStatus(matchId: string): Promise<MatchInvite | null>;
  getMatchResult(matchId: string): Promise<CompatibilityResult | null>;
}

export class MockMatchService implements MatchService {
  private engine: CompatibilityEngine;
  private reportLookup: ReportLookup;
  private matchRepo: MatchRepository;
  private safety: ContentSafety;

  constructor(
    reportLookup: ReportLookup,
    engine?: CompatibilityEngine,
    matchRepo?: MatchRepository,
  ) {
    this.engine = engine ?? new MockCompatibilityEngine();
    this.reportLookup = reportLookup;
    this.matchRepo = matchRepo ?? new SqliteMatchRepository();
    this.safety = defaultSafety;
  }

  async createInvite(reportId: string): Promise<MatchInvite> {
    const report = await this.reportLookup.getReport(reportId);
    if (!report) {
      throw new Error('报告不存在');
    }

    const now = Date.now();
    const id = `match_${simpleHash(reportId + String(now)).toString(36)}`;

    const invite: MatchInvite = {
      id,
      inviterReportId: reportId,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7天过期
      status: 'pending',
    };

    await this.matchRepo.save(invite);
    return invite;
  }

  async joinMatch(matchId: string, reportId: string): Promise<MatchInvite> {
    const invite = await this.matchRepo.findById(matchId);
    if (!invite) {
      throw new Error('匹配邀请不存在');
    }

    if (invite.status !== 'pending') {
      throw new Error('匹配邀请已失效');
    }

    if (new Date(invite.expiresAt) < new Date()) {
      invite.status = 'expired';
      await this.matchRepo.save(invite);
      throw new Error('匹配邀请已过期');
    }

    const reportA = await this.reportLookup.getReport(invite.inviterReportId);
    const reportB = await this.reportLookup.getReport(reportId);
    if (!reportA || !reportB) {
      throw new Error('报告数据异常');
    }

    // 执行匹配计算
    const result = this.engine.match(reportA.scores, reportB.scores);

    // 安全过滤
    const safetyResult = this.safety.check(result.summary);
    if (!safetyResult.safe) {
      result.summary = safetyResult.filteredText;
    }

    invite.status = 'joined';
    invite.joinerReportId = reportId;
    invite.result = result;

    await this.matchRepo.save(invite);
    return invite;
  }

  async getMatchStatus(matchId: string): Promise<MatchInvite | null> {
    const invite = await this.matchRepo.findById(matchId);
    if (!invite) return null;

    // 检查过期
    if (invite.status === 'pending' && new Date(invite.expiresAt) < new Date()) {
      invite.status = 'expired';
      await this.matchRepo.save(invite);
    }

    return invite;
  }

  async getMatchResult(matchId: string): Promise<CompatibilityResult | null> {
    const invite = await this.matchRepo.findById(matchId);
    if (!invite || invite.status !== 'joined') return null;
    return invite.result ?? null;
  }
}

// 延迟初始化（避免循环依赖）
let _matchService: MockMatchService | null = null;

export function getMatchService(reportLookup: ReportLookup): MockMatchService {
  if (!_matchService) {
    _matchService = new MockMatchService(reportLookup);
  }
  return _matchService;
}
