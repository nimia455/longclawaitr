const RAW_API_BASE = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');
const IS_STATIC_HOST_BUILD = String(import.meta.env.VITE_STATIC_HOST || '').toLowerCase() === 'true';

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return RAW_API_BASE ? `${RAW_API_BASE}${normalizedPath}` : normalizedPath;
}

export function isStaticHostWithoutBackend(): boolean {
  if (RAW_API_BASE) return false;
  if (IS_STATIC_HOST_BUILD) return true;
  if (typeof window === 'undefined') return false;
  return /\.github\.io$/i.test(window.location.hostname);
}

/**
 * GitHub Pages (both *.github.io and custom domains) returns 404 or 405 Method Not Allowed
 * (or an HTML 404.html fallback) when POSTing to /api/* without a connected backend.
 */
export function isStaticHostErrorResponse(res: Response): boolean {
  if (RAW_API_BASE) return false;
  if (res.status === 404 || res.status === 405) return true;
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  return !res.ok && contentType.includes('text/html');
}

export function getStaticHostNotice(lang: 'en' | 'tr'): string {
  return lang === 'tr'
    ? 'Bu site statik olarak (GitHub Pages) barındırılıyor. Canlı Longclaw yanıtları için bir sunucu adresi (VITE_API_BASE_URL) bağlayın veya uygulamayı tam sürüm sunucusunda açın.'
    : 'This site is running as a static GitHub Pages host. To enable live Longclaw replies, connect a backend URL (VITE_API_BASE_URL) or open the full-stack server.';
}
