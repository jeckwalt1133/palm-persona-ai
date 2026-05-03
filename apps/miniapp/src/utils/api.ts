import Taro from '@tarojs/taro';

// 手机预览时 localhost 指向手机自身，需切换为电脑局域网 IP
const LAN_IP = '192.168.1.4';

function resolveBase(): string {
  try {
    const info = Taro.getSystemInfoSync();
    // 开发者工具用 localhost，真机用局域网 IP
    if (info.platform === 'devtools') {
      return 'http://localhost:3001';
    }
  } catch { /* 静默回退 */ }
  return `http://${LAN_IP}:3001`;
}

const API_BASE = resolveBase();

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}
