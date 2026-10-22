// Web-Admin: personenbezogene Daten standardmäßig maskiert ausliefern (Datenminimierung).
// Klartext gibt es nur über POST /api/admin/reveal – jeder Abruf wird im Admin-Protokoll vermerkt.
export function maskEmail(v: string | null | undefined): string {
  const s = String(v || '').trim();
  const at = s.lastIndexOf('@');
  if (at < 1) return s ? '•••' : '';
  const local = s.slice(0, at), dom = s.slice(at + 1);
  const dot = dom.lastIndexOf('.');
  const host = dot > 0 ? dom.slice(0, dot) : dom, tld = dot > 0 ? dom.slice(dot) : '';
  return `${local[0]}•••@${host[0] || ''}•••${tld}`;
}

// Steuernummer / USt-IdNr. / Telefon: nur die letzten Zeichen sichtbar.
export function maskTail(v: string | null | undefined, keep = 3): string {
  const s = String(v || '').replace(/\s+/g, '');
  if (!s) return '';
  if (s.length <= keep + 1) return '•'.repeat(s.length);
  const pre = /^[A-Z]{2}/.test(s) ? s.slice(0, 2) : '';
  return `${pre}${'•'.repeat(Math.max(3, s.length - keep - pre.length))}${s.slice(-keep)}`;
}

export const PII_FIELDS = ['email', 'tax_id', 'phone'] as const;
export type PiiField = (typeof PII_FIELDS)[number];
