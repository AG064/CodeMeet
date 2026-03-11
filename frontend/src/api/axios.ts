import axios from 'axios';
import { getApiBaseUrl } from '../utils/network';

const API_BASE_URL = getApiBaseUrl();

type ApiErrorResponse = {
  message?: string;
} | string;

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && token !== 'undefined' && token !== 'null' && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  } else if (token === 'undefined' || token === 'null') {
    localStorage.removeItem('token');
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Do not force logout or redirect. Let components handle error statuses.
    if (error.response?.status === 401 || error.response?.status === 403) {
      localStorage.removeItem('token');
    }
    return Promise.reject(error);
  }
);

export const getApiErrorMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError<ApiErrorResponse>(error)) {
    const data = error.response?.data;
    if (typeof data === 'string' && data.trim().length > 0) {
      return data;
    }
    if (
      typeof data === 'object' &&
      data !== null &&
      'message' in data &&
      typeof data.message === 'string' &&
      data.message.trim().length > 0
    ) {
      return data.message;
    }
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
};

export default api;
