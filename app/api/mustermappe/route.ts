import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createElement } from 'react';
import { allowRequest } from '@/lib/security/rate-limit';
import { ObjectSchema, ProfileSchema, buildKreditmappe } from '@/lib/kreditmappe/model';
import { KreditmappeDocument } from '@/lib/kreditmappe/pdf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Öffentliche Muster-Kreditmappe mit dem fiktiven Fall der Mustermappe-Seite.
export async function GET(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!allowRequest(`mustermappe:${ip}`, 10, 60_000)) {
    return NextResponse.json({ error: 'Zu viele Anfragen.' }, { status: 429 });
  }
  const mappe = buildKreditmappe(
    ObjectSchema.parse({
      id: 'muster-0001',
      name: 'Fiktives Beispiel: Eigentumswohnung, Musterstraße 12, 12345 Musterstadt',
      price: 178200, rent: 780, area: 68, yearBuilt: 1998, purchaseCostPct: 6.5,
      nonRecoverable: 48, maintenance: 85, vacancyPct: 2,
      loan: 149054.4, interestPct: 3.85, repaymentPct: 2, lendingValue: 167120, equity: 40728.6,
      buildingSharePct: 80, marginalTaxPct: 35, renovationNet3y: 0,
      meaShare: 85, meaTotal: 1000, wegReserveTotal: 120000, wegPlannedTotal: 150000, wegSpecialTotal: 0,
      grundbuchAmt: 'Amtsgericht Musterstadt (fiktiv)', grundbuchBlatt: '0000', flur: '1', flurstueck: '1/1', ownership: 'Alleineigentum',
      heatingType: 'Gas-Brennwert', heatingYear: 2012, energyConsumption: 118, efficiencyClass: 'D', marketValue: 180000,
      grestPct: 5, notaryPct: 1.5, brokerPct: 0,
    }),
    ProfileSchema.parse({ employment: 'Angestellt', netIncome: 3650, equity: 40728.6, householdSize: 1 }),
  );
  const element = createElement(KreditmappeDocument, { m: mappe }) as unknown as Parameters<typeof renderToBuffer>[0];
  const pdf = await renderToBuffer(element);
  const sha256 = createHash('sha256').update(pdf).digest('hex');
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="ImmoAdv_Muster_Kreditmappe.pdf"',
      'X-Document-SHA256': sha256,
      'Cache-Control': 'no-store',
    },
  });
}
