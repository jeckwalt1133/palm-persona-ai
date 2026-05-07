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
    console.log('[DEBUG] Step 1: compressImage 开始', finalPath);
    try {
      finalPath = await compressImage(imgPath);
      console.log('[DEBUG] Step 1: compressImage 完成', finalPath);
    } catch (e) {
      console.log('[DEBUG] Step 1: compressImage 失败', e);
    }

    let platform = 'devtools';
    try {
      platform = Taro.getSystemInfoSync().platform || 'devtools';
    } catch { /* 使用默认 */ }
    console.log('[DEBUG] Step 2: platform =', platform);

    const isMobile = platform === 'ios' || platform === 'android';

    const readFileAsBase64 = async (fp: string): Promise<string> => {
      if (process.env.TARO_ENV === 'h5') {
        const response = await fetch(fp);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = () => reject(new Error('文件读取失败'));
          reader.readAsDataURL(blob);
        });
      }
      console.log('[DEBUG] Step 3: readFileSync 开始', fp);
      const result = Taro.getFileSystemManager().readFileSync(fp, 'base64') as string;
      console.log('[DEBUG] Step 3: readFileSync 完成, length=', result.length);
      return result;
    };

    try {
      if (!isMobile) {
        console.log('[DEBUG] Step 3: 读取文件...');
        const base64 = await readFileAsBase64(finalPath);
        const reqUrl = apiUrl('/api/analyze');
        console.log('[DEBUG] Step 4: Taro.request POST', reqUrl, 'base64Len=', base64.length);
        const res = await Taro.request({
          url: reqUrl,
          method: 'POST',
          data: { imageBase64: base64 },
          header: { 'content-type': 'application/json' },
          timeout: 120000,
        });
        console.log('[DEBUG] Step 4: response received', JSON.stringify(res.data).substring(0, 200));
        const body = res.data as { success: boolean; data?: { id: string }; error?: { message: string } };
        if (body.success && body.data) {
          reportIdRef.current = body.data.id;
        } else {
          errorRef.current = body.error?.message || '好像出了点小问题——再试一次？';
        }
      } else {
        const reqUrl = apiUrl('/api/analyze/upload');
        console.log('[DEBUG] Step 4: Taro.uploadFile', reqUrl);
        const res = await Taro.uploadFile({
          url: reqUrl,
          filePath: finalPath,
          name: 'image',
          timeout: 120000,
        });
        const body = JSON.parse(res.data) as { success: boolean; data?: { id: string }; error?: { message: string } };
        if (body.success && body.data) {
          reportIdRef.current = body.data.id;
        } else {
          errorRef.current = body.error?.message || '好像出了点小问题——再试一次？';
        }
      }
    } catch (err: unknown) {
      const taroErr = err as { errMsg?: string };
      console.log('[DEBUG] Step X: 请求失败', taroErr?.errMsg || String(err));
      errorRef.current = taroErr?.errMsg || String(err) || '网络信号不太好——换一个姿势试试？';
    }
  }, []);

  const handleAnalyze = async () => {
    if (!imagePath) return;
    setAnalyzing(true);

    // [诊断] 快速GET连通性测试 — 确认网络层能通
    try {
      const pingUrl = apiUrl('/api/admin/safety/stats');
      console.log('[DEBUG] Step 0: GET 连通性测试', pingUrl);
      const pingRes = await Taro.request({
        url: pingUrl,
        method: 'GET',
        header: { 'X-Admin-Key': 'palm-admin-dev-key' },
        timeout: 5000,
      });
      console.log('[DEBUG] Step 0: GET 成功', JSON.stringify(pingRes.data).substring(0, 100));
    } catch (pingErr: unknown) {
      const pe = pingErr as { errMsg?: string };
      console.log('[DEBUG] Step 0: GET 失败 — 网络不通!', pe?.errMsg || String(pingErr));
      setAnalyzing(false);
      Taro.showToast({ title: '网络不通: ' + (pe?.errMsg || 'timeout'), icon: 'none', duration: 3000 });
      return;
    }

    try {
      await doUpload(imagePath);
      // API返回后直接跳转，不依赖进度条计时
      if (reportIdRef.current) {
        navigateToReport(reportIdRef.current);
      } else if (errorRef.current) {
        setAnalyzing(false);
        Taro.showToast({ title: errorRef.current, icon: 'none', duration: 3000 });
      }
    } catch {
      setAnalyzing(false);
      Taro.showToast({ title: '网络信号不太好——换一个姿势试试？', icon: 'none', duration: 3000 });
    }
  };

  const navigateToReport = (id: string) => {
    Taro.redirectTo({ url: `/pages/report/index?id=${id}` }).catch(() => {
      // redirectTo 失败（可能子包未加载），降级为 navigateTo
      Taro.navigateTo({ url: `/pages/report/index?id=${id}` }).catch(() => {
        setAnalyzing(false);
        Taro.showToast({ title: '页面跳转失败，请重试', icon: 'none', duration: 3000 });
      });
    });
  };

  const handleProgressComplete = () => {
    if (reportIdRef.current) {
      navigateToReport(reportIdRef.current);
    } else if (errorRef.current) {
      setAnalyzing(false);
      Taro.showToast({ title: errorRef.current, icon: 'none', duration: 3000 });
    } else {
      setTimeout(() => {
        if (reportIdRef.current) {
          navigateToReport(reportIdRef.current);
        } else {
          setAnalyzing(false);
          Taro.showToast({ title: '网络有点慢，AI 还在等数据——稍后再试', icon: 'none', duration: 3000 });
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
        <Text className="capture-title">伸出手，让 AI 看看你</Text>
        <Text className="capture-desc">
          每一条手掌线条都有自己的故事。AI 会从你的手掌特征中，读出属于你的那一种人格——了解自己的一种新方式
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
          AI 趣味解读 · 认真但不较真。照片仅用于本次分析，用完即删。
        </Text>
      </View>
    </View>
  );
}
