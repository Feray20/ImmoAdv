import { test } from 'node:test';
import assert from 'node:assert/strict';

test('Angebotsvergleich: niedrigere Kosten + Restschuld gewinnt', async () => {
  const { compareOffers } = await import('../public/src/b2c-tools.mjs');
  const r = compareOffers([
    { bank: 'A', loan: 300000, rate: 3.6, repay: 2, years: 10, fees: 0 },
    { bank: 'B', loan: 300000, rate: 3.5, repay: 2, years: 10, fees: 2000 },
  ]);
  assert.equal(r.rows.length, 2);
  assert.ok(r.sameYears);
  const a = r.rows[0], b = r.rows[1];
  assert.ok(Math.abs(a.pay - 1400) < 0.01, String(a.pay)); // 300.000 × 5,6 % / 12
  assert.ok(a.rest < 300000 && a.rest > 200000);
  assert.equal(r.best.bank, b.cost + b.rest < a.cost + a.rest ? 'B' : 'A');
});

test('Forward: Aufschlag je Vorlaufmonat, aufschlagsfreie Monate', async () => {
  const { forwardCalc } = await import('../public/src/b2c-tools.mjs');
  const r = forwardCalc({ rest: 200000, monthsToEnd: 30, todayRate: 3.5, surchargePerMonth: 0.02, repay: 2, freeMonths: 6 });
  assert.equal(r.lead, 24);
  assert.ok(Math.abs(r.fwdRate - 3.98) < 1e-9);
  assert.ok(r.fwdPay > r.todayPay);
});

test('§ 489 BGB: 10 Jahre nach Auszahlung plus 6 Monate Frist', async () => {
  const { kuendigungsrecht489 } = await import('../public/src/b2c-tools.mjs');
  const k = kuendigungsrecht489('2016-03-15');
  assert.equal(k.from.getFullYear(), 2026);
  assert.equal(k.end.getMonth(), 8);
  assert.equal(kuendigungsrecht489(''), null);
});
