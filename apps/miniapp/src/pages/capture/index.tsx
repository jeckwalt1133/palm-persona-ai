import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { useState } from 'react';
import { compressImage } from '../../utils/imageCompress';
import { apiUrl } from '../../utils/api';
import './index.scss';

export default function CapturePage() {
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

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

  const handleAnalyze = async () => {
    if (!imagePath) return;

    setAnalyzing(true);
    Taro.showLoading({ title: '分析中...' });
    try {
      // 先压缩
      let finalPath = imagePath;
      try {
        finalPath = await compressImage(imagePath);
      } catch {
        // 压缩失败直接用原图
      }

      // 读取为 base64
      const fs = Taro.getFileSystemManager();
      const base64 = fs.readFileSync(finalPath, 'base64');

      const res = await Taro.request({
        url: apiUrl('/api/analyze'),
        method: 'POST',
        data: { imageBase64: base64 },
        header: { 'content-type': 'application/json' },
        timeout: 60000, // 真机调试隧道延迟高，给足 60s
      });

      const body = res.data as { success: boolean; data?: { id: string }; error?: { message: string } };

      if (body.success && body.data) {
        Taro.hideLoading();
        Taro.redirectTo({ url: `/pages/report/index?id=${body.data.id}` });
      } else {
        Taro.hideLoading();
        Taro.showToast({ title: body.error?.message || '分析失败', icon: 'none', duration: 3000 });
      }
    } catch (err) {
      Taro.hideLoading();
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[capture] 分析请求失败:', msg);
      Taro.showToast({ title: '网络超时，请重试', icon: 'none', duration: 3000 });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleReset = () => {
    setImagePath(null);
  };

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
          <View
            className={`btn-analyze ${analyzing ? 'btn-disabled' : ''}`}
            onClick={handleAnalyze}
          >
            <Text>{analyzing ? '分析中...' : '开始分析'}</Text>
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
