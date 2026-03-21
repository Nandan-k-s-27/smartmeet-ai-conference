import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { apiFetch } from '../utils/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detectedAccounts, setDetectedAccounts] = useState([]);

  // Fetch current user
  const fetchMe = useCallback(async () => {
    try {
      const data = await apiFetch('/api/auth/me', { method: 'GET' });
      setUser(data.user || null);
      return data.user || null;
    } catch (error) {
      setUser(null);
      return null;
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

  // Logout
  const logout = useCallback(async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      loginWithGoogle,
      refreshSession,
      fetchMe,
      logout,
      detectedAccounts,
      setDetectedAccounts,
    }),
    [user, loading, loginWithGoogle, refreshSession, fetchMe, logout, detectedAccounts]
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
