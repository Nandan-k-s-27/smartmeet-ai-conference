import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { googleLogout } from '@react-oauth/google';
import { apiFetch } from '../utils/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch current user
  const fetchMe = useCallback(async () => {
    try {
      const data = await apiFetch('/api/auth/me', { method: 'GET' });
      setUser(data.user || null);
      return data.user || null;
    } catch (error) {
      // Access token may be expired. Attempt session refresh once.
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
        await fetchMe();
      } finally {
        setLoading(false);
      }
    };

    bootstrapAuth();
  }, [fetchMe]);

  // Google OAuth login
  const loginWithGoogle = useCallback(async (credential) => {
    const data = await apiFetch('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential }),
    });
    setUser(data.user);
    return data.user;
  }, []);

  // Refresh session
  const refreshSession = useCallback(async () => {
    const data = await apiFetch('/api/auth/refresh', { method: 'POST' });
    setUser(data.user || null);
    return data.user || null;
  }, []);

  const clearGoogleSessionHints = useCallback(() => {
    // Clear Google Identity auto-select so users can choose another account.
    try {
      googleLogout();
    } catch (error) {
      // Ignore provider-side sign-out failures; app logout still proceeds.
    }

    if (window.google?.accounts?.id?.disableAutoSelect) {
      window.google.accounts.id.disableAutoSelect();
    }
  }, []);

  const revokeGoogleAccountAccess = useCallback(async (email) => {
    if (!email || !window.google?.accounts?.id?.revoke) {
      return;
    }

    await new Promise((resolve) => {
      try {
        window.google.accounts.id.revoke(email, () => resolve());
      } catch (error) {
        resolve();
      }
    });
  }, []);

  // Logout
  const logout = useCallback(async ({ revokeEmail } = {}) => {
    await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    await revokeGoogleAccountAccess(revokeEmail || user?.email);
    clearGoogleSessionHints();
    setUser(null);
  }, [clearGoogleSessionHints, revokeGoogleAccountAccess, user]);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      loginWithGoogle,
      refreshSession,
      fetchMe,
      logout,
      clearGoogleSessionHints,
      revokeGoogleAccountAccess,
    }),
    [user, loading, loginWithGoogle, refreshSession, fetchMe, logout, clearGoogleSessionHints, revokeGoogleAccountAccess]
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
