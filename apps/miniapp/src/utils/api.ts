import Taro from '@tarojs/taro';

// 电脑热点 IP（Windows 移动热点默认段）
const HOTSPOT_IP = '192.168.137.1';

// 服务器端口：3001 被旧进程占用，使用 3002
const SERVER_PORT = 3002;

function resolveBase(): string {
  try {
    const info = Taro.getSystemInfoSync();
    // 开发者工具模拟器 → localhost 直连 WSL2
    if (info.platform === 'devtools') {
      return `http://localhost:${SERVER_PORT}`;
    }
  } catch { /* 忽略 */ }

  // H5：同源部署，使用相对路径
  if (process.env.TARO_ENV === 'h5') {
    return '';
  }

  // 真机（通过电脑热点连接）→ 热点 IP
  return `http://${HOTSPOT_IP}:${SERVER_PORT}`;
}

const API_BASE = resolveBase();

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}
