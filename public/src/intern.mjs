// Interner Bereich: Zugangsprüfung, Betreiber-Übersicht, dazu Suche und Analyse aus objekt-ui.mjs.
import { mountObjekt } from './objekt-ui.mjs';

const SESSION = 'immoadv-auth-session-v1';
const $ = (id) => document.getElementById(id);
const root = $('intern');
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const token = () => { try { return JSON.parse(localStorage.getItem(SESSION) || 'null')?.access_token || ''; } catch { return ''; } };

async function gate() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(SESSION) || 'null'); } catch { s = null; }
  if (!s?.access_token) { root.innerHTML = '<h1>Interner Bereich</h1><p>Bitte zuerst <a class="ck-link" href="/auth/login">anmelden</a>.</p>'; return false; }
  let r;
  try { r = await fetch('/api/admin/check', { headers: { Authorization: 'Bearer ' + s.access_token }, cache: 'no-store' }); } catch { r = null; }
  if (!r) { root.innerHTML = '<h1>Interner Bereich</h1><p>Zugang konnte nicht geprüft werden.</p>'; return false; }
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) { root.innerHTML = '<h1>Interner Bereich</h1><p>Sitzung abgelaufen. Bitte neu <a class="ck-link" href="/auth/login">anmelden</a>.</p>'; return false; }
  if (!j.admin) {
    root.innerHTML = `<h1>Kein Zugriff</h1><p>Dieser Bereich ist nur für Administratoren.${j.configured === false ? ' (In Vercel ist noch keine Administrator-Adresse hinterlegt: Variable ADMIN_EMAILS.)' : ''}</p>`;
    return false;
  }
  return true;
}

async function renderStats() {
  const box = $('st_box'); if (!box) return;
  try {
    const r = await fetch('/api/admin/stats', { headers: { Authorization: 'Bearer ' + token() }, cache: 'no-store' });
    const j = await r.json(); if (!r.ok) throw Error(j.error || 'Nicht verfügbar');
    const n = (v) => (v == null ? '–' : v.toLocaleString('de-DE'));
    const tile = (l, v) => `<div class="an-chip"><small>${l}</small><strong>${v}</strong></div>`;
    const on = (b) => (b ? '<span class="st ok">aktiv</span>' : '<span class="st bad">fehlt</span>');
    box.innerHTML = `<div class="an-chips">${tile('Konten', n(j.users))}${tile('Neu (7 Tage)', n(j.users7))}${tile('Objekte', n(j.objects))}${tile('Dokumente', n(j.docs))}${tile('Freigaben aktiv', `${n(j.sharesActive)} / ${n(j.shares)}`)}${tile('Kreditmappen', n(j.versions))}${tile('Erinnerungen an', n(j.reminders))}${tile('Offene Anforderungen', n(j.requestsOpen))}</div>
    <p class="form-note">Einstellungen: Bezahlung ${on(j.config.billing)} · E-Mail-Versand ${on(j.config.mail)} · Täglicher Lauf ${on(j.config.cron)} · Aktive Partner: ${n(j.partners)}</p>`;
  } catch (e) { box.innerHTML = `<p class="form-note">Übersicht nicht verfügbar: ${esc(e.message)}</p>`; }
}

(async () => {
  if (!(await gate())) return;
  root.innerHTML = '<h1>Interner Bereich</h1><p class="form-note">Nur für Administratoren.</p><section class="dash-card st-card"><h2>Betreiber-Übersicht</h2><div id="st_box"><p class="form-note">Wird geladen …</p></div></section>';
  mountObjekt(root, { pdf: true });
  renderStats();
})();
