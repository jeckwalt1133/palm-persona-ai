export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta: { timestamp: string };
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export function ok<T>(data: T): ApiSuccess<T> {
  return {
    success: true,
    data,
    meta: { timestamp: new Date().toISOString() },
  };
}

export function fail(code: string, message: string, details?: unknown): ApiError {
  return {
    success: false,
    error: { code, message, details },
  };
}
