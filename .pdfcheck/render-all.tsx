// Prüf-Harness: erzeugt alle PDF-Varianten mit Beispieldaten in ./out
import React from 'react';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createElement } from 'react';
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer';
import { GET as musterGET } from '@/app/api/mustermappe/route';
import { GET as unterlagenGET } from '@/app/api/unterlagen/[doc]/route';
import { GET as formularGET } from '@/app/api/formular/[doc]/route';
import { GET as kartenGET } from '@/app/api/karten/preise-pdf/route';
import { ObjectSchema, ProfileSchema, buildKreditmappe } from '@/lib/kreditmappe/model';
import { KreditmappeDocument } from '@/lib/kreditmappe/pdf';
import { ReportDocument, type ReportInput } from '@/lib/pdf/report';
import { renderInvoicePdf, type InvoiceRow } from '@/lib/b2b/invoice';
import { RegistrationProofDocument } from '@/lib/b2b/registration-proof';
import { renderDoc } from '@/lib/creator/pdf';
import { AVV_SECTIONS, AVV_TITLE } from '@/lib/b2b/avv-text';
import { BRAND, Logo, stamp } from '@/lib/pdf/brand';
import { analyse, kaufnebenkosten } from '@/public/src/calc.mjs';

const OUT = process.argv[2] || 'out';
mkdirSync(OUT, { recursive: true });
const save = (n: string, b: Uint8Array | Buffer) => { writeFileSync(`${OUT}/${n}.pdf`, b); console.log('ok', n, b.length); };
const R = (el: unknown) => renderToBuffer(el as Parameters<typeof renderToBuffer>[0]);
const step = async (n: string, f: () => Promise<Uint8Array | Buffer | Response>) => {
  try {
    const r = await f();
    if (r instanceof Response) { if (!r.ok) throw new Error(`HTTP ${r.status} ${await r.text()}`); save(n, Buffer.from(await r.arrayBuffer())); }
    else save(n, r);
  } catch (e) { console.log('FAIL', n, e instanceof Error ? e.stack : e); }
};

const obj = (o: Record<string, unknown> = {}) => ObjectSchema.parse({
  id: 'muster-0001', name: 'Eigentumswohnung Musterstraße 12, Musterstadt', price: 178200, rent: 890, area: 68, yearBuilt: 1998, purchaseCostPct: 6.5,
  nonRecoverable: 48, maintenance: 85, vacancyPct: 2, loan: 118783, interestPct: 3.55, repaymentPct: 2, lendingValue: 167120, equity: 71000,
  buildingSharePct: 80, marginalTaxPct: 35, renovationNet3y: 0, meaShare: 85, meaTotal: 1000, wegReserveTotal: 165000, wegPlannedTotal: 150000, wegSpecialTotal: 0,
  grundbuchAmt: 'Amtsgericht Musterstadt (fiktiv)', grundbuchBlatt: '0000', flur: '1', flurstueck: '1/1', ownership: 'Alleineigentum',
  heatingType: 'Gas-Brennwert', heatingYear: 2012, energyConsumption: 118, efficiencyClass: 'D', marketValue: 180000, grestPct: 5, notaryPct: 1.5, brokerPct: 0, ...o,
});

async function main() {
  await step('01_muster_kreditmappe', () => musterGET(new Request('http://localhost/api/mustermappe')));
  await step('02_muster_analyse', () => musterGET(new Request('http://localhost/api/mustermappe?art=analyse')));
  for (const d of ['bank-one-pager', 'berater-checkliste', 'kreditmappe-vorlage', 'analyse-vorlage']) {
    await step(`03_unterlagen_${d}`, () => unterlagenGET(new Request(`http://localhost/api/unterlagen/${d}`), { params: Promise.resolve({ doc: d }) }));
  }
  for (const d of ['analyse', 'kreditmappe']) {
    await step(`04_formular_${d}`, () => formularGET(new Request(`http://localhost/api/formular/${d}`), { params: Promise.resolve({ doc: d }) }));
  }
  await step('05_karten_preise', () => kartenGET());

  // Kreditmappe: Vorschau (Wasserzeichen), bezahlt (clean), Co-Branding, White-Label, Grenzfall (Unterdeckung, ohne Steuer/WEG)
  const m1 = buildKreditmappe(obj(), ProfileSchema.parse({ employment: 'Angestellt', netIncome: 3650, equity: 71000, householdSize: 1 }));
  await step('06_km_vorschau', () => R(createElement(KreditmappeDocument, { m: m1, watermark: 'VORSCHAU — NICHT FÜR DIE BANK' })));
  const qr = 'data:image/png;base64,' + Buffer.from(await (await import('qrcode')).default.toBuffer('https://immoadv.de/pruefen?id=x')).toString('base64');
  await step('07_km_clean_verify', () => R(createElement(KreditmappeDocument, { m: m1, clean: true, verify: { versionNo: 2, versionId: 'KM-2026-ABCDEF12', url: 'https://immoadv.de/pruefen', qrDataUrl: qr } })));
  await step('08_km_cobrand', () => R(createElement(KreditmappeDocument, { m: m1, clean: true, partner: { name: 'Baufinanz Muster GmbH', color: '#0E7490' } })));
  await step('09_km_whitelabel', () => R(createElement(KreditmappeDocument, { m: m1, clean: true, partner: { name: 'Sparkasse Musterstadt', color: '#DC2626', whitelabel: true } })));
  const m2 = buildKreditmappe(obj({ name: 'Einfamilienhaus Musterallee 123–125 − Hinterhaus ≥ 2. OG, Şişli-Straße (sehr langer Name, 12345 Musterstadt-Süd)', price: 650000, rent: 0, loan: 640000, equity: 20000, lendingValue: 0, buildingSharePct: 0, marginalTaxPct: 0, meaShare: 0, meaTotal: 0, interestPct: 4.2, repaymentPct: 1 }),
    ProfileSchema.parse({ employment: 'Selbstständig', netIncome: 2800, equity: 20000, householdSize: 4 }));
  await step('10_km_grenzfall', () => R(createElement(KreditmappeDocument, { m: m2, clean: true })));

  // Objekt-Analyse wie aus dem Browser (mit typischen Sonderzeichen)
  const rep: ReportInput = {
    title: 'ETW Beispielweg 5, Frankfurt am Main', subtitle: '72 m² · Baujahr 1975', url: 'https://www.example.org/expose/123456789',
    chips: [['Kaufpreis', '320.000 €'], ['€/m²', '4.444 €'], ['Cashflow', '−212,40 €'], ['DSCR', '0,84'], ['Rendite', '≈ 3,9 %'], ['LTV', '≥ 90 %']],
    sections: [{ title: 'Finanzierung', rows: [['Rate', '1.432,00 €'], ['Zins → Anschluss', '5,0 %'], ['Hinweis', 'Sondertilgung ✓']] }],
    hints: ['Miete − Kosten ≤ Rate: Unterdeckung', 'Werte gerundet („ca.“)'],
  };
  await step('11_analyse_bezahlt', () => R(createElement(ReportDocument, { r: rep, reportId: 'abcd-1234', createdAt: new Date().toISOString(), hash: 'f'.repeat(64), reportType: 'RenditeRadar · Objekt-Analyse', clean: true })));

  // Finanzierungsübersicht (Lead) wie in app/api/b2b/lead/pdf
  const eur = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }) + ' €' : '–');
  const pct = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v.toLocaleString('de-DE', { maximumFractionDigits: 2 }) + ' %' : '–');
  const input = { price: 349000, rent: 1150, area: 82, land: 'hessen', equity: 45000, ratePct: 3.8, repaymentPct: 2, brokerPct: 3.57, maintenanceQm: 1, vacancyPct: 2 };
  const r = analyse(input); const nk = kaufnebenkosten({ price: input.price, land: input.land, brokerPct: input.brokerPct });
  console.log('lead analyse', JSON.stringify(r), JSON.stringify(nk));
  const lrep: ReportInput = {
    title: 'Finanzierungsübersicht – Beispielstraße 1, Darmstadt', subtitle: 'Für Max Mustermann · erstellt über die Seite von Baufinanz Muster GmbH',
    chips: [['Gesamtkosten', eur(r.allIn)], ['Darlehen', eur(r.loan)], ['Monatsrate', eur(r.rate)], ['Eigenkapital', eur(input.equity)]],
    sections: [
      { title: 'Kaufnebenkosten', rows: [...nk.parts.map((x: { label: string; pct: number; amount: number }) => [`${x.label} (${pct(x.pct)})`, eur(x.amount)] as [string, string]), ['Summe Nebenkosten', eur(nk.total)]] },
      { title: 'Finanzierung', rows: [['Kaufpreis', eur(input.price)], ['Darlehen', eur(r.loan)], ['Beleihungsauslauf (Darlehen/Kaufpreis)', pct(r.ltv)], ['Monatsrate', eur(r.rate)], ['Restschuld nach 10 Jahren', eur(r.restAfterFixed)], ['Rate bei +2 Prozentpunkten Zins', eur(r.rateStress)]] },
      { title: 'Vermietung (rechnerisch)', rows: [['Bruttomietrendite', pct(r.grossYield)], ['Nettomietrendite', pct(r.netYield)], ['Cashflow vor Steuern / Monat', eur(r.cashflow)], ['Kapitaldienstdeckung (DSCR)', r.dscr == null ? '–' : String(r.dscr).replace('.', ',')], ['Miete für DSCR 1,2', eur(r.rentDscr12)]] },
    ],
    hints: ['Annahmen: Notar 1,5 %, Grundbuch 0,5 %, Instandhaltung 1 €/m² im Monat, Mietausfall 2 %.'],
  };
  await step('12_lead_uebersicht', () => R(createElement(ReportDocument, { r: lrep, reportId: 'abcd1234', createdAt: new Date().toISOString(), partner: { name: 'Baufinanz Muster GmbH', color: '#0E7490' }, reportType: 'Finanzierungsübersicht' })));

  // Rechnung, Storno, Gutschrift
  process.env.INVOICE_IBAN = 'DE02120300000000202051'; process.env.INVOICE_BIC = 'BYLADEM1001'; process.env.INVOICE_BANK_NAME = 'Musterbank';
  const inv: InvoiceRow = {
    id: 'x', invoice_number: 'RE-2026-10-00042', kind: 'invoice', refers_to: null, source: 'manual', account_id: null,
    buyer: { company: 'Yılmaz & Şahin Immobilien GmbH', legalForm: 'GmbH', contact: 'Ayşe Yılmaz', street: 'Musterweg 1', postalCode: '64283', city: 'Darmstadt', vatId: 'DE123456789', customerNumber: 'K-10042' },
    items: [{ description: 'Kanzlei & Baufi Pro – Monatsabo Oktober 2026', quantity: 1, unitNetCents: 13900 }, { description: 'Zusätzlicher Berater-Zugang', quantity: 2, unitNetCents: 2500 }],
    net_cents: 18900, vat_rate: 19, vat_cents: 3591, gross_cents: 22491, payment_method: 'INVOICE_BANK_TRANSFER', payment_status: 'PENDING', issue_date: '2026-10-24', service_period: '01.10.2026 – 31.10.2026',
    due_date: '2026-11-07', paid_at: null, pdf_path: null, pdf_sha256: null, stripe_invoice_id: null, stripe_pdf_url: null, created_by: null, created_at: new Date().toISOString(),
  };
  await step('13_rechnung', () => renderInvoicePdf(inv));
  await step('14_storno', () => renderInvoicePdf({ ...inv, invoice_number: 'RE-2026-10-00043', kind: 'storno', items: inv.items.map((i) => ({ ...i, unitNetCents: -i.unitNetCents })), net_cents: -18900, vat_cents: -3591, gross_cents: -22491 }, 'RE-2026-10-00042'));

  await step('15_registrierung', () => R(createElement(RegistrationProofDocument, { p: {
    proofId: 'REG-2026-ABC123', createdAt: new Date().toISOString(), customerNumber: 'K-10042',
    company: { name: 'Baufinanz Muster GmbH', legalForm: 'GmbH', type: 'BROKER', registerNumber: 'D-W-123-ABCD-45', taxId: 'DE123456789', street: 'Musterweg 1', postalCode: '64283', city: 'Darmstadt', slug: 'baufinanz-muster' },
    person: { name: 'Ayşe Yılmaz', email: 'erika@example.org', phone: '+49 6151 000000' },
    account: { userId: '00000000-0000-0000-0000-000000000000', emailConfirmedAt: new Date().toISOString(), signedUpAt: new Date().toISOString() },
    consents: [{ key: 'richtig', at: new Date().toISOString() }, { key: 'unternehmer', at: new Date().toISOString() }, { key: 'avv', at: new Date().toISOString(), version: '2026-10' }, { key: 'agb', at: new Date().toISOString() }],
    partnerCode: null, tech: { ipHash: 'a1b2c3d4e5f6', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15' }, sha256: 'e'.repeat(64),
  } })));

  await step('16_creator_gutschrift', () => renderDoc({
    kind: 'CREDIT_NOTE', title: 'Gutschrift', number: 'GS-2026-10-0007', issueDate: '24.10.2026', servicePeriod: '01.10.2026 – 31.10.2026',
    issuer: { name: 'ImmoAdv', lines: ['Feray Korkmaz', 'Georg-August-Zinn-Str. 25', '64354 Reinheim'], taxIds: ['USt-IdNr. DE348036700'] },
    recipient: { name: 'Max Creator', lines: ['Beispielweg 2', '10115 Berlin'], taxIds: ['Steuernr. 12/345/67890'] },
    meta: [['IBAN', 'DE02 **** **** **** 2051']],
    lines: [{ description: 'Provision Käufer-Pass (3 Verkäufe)', detail: 'Zeitraum 01.10.–31.10.2026 → Auszahlung', amountCents: 4410 }],
    totals: [['Netto', '44,10 €'], ['USt 19 %', '8,38 €'], ['Gesamt', '52,48 €', true]], notes: ['Gutschrift im Sinne des § 14 Abs. 2 Satz 2 UStG.'], footer: 'ImmoAdv · Georg-August-Zinn-Str. 25 · 64354 Reinheim',
  }));

  // AVV wie app/api/b2b/avv (Komponente nicht exportiert -> gleiche Struktur)
  const sa = StyleSheet.create({
    page: { paddingTop: 40, paddingBottom: 50, paddingHorizontal: 50, fontFamily: 'Helvetica', fontSize: 9, color: BRAND.text, lineHeight: 1.45 },
    h1: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: BRAND.navy, lineHeight: 1.25, marginTop: 16, marginBottom: 4 },
    h2: { fontSize: 10.5, fontFamily: 'Helvetica-Bold', color: BRAND.navy, marginTop: 10, marginBottom: 3 },
    p: { marginBottom: 3 }, box: { borderWidth: 0.5, borderColor: BRAND.hair, padding: 8, marginTop: 8, borderRadius: 3 },
    footer: { position: 'absolute', bottom: 20, left: 50, right: 50, fontSize: 7, color: BRAND.muted, flexDirection: 'row', justifyContent: 'space-between' },
  });
  await step('17_avv', () => R(
    <Document title="AVV"><Page size="A4" style={sa.page}><Logo size={16} /><Text style={sa.h1}>{AVV_TITLE}</Text><Text>Version 2026-10</Text>
      <View style={sa.box}><Text>Auftraggeber: Baufinanz Muster GmbH (GmbH), Musterweg 1, 64283 Darmstadt</Text><Text>Elektronisch geschlossen am: {stamp(new Date().toISOString())}</Text></View>
      {AVV_SECTIONS.map((sec) => (<View key={sec.h} wrap><Text style={sa.h2}>{sec.h}</Text>{sec.p.map((t, i) => <Text key={i} style={sa.p}>{t}</Text>)}</View>))}
      <View style={sa.footer} fixed><Text>ImmoAdv · Georg-August-Zinn-Str. 25 · 64354 Reinheim · support@immoadv.de</Text><Text render={({ pageNumber, totalPages }) => `Seite ${pageNumber} von ${totalPages}`} /></View>
    </Page></Document>));
}
main().then(() => console.log('done'));
