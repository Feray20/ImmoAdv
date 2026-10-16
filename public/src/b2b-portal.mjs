// Unternehmensportal (/b2b-portal): Registrierung mit § 14 BGB und AVV, Anfragen-Pipeline,
// Widget- und QR-Studio, Team, Profil mit Co-Branding, Tarif und Rechnungen.
import { api, download, dt, dtt, esc, eur, loginForm, logout, session, setSession } from './sess.mjs';

const root = document.getElementById('portal');
const $ = (s, el = document) => el.querySelector(s);
const VIEWS = [
  ['start', 'Übersicht'], ['wissen', 'Fachwissen'], ['verifizierung', 'Verifizierung'], ['anfragen', 'Anfragen'], ['kunden', 'Kunden'], ['einreichungen', 'Einreichungen'], ['werkzeuge', 'Widget & QR'], ['team', 'Team'], ['profil', 'Profil'], ['tarif', 'Tarif & Rechnungen'],
];
const TYPE = { BANK: 'Kreditinstitut', BROKER: 'Finanzierungsvermittler (§ 34i GewO)', REALTOR: 'Immobilienmakler (§ 34c GewO)', OTHER: 'Sonstiges Unternehmen' };
const TIER = { BASIC: 'Makler & Vermittler Basic', PRO: 'Kanzlei & Baufi Pro', ENTERPRISE: 'Bank & Filiale Enterprise' };
const STATUS = { neu: 'Neu', in_bearbeitung: 'In Bearbeitung', abgeschlossen: 'Abgeschlossen', abgelehnt: 'Abgelehnt' };
const LAENDER = ['baden-wuerttemberg', 'bayern', 'berlin', 'brandenburg', 'bremen', 'hamburg', 'hessen', 'mecklenburg-vorpommern', 'niedersachsen', 'nordrhein-westfalen', 'rheinland-pfalz', 'saarland', 'sachsen', 'sachsen-anhalt', 'schleswig-holstein', 'thueringen'];
const landName = (l) => l.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join('-').replace('Wuerttemberg', 'Württemberg').replace('Thueringen', 'Thüringen');

let me = null;
let prices = null;

const toast = (t, bad = false) => {
  let el = $('#ptToast');
  if (!el) { el = document.createElement('div'); el.id = 'ptToast'; el.className = 'pt-toast'; el.setAttribute('role', 'status'); document.body.append(el); }
  el.textContent = t; el.classList.toggle('bad', bad); el.classList.add('on');
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 3200);
};
const busy = async (btn, fn) => { const t = btn.textContent; btn.disabled = true; btn.textContent = '…'; try { await fn(); } catch (e) { toast(e.message || 'Fehler', true); } finally { btn.disabled = false; btn.textContent = t; } };

// ---------- Rahmen ----------
function shell() {
  const a = me.account;
  root.innerHTML = `<div class="pt">
    <aside class="pt-side"><a class="pt-brand" href="/"><img src="/logo-icon.svg" alt="" width="30" height="26"><span>Immo<span>Adv</span></span></a>
      <small class="pt-tag">Unternehmensportal</small>
      <nav>${VIEWS.filter(([v]) => me.role === 'owner' || !['tarif', 'profil'].includes(v)).map(([v, l]) => `<a href="#${v}" data-v="${v}">${l}${v === 'anfragen' && me.usage.leadsNew ? ` <b class="pt-dot">${me.usage.leadsNew}</b>` : ''}</a>`).join('')}</nav>
      <div class="pt-foot"><strong>${esc(a.companyName)}</strong><small>${esc(a.customerNumber)} · ${me.role === 'owner' ? 'Inhaber' : 'Berater'}</small><a href="/app/dashboard">Zur Anwendung</a><button type="button" class="pt-logout" id="ptLogout">Abmelden</button></div>
    </aside>
    <section class="pt-main"><header class="pt-top"><h1 id="ptTitle"></h1><button type="button" class="pt-logout pt-logout-m" id="ptLogoutM">Abmelden</button>${a.status === 'locked' ? '<span class="st bad">Gesperrt</span>' : me.tier ? `<span class="st ok">${TIER[me.tier]}</span>` : '<span class="st warn">Kein Tarif</span>'}</header>
      ${a.status === 'locked' ? `<div class="pt-alert bad"><strong>Konto gesperrt.</strong> ${esc(a.lockReason || '')} Rechnungen und AVV bleiben abrufbar. Fragen an support@immoadv.de.</div>` : ''}
      <div id="ptView"></div></section>
    <nav class="pt-tabs">${VIEWS.filter(([v]) => me.role === 'owner' || !['tarif', 'profil'].includes(v)).map(([v, l]) => `<a href="#${v}" data-v="${v}">${{ start: 'Start', wissen: 'Wissen', einreichungen: 'Postkorb', werkzeuge: 'Widget' }[v] || l.split(' ')[0]}</a>`).join('')}</nav>
  </div>`;
  root.querySelectorAll('#ptLogout,#ptLogoutM').forEach((b) => { b.onclick = logout; });
}

function route() {
  const v = (location.hash.slice(1).split('=')[0] || 'start');
  const view = VIEWS.find(([k]) => k === v) ? v : 'start';
  document.querySelectorAll('[data-v]').forEach((a) => a.classList.toggle('on', a.dataset.v === view));
  document.querySelector(`.pt-tabs [data-v="${view}"]`)?.scrollIntoView({ block: 'nearest', inline: 'center' });
  $('#ptTitle').textContent = VIEWS.find(([k]) => k === view)[1];
  const box = $('#ptView');
  box.innerHTML = '<p class="form-note">Wird geladen …</p>';
  ({ start: vStart, kunden: vKunden, wissen: (b) => import('./b2b-wissen.mjs').then((m) => m.renderWissen(b)).catch(() => { b.innerHTML = '<p class="form-note">Fachwissen konnte nicht geladen werden.</p>'; }), verifizierung: vVerify, anfragen: vLeads, einreichungen: vSubs, werkzeuge: vTools, team: vTeam, profil: vProfil, tarif: vTarif })[view](box);
}

// ---------- Kunden: einladen und Fortschritt sehen (nur mit Einwilligung des Kunden) ----------
const PH = ['Orientieren', 'Objekte prüfen', 'Bankgespräch', 'Bestand'];
let KD_LAST = null; // zuletzt erstellte Einladung (Link bleibt nach dem Neuladen sichtbar)
const kdLinkHtml = (x) => `<div class="pt-alert ok"><strong>${x.mailed ? 'Einladung per E-Mail gesendet.' : 'Einladung erstellt.'}</strong> ${x.mailed ? 'Zusätzlich können Sie den Link selbst weitergeben:' : 'Bitte den Link an Ihren Kunden senden (E-Mail-Versand ist noch nicht eingerichtet):'}<div class="pt-row kd-copy"><input readonly value="${esc(x.link)}" aria-label="Einladungslink"><button type="button" class="btn btn-outline" id="kdCopy">Kopieren</button></div><small>Gültig 14 Tage, nur einmal verwendbar.</small></div>`;
async function vKunden(box) {
  const r = await api('/api/b2b/clients');
  if (!r.ok) { box.innerHTML = `<p class="form-note">${esc(r.data?.error || 'Nicht verfügbar.')}</p>`; return; }
  const all = r.data.clients || [];
  const con = all.filter((c) => c.status === 'verbunden').sort((a, b) => (b.progress?.best ?? -1) - (a.progress?.best ?? -1));
  const inv = all.filter((c) => c.status === 'eingeladen');
  const ready = con.filter((c) => (c.progress?.best ?? 0) >= 90).length;
  const card = (c) => {
    const p = c.progress || {}, best = p.best ?? 0;
    return `<article class="kd-card"><div class="kd-top"><strong>${esc(c.name || c.email || 'Kunde')}</strong>${best >= 90 ? '<span class="st ok">bankreif</span>' : best >= 60 ? '<span class="st warn">fast</span>' : '<span class="st">in Vorbereitung</span>'}</div>
      ${c.name && c.email ? `<small class="kd-mail">${esc(c.email)}</small>` : ''}
      <div class="kd-bar" role="img" aria-label="Bankreife ${best} %"><span style="width:${Math.max(2, Math.min(100, best))}%"></span></div>
      <dl class="kd-dl"><div><dt>Bankreife</dt><dd>${p.best == null ? '–' : best + ' %'}</dd></div><div><dt>Stufe</dt><dd>${p.stage ? `${p.stage} · ${PH[p.stage - 1]}` : '–'}</dd></div><div><dt>Objekte</dt><dd>${p.objects ?? '–'}</dd></div><div><dt>Unterlagen</dt><dd>${p.docs ?? '–'}</dd></div><div><dt>Finanzprofil</dt><dd>${p.profile == null ? '–' : p.profile ? 'ausgefüllt' : 'offen'}</dd></div><div><dt>Zuletzt aktiv</dt><dd>${p.lastActive ? dt(p.lastActive) : '–'}</dd></div></dl>
      ${p.missing && p.missing.length ? `<div class="kd-miss"><strong>Fehlt noch:</strong> ${p.missing.map(esc).join(' · ')}</div>` : p.missing ? '<div class="kd-miss ok">Alle Unterlagen-Arten vorhanden.</div>' : ''}
      <div class="kd-btns"><button type="button" class="btn btn-dark" data-kd-req="${esc(c.id)}"${c.lastRequestAt && Date.now() - new Date(c.lastRequestAt).getTime() < 864e5 ? ' disabled title="Heute bereits erinnert"' : ''}>Unterlagen anfordern</button><button type="button" class="btn btn-outline" data-kd-pdf="${esc(c.id)}">Kurzbericht (PDF)</button></div>
      ${c.lastRequestAt ? `<small class="kd-last">Zuletzt erinnert: ${dtt(c.lastRequestAt)}</small>` : ''}
      <div class="kd-act"><small>verbunden seit ${c.since ? dt(c.since) : '–'}</small><button type="button" class="btn btn-ghost" data-kd-end="${esc(c.id)}">Trennen</button></div></article>`;
  };
  box.innerHTML = `<section class="pt-card"><h2>Kunde einladen</h2>
      <p class="form-note">Ihr Kunde bereitet Finanzprofil, Objekt und Unterlagen in ImmoAdv vor – kostenlos. Stimmt er zu, sehen Sie hier seinen Fortschritt: Stufe, Bankreife, Anzahl Objekte und Unterlagen. Dokumente und Inhalte sehen Sie nicht; der Kunde kann die Verbindung jederzeit trennen.</p>
      <form class="pt-row kd-form" id="kdF"><input id="kdMail" type="email" required placeholder="E-Mail des Kunden" aria-label="E-Mail des Kunden" autocomplete="off"><input id="kdName" type="text" placeholder="Name (optional)" aria-label="Name (optional)" maxlength="120"><button class="btn btn-dark" type="submit">Einladen</button></form>
      <div id="kdLink">${KD_LAST ? kdLinkHtml(KD_LAST) : ''}</div></section>
    <section class="pt-card"><div class="kd-head"><h2>Ihre Kunden</h2><span class="form-note">${con.length} verbunden · ${ready} bankreif · ${inv.length} Einladung${inv.length === 1 ? '' : 'en'} offen</span></div>
      ${con.length ? `<p class="form-note">Sortiert nach Bankreife – die abschlussreifen Fälle stehen oben.</p><div class="kd-list">${con.map(card).join('')}</div>` : '<p class="form-note">Noch keine verbundenen Kunden. Laden Sie Ihren ersten Kunden oben ein.</p>'}
      ${inv.length ? `<h3 class="kd-sub">Offene Einladungen</h3><ul class="kd-inv">${inv.map((c) => `<li><span><strong>${esc(c.name || c.email)}</strong><small>${c.name ? esc(c.email) + ' · ' : ''}gültig bis ${dt(c.expiresAt)}</small></span><button type="button" class="btn btn-ghost" data-kd-end="${esc(c.id)}">Zurückziehen</button></li>`).join('')}</ul>` : ''}</section>`;
  $('#kdF').onsubmit = (e) => { e.preventDefault(); const b = e.target.querySelector('button'); busy(b, async () => {
    const x = await api('/api/b2b/clients', { method: 'POST', body: JSON.stringify({ email: $('#kdMail').value.trim(), name: $('#kdName').value.trim() || undefined }) });
    if (!x.ok) throw Error(x.data?.error || 'Einladung fehlgeschlagen.');
    KD_LAST = x.data;
    await vKunden(box);
  }); };
  $('#kdCopy')?.addEventListener('click', async () => { try { await navigator.clipboard.writeText(KD_LAST.link); toast('Link kopiert.'); } catch { toast('Bitte den Link markieren und kopieren.', true); } });
  box.querySelectorAll('[data-kd-req]').forEach((b) => b.onclick = () => {
    const note = prompt('Optional: kurze Nachricht an Ihren Kunden (z. B. „Bitte bis Freitag“). Leer lassen für die Standard-Erinnerung.');
    if (note === null) return;
    busy(b, async () => {
      const x = await api('/api/b2b/clients/request', { method: 'POST', body: JSON.stringify({ id: b.dataset.kdReq, note: note.trim() || undefined }) });
      if (!x.ok) throw Error(x.data?.error || 'Erinnerung fehlgeschlagen.');
      toast(x.data.mailed ? 'Erinnerung per E-Mail gesendet und in der App angezeigt.' : 'Erinnerung wird dem Kunden in der App angezeigt (E-Mail-Versand noch nicht eingerichtet).');
      vKunden(box);
    });
  });
  box.querySelectorAll('[data-kd-pdf]').forEach((b) => b.onclick = () => busy(b, async () => { await download('/api/b2b/clients/report?id=' + encodeURIComponent(b.dataset.kdPdf), {}, 'ImmoAdv-Kurzbericht.pdf'); }));
  box.querySelectorAll('[data-kd-end]').forEach((b) => b.onclick = () => {
    if (!confirm(b.textContent === 'Trennen' ? 'Verbindung zu diesem Kunden trennen? Sie sehen seinen Fortschritt danach nicht mehr.' : 'Einladung zurückziehen? Der Link wird ungültig.')) return;
    busy(b, async () => { const x = await api('/api/b2b/clients', { method: 'DELETE', body: JSON.stringify({ id: b.dataset.kdEnd }) }); if (!x.ok) throw Error(x.data?.error || 'Fehlgeschlagen.'); toast('Erledigt.'); vKunden(box); });
  });
}

// ---------- Übersicht ----------
async function startStats(el) {
  const r = await api('/api/b2b/leads');
  if (!r.ok) return;
  const since = Date.now() - 30 * 864e5;
  const l = r.data.leads.filter((x) => new Date(x.created_at).getTime() >= since);
  const by = (k) => l.filter((x) => x.source === k).length;
  const done = l.filter((x) => x.status === 'abgeschlossen').length;
  el.innerHTML = `<h2>Letzte 30 Tage</h2><dl class="pt-dl"><div><dt>Anfragen gesamt</dt><dd>${l.length}</dd></div><div><dt>Website-Widget</dt><dd>${by('widget')}</dd></div><div><dt>Partnerseite</dt><dd>${by('landing')}</dd></div><div><dt>QR-Code</dt><dd>${by('qr')}</dd></div><div><dt>Abgeschlossen</dt><dd>${done}${l.length ? ` (${Math.round((done / l.length) * 100)} %)` : ''}</dd></div><div><dt>Ohne Zuständigen</dt><dd>${l.filter((x) => !x.assigned_to).length}</dd></div></dl>`;
}

function vStart(box) {
  const a = me.account, u = me.usage, lim = me.limits;
  const quota = lim ? (lim.dossiersPerMonth == null ? 'unbegrenzt' : `${u.dossiersThisMonth} von ${lim.dossiersPerMonth + (a.dossierBonus || 0)}`) : '–';
  const steps = [
    [Boolean(a.avvAcceptedAt), 'AVV abgeschlossen', '#profil'],
    [Boolean(me.tier), 'Tarif gebucht', '#tarif'],
    [Boolean(a.hasLogo || a.brandColor), 'Logo oder Farbe hinterlegt', '#profil'],
    [Boolean(a.bookingUrl), 'Terminlink eingetragen', '#profil'],
    [u.leadsNew > 0 || false, 'Widget oder QR-Code im Einsatz', '#werkzeuge'],
  ];
  box.innerHTML = `${a.verified ? '' : `<div class="pt-alert warn"><strong>Ihr Konto ist noch nicht freigeschaltet.</strong> Bitte laden Sie Ihre Gewerbeanmeldung oder einen Handelsregisterauszug hoch und reichen Sie ihn ein. Nach unserer Prüfung schalten wir Partnerseite, Widget, Anfragen, Kreditmappen und Tarife frei. <a class="btn btn-dark" href="#verifizierung">Zur Verifizierung</a></div>`}
    <div class="pt-kpis">
      <div class="pt-kpi"><small>Neue Anfragen</small><strong>${u.leadsNew}</strong><a href="#anfragen">Ansehen</a></div>
      <div class="pt-kpi"><small>Kreditmappen diesen Monat</small><strong>${quota}</strong><a href="/app/dashboard#objekte">Erstellen</a></div>
      <div class="pt-kpi"><small>Berater-Zugänge</small><strong>${u.seats} / ${lim ? lim.seats : 1}</strong><a href="#team">Team</a></div>
      <div class="pt-kpi"><small>Status</small><strong>${a.verified ? 'Geprüft' : 'Ungeprüft'}</strong><span class="form-note">${a.verified ? 'Angaben vom Betreiber geprüft' : 'Prüfung durch den Betreiber steht aus'}</span></div>
    </div>
    <div class="pt-grid2">
      <section class="pt-card"><h2>Einrichtung</h2><ul class="pt-check">${steps.map(([ok, t, h]) => `<li class="${ok ? 'done' : ''}"><a href="${h}">${t}</a></li>`).join('')}</ul></section>
      <section class="pt-card"><h2>So arbeiten Sie mit ImmoAdv</h2><ol class="pt-ol">
        <li><strong>Fall anlegen:</strong> In der <a href="/app/dashboard#objekte">Anwendung</a> Objekt und Finanzierung erfassen, Unterlagen hochladen.</li>
        <li><strong>Kreditmappe erstellen:</strong> Kennzahlen nach banküblichen Kriterien (Kapitaldienstfähigkeit, Beleihungsauslauf, Cashflow) mit Echtheits-QR${me.limits?.cobranding ? ' und Ihrem Logo' : ''}.</li>
        <li><strong>Anfragen gewinnen:</strong> Widget auf Ihrer Website, QR-Code im Exposé oder Ihre <a href="#werkzeuge">Partnerseite</a>.</li></ol>
        <p class="form-note">Rechnerische Orientierungswerte nach einem strukturierten Datenmodell. Keine Kreditzusage und keine Bonitätsentscheidung; die Entscheidung trifft das finanzierende Institut.</p></section>
    </div><section class="pt-card" id="stats30"></section>`;
  startStats($('#stats30'));
}

// ---------- Verifizierung (Gewerbenachweis) ----------
const VKIND = { gewerbe: 'Gewerbeanmeldung', handelsregister: 'Handelsregisterauszug', erlaubnis: 'Erlaubnis § 34c / § 34i GewO', sonstiges: 'Sonstiger Nachweis' };
async function vVerify(box) {
  const r = await api('/api/b2b/verification');
  if (!r.ok) { box.innerHTML = `<p class="form-note">${esc(r.data?.error)}</p>`; return; }
  const v = r.data, locked = v.verified || v.status === 'eingereicht', owner = v.isOwner;
  const stat = { offen: ['warn', 'Noch nicht eingereicht'], eingereicht: ['warn', 'Eingereicht – wird geprüft'], geprueft: ['ok', 'Geprüft und freigeschaltet'], abgelehnt: ['bad', 'Bitte Unterlagen ergänzen'] }[v.status] || ['warn', v.status];
  box.innerHTML = `<section class="pt-card"><h2>Unternehmen verifizieren</h2>
    <p>Status: <span class="st ${stat[0]}">${stat[1]}</span>${v.submittedAt ? ` <small class="form-note">eingereicht ${dtt(v.submittedAt)}</small>` : ''}</p>
    ${v.note ? `<div class="pt-alert bad"><strong>Hinweis aus der Prüfung:</strong> ${esc(v.note)}</div>` : ''}
    ${v.verified ? '<p>Ihr Konto ist freigeschaltet. Vielen Dank!</p>' : `<p class="form-note">Wir schalten ausschließlich Unternehmen frei (§ 14 BGB). Benötigt: <strong>Gewerbeanmeldung oder Handelsregisterauszug</strong> (nicht älter als 12 Monate). Für Makler und Finanzierungsvermittler zusätzlich hilfreich: Erlaubnis nach § 34c bzw. § 34i GewO. Bitte keine Ausweiskopien hochladen. Die Nachweise werden nur für die Prüfung verwendet, vertraulich gespeichert und 90 Tage nach der Entscheidung gelöscht.</p>`}
    <h3>Hochgeladene Nachweise</h3>
    ${v.docs.length ? `<ul class="pt-check">${v.docs.map((d) => `<li class="done"><span>${esc(d.label)}: ${esc(d.file_name)} <small class="form-note">(${Math.max(1, Math.round(d.byte_size / 1024))} KB · ${dtt(d.created_at)})</small></span>${!locked && owner ? ` <button class="text-btn del" type="button" data-vdel="${d.id}">Entfernen</button>` : ''}</li>`).join('')}</ul>` : '<p class="form-note">Noch keine Nachweise.</p>'}
    ${!locked && owner ? `<div class="pt-up"><label>Art des Nachweises<select id="vKind">${Object.entries(VKIND).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label>
      <label>Datei (PDF, JPG oder PNG, max. 10 MB)<input id="vFile" type="file" accept="application/pdf,image/jpeg,image/png"></label>
      <button class="btn btn-outline" id="vUp" type="button">Hochladen</button></div>
      <p><button class="btn btn-dark" id="vSubmit" type="button"${v.docs.some((d) => d.kind === 'gewerbe' || d.kind === 'handelsregister') ? '' : ' disabled'}>Zur Prüfung einreichen</button></p>
      <p class="form-note">Nach dem Einreichen prüfen wir in der Regel innerhalb von 1–2 Werktagen und informieren Sie per E-Mail.</p>` : ''}
    ${!owner && !v.verified ? '<p class="form-note">Die Verifizierung kann nur der Kontoinhaber einreichen.</p>' : ''}</section>`;
  $('#vUp') && ($('#vUp').onclick = (e) => busy(e.target, async () => {
    const f = $('#vFile').files[0];
    if (!f) throw new Error('Bitte eine Datei auswählen.');
    if (f.size > 10 * 1024 * 1024) throw new Error('Die Datei ist größer als 10 MB.');
    const q = new URLSearchParams({ kind: $('#vKind').value, name: f.name.slice(0, 120) });
    const x = await api('/api/b2b/verification?' + q, { method: 'POST', body: f, headers: { 'content-type': f.type || 'application/octet-stream' } });
    if (!x.ok) throw new Error(x.data?.error || 'Hochladen fehlgeschlagen.');
    toast('Nachweis hochgeladen.'); vVerify(box);
  }));
  box.querySelectorAll('[data-vdel]').forEach((b) => b.onclick = () => busy(b, async () => {
    const x = await api('/api/b2b/verification?id=' + b.dataset.vdel, { method: 'DELETE' });
    if (!x.ok) throw new Error(x.data?.error || 'Entfernen fehlgeschlagen.');
    vVerify(box);
  }));
  $('#vSubmit') && ($('#vSubmit').onclick = (e) => busy(e.target, async () => {
    const x = await api('/api/b2b/verification', { method: 'PUT' });
    if (!x.ok) throw new Error(x.data?.error || 'Einreichen fehlgeschlagen.');
    toast('Eingereicht. Wir melden uns per E-Mail.'); vVerify(box);
  }));
}

// ---------- Anfragen ----------
async function vLeads(box) {
  const [r, t] = await Promise.all([api('/api/b2b/leads'), api('/api/b2b/team')]);
  if (!r.ok) { box.innerHTML = `<p class="form-note">${esc(r.data?.error)}</p>`; return; }
  const leads = r.data.leads;
  const members = t.ok ? t.data.members : [];
  const self = members.find((m) => m.self)?.user_id;
  const who = (id) => members.find((m) => m.user_id === id)?.email || '';
  const assignSel = (l) => members.length > 1 || me.role === 'owner'
    ? `<label class="form-note">Zuständig <select data-as="${l.id}"><option value="">– niemand –</option>${members.filter((m) => me.role === 'owner' || m.self || m.user_id === l.assigned_to).map((m) => `<option value="${m.user_id}"${m.user_id === l.assigned_to ? ' selected' : ''}>${esc(m.email)}${m.self ? ' (Sie)' : ''}</option>`).join('')}</select></label>` : '';
  const n = (v) => (v == null || v === '' ? '–' : Number(v).toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' €');
  box.innerHTML = `<div class="pt-bar"><div class="seg" role="tablist">${['alle', ...Object.keys(STATUS)].map((s, i) => `<button type="button" data-f="${s}" aria-selected="${i === 0}">${s === 'alle' ? 'Alle' : STATUS[s]}</button>`).join('')}<button type="button" data-f="mine" aria-selected="false">Mir zugewiesen</button></div>
    <button class="btn btn-ghost" id="csv" type="button">CSV exportieren</button></div>
    ${leads.length ? '' : '<div class="pt-empty"><strong>Noch keine Anfragen.</strong><p>Binden Sie das <a href="#werkzeuge">Widget</a> ein oder teilen Sie Ihre Partnerseite. Jede Anfrage erscheint hier mit Objektdaten und Kennzahlen.</p></div>'}
    <div class="pt-leads">${leads.map((l) => {
      const p = l.property_data || {}, m = l.metrics || {};
      return `<article class="pt-lead" data-s="${l.status}" data-a="${l.assigned_to || ''}" data-id="${l.id}">
        <header><div><strong>${esc(l.client_name)}</strong><small>${dtt(l.created_at)} · ${{ widget: 'Website-Widget', landing: 'Partnerseite', qr: 'QR-Code' }[l.source]}</small></div>
        <select data-id="${l.id}" aria-label="Status">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}"${k === l.status ? ' selected' : ''}>${v}</option>`).join('')}</select></header>
        <p><a href="mailto:${esc(l.client_email)}">${esc(l.client_email)}</a>${l.client_phone ? ` · <a href="tel:${esc(l.client_phone)}">${esc(l.client_phone)}</a>` : ''}</p>
        <dl class="pt-dl"><div><dt>Objekt</dt><dd>${esc(p.address || p.ref || '–')}</dd></div><div><dt>Kaufpreis</dt><dd>${n(p.price)}</dd></div><div><dt>Kaltmiete</dt><dd>${n(p.rent)}</dd></div><div><dt>Eigenkapital</dt><dd>${n(p.equity)}</dd></div>
        ${m.allIn ? `<div><dt>Gesamtkosten</dt><dd>${n(m.allIn)}</dd></div><div><dt>Darlehen</dt><dd>${n(m.loan)}</dd></div><div><dt>Rate</dt><dd>${n(m.rate)}</dd></div><div><dt>DSCR</dt><dd>${m.dscr ?? '–'}</dd></div>` : ''}</dl>
        ${l.message ? `<p class="pt-msg">${esc(l.message)}</p>` : ''}
        <label class="pt-field">Interne Notiz (nur Ihr Team)<textarea data-nt="${l.id}" rows="2" maxlength="4000">${esc(l.notes || '')}</textarea></label>
        ${assignSel(l)}${l.assigned_to && !assignSel(l) ? `<p class="form-note">Zuständig: ${esc(who(l.assigned_to))}</p>` : ''}
        <details><summary>Einwilligung</summary><p class="form-note">${dtt(l.consent_at)}: ${esc(l.consent_text)}</p></details>
        ${me.role === 'owner' ? `<button class="text-btn del" data-del="${l.id}" type="button">Löschen</button>` : ''}
      </article>`;
    }).join('')}</div>`;
  box.querySelectorAll('[data-f]').forEach((b) => b.onclick = () => {
    box.querySelectorAll('[data-f]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    box.querySelectorAll('.pt-lead').forEach((el) => { el.hidden = b.dataset.f === 'mine' ? el.dataset.a !== self : b.dataset.f !== 'alle' && el.dataset.s !== b.dataset.f; });
  });
  box.querySelectorAll('textarea[data-nt]').forEach((ta) => ta.onchange = async () => {
    const x = await api('/api/b2b/leads', { method: 'PATCH', body: JSON.stringify({ id: ta.dataset.nt, notes: ta.value }) });
    toast(x.ok ? 'Notiz gespeichert.' : x.data?.error || 'Fehler', !x.ok);
  });
  box.querySelectorAll('select[data-as]').forEach((s2) => s2.onchange = async () => {
    const x = await api('/api/b2b/leads', { method: 'PATCH', body: JSON.stringify({ id: s2.dataset.as, assignedTo: s2.value || null }) });
    if (x.ok) { s2.closest('.pt-lead').dataset.a = s2.value; toast('Zuständigkeit gespeichert.'); } else toast(x.data?.error || 'Fehler', true);
  });
  box.querySelectorAll('select[data-id]').forEach((s) => s.onchange = async () => {
    const x = await api('/api/b2b/leads', { method: 'PATCH', body: JSON.stringify({ id: s.dataset.id, status: s.value }) });
    if (x.ok) { s.closest('.pt-lead').dataset.s = s.value; toast('Status gespeichert.'); } else toast(x.data?.error || 'Fehler', true);
  });
  box.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => {
    if (!confirm('Anfrage endgültig löschen?')) return;
    const x = await api('/api/b2b/leads?id=' + b.dataset.del, { method: 'DELETE' });
    if (x.ok) b.closest('.pt-lead').remove(); else toast(x.data?.error || 'Fehler', true);
  });
  $('#csv').onclick = (e) => busy(e.target, () => download('/api/b2b/leads?format=csv', {}, 'ImmoAdv_Anfragen.csv'));
}

// ---------- Einreichungen (Vorprüfungs-Postkorb) ----------
const SUB = { eingegangen: 'Eingegangen', in_pruefung: 'In Prüfung', rueckfrage: 'Rückfrage', abgeschlossen: 'Abgeschlossen', abgelehnt: 'Abgelehnt' };
async function vSubs(box) {
  const [r, t, v] = await Promise.all([api('/api/b2b/submissions'), api('/api/b2b/submissions?view=targets'), api('/api/b2b/submissions?view=versions')]);
  if (!r.ok) { box.innerHTML = `<p class="form-note">${esc(r.data?.error)}</p>`; return; }
  const { inbox, outbox, acceptsSubmissions } = r.data;
  const targets = t.ok ? t.data.targets : [], versions = v.ok ? v.data.versions : [];
  const isBank = me.account.institutionType === 'BANK';
  box.innerHTML = `
    ${isBank ? `<section class="pt-card"><h2>Postkorb (Eingang)</h2>
      ${acceptsSubmissions ? '' : '<p class="form-note">Ihr Institut nimmt noch keine Einreichungen an. Einschalten unter <a href="#profil">Profil</a>.</p>'}
      ${inbox.length ? inbox.map((s) => `<article class="pt-lead"><header><div><strong>${esc(s.object_label)}</strong><small>${esc(s.from)} · ${dtt(s.created_at)}</small></div>
        <select data-ss="${s.id}" aria-label="Status">${Object.entries(SUB).map(([k, l]) => `<option value="${k}"${k === s.status ? ' selected' : ''}>${l}</option>`).join('')}</select></header>
        ${s.note ? `<p class="pt-msg">${esc(s.note)}</p>` : ''}
        <p class="pt-row"><button class="btn btn-dark" data-dl="${s.id}" type="button"${s.version_id ? '' : ' disabled'}>Kreditmappe öffnen</button>${s.sha256 ? `<a class="text-btn" href="/verify/${esc(s.version_id)}" target="_blank" rel="noopener">Echtheit prüfen</a>` : ''}</p>
        <label class="pt-field">Antwort an den Einreicher<textarea data-rp="${s.id}" rows="2" maxlength="1000">${esc(s.reply || '')}</textarea></label>
        <button class="btn btn-ghost" data-sv="${s.id}" type="button">Status und Antwort senden</button></article>`).join('') : '<div class="pt-empty">Noch keine Einreichungen.</div>'}</section>` : ''}
    <section class="pt-card"><h2>Kreditmappe bei einem Institut einreichen</h2>
      ${!me.tier ? '<p class="form-note">Einreichungen gibt es ab einem gebuchten Tarif.</p>' : !targets.length ? '<p class="form-note">Derzeit nimmt noch kein Institut über ImmoAdv Einreichungen an.</p>' : !versions.length ? '<p class="form-note">Sie haben noch keine registrierte Kreditmappe. Erstellen Sie eine in der <a href="/app/dashboard#objekte">Anwendung</a>.</p>' : `
      <form id="subF" class="obj-grid">
        <label>Kreditmappe<select name="versionId" required>${versions.map((x) => `<option value="${x.id}">${esc(x.object_ref)} · Version ${x.version_no} · ${dt(x.created_at)}</option>`).join('')}</select></label>
        <label>Institut<select name="targetId" required>${targets.map((x) => `<option value="${x.id}">${esc(x.name)} · ${esc(x.city)}${x.verified ? ' ✓' : ''}</option>`).join('')}</select></label>
        <label>Bezeichnung (optional)<input name="label" maxlength="160" placeholder="z. B. ETW Darmstadt, Familie M."></label>
        <label>Hinweis an das Institut<input name="note" maxlength="1000"></label>
      </form>
      <label class="consent"><input type="checkbox" id="subC"> Die Einwilligung meines Kunden zur Weitergabe dieser Kreditmappe an das gewählte Institut liegt mir vor.</label>
      <button class="btn btn-dark" id="subGo" type="button">Einreichen</button>`}
      <p class="form-note">Das Institut erhält die registrierte Kreditmappe (mit Echtheits-QR) und kann Status und Rückfragen setzen. Die Kreditentscheidung trifft allein das Institut.</p></section>
    <section class="pt-card"><h2>Ihre Einreichungen</h2>${outbox.length ? `<table class="bill-table"><thead><tr><th>Objekt</th><th>Institut</th><th>Datum</th><th>Status</th><th>Antwort</th></tr></thead><tbody>${outbox.map((s) => `<tr><td>${esc(s.object_label)}</td><td>${esc(s.to)}</td><td>${dt(s.created_at)}</td><td>${SUB[s.status]}</td><td>${esc(s.reply || '–')}</td></tr>`).join('')}</tbody></table>` : '<p class="form-note">Noch keine.</p>'}</section>`;
  box.querySelectorAll('[data-dl]').forEach((b) => b.onclick = () => busy(b, () => download('/api/b2b/submissions?id=' + b.dataset.dl, {}, 'Kreditmappe.pdf')));
  box.querySelectorAll('[data-sv]').forEach((b) => b.onclick = () => busy(b, async () => {
    const id = b.dataset.sv;
    const x = await api('/api/b2b/submissions', { method: 'PATCH', body: JSON.stringify({ id, status: box.querySelector(`[data-ss="${id}"]`).value, reply: box.querySelector(`[data-rp="${id}"]`).value }) });
    if (!x.ok) throw Error(x.data?.error); toast('Gespeichert, Einreicher wird benachrichtigt.');
  }));
  if ($('#subGo')) $('#subGo').onclick = (e) => busy(e.target, async () => {
    if (!$('#subC').checked) throw Error('Bitte die Einwilligung des Kunden bestätigen.');
    const f = Object.fromEntries(new FormData($('#subF')));
    const x = await api('/api/b2b/submissions', { method: 'POST', body: JSON.stringify({ ...f, consent: true }) });
    if (!x.ok) throw Error(x.data?.error); toast('Eingereicht.'); vSubs(box);
  });
}

// ---------- Widget & QR ----------
function vTools(box) {
  const a = me.account;
  const page = a.slug ? `${location.origin}/p/${a.slug}` : '';
  if (!me.tier) {
    box.innerHTML = `<div class="pt-empty"><strong>Widget, QR-Codes und Partnerseite gibt es ab dem Tarif Basic.</strong><p><a href="#tarif">Tarif wählen</a></p></div>`;
    return;
  }
  const snippet = `<script src="${location.origin}/widget.js" data-immoadv="${esc(a.slug)}" async></script>`;
  box.innerHTML = `
    <section class="pt-card"><h2>Ihre Partnerseite</h2>
      <p><a class="ck-link" href="${page}" target="_blank" rel="noopener">${esc(page)}</a></p>
      <p class="form-note">Finanzierungsrechner mit Anfrageformular. Anfragen gehen ausschließlich an Sie.${me.limits.landing ? '' : ' Beraterprofil und Terminlink erscheinen ab Tarif Pro.'}</p></section>
    <section class="pt-card"><h2>Website-Widget</h2>
      <p>Diesen Code dort einfügen, wo der Rechner erscheinen soll:</p>
      <pre class="pt-code" id="snip">${esc(snippet)}</pre>
      <div class="pt-row"><button class="btn btn-dark" id="copy" type="button">Code kopieren</button>
      <label class="pt-switch"><input type="checkbox" id="wAct"${a.widgetActive ? ' checked' : ''}${me.role !== 'owner' ? ' disabled' : ''}> Widget aktiv</label></div>
      <label class="pt-field">Erlaubte Websites (eine Domain je Zeile, leer = überall)<textarea id="wDom" rows="3"${me.role !== 'owner' ? ' disabled' : ''}>${esc((a.allowedDomains || []).join('\n'))}</textarea></label>
      ${me.role === 'owner' ? '<button class="btn btn-ghost" id="wSave" type="button">Speichern</button>' : ''}
      <p class="form-note">Datenschutz: Nehmen Sie ImmoAdv als Auftragsverarbeiter in Ihre Datenschutzerklärung auf. Jede Anfrage enthält eine Einwilligung mit Ihrem Firmennamen als Empfänger (Zeitpunkt und Wortlaut werden gespeichert).</p></section>
    <section class="pt-card"><h2>Exposé- und Schaufenster-QR</h2>
      <p class="form-note">Der Code öffnet Ihre Partnerseite mit vorbefüllten Objektdaten. Interessenten rechnen die Finanzierung durch und senden Ihnen eine Anfrage.</p>
      <div class="obj-grid">
        <label>Objekt-ID / Bezeichnung<input id="qRef" maxlength="60" placeholder="z. B. ETW Reinheim 3 Zi."></label>
        <label>Kaufpreis (€)<input id="qPreis" inputmode="numeric"></label>
        <label>Kaltmiete (€/Monat)<input id="qMiete" inputmode="numeric"></label>
        <label>Wohnfläche (m²)<input id="qFl" inputmode="numeric"></label>
        <label>Bundesland<select id="qLand"><option value="">–</option>${LAENDER.map((l) => `<option value="${l}">${landName(l)}</option>`).join('')}</select></label>
      </div>
      <div class="pt-qr"><img id="qImg" alt="QR-Code-Vorschau" width="160" height="160"><div><p id="qUrl" class="form-note"></p>
        <div class="pt-row"><button class="btn btn-dark" data-q="pdf" type="button">PDF (A6)</button><button class="btn btn-ghost" data-q="svg" type="button">SVG</button><button class="btn btn-ghost" data-q="png" type="button">PNG</button></div></div></div>
    </section>`;
  $('#copy').onclick = async () => { try { await navigator.clipboard.writeText(snippet); toast('Code kopiert.'); } catch { toast('Bitte manuell kopieren.', true); } };
  if ($('#wSave')) $('#wSave').onclick = (e) => busy(e.target, async () => {
    const domains = $('#wDom').value.split(/\s+/).map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')).filter(Boolean);
    const r = await api('/api/b2b/account', { method: 'PATCH', body: JSON.stringify({ allowedDomains: domains, widgetActive: $('#wAct').checked }) });
    if (!r.ok) throw Error(r.data?.error);
    me.account = { ...me.account, ...r.data.account }; toast('Gespeichert.');
  });
  const qs = () => new URLSearchParams({ ref: $('#qRef').value, preis: $('#qPreis').value.replace(/\D/g, ''), miete: $('#qMiete').value.replace(/\D/g, ''), flaeche: $('#qFl').value.replace(/\D/g, ''), land: $('#qLand').value });
  let pv;
  const preview = async () => {
    const r = await api('/api/b2b/qr?format=json&' + qs());
    if (r.ok) $('#qUrl').textContent = r.data.url;
    const img = await api('/api/b2b/qr?format=png&' + qs());
    if (img.ok) { if (pv) URL.revokeObjectURL(pv); pv = URL.createObjectURL(await img.res.blob()); $('#qImg').src = pv; }
  };
  let t; box.querySelectorAll('.obj-grid input, .obj-grid select').forEach((i) => i.addEventListener('input', () => { clearTimeout(t); t = setTimeout(preview, 400); }));
  preview();
  box.querySelectorAll('[data-q]').forEach((b) => b.onclick = () => busy(b, () => download(`/api/b2b/qr?format=${b.dataset.q}&` + qs(), {}, 'QR')));
}

// ---------- Team ----------
async function vTeam(box) {
  const r = await api('/api/b2b/team');
  if (!r.ok) { box.innerHTML = `<p class="form-note">${esc(r.data?.error)}</p>`; return; }
  const { members, invites, seats } = r.data;
  box.innerHTML = `<section class="pt-card"><h2>Berater-Zugänge (${members.length + invites.length} von ${seats})</h2>
    <table class="bill-table"><thead><tr><th>E-Mail</th><th>Rolle</th><th>Seit</th><th></th></tr></thead><tbody>
    ${members.map((m) => `<tr><td>${esc(m.email)}${m.self ? ' (Sie)' : ''}</td><td>${m.role === 'owner' ? 'Inhaber' : 'Berater'}</td><td>${dt(m.created_at)}</td><td>${me.role === 'owner' && m.role !== 'owner' ? `<button class="text-btn del" data-m="${m.user_id}" type="button">Entfernen</button>` : ''}</td></tr>`).join('')}
    ${invites.map((i) => `<tr><td>${esc(i.email)}</td><td>Eingeladen</td><td>bis ${dt(i.expires_at)}</td><td><button class="text-btn del" data-i="${i.id}" type="button">Zurückziehen</button></td></tr>`).join('')}
    </tbody></table>
    ${me.role === 'owner' ? `<form id="inv" class="pt-row" style="margin-top:14px"><input type="email" required placeholder="kollegin@kanzlei.de" id="invMail" aria-label="E-Mail"><button class="btn btn-dark" type="submit">Einladen</button></form><div id="invOut"></div>` : ''}
    <p class="form-note">Berater melden sich mit der eingeladenen E-Mail-Adresse an. Sie sehen die Anfragen und erstellen Kreditmappen im Kontingent des Unternehmens; Tarif, Profil und Rechnungen verwaltet nur der Inhaber.</p></section>`;
  box.querySelectorAll('[data-m],[data-i]').forEach((b) => b.onclick = async () => {
    if (!confirm('Wirklich?')) return;
    const x = await api('/api/b2b/team?' + (b.dataset.m ? 'member=' + b.dataset.m : 'invite=' + b.dataset.i), { method: 'DELETE' });
    if (x.ok) route(); else toast(x.data?.error || 'Fehler', true);
  });
  if ($('#inv')) $('#inv').onsubmit = async (e) => {
    e.preventDefault();
    const x = await api('/api/b2b/team', { method: 'POST', body: JSON.stringify({ email: $('#invMail').value }) });
    if (!x.ok) return toast(x.data?.error || 'Fehler', true);
    $('#invOut').innerHTML = `<div class="pt-alert">${x.data.mailed ? 'Einladung per E-Mail versendet.' : 'E-Mail-Versand ist nicht eingerichtet. Bitte diesen Link selbst weitergeben:'}<pre class="pt-code">${esc(x.data.link)}</pre></div>`;
    setTimeout(() => vTeam(box).then(() => { $('#invOut') && ($('#invOut').innerHTML = `<div class="pt-alert"><pre class="pt-code">${esc(x.data.link)}</pre></div>`); }), 10);
  };
}

// ---------- Profil ----------
function vProfil(box) {
  const a = me.account;
  const brand = me.limits?.cobranding || a.hasWhitelabel;
  box.innerHTML = `<form class="pt-card" id="prof"><h2>Stammdaten</h2>
      <dl class="pt-dl"><div><dt>Unternehmen</dt><dd>${esc(a.companyName)} (${esc(a.legalForm)})</dd></div><div><dt>Art</dt><dd>${TYPE[a.institutionType]}</dd></div>
      <div><dt>Registernummer</dt><dd>${esc(a.registerNumber || '–')}</dd></div><div><dt>Steuernummer / USt-IdNr.</dt><dd>${esc(a.taxId || '–')}</dd></div><div><dt>Kundennummer</dt><dd>${esc(a.customerNumber)}</dd></div></dl>
      <p class="form-note">Firmenname, Rechtsform und Steuerdaten ändert der Support (Nachweis erforderlich).</p>
      <div class="obj-grid">
        <label>Ansprechpartner<input name="advisorName" value="${esc(a.advisorName)}" required></label>
        <label>Telefon<input name="phone" value="${esc(a.phone || '')}"></label>
        <label>Straße und Nr.<input name="street" value="${esc(a.street || '')}"></label>
        <label>PLZ<input name="postalCode" value="${esc(a.postalCode)}" pattern="[0-9]{5}"></label>
        <label>Ort<input name="city" value="${esc(a.city)}"></label>
        <label>Terminlink (https://…)<input name="bookingUrl" value="${esc(a.bookingUrl || '')}" placeholder="https://calendly.com/…"></label>
        <label>Adresse der Partnerseite<input name="slug" value="${esc(a.slug || '')}" pattern="[a-z0-9\\-]{3,40}"></label>
      </div>
      <button class="btn btn-dark" type="submit">Speichern</button></form>
    <section class="pt-card"><h2>Co-Branding</h2>
      ${brand ? `<p class="form-note">Ihr Logo erscheint im Kopf jeder Kreditmappe und auf Partnerseite und Widget. ImmoAdv bleibt dezent als „Strukturiert mit ImmoAdv-Software“ mit Prüf-QR sichtbar.</p>
      <div class="pt-row"><div class="pt-logo">${a.hasLogo && a.slug ? `<img src="/api/b2b/logo?slug=${esc(a.slug)}&t=${Date.now()}" alt="Ihr Logo">` : '<span class="form-note">Kein Logo</span>'}</div>
      <label class="btn btn-ghost">Logo hochladen (PNG/JPG, max. 1 MB)<input type="file" id="logo" accept="image/png,image/jpeg" hidden></label>
      ${a.hasLogo ? '<button class="text-btn del" id="logoDel" type="button">Entfernen</button>' : ''}</div>
      <label class="pt-field">Markenfarbe<input type="color" id="color" value="${esc(a.brandColor || '#0F2C59')}"></label>` : '<p class="form-note">Co-Branding (eigenes Logo und Farbe) ist ab Tarif Kanzlei & Baufi Pro enthalten.</p>'}
    </section>
    <section class="pt-card"><h2>Rechtliches</h2>
      <p>Unternehmer nach § 14 BGB bestätigt am ${dtt(a.unternehmerConfirmedAt)}.</p>
      <p>Auftragsverarbeitungsvertrag (Version ${esc(a.avvVersion || '')}) geschlossen am ${dtt(a.avvAcceptedAt)}.</p>
      <button class="btn btn-ghost" id="avv" type="button">AVV als PDF</button></section>
    ${a.institutionType === 'BANK' ? `<section class="pt-card"><h2>Postkorb für Einreichungen</h2><p class="form-note">Vermittler mit ImmoAdv-Konto können Ihrem Institut registrierte Kreditmappen zur Vorprüfung einreichen. Sie setzen Status und Rückfragen im Reiter Einreichungen.</p>
      <label class="pt-switch"><input type="checkbox" id="accSub"${a.acceptSubmissions ? ' checked' : ''}> Einreichungen annehmen und im Verzeichnis erscheinen</label></section>` : ''}
    ${me.tier === 'ENTERPRISE' || a.hasWhitelabel ? `<section class="pt-card"><h2>Eigener Hinweistext</h2><p class="form-note">Erscheint auf Ihrer Partnerseite, im Widget und in der Finanzierungsübersicht für Interessenten (z. B. Compliance-Hinweis Ihres Instituts). Max. 600 Zeichen.</p>
      <textarea id="discl" rows="3" maxlength="600" style="width:100%;border:1px solid #CBD5E1;border-radius:6px;padding:8px">${esc(a.customDisclaimer || '')}</textarea><button class="btn btn-ghost" id="disclSave" type="button">Speichern</button></section>` : ''}
    <section class="pt-card"><h2>Aufbewahrung der Anfragen</h2><p class="form-note">Anfragen werden nach dieser Frist automatisch gelöscht (Speicherbegrenzung, Art. 5 DSGVO). Legen Sie die Frist passend zu Ihren eigenen Pflichten fest.</p>
      <label class="pt-field">Löschen nach<select id="ret">${[6, 12, 24, 36, 60, 120].map((m) => `<option value="${m}"${(a.leadRetentionMonths || 24) === m ? ' selected' : ''}>${m} Monaten</option>`).join('')}</select></label></section>
    ${me.limits?.cobranding ? `<section class="pt-card"><h2>Webhook für Ihr CRM</h2><p class="form-note">Bei jeder neuen Anfrage senden wir sie als JSON per POST an Ihre Adresse (https). Prüfen Sie die Signatur: Header <code>X-ImmoAdv-Signature</code> = <code>sha256=</code> HMAC-SHA256 mit dem Geheimnis über <code>Zeitstempel.Body</code> (Header <code>X-ImmoAdv-Timestamp</code>).</p>
      <label class="pt-field">Adresse<input id="whUrl" value="${esc(a.webhookUrl || '')}" placeholder="https://crm.example.de/hooks/immoadv"></label>
      ${a.webhookSecret ? `<p class="form-note">Geheimnis: <code>${esc(a.webhookSecret)}</code> <button class="text-btn" id="whRot" type="button">Neu erzeugen</button></p>` : ''}
      <div class="pt-row"><button class="btn btn-ghost" id="whSave" type="button">Speichern</button>${a.webhookUrl ? '<button class="btn btn-ghost" id="whTest" type="button">Test senden</button>' : ''}</div><div id="whLog"></div></section>` : ''}
    <section class="pt-card"><h2>Support-Zugriff</h2>
      <p class="form-note">Für Rückfragen kann der ImmoAdv-Support Ihr Portal 7 Tage lang <strong>nur lesend</strong> einsehen, einschließlich der Anfragen. Ohne Ihre Freigabe ist das nicht möglich; jeder Zugriff wird protokolliert (Weisung nach Art. 28 DSGVO).</p>
      <p>${a.supportAccessUntil && new Date(a.supportAccessUntil) > new Date() ? `Freigegeben bis ${dtt(a.supportAccessUntil)}. <button class="text-btn del" id="supOff" type="button">Jetzt beenden</button>` : '<button class="btn btn-ghost" id="supOn" type="button">Support-Zugriff für 7 Tage freigeben</button>'}</p></section>`;
  $('#prof').onsubmit = (e) => { e.preventDefault(); busy(e.submitter || $('#prof button'), async () => {
    const f = Object.fromEntries(new FormData(e.target));
    const body = { advisorName: f.advisorName, phone: f.phone, street: f.street, postalCode: f.postalCode, city: f.city, bookingUrl: f.bookingUrl, slug: f.slug };
    const r = await api('/api/b2b/account', { method: 'PATCH', body: JSON.stringify(body) });
    if (!r.ok) throw Error(r.data?.error);
    me.account = { ...me.account, ...r.data.account }; toast('Gespeichert.');
  }); };
  $('#avv').onclick = (e) => busy(e.target, () => download('/api/b2b/avv?pdf=1', {}, 'AVV.pdf'));
  const sup = async (days) => {
    const r = await api('/api/b2b/account', { method: 'PATCH', body: JSON.stringify({ supportAccessDays: days }) });
    if (!r.ok) return toast(r.data?.error || 'Fehler', true);
    me.account = { ...me.account, ...r.data.account }; toast(days ? 'Support-Zugriff freigegeben.' : 'Support-Zugriff beendet.'); vProfil(box);
  };
  if ($('#supOn')) $('#supOn').onclick = () => sup(7);
  const patch = async (body, okMsg) => {
    const r = await api('/api/b2b/account', { method: 'PATCH', body: JSON.stringify(body) });
    if (!r.ok) throw Error(r.data?.error || 'Fehler');
    me.account = { ...me.account, ...r.data.account }; toast(okMsg);
  };
  $('#ret').onchange = (e) => patch({ leadRetentionMonths: Number(e.target.value) }, 'Frist gespeichert.').catch((er) => toast(er.message, true));
  if ($('#whSave')) $('#whSave').onclick = (e) => busy(e.target, async () => { await patch({ webhookUrl: $('#whUrl').value.trim() }, 'Webhook gespeichert.'); vProfil(box); });
  if ($('#whRot')) $('#whRot').onclick = () => { if (confirm('Neues Geheimnis erzeugen? Das alte wird sofort ungültig.')) patch({ regenerateWebhookSecret: true }, 'Neues Geheimnis erzeugt.').then(() => vProfil(box), (er) => toast(er.message, true)); };
  if ($('#whTest')) $('#whTest').onclick = (e) => busy(e.target, async () => {
    const r = await api('/api/b2b/webhook', { method: 'POST' });
    toast(r.ok ? `Test zugestellt (HTTP ${r.data.status}).` : `Nicht zugestellt: ${r.data?.error || 'Fehler'}`, !r.ok);
    const l = await api('/api/b2b/webhook');
    if (l.ok) $('#whLog').innerHTML = `<table class="bill-table"><tbody>${l.data.log.map((x) => `<tr><td>${dtt(x.created_at)}</td><td>${esc(x.event)}</td><td>${x.status ?? '–'}</td><td>${esc(x.error || 'ok')}</td></tr>`).join('')}</tbody></table>`;
  });
  if ($('#accSub')) $('#accSub').onchange = async (e) => {
    const r = await api('/api/b2b/account', { method: 'PATCH', body: JSON.stringify({ acceptSubmissions: e.target.checked }) });
    if (r.ok) { me.account = { ...me.account, ...r.data.account }; toast('Gespeichert.'); } else { e.target.checked = !e.target.checked; toast(r.data?.error || 'Fehler', true); }
  };
  if ($('#disclSave')) $('#disclSave').onclick = (e) => busy(e.target, async () => {
    const r = await api('/api/b2b/account', { method: 'PATCH', body: JSON.stringify({ customDisclaimer: $('#discl').value }) });
    if (!r.ok) throw Error(r.data?.error); me.account = { ...me.account, ...r.data.account }; toast('Gespeichert.');
  });
  if ($('#supOff')) $('#supOff').onclick = () => sup(0);
  if ($('#logo')) $('#logo').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 1024 * 1024) return toast('Das Logo ist größer als 1 MB.', true);
    const r = await api('/api/b2b/logo', { method: 'POST', body: f, headers: { 'content-type': f.type } });
    if (!r.ok) return toast(r.data?.error || 'Fehler', true);
    me.account.hasLogo = true; toast('Logo gespeichert.'); vProfil(box);
  };
  if ($('#logoDel')) $('#logoDel').onclick = async () => { await api('/api/b2b/logo', { method: 'DELETE' }); me.account.hasLogo = false; vProfil(box); };
  if ($('#color')) $('#color').onchange = async (e) => {
    const r = await api('/api/b2b/account', { method: 'PATCH', body: JSON.stringify({ brandColor: e.target.value.toUpperCase() }) });
    if (r.ok) { me.account.brandColor = e.target.value; toast('Farbe gespeichert.'); } else toast(r.data?.error || 'Fehler', true);
  };
}

// ---------- Tarif & Rechnungen ----------
async function vTarif(box) {
  if (!prices) prices = await fetch('/data/preise.json').then((r) => r.json());
  const b2b = prices.b2b;
  const a = me.account;
  const [cfg, inv] = await Promise.all([fetch('/api/billing/config').then((r) => r.json()).catch(() => ({})), api('/api/b2b/invoices')]);
  const billingOn = Boolean(cfg.enabled ?? cfg.billingEnabled);
  const net = (c) => (c / 100).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' €';
  const tiers = ['BASIC', 'PRO'];
  box.innerHTML = `
    <section class="pt-card"><h2>Aktueller Tarif</h2>
      <p><strong>${me.tier ? TIER[me.tier] : 'Kein Tarif gebucht'}</strong>${a.planSource === 'manual' ? ' (vom Betreiber freigeschaltet)' : ''}${a.planUntil ? ` · läuft bis ${dt(a.planUntil)}` : ''}</p>
      ${a.planSource === 'stripe' ? '<button class="btn btn-ghost" id="aboPortal" type="button">Abo verwalten (Zahlungsmittel, Wechsel, Kündigung)</button>' : ''}</section>
    <div class="seg" role="tablist" id="ivl"><button type="button" data-i="month" aria-selected="true">Monatlich</button><button type="button" data-i="year" aria-selected="false">Jährlich (2 Monate gespart)</button></div>
    <div class="offers">${tiers.map((t) => b2b.plans.filter((p) => p.tier === t).map((p) => `<div class="offer${t === 'PRO' ? ' rec' : ''}" data-ivl="${p.interval}"${p.interval === 'year' ? ' hidden' : ''}>${t === 'PRO' ? '<span class="offer-rec">Am häufigsten gewählt</span>' : ''}
        <h4>${esc(p.name.replace(' (Jahr)', ''))}</h4><div class="offer-price">${net(p.netto_cents)} <small>netto ${esc(p.intervall)}</small></div>
        <ul>${p.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
        ${me.tier === t ? '<span class="st ok">Gebucht</span>' : `<button class="btn btn-dark" data-plan="${p.id}" type="button"${billingOn ? '' : ' disabled'}>${billingOn ? 'Weiter zur Bezahlung' : 'Buchung startet in Kürze'}</button>`}</div>`).join('')).join('')}
      <div class="offer"><h4>${esc(b2b.enterprise.name)}</h4><div class="offer-price">${esc(b2b.enterprise.preis)}</div><ul>${b2b.enterprise.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul><a class="btn btn-ghost" href="/b2b#kontakt">Angebot anfragen</a></div>
    </div>
    <label class="consent"><input type="checkbox" id="terms"> Ich buche als Unternehmer (§ 14 BGB) zu den <a href="/nutzungsbedingungen#b2b" target="_blank">Nutzungsbedingungen für Unternehmen</a>. Preise netto zzgl. 19 % USt. Ein Widerrufsrecht besteht nicht.</label>
    ${billingOn ? '' : '<p class="form-note">Online-Buchung ist noch nicht freigeschaltet. Für einen Testzugang oder Kauf auf Rechnung: support@immoadv.de.</p>'}
    <section class="pt-card"><h2>Rechnungen</h2>${inv.ok && inv.data.invoices.length ? `<table class="bill-table"><thead><tr><th>Nummer</th><th>Datum</th><th>Brutto</th><th>Status</th><th></th></tr></thead><tbody>
      ${inv.data.invoices.map((i) => `<tr><td>${esc(i.invoice_number)}${i.kind !== 'invoice' ? ' (Storno)' : ''}</td><td>${dt(i.issue_date)}</td><td>${eur(i.gross_cents)}</td><td>${{ PAID: 'bezahlt', PENDING: 'offen', OVERDUE: 'überfällig', CANCELLED: 'storniert' }[i.payment_status]}</td><td><button class="text-btn" data-inv="${i.id}" type="button">PDF</button></td></tr>`).join('')}</tbody></table>` : '<p class="form-note">Noch keine Rechnungen.</p>'}</section>`;
  box.querySelectorAll('#ivl button').forEach((b) => b.onclick = () => {
    box.querySelectorAll('#ivl button').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    box.querySelectorAll('.offer[data-ivl]').forEach((o) => { o.hidden = o.dataset.ivl !== b.dataset.i; });
  });
  box.querySelectorAll('[data-plan]').forEach((b) => b.onclick = () => busy(b, async () => {
    if (!$('#terms').checked) throw Error('Bitte die Unternehmer-Bestätigung ankreuzen.');
    const r = await api('/api/b2b/checkout', { method: 'POST', body: JSON.stringify({ plan: b.dataset.plan, terms: true }) });
    if (!r.ok) throw Error(r.data?.error);
    location.href = r.data.url;
  }));
  if ($('#aboPortal')) $('#aboPortal').onclick = (e) => busy(e.target, async () => {
    const r = await api('/api/b2b/checkout', { method: 'PUT' });
    if (!r.ok) throw Error(r.data?.error); location.href = r.data.url;
  });
  box.querySelectorAll('[data-inv]').forEach((b) => b.onclick = () => busy(b, () => download('/api/b2b/invoices?id=' + b.dataset.inv, {}, 'Rechnung.pdf')));
}

// ---------- Registrierung ----------
async function onboarding(avvVersion) {
  const avv = await fetch('/api/b2b/avv').then((r) => r.json()).catch(() => null);
  const ref = new URLSearchParams(location.search).get('ref') || '';
  root.innerHTML = `<div class="pt-onb">
    <a class="pt-brand dark" href="/"><img src="/logo-icon.svg" alt="" width="30" height="26"><span>Immo<span>Adv</span></span></a>
    <h1>Unternehmenskonto anlegen</h1>
    <p>Für Makler, Finanzierungsvermittler und Kreditinstitute. Nach der Registrierung stehen Partnerseite, Widget, QR-Codes und Anfragen-Pipeline bereit, sobald ein Tarif aktiv ist.</p>
    <form id="reg" class="pt-card">
      <h2>1. Unternehmen</h2>
      <div class="obj-grid">
        <label>Firmenname*<input name="companyName" required minlength="2" maxlength="160" autocomplete="organization"></label>
        <label>Rechtsform*<select name="legalForm" required><option value="">Bitte wählen</option>${['Einzelunternehmen', 'e. K.', 'GbR', 'OHG', 'KG', 'GmbH', 'UG (haftungsbeschränkt)', 'GmbH & Co. KG', 'AG', 'eG', 'Anstalt des öffentlichen Rechts', 'Sonstige'].map((x) => `<option>${x}</option>`).join('')}</select></label>
        <label>Art*<select name="institutionType" required>${Object.entries(TYPE).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
        <label>Vermittler-Registernummer<input name="registerNumber" placeholder="D-W-123-ABCD-12" maxlength="60"></label>
        <label>USt-IdNr. oder Steuernummer<input name="taxId" placeholder="DE123456789" maxlength="40"></label>
      </div>
      <p class="form-note">Registernummer (§ 34c/§ 34i GewO, Vermittlerregister) oder Steuernummer/USt-IdNr.: mindestens eine Angabe ist Pflicht.</p>
      <h2>2. Ansprechpartner und Anschrift</h2>
      <div class="obj-grid">
        <label>Name*<input name="advisorName" required minlength="2" autocomplete="name"></label>
        <label>Telefon<input name="phone" autocomplete="tel"></label>
        <label>Straße und Nr.*<input name="street" required minlength="3" autocomplete="street-address"></label>
        <label>PLZ*<input name="postalCode" required pattern="[0-9]{5}" inputmode="numeric" autocomplete="postal-code"></label>
        <label>Ort*<input name="city" required autocomplete="address-level2"></label>
        <label>Partnercode (optional)<input name="partnerCode" maxlength="30"></label>
      </div>
      <p class="form-note">Konto-E-Mail: ${esc(session()?.user?.email || '')}</p>
      <h2>3. Verträge</h2>
      <details class="pt-avv"><summary>${esc(avv?.title || 'Auftragsverarbeitungsvertrag')} (Version ${esc(avvVersion)}) lesen</summary>
        ${(avv?.sections || []).map((s) => `<h3>${esc(s.h)}</h3>${s.p.map((p) => `<p>${esc(p)}</p>`).join('')}`).join('')}</details>
      <label class="consent"><input type="checkbox" name="richtig" required> Ich versichere, dass alle Angaben zum Unternehmen und zu meiner Person vollständig und richtig sind. Mir ist bekannt, dass ImmoAdv das Konto bei falschen Angaben sperren kann.</label>
      <label class="consent"><input type="checkbox" name="unternehmer" required> Ich bestätige, dass ich als Unternehmer im Sinne des § 14 BGB handele. Mir ist bekannt, dass kein Widerrufsrecht besteht.</label>
      <label class="consent"><input type="checkbox" name="avv" required> Ich schließe für das Unternehmen den Auftragsverarbeitungsvertrag (Art. 28 DSGVO) in der oben angezeigten Fassung ab und bin dazu berechtigt.</label>
      <label class="consent"><input type="checkbox" name="agb" required> Ich habe die <a href="/nutzungsbedingungen#b2b" target="_blank">Nutzungsbedingungen für Unternehmen</a> und die <a href="/datenschutz" target="_blank">Datenschutzhinweise</a> gelesen.</label>
      <p class="form-note">Nach dem Absenden erhalten Sie einen schriftlichen Nachweis über alle Angaben und Erklärungen als PDF per E-Mail.</p>
      <button class="btn btn-dark" type="submit">Unternehmenskonto anlegen</button>
      <p class="form-note">ImmoAdv ist ein technisches Analyse- und Vorbereitungsinstrument. Keine Kreditvermittlung, keine Kreditzusage, keine Steuer- oder Rechtsberatung.</p>
    </form></div>`;
  $('#reg').onsubmit = (e) => {
    e.preventDefault();
    busy(e.target.querySelector('button[type=submit]'), async () => {
      const f = Object.fromEntries(new FormData(e.target));
      const body = { ...f, unternehmer: f.unternehmer === 'on', avv: f.avv === 'on', richtig: f.richtig === 'on', agb: f.agb === 'on', referral: ref };
      const { work } = await import('./loader.mjs');
      const w = work('Unternehmenskonto wird angelegt', ['Angaben prüfen', 'Konto anlegen', 'Nachweis erstellen und senden']);
      await w.step(0);
      const pr = api('/api/b2b/account', { method: 'POST', body: JSON.stringify(body) });
      await w.step(1);
      const r = await pr;
      if (!r.ok) { w.close(); throw Error(r.data?.error || 'Registrierung fehlgeschlagen.'); }
      await w.step(2); await w.done('Konto angelegt');
      toast('Unternehmenskonto angelegt.');
      location.hash = '#start';
      await start();
    });
  };
}

async function acceptInvite(tok) {
  const r = await api('/api/b2b/team', { method: 'PUT', body: JSON.stringify({ token: tok }) });
  history.replaceState(null, '', location.pathname + '#start');
  if (!r.ok) { root.innerHTML = `<div class="pt-onb"><h1>Einladung</h1><p>${esc(r.data?.error || 'Fehler')}</p><p><button class="btn btn-dark" type="button" id="ptOtherLogin">Mit anderer Adresse anmelden</button></p></div>`; root.querySelector('#ptOtherLogin').onclick = () => { setSession(null); location.reload(); }; return false; }
  toast('Sie sind dem Team beigetreten.');
  return true;
}

async function start() {
  // Rückkehr aus der Bestätigungs-E-Mail (Supabase-Standardversand): Sitzung aus dem Link übernehmen.
  const hp = new URLSearchParams(location.hash.slice(1));
  if (hp.get('access_token')) { setSession({ access_token: hp.get('access_token'), refresh_token: hp.get('refresh_token'), expires_in: Number(hp.get('expires_in')) || 3600, token_type: 'bearer' }); history.replaceState(null, '', location.pathname + '#start'); }
  if (!session()?.access_token) {
    loginForm(root, { title: 'Unternehmensportal', lead: 'Anmeldung für Unternehmen – getrennt vom privaten ImmoAdv-Konto.', note: 'Noch kein Unternehmenskonto? Oben „Konto anlegen“ wählen.', signup: { next: '/b2b-portal' } });
    return;
  }
  const inv = /einladung=([A-Za-z0-9_-]{20,80})/.exec(location.hash);
  if (inv && !(await acceptInvite(inv[1]))) return;
  const r = await api('/api/b2b/account');
  if (r.status === 401) { setSession(null); return start(); }
  if (!r.ok) { root.innerHTML = `<div class="pt-onb"><h1>Unternehmensportal</h1><p>${esc(r.data?.error || 'Nicht verfügbar.')}</p></div>`; return; }
  if (!r.data.account) { await onboarding(r.data.avvVersion); return; }
  me = r.data;
  if (new URLSearchParams(location.search).get('checkout') === 'success') toast('Danke! Der Tarif wird aktiviert, sobald die Zahlung bestätigt ist.');
  shell();
  route();
}

window.addEventListener('hashchange', () => { if (me) route(); });
start();
