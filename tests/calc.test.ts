import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  anschluss, verkauf, indexmiete, staffelmiete, kaufpreisaufteilung, grenze15, fristen, toICS, portfolio, addMonths, parseDate, iso,
} from '../public/src/calc.mjs';

const near = (a: number, b: number, eps = 0.01) => assert.ok(Math.abs(a - b) <= eps, `${a} ≠ ${b}`);

test('Anschluss: Mustermappe – Restschuld, Raten und Kipp-Punkt', () => {
  const a = anschluss({ loan: 149054.4, ratePa: 0.0385, repaymentPa: 0.02, fixedYears: 10, noiMonthly: 631.4, rates: [0.03, 0.04, 0.05] });
  near(a.rest, 112761.87);
  near(a.oldRate, 726.64);
  assert.deepEqual(a.rows.map((r) => r.rate), [469.84, 563.81, 657.78]);
  assert.deepEqual(a.rows.map((r) => r.cashflow), [161.56, 67.59, -26.38]);
  near(a.kippPunktPa!, 0.0472, 0.0001);
});

test('Verkauf: Verlust ohne Steuer, Gewinn innerhalb von 10 Jahren steuerpflichtig, danach steuerfrei', () => {
  const base = { price: 200000, purchaseCostPct: 10, buildingSharePct: 80, afaRatePa: 0.02, saleCostPct: 0, taxPct: 42 };
  const v0 = verkauf({ ...base, years: 5, growthPa: 0 });
  near(v0.afaTaken, 17600); near(v0.book, 202400); near(v0.gain, -2400); assert.equal(v0.tax, 0);
  const g = Math.pow(1.25, 1 / 5) - 1;
  const v1 = verkauf({ ...base, years: 5, growthPa: g });
  near(v1.value, 250000); near(v1.gain, 47600); near(v1.tax, 19992);
  const v2 = verkauf({ ...base, years: 10, growthPa: g });
  assert.equal(v2.within10, false); assert.equal(v2.tax, 0);
});

test('Verkauf: Freigrenze 1.000 € (§ 23 Abs. 3 Satz 5 EStG)', () => {
  const v = verkauf({ price: 100000, purchaseCostPct: 0, buildingSharePct: 0, afaRatePa: 0, years: 2, growthPa: Math.pow(1.00999, 1 / 2) - 1, taxPct: 40 });
  near(v.gain, 999); assert.equal(v.tax, 0);
});

test('Indexmiete und Jahresfrist (§ 557b BGB)', () => {
  const r = indexmiete({ rent: 800, indexOld: 100, indexNew: 105, lastChange: '2025-03-01', effective: '2026-02-01' })!;
  near(r.newRent, 840); assert.equal(r.changePct, 5); assert.equal(r.earliest, '2026-03-01'); assert.equal(r.timingOk, false);
  assert.equal(indexmiete({ rent: 800, indexOld: 0, indexNew: 105 }), null);
});

test('Staffelmiete: Jahresabstand und Mietpreisbremse je Staffel (§ 557a BGB)', () => {
  const s = staffelmiete({ steps: [{ date: '2026-01-01', rent: 700 }, { date: '2026-12-01', rent: 730 }, { date: '2027-12-01', rent: 760 }], area: 68, vergleichsmieteQm: 10, bremse: true });
  assert.equal(s[1].gapOk, false); assert.equal(s[2].gapOk, true);
  near(s[0].cap!, 748); assert.equal(s[1].capOk, true); assert.equal(s[2].capOk, false);
  near(s[2].increasePct, 4.11);
});

test('Kaufpreisaufteilung (Restwert) und 15-%-Grenze (Mustermappe)', () => {
  const k = kaufpreisaufteilung({ price: 300000, landArea: 500, bodenrichtwert: 200, meaShare: 1, meaTotal: 10 });
  near(k.land, 10000); near(k.building, 290000); near(k.buildingSharePct, 96.67);
  const g = grenze15({ price: 178200, purchaseCostPct: 6.5, buildingSharePct: 80, spentNet: 25000 });
  near(g.akGebaeude, 151826.4); near(g.limit, 22773.96); assert.equal(g.exceeded, true);
});

test('Fristen: Daten nach Kauf, Zinsbindung und Mieterhöhung', () => {
  const f = fristen({ purchaseDate: '2026-03-15', payoutDate: '2026-04-01', fixedYears: 15, lastRentChange: '2025-01-31' });
  const by = (t: string) => f.find((x) => x.title.startsWith(t))!.date;
  assert.equal(by('Ende der 15-%-Frist'), '2029-03-15');
  assert.equal(by('Verkauf ohne Spekulationssteuer'), '2036-03-16');
  assert.equal(by('Ende der Zinsbindung'), '2041-04-01');
  assert.equal(by('Kündigungsrecht'), '2036-04-01');
  assert.equal(by('Frühestes Vertragsende'), '2036-10-01');
  assert.equal(by('Mieterhöhung bis zur'), '2026-01-31');
  assert.equal(by('Mieterhöhung frühestens wirksam'), '2026-04-30');
  for (let i = 1; i < f.length; i++) assert.ok(f[i - 1].date <= f[i].date);
  assert.equal(iso(addMonths(parseDate('2024-01-31'), 1)), '2024-02-29');
});

test('Kalenderdatei (RFC 5545): ganztägige Termine, CRLF, gefaltete Zeilen', () => {
  const ics = toICS(fristen({ purchaseDate: '2026-03-15' }), { stamp: new Date('2026-10-15T00:00:00Z') });
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'));
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.ok(ics.includes('DTSTART;VALUE=DATE:20290315'));
  assert.ok(ics.split('\r\n').every((l) => l.length <= 75));
});

test('Portfolio: Summen, DSCR und Zinsschock ab Ende der Zinsbindung', () => {
  const objs = [
    { id: 'a', name: 'A', price: 178200, rent: 780, vacancyPct: 2, nonRecoverable: 48, maintenance: 85, loan: 149054.4, interestPct: 3.85, repaymentPct: 2, fixedYears: 10 },
    { id: 'b', name: 'B', price: 250000, rent: 1000, vacancyPct: 0, nonRecoverable: 50, maintenance: 100, loan: 0, interestPct: 0, repaymentPct: 0 },
  ];
  const p = portfolio(objs, { shockPp: 2 });
  near(p.rows[0].noiMonthly, 631.4); near(p.rows[0].cashflow, -95.24);
  assert.equal(p.rows[1].dscr, null); assert.equal(p.rows[1].after, null);
  near(p.total.price, 428200); near(p.total.cashflow, 754.76);
  near(p.rows[0].after!.rate, 737.65); // 5,85 % + 2 % Tilgung auf 112.761,87 €
  near(p.rows[0].after!.cashflow, -106.25);
  assert.equal(p.total.afterCashflow, null);
});

import { GREST, kaufnebenkosten } from '../public/src/calc.mjs';

test('Grunderwerbsteuer: 16 Länder, Stand Oktober 2026', () => {
  assert.equal(Object.keys(GREST).length, 16);
  assert.equal(GREST.bayern.pct, 3.5);
  assert.equal(GREST.bremen.pct, 5.5);
  assert.equal(GREST.hessen.pct, 6.0);
  assert.equal(GREST['nordrhein-westfalen'].pct, 6.5);
  assert.equal(GREST.thueringen.pct, 5.0);
});

test('Kaufnebenkosten Hessen 300.000 € mit Makler 3,57 %', () => {
  const k = kaufnebenkosten({ price: 300000, land: 'hessen', brokerPct: 3.57 })!;
  assert.deepEqual(k.parts.map((p) => p.amount), [18000, 4500, 1500, 10710]);
  near(k.total, 34710); assert.equal(k.totalPct, 11.57); near(k.allIn, 334710);
  assert.equal(kaufnebenkosten({ price: 300000, land: 'atlantis' }), null);
});
