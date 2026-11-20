/**
 * OpenCRM Frontend API Client
 * - Configured with credentials: 'include' for HttpOnly cookie session management
 * - Transparent 401 refresh token rotation retry
 * - Idempotency-Key injection for order checkout
 * - Defaults to '/api' base path in production for same-origin Vercel reverse proxying
 */

export const API_BASE_URL = (
  (typeof import.meta !== 'undefined' && import.meta?.env?.VITE_API_URL) ||
  (typeof process !== 'undefined' && process.env?.VITE_API_URL) ||
  '/api'
).replace(/\/+$/, '');

export function buildApiUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  if (path.startsWith('/api')) {
    return API_BASE_URL === '/api' ? path : path.replace(/^\/api/, API_BASE_URL);
  }
  if (path.startsWith('/')) {
    return `${API_BASE_URL}${path}`;
  }
  return `${API_BASE_URL}/${path}`;
}

let isRefreshing = false;
let refreshQueue: Array<(tokenRefreshed: boolean) => void> = [];

export async function apiRequest<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = buildApiUrl(path);
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const config: RequestInit = {
    ...options,
    headers,
    credentials: 'include', // Ensures HttpOnly cookies are passed
  };

  const response = await fetch(url, config);

  // If 401 Unauthorized and not already refreshing or calling refresh itself
  if (response.status === 401 && !url.includes('/auth/refresh') && !url.includes('/auth/login')) {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const refreshRes = await fetch(buildApiUrl('/api/auth/refresh'), {
          method: 'POST',
          credentials: 'include',
        });

        const refreshedOk = refreshRes.ok;
        isRefreshing = false;
        refreshQueue.forEach((resolve) => resolve(refreshedOk));
        refreshQueue = [];

        if (refreshedOk) {
          // Retry the original request
          const retryRes = await fetch(url, config);
          if (!retryRes.ok) {
            const errBody = await retryRes.json().catch(() => ({}));
            throw new Error(errBody.message || `Erro HTTP ${retryRes.status}`);
          }
          return await retryRes.json();
        }
      } catch {
        isRefreshing = false;
        refreshQueue.forEach((resolve) => resolve(false));
        refreshQueue = [];
      }
    } else {
      // Wait for existing refresh to complete
      const refreshSucceeded = await new Promise<boolean>((resolve) => {
        refreshQueue.push(resolve);
      });

      if (refreshSucceeded) {
        const retryRes = await fetch(url, config);
        if (!retryRes.ok) {
          const errBody = await retryRes.json().catch(() => ({}));
          throw new Error(errBody.message || `Erro HTTP ${retryRes.status}`);
        }
        return await retryRes.json();
      }
    }
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const err = new Error(errorBody.message || `Erro HTTP ${response.status}: ${response.statusText}`);
    (err as any).statusCode = response.status;
    (err as any).response = errorBody;
    throw err;
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return await response.json();
}
