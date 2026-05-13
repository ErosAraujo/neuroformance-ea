import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

function normalizeApiUrl(value: string) {
  return value.trim().replace(/\/+$/, '');
}

function isLocalhost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';
}

function resolveApiUrl(value?: string) {
  const normalized = value ? normalizeApiUrl(value) : '';
  if (!normalized) return '';

  /*
   * Expo Web em celular físico normalmente abre em http://IP_DO_PC:8081.
   * Se a API estiver configurada como localhost, o navegador do celular tenta
   * acessar o próprio celular, não o PC. Neste caso, trocamos somente o host
   * local pelo mesmo host usado para abrir o app. No PC, localhost continua igual.
   */
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    try {
      const apiUrl = new URL(normalized);
      const appHost = window.location.hostname;
      const appIsRemoteLan = appHost && !isLocalhost(appHost);
      const apiIsLocal = isLocalhost(apiUrl.hostname);

      if (apiIsLocal && appIsRemoteLan) {
        apiUrl.hostname = appHost;
        return normalizeApiUrl(apiUrl.toString());
      }
    } catch {
      return normalized;
    }
  }

  return normalized;
}

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

export const API_CONFIG_ERROR = !configuredApiUrl
  ? 'EXPO_PUBLIC_API_URL não foi configurada. Crie mobile-app/.env e informe a URL da API com /api no final. PC local: http://localhost:3000/api. Celular físico: http://IP_DO_PC:3000/api. Produção: https://seu-backend/api.'
  : null;

const API_URL = resolveApiUrl(configuredApiUrl);
const IS_LOCALHOST_API = /https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/i.test(API_URL);

if (typeof __DEV__ !== 'undefined' && __DEV__) {
  if (IS_LOCALHOST_API) {
    const localHint = Platform.OS === 'web'
      ? 'No navegador do PC, localhost funciona se o backend estiver no mesmo computador. No celular, abra o app pelo IP do PC ou configure EXPO_PUBLIC_API_URL com esse IP.'
      : 'Em celular físico, localhost aponta para o próprio celular. Use o IP do computador na rede.';
    console.warn(`[API] URL configurada com host local: ${API_URL}. ${localHint}`);
  } else if (API_URL) {
    console.warn(`[API] URL configurada: ${API_URL}`);
  }
}

let unauthorizedHandler: (() => void | Promise<void>) | null = null;

export function setUnauthorizedHandler(handler: (() => void | Promise<void>) | null) {
  unauthorizedHandler = handler;
}

export function getApiBaseUrl() {
  return API_URL || 'API não configurada';
}

export function isApiConfigurationError(error: unknown) {
  return error instanceof Error && error.message === API_CONFIG_ERROR;
}

export function getApiErrorMessage(error: unknown, fallback = 'Não foi possível concluir a solicitação.') {
  if (error instanceof Error && error.message === API_CONFIG_ERROR) return error.message;
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<any>;
    const apiMessage = axiosError.response?.data?.message || axiosError.response?.data?.error;
    if (typeof apiMessage === 'string' && apiMessage.trim()) return apiMessage.trim();
    if (axiosError.code === 'ECONNABORTED') return 'A API demorou demais para responder. Verifique se o backend está rodando e tente novamente.';
    if (!axiosError.response) {
      const localHint = IS_LOCALHOST_API
        ? ' Se estiver no celular, troque localhost pelo IP do computador na rede.'
        : '';
      const webCorsHint = Platform.OS === 'web'
        ? ' Se o backend estiver vivo, confira se CORS_ORIGIN no backend permite a origem do app, por exemplo http://localhost:8081 ou http://IP_DO_PC:8081.'
        : '';
      return `Não foi possível conectar à API em ${getApiBaseUrl()}.${localHint}${webCorsHint}`;
    }
    return `Erro ${axiosError.response.status} ao comunicar com a API.`;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

const api = axios.create({
  baseURL: API_URL || 'http://0.0.0.0/api-nao-configurada',
  timeout: 15000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  if (API_CONFIG_ERROR) throw new Error(API_CONFIG_ERROR);
  const token = await AsyncStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const url = String(error?.config?.url || '');
    const isLoginRequest = url.includes('/auth/login');
    const isRegisterRequest = url.includes('/auth/register');
    if (status === 401 && !isLoginRequest && !isRegisterRequest) {
      await AsyncStorage.multiRemove(['token', 'user']);
      await unauthorizedHandler?.();
    }
    return Promise.reject(error);
  }
);

export default api;
