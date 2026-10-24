// Web-Admin → Termine: Anfragen aus immoadv.de/termin annehmen (Teams-Termin im Outlook-Kalender), ablehnen, absagen; Arbeitszeiten.
import { api, esc } from './sess.mjs?v=db34bdea';

const $ = (s, r = document) => r.querySelector(s);
const TZ = 'Europe/Berlin';
const fFull = (t) => new Date(t).toLocaleString('de-DE', { timeZone: TZ, weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' Uhr';
const fTime = (t) => new Date(t).toLocaleTimeString('de-DE', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
const LAB = { angefragt: 'Offen', bestaetigt: 'Bestätigt', abgelehnt: 'Abgelehnt', abgesagt: 'Abgesagt' };
const DAYS = [['1', 'Montag'], ['2', 'Dienstag'], ['3', 'Mittwoch'], ['4', 'Donnerstag'], ['5', 'Freitag'], ['6', 'Samstag'], ['0', 'Sonntag']];
const toast = (t, bad) => { let el = $('#tmToast'); if (!el) { el = document.createElement('div'); el.id = 'tmToast'; el.className = 'pt-toast'; document.body.append(el); } el.textContent = t; el.style.background = bad ? '#991B1B' : ''; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 3800); };
let S = { tab: 'offen', data: null };

export async function termine(v) {
  v.innerHTML = '<div class="ia-ld" role="status">Termine werden geladen …</div>';
  const r = await api('/api/admin/termine');
  if (!r.ok) { v.innerHTML = `<p class="form-note">${esc(r.data?.error || 'Nicht verfügbar.')}</p>`; return; }
  S.data = r.data; draw(v);
}

function draw(v) {
  const { bookings, graph } = S.data, now = Date.now();
  const open = bookings.filter((b) => b.status === 'angefragt' && Date.parse(b.ends_at) > now);
  const next = bookings.filter((b) => b.status === 'bestaetigt' && Date.parse(b.ends_at) > now);
  const past = bookings.filter((b) => !open.includes(b) && !next.includes(b)).reverse();
  const list = { offen: open, kommend: next, verlauf: past }[S.tab];
  v.innerHTML = `<section class="tma">
    <div class="tma-head"><div><h2>Termine</h2><p class="form-note">Buchungsseite: <a href="/termin" target="_blank" rel="noopener">immoadv.de/termin</a> · ${S.data.config.active ? 'online buchbar' : '<strong>pausiert</strong>'}</p></div>
      <div class="tma-btns"><button class="btn btn-outline btn-sm" type="button" id="tmaCopy">Link kopieren</button><button class="btn btn-outline btn-sm" type="button" id="tmaCfg">Arbeitszeiten</button></div></div>
    <div class="tma-ms ${graph.ok ? 'ok' : 'warn'}"><strong>Microsoft Teams &amp; Outlook:</strong> <span id="tmaMs">${esc(graph.message)}</span>${graph.ok ? ' <button class="btn btn-ghost btn-sm" type="button" id="tmaTest">Verbindung testen</button>' : ' Bis zur Verbindung können Sie beim Annehmen einen Teams-Link selbst einfügen.'}</div>
    <div class="br-tabs" role="tablist">${[['offen', `Offene Anfragen (${open.length})`], ['kommend', `Bestätigt (${next.length})`], ['verlauf', 'Verlauf']].map(([k, l]) => `<button type="button" role="tab" data-t="${k}" aria-selected="${S.tab === k}">${l}</button>`).join('')}</div>
    <div class="tma-list">${list.length ? list.map(card).join('') : `<p class="form-note tma-empty">${S.tab === 'offen' ? 'Keine offenen Anfragen.' : S.tab === 'kommend' ? 'Keine bestätigten Termine.' : 'Noch kein Verlauf.'}</p>`}</div></section>`;
  v.querySelectorAll('[data-t]').forEach((b) => b.onclick = () => { S.tab = b.dataset.t; draw(v); });
  $('#tmaCopy', v).onclick = () => navigator.clipboard?.writeText('https://immoadv.de/termin').then(() => toast('Link kopiert.'));
  $('#tmaCfg', v).onclick = () => config(v);
  const t = $('#tmaTest', v); if (t) t.onclick = async () => { t.disabled = true; const rr = await api('/api/admin/termine?test=1'); t.disabled = false; if (rr.ok) { $('#tmaMs', v).textContent = rr.data.graph.message; toast(rr.data.graph.ok ? 'Verbindung in Ordnung.' : 'Verbindung fehlgeschlagen.', !rr.data.graph.ok); } };
  v.querySelectorAll('[data-act]').forEach((b) => b.onclick = () => act(v, b.dataset.act, b.dataset.id, b));
}

function card(b) {
  const actions = b.status === 'angefragt' && Date.parse(b.ends_at) > Date.now()
    ? `<button class="btn btn-dark btn-sm" type="button" data-act="accept" data-id="${b.id}">Annehmen</button><button class="btn btn-outline btn-sm" type="button" data-act="decline" data-id="${b.id}">Ablehnen</button>`
    : b.status === 'bestaetigt' && Date.parse(b.ends_at) > Date.now() ? `${b.teams_url ? `<a class="btn btn-sm tma-teams" href="${esc(b.teams_url)}" target="_blank" rel="noopener">Teams öffnen</a>` : ''}<button class="btn btn-outline btn-sm" type="button" data-act="cancel" data-id="${b.id}">Absagen</button>` : '';
  return `<article class="tma-card"><div class="tma-when"><strong>${esc(fFull(b.starts_at))}</strong><span>bis ${fTime(b.ends_at)}</span><em class="tma-st tma-${b.status}">${LAB[b.status]}</em></div>
    <div class="tma-who"><strong>${esc(b.name)}</strong>${b.company ? ` · ${esc(b.company)}` : ''}<br><a href="mailto:${esc(b.email)}">${esc(b.email)}</a>${b.phone ? ` · <a href="tel:${esc(b.phone)}">${esc(b.phone)}</a>` : ''}</div>
    ${b.topic ? `<p class="tma-topic">${esc(b.topic)}</p>` : ''}${b.message ? `<p class="tma-msg">${esc(b.message)}</p>` : ''}${b.note ? `<p class="form-note">Notiz: ${esc(b.note)}</p>` : ''}
    ${actions ? `<div class="tma-acts">${actions}</div>` : ''}</article>`;
}

async function act(v, a, id, btn) {
  let body = { action: a, id };
  if (a === 'accept' && !S.data.graph.ok) {
    const u = prompt('Microsoft Teams ist noch nicht verbunden. Optional einen Teams-Link einfügen (leer lassen = ohne Link bestätigen):', '');
    if (u === null) return; if (u.trim()) body.teamsUrl = u.trim();
  }
  if (a === 'decline' || a === 'cancel') {
    const n = prompt(a === 'decline' ? 'Kurze Nachricht an den Gast (optional):' : 'Grund der Absage (wird dem Gast mitgeteilt, optional):', '');
    if (n === null) return; body.note = n.trim();
  }
  btn.disabled = true; const label = btn.textContent; btn.textContent = a === 'accept' ? 'Teams-Termin wird angelegt …' : 'Bitte warten …';
  const r = await api('/api/admin/termine', { method: 'POST', body: JSON.stringify(body) });
  if (!r.ok) { btn.disabled = false; btn.textContent = label; toast(r.data?.error || 'Fehlgeschlagen.', true); return; }
  toast(r.data.message + (r.data.mailed === false ? ' (E-Mail an den Gast fehlgeschlagen)' : ''), r.data.mailed === false);
  const i = S.data.bookings.findIndex((x) => x.id === id); if (i >= 0) S.data.bookings[i] = r.data.booking;
  draw(v);
}

function config(v) {
  const c = S.data.config;
  let d = $('#tmaDlg'); if (!d) { d = document.createElement('dialog'); d.id = 'tmaDlg'; d.className = 'ad-dlg'; document.body.append(d); }
  const rows = (k) => (c.days[k] || []).map(([a, b]) => `<span class="tma-rng"><input type="time" value="${a}" data-k="${k}" data-p="a">–<input type="time" value="${b}" data-k="${k}" data-p="b"><button type="button" class="tma-x" data-rm aria-label="Zeitraum entfernen">×</button></span>`).join('');
  d.innerHTML = `<form class="ad-dlg-in" id="tmaF"><div class="ad-dlg-h"><h2>Arbeitszeiten &amp; Buchung</h2><button class="stage-x" type="button" data-x aria-label="Schließen">×</button></div>
    <label class="chk"><input type="checkbox" id="cAct"${c.active ? ' checked' : ''}> Online-Buchung aktiv</label>
    <div class="ad-grid3"><label>Dauer (Min.)<input id="cDur" type="number" min="10" max="240" value="${c.durationMin}"></label><label>Puffer (Min.)<input id="cBuf" type="number" min="0" max="120" value="${c.bufferMin}"></label><label>Vorlauf (Std.)<input id="cLead" type="number" min="0" max="336" value="${c.leadHours}"></label><label>Tage im Voraus<input id="cAhead" type="number" min="1" max="120" value="${c.daysAhead}"></label></div>
    <fieldset class="cat-box"><legend>Wochentage (deutsche Zeit)</legend>${DAYS.map(([k, l]) => `<div class="tma-day" data-day="${k}"><strong>${l}</strong><div class="tma-rngs">${rows(k) || '<span class="form-note">frei</span>'}</div><button type="button" class="btn btn-ghost btn-sm" data-add="${k}">+ Zeitraum</button></div>`).join('')}</fieldset>
    <label>Themen (eine pro Zeile)<textarea id="cTop" rows="4">${esc(c.topics.join('\n'))}</textarea></label>
    <label>Einleitung auf der Buchungsseite<input id="cIntro" maxlength="400" value="${esc(c.intro)}"></label>
    <p class="form-note">Belegte Zeiten aus Ihrem Outlook-Kalender werden automatisch ausgeblendet, sobald Microsoft verbunden ist.</p>
    <div class="pt-row"><button class="btn btn-ghost" type="button" id="cReset">Standard</button><span style="flex:1"></span><button class="btn btn-dark" type="submit">Speichern</button></div><p class="form-note" id="cMsg" role="status"></p></form>`;
  if (!d.open) d.showModal();
  d.querySelector('[data-x]').onclick = () => d.close();
  const collect = () => { const days = {}; DAYS.forEach(([k]) => { days[k] = [...d.querySelectorAll(`[data-day="${k}"] .tma-rng`)].map((s) => [s.querySelector('[data-p=a]').value, s.querySelector('[data-p=b]').value]).filter(([a, b]) => a && b); }); return days; };
  const rebind = () => {
    d.querySelectorAll('[data-rm]').forEach((b) => b.onclick = () => { const k = b.closest('[data-day]').dataset.day; b.parentElement.remove(); c.days = collect(); config(v); });
    d.querySelectorAll('[data-add]').forEach((b) => b.onclick = () => { c.days = collect(); const k = b.dataset.add; c.days[k] = [...(c.days[k] || []), ['09:00', '12:00']]; config(v); });
  };
  rebind();
  d.querySelector('#cReset').onclick = async () => { if (!confirm('Arbeitszeiten auf Standard zurücksetzen?')) return; const r = await api('/api/admin/termine', { method: 'POST', body: JSON.stringify({ action: 'config', config: null }) }); if (r.ok) { S.data.config = r.data.config; config(v); } };
  d.querySelector('#tmaF').onsubmit = async (e) => {
    e.preventDefault();
    const n = (id) => Number(d.querySelector(id).value) || 0;
    const cfg = { active: d.querySelector('#cAct').checked, durationMin: n('#cDur'), bufferMin: n('#cBuf'), leadHours: n('#cLead'), daysAhead: n('#cAhead'), days: collect(), topics: d.querySelector('#cTop').value.split('\n').map((x) => x.trim()).filter(Boolean), intro: d.querySelector('#cIntro').value.trim() };
    const r = await api('/api/admin/termine', { method: 'POST', body: JSON.stringify({ action: 'config', config: cfg }) });
    const m = d.querySelector('#cMsg');
    if (r.ok) { S.data.config = r.data.config; m.textContent = 'Gespeichert – gilt sofort auf immoadv.de/termin.'; draw(v); } else m.textContent = r.data?.error || 'Speichern fehlgeschlagen.';
  };
}
