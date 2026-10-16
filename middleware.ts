import { NextResponse, type NextRequest } from 'next/server';

// Vorschau-Sperre: Solange SITE_PREVIEW_KEY gesetzt ist, sehen Besucher die „Coming soon“-Seite.
// Zugang auf zwei Wegen → Cookie für 90 Tage:
//   1) Link: /zugang?key=<SITE_PREVIEW_KEY>
//   2) Passwortfeld auf der „Coming soon“-Seite (POST /zugang). Akzeptiert SITE_PREVIEW_PASSWORD
//      (kurz und merkbar, in Vercel setzen) oder – falls nicht gesetzt – den langen SITE_PREVIEW_KEY.
// Abmelden: /zugang?ende=1. Ohne gesetzte Variable ist die Website normal öffentlich.
const COOKIE = 'ia_preview';

// Einfacher Brute-Force-Schutz pro IP (je Edge-Instanz): 8 Fehlversuche je 10 Minuten.
const tries = new Map<string, { n: number; until: number }>();
function tooManyTries(ip: string): boolean {
  const now = Date.now();
  if (tries.size > 2000) for (const [k, v] of tries) if (v.until <= now) tries.delete(k);
  const e = tries.get(ip);
  if (!e || e.until <= now) return false;
  return e.n >= 8;
}
function noteFail(ip: string): void {
  const now = Date.now();
  const e = tries.get(ip);
  if (!e || e.until <= now) tries.set(ip, { n: 1, until: now + 10 * 60_000 });
  else e.n += 1;
}

// Subdomains: partner.immoadv.de → Unternehmensportal, admin.immoadv.de → Admin-Zentrale (nur die Startseite wird umgelenkt,
// alle übrigen Pfade wie Anmeldung und Schnittstellen funktionieren unverändert).
function hostTarget(req: NextRequest): string | null {
  const host = (req.headers.get('host') || '').toLowerCase().split(':')[0];
  if (req.nextUrl.pathname !== '/') return null;
  if (host.startsWith('partner.')) return '/b2b-portal/index.html';
  if (host.startsWith('admin.')) return '/intern/web-admin/index.html';
  return null;
}

export async function middleware(req: NextRequest) {
  const target = hostTarget(req);
  const key = process.env.SITE_PREVIEW_KEY;
  const pass = () => (target ? NextResponse.rewrite(new URL(target, req.url)) : NextResponse.next());
  if (!key) return pass();
  const { pathname, searchParams } = req.nextUrl;

  if (pathname === '/zugang') {
    const password = process.env.SITE_PREVIEW_PASSWORD;
    const grant = () => {
      const res = NextResponse.redirect(new URL('/', req.url), 303);
      res.cookies.set(COOKIE, key, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 90 * 24 * 3600 });
      return res;
    };
    if (searchParams.get('ende')) { const res = NextResponse.redirect(new URL('/', req.url)); res.cookies.delete(COOKIE); return res; }
    // Link mit Schlüssel.
    if (req.method === 'GET' && searchParams.get('key') === key) return grant();
    // Passwortformular von der „Coming soon“-Seite.
    if (req.method === 'POST') {
      const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'x';
      if (tooManyTries(ip)) return NextResponse.redirect(new URL('/?zugang=gesperrt', req.url), 303);
      const entered = await req.formData().then((f) => String(f.get('pw') || '')).catch(() => '');
      const ok = entered.length > 0 && (entered === password || entered === key);
      if (ok) return grant();
      noteFail(ip);
      return NextResponse.redirect(new URL('/?zugang=falsch', req.url), 303);
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
