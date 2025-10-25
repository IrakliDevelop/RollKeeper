'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { AuthUser } from '@/lib/auth';

interface AuthContextType {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, username: string, password: string, displayName?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshAuth: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'rollkeeper-auth';
const REFRESH_TOKEN_KEY = 'rollkeeper-refresh';

interface AuthStorage {
  user: AuthUser;
  accessToken: string;
  expiresAt: number;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load auth state from localStorage on mount
  useEffect(() => {
    loadAuthFromStorage();
  }, []);

  // Set up token refresh timer
  useEffect(() => {
    if (accessToken && user) {
      const tokenData = parseJWT(accessToken);
      if (tokenData) {
        const expiresIn = tokenData.exp * 1000 - Date.now();
        const refreshIn = Math.max(expiresIn - 60000, 0); // Refresh 1 minute before expiry

        if (refreshIn > 0) {
          const timer = setTimeout(() => {
            refreshAuth();
          }, refreshIn);

          return () => clearTimeout(timer);
        } else {
          // Token is already expired or about to expire, refresh immediately
          refreshAuth();
        }
      }
    }
  }, [accessToken]);

  const loadAuthFromStorage = () => {
    try {
      const authData = localStorage.getItem(AUTH_STORAGE_KEY);
      const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

      if (authData && storedRefreshToken) {
        const parsed: AuthStorage = JSON.parse(authData);
        
        // Check if token is still valid
        if (parsed.expiresAt > Date.now()) {
          setUser(parsed.user);
          setAccessToken(parsed.accessToken);
          setRefreshToken(storedRefreshToken);
        } else {
          // Token expired, try to refresh
          setRefreshToken(storedRefreshToken);
          refreshAuthWithToken(storedRefreshToken);
        }
      }
    } catch (error) {
      console.error('Error loading auth from storage:', error);
      clearAuthStorage();
    } finally {
      setIsLoading(false);
    }
  };

  const saveAuthToStorage = (userData: AuthUser, token: string, refresh: string) => {
    try {
      const tokenData = parseJWT(token);
      if (tokenData) {
        const authStorage: AuthStorage = {
          user: userData,
          accessToken: token,
          expiresAt: tokenData.exp * 1000,
        };

        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authStorage));
        localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
      }
    } catch (error) {
      console.error('Error saving auth to storage:', error);
    }
  };

  const clearAuthStorage = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  };

  const parseJWT = (token: string) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      return null;
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Login failed' };
      }

      setUser(data.user);
      setAccessToken(data.accessToken);
      setRefreshToken(data.refreshToken);
      saveAuthToStorage(data.user, data.accessToken, data.refreshToken);

      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Network error' };
    }
  };

  const register = async (email: string, username: string, password: string, displayName?: string) => {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, username, password, displayName }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.error || 'Registration failed' };
      }

      setUser(data.user);
      setAccessToken(data.accessToken);
      setRefreshToken(data.refreshToken);
      saveAuthToStorage(data.user, data.accessToken, data.refreshToken);

      return { success: true };
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: 'Network error' };
    }
  };

  const logout = () => {
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    clearAuthStorage();
  };

  const refreshAuth = async (): Promise<boolean> => {
    if (!refreshToken) return false;
    return refreshAuthWithToken(refreshToken);
  };

  const refreshAuthWithToken = async (token: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken: token }),
      });

      const data = await response.json();

      if (!response.ok) {
        logout();
        return false;
      }

      setUser(data.user);
      setAccessToken(data.accessToken);
      setRefreshToken(data.refreshToken);
      saveAuthToStorage(data.user, data.accessToken, data.refreshToken);

      return true;
    } catch (error) {
      console.error('Token refresh error:', error);
      logout();
      return false;
    }
  };

  const value: AuthContextType = {
    user,
    accessToken,
    refreshToken,
    isLoading,
    isAuthenticated: !!user && !!accessToken,
    login,
    register,
    logout,
    refreshAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
