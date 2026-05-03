const API_BASE = 'http://localhost:3001';

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}
