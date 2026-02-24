// Use VITE_API_URL for explicit override (e.g. in .env: VITE_API_URL=http://192.168.1.5:3001)
// Otherwise: same hostname as page, port 3001 (works when phone accesses via computer's IP)
export const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:3001`;
  }
  return 'http://localhost:3001';
};

export const API_URL = getApiUrl();
