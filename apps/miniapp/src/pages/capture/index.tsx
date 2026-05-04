import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState, useRef, useCallback } from 'react';
import { compressImage } from '../../utils/imageCompress';
import { apiUrl } from '../../utils/api';
import AnalyzeProgress from '../../components/AnalyzeProgress';
import './index.scss';

export default function CapturePage() {
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const reportIdRef = useRef<string | null>(null);
  const errorRef = useRef<string | null>(null);

  const handleChooseImage = () => {
    Taro.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['camera', 'album'],
      success: (res) => {
        const path = res.tempFilePaths[0];
        setImagePath(path);
      },
      fail: () => {
        Taro.showToast({ title: '取消选择', icon: 'none' });
      },
    });
  };

  const doUpload = useCallback(async (imagePath: string) => {
    let finalPath = imagePath;
    try {
      finalPath = await compressImage(imagePath);
    } catch {
      // 压缩失败直接用原图
    }

    let platform = 'devtools';
    try {
      platform = Taro.getSystemInfoSync().platform || 'devtools';
    } catch { /* 使用默认 */ }

    if (platform === 'devtools') {
      const fs = Taro.getFileSystemManager();
      const base64 = fs.readFileSync(finalPath, 'base64');
      const res = await Taro.request({
        url: apiUrl('/api/analyze'),
        method: 'POST',
        data: { imageBase64: base64 },
        header: { 'content-type': 'application/json' },
        timeout: 120000,
      });
      const body = res.data as { success: boolean; data?: { id: string }; error?: { message: string } };
      if (body.success && body.data) {
        reportIdRef.current = body.data.id;
      } else {
        errorRef.current = body.error?.message || '分析失败';
      }
    } else {
      const res = await Taro.uploadFile({
        url: apiUrl('/api/analyze/upload'),
        filePath: finalPath,
        name: 'image',
        timeout: 120000,
      });
      const body = JSON.parse(res.data) as { success: boolean; data?: { id: string }; error?: { message: string } };
      if (body.success && body.data) {
        reportIdRef.current = body.data.id;
      } else {
        errorRef.current = body.error?.message || '分析失败';
      }
    }
  }, []);

  const handleAnalyze = () => {
    if (!imagePath) return;
    setAnalyzing(true);
    // 后台启动上传，不阻塞动画
    doUpload(imagePath);
  };

  const handleProgressComplete = () => {
    if (reportIdRef.current) {
      Taro.redirectTo({ url: `/pages/report/index?id=${reportIdRef.current}` });
    } else if (errorRef.current) {
      setAnalyzing(false);
      Taro.showToast({ title: errorRef.current, icon: 'none', duration: 3000 });
    } else {
      // 上传还在进行中，等 2 秒再试
      setTimeout(() => {
        if (reportIdRef.current) {
          Taro.redirectTo({ url: `/pages/report/index?id=${reportIdRef.current}` });
        } else {
          setAnalyzing(false);
          Taro.showToast({ title: '网络较慢，请重试', icon: 'none', duration: 3000 });
        }
      }, 2000);
    }
  };

  const handleReset = () => {
    setImagePath(null);
  };

  if (analyzing) {
    return (
      <View className="capture-page">
        <AnalyzeProgress onComplete={handleProgressComplete} />
      </View>
    );
  }

  return (
    <View className="capture-page">
      <Text className="capture-title">上传手掌照片</Text>
      <Text className="capture-desc">
        拍摄或选择一张手掌照片，AI 将通过掌纹特征分析你的人格图谱
      </Text>

      {!imagePath ? (
        <View className="upload-area" onClick={handleChooseImage}>
          <View className="upload-placeholder">
            <Text className="upload-icon">+</Text>
            <Text className="upload-text">点击选择照片</Text>
          </View>
        </View>
      ) : (
        <View className="preview-area">
          <Image className="preview-image" src={imagePath} mode="aspectFit" />
        </View>
      )}

      {imagePath && (
        <View className="action-row">
          <View className="btn-reset" onClick={handleReset}>
            <Text>重新选择</Text>
          </View>
          <View className="btn-analyze" onClick={handleAnalyze}>
            <Text>开始分析</Text>
          </View>
        </View>
      )}

      <View className="capture-disclaimer">
        <Text className="disclaimer-text">
          照片仅用于本次 AI 分析，不会存储或分享。结果仅供娱乐参考。
        </Text>
      </View>
    </View>
  );
}
