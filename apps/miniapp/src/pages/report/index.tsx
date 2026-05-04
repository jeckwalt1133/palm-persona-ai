import { View, Text, ScrollView, Button } from '@tarojs/components';
import Taro, { useShareAppMessage, useShareTimeline } from '@tarojs/taro';
import { useState } from 'react';
import RadarCanvas from '../../components/RadarCanvas';
import { apiUrl } from '../../utils/api';
import { playRewardedVideo } from '../../utils/rewarded-video';
import { track, EventType } from '../../utils/analytics';
import {
  dailyCheckIn,
  getCheckInRecord,
  getUnlockedLines,
  hasPendingUnlock,
  claimLine,
  buildCheckInParagraph,
} from '../../utils/checkin';
import { getMostMisunderstood } from '../../utils/reportUtils';
import PosterCanvas from '../../components/PosterCanvas';
import { captureAndSave } from '../../utils/poster';
import { resolveShareCopy } from '../../utils/shareCopyMatcher';
import './index.scss';

interface ScoreItem {
  dimension: string;
  dimensionKey: string;
  score: number;
  label: string;
  description: string;
}

interface VisualAnchorsData {
  opening: string;
  widthLabel: string;
  fingerLabel: string;
  clarityLabel: string;
  lineCountLabel: string;
  prominentMount: string;
  palmWidth: number;
  lineClarity: number;
  lineCount: number;
  fingerLengthRatio: number;
  widthPercentile: string;
  clarityPercentile: string;
  lineCountPercentile: string;
  fingerPercentile: string;
}

interface CelebrityMatch {
  name: string;
  title: string;
  reason: string;
}

interface RelationshipCode {
  frequencyLabel: string;
  signalPattern: string;
  bestMatchType: string;
  tensionPoint: string;
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
  visualAnchors?: VisualAnchorsData;
  identityBadge?: string;
  adTeaser?: string;
  relationshipCode?: RelationshipCode;
  celebrityMatches?: CelebrityMatch[];
}

// 付费解读维度配置
const PAID_LINES = [
  { key: 'life', label: '活力密码', desc: '精力节奏 · 恢复力 · 透支点' },
  { key: 'wisdom', label: '思维密码', desc: '思维模式 · 决策风格 · 学习方式' },
  { key: 'emotion', label: '情感密码', desc: '恋爱模式 · 表达方式 · 相处密码' },
  { key: 'career', label: '行动密码', desc: '行动节奏 · 领导力 · 适合行业' },
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
  // 海报
  const [posterVisible, setPosterVisible] = useState(false);
  const [posterCardIndex, setPosterCardIndex] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [savingPoster, setSavingPoster] = useState(false);
  const posterCanvasId = `poster_${Math.random().toString(36).slice(2, 10)}`;

  // ── 数据初始化 ──

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const instance = Taro.getCurrentInstance();
      const reportId = instance.router?.params?.id;
      const url = reportId ? apiUrl(`/api/reports/${reportId}`) : apiUrl('/api/reports');
      const res = await Taro.request({ url, method: 'GET', timeout: 30000 });
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
      } else {
        Taro.showToast({ title: '签到失败，请稍后重试', icon: 'none' });
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

  // ── 海报保存 ──
  const handleSavePoster = async (cardIndex: 1 | 2 | 3 | 4 | 5 | 6) => {
    if (savingPoster) return;
    setSavingPoster(true);
    setPosterCardIndex(cardIndex);
    setPosterVisible(true);

    track(EventType.SHARE_CLICK, {
      action: 'save_poster',
      card_index: String(cardIndex),
      persona_type: report?.personaType ?? '',
    });

    // 等待 Canvas 渲染完成
    await new Promise((r) => setTimeout(r, 600));

    try {
      await captureAndSave(posterCanvasId, report?.personaLabel ?? '');
    } finally {
      setSavingPoster(false);
      setPosterVisible(false);
    }
  };

  // ── 分享配置 ──
  const [shareImageUrl] = useState<string | undefined>();
  useShareAppMessage(() => {
    const title = report
      ? `AI说我是「${report.personaLabel}」——你也来拍一张，看看AI怎么说你`
      : '拍一张手掌，看看AI读出了怎样的你';
    return {
      title,
      path: '/pages/index/index',
      imageUrl: shareImageUrl,
    };
  });

  useShareTimeline(() => {
    const title = report
      ? `AI说我是「${report.personaLabel}」——你也来测测`
      : '掌心人格局 — AI人格分析';
    return {
      title,
      path: '/pages/index/index',
    };
  });

  // ── 渲染 ──

  if (loading) {
    return (
      <View className="report-page">
        <View className="state-box">
          <View className="ap-pulse-ring">
            <View className="ap-pulse-inner" />
          </View>
          <Text className="state-text">正在生成你的报告...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View className="report-page">
        <View className="state-box">
          <View className="ap-pulse-ring">
            <View className="ap-pulse-inner" />
          </View>
          <Text className="state-text">{error}</Text>
          <View className="btn-retry" onClick={() => {
            setError(null);
            setFetched(false);
          }}>
            <Text>重新加载</Text>
          </View>
          <View className="btn-back" onClick={() => Taro.reLaunch({ url: '/pages/index/index' })}>
            <Text>返回首页</Text>
          </View>
        </View>
      </View>
    );
  }

  if (!report) return null;

  const radarScores = report.scores.map((s) => ({ label: s.dimension, score: s.score }));

  return (
    <>
    <ScrollView className="report-page" scrollY enableBackToTop enhanced bounces={false}>
      {/* ══════ 第1层：免费 ══════ */}
      {/* 人格标签 */}
      <View className="report-hero">
        <Text className="report-label">{report.personaLabel}</Text>
        {report.identityBadge && (
          <Text className="report-badge">{report.identityBadge}</Text>
        )}
      </View>

      {/* 每日关键词 — 留存钩子，每天不同 */}
      {dailyKeyword && (
        <View className="daily-keyword-hero">
          <Text className="daily-keyword-date">{new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' })}</Text>
          <Text className="daily-keyword-badge">{dailyKeyword.keyword}</Text>
          <Text className="daily-keyword-desc">{dailyKeyword.description}</Text>
          <Text className="daily-keyword-hint">明天同一时间，你的关键词会变</Text>
        </View>
      )}

      {/* 视觉锚点：AI真的分析了你的手掌 + 社交比较 */}
      {report.visualAnchors && (
        <View className="section">
          <Text className="section-title">AI 从你的手掌读取到</Text>
          <View className="card visual-anchors-card">
            <Text className="va-opening">{report.visualAnchors.opening}</Text>
            <View className="va-features-row">
              <View className="va-feature-item">
                <Text className="va-feature-val">{report.visualAnchors.widthLabel}</Text>
                <Text className="va-feature-label">{report.visualAnchors.widthPercentile}</Text>
              </View>
              <View className="va-feature-divider" />
              <View className="va-feature-item">
                <Text className="va-feature-val">{report.visualAnchors.clarityLabel}</Text>
                <Text className="va-feature-label">{report.visualAnchors.clarityPercentile}</Text>
              </View>
            </View>
            <View className="va-features-row">
              <View className="va-feature-item">
                <Text className="va-feature-val">{report.visualAnchors.lineCountLabel}</Text>
                <Text className="va-feature-label">{report.visualAnchors.lineCountPercentile}</Text>
              </View>
              <View className="va-feature-divider" />
              <View className="va-feature-item">
                <Text className="va-feature-val">{report.visualAnchors.fingerLabel}</Text>
                <Text className="va-feature-label">{report.visualAnchors.fingerPercentile}</Text>
              </View>
            </View>
          </View>
          <View className="va-comparison-hint">
            <Text className="va-comparison-text">把你的数据发出去——看看朋友圈里有谁跟你一样</Text>
          </View>
        </View>
      )}

      {/* 一句话核心真相 */}
      <View className="section">
        <View className="card core-truth-card">
          <Text className="truth-text">{report.coreTruth}</Text>
        </View>
        <View className="share-hint">
          <Text className="share-hint-text">截图发给那个你想到的人——TA会懂的</Text>
        </View>
      </View>

      {/* 免费层→广告层 钩子 */}
      {unlockLevel === 'free' && (
        <View className="section hook-section">
          <View
            className={`btn-ad-unlock ${adLoading ? 'btn-disabled' : ''}`}
            onClick={handleWatchAd}
          >
            <View className="btn-ad-text">
              <Text className="btn-ad-title">查看5维人格得分与深度解读</Text>
              <Text className="btn-ad-sub">解锁你的完整人格图谱——含5维雷达图、关系洞察、被误解的那一面、本周建议</Text>
            </View>
            <Text className="btn-ad-arrow">&rsaquo;</Text>
          </View>

          <View className="suspense-bar">
            <Text className="suspense-text">{report.adTeaser ?? report.suspenseText}</Text>
          </View>

          <View className="dev-unlock" onClick={() => setUnlockLevel('adUnlocked')}>
            <Text className="dev-unlock-text">[开发模式] 跳过广告</Text>
          </View>
        </View>
      )}

      {/* ══════ 第2层：广告解锁 ══════ */}
      {unlockLevel === 'adUnlocked' && (
        <>
          {/* 解锁提示 */}
          <View className="section">
            <View className="unlock-banner">
              <Text className="unlock-banner-icon">{'>'}</Text>
              <Text className="unlock-banner-text">完整人格报告已解锁</Text>
            </View>
          </View>

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
                <View className="score-bar-track">
                  <View className="score-bar-fill" style={{ width: `${s.score}%` }} />
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
                {getMostMisunderstood(report.scores)}
              </Text>
            </View>
          </View>

          {/* 关系频率密码 */}
          {report.relationshipCode && (
            <View className="section">
              <Text className="section-title">你的关系频率密码</Text>
              <View className="card rel-code-card">
                <View className="rel-code-badge">
                  <Text className="rel-code-badge-text">{report.relationshipCode.frequencyLabel}</Text>
                </View>
                <View className="rel-code-section">
                  <Text className="rel-code-label">信号模式</Text>
                  <Text className="rel-code-text">{report.relationshipCode.signalPattern}</Text>
                </View>
                <View className="rel-code-section">
                  <Text className="rel-code-label">最佳同频</Text>
                  <Text className="rel-code-text">{report.relationshipCode.bestMatchType}</Text>
                </View>
                <View className="rel-code-section">
                  <Text className="rel-code-label">关系张力</Text>
                  <Text className="rel-code-text">{report.relationshipCode.tensionPoint}</Text>
                </View>
              </View>
              <View className="share-hint">
                <Text className="share-hint-text">发给朋友，看看TA是不是你的"最佳同频"</Text>
              </View>
            </View>
          )}

          {/* 名人彩蛋 */}
          {report.celebrityMatches && report.celebrityMatches.length > 0 && (
            <View className="section">
              <Text className="section-title">你的「名人同频」彩蛋</Text>
              {report.celebrityMatches.map((match, i) => (
                <View key={i} className="card celebrity-card">
                  <View className="celebrity-header">
                    <Text className="celebrity-name">{match.name}</Text>
                    <Text className="celebrity-title">{match.title}</Text>
                  </View>
                  <Text className="celebrity-reason">{match.reason}</Text>
                </View>
              ))}
              <View className="share-hint">
                <Text className="share-hint-text">截图发给那个懂你的人——TA会知道为什么像</Text>
              </View>
            </View>
          )}

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
            <Text className="section-title">深度人格维度解读</Text>
            <Text className="paid-intro">
              每个维度都有独特的含义——你的手掌里藏着更多关于你的事。
            </Text>

            {/* 广告层→付费层 钩子 */}
            <View className="paid-tier-hint">
              <Text className="paid-hint-icon">{'>'}</Text>
              <Text className="paid-hint-text">
                你的活力密码 / 思维密码 / 情感密码 / 行动密码还没解读——想看哪个？
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
                            <Text className="paid-line-lock-icon">+</Text>
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
                <Text className="bundle-name">四个维度全家桶</Text>
                <Text className="bundle-desc">原价¥7.96 · 省¥2.97</Text>
              </View>
              <View className="bundle-price-area">
                <Text className="bundle-price">¥4.99</Text>
                <Text className="paid-share-hint">解锁全部四个维度</Text>
              </View>
            </View>
          </View>
        </>
      )}

      {/* ══════ 保存海报 ══════ */}
      {unlockLevel === 'adUnlocked' && (
        <View className="section">
          <Text className="section-title">保存分享海报</Text>
          <View className="poster-btns-grid">
            {([1, 2, 3, 4, 5, 6] as const).map((idx) => (
              <View
                key={idx}
                className={`poster-save-btn ${savingPoster ? 'btn-disabled' : ''}`}
                onClick={() => handleSavePoster(idx)}
              >
                <Text className="poster-save-label">
                  {idx === 1 ? '人格身份证' : idx === 2 ? '被误解的真相' : idx === 3 ? '关系频率密码' : idx === 4 ? '手掌特征解读' : idx === 5 ? '名人彩蛋' : '本周建议'}
                </Text>
                <Text className="poster-save-sub">保存到相册</Text>
              </View>
            ))}
          </View>
          {savingPoster && (
            <View className="poster-saving-hint">
              <Text className="poster-saving-text">正在生成海报...</Text>
            </View>
          )}
        </View>
      )}

      {/* 底部：签到 + 分享 + 返回 */}
      <View className="bottom-bar">
        {checkedInToday && checkInParagraph ? (
          <View className="checkin-done-card">
            <Text className="checkin-done-icon">{'>'}</Text>
            <View className="checkin-done-body">
              <Text className="checkin-done-title">{checkInDays}</Text>
              <Text className="checkin-done-text">{checkInParagraph}</Text>
            </View>
          </View>
        ) : (
          <View className="checkin-bar">
            <View className="checkin-btn" onClick={handleCheckIn}>
              <Text className="checkin-btn-title">{checkInDays > 0 ? `${checkInDays}` : '签到'}</Text>
              <Text className="checkin-btn-sub">{checkInDays > 0 ? '连续签到领解锁资格' : '每天签到，第7天解锁一个深度维度'}</Text>
            </View>
          </View>
        )}

        {process.env.TARO_ENV === 'h5' ? (
          <View
            className="btn-share"
            onClick={() => {
              const shareTitle = report
                ? `AI说我是「${report.personaLabel}」——你也来测测`
                : '掌心人格局 — AI人格分析';
              const shareUrl = window.location.href;
              if (navigator.share) {
                navigator.share({ title: shareTitle, url: shareUrl }).catch(() => {});
              } else {
                navigator.clipboard?.writeText(`${shareTitle} ${shareUrl}`).then(() => {
                  Taro.showToast({ title: '链接已复制，粘贴给朋友吧', icon: 'none' });
                }).catch(() => {});
              }
            }}
          >
            发给朋友，看看谁更懂你
          </View>
        ) : (
          <Button className="btn-share" open-type="share">
            发给朋友，看看谁更懂你
          </Button>
        )}
        <View className="bottom-invite">
          <Text className="bottom-invite-text">
            已有 128,634 人通过手掌了解了自己——你的朋友可能也在其中
          </Text>
        </View>
        <View className="btn-home" onClick={() => Taro.reLaunch({ url: '/pages/index/index' })}>
          <Text>返回首页</Text>
        </View>
      </View>

      {/* ══════ 自选解锁弹窗 ══════ */}
      {showLinePicker && (
        <View className="modal-overlay" onClick={() => setShowLinePicker(false)}>
          <View className="modal-content" onClick={(e) => e.stopPropagation()}>
            <Text className="modal-title">自选解锁资格已达成</Text>
            <Text className="modal-desc">连续签到第7天成就达成！选择一个你想深度解读的维度：</Text>
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

      {/* ══════ 海报 Canvas（离屏渲染） ══════ */}
      {posterVisible && report && (
        <PosterCanvas
          report={report}
          cardIndex={posterCardIndex}
          shareCopy={resolveShareCopy(report.personaType, report.scores, posterCardIndex)}
          canvasId={posterCanvasId}
        />
      )}
    </>
  );
}
