import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';
const API_PREFIX = '/api/v1';

/**
 * Axios instance for API calls.
 * - Adds Bearer token from localStorage on every request.
 * - Handles 401 → refresh or redirect to login.
 * - Normalises error shape: { code, message }
 */
export const api: AxiosInstance = axios.create({
  baseURL: `${BASE_URL}${API_PREFIX}`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30_000,
});

// ── Request Interceptor ─────────────────────────────────────────
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    const token = localStorage.getItem('access_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: unknown) => Promise.reject(error),
);

// ── Response Interceptor ────────────────────────────────────────
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null = null): void {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) {
      return Promise.reject(error);
    }

    const originalRequest = error.config as AxiosRequestConfig & {
      _retry?: boolean;
    };
    const status = error.response?.status;

    // ── 401: Token expired → try refresh ──
    if (status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              (originalRequest.headers as Record<string, string>).Authorization =
                `Bearer ${token}`;
            }
            return api(originalRequest);
          })
          .catch((err: unknown) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('refresh_token');

      if (!refreshToken) {
        isRefreshing = false;
        processQueue(new Error('No refresh token'));
        redirectToLogin();
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post<{
          data: { access_token: string };
        }>(`${BASE_URL}${API_PREFIX}/auth/refresh`, {
          refresh_token: refreshToken,
        });

        const newToken = data.data.access_token;
        localStorage.setItem('access_token', newToken);

        if (api.defaults.headers) {
          (api.defaults.headers.common as Record<string, string>)[
            'Authorization'
          ] = `Bearer ${newToken}`;
        }

        processQueue(null, newToken);

        if (originalRequest.headers) {
          (originalRequest.headers as Record<string, string>).Authorization =
            `Bearer ${newToken}`;
        }

        return api(originalRequest);
      } catch (refreshError: unknown) {
        processQueue(refreshError, null);
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        redirectToLogin();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // ── Normalise error shape ──
    const apiError: AppError = {
      code:
        (error.response?.data as Record<string, unknown>)?.error &&
        typeof (error.response?.data as Record<string, unknown>).error ===
          'object'
          ? String(
              (
                (error.response?.data as Record<string, unknown>)
                  .error as Record<string, unknown>
              ).code ?? 'UNKNOWN_ERROR',
            )
          : 'UNKNOWN_ERROR',
      message:
        (error.response?.data as Record<string, unknown>)?.error &&
        typeof (error.response?.data as Record<string, unknown>).error ===
          'object'
          ? String(
              (
                (error.response?.data as Record<string, unknown>)
                  .error as Record<string, unknown>
              ).message ?? error.message,
            )
          : error.message ?? 'Đã xảy ra lỗi không xác định',
      status,
    };

    return Promise.reject(apiError);
  },
);

function redirectToLogin(): void {
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

export interface AppError {
  code: string;
  message: string;
  status?: number;
}

export function isAppError(error: unknown): error is AppError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error
  );
}
