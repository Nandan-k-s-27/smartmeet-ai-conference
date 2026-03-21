export const getApiBase = () => {
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL.replace(/\/+$/, '');
  }

  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:5000`;
};

const shouldAttemptRefresh = (path) => {
  const blocked = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/google',
    '/api/auth/refresh',
    '/api/auth/logout',
  ];

  return !blocked.some((item) => path.startsWith(item));
};

export const apiFetch = async (path, options = {}, hasRetried = false) => {
  const response = await fetch(`${getApiBase()}${path}`, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401 && !hasRetried && shouldAttemptRefresh(path)) {
    const refresh = await fetch(`${getApiBase()}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });

    if (refresh.ok) {
      return apiFetch(path, options, true);
    }
  }

  if (!response.ok) {
    const message = data?.message || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data;
};
