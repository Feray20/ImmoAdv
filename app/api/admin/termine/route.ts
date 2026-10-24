import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { requireAdmin } from '@/lib/security/admin';
import { berlinLabel, DEFAULT_BOOKING, getBookingConfig, type BookingConfig } from '@/lib/booking/core';
import { graphCancelMeeting, graphConfigured, graphCreateMeeting, graphSelfTest } from '@/lib/booking/graph';
import { sendBookingMail, manageUrl, type Booking } from '@/lib/booking/mail';
import { esc } from '@/lib/mail/template';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const noStore = { 'Cache-Control': 'no-store' };

// Web-Admin → Termine: Anfragen annehmen (Teams-Termin im Outlook-Kalender + Bestätigung), ablehnen, absagen; Arbeitszeiten.
export async function GET(req: Request) {
  const a = await requireAdmin(req); if (a instanceof NextResponse) return a;
  const u = new URL(req.url);
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const { data } = await supabaseAdmin().from('immo_bookings').select('*').gte('starts_at', since).order('starts_at', { ascending: true }).limit(400);
  const graph = u.searchParams.get('test') ? await graphSelfTest() : { ok: graphConfigured(), message: graphConfigured() ? 'Microsoft-Zugang eingetragen.' : 'Microsoft-Zugang nicht eingetragen.' };
  return NextResponse.json({ bookings: data ?? [], config: await getBookingConfig(), defaults: DEFAULT_BOOKING, graph }, { headers: noStore });
}

const HM = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const Cfg = z.object({
  active: z.boolean(), durationMin: z.number().int().min(10).max(240), bufferMin: z.number().int().min(0).max(120),
  leadHours: z.number().int().min(0).max(336), daysAhead: z.number().int().min(1).max(120),
  days: z.record(z.enum(['0', '1', '2', '3', '4', '5', '6']), z.array(z.tuple([HM, HM])).max(6)),
  topics: z.array(z.string().trim().min(1).max(120)).max(12), intro: z.string().trim().max(400),
});
const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('accept'), id: z.string().uuid(), teamsUrl: z.string().url().max(2000).optional() }),
  z.object({ action: z.literal('decline'), id: z.string().uuid(), note: z.string().trim().max(1000).optional().default('') }),
  z.object({ action: z.literal('cancel'), id: z.string().uuid(), note: z.string().trim().max(1000).optional().default('') }),
  z.object({ action: z.literal('config'), config: Cfg.nullable() }),
]);

export async function POST(req: Request) {
  const a = await requireAdmin(req); if (a instanceof NextResponse) return a;
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: 'Ungültige Eingabe.' }, { status: 400, headers: noStore });
  const db = supabaseAdmin(), d = p.data, actor = a.user.email;

  if (d.action === 'config') {
    if (d.config) for (const r of Object.values(d.config.days)) for (const [s, e] of r) if (s >= e) return NextResponse.json({ error: `Zeitraum ${s}–${e}: Ende muss nach dem Beginn liegen.` }, { status: 400, headers: noStore });
    if (d.config) await db.from('immo_settings').upsert({ key: 'booking_config', value: d.config as BookingConfig });
    else await db.from('immo_settings').delete().eq('key', 'booking_config');
    return NextResponse.json({ config: await getBookingConfig() }, { headers: noStore });
  }

  const { data } = await db.from('immo_bookings').select('*').eq('id', d.id).maybeSingle();
  const b = data as Booking | null;
  if (!b) return NextResponse.json({ error: 'Termin nicht gefunden.' }, { status: 404, headers: noStore });
  const now = new Date().toISOString();

  if (d.action === 'accept') {
    if (b.status !== 'angefragt') return NextResponse.json({ error: 'Nur offene Anfragen können angenommen werden.' }, { status: 409, headers: noStore });
    let teams = d.teamsUrl || null, ev: string | null = null;
    if (graphConfigured()) {
      try {
        const html = `<p>Gespräch mit ImmoAdv${b.topic ? ` – ${esc(b.topic)}` : ''}.</p><p><strong>${esc(b.name)}</strong>${b.company ? `, ${esc(b.company)}` : ''}<br>${esc(b.email)}${b.phone ? `<br>${esc(b.phone)}` : ''}</p>${b.message ? `<p>${esc(b.message).replace(/\n/g, '<br>')}</p>` : ''}<p>Termin verwalten: <a href="${manageUrl(b)}">${manageUrl(b)}</a></p>`;
        const m = await graphCreateMeeting({ subject: `ImmoAdv: ${b.topic || 'Gespräch'} – ${b.name}`, start: new Date(b.starts_at), end: new Date(b.ends_at), html, attendee: { email: b.email, name: b.name } });
        ev = m.id; teams = m.joinUrl || teams;
      } catch (e) { return NextResponse.json({ error: `Teams-Termin konnte nicht angelegt werden: ${(e as Error).message}` }, { status: 502, headers: noStore }); }
    }
    const { data: upd } = await db.from('immo_bookings').update({ status: 'bestaetigt', teams_url: teams, ms_event_id: ev, decided_at: now, decided_by: actor }).eq('id', b.id).select('*').single();
    const mailed = await sendBookingMail('bestaetigt', upd as Booking);
    return NextResponse.json({ booking: upd, mailed, message: `Bestätigt für ${berlinLabel(new Date(b.starts_at))}${teams ? ' – Teams-Link verschickt.' : ' – ohne Teams-Link (Microsoft nicht verbunden).'}` }, { headers: noStore });
  }

  if (d.action === 'decline') {
    if (b.status !== 'angefragt') return NextResponse.json({ error: 'Nur offene Anfragen können abgelehnt werden.' }, { status: 409, headers: noStore });
    const { data: upd } = await db.from('immo_bookings').update({ status: 'abgelehnt', note: d.note || null, decided_at: now, decided_by: actor }).eq('id', b.id).select('*').single();
    const mailed = await sendBookingMail('abgelehnt', upd as Booking);
    return NextResponse.json({ booking: upd, mailed, message: 'Abgelehnt – der Gast wurde informiert.' }, { headers: noStore });
  }

  if (b.status !== 'bestaetigt' && b.status !== 'angefragt') return NextResponse.json({ error: 'Termin ist bereits beendet.' }, { status: 409, headers: noStore });
  if (b.ms_event_id && graphConfigured()) await graphCancelMeeting(b.ms_event_id, d.note || 'Der Termin wurde abgesagt.').catch((e) => console.error('booking_cancel', (e as Error).message));
  const { data: upd } = await db.from('immo_bookings').update({ status: 'abgesagt', note: d.note || null, decided_at: now, decided_by: actor }).eq('id', b.id).select('*').single();
  const mailed = await sendBookingMail('abgesagt', upd as Booking);
  return NextResponse.json({ booking: upd, mailed, message: 'Abgesagt – der Gast wurde informiert.' }, { headers: noStore });
}
