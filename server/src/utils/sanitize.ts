export function maskSensitive(input: string): string {
  if (input.length <= 8) return '***';
  return input.slice(0, 4) + '***' + input.slice(-4);
}

export function sanitizeInput(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim();
}
