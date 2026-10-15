import test from 'node:test';
import assert from 'node:assert/strict';
import { epcPayload, totals } from '../lib/b2b/epc';
import { buchungsstapel, ustJournal } from '../lib/b2b/datev';

test('Rechnungssummen: Netto, 19 % USt, Brutto in Cent', () => {
  const t = totals([{ description: 'Basic', quantity: 1, unitNetCents: 4900 }, { description: 'Mappen', quantity: 3, unitNetCents: 1000 }]);
  assert.deepEqual(t, { net: 7900, vat: 1501, gross: 9401 });
});

test('Storno ergibt negative Summen', () => {
  assert.deepEqual(totals([{ description: 'x', quantity: 1, unitNetCents: -9900 }]), { net: -9900, vat: -1881, gross: -11781 });
});

test('GiroCode (EPC069-12) Aufbau', () => {
  const p = epcPayload({ name: 'Feray Korkmaz', iban: 'DE89370400440532013000', bic: 'COBADEFFXXX', cents: 5831, reference: 'RE-2026-10-00001' });
  const l = p.split('\n');
  assert.equal(l[0], 'BCD'); assert.equal(l[1], '002'); assert.equal(l[2], '1'); assert.equal(l[3], 'SCT');
  assert.equal(l[4], 'COBADEFFXXX'); assert.equal(l[6], 'DE89370400440532013000'); assert.equal(l[7], 'EUR58.31');
  assert.equal(l[10], 'RE-2026-10-00001');
});

const rows = [
  { invoice_number: 'RE-2026-10-00001', kind: 'invoice', issue_date: '2026-10-05', net_cents: 4900, vat_cents: 931, gross_cents: 5831, buyer: { company: 'Muster GmbH' }, source: 'manual' },
  { invoice_number: 'RE-2026-10-00002', kind: 'storno', issue_date: '2026-10-20', net_cents: -4900, vat_cents: -931, gross_cents: -5831, buyer: { company: '=Formel' }, source: 'manual' },
];

test('DATEV-Buchungsstapel SKR03: Konten, Kennzeichen, Datum', () => {
  const csv = buchungsstapel(rows, 'SKR03').replace('﻿', '').trim().split('\r\n');
  assert.equal(csv[1], '58,31;S;EUR;1400;8400;051026;RE-2026-10-00001;Rechnung Muster GmbH');
  assert.equal(csv[2].split(';')[1], 'H');
  assert.ok(!csv[2].includes(';=Formel'), 'Formel-Injektion wird entschärft');
});

test('DATEV SKR04 nutzt 1200/4400', () => {
  const line = buchungsstapel(rows.slice(0, 1), 'SKR04').trim().split('\r\n')[1];
  assert.ok(line.includes(';1200;4400;'));
});

test('USt-Journal: Kennzahl 81 in vollen Euro, Summe netto', () => {
  const j = ustJournal([rows[0], { ...rows[0], invoice_number: 'RE-2026-10-00003', net_cents: 9999, vat_cents: 1900, gross_cents: 11899 }], '2026-10');
  assert.ok(j.includes('Kennzahl 81 (Bemessungsgrundlage 19 %, volle Euro);148'));
  assert.ok(j.includes('Summe;;;;148,99;28,31;177,30;'));
});
