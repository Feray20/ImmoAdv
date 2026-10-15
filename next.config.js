/** @type {import('next').NextConfig} */

// Die Marketing-Seiten liegen als statische Dateien in public/.
// Diese Rewrites liefern sie unter sauberen URLs aus (/, /impressum, /angebote …).
const STATIC_PAGES = [
  'wissen',
  'pro-begleiter',
  'checkliste',
  'angebote',
  'fuer-banken',
  'sicherheit',
  'mustermappe',
  'impressum',
  'datenschutz',
  'nutzungsbedingungen',
  'kuendigen',
  'datenraum',
  'profiler',
  'pruefen',
  'rechner',
  'fristen',
  'start',
  'szenarien',
];

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(self)' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co",
      "frame-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      'upgrade-insecure-requests',
    ].join('; '),
  },
];

module.exports = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ['@react-pdf/renderer'],
  // pdfkit lädt seine Standardschriften dynamisch; ohne diese Angabe fehlen sie im Serverpaket.
  outputFileTracingIncludes: {
    '/api/kreditmappe': ['./node_modules/pdfkit/js/**/*', './node_modules/@react-pdf/pdfkit/**/*'],
    '/api/kreditmappe/preview': ['./node_modules/pdfkit/js/**/*', './node_modules/@react-pdf/pdfkit/**/*'],
    '/api/mustermappe': ['./node_modules/pdfkit/js/**/*', './node_modules/@react-pdf/pdfkit/**/*'],
    '/api/unterlagen/[doc]': ['./node_modules/pdfkit/js/**/*', './node_modules/@react-pdf/pdfkit/**/*'],
  },
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/', destination: '/index.html' },
        ...STATIC_PAGES.map((p) => ({ source: `/${p}`, destination: `/${p}/index.html` })),
        { source: '/wissen/glossar', destination: '/wissen/glossar/index.html' },
        { source: '/rechner/tilgungsplan', destination: '/rechner/tilgungsplan/index.html' },
        { source: '/rechner/kaufnebenkosten', destination: '/rechner/kaufnebenkosten/index.html' },
        { source: '/rechner/kaufnebenkosten/:land', destination: '/rechner/kaufnebenkosten/:land/index.html' },
        { source: '/verify/:id', destination: '/pruefen/index.html' },
        { source: '/p/:slug', destination: '/partner/index.html' },
        { source: '/auth/login', destination: '/auth-login.html' },
        { source: '/auth/register', destination: '/auth-login.html' },
        { source: '/app/dashboard', destination: '/auth-login.html' },
      ],
    };
  },
  async headers() {
    // Statische Dateien tragen keinen Inhalts-Hash im Namen: kurze Frische, danach im Hintergrund
    // aktualisieren. Spart den Rundweg je Datei bei jedem Seitenwechsel; ein Deploy wirkt spätestens nach 10 Minuten.
    const swr = [{ key: 'Cache-Control', value: 'public, max-age=600, stale-while-revalidate=604800' }];
    return [
      { source: '/(.*)', headers: securityHeaders },
      { source: '/src/:file*', headers: swr },
      { source: '/data/:file*', headers: swr },
      { source: '/:icon(icon-192.png|icon-512.png|icon-192-maskable.png|icon-512-maskable.png|apple-touch-icon.png)', headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=2592000' }] },
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
    ];
  },
};
