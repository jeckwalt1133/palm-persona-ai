import Taro from '@tarojs/taro';

// 电脑热点 IP（Windows 移动热点默认段）
const HOTSPOT_IP = '192.168.137.1';

function resolveBase(): string {
  try {
    const info = Taro.getSystemInfoSync();
    // 开发者工具模拟器 → localhost 直连 WSL2
    if (info.platform === 'devtools') {
      return 'http://localhost:3001';
    }
  } catch { /* 忽略 */ }

  // 真机（通过电脑热点连接）→ 热点 IP + 端口转发
  return `http://${HOTSPOT_IP}:3001`;
}

const API_BASE = resolveBase();

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}
