import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ImmoAdv – Investment-Cockpit',
  description: 'Technische Objekt- und Kapitaldienstprüfung für Immobilien in Deutschland. Keine Finanzierungsberatung.',
  robots: { index: false },
  manifest: '/manifest.webmanifest',
  icons: { apple: '/apple-touch-icon.png', icon: '/icon-192.png' },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="de"><body>{children}</body></html>;
}
