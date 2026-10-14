import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ImmoAdv – Immobilienanalyse & Bank-Ready Underwriting',
  description: 'Evidenzbasierte Immobilienanalyse, Underwriting, Risiko- und Dokumentenprüfung.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="de"><body>{children}</body></html>;
}
