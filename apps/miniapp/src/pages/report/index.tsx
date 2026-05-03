import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState } from 'react';
import RadarCanvas from '../../components/RadarCanvas';
import { apiUrl } from '../../utils/api';
import { playRewardedVideo } from '../../utils/rewarded-video';
import { dailyCheckIn, getCheckInRecord, getUnlockedLines, buildCheckInMessage } from '../../utils/checkin';
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
  const [checkInMessage, setCheckInMessage] = useState<string | null>(null);
  const [checkInLoading, setCheckInLoading] = useState(false);
  // 已解锁掌纹线
  const [unlockedLines, setUnlockedLines] = useState<string[]>([]);

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
      // 静默失败，不影响主内容
    }
  };

  const fetchCheckInData = async () => {
    try {
      const record = await getCheckInRecord();
      if (record) {
        setCheckInDays(record.consecutiveDays);
        // 判断今天是否已签到
        const today = new Date().toISOString().split('T')[0];
        if (record.lastCheckInDate === today) {
          setCheckedInToday(true);
          setCheckInMessage(buildCheckInMessage(record.consecutiveDays));
        }
      }
      const lines = await getUnlockedLines();
      setUnlockedLines(lines);
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
        const msg = buildCheckInMessage(result.consecutiveDays, result.reward);
        setCheckInMessage(msg);
        Taro.showToast({ title: `连签 ${result.consecutiveDays} 天`, icon: 'success', duration: 2000 });
        // 重新拉取解锁状态（有可能触发了解锁）
        const lines = await getUnlockedLines();
        setUnlockedLines(lines);
      } else if (result && !result.checkedIn) {
        Taro.showToast({ title: '今天已签到过了', icon: 'none' });
      }
    } catch {
      Taro.showToast({ title: '签到失败，请稍后重试', icon: 'none' });
    } finally {
      setCheckInLoading(false);
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
            <Text className="keyword-icon">✦</Text>
            <Text className="keyword-text">
              今日关键词：<Text className="keyword-em">{dailyKeyword.keyword}</Text>
            </Text>
          </View>
        )}

        <View className="checkin-bar">
          {checkedInToday ? (
            <Text className="checkin-done-text">
              📍 连签 {checkInDays} 天 · {checkInMessage}
            </Text>
          ) : (
            <View
              className={`checkin-btn ${checkInLoading ? 'btn-disabled' : ''}`}
              onClick={handleCheckIn}
            >
              <Text className="checkin-btn-icon">📅</Text>
              <Text className="checkin-btn-text">
                {checkInDays > 0 ? `签到第 ${checkInDays + 1} 天` : '今日签到'}
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

        {/* 免费层→广告层 钩子：还有2维隐藏 */}
        <View className="hidden-dims-teaser">
          <Text className="hidden-dims-lock-icon">🔒</Text>
          <View className="hidden-dims-info">
            <Text className="hidden-dims-title">还有 2 个维度已隐藏</Text>
            <Text className="hidden-dims-sub">看15秒广告解锁完整五维人格图谱</Text>
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

          {/* ══════ 第3层：付费入口（含付费钩子提示） ══════ */}
          <View className="section">
            <Text className="section-title">每条掌纹线的深度解读</Text>
            <Text className="paid-intro">
              每条线都有独特的含义——你的掌纹里藏着更多关于你的事。
            </Text>

            {/* 广告层→付费层 钩子 */}
            <View className="paid-tier-hint">
              <Text className="paid-hint-icon">🔓</Text>
              <Text className="paid-hint-text">
                每条线的深度解读还没打开{unlockedLines.length > 0 ? '——签到已解锁部分线路' : '，签到7天免费解锁一条'}
              </Text>
            </View>

            {PAID_LINES.map((line) => {
              const isUnlocked = unlockedLines.includes(line.key);
              return (
                <View key={line.key} className={`paid-line-card ${isUnlocked ? 'paid-line-unlocked' : ''}`}>
                  <View className="paid-line-info">
                    <Text className="paid-line-name">{line.label}</Text>
                    <Text className="paid-line-desc">{line.desc}</Text>
                  </View>
                  <View className="paid-line-price">
                    {isUnlocked ? (
                      <View className="paid-status-unlocked">
                        <Text className="paid-unlocked-text">已解锁</Text>
                      </View>
                    ) : (
                      <>
                        <Text className="paid-price-tag">¥1.99</Text>
                        <View className="paid-status-tag">
                          <Text className="paid-status-text">即将开放</Text>
                        </View>
                      </>
                    )}
                  </View>
                </View>
              );
            })}
            <View className="paid-bundle-card">
              <View className="bundle-info">
                <Text className="bundle-name">四条线全家桶</Text>
                <Text className="bundle-desc">原价¥7.96 · 省¥2.97</Text>
              </View>
              <View className="bundle-price-area">
                <Text className="bundle-price">¥4.99</Text>
                <View className="paid-status-tag">
                  <Text className="paid-status-text">即将开放</Text>
                </View>
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
    </ScrollView>
  );
}
