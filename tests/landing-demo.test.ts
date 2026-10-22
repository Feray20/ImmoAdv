import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demoAnalyse, DEMO_DEFAULTS, kaufnebenkosten } from '../public/src/calc.mjs';

test('Startseiten-Demo: Standardbeispiel rechnet mit dem Rechenkern', () => {
  const d = demoAnalyse();
  const nk = kaufnebenkosten({ price: DEMO_DEFAULTS.price, land: DEMO_DEFAULTS.land, brokerPct: DEMO_DEFAULTS.brokerPct })!;
  assert.equal(d.nk!.total, nk.total);
  assert.equal(d.loan, Math.round((nk.allIn - DEMO_DEFAULTS.equity) * 100) / 100);
  assert.ok(d.rate > 0 && d.rest10 < d.loan);
  assert.equal(d.lamps.length, 4);
  assert.ok(d.score >= 0 && d.score <= 100);
});

test('Startseiten-Demo: wenig Eigenkapital und Einkommen senken den Score', () => {
  const gut = demoAnalyse({ equity: 120000, netIncome: 7000 });
  const knapp = demoAnalyse({ equity: 10000, netIncome: 2500 });
  assert.ok(gut.score > knapp.score);
  assert.equal(knapp.lamps.find((l) => l.key === 'eigenkapital')!.status, 'bad');
});

test('Startseiten-Demo: eine rote Ampel deckelt den Score auf „Kritisch prüfen“', () => {
  const d = demoAnalyse({ equity: 10000 });
  assert.ok(d.lamps.some((l) => l.status === 'bad'));
  assert.ok(d.score <= 59);
  assert.equal(d.label, 'Kritisch prüfen');
});
