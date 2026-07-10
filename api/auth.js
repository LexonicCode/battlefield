import { createHash, timingSafeEqual } from 'node:crypto';

const COOKIE_NAME = 'bf_auth';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function tokenForPassword(password) {
  return createHash('sha256').update(`battlefield-auth:${password}`).digest('hex');
}

function normalizeReturnPath(raw) {
  if (!raw || typeof raw !== 'string') return '/';
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/';
  if (raw.startsWith('/login') || raw.startsWith('/api/auth') || raw.startsWith('/api/logout')) return '/';
  return raw;
}

function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

function setAuthCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const cookie = `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE_SECONDS}${secure}`;
  res.setHeader('Set-Cookie', cookie);
}

async function parseFormBody(req) {
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  const rawBody = await new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });

  const params = new URLSearchParams(rawBody);
  return {
    password: params.get('password') || '',
    returnTo: params.get('returnTo') || '',
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const expectedPassword = process.env.SITE_PASSWORD;
  if (!expectedPassword) {
    res.status(500).json({ error: 'SITE_PASSWORD is not configured' });
    return;
  }

  const form = await parseFormBody(req);
  const suppliedPassword = String(form.password || '');
  const returnTo = normalizeReturnPath(form.returnTo);

  const supplied = Buffer.from(suppliedPassword);
  const expected = Buffer.from(expectedPassword);
  const valid = supplied.length === expected.length && timingSafeEqual(supplied, expected);

  if (!valid) {
    const loginUrl = new URL('/login', `https://${req.headers.host || 'localhost'}`);
    loginUrl.searchParams.set('error', '1');
    loginUrl.searchParams.set('next', returnTo);
    redirect(res, `${loginUrl.pathname}${loginUrl.search}`);
    return;
  }

  setAuthCookie(res, tokenForPassword(expectedPassword));
  redirect(res, returnTo);
}
