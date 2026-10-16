import { NextResponse, type NextRequest } from 'next/server';

// Die Website ist öffentlich. Die frühere Vorschau-Sperre („Coming soon“) ist entfernt.
// Aufgaben der Middleware:
//   1) Subdomains: partner.immoadv.de → Unternehmensportal, admin.immoadv.de → Admin-Zentrale
//      (nur die Startseite wird umgelenkt; Anmeldung und Schnittstellen funktionieren unverändert).
//   2) Alte Vorschau-Links (/zugang) führen zur Startseite; das frühere Vorschau-Cookie wird gelöscht.
const OLD_COOKIE = 'ia_preview';

function hostTarget(req: NextRequest): string | null {
  const host = (req.headers.get('host') || '').toLowerCase().split(':')[0];
  if (req.nextUrl.pathname !== '/') return null;
  if (host.startsWith('partner.')) return '/b2b-portal/index.html';
  if (host.startsWith('admin.')) return '/intern/web-admin/index.html';
  return null;
}

function clearOld(res: NextResponse): NextResponse {
  res.headers.append('Set-Cookie', `${OLD_COOKIE}=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax`);
  res.headers.append('Set-Cookie', `${OLD_COOKIE}=; Path=/; Max-Age=0; Domain=.immoadv.de; Secure; HttpOnly; SameSite=Lax`);
  return res;
}

export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname === '/zugang') return clearOld(NextResponse.redirect(new URL('/', req.url), 308));
  const target = hostTarget(req);
  const res = target ? NextResponse.rewrite(new URL(target, req.url)) : NextResponse.next();
  return req.cookies.has(OLD_COOKIE) ? clearOld(res) : res;
}

export const config = {
  matcher: ['/', '/zugang'],
};
