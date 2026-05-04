// 海报导出与保存逻辑
import Taro from '@tarojs/taro';

// 小程序: Canvas → 临时文件
export async function canvasToTempFile(canvasId: string): Promise<string> {
  if (process.env.TARO_ENV === 'h5') {
    // H5 用 canvas.toBlob 代替
    return canvasToBlobUrl(canvasId);
  }

  // 小程序: Taro Canvas 2D API
  return new Promise((resolve, reject) => {
    Taro.nextTick(() => {
      const query = Taro.createSelectorQuery();
      query
        .select(`#${canvasId}`)
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res || !res[0]) { reject(new Error('Canvas 未找到')); return; }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const canvas = (res[0] as any).node;

          Taro.canvasToTempFilePath({
            canvas,
            fileType: 'png',
            quality: 1,
            success: (result) => resolve(result.tempFilePath),
            fail: (err) => reject(new Error(`导出失败: ${err.errMsg}`)),
          });
        });
    });
  });
}

// H5: Canvas → Blob URL
function canvasToBlobUrl(canvasId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
    if (!canvas) { reject(new Error('Canvas 未找到')); return; }

    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error('导出失败')); return; }
      const url = URL.createObjectURL(blob);
      resolve(url);
    }, 'image/png');
  });
}

// 保存到相册 / 下载
export async function saveToAlbum(tempPath: string): Promise<boolean> {
  if (process.env.TARO_ENV === 'h5') {
    return downloadH5(tempPath);
  }

  // 小程序先检查权限
  try {
    const setting = await Taro.getSetting();
    if (!setting.authSetting['scope.writePhotosAlbum']) {
      try {
        await Taro.authorize({ scope: 'scope.writePhotosAlbum' });
      } catch {
        // 权限被拒，引导用户手动开启
        const modal = await Taro.showModal({
          title: '需要相册权限',
          content: '保存海报需要访问你的相册，请在设置中开启相册权限',
          confirmText: '去设置',
        });
        if (modal.confirm) {
          await Taro.openSetting();
          // 重新检查
          const recheck = await Taro.getSetting();
          if (!recheck.authSetting['scope.writePhotosAlbum']) {
            return false; // 用户仍然拒绝
          }
        } else {
          return false;
        }
      }
    }

    await Taro.saveImageToPhotosAlbum({ filePath: tempPath });
    return true;
  } catch (err) {
    // 开发模式下可能不支持，使用预览代替
    try {
      await Taro.previewImage({ urls: [tempPath], current: tempPath });
      return true;
    } catch {
      return false;
    }
  }
}

// H5: 触发浏览器下载
function downloadH5(blobUrl: string): boolean {
  try {
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `palm-persona-poster-${Date.now()}.png`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // 延迟释放 Blob URL
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    return true;
  } catch {
    return false;
  }
}

// H5: Web Share API 分享图片
export async function shareWithFile(blobUrl: string, title: string): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.share) return false;

  try {
    const blob = await fetch(blobUrl).then((r) => r.blob());
    const file = new File([blob], 'poster.png', { type: 'image/png' });
    await navigator.share({
      title,
      files: [file],
    });
    return true;
  } catch {
    return false;
  }
}

// 统一出口：渲染完成 → 导出 → 保存 → Toast
export async function captureAndSave(
  canvasId: string,
  personaLabel: string,
): Promise<{ success: boolean; message: string }> {
  try {
    // 等待 Canvas 渲染完成（500ms debounce）
    await new Promise((r) => setTimeout(r, 500));

    const tempPath = await canvasToTempFile(canvasId);

    if (process.env.TARO_ENV === 'h5') {
      // H5: 尝试 Web Share API，否则下载
      const shared = await shareWithFile(tempPath, `我的掌心人格：${personaLabel}`);
      if (shared) {
        return { success: true, message: '已分享' };
      }
      const downloaded = downloadH5(tempPath);
      if (downloaded) {
        return { success: true, message: '海报已保存' };
      }
      return { success: false, message: '保存失败，请长按截图' };
    }

    // 小程序
    const saved = await saveToAlbum(tempPath);
    if (saved) {
      Taro.showToast({ title: '海报已保存到相册', icon: 'success', duration: 2000 });
      return { success: true, message: '已保存到相册' };
    }

    Taro.showToast({ title: '保存失败，请重试', icon: 'none' });
    return { success: false, message: '保存失败' };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '生成失败';
    Taro.showToast({ title: msg, icon: 'none' });
    return { success: false, message: msg };
  }
}
