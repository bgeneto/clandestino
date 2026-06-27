export function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_URL;
  if (configured && configured.length > 0) {
    return configured.replace(/\/$/, '');
  }

  return '/api';
}

export function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}
