const trimTrailingSlash = (value: string) => value.replace(/\/$/, '');

const getWindowOrigin = () => {
  if (typeof window === 'undefined' || !window.location?.origin) {
    return 'http://localhost:8080';
  }

  return trimTrailingSlash(window.location.origin);
};

export const getApiBaseUrl = () => {
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (configured && configured.trim().length > 0) {
    return trimTrailingSlash(configured);
  }

  return `${getWindowOrigin()}/api`;
};

export const getBackendBaseUrl = () => {
  return getApiBaseUrl().replace(/\/api\/?$/, '');
};

export const getWebSocketBaseUrl = () => {
  const configured = import.meta.env.VITE_WS_BASE_URL;
  if (configured && configured.trim().length > 0) {
    return trimTrailingSlash(configured);
  }

  return getBackendBaseUrl().replace(/^http/i, 'ws');
};