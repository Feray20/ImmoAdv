import { zipSync, strToU8 } from 'fflate';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { loadInvoicePdf, type InvoiceRow } from '@/lib/b2b/invoice';
import { buchungsstapel, ustJournal, type Kontenrahmen } from '@/lib/b2b/datev';

const safe = (s: string) => s.replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'Kunde';

export type TaxArchive = { zip: Uint8Array; count: number; problems: string[] };

// Monatsarchiv für die Steuerkanzlei: Rechnungen, Korrekturen, DATEV-Buchungsstapel, USt-Journal, LIESMICH.
export async function generateMonthlyTaxArchive(monat: string, skr: Kontenrahmen): Promise<TaxArchive> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monat)) throw new Error('Monat im Format JJJJ-MM angeben.');
  const [y, m] = monat.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const { data, error } = await supabaseAdmin()
    .from('immo_invoices')
    .select('*')
    .gte('issue_date', `${monat}-01`).lte('issue_date', `${monat}-${String(last).padStart(2, '0')}`)
    .order('invoice_number', { ascending: true })
    .limit(5000);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as InvoiceRow[];

  const files: Record<string, Uint8Array> = {};
  const problems: string[] = [];
  for (const r of rows) {
    const folder = r.kind === 'invoice' ? 'Rechnungen' : 'Korrekturen';
    const name = `${folder}/${monat}_${r.invoice_number}_${safe(r.buyer?.company ?? '')}.pdf`;
    if (r.source === 'stripe') {
      if (!r.stripe_pdf_url) { problems.push(`${r.invoice_number}: kein PDF-Link von Stripe`); continue; }
      try {
        const res = await fetch(r.stripe_pdf_url, { signal: AbortSignal.timeout(10_000) });
        const buf = new Uint8Array(await res.arrayBuffer());
        if (res.ok && buf.length > 4 && String.fromCharCode(...buf.subarray(0, 4)) === '%PDF') files[name] = buf;
        else problems.push(`${r.invoice_number}: Stripe-PDF nicht abrufbar (${res.status}), Link: ${r.stripe_pdf_url}`);
      } catch {
        problems.push(`${r.invoice_number}: Stripe-PDF nicht abrufbar, Link: ${r.stripe_pdf_url}`);
      }
      continue;
    }
    const f = await loadInvoicePdf(r);
    if (!f) { problems.push(`${r.invoice_number}: PDF fehlt im Archiv`); continue; }
    if (!f.intact) problems.push(`${r.invoice_number}: PRÜFSUMME WEICHT AB – Datei nicht unverändert!`);
    files[name] = new Uint8Array(f.pdf);
  }
  files['DATEV_Buchungsstapel.csv'] = strToU8(buchungsstapel(rows, skr));
  files['Monatsjournal_Umsatzsteuer.csv'] = strToU8(ustJournal(rows, monat));
  files['LIESMICH.txt'] = strToU8(
    `ImmoAdv Monatsarchiv ${monat} (${skr})\r\nErstellt: ${new Date().toISOString()}\r\nRechnungen: ${rows.filter((r) => r.kind === 'invoice').length}, Korrekturen: ${rows.filter((r) => r.kind !== 'invoice').length}\r\n\r\n` +
    'DATEV_Buchungsstapel.csv: Spalten entsprechen dem DATEV-Buchungsstapel (Umsatz, Soll/Haben, WKZ, Konto, Gegenkonto, Belegdatum TTMMJJ, Belegfeld 1, Buchungstext).\r\n' +
    'Für den direkten DATEV-Import (EXTF) ergänzt die Kanzlei Berater- und Mandantennummer oder nutzt den ASCII-Import mit Feldzuordnung.\r\n' +
    (problems.length ? `\r\nHinweise:\r\n- ${problems.join('\r\n- ')}\r\n` : '\r\nAlle PDFs vollständig, Prüfsummen in Ordnung.\r\n'),
  );
  return { zip: zipSync(files, { level: 6 }), count: rows.length, problems };
}

export { isHoliday, nthWorkday } from '@/lib/b2b/workdays';
