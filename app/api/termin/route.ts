import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { adminConfigured, anonymizedIpHash, supabaseAdmin } from '@/lib/supabase/admin';
import { allowRequest } from '@/lib/security/rate-limit';
import { berlinLabel, freeSlots, getBookingConfig } from '@/lib/booking/core';
import { graphCancelMeeting, graphReady } from '@/lib/booking/graph';
import { notifyAdmins, sendBookingMail, type Booking } from '@/lib/booking/mail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Öffentliches Termin-Portal (immoadv.de/termin): freie Zeiten, Anfrage stellen, eigene Anfrage ansehen/absagen (per Token).
const noStore = { 'Cache-Control': 'no-store' };
const TOKEN = /^[A-Za-z0-9_-]{20,64}$/;
const ip = (req: Request) => req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'x';
const pub = (b: Booking) => ({ name: b.name, topic: b.topic, starts_at: b.starts_at, ends_at: b.ends_at, status: b.status, teams_url: b.status === 'bestaetigt' ? b.teams_url : null, note: b.status === 'abgelehnt' ? b.note : null });

export async function GET(req: Request) {
  if (!adminConfigured()) return NextResponse.json({ error: 'Nicht verfügbar.' }, { status: 503, headers: noStore });
  const u = new URL(req.url);
  const t = u.searchParams.get('b');
  if (t) {
    if (!TOKEN.test(t) || !allowRequest(`termin-get:${ip(req)}`, 60, 10 * 60_000)) return NextResponse.json({ error: 'Termin nicht gefunden.' }, { status: 404, headers: noStore });
    const { data } = await supabaseAdmin().from('immo_bookings').select('*').eq('token', t).maybeSingle();
    if (!data) return NextResponse.json({ error: 'Termin nicht gefunden.' }, { status: 404, headers: noStore });
    return NextResponse.json({ booking: pub(data as Booking) }, { headers: noStore });
  }
  if (!allowRequest(`termin-slots:${ip(req)}`, 60, 10 * 60_000)) return NextResponse.json({ error: 'Zu viele Anfragen.' }, { status: 429, headers: noStore });
  const cfg = await getBookingConfig();
  const slots = await freeSlots(cfg);
  return NextResponse.json({ active: cfg.active, durationMin: cfg.durationMin, topics: cfg.topics, intro: cfg.intro, slots }, { headers: noStore });
}

const Req = z.object({
  name: z.string().trim().min(2).max(120), email: z.string().trim().toLowerCase().email().max(200),
  company: z.string().trim().max(160).optional().default(''), phone: z.string().trim().max(40).optional().default(''),
  topic: z.string().trim().max(120).optional().default(''), message: z.string().trim().max(2000).optional().default(''),
  start: z.string().datetime(), consent: z.literal(true), website: z.string().max(0).optional(), t0: z.number().optional(),
});
const Cancel = z.object({ action: z.literal('cancel'), token: z.string().regex(TOKEN), reason: z.string().trim().max(500).optional().default('') });

export async function POST(req: Request) {
  if (!adminConfigured()) return NextResponse.json({ error: 'Nicht verfügbar.' }, { status: 503, headers: noStore });
  const raw = await req.json().catch(() => null);
  const db = supabaseAdmin();

  if (raw && raw.action === 'cancel') {
    const p = Cancel.safeParse(raw);
    if (!p.success || !allowRequest(`termin-cancel:${ip(req)}`, 10, 10 * 60_000)) return NextResponse.json({ error: 'Ungültige Anfrage.' }, { status: 400, headers: noStore });
    const { data } = await db.from('immo_bookings').select('*').eq('token', p.data.token).maybeSingle();
    const b = data as Booking | null;
    if (!b) return NextResponse.json({ error: 'Termin nicht gefunden.' }, { status: 404, headers: noStore });
    if (b.status === 'abgesagt' || b.status === 'abgelehnt') return NextResponse.json({ booking: pub(b) }, { headers: noStore });
    if (b.ms_event_id && (await graphReady())) await graphCancelMeeting(b.ms_event_id, 'Der Termin wurde vom Gast abgesagt.').catch((e) => console.error('booking_cancel', (e as Error).message));
    const note = p.data.reason ? `Absage durch Gast: ${p.data.reason}` : 'Absage durch Gast';
    const { data: upd } = await db.from('immo_bookings').update({ status: 'abgesagt', note, decided_at: new Date().toISOString(), decided_by: 'gast' }).eq('id', b.id).select('*').single();
    await notifyAdmins(`Termin abgesagt: ${b.name}`, `${b.name} <${b.email}> hat den Termin am ${berlinLabel(new Date(b.starts_at))} abgesagt.${p.data.reason ? `\nGrund: ${p.data.reason}` : ''}`);
    return NextResponse.json({ booking: pub(upd as Booking) }, { headers: noStore });
  }

  const p = Req.safeParse(raw);
  if (!p.success) return NextResponse.json({ error: 'Bitte Name, gültige E-Mail, Termin und Einwilligung angeben.' }, { status: 400, headers: noStore });
  const d = p.data;
  // Bots: verstecktes Feld ausgefüllt oder Formular in unter 3 Sekunden abgeschickt → still annehmen, nichts speichern.
  if (d.website || (d.t0 && Date.now() - d.t0 < 3000)) return NextResponse.json({ ok: true }, { headers: noStore });
  if (!allowRequest(`termin-new:${ip(req)}`, 4, 60 * 60_000) || !allowRequest(`termin-mail:${d.email}`, 3, 24 * 3600_000)) return NextResponse.json({ error: 'Zu viele Anfragen. Bitte versuchen Sie es später erneut oder schreiben Sie an support@immoadv.de.' }, { status: 429, headers: noStore });
  const cfg = await getBookingConfig();
  if (!cfg.active) return NextResponse.json({ error: 'Terminbuchung ist gerade pausiert.' }, { status: 409, headers: noStore });
  const all = Object.values(await freeSlots(cfg)).flat();
  const slot = all.find((s) => Date.parse(s.start) === Date.parse(d.start));
  if (!slot) return NextResponse.json({ error: 'Dieser Termin ist leider nicht mehr frei. Bitte wählen Sie einen anderen.', taken: true }, { status: 409, headers: noStore });
  const { count } = await db.from('immo_bookings').select('id', { count: 'exact', head: true }).eq('email', d.email).eq('status', 'angefragt');
  if ((count ?? 0) >= 2) return NextResponse.json({ error: 'Sie haben bereits offene Anfragen. Wir melden uns in Kürze.' }, { status: 409, headers: noStore });
  const token = randomBytes(24).toString('base64url');
  const { data, error } = await db.from('immo_bookings').insert({
    token, name: d.name, email: d.email, company: d.company || null, phone: d.phone || null, topic: d.topic || null, message: d.message || null,
    starts_at: slot.start, ends_at: slot.end, status: 'angefragt', ip_hash: anonymizedIpHash(req),
  }).select('*').single();
  if (error || !data) {
    if (error?.code === '23505') return NextResponse.json({ error: 'Dieser Termin wurde gerade vergeben. Bitte wählen Sie einen anderen.', taken: true }, { status: 409, headers: noStore });
    console.error('booking_insert', error?.message);
    return NextResponse.json({ error: 'Anfrage konnte nicht gespeichert werden.' }, { status: 500, headers: noStore });
  }
  const b = data as Booking;
  await sendBookingMail('angefragt', b);
  await notifyAdmins(`Neue Terminanfrage: ${b.name}`, `${b.name}${b.company ? ` (${b.company})` : ''} <${b.email}>${b.phone ? `, ${b.phone}` : ''}\nTermin: ${berlinLabel(new Date(b.starts_at))}\nThema: ${b.topic || '–'}${b.message ? `\n\n${b.message}` : ''}`);
  return NextResponse.json({ ok: true, token, booking: pub(b) }, { headers: noStore });
}
