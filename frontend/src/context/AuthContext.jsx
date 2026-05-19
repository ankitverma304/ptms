import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) { setLoading(false); return; }
    try {
      const { data } = await authAPI.me();
      setUser(data.user);
    } catch {
      localStorage.clear();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUser(); }, [loadUser]);

  const login = async (email, password) => {
    const { data } = await authAPI.login({ email, password });
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try { await authAPI.logout(); } catch {}
    localStorage.clear();
    setUser(null);
  };

  const hasRole    = (...roles) => user && roles.includes(user.role);
  const isAdmin    = () => hasRole('super_admin', 'admin');
  const isPM       = () => hasRole('super_admin', 'admin', 'project_manager');
  // SA / Admin / PM / TL / QA can flag bugs — developer explicitly excluded
  const canFlagBug = () => hasRole('super_admin', 'admin', 'project_manager', 'team_lead', 'qa');

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasRole, isAdmin, isPM, canFlagBug }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
