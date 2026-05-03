import { View, Text, ScrollView } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState } from 'react';
import RadarCanvas from '../../components/RadarCanvas';
import { apiUrl } from '../../utils/api';
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
}

export default function ReportPage() {
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // 首次加载 + 从分析页返回时刷新
  const [fetched, setFetched] = useState(false);
  if (!fetched) {
    fetchReport();
    setFetched(true);
  }

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

  const radarScores = report.scores.map((s) => ({
    label: s.dimension,
    score: s.score,
  }));

  return (
    <ScrollView className="report-page" scrollY enableBackToTop>
      {/* Header */}
      <View className="report-hero">
        <Text className="report-date">{report.createdAt.slice(0, 10)}</Text>
        <Text className="report-label">{report.personaLabel}</Text>
        <Text className="report-type">{report.personaType}</Text>
      </View>

      {/* Radar Chart */}
      <View className="section">
        <Text className="section-title">五维人格图谱</Text>
        <RadarCanvas scores={radarScores} size={580} />
      </View>

      {/* Dimension Scores */}
      <View className="section">
        <Text className="section-title">维度解析</Text>
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

      {/* Summary */}
      <View className="section">
        <Text className="section-title">综合分析</Text>
        <View className="card">
          {report.summary.split('\n').filter(Boolean).map((p, i) => (
            <Text key={i} className="card-paragraph">{p}</Text>
          ))}
        </View>
      </View>

      {/* Insights */}
      {report.insights.length > 0 && (
        <View className="section">
          <Text className="section-title">关系洞察</Text>
          {report.insights.map((insight, i) => (
            <View key={i} className="insight-row">
              <Text className="insight-dot">✦</Text>
              <Text className="insight-text">{insight}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Quote */}
      <View className="section">
        <Text className="section-title">给你的话</Text>
        <View className="card quote-card">
          <Text className="quote-mark">"</Text>
          <Text className="card-text">{report.quote}</Text>
        </View>
      </View>

      {/* Keywords */}
      {report.keywords.length > 0 && (
        <View className="section">
          <Text className="section-title">关键词</Text>
          <View className="keywords-row">
            {report.keywords.map((kw, i) => (
              <View key={i} className="tag">
                <Text>{kw}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Suspense */}
      <View className="section suspense-section">
        <Text className="suspense-text">{report.suspenseText}</Text>
      </View>

      {/* Bottom nav */}
      <View className="bottom-bar">
        <View className="btn-home" onClick={() => Taro.reLaunch({ url: '/pages/index/index' })}>
          <Text>返回首页</Text>
        </View>
      </View>
    </ScrollView>
  );
}
