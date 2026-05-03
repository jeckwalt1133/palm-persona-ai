// API 基础地址：
// - 开发者工具模拟器 → localhost:3001 直接访问 WSL2
// - 真机调试 → DevTools 代理转发 localhost:3001 到电脑
// - 手机预览 → 需公网隧道（执行 ssh -R 80:localhost:3001 serveo.net）
const API_BASE = 'http://localhost:3001';

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}
