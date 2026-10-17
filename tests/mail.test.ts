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
