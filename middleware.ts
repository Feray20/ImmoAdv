import { NextResponse, type NextRequest } from 'next/server';

// Vorschau-Sperre: Solange SITE_PREVIEW_KEY gesetzt ist, sehen Besucher die „Coming soon“-Seite.
// Zugang: einmal /zugang?key=<SITE_PREVIEW_KEY> öffnen → Cookie für 90 Tage. Abmelden: /zugang?ende=1.
// Ohne gesetzte Variable ist die Website normal öffentlich.
const COOKIE = 'ia_preview';

// Subdomains: partner.immoadv.de → Unternehmensportal, admin.immoadv.de → Admin-Zentrale (nur die Startseite wird umgelenkt,
// alle übrigen Pfade wie Anmeldung und Schnittstellen funktionieren unverändert).
function hostTarget(req: NextRequest): string | null {
  const host = (req.headers.get('host') || '').toLowerCase().split(':')[0];
  if (req.nextUrl.pathname !== '/') return null;
  if (host.startsWith('partner.')) return '/b2b-portal/index.html';
  if (host.startsWith('admin.')) return '/intern/objektsuche/index.html';
  return null;
}

export function middleware(req: NextRequest) {
  const target = hostTarget(req);
  const key = process.env.SITE_PREVIEW_KEY;
  const pass = () => (target ? NextResponse.rewrite(new URL(target, req.url)) : NextResponse.next());
  if (!key) return pass();
  const { pathname, searchParams } = req.nextUrl;

  if (pathname === '/zugang') {
    const res = NextResponse.redirect(new URL('/', req.url));
    if (searchParams.get('ende')) { res.cookies.delete(COOKIE); return res; }
    if (searchParams.get('key') === key) {
      res.cookies.set(COOKIE, key, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 90 * 24 * 3600 });
      return res;
    }
    return NextResponse.rewrite(new URL('/coming-soon.html', req.url));
  }
  if (req.cookies.get(COOKIE)?.value === key) return pass();
  const res = NextResponse.rewrite(new URL('/coming-soon.html', req.url));
  res.headers.set('X-Robots-Tag', 'noindex');
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export const config = {
  // Nicht gesperrt: Impressum und Datenschutz (Pflichtangaben), deren Skripte/Styles, Schnittstellen (täglicher Lauf, Zahlungsrückmeldungen, Konto-Aufrufe prüfen selbst),
  // Next.js-Interna und die Dateien, die die „Coming soon“-Seite braucht.
  matcher: ['/((?!api/|_next/|src/|data/|brand/|impressum|datenschutz|coming-soon\\.html|logo-icon\\.svg|favicon\\.svg|favicon\\.ico|favicon-32x32\\.png|apple-touch-icon\\.png|og-image\\.png|robots\\.txt|widget\\.js).*)'],
};
