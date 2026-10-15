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
];

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(self)' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

module.exports = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ['@react-pdf/renderer'],
  // pdfkit lädt seine Standardschriften dynamisch; ohne diese Angabe fehlen sie im Serverpaket.
  outputFileTracingIncludes: {
    '/api/kreditmappe': ['./node_modules/pdfkit/js/**/*', './node_modules/@react-pdf/pdfkit/**/*'],
    '/api/mustermappe': ['./node_modules/pdfkit/js/**/*', './node_modules/@react-pdf/pdfkit/**/*'],
  },
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/', destination: '/index.html' },
        ...STATIC_PAGES.map((p) => ({ source: `/${p}`, destination: `/${p}/index.html` })),
        { source: '/auth/login', destination: '/auth-login.html' },
        { source: '/auth/register', destination: '/auth-login.html' },
        { source: '/app/dashboard', destination: '/auth-login.html' },
      ],
    };
  },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};
