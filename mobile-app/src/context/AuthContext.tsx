import React, { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { isApiConfigurationError, setUnauthorizedHandler } from '../services/api';

export interface User {
  id: number;
  name: string;
  email: string;
  profile: 'student' | 'teacher';
  teacherCode?: string;
}

interface AuthContextProps {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, teacherCode: string) => Promise<void>;
  updateProfile: (name: string, email: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextProps>({
  user: null,
  token: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  updateProfile: async () => {},
  logout: async () => {},
});

export const AuthProvider = ({ children }: { children?: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const clearAuth = useCallback(async () => {
    setUser(null);
    setToken(null);
    await AsyncStorage.multiRemove(['token', 'user']);
  }, []);

  const persistAuth = async (authToken: string, authUser: User) => {
    setToken(authToken);
    setUser(authUser);
    await AsyncStorage.setItem('token', authToken);
    await AsyncStorage.setItem('user', JSON.stringify(authUser));
  };

  useEffect(() => {
    setUnauthorizedHandler(async () => {
      setUser(null);
      setToken(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    const loadStoredAuth = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('token');
        const storedUser = await AsyncStorage.getItem('user');

        if (storedToken && storedUser) {
          const parsedUser = JSON.parse(storedUser);
          setToken(storedToken);
          setUser(parsedUser);

          try {
            const response = await api.get('/auth/me');
            const freshUser = response.data?.user || response.data;
            if (freshUser?.id) await persistAuth(storedToken, { ...freshUser, teacherCode: response.data?.teacherCode });
          } catch (error: any) {
            if (error?.response?.status === 401) await clearAuth();
            if (isApiConfigurationError(error)) console.warn('API não configurada ao restaurar sessão. Mantendo usuário local para exibir erro claro nas telas.');
          }
        } else {
          await clearAuth();
        }
      } catch (err) {
        console.error('Erro ao carregar autenticação', err);
        await clearAuth();
      } finally {
        setLoading(false);
      }
    };
    loadStoredAuth();
  }, [clearAuth]);

  const login = async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    await persistAuth(response.data.token, { ...response.data.user, teacherCode: response.data.teacherCode });
  };

  const register = async (name: string, email: string, password: string, teacherCode: string) => {
    const response = await api.post('/auth/register', { name, email, password, profile: 'student', teacherCode });
    if (response.data.token && response.data.user) await persistAuth(response.data.token, { ...response.data.user, teacherCode: response.data.teacherCode });
  };

  const updateProfile = async (name: string, email: string) => {
    if (!token) throw new Error('Sessao expirada. Entre novamente.');
    const response = await api.patch('/auth/me', { name, email });
    const updatedUser = { ...response.data.user, teacherCode: response.data.teacherCode };
    await persistAuth(token, updatedUser);
  };

  const logout = async () => {
    await clearAuth();
  };

  return <AuthContext.Provider value={{ user, token, loading, login, register, updateProfile, logout }}>{children}</AuthContext.Provider>;
};
