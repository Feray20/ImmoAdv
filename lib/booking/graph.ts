import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';

// Microsoft Graph für das Termin-Portal: belegte Zeiten lesen, Teams-Termine im Outlook-Kalender anlegen/absagen.
// Standard: „Mit Microsoft anmelden“ im Web-Admin (Gerätecode-Anmeldung, delegierter Zugriff auf den eigenen Kalender).
// Kein Azure-Setup nötig – genutzt wird die öffentliche Microsoft-App „Microsoft Graph Command Line Tools“.
// Das Aktualisierungs-Token liegt verschlüsselt in immo_settings (ms_graph_auth).
// Alternativ (fortgeschritten): eigene App mit MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET, MS_CALENDAR_USER (App-Zugang).
const env = (k: string) => String(process.env[k] || '').trim();
const PUBLIC_CLIENT = '14d82eec-204b-4c2f-b7e8-296a70dab67e';
const SCOPE = 'offline_access openid profile User.Read Calendars.ReadWrite';
const AUTH_KEY = 'ms_graph_auth', PENDING_KEY = 'ms_graph_pending';
const appMode = () => Boolean(env('MS_TENANT_ID') && env('MS_CLIENT_ID') && env('MS_CLIENT_SECRET') && env('MS_CALENDAR_USER'));
const clientId = () => (!env('MS_CLIENT_SECRET') && env('MS_CLIENT_ID')) || PUBLIC_CLIENT;
const LOGIN = 'https://login.microsoftonline.com/organizations/oauth2/v2.0';

// ---------- Verschlüsselung des gespeicherten Tokens ----------
const key = () => createHash('sha256').update(`ms-graph:${env('SUPABASE_SERVICE_ROLE_KEY')}`).digest();
function seal(s: string): string { const iv = randomBytes(12), c = createCipheriv('aes-256-gcm', key(), iv); const e = Buffer.concat([c.update(s, 'utf8'), c.final()]); return [iv, c.getAuthTag(), e].map((b) => b.toString('base64url')).join('.'); }
function open(s: string): string | null { try { const [iv, tag, e] = s.split('.').map((x) => Buffer.from(x, 'base64url')); const d = createDecipheriv('aes-256-gcm', key(), iv); d.setAuthTag(tag); return Buffer.concat([d.update(e), d.final()]).toString('utf8'); } catch { return null; } }

type Stored = { rt: string; account: string; name: string; at: string };
async function getSetting<T>(k: string): Promise<T | null> { const { data } = await supabaseAdmin().from('immo_settings').select('value').eq('key', k).maybeSingle(); return (data?.value as T) ?? null; }
const setSetting = (k: string, value: unknown) => supabaseAdmin().from('immo_settings').upsert({ key: k, value });
const delSetting = (k: string) => supabaseAdmin().from('immo_settings').delete().eq('key', k);

let stored: { v: Stored | null; t: number } | null = null;
async function loadStored(): Promise<Stored | null> {
  if (stored && Date.now() - stored.t < 60_000) return stored.v;
  const raw = await getSetting<{ sealed: string }>(AUTH_KEY).catch(() => null);
  const v = raw?.sealed ? (JSON.parse(open(raw.sealed) || 'null') as Stored | null) : null;
  stored = { v, t: Date.now() }; return v;
}
async function saveStored(v: Stored) { await setSetting(AUTH_KEY, { sealed: seal(JSON.stringify(v)), account: v.account, at: v.at }); stored = { v, t: Date.now() }; }

// ---------- Status ----------
let delegatedKnown = false;
// Synchron für die Slot-Berechnung: true, wenn App-Zugang eingetragen ist oder eine Anmeldung gespeichert wurde (nach erstem Laden).
export const graphConfigured = () => appMode() || delegatedKnown;
export async function graphReady(): Promise<boolean> { if (appMode()) return true; const s = await loadStored(); delegatedKnown = Boolean(s); return delegatedKnown; }
export async function graphAccount(): Promise<{ mode: 'app' | 'login' | null; account: string | null; name?: string | null; since?: string | null }> {
  if (appMode()) return { mode: 'app', account: env('MS_CALENDAR_USER') };
  const s = await loadStored(); delegatedKnown = Boolean(s);
  return s ? { mode: 'login', account: s.account, name: s.name, since: s.at } : { mode: null, account: null };
}

// ---------- Anmeldung per Gerätecode ----------
export async function loginStart(): Promise<{ userCode: string; url: string; expiresIn: number; interval: number }> {
  const r = await fetch(`${LOGIN}/devicecode`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: clientId(), scope: SCOPE }), signal: AbortSignal.timeout(10000) });
  const j = (await r.json().catch(() => ({}))) as { device_code?: string; user_code?: string; verification_uri?: string; expires_in?: number; interval?: number; error_description?: string };
  if (!r.ok || !j.device_code || !j.user_code) throw new Error(`Microsoft-Anmeldung nicht möglich${j.error_description ? `: ${j.error_description.split('\r')[0].slice(0, 160)}` : ''}`);
  await setSetting(PENDING_KEY, { sealed: seal(j.device_code), until: Date.now() + (j.expires_in || 900) * 1000 });
  return { userCode: j.user_code, url: j.verification_uri || 'https://microsoft.com/devicelogin', expiresIn: j.expires_in || 900, interval: Math.max(3, j.interval || 5) };
}

export async function loginPoll(): Promise<{ status: 'pending' | 'done' | 'expired' | 'error'; message?: string; account?: string }> {
  const p = await getSetting<{ sealed: string; until: number }>(PENDING_KEY);
  if (!p || Date.now() > p.until) { await delSetting(PENDING_KEY); return { status: 'expired', message: 'Der Anmeldecode ist abgelaufen. Bitte neu starten.' }; }
  const dc = open(p.sealed); if (!dc) return { status: 'error', message: 'Anmeldung bitte neu starten.' };
  const r = await fetch(`${LOGIN}/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:device_code', client_id: clientId(), device_code: dc }), signal: AbortSignal.timeout(10000) });
  const j = (await r.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (j.error === 'authorization_pending' || j.error === 'slow_down') return { status: 'pending' };
  if (!r.ok || !j.access_token || !j.refresh_token) { await delSetting(PENDING_KEY); return { status: j.error === 'expired_token' ? 'expired' : 'error', message: j.error === 'authorization_declined' ? 'Anmeldung abgebrochen.' : (j.error_description || 'Anmeldung fehlgeschlagen.').split('\r')[0].slice(0, 200) }; }
  const me = (await fetch('https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName,displayName', { headers: { Authorization: `Bearer ${j.access_token}` }, signal: AbortSignal.timeout(10000) }).then((x) => x.json()).catch(() => ({}))) as { mail?: string; userPrincipalName?: string; displayName?: string };
  const account = (me.mail || me.userPrincipalName || '').toLowerCase();
  await saveStored({ rt: j.refresh_token, account, name: me.displayName || '', at: new Date().toISOString() });
  tok = { v: j.access_token, exp: Date.now() + (j.expires_in || 3000) * 1000 };
  delegatedKnown = true; await delSetting(PENDING_KEY);
  return { status: 'done', account };
}

export async function logout() { await delSetting(AUTH_KEY); await delSetting(PENDING_KEY); stored = null; tok = null; delegatedKnown = false; }

// ---------- Zugriffstoken ----------
let tok: { v: string; exp: number } | null = null;
async function token(): Promise<string> {
  if (tok && tok.exp > Date.now() + 60_000) return tok.v;
  if (appMode()) {
    const r = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(env('MS_TENANT_ID'))}/oauth2/v2.0/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: env('MS_CLIENT_ID'), client_secret: env('MS_CLIENT_SECRET'), scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials' }), signal: AbortSignal.timeout(10000) });
    const j = (await r.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string };
    if (!r.ok || !j.access_token) throw new Error(`Microsoft-Anmeldung fehlgeschlagen${j.error_description ? `: ${j.error_description.split('\r')[0].slice(0, 160)}` : ''}`);
    tok = { v: j.access_token, exp: Date.now() + (j.expires_in || 3000) * 1000 }; return tok.v;
  }
  const s = await loadStored();
  if (!s) throw new Error('Nicht mit Microsoft angemeldet.');
  const r = await fetch(`${LOGIN}/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', client_id: clientId(), refresh_token: s.rt, scope: SCOPE }), signal: AbortSignal.timeout(10000) });
  const j = (await r.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (!r.ok || !j.access_token) {
    if (j.error === 'invalid_grant') { await logout(); throw new Error('Microsoft-Anmeldung abgelaufen – bitte im Web-Admin unter Termine neu anmelden.'); }
    throw new Error(`Microsoft-Anmeldung fehlgeschlagen${j.error_description ? `: ${j.error_description.split('\r')[0].slice(0, 160)}` : ''}`);
  }
  if (j.refresh_token && j.refresh_token !== s.rt) await saveStored({ ...s, rt: j.refresh_token });
  tok = { v: j.access_token, exp: Date.now() + (j.expires_in || 3000) * 1000 }; return tok.v;
}

const base = async () => (appMode() ? `/users/${encodeURIComponent(env('MS_CALENDAR_USER'))}` : '/me');
const mailbox = async () => (appMode() ? env('MS_CALENDAR_USER') : (await loadStored())?.account || '');
async function g(path: string, init: RequestInit = {}) {
  const r = await fetch(`https://graph.microsoft.com/v1.0${path}`, { ...init, headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json', Prefer: 'outlook.timezone="UTC"', ...(init.headers || {}) }, signal: AbortSignal.timeout(15000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Microsoft ${r.status}: ${String((j as { error?: { message?: string } }).error?.message || '').slice(0, 200)}`);
  return j;
}

// Belegte Zeiten (frei/beschäftigt) im Zeitraum als [Start, Ende] in ms.
export async function graphBusy(from: Date, to: Date): Promise<[number, number][]> {
  const j = (await g(`${await base()}/calendar/getSchedule`, { method: 'POST', body: JSON.stringify({ schedules: [await mailbox()], startTime: { dateTime: from.toISOString().slice(0, 19), timeZone: 'UTC' }, endTime: { dateTime: to.toISOString().slice(0, 19), timeZone: 'UTC' }, availabilityViewInterval: 15 }) })) as { value?: { scheduleItems?: { status: string; start: { dateTime: string }; end: { dateTime: string } }[] }[] };
  return (j.value?.[0]?.scheduleItems || []).filter((x) => x.status !== 'free').map((x) => [Date.parse(x.start.dateTime + 'Z'), Date.parse(x.end.dateTime + 'Z')]);
}

// Teams-Besprechung als Kalendertermin anlegen; Microsoft verschickt die Einladung an den Gast.
export async function graphCreateMeeting(o: { subject: string; start: Date; end: Date; html: string; attendee: { email: string; name: string } }): Promise<{ id: string; joinUrl: string | null }> {
  const j = (await g(`${await base()}/events`, { method: 'POST', body: JSON.stringify({
    subject: o.subject, body: { contentType: 'HTML', content: o.html },
    start: { dateTime: o.start.toISOString().slice(0, 19), timeZone: 'UTC' }, end: { dateTime: o.end.toISOString().slice(0, 19), timeZone: 'UTC' },
    attendees: [{ emailAddress: { address: o.attendee.email, name: o.attendee.name }, type: 'required' }],
    isOnlineMeeting: true, onlineMeetingProvider: 'teamsForBusiness', allowNewTimeProposals: false, reminderMinutesBeforeStart: 15,
  }) })) as { id: string; onlineMeeting?: { joinUrl?: string } };
  return { id: j.id, joinUrl: j.onlineMeeting?.joinUrl || null };
}

export async function graphCancelMeeting(id: string, comment: string): Promise<void> {
  await g(`${await base()}/events/${encodeURIComponent(id)}/cancel`, { method: 'POST', body: JSON.stringify({ comment: comment.slice(0, 500) }) });
}

export async function graphSelfTest(): Promise<{ ok: boolean; message: string }> {
  if (!(await graphReady())) return { ok: false, message: 'Nicht mit Microsoft verbunden.' };
  try { await graphBusy(new Date(), new Date(Date.now() + 864e5)); return { ok: true, message: `Verbunden mit dem Kalender von ${await mailbox()}.` }; } catch (e) { return { ok: false, message: (e as Error).message }; }
}
