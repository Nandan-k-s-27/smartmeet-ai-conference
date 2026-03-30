const normalizeBaseUrl = (value) => {
  const normalized = String(value || '').trim().replace(/\/+$/, '');
  if (!normalized) return '';

  const lowered = normalized.toLowerCase();
  if (lowered === 'undefined' || lowered === 'null') {
    return '';
  }

  return normalized;
};

// Production fallback for this deployed app when env vars are missing at build time.
const DEFAULT_PRODUCTION_BACKEND_URL = 'https://smartmeet-backend.onrender.com';

export const getApiBase = () => {
  const fromApiUrl = normalizeBaseUrl(process.env.REACT_APP_API_URL);
  if (fromApiUrl) return fromApiUrl;

  const fromBackendUrl = normalizeBaseUrl(process.env.REACT_APP_BACKEND_URL);
  if (fromBackendUrl) return fromBackendUrl;

  const isBrowser = typeof window !== 'undefined';
  const host = isBrowser ? window.location.hostname : '';
  const isLocalHost = host === 'localhost' || host === '127.0.0.1';

  if (!isLocalHost && host) {
    return DEFAULT_PRODUCTION_BACKEND_URL;
  }

  const protocol = isBrowser ? window.location.protocol : 'http:';
  const hostname = isBrowser ? window.location.hostname : 'localhost';
  return `${protocol}//${hostname}:5000`;
};

export const getSocketBase = () => {
  const fromSocketUrl = normalizeBaseUrl(process.env.REACT_APP_SOCKET_URL);
  if (fromSocketUrl) return fromSocketUrl;
  return getApiBase();
};

export const apiFetch = async (endpoint, options = {}) => {
  const apiBase = getApiBase();
  const url = `${apiBase}${endpoint}`;

  const defaultOptions = {
    ...options,
    credentials: 'include', // Include cookies if they work
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  // Add Bearer token from localStorage as fallback/primary if third-party cookies are blocked
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  if (token) {
    defaultOptions.headers['Authorization'] = `Bearer ${token}`;
  }

  let response = await fetch(url, defaultOptions);

  // If 401, try refreshing the token once and retry
  if (response.status === 401) {
    // Don't refresh on auth endpoints themselves
    if (!endpoint.includes('/auth/')) {
      try {
        await fetch(`${apiBase}/api/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });

        // Retry the original request
        response = await fetch(url, defaultOptions);
      } catch (err) {
        // Refresh failed, let the error propagate
      }
    }
  }

  const raw = await response.text();
  let data = null;

  try {
    data = raw ? JSON.parse(raw) : null;
  } catch (err) {
    data = null;
  }

  if (!response.ok) {
    const message = [data?.error, data?.hint].filter(Boolean).join(' - ') || raw || `HTTP ${response.status}`;
    throw new Error(message);
  }

  return data || {};
};
