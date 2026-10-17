import { test } from 'node:test';
import assert from 'node:assert/strict';

test('E-Mail: Empfänger wird geprüft und normalisiert (keine Header-Injektion)', async () => {
  const { normalizeRecipient } = await import('../lib/notify/mail.ts');
  assert.equal(normalizeRecipient('  Kunde@Example.DE '), 'kunde@example.de');
  assert.equal(normalizeRecipient('a@b.de\nBcc: x@y.de'), null);
  assert.equal(normalizeRecipient('a@b.de, c@d.de'), null);
  assert.equal(normalizeRecipient('kein-mail'), null);
});

test('E-Mail: Knopf hat einen Ersatzlink, Vorschautext ist gesetzt', async () => {
  const { brandedHtml } = await import('../lib/notify/mail.ts');
  const h = brandedHtml({ title: 'Titel', text: 'Erste Zeile\n\nZweiter Absatz', button: { label: 'Öffnen', url: 'https://immoadv.de/app' } });
  assert.match(h, /Falls der Knopf nicht funktioniert/);
  assert.match(h, /display:none[^>]*>Erste Zeile/);
});

test('E-Mail: Unternehmenskunden erhalten Mails getrennt als „ImmoAdv Business“', async () => {
  const { fromAddress, brandedHtml } = await import('../lib/notify/mail.ts');
  process.env.NOTIFY_FROM_EMAIL = 'noreply@immoadv.de';
  assert.equal(fromAddress('b2b'), 'ImmoAdv Business <noreply@immoadv.de>');
  assert.equal(fromAddress(), 'ImmoAdv <noreply@immoadv.de>');
  assert.match(brandedHtml({ text: 'x', area: 'b2b' }), /Unternehmensportal<\/td>/);
  assert.doesNotMatch(brandedHtml({ text: 'x' }), /Unternehmensportal/);
  delete process.env.NOTIFY_FROM_EMAIL;
});
