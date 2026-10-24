// Gemeinsame Sitzungs-Helfer für Portal und internen Bereich (Supabase-Sitzung aus localStorage).
// Privatbereich und Unternehmensportal teilen sich eine Anmeldung (einmal anmelden, beide Bereiche nutzen).
// Nur der Web-Admin hat aus Sicherheitsgründen eine eigene Sitzung.
// Creator-Bereich: bewusst eigene Sitzung – keine Verknüpfung mit Kundenbereich oder Unternehmensportal.
export const AREA = location.pathname.startsWith('/intern') ? 'admin' : location.pathname.startsWith('/creator') ? 'creator' : location.pathname.startsWith('/b2b-portal') ? 'b2b' : 'app';
const SFX = AREA === 'admin' ? '-admin' : AREA === 'creator' ? '-creator' : '';
const SESSION = AREA === 'admin' ? 'immoadv-admin-session-v1' : AREA === 'creator' ? 'immoadv-creator-session-v1' : 'immoadv-auth-session-v1';
const ACT = 'ia-last-active' + SFX;
const REM = 'ia-remember' + SFX;
let cfg = null;

export const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const session = () => { try { return JSON.parse(localStorage.getItem(SESSION) || 'null'); } catch { return null; } };
export const setSession = (s) => { try { if (s) { localStorage.setItem(SESSION, JSON.stringify(s)); localStorage.setItem(ACT, String(Date.now())); } else localStorage.removeItem(SESSION); } catch { /* ignore */ } };
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
  let r;
  try { r = await supa('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: s.refresh_token }) }); } catch { return false; }
  if (!r.ok) return false;
  setSession(await r.json());
  return true;
}

// Aufruf eigener Schnittstellen mit Anmeldung; liefert { ok, status, data, res }.
export async function api(path, opts = {}, retry = true) {
  // Web-Admin: aktiver Datenbereich (B2C / B2B / System) geht bei jeder Anfrage mit – der Server filtert danach.
  let scope = null;
  if (AREA === 'admin' && path.startsWith('/api/admin/')) { try { scope = localStorage.getItem('ia-admin-seg'); } catch { /* ignore */ } scope = ['b2c', 'b2b', 'system'].includes(scope) ? scope : 'b2c'; }
  const headers = { Authorization: 'Bearer ' + token(), ...(scope ? { 'x-admin-scope': scope } : {}), ...(opts.body && typeof opts.body === 'string' ? { 'content-type': 'application/json' } : {}), ...(opts.headers || {}) };
  let res;
  // Netzausfall (Funkloch, Tunnel, Safari „Load failed“): als normale Fehlermeldung zurückgeben statt Absturz.
  try { res = await fetch(path, { cache: 'no-store', ...opts, headers }); }
  catch { return { ok: false, status: 0, data: { error: 'Keine Verbindung. Bitte Netz prüfen und erneut versuchen.' }, res: null }; }
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

// ---------- Eigene Anmeldemaske je Bereich (Web-Admin, B2B-Portal) ----------
const ERR = {
  invalid_credentials: 'Falsche Anmeldedaten: E-Mail oder Passwort stimmt nicht. Bitte prüfen (auch Groß- und Kleinschreibung).',
  email_not_confirmed: 'Diese E-Mail-Adresse ist noch nicht bestätigt. Bitte den Link in der Bestätigungs-E-Mail öffnen.',
  over_request_rate_limit: 'Zu viele Versuche. Bitte einige Minuten warten.',
};
function authError(d) {
  const c = (d && (d.error_code || d.code)) || '';
  if (ERR[c]) return ERR[c];
  const t = String((d && (d.error_description || d.msg || d.message)) || '');
  if (/invalid login credentials/i.test(t)) return ERR.invalid_credentials;
  if (/email not confirmed/i.test(t)) return ERR.email_not_confirmed;
  if (/rate|too many/i.test(t)) return ERR.over_request_rate_limit;
  return 'Anmeldung fehlgeschlagen. Bitte erneut versuchen.';
}

// opts: { title, lead, signupLead, note, check(session) -> Promise<string|null> (Fehlertext, wenn kein Zugang), signup: { next } }
// Express-Anmeldung im Unternehmensportal (Google, Microsoft/Azure AD). Knöpfe erscheinen nur, wenn der Anbieter in Supabase aktiviert ist.
const SSO_ICON = {
  apple: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9s-2.1-.9-3.4-.9c-1.8 0-3.4 1-4.3 2.6-1.8 3.2-.5 7.9 1.3 10.5.9 1.3 1.9 2.7 3.2 2.6 1.3-.1 1.8-.8 3.3-.8s2 .8 3.4.8c1.4 0 2.3-1.3 3.1-2.6 1-1.5 1.4-2.9 1.4-3-.1 0-2.6-1-2.6-4.2zM14 4.9c.7-.9 1.2-2 1.1-3.2-1 0-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.1.1 2.3-.6 3-1.5z"/></svg>',
  google: '<svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>',
  azure: '<svg viewBox="0 0 21 21" width="18" height="18" aria-hidden="true"><path fill="#F25022" d="M1 1h9v9H1z"/><path fill="#7FBA00" d="M11 1h9v9h-9z"/><path fill="#00A4EF" d="M1 11h9v9H1z"/><path fill="#FFB900" d="M11 11h9v9h-9z"/></svg>',
};
async function ssoBind(root) {
  const box = root.querySelector('#aSso'); if (!box) return;
  let c, st;
  try { c = await config(); st = await (await fetch(c.url + '/auth/v1/settings', { headers: { apikey: c.key } })).json(); } catch { return; }
  let any = false;
  box.querySelectorAll('[data-sso]').forEach((b) => {
    const prov = b.dataset.sso;
    if (st?.external?.[prov] !== true) return;
    b.hidden = false; any = true;
    b.onclick = () => {
      try { localStorage.setItem(REM, root.querySelector('#aRem')?.checked ? '1' : '0'); } catch { /* ohne Speicher */ }
      const scopes = prov === 'azure' ? '&scopes=' + encodeURIComponent('email openid profile') : '';
      // Creator-Bereich: Rückkehr über /auth/callback (in Supabase freigegeben), die Sitzung landet dort in der Creator-Sitzung.
      let back = location.origin + '/b2b-portal';
      if (AREA === 'creator') { try { sessionStorage.setItem('ia-next', '/creator'); } catch { /* ohne Speicher */ } back = location.origin + '/auth/callback'; }
      location.href = c.url + '/auth/v1/authorize?provider=' + prov + scopes + '&redirect_to=' + encodeURIComponent(back);
    };
  });
  box.hidden = !any;
}

export function loginForm(root, opts) {
  const signup = opts.signup;
  const draw = (mode = 'login') => {
    root.innerHTML = `<div class="area-login"><a class="pt-brand dark" href="/"><img src="/logo-icon.svg" alt="" width="30" height="26"><span>Immo<span>Adv</span></span></a>
      ${opts.back ? `<button type="button" class="area-back" id="aBack">← ${esc(opts.back.label)}</button>` : ''}
      <h1>${esc(opts.title)}</h1><p class="form-note">${esc(mode === 'signup' ? (opts.signupLead || 'Neues Konto für Ihr Unternehmen anlegen. Danach registrieren Sie hier Ihr Unternehmen.') : opts.lead)}</p>
      ${signup ? `<div class="seg area-seg" role="tablist"><button type="button" role="tab" data-mode="login" aria-selected="${mode === 'login'}">Anmelden</button><button type="button" role="tab" data-mode="signup" aria-selected="${mode === 'signup'}">Konto anlegen</button></div>` : ''}
      <form id="areaForm" method="post" action="#" autocomplete="on" novalidate>
        <label>E-Mail<input id="aEmail" name="email" type="email" autocomplete="username" autocapitalize="none" spellcheck="false" required></label>
        <label>Passwort<span class="pw-wrap"><input id="aPw" name="password" type="password" minlength="8" autocomplete="${mode === 'signup' ? 'new-password' : 'current-password'}" required><button type="button" class="pw-eye" id="aEye">Anzeigen</button></span></label>
        ${mode === 'login' ? `<label class="chk remember"><input id="aRem" type="checkbox"${localStorage.getItem(REM) !== '0' ? ' checked' : ''}> Angemeldet bleiben <small>(nur auf eigenem Gerät)</small></label>` : ''}
        <div class="auth-message" id="aMsg" role="alert" hidden></div>
        <button class="btn btn-dark btn-lg" type="submit">${mode === 'signup' ? 'Konto anlegen' : 'Anmelden'}</button>
      </form>
      ${AREA === 'creator' ? `<div class="sso-box" id="aSso" hidden><div class="sso-or"><span>oder schneller</span></div><button type="button" class="btn sso-btn" data-sso="google" hidden>${SSO_ICON.google} Weiter mit Google</button><button type="button" class="btn sso-btn" data-sso="apple" hidden>${SSO_ICON.apple} Weiter mit Apple</button><button type="button" class="btn sso-btn" data-sso="azure" hidden>${SSO_ICON.azure} Weiter mit Microsoft</button><p class="form-note sso-legal">Noch kein Creator-Konto? Es wird dabei automatisch angelegt.</p></div>` : ''}
      ${AREA === 'b2b' && mode === 'login' ? `<div class="sso-box" id="aSso" hidden><div class="sso-or"><span>oder</span></div><button type="button" class="btn sso-btn" data-sso="google" hidden>${SSO_ICON.google} Mit Google anmelden</button><button type="button" class="btn sso-btn" data-sso="azure" hidden>${SSO_ICON.azure} Mit Microsoft anmelden</button><p class="form-note sso-legal">Nur für bestehende Unternehmenszugänge: Die E-Mail-Adresse des Google- bzw. Microsoft-Kontos muss Ihrem Zugang entsprechen.</p></div>` : ''}
      <p class="form-note area-links">${mode === 'login' ? `<a class="ck-link" href="${AREA === 'creator' ? '/creator#passwort' : `/auth/forgot${AREA === 'b2b' ? '?bereich=b2b' : ''}`}">Passwort vergessen?</a> · ` : ''}${opts.noteHtml || esc(opts.note || '')}</p></div>`;
    if ((AREA === 'b2b' && mode === 'login') || AREA === 'creator') ssoBind(root);
    const f = root.querySelector('#areaForm'), em = root.querySelector('#aEmail'), pw = root.querySelector('#aPw'), m = root.querySelector('#aMsg');
    const show = (t, kind = 'error') => { m.hidden = false; m.className = 'auth-message ' + kind; m.textContent = t; if (kind === 'error') { f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake'); [em, pw].forEach((x) => x.classList.add('bad')); } };
    [em, pw].forEach((x) => x.addEventListener('input', () => { x.classList.remove('bad'); m.hidden = true; }));
    root.querySelector('#aEye').onclick = (e) => { const sh = pw.type === 'password'; pw.type = sh ? 'text' : 'password'; e.target.textContent = sh ? 'Verbergen' : 'Anzeigen'; };
    root.querySelectorAll('[data-mode]').forEach((b) => b.onclick = () => draw(b.dataset.mode));
    root.querySelector('#aBack')?.addEventListener('click', () => opts.back.go());
    f.onsubmit = async (e) => {
      e.preventDefault();
      if (f.dataset.busy) return;
      const email = em.value.trim().toLowerCase(), password = pw.value;
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { show('Bitte eine gültige E-Mail-Adresse eingeben.'); em.focus(); return; }
      if (password.length < 8) { show(mode === 'signup' ? 'Bitte ein Passwort mit mindestens 8 Zeichen wählen.' : 'Falsche Anmeldedaten: Das Passwort ist zu kurz.'); pw.focus(); return; }
      f.dataset.busy = '1'; const btn = f.querySelector('button[type=submit]'); btn.disabled = true; show('Bitte warten …', 'info');
      try {
        if (AREA === 'creator') {
          // Creator-Bereich: eigene Konten – Anmeldung und Registrierung über den Server (interne Kontokennung).
          const r = await fetch('/api/creator/auth', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: mode === 'signup' ? 'signup' : 'login', email, password }) });
          const d = await r.json().catch(() => ({}));
          if (!r.ok) throw Error(d.error || (mode === 'signup' ? 'Registrierung fehlgeschlagen.' : 'Anmeldung fehlgeschlagen.'));
          if (mode === 'signup') { show('Fast geschafft: Wir haben dir eine E-Mail geschickt. Bitte bestätige darin deine E-Mail-Adresse – danach bist du direkt im Creator-Bereich angemeldet.', 'success'); return; }
          try { localStorage.setItem(REM, root.querySelector('#aRem')?.checked ? '1' : '0'); } catch { /* ignore */ }
          setSession(d.session); location.reload(); return;
        }
        if (mode === 'signup') {
          const r = await fetch('/api/auth/mail', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'signup', email, password, next: signup.next }) });
          if (r.status === 503) {
            const c = await config();
            const s2 = await supa('/auth/v1/signup?redirect_to=' + encodeURIComponent(location.origin + signup.next), { method: 'POST', body: JSON.stringify({ email, password }) });
            const d2 = await s2.json().catch(() => ({}));
            if (!s2.ok) throw Error(authError(d2));
            void c;
          } else if (!r.ok) { const d = await r.json().catch(() => ({})); throw Error(d.error || 'Registrierung fehlgeschlagen.'); }
          show('Fast geschafft: Wir haben Ihnen eine E-Mail geschickt. Bitte bestätigen Sie darin Ihre E-Mail-Adresse und melden Sie sich danach hier an.', 'success');
          return;
        }
        const r = await supa('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) });
        const d = await r.json().catch(() => ({}));
        // Fehlversuch melden (nur anonymisierte IP; ab 10 Versuchen in 15 Min. wird die Quelle gesperrt).
        if (r.status === 400 || r.status === 401) fetch('/api/sec/login-fail?area=' + (AREA === 'b2b' ? 'b2b' : AREA === 'admin' ? 'admin' : AREA === 'creator' ? 'creator' : 'app'), { method: 'POST', keepalive: true }).catch(() => {});
        if (!r.ok) throw Error(authError(d));
        if (AREA === 'b2b') try { window.iaTrack?.('b2b_login'); } catch { /* ignore */ }
        if (opts.check) { const why = await opts.check(d); if (why) { show(why); return; } }
        try { localStorage.setItem(REM, root.querySelector('#aRem')?.checked ? '1' : '0'); } catch { /* ignore */ }
        if ((d.user?.factors || []).some((x) => x.status === 'verified')) {
          const mf = await import('./mfa.mjs?v=db34bdea');
          root.innerHTML = '<div class="area-login" id="areaMfa"></div>';
          await mf.challengeUI(root.querySelector('#areaMfa'), d, () => location.reload());
          return;
        }
        setSession(d);
        location.reload();
      } catch (err) { show(err.message || 'Anmeldung fehlgeschlagen.'); }
      finally { delete f.dataset.busy; btn.disabled = false; }
    };
    // Express-Login: erkennt beim Eintippen, ob die E-Mail schon ein Konto hat (gemeinsam für Privat- und Unternehmensbereich).
    if (AREA !== 'admin' && AREA !== 'creator') import('./email-detect.mjs?v=db34bdea').then((x) => x.attach(em, { mode: mode === 'signup' ? 'register' : 'login', actions: {
      ...(signup ? { register: (v) => { draw('signup'); root.querySelector('#aEmail').value = v; root.querySelector('#aPw')?.focus(); }, login: (v) => { draw('login'); root.querySelector('#aEmail').value = v; root.querySelector('#aPw')?.focus(); } } : {}),
      ...(opts.onUnknown ? { register: (v) => opts.onUnknown(v) } : {}),
      sso: (p) => root.querySelector(`[data-sso="${p}"]`)?.click(),
    } })).catch(() => {});
    em.focus();
  };
  draw();
}
