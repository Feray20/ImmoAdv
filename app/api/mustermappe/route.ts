import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import { allowRequest } from '@/lib/security/rate-limit';
import { ObjectSchema, ProfileSchema, buildKreditmappe } from '@/lib/kreditmappe/model';
import { KreditmappeDocument } from '@/lib/kreditmappe/pdf';
import { ReportDocument } from '@/lib/pdf/report';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MUSTER = 'MUSTER — FIKTIVER FALL — IMMOADV.DE';

// Muster-Objekt-Analyse mit denselben fiktiven Zahlen wie die Beispielseite.
function analyseBeispiel() {
  return {
    title: 'Eigentumswohnung Musterstraße 12, Musterstadt',
    subtitle: 'Fiktiver Beispielfall · 68 m² · Baujahr 1998 · vermietet',
    url: undefined,
    // Dieselben Eingaben wie die Muster-Kreditmappe unten – beide Beispiele zeigen identische Kennzahlen.
    chips: [['Kaufpreis', '178.200 €'], ['€/m²', '2.621 €'], ['Kaufpreisfaktor', '16,7'], ['Bruttorendite', '5,99 %'], ['Cashflow v. St.', '+189,83 €'], ['DSCR', '1,35'], ['Mindestkapital', '11.583 €'], ['Beleihungsauslauf', '71,08 %']] as [string, string][],
    sections: [
      { title: 'Kosten und Kapital', rows: [['Kaufnebenkosten', '11.583 € (6,5 %)'], ['Gesamtkosten', '189.783 €'], ['Eigenkapital', '71.000 €'], ['Darlehen', '118.783 €']] as [string, string][] },
      { title: 'Miete und Rendite', rows: [['Kaltmiete', '890 € / Monat (13,09 €/m²)'], ['Bruttomietrendite', '5,99 %'], ['Mietausfallwagnis', '2 %'], ['Nicht umlagefähig', '48 € / Monat']] as [string, string][] },
      { title: 'Finanzierung und Risiko', rows: [['Sollzins / Tilgung', '3,55 % / 2 %'], ['Monatsrate', '549,37 €'], ['Restschuld nach 10 Jahren', '90.312,99 €'], ['Rate bei 5,00 % Anschlusszins', '526,83 €']] as [string, string][] },
    ],
    hints: ['Fiktiver Beispielfall zur Veranschaulichung – keine echten Personen oder Objekte.', 'Rechnerische Orientierungswerte, keine Kreditzusage.'],
  };
}

// Öffentliche Beispiele (Beispiel-Seite): Muster-Kreditmappe (Standard) oder Muster-Objekt-Analyse (?art=analyse).
// Immer mit Wasserzeichen „MUSTER“ und ImmoAdv-Logo-Raster; ?download=1 lädt herunter, sonst Anzeige im Browser.
export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!allowRequest(`mustermappe:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: 'Zu viele Anfragen.' }, { status: 429 });
  }
  const q = new URL(req.url).searchParams;
  const disp = q.get('download') === '1' ? 'attachment' : 'inline';
  if (q.get('art') === 'analyse') {
    const el = createElement(ReportDocument, { r: analyseBeispiel(), reportId: 'MUSTER-ANALYSE', createdAt: new Date().toISOString(), watermark: MUSTER }) as unknown as Parameters<typeof renderToBuffer>[0];
    const pdf = await renderToBuffer(el);
    return new NextResponse(new Uint8Array(pdf), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `${disp}; filename="ImmoAdv_Muster_Objekt-Analyse.pdf"`, 'X-Robots-Tag': 'noindex, nofollow', 'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800' } });
  }
  const mappe = buildKreditmappe(
    ObjectSchema.parse({
      id: 'muster-0001',
      name: 'Eigentumswohnung Musterstraße 12, Musterstadt',
      price: 178200, rent: 890, area: 68, yearBuilt: 1998, purchaseCostPct: 6.5,
      nonRecoverable: 48, maintenance: 85, vacancyPct: 2,
      loan: 118783, interestPct: 3.55, repaymentPct: 2, lendingValue: 167120, equity: 71000,
      buildingSharePct: 80, marginalTaxPct: 35, renovationNet3y: 0,
      meaShare: 85, meaTotal: 1000, wegReserveTotal: 165000, wegPlannedTotal: 150000, wegSpecialTotal: 0,
      grundbuchAmt: 'Amtsgericht Musterstadt (fiktiv)', grundbuchBlatt: '0000', flur: '1', flurstueck: '1/1', ownership: 'Alleineigentum',
      heatingType: 'Gas-Brennwert', heatingYear: 2012, energyConsumption: 118, efficiencyClass: 'D', marketValue: 180000,
      grestPct: 5, notaryPct: 1.5, brokerPct: 0,
    }),
    ProfileSchema.parse({ employment: 'Angestellt', netIncome: 3650, equity: 71000, householdSize: 1 }),
  );
  const element = createElement(KreditmappeDocument, { m: mappe, watermark: MUSTER }) as unknown as Parameters<typeof renderToBuffer>[0];
  const pdf = await renderToBuffer(element);
  const sha256 = createHash('sha256').update(pdf).digest('hex');
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${disp}; filename="ImmoAdv_Muster_Kreditmappe.pdf"`,
      'X-Robots-Tag': 'noindex, nofollow',
      'X-Document-SHA256': sha256,
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
