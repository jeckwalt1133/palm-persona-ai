import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState } from 'react';
import RadarCanvas from '../../components/RadarCanvas';
import { apiUrl } from '../../utils/api';
import { playRewardedVideo } from '../../utils/rewarded-video';
import {
  dailyCheckIn,
  getCheckInRecord,
  getUnlockedLines,
  hasPendingUnlock,
  claimLine,
  buildCheckInParagraph,
} from '../../utils/checkin';
import './index.scss';

interface ScoreItem {
  dimension: string;
  dimensionKey: string;
  score: number;
  label: string;
  description: string;
}

interface ReportData {
  id: string;
  createdAt: string;
  personaType: string;
  personaLabel: string;
  scores: ScoreItem[];
  summary: string;
  insights: string[];
  keywords: string[];
  quote: string;
  suspenseText: string;
  coreTruth: string;
  weeklyAdvice: string;
}

// 付费线条入口配置
const PAID_LINES = [
  { key: 'life', label: '生命线', desc: '精力节奏 · 恢复力 · 透支点' },
  { key: 'wisdom', label: '智慧线', desc: '思维模式 · 决策风格 · 学习方式' },
  { key: 'emotion', label: '感情线', desc: '恋爱模式 · 表达方式 · 相处密码' },
  { key: 'career', label: '事业线', desc: '行动节奏 · 领导力 · 适合行业' },
];

// 付费线预览片段（前2句免费展示）
const LINE_PREVIEWS: Record<string, string> = {
  life: '你的精力节奏像潮汐一样有涨有落。恢复力是你的隐藏天赋——你以为自己在透支的时候，其实身体比意识更早知道底线在哪。',
  wisdom: '你处理信息的方式不是线性堆积，而是网状连接。一个看似无关的小事，能在你脑子里串联出一幅大图——这是你最强的思维模式。',
  emotion: '你在关系中的表达方式比你以为的更直接。那些没说出口的话，其实全写在你的微表情和身体语言里——只是你自己没察觉。',
  career: '你的行动节奏不是冲动，是直觉驱动的快速判断。你在面对不确定性时的反应速度远超平均值——不是鲁莽，是天赋。',
};

export default function ReportPage() {
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unlockLevel, setUnlockLevel] = useState<'free' | 'adUnlocked'>('free');
  const [adLoading, setAdLoading] = useState(false);

  // 每日关键词
  const [dailyKeyword, setDailyKeyword] = useState<{ keyword: string; description: string } | null>(null);
  // 签到
  const [checkInDays, setCheckInDays] = useState(0);
  const [checkedInToday, setCheckedInToday] = useState(false);
  const [checkInParagraph, setCheckInParagraph] = useState<string | null>(null);
  const [checkInLoading, setCheckInLoading] = useState(false);
  // 已解锁掌纹线
  const [unlockedLines, setUnlockedLines] = useState<string[]>([]);
  // 待解锁资格 + 选线弹窗
  const [showLinePicker, setShowLinePicker] = useState(false);
  const [claimLoading, setClaimLoading] = useState(false);

  // ── 数据初始化 ──

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const instance = Taro.getCurrentInstance();
      const reportId = instance.router?.params?.id;
      const url = reportId ? apiUrl(`/api/reports/${reportId}`) : apiUrl('/api/reports');
      const res = await Taro.request({ url, method: 'GET' });
      const body = res.data as { success: boolean; data?: ReportData | ReportData[]; error?: { message: string } };

      if (!body.success) {
        setError(body.error?.message || '获取报告失败');
        return;
      }

      if (reportId) {
        setReport(body.data as ReportData);
      } else {
        const list = body.data as ReportData[];
        if (list && list.length > 0) {
          setReport(list[0]);
        } else {
          setError('暂无报告，请先完成一次分析');
        }
      }
    } catch {
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const fetchDailyKeyword = async () => {
    try {
      const res = await Taro.request({ url: apiUrl('/api/daily-keyword'), method: 'GET' });
      const body = res.data as { success: boolean; data: { keyword: string; description: string } };
      if (body.success) setDailyKeyword(body.data);
    } catch {
      // 静默失败
    }
  };

  const fetchCheckInData = async () => {
    try {
      const [record, lines] = await Promise.all([
        getCheckInRecord(),
        getUnlockedLines(),
      ]);
      if (record) {
        setCheckInDays(record.consecutiveDays);
        const today = new Date().toISOString().split('T')[0];
        if (record.lastCheckInDate === today) {
          setCheckedInToday(true);
          setCheckInParagraph(buildCheckInParagraph(record.consecutiveDays));
        }
      }
      setUnlockedLines(lines);
      // 如果已有待解锁资格（比如跨天的第7天），打开选线弹窗
      const pending = await hasPendingUnlock();
      if (pending) {
        setShowLinePicker(true);
      }
    } catch {
      // 静默失败
    }
  };

  const [fetched, setFetched] = useState(false);
  const [keywordFetched, setKeywordFetched] = useState(false);
  const [checkinFetched, setCheckinFetched] = useState(false);
  if (!fetched) {
    fetchReport();
    setFetched(true);
  }
  if (!keywordFetched) {
    fetchDailyKeyword();
    setKeywordFetched(true);
  }
  if (!checkinFetched) {
    fetchCheckInData();
    setCheckinFetched(true);
  }

  // ── 签到 ──
  const handleCheckIn = async () => {
    if (checkInLoading) return;
    setCheckInLoading(true);
    try {
      const result = await dailyCheckIn();
      if (result && result.checkedIn) {
        setCheckedInToday(true);
        setCheckInDays(result.consecutiveDays);
        const msg = buildCheckInParagraph(result.consecutiveDays, result.reward);
        setCheckInParagraph(msg);

        // 检查是否有待解锁资格（第7天）
        const pending = await hasPendingUnlock();
        if (pending) {
          setShowLinePicker(true);
        }
      } else if (result && !result.checkedIn) {
        Taro.showToast({ title: '今天已签到过了', icon: 'none' });
      }
    } catch {
      Taro.showToast({ title: '签到失败，请稍后重试', icon: 'none' });
    } finally {
      setCheckInLoading(false);
    }
  };

  // ── 自选解锁掌纹线 ──
  const handleClaimLine = async (lineKey: string) => {
    if (claimLoading) return;
    setClaimLoading(true);
    try {
      const ok = await claimLine(lineKey);
      if (ok) {
        setUnlockedLines((prev) => [...prev, lineKey]);
        setShowLinePicker(false);
        const label = PAID_LINES.find((l) => l.key === lineKey)?.label ?? lineKey;
        Taro.showToast({ title: `「${label}」已解锁！`, icon: 'success', duration: 2000 });
      } else {
        Taro.showToast({ title: '解锁失败，请重试', icon: 'none' });
      }
    } catch {
      Taro.showToast({ title: '解锁失败，请重试', icon: 'none' });
    } finally {
      setClaimLoading(false);
    }
  };

  // ── 看广告解锁 ──
  const handleWatchAd = async () => {
    setAdLoading(true);
    try {
      const result = await playRewardedVideo();
      if (result.isEnded) {
        setUnlockLevel('adUnlocked');
        Taro.showToast({ title: '解锁成功', icon: 'success', duration: 1500 });
      } else {
        Taro.showToast({ title: '需要看完广告才能解锁哦', icon: 'none' });
      }
    } catch {
      setUnlockLevel('adUnlocked');
    } finally {
      setAdLoading(false);
    }
  };

  // ── 辅助函数 ──
  const top3Scores = (scores: ScoreItem[]) => {
    return [...scores]
      .sort((a, b) => Math.abs(b.score - 50) - Math.abs(a.score - 50))
      .slice(0, 3);
  };

  const mostMisunderstood = (scores: ScoreItem[]) => {
    const extreme = [...scores].sort(
      (a, b) => Math.abs(b.score - 50) - Math.abs(a.score - 50),
    )[0];
    if (!extreme) return null;
    const isHigh = extreme.score > 65;
    const isLow = extreme.score < 35;
    const templates: Record<string, { high: string; low: string }> = {
      emotionalResonance: {
        high: '你以为TA情绪化，其实TA只是不想在你面前藏。',
        low: '你以为TA不在乎，其实TA只是不习惯表达。',
      },
      communicationSync: {
        high: '你以为TA话多，其实TA是在意冷场。',
        low: '你以为TA冷漠，其实TA只是还没想好怎么开口。',
      },
      actionComplement: {
        high: '你以为TA冲动，其实TA已经想了三遍才动手。',
        low: '你以为TA犹豫，其实TA是在等最佳时机。',
      },
      trustPotential: {
        high: '你以为TA对人没防备，其实TA心里有一本账。',
        low: '你以为TA疏远，其实TA只是需要时间相信你。',
      },
      frictionRisk: {
        high: '你以为TA脾气大，其实TA只是不忍了。',
        low: '你以为TA没脾气，其实TA只是不想让你难堪。',
      },
    };
    const t = templates[extreme.dimensionKey];
    if (!t) return `${extreme.dimension}得分${extreme.score}分——你看到的只是冰山一角。`;
    if (isHigh) return t.high;
    if (isLow) return t.low;
    return `${extreme.dimension}得分${extreme.score}分——这比你想象中更说明问题。`;
  };

  // ── 渲染 ──

  if (loading) {
    return (
      <View className="report-page">
        <View className="state-box">
          <Text className="state-text">加载中...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View className="report-page">
        <View className="state-box">
          <Text className="state-text">{error}</Text>
          <View className="btn-back" onClick={() => Taro.reLaunch({ url: '/pages/index/index' })}>
            <Text>返回首页</Text>
          </View>
        </View>
      </View>
    );
  }

  if (!report) return null;

  const radarScores = report.scores.map((s) => ({ label: s.dimension, score: s.score }));
  const coreScores = top3Scores(report.scores);

  return (
    <ScrollView className="report-page" scrollY enableBackToTop>
      {/* ══════ 顶部工具条：关键词 + 签到 ══════ */}
      <View className="top-toolbar">
        {dailyKeyword && (
          <View className="keyword-bar">
            <Text className="keyword-label">今日情绪频率关键词</Text>
            <Text className="keyword-em">{dailyKeyword.keyword}</Text>
          </View>
        )}

        <View className="checkin-bar">
          {checkedInToday ? (
            <View className="checkin-done-card">
              <Text className="checkin-done-icon">📅</Text>
              <View className="checkin-done-body">
                <Text className="checkin-done-title">连签 {checkInDays} 天</Text>
                <Text className="checkin-done-text">{checkInParagraph}</Text>
              </View>
            </View>
          ) : (
            <View
              className={`checkin-btn ${checkInLoading ? 'btn-disabled' : ''}`}
              onClick={handleCheckIn}
            >
              <Text className="checkin-btn-icon">📅</Text>
              <Text className="checkin-btn-title">
                {checkInDays > 0 ? `签到第 ${checkInDays + 1} 天` : '今日签到'}
              </Text>
              <Text className="checkin-btn-sub">
                {checkInDays > 0 ? `已连签 ${checkInDays} 天` : '每日AI洞察'}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* ══════ 第1层：免费 ══════ */}
      {/* 人格标签 */}
      <View className="report-hero">
        <Text className="report-date">{report.createdAt.slice(0, 10)}</Text>
        <Text className="report-label">{report.personaLabel}</Text>
        <Text className="report-type">{report.personaType}</Text>
      </View>

      {/* 一句话核心真相 */}
      <View className="section">
        <View className="card core-truth-card">
          <Text className="truth-icon">✦</Text>
          <Text className="truth-text">{report.coreTruth}</Text>
        </View>
      </View>

      {/* 3个核心维度分数 */}
      <View className="section">
        <Text className="section-title">核心维度</Text>
        {coreScores.map((s, i) => (
          <View key={i} className="score-card">
            <View className="score-card-top">
              <Text className="score-name">{s.dimension}</Text>
              <Text className="score-num">{s.score}</Text>
            </View>
            <Text className="score-label">{s.label}</Text>
            <Text className="score-desc">{s.description}</Text>
          </View>
        ))}

        {/* 免费层→广告层 钩子 */}
        <View className="hidden-dims-teaser">
          <Text className="hidden-dims-lock-icon">🔒</Text>
          <View className="hidden-dims-info">
            <Text className="hidden-dims-title">还有 2 个维度已隐藏</Text>
            <Text className="hidden-dims-sub">看15秒广告解锁完整人格画像</Text>
          </View>
        </View>
      </View>

      {/* 免费层→广告层 钩子 */}
      {unlockLevel === 'free' && (
        <View className="section hook-section">
          <View
            className={`btn-ad-unlock ${adLoading ? 'btn-disabled' : ''}`}
            onClick={handleWatchAd}
          >
            <Text className="btn-ad-icon">▶</Text>
            <View className="btn-ad-text">
              <Text className="btn-ad-title">看15秒广告，解锁完整5维报告</Text>
              <Text className="btn-ad-sub">含完整雷达图 + 深度洞察 + 本周建议</Text>
            </View>
          </View>

          <View className="suspense-bar">
            <Text className="suspense-icon">✦</Text>
            <Text className="suspense-text">{report.suspenseText}</Text>
          </View>
        </View>
      )}

      {/* ══════ 第2层：广告解锁 ══════ */}
      {unlockLevel === 'adUnlocked' && (
        <>
          {/* 完整五维雷达图 */}
          <View className="section">
            <Text className="section-title">五维人格图谱</Text>
            <RadarCanvas scores={radarScores} size={580} />
          </View>

          {/* 5 维维度解析 */}
          <View className="section">
            <Text className="section-title">维度深度解析</Text>
            {report.scores.map((s, i) => (
              <View key={i} className="score-card">
                <View className="score-card-top">
                  <Text className="score-name">{s.dimension}</Text>
                  <Text className="score-num">{s.score}</Text>
                </View>
                <Text className="score-label">{s.label}</Text>
                <Text className="score-desc">{s.description}</Text>
              </View>
            ))}
          </View>

          {/* 3条深度洞察 */}
          {report.insights.length > 0 && (
            <View className="section">
              <Text className="section-title">深度关系洞察</Text>
              {report.insights.map((insight, i) => (
                <View key={i} className="insight-row">
                  <Text className="insight-dot">✦</Text>
                  <Text className="insight-text">{insight}</Text>
                </View>
              ))}
            </View>
          )}

          {/* 被误解最深点 */}
          <View className="section">
            <Text className="section-title">你最容易被误解的地方</Text>
            <View className="card misunderstood-card">
              <Text className="misunderstood-text">
                {mostMisunderstood(report.scores)}
              </Text>
            </View>
          </View>

          {/* 本周建议 */}
          <View className="section">
            <Text className="section-title">本周建议</Text>
            <View className="card advice-card">
              <Text className="advice-text">{report.weeklyAdvice}</Text>
            </View>
          </View>

          {/* 给你的话 */}
          <View className="section">
            <Text className="section-title">给你的话</Text>
            <View className="card quote-card">
              <Text className="quote-mark">"</Text>
              <Text className="card-text">{report.quote}</Text>
            </View>
          </View>

          {/* ══════ 第3层：付费入口 ══════ */}
          <View className="section">
            <Text className="section-title">每条掌纹线的深度解读</Text>
            <Text className="paid-intro">
              每条线都有独特的含义——你的掌纹里藏着更多关于你的事。
            </Text>

            {/* 广告层→付费层 钩子 */}
            <View className="paid-tier-hint">
              <Text className="paid-hint-icon">🔓</Text>
              <Text className="paid-hint-text">
                你的生命线/智慧线/感情线/事业线还没解读——想看哪条？
              </Text>
            </View>

            {PAID_LINES.map((line) => {
              const isUnlocked = unlockedLines.includes(line.key);
              const preview = LINE_PREVIEWS[line.key];
              return (
                <View key={line.key} className={`paid-line-card ${isUnlocked ? 'paid-line-unlocked' : ''}`}>
                  <View className="paid-line-info">
                    <Text className="paid-line-name">{line.label}</Text>
                    <Text className="paid-line-desc">{line.desc}</Text>
                    {preview && (
                      <View className="paid-line-preview-area">
                        <Text className="paid-line-preview-text">{preview}</Text>
                        {!isUnlocked && (
                          <View className="paid-line-blur-overlay">
                            <Text className="paid-line-lock-icon">🔒</Text>
                            <Text className="paid-line-blur-hint">解锁后查看完整解读</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                  <View className="paid-line-price">
                    {isUnlocked ? (
                      <View className="paid-status-unlocked">
                        <Text className="paid-unlocked-text">已解锁 ✓</Text>
                      </View>
                    ) : (
                      <>
                        <Text className="paid-price-tag">¥1.99</Text>
                        <Text className="paid-share-hint">或分享给3个朋友免费解锁</Text>
                      </>
                    )}
                  </View>
                </View>
              );
            })}

            {/* 全家桶 + 角标 */}
            <View className="paid-bundle-card">
              <View className="bundle-badge">省3块</View>
              <View className="bundle-info">
                <Text className="bundle-name">四条线全家桶</Text>
                <Text className="bundle-desc">原价¥7.96 · 省¥2.97</Text>
              </View>
              <View className="bundle-price-area">
                <Text className="bundle-price">¥4.99</Text>
                <Text className="paid-share-hint">解锁全部四条线</Text>
              </View>
            </View>
          </View>
        </>
      )}

      {/* 底部导航 */}
      <View className="bottom-bar">
        <View className="btn-home" onClick={() => Taro.reLaunch({ url: '/pages/index/index' })}>
          <Text>返回首页</Text>
        </View>
      </View>

      {/* ══════ 自选解锁弹窗 ══════ */}
      {showLinePicker && (
        <View className="modal-overlay" onClick={() => setShowLinePicker(false)}>
          <View className="modal-content" onClick={(e) => e.stopPropagation()}>
            <Text className="modal-title">恭喜获得自选解锁资格 🎉</Text>
            <Text className="modal-desc">连续签到第7天成就达成！选择一条你想深度解读的掌纹线：</Text>
            {PAID_LINES.filter((l) => !unlockedLines.includes(l.key)).map((line) => (
              <View
                key={line.key}
                className={`modal-line-option ${claimLoading ? 'btn-disabled' : ''}`}
                onClick={() => handleClaimLine(line.key)}
              >
                <Text className="modal-line-name">{line.label}</Text>
                <Text className="modal-line-desc">{line.desc}</Text>
              </View>
            ))}
            <View className="modal-close" onClick={() => setShowLinePicker(false)}>
              <Text>稍后再说</Text>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}
