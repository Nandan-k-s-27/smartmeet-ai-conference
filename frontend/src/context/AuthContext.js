import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../utils/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = async () => {
    try {
      const data = await apiFetch('/api/auth/me', { method: 'GET' });
      setUser(data.user || null);
      return data.user || null;
    } catch (error) {
      setUser(null);
      return null;
    }
  };

  useEffect(() => {
    const bootstrapAuth = async () => {
      try {
        await fetchMe();
      } finally {
        setLoading(false);
      }
    };

    bootstrapAuth();
  }, []);

  const loginWithGoogle = async (credential) => {
    const data = await apiFetch('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential }),
    });
    setUser(data.user);
    return data.user;
  };

  const registerWithEmail = async ({ name, email, password }) => {
    const data = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    setUser(data.user);
    return data.user;
  };

  const loginWithEmail = async ({ email, password }) => {
    const data = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setUser(data.user);
    return data.user;
  };

  const refreshSession = async () => {
    const data = await apiFetch('/api/auth/refresh', { method: 'POST' });
    setUser(data.user || null);
    return data.user || null;
  };

  const logout = async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
    setUser(null);
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      loginWithGoogle,
      registerWithEmail,
      loginWithEmail,
      refreshSession,
      fetchMe,
      logout,
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
