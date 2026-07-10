const COOKIE_NAME = 'bf_auth';
const AUTH_COOKIE_VALUE = 'authenticated';
const LOGIN_PATH = '/login';
const AUTH_PREFIXES = ['/api/auth', '/api/logout'];

function parseCookies(header) {
  if (!header) return {};
  return Object.fromEntries(
    header
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf('=');
        if (index === -1) return [part, ''];
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      }),
  );
}

function isPublicPath(pathname) {
  if (pathname === LOGIN_PATH) return true;
  if (AUTH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;
  if (
    pathname.startsWith('/assets/') ||
    pathname.startsWith('/@vite') ||
    pathname.startsWith('/src/') ||
    pathname.startsWith('/node_modules/')
  ) {
    return true;
  }
  if (pathname === '/favicon.ico' || pathname === '/robots.txt' || pathname === '/sitemap.xml') {
    return true;
  }
  return /\.(?:css|js|mjs|map|json|txt|xml|png|jpg|jpeg|gif|svg|ico|webp|avif|woff2?|ttf|otf|eot|csv)$/i.test(pathname);
}

export default async function middleware(request) {
  const url = new URL(request.url);
  if (isPublicPath(url.pathname)) {
    return;
  }

  const sitePassword = process.env.SITE_PASSWORD || '';
  const cookies = parseCookies(request.headers.get('cookie'));
  const cookieToken = cookies[COOKIE_NAME] || '';
  const expectedToken = sitePassword ? AUTH_COOKIE_VALUE : '';

  if (cookieToken && expectedToken && cookieToken === expectedToken) {
    return;
  }

  const loginUrl = new URL(LOGIN_PATH, request.url);
  const nextPath = `${url.pathname}${url.search || ''}`;
  loginUrl.searchParams.set('next', nextPath);
  return Response.redirect(loginUrl.toString(), 302);
}
