const COOKIE_NAME = 'bf_auth';

export default function handler(_req, res) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const cookie = `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
  res.setHeader('Set-Cookie', cookie);
  res.writeHead(302, { Location: '/login' });
  res.end();
}
