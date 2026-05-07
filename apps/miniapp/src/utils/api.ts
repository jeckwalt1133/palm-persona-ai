import Taro from '@tarojs/taro';

// 电脑热点 IP（Windows 移动热点默认段）
const HOTSPOT_IP = '192.168.137.1';

// 服务器端口：与 server/.env 中的 PORT 保持一致
const SERVER_PORT = 3001;

function resolveBase(): string {
  try {
    const info = Taro.getSystemInfoSync();
    // 开发者工具模拟器 → Windows代理端口（WSL2直连不通，走Windows原生转发）
    if (info.platform === 'devtools') {
      return `http://127.0.0.1:3009`;
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
