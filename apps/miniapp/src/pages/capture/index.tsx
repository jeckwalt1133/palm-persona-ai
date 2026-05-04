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

  const doUpload = useCallback(async (imgPath: string) => {
    let finalPath = imgPath;
    try {
      finalPath = await compressImage(imgPath);
    } catch {
      // 压缩失败直接用原图
    }

    let platform = 'devtools';
    try {
      platform = Taro.getSystemInfoSync().platform || 'devtools';
    } catch { /* 使用默认 */ }

    try {
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
    } catch (err: unknown) {
      const taroErr = err as { errMsg?: string };
      errorRef.current = taroErr?.errMsg || String(err) || '网络异常，请检查连接后重试';
    }
  }, []);

  const handleAnalyze = () => {
    if (!imagePath) return;
    setAnalyzing(true);
    doUpload(imagePath);
  };

  const handleProgressComplete = () => {
    if (reportIdRef.current) {
      Taro.redirectTo({ url: `/pages/report/index?id=${reportIdRef.current}` });
    } else if (errorRef.current) {
      setAnalyzing(false);
      Taro.showToast({ title: errorRef.current, icon: 'none', duration: 3000 });
    } else {
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
      <View className="capture-header">
        <Text className="capture-title">上传手掌照片</Text>
        <Text className="capture-desc">
          AI 会分析你手掌的几何特征——宽度、手指比例、纹路清晰度和走向——然后匹配人格模型
        </Text>
      </View>

      {/* 拍照提示 */}
      <View className="capture-tips">
        <View className="tip-item">
          <Text className="tip-dot" />
          <Text className="tip-text">手掌平放，五指自然分开</Text>
        </View>
        <View className="tip-item">
          <Text className="tip-dot" />
          <Text className="tip-text">光线充足，避免阴影遮挡纹路</Text>
        </View>
        <View className="tip-item">
          <Text className="tip-dot" />
          <Text className="tip-text">尽量让手掌占满画面</Text>
        </View>
      </View>

      {!imagePath ? (
        <View className="upload-area" onClick={handleChooseImage}>
          <View className="upload-placeholder">
            <Text className="upload-icon">+</Text>
            <Text className="upload-text">拍摄或选择照片</Text>
            <Text className="upload-hint">支持相机拍摄和相册选择</Text>
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
          照片仅用于本次 AI 分析，不会存储原始图像。结果仅供娱乐参考。
        </Text>
      </View>
    </View>
  );
}
