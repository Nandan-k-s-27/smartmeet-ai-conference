export const getApiBase = () => {
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL.replace(/\/+$/, '');
  }
  if (process.env.REACT_APP_BACKEND_URL) {
    return process.env.REACT_APP_BACKEND_URL.replace(/\/+$/, '');
  }
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:5000`;
};

export const apiFetch = async (endpoint, options = {}) => {
  const apiBase = getApiBase();
  const url = `${apiBase}${endpoint}`;

  const defaultOptions = {
    ...options,
    credentials: 'include', // Include cookies
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

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
