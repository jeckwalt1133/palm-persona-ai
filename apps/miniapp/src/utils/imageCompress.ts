// 图片压缩工具 — 上传前对图片进行压缩处理
// 目标：≤200KB，真机预览网络慢，优先保证上传速度

import Taro from '@tarojs/taro';

interface CompressOptions {
  maxWidth: number;
  maxHeight: number;
  quality: number;
  maxSizeKb: number;
}

const DEFAULT_OPTIONS: CompressOptions = {
  maxWidth: 800,
  maxHeight: 1067,
  quality: 0.6,
  maxSizeKb: 200,
};

// 根据图片原始尺寸计算目标尺寸
function calcTargetSize(
  origW: number,
  origH: number,
  maxW: number,
  maxH: number,
): { width: number; height: number } {
  let width = origW;
  let height = origH;

  if (width > maxW) {
    height = Math.round((height * maxW) / width);
    width = maxW;
  }
  if (height > maxH) {
    width = Math.round((width * maxH) / height);
    height = maxH;
  }

  return { width, height };
}

// 获取文件大小（KB）
function getFileSizeKb(filePath: string): Promise<number> {
  return new Promise((resolve) => {
    const fs = Taro.getFileSystemManager();
    fs.getFileInfo({
      filePath,
      success: (res) => resolve((res.size ?? 0) / 1024),
      fail: () => resolve(Infinity),
    });
  });
}

// 主压缩函数
export async function compressImage(
  filePath: string,
  options?: Partial<CompressOptions>,
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // 先检查原始大小
  const origSizeKb = await getFileSizeKb(filePath);
  if (origSizeKb <= opts.maxSizeKb) {
    return filePath; // 已足够小，不压缩
  }

  // 获取图片信息
  const imageInfo = await new Promise<Taro.getImageInfo.SuccessCallbackResult>(
    (resolve, reject) => {
      Taro.getImageInfo({ src: filePath, success: resolve, fail: reject });
    },
  );

  const { width, height } = calcTargetSize(
    imageInfo.width,
    imageInfo.height,
    opts.maxWidth,
    opts.maxHeight,
  );

  // 执行压缩
  const compressResult = await new Promise<Taro.compressImage.SuccessCallbackResult>(
    (resolve, reject) => {
      Taro.compressImage({
        src: filePath,
        quality: Math.round(opts.quality * 100),
        compressedWidth: width,
        compressedHeight: height,
        success: resolve,
        fail: reject,
      });
    },
  );

  return compressResult.tempFilePath;
}
