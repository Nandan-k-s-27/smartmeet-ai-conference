import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { apiFetch, getApiBase } from '../utils/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check authentication status
  const checkAuthStatus = useCallback(async () => {
    try {
      const response = await apiFetch('/api/auth/status', { method: 'GET' });
      if (response.authenticated && response.user) {
        setUser(response.user);
        return response.user;
      }
      setUser(null);
      return null;
    } catch (error) {
      console.error('[AuthContext] Error checking auth status:', error);
      setUser(null);
      return null;
    }
  }, []);

  // Fetch current user
  const fetchMe = useCallback(async () => {
    try {
      const data = await apiFetch('/api/auth/me', { method: 'GET' });
      setUser(data.user || null);
      return data.user || null;
    } catch (error) {
      // Token may be expired. Try to refresh.
      try {
        const refreshed = await apiFetch('/api/auth/refresh', { method: 'POST' });
        setUser(refreshed.user || null);
        return refreshed.user || null;
      } catch (refreshError) {
        setUser(null);
        return null;
      }
    }
  }, []);

  // Initialize auth on mount
  useEffect(() => {
    const bootstrapAuth = async () => {
      try {
        // Check if auth_token is in URL (from OAuth callback)
        const urlParams = new URLSearchParams(window.location.search);
        const tokenFromUrl = urlParams.get('auth_token');

        if (tokenFromUrl) {
          // Token from OAuth callback is passed through, but the real authentication
          // is done via the cookie set by the backend callback
          // Clear the URL to clean up
          window.history.replaceState({}, document.title, window.location.pathname);
        }

        // Check current auth status
        await checkAuthStatus();
      } catch (error) {
        console.error('[AuthContext] Bootstrap error:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    bootstrapAuth();
  }, [checkAuthStatus]);

  // Initiate Google OAuth login by redirecting to backend
  const loginWithGoogle = useCallback((prompt = undefined) => {
    let backendUrl = getApiBase();
    if (!/^https?:\/\//i.test(backendUrl)) {
      backendUrl = 'https://smartmeet-backend.onrender.com';
    }

    const params = new URLSearchParams();
    params.set('frontend_url', window.location.origin);
    if (prompt === 'select_account') {
      params.set('prompt', 'select_account');
    }

    const authUrl = `${backendUrl}/api/auth/google?${params.toString()}`;

    // Redirect to backend OAuth endpoint
    window.location.href = authUrl;
  }, []);

  // Refresh session
  const refreshSession = useCallback(async () => {
    try {
      const data = await apiFetch('/api/auth/refresh', { method: 'POST' });
      setUser(data.user || null);
      return data.user || null;
    } catch (error) {
      console.error('[AuthContext] Refresh error:', error);
      setUser(null);
      return null;
    }
  }, []);

  // Clear Google session hints for account switching
  const clearGoogleSessionHints = useCallback(() => {
    try {
      if (window.google?.accounts?.id?.disableAutoSelect) {
        window.google.accounts.id.disableAutoSelect();
      }
    } catch (error) {
      // Ignore Google SDK cleanup issues.
    }
  }, []);

  // Revoke Google account access
  const revokeGoogleAccountAccess = useCallback(async (email) => {
    // No-op for backend redirect OAuth flow.
    return;
  }, []);

  // Logout
  const logout = useCallback(async ({ revokeEmail, switchAccount } = {}) => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    } catch (error) {
      console.error('[AuthContext] Logout error:', error);
    }

    // Clear Google session hints
    clearGoogleSessionHints();

    // Keep parameter for backwards compatibility; no SDK revoke needed.
    void revokeEmail;

    setUser(null);

    // If switching account, redirect to login with select_account prompt
    if (switchAccount) {
      loginWithGoogle('select_account');
    }
  }, [clearGoogleSessionHints, loginWithGoogle]);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      loginWithGoogle,
      refreshSession,
      fetchMe,
      logout,
      checkAuthStatus,
      clearGoogleSessionHints,
      revokeGoogleAccountAccess,
    }),
    [user, loading, loginWithGoogle, refreshSession, fetchMe, logout, checkAuthStatus, clearGoogleSessionHints, revokeGoogleAccountAccess]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
