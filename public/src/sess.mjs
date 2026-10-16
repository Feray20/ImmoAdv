// Gemeinsame Sitzungs-Helfer für Portal und internen Bereich (Supabase-Sitzung aus localStorage).
const SESSION = 'immoadv-auth-session-v1';
let cfg = null;

export const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const session = () => { try { return JSON.parse(localStorage.getItem(SESSION) || 'null'); } catch { return null; } };
export const setSession = (s) => { try { if (s) { localStorage.setItem(SESSION, JSON.stringify(s)); localStorage.setItem('ia-last-active', String(Date.now())); } else localStorage.removeItem(SESSION); } catch { /* ignore */ } };
// Abmelden (widerruft das Token, meldet alle Tabs ab); Fallback ohne Sitzungsschutz-Skript.
export const logout = () => { if (window.iaAuth) window.iaAuth.logout(); else { setSession(null); location.href = '/'; } };
export const token = () => session()?.access_token || '';

export async function config() {
  if (cfg) return cfg;
  const r = await fetch('/api/supabase-config');
  if (!r.ok) throw Error('Anmeldung ist nicht konfiguriert.');
  cfg = await r.json();
  return cfg;
}

export async function supa(path, opts = {}) {
  const c = await config();
  return fetch(c.url + path, { ...opts, headers: { apikey: c.anonKey || c.key || c.publishableKey, 'content-type': 'application/json', ...(opts.headers || {}) } });
}

// Abgelaufene Sitzung einmal mit dem Refresh-Token erneuern.
export async function refresh() {
  const s = session();
  if (!s?.refresh_token) return false;
  const r = await supa('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: s.refresh_token }) });
  if (!r.ok) return false;
  setSession(await r.json());
  return true;
}

// Aufruf eigener Schnittstellen mit Anmeldung; liefert { ok, status, data, res }.
export async function api(path, opts = {}, retry = true) {
  const headers = { Authorization: 'Bearer ' + token(), ...(opts.body && typeof opts.body === 'string' ? { 'content-type': 'application/json' } : {}), ...(opts.headers || {}) };
  const res = await fetch(path, { cache: 'no-store', ...opts, headers });
  if (res.status === 401 && retry && (await refresh())) return api(path, opts, false);
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('json') ? await res.json().catch(() => ({})) : null;
  return { ok: res.ok, status: res.status, data, res };
}

// Datei-Antwort herunterladen.
export async function download(path, opts = {}, fallbackName = 'download') {
  const r = await api(path, opts);
  if (!r.ok) throw Error(r.data?.error || 'Download fehlgeschlagen.');
  const blob = await r.res.blob();
  const cd = r.res.headers.get('content-disposition') || '';
  const m = /filename\*=UTF-8''([^;]+)|filename="([^"]+)"/.exec(cd);
  const name = m ? decodeURIComponent(m[1] || m[2]) : fallbackName;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  return r.res;
}

export const eur = (c, d = 2) => (c == null ? '–' : (c / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: d, maximumFractionDigits: d }));
export const dt = (s) => (s ? new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' }).format(new Date(s)) : '–');
export const dtt = (s) => (s ? new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(s)) : '–');
