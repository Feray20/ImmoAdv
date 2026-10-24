// Öffentliches Termin-Portal (/termin): freien Termin wählen → Anfrage → Bestätigung mit Microsoft-Teams-Link per E-Mail.
// Mit ?b=<token> (Link aus der E-Mail): eigene Anfrage ansehen und absagen.
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const TZ = 'Europe/Berlin';
const fDay = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString('de-DE', { timeZone: 'UTC', weekday: 'short' }).replace('.', '');
const fNum = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString('de-DE', { timeZone: 'UTC', day: '2-digit', month: '2-digit' });
const fLong = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString('de-DE', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' });
const fTime = (t) => new Date(t).toLocaleTimeString('de-DE', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
const fFull = (t) => new Date(t).toLocaleString('de-DE', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' Uhr';
const loading = (t) => `<div class="ia-ld" role="status">${esc(t)}</div>`;
const ICON = { ok: '<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path fill="currentColor" d="M9.5 16.2 5.3 12l-1.4 1.4 5.6 5.6L20.1 8.4 18.7 7z"/></svg>', cal: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M7 2h2v2h6V2h2v2h3a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3V2Zm12 8H5v9h14v-9Z"/></svg>' };
const STATUS = { angefragt: ['Angefragt', 'Wir prüfen Ihre Anfrage und melden uns in Kürze mit der Bestätigung.'], bestaetigt: ['Bestätigt', 'Ihr Termin steht. Den Teams-Link finden Sie unten und in Ihrer E-Mail.'], abgelehnt: ['Nicht möglich', 'Der Termin passt leider nicht. Bitte wählen Sie einen neuen.'], abgesagt: ['Abgesagt', 'Dieser Termin wurde abgesagt.'] };

async function call(url, body) {
  try {
    const r = await fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' });
    return { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) };
  } catch { return { ok: false, status: 0, data: { error: 'Keine Verbindung. Bitte prüfen Sie Ihre Internetverbindung.' } }; }
}

function start() {
  const root = document.getElementById('terminApp');
  if (!root) return;
  const token = new URLSearchParams(location.search).get('b');
  if (token) manage(root, token); else book(root);
}

async function manage(root, token) {
  root.innerHTML = loading('Ihr Termin wird geladen …');
  const r = await call(`/api/termin?b=${encodeURIComponent(token)}`);
  if (!r.ok) { root.innerHTML = `<div class="tm-card tm-center"><h2>Termin nicht gefunden</h2><p>Der Link ist ungültig oder abgelaufen.</p><a class="btn btn-dark" href="/termin">Neuen Termin wählen</a></div>`; return; }
  const b = r.data.booking, [lab, txt] = STATUS[b.status] || ['', ''];
  const open = b.status === 'angefragt' || b.status === 'bestaetigt';
  root.innerHTML = `<div class="tm-card"><span class="tm-badge tm-${b.status}">${lab}</span><h2>${esc(b.topic || 'Gespräch mit ImmoAdv')}</h2>
    <p class="tm-when">${ICON.cal}${esc(fFull(b.starts_at))}</p><p>${esc(txt)}</p>${b.note ? `<p class="tm-note">${esc(b.note)}</p>` : ''}
    ${b.teams_url ? `<a class="btn tm-teams" href="${esc(b.teams_url)}" target="_blank" rel="noopener">An Teams-Besprechung teilnehmen</a>` : ''}
    ${open ? `<details class="tm-cancel"><summary>Termin absagen</summary><form id="tmCancel"><label>Grund (optional)<textarea name="reason" rows="2" maxlength="500"></textarea></label><button class="btn btn-ghost" type="submit">Verbindlich absagen</button></form></details>` : `<a class="btn btn-dark" href="/termin">Neuen Termin wählen</a>`}
    <p class="tm-msg" role="status"></p></div>`;
  const f = $('#tmCancel', root);
  if (f) f.onsubmit = async (e) => {
    e.preventDefault(); const btn = f.querySelector('button'); btn.disabled = true; btn.textContent = 'Wird abgesagt …';
    const rr = await call('/api/termin', { action: 'cancel', token, reason: f.reason.value });
    if (rr.ok) manage(root, token); else { btn.disabled = false; btn.textContent = 'Verbindlich absagen'; $('.tm-msg', root).textContent = rr.data.error || 'Absage fehlgeschlagen.'; }
  };
}

async function book(root) {
  root.innerHTML = loading('Freie Termine werden geladen …');
  const r = await call('/api/termin');
  if (!r.ok || r.data.active === false) { root.innerHTML = `<div class="tm-card tm-center"><h2>Gerade keine Online-Buchung</h2><p>Schreiben Sie uns gern an <a href="mailto:support@immoadv.de?subject=Terminanfrage">support@immoadv.de</a> – wir melden uns mit Terminvorschlägen.</p></div>`; return; }
  const { slots = {}, topics = [], intro = '', durationMin = 30 } = r.data;
  const days = Object.keys(slots).sort();
  if (!days.length) { root.innerHTML = `<div class="tm-card tm-center"><h2>Aktuell alles ausgebucht</h2><p>In den nächsten Wochen ist kein Termin frei. Schreiben Sie uns an <a href="mailto:support@immoadv.de?subject=Terminanfrage">support@immoadv.de</a>.</p></div>`; return; }
  let day = days[0], pick = null; const t0 = Date.now();
  root.innerHTML = `<div class="tm-grid"><div class="tm-card"><div class="tm-step"><span>1</span>Termin wählen</div><p class="tm-intro">${esc(intro)}</p>
      <div class="tm-meta"><span>${durationMin} Minuten</span><span>Microsoft Teams</span><span>kostenlos</span></div>
      <div class="tm-days" role="tablist" aria-label="Tag wählen">${days.map((d) => `<button type="button" role="tab" data-d="${d}"><small>${fDay(d)}</small><strong>${fNum(d)}</strong><em>${slots[d].length} frei</em></button>`).join('')}</div>
      <h3 class="tm-dayh" id="tmDayH"></h3><div class="tm-slots" id="tmSlots"></div></div>
    <form class="tm-card tm-form" id="tmForm" novalidate><div class="tm-step"><span>2</span>Ihre Angaben</div>
      <p class="tm-chosen" id="tmChosen">Bitte zuerst links einen Termin wählen.</p>
      <label>Name *<input name="name" autocomplete="name" required maxlength="120"></label>
      <label>E-Mail *<input name="email" type="email" autocomplete="email" required maxlength="200"></label>
      <div class="tm-two"><label>Unternehmen<input name="company" autocomplete="organization" maxlength="160"></label><label>Telefon<input name="phone" type="tel" autocomplete="tel" maxlength="40"></label></div>
      ${topics.length ? `<label>Thema<select name="topic">${topics.map((t) => `<option>${esc(t)}</option>`).join('')}</select></label>` : ''}
      <label>Worum geht es? (optional)<textarea name="message" rows="3" maxlength="2000"></textarea></label>
      <label class="tm-hp" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label>
      <label class="tm-consent"><input type="checkbox" name="consent" required><span>Ich bin einverstanden, dass ImmoAdv meine Angaben zur Terminvereinbarung verarbeitet (<a href="/datenschutz" target="_blank">Datenschutz</a>).</span></label>
      <button class="btn btn-dark tm-submit" type="submit" disabled>Termin anfragen</button><p class="tm-msg" role="status"></p></form></div>`;
  const form = $('#tmForm', root), submit = $('.tm-submit', root);
  const drawDay = () => {
    root.querySelectorAll('[data-d]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.d === day)));
    $('#tmDayH', root).textContent = fLong(day);
    $('#tmSlots', root).innerHTML = slots[day].map((s) => `<button type="button" data-s="${s.start}" aria-pressed="${pick?.start === s.start}">${fTime(s.start)}</button>`).join('');
    root.querySelectorAll('[data-s]').forEach((b) => b.onclick = () => { pick = slots[day].find((s) => s.start === b.dataset.s); drawDay(); choose(); });
  };
  const choose = () => {
    $('#tmChosen', root).innerHTML = pick ? `${ICON.cal}<strong>${esc(fFull(pick.start))}</strong>` : 'Bitte zuerst links einen Termin wählen.';
    $('#tmChosen', root).classList.toggle('on', !!pick); submit.disabled = !pick;
    if (pick && matchMedia('(max-width: 860px)').matches) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  root.querySelectorAll('[data-d]').forEach((b) => b.onclick = () => { day = b.dataset.d; drawDay(); });
  drawDay();
  form.onsubmit = async (e) => {
    e.preventDefault();
    const msg = $('.tm-msg', form), v = Object.fromEntries(new FormData(form));
    if (!pick) { msg.textContent = 'Bitte wählen Sie einen Termin.'; return; }
    if (!form.checkValidity()) { form.reportValidity(); return; }
    submit.disabled = true; submit.classList.add('busy'); submit.textContent = 'Wird gesendet …'; msg.textContent = '';
    const rr = await call('/api/termin', { name: v.name, email: v.email, company: v.company || '', phone: v.phone || '', topic: v.topic || '', message: v.message || '', start: pick.start, consent: true, website: v.website || '', t0 });
    if (rr.ok) {
      root.innerHTML = `<div class="tm-card tm-center tm-done"><span class="tm-ok">${ICON.ok}</span><h2>Anfrage gesendet</h2><p class="tm-when">${ICON.cal}${esc(fFull(pick.start))}</p>
        <p>Danke, ${esc(String(v.name).split(' ')[0])}! Sie erhalten gleich eine Eingangsbestätigung an <strong>${esc(v.email)}</strong>. Sobald der Termin bestätigt ist, kommt der Microsoft-Teams-Link per E-Mail.</p>
        ${rr.data.token ? `<a class="btn btn-ghost" href="/termin?b=${encodeURIComponent(rr.data.token)}">Anfrage ansehen</a>` : ''}</div>`;
      root.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    submit.classList.remove('busy'); submit.textContent = 'Termin anfragen'; submit.disabled = false;
    msg.textContent = rr.data.error || 'Senden fehlgeschlagen. Bitte erneut versuchen.';
    if (rr.data.taken) { setTimeout(() => book(root), 1800); }
  };
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
