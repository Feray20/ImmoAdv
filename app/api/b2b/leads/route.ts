import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { json, requireMember } from '@/lib/b2b/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COLS = 'id, source, client_name, client_email, client_phone, message, property_data, metrics, consent_at, consent_text, status, created_at';

// Anfragen des eigenen Unternehmens (alle Mitglieder sehen die Pipeline).
export async function GET(req: Request) {
  const ctx = await requireMember(req, { bucket: 'b2b-leads', limit: 60 });
  if (ctx instanceof Response) return ctx;
  const u = new URL(req.url);
  const status = u.searchParams.get('status');
  let q = supabaseAdmin().from('immo_b2b_leads').select(COLS).eq('account_id', ctx.account.id).order('created_at', { ascending: false }).limit(500);
  if (status && ['neu', 'in_bearbeitung', 'abgeschlossen', 'abgelehnt'].includes(status)) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) return json({ error: 'Anfragen konnten nicht geladen werden.' }, 500);
  if (u.searchParams.get('format') === 'csv') {
    const cell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""').replace(/^[=+\-@]/, "'$&")}"`;
    const rows = [['Eingang', 'Quelle', 'Status', 'Name', 'E-Mail', 'Telefon', 'Objekt', 'Kaufpreis', 'Kaltmiete', 'Eigenkapital', 'Darlehen', 'DSCR', 'Nachricht']];
    for (const l of data ?? []) {
      const p = (l.property_data ?? {}) as Record<string, unknown>;
      const m = (l.metrics ?? {}) as Record<string, unknown>;
      rows.push([l.created_at, l.source, l.status, l.client_name, l.client_email, l.client_phone, p.address ?? p.ref ?? '', p.price ?? '', p.rent ?? '', p.equity ?? '', m.loan ?? '', m.dscr ?? '', l.message ?? ''].map(String));
    }
    const csv = '﻿' + rows.map((r) => r.map(cell).join(';')).join('\r\n');
    return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="ImmoAdv_Anfragen.csv"', 'Cache-Control': 'no-store' } });
  }
  return json({ leads: data ?? [] });
}

const Patch = z.object({ id: z.string().uuid(), status: z.enum(['neu', 'in_bearbeitung', 'abgeschlossen', 'abgelehnt']) });

export async function PATCH(req: Request) {
  const ctx = await requireMember(req, { bucket: 'b2b-leads', limit: 60 });
  if (ctx instanceof Response) return ctx;
  const p = Patch.safeParse(await req.json().catch(() => null));
  if (!p.success) return json({ error: 'Ungültige Anfrage.' }, 400);
  const { error } = await supabaseAdmin().from('immo_b2b_leads').update({ status: p.data.status }).eq('id', p.data.id).eq('account_id', ctx.account.id);
  if (error) return json({ error: 'Speichern fehlgeschlagen.' }, 500);
  return json({ ok: true });
}

// Löschen (z. B. nach Widerruf der Einwilligung oder Ablauf der Aufbewahrung beim Partner).
export async function DELETE(req: Request) {
  const ctx = await requireMember(req, { owner: true, bucket: 'b2b-leads', limit: 60 });
  if (ctx instanceof Response) return ctx;
  const id = new URL(req.url).searchParams.get('id') ?? '';
  if (!/^[0-9a-f-]{36}$/.test(id)) return json({ error: 'Ungültige Anfrage.' }, 400);
  const { error } = await supabaseAdmin().from('immo_b2b_leads').delete().eq('id', id).eq('account_id', ctx.account.id);
  if (error) return json({ error: 'Löschen fehlgeschlagen.' }, 500);
  return json({ ok: true });
}
