// Microsoft Graph (App-Zugang, Client-Credentials): belegte Zeiten lesen und Teams-Termine im Outlook-Kalender anlegen.
// Benötigt in Vercel: MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET, MS_CALENDAR_USER (Postfach, z. B. feray@firma.de)
// und in Azure die Anwendungsberechtigung Calendars.ReadWrite mit Administratorzustimmung.
const env = (k: string) => String(process.env[k] || '').trim();
export const graphConfigured = () => Boolean(env('MS_TENANT_ID') && env('MS_CLIENT_ID') && env('MS_CLIENT_SECRET') && env('MS_CALENDAR_USER'));

let tok: { v: string; exp: number } | null = null;
async function token(): Promise<string> {
  if (tok && tok.exp > Date.now() + 60_000) return tok.v;
  const r = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(env('MS_TENANT_ID'))}/oauth2/v2.0/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env('MS_CLIENT_ID'), client_secret: env('MS_CLIENT_SECRET'), scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials' }),
    signal: AbortSignal.timeout(10000),
  });
  const j = (await r.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!r.ok || !j.access_token) throw new Error(`Microsoft-Anmeldung fehlgeschlagen${j.error_description ? `: ${j.error_description.split('\r')[0].slice(0, 160)}` : ''}`);
  tok = { v: j.access_token, exp: Date.now() + (j.expires_in || 3000) * 1000 };
  return tok.v;
}
const user = () => encodeURIComponent(env('MS_CALENDAR_USER'));
async function g(path: string, init: RequestInit = {}) {
  const r = await fetch(`https://graph.microsoft.com/v1.0${path}`, { ...init, headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json', Prefer: 'outlook.timezone="UTC"', ...(init.headers || {}) }, signal: AbortSignal.timeout(15000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Microsoft Graph ${r.status}: ${String((j as { error?: { message?: string } }).error?.message || '').slice(0, 200)}`);
  return j;
}

// Belegte Zeiten (frei/beschäftigt) im Zeitraum als [Start, Ende] in ms.
export async function graphBusy(from: Date, to: Date): Promise<[number, number][]> {
  const j = (await g(`/users/${user()}/calendar/getSchedule`, { method: 'POST', body: JSON.stringify({ schedules: [env('MS_CALENDAR_USER')], startTime: { dateTime: from.toISOString().slice(0, 19), timeZone: 'UTC' }, endTime: { dateTime: to.toISOString().slice(0, 19), timeZone: 'UTC' }, availabilityViewInterval: 15 }) })) as { value?: { scheduleItems?: { status: string; start: { dateTime: string }; end: { dateTime: string } }[] }[] };
  return (j.value?.[0]?.scheduleItems || []).filter((x) => x.status !== 'free').map((x) => [Date.parse(x.start.dateTime + 'Z'), Date.parse(x.end.dateTime + 'Z')]);
}

// Teams-Besprechung als Kalendertermin anlegen; Microsoft verschickt die Einladung an den Gast.
export async function graphCreateMeeting(o: { subject: string; start: Date; end: Date; html: string; attendee: { email: string; name: string } }): Promise<{ id: string; joinUrl: string | null }> {
  const j = (await g(`/users/${user()}/events`, { method: 'POST', body: JSON.stringify({
    subject: o.subject, body: { contentType: 'HTML', content: o.html },
    start: { dateTime: o.start.toISOString().slice(0, 19), timeZone: 'UTC' }, end: { dateTime: o.end.toISOString().slice(0, 19), timeZone: 'UTC' },
    attendees: [{ emailAddress: { address: o.attendee.email, name: o.attendee.name }, type: 'required' }],
    isOnlineMeeting: true, onlineMeetingProvider: 'teamsForBusiness', allowNewTimeProposals: false, reminderMinutesBeforeStart: 15,
  }) })) as { id: string; onlineMeeting?: { joinUrl?: string } };
  return { id: j.id, joinUrl: j.onlineMeeting?.joinUrl || null };
}

export async function graphCancelMeeting(id: string, comment: string): Promise<void> {
  await g(`/users/${user()}/events/${encodeURIComponent(id)}/cancel`, { method: 'POST', body: JSON.stringify({ comment: comment.slice(0, 500) }) });
}

export async function graphSelfTest(): Promise<{ ok: boolean; message: string }> {
  if (!graphConfigured()) return { ok: false, message: 'Microsoft-Zugang nicht eingetragen.' };
  try { await graphBusy(new Date(), new Date(Date.now() + 864e5)); return { ok: true, message: `Verbunden mit dem Kalender von ${env('MS_CALENDAR_USER')}.` }; } catch (e) { return { ok: false, message: (e as Error).message }; }
}
