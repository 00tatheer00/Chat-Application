// VITE_API_URL required for production (Vercel). Set to your Railway backend URL.
// For local dev on phone: VITE_API_URL=http://YOUR_IP:3001
export const getApiUrl = () => {
  const url = import.meta.env.VITE_API_URL;
  if (url) return url.replace(/\/$/, '');
  if (typeof window !== 'undefined') {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || /^192\.168\.\d+\.\d+$/.test(window.location.hostname);
    if (isLocal) return `${window.location.protocol}//${window.location.hostname}:3001`;
    console.error('VITE_API_URL not set! Add it in Vercel env vars = your Railway backend URL');
  }
  return 'http://localhost:3001';
};

export const API_URL = getApiUrl();
