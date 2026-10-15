import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Investment-Cockpit: DSCR, Stresstest, Banken-Ready-Score | ImmoAdv',
  description: 'Technische Objekt- und Kapitaldienstprüfung für Immobilien in Deutschland. Keine Finanzierungsberatung.',
  metadataBase: new URL('https://immoadv.de'),
  alternates: { canonical: '/cockpit' },
  robots: { index: true, follow: true },
  openGraph: { type: 'website', locale: 'de_DE', siteName: 'ImmoAdv', images: ['/og-image.png'] },
  manifest: '/manifest.webmanifest',
  icons: { apple: '/apple-touch-icon.png', icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }, { url: '/favicon.ico', sizes: '48x48' }] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="de"><body>{children}</body></html>;
}
