// Unternehmensportal (/b2b-portal): Registrierung mit § 14 BGB und AVV, Anfragen-Pipeline,
// Widget- und QR-Studio, Team, Profil mit Co-Branding, Tarif und Rechnungen.
import { api, download, dt, dtt, esc, eur, session } from './sess.mjs';

const root = document.getElementById('portal');
const $ = (s, el = document) => el.querySelector(s);
const VIEWS = [
  ['start', 'Übersicht'], ['anfragen', 'Anfragen'], ['werkzeuge', 'Widget & QR'], ['team', 'Team'], ['profil', 'Profil'], ['tarif', 'Tarif & Rechnungen'],
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
      <div class="pt-foot"><strong>${esc(a.companyName)}</strong><small>${esc(a.customerNumber)} · ${me.role === 'owner' ? 'Inhaber' : 'Berater'}</small><a href="/app/dashboard">Zur Anwendung</a></div>
    </aside>
    <section class="pt-main"><header class="pt-top"><h1 id="ptTitle"></h1>${a.status === 'locked' ? '<span class="st bad">Gesperrt</span>' : me.tier ? `<span class="st ok">${TIER[me.tier]}</span>` : '<span class="st warn">Kein Tarif</span>'}</header>
      ${a.status === 'locked' ? `<div class="pt-alert bad"><strong>Konto gesperrt.</strong> ${esc(a.lockReason || '')} Rechnungen und AVV bleiben abrufbar. Fragen an support@immoadv.de.</div>` : ''}
      <div id="ptView"></div></section>
    <nav class="pt-tabs">${VIEWS.filter(([v]) => me.role === 'owner' || !['tarif', 'profil'].includes(v)).map(([v, l]) => `<a href="#${v}" data-v="${v}">${l.split(' ')[0]}</a>`).join('')}</nav>
  </div>`;
}

function route() {
  const v = (location.hash.slice(1).split('=')[0] || 'start');
  const view = VIEWS.find(([k]) => k === v) ? v : 'start';
  document.querySelectorAll('[data-v]').forEach((a) => a.classList.toggle('on', a.dataset.v === view));
  $('#ptTitle').textContent = VIEWS.find(([k]) => k === view)[1];
  const box = $('#ptView');
  box.innerHTML = '<p class="form-note">Wird geladen …</p>';
  ({ start: vStart, anfragen: vLeads, werkzeuge: vTools, team: vTeam, profil: vProfil, tarif: vTarif })[view](box);
}

// ---------- Übersicht ----------
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
  box.innerHTML = `
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
    </div>`;
}

// ---------- Anfragen ----------
async function vLeads(box) {
  const r = await api('/api/b2b/leads');
  if (!r.ok) { box.innerHTML = `<p class="form-note">${esc(r.data?.error)}</p>`; return; }
  const leads = r.data.leads;
  const n = (v) => (v == null || v === '' ? '–' : Number(v).toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' €');
  box.innerHTML = `<div class="pt-bar"><div class="seg" role="tablist">${['alle', ...Object.keys(STATUS)].map((s, i) => `<button type="button" data-f="${s}" aria-selected="${i === 0}">${s === 'alle' ? 'Alle' : STATUS[s]}</button>`).join('')}</div>
    <button class="btn btn-ghost" id="csv" type="button">CSV exportieren</button></div>
    ${leads.length ? '' : '<div class="pt-empty"><strong>Noch keine Anfragen.</strong><p>Binden Sie das <a href="#werkzeuge">Widget</a> ein oder teilen Sie Ihre Partnerseite. Jede Anfrage erscheint hier mit Objektdaten und Kennzahlen.</p></div>'}
    <div class="pt-leads">${leads.map((l) => {
      const p = l.property_data || {}, m = l.metrics || {};
      return `<article class="pt-lead" data-s="${l.status}" data-id="${l.id}">
        <header><div><strong>${esc(l.client_name)}</strong><small>${dtt(l.created_at)} · ${{ widget: 'Website-Widget', landing: 'Partnerseite', qr: 'QR-Code' }[l.source]}</small></div>
        <select data-id="${l.id}" aria-label="Status">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}"${k === l.status ? ' selected' : ''}>${v}</option>`).join('')}</select></header>
        <p><a href="mailto:${esc(l.client_email)}">${esc(l.client_email)}</a>${l.client_phone ? ` · <a href="tel:${esc(l.client_phone)}">${esc(l.client_phone)}</a>` : ''}</p>
        <dl class="pt-dl"><div><dt>Objekt</dt><dd>${esc(p.address || p.ref || '–')}</dd></div><div><dt>Kaufpreis</dt><dd>${n(p.price)}</dd></div><div><dt>Kaltmiete</dt><dd>${n(p.rent)}</dd></div><div><dt>Eigenkapital</dt><dd>${n(p.equity)}</dd></div>
        ${m.allIn ? `<div><dt>Gesamtkosten</dt><dd>${n(m.allIn)}</dd></div><div><dt>Darlehen</dt><dd>${n(m.loan)}</dd></div><div><dt>Rate</dt><dd>${n(m.rate)}</dd></div><div><dt>DSCR</dt><dd>${m.dscr ?? '–'}</dd></div>` : ''}</dl>
        ${l.message ? `<p class="pt-msg">${esc(l.message)}</p>` : ''}
        <details><summary>Einwilligung</summary><p class="form-note">${dtt(l.consent_at)}: ${esc(l.consent_text)}</p></details>
        ${me.role === 'owner' ? `<button class="text-btn del" data-del="${l.id}" type="button">Löschen</button>` : ''}
      </article>`;
    }).join('')}</div>`;
  box.querySelectorAll('[data-f]').forEach((b) => b.onclick = () => {
    box.querySelectorAll('[data-f]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    box.querySelectorAll('.pt-lead').forEach((el) => { el.hidden = b.dataset.f !== 'alle' && el.dataset.s !== b.dataset.f; });
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
      <button class="btn btn-ghost" id="avv" type="button">AVV als PDF</button></section>`;
  $('#prof').onsubmit = (e) => { e.preventDefault(); busy(e.submitter || $('#prof button'), async () => {
    const f = Object.fromEntries(new FormData(e.target));
    const body = { advisorName: f.advisorName, phone: f.phone, street: f.street, postalCode: f.postalCode, city: f.city, bookingUrl: f.bookingUrl, slug: f.slug };
    const r = await api('/api/b2b/account', { method: 'PATCH', body: JSON.stringify(body) });
    if (!r.ok) throw Error(r.data?.error);
    me.account = { ...me.account, ...r.data.account }; toast('Gespeichert.');
  }); };
  $('#avv').onclick = (e) => busy(e.target, () => download('/api/b2b/avv?pdf=1', {}, 'AVV.pdf'));
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
      ${a.planSource === 'stripe' ? '<button class="btn btn-ghost" id="portal" type="button">Abo verwalten (Zahlungsmittel, Wechsel, Kündigung)</button>' : ''}</section>
    <div class="seg" role="tablist" id="ivl"><button type="button" data-i="month" aria-selected="true">Monatlich</button><button type="button" data-i="year" aria-selected="false">Jährlich (2 Monate gespart)</button></div>
    <div class="offers">${tiers.map((t) => b2b.plans.filter((p) => p.tier === t).map((p) => `<div class="offer${t === 'PRO' ? ' rec' : ''}" data-ivl="${p.interval}"${p.interval === 'year' ? ' hidden' : ''}>${t === 'PRO' ? '<span class="offer-rec">Am häufigsten gewählt</span>' : ''}
        <h4>${esc(p.name.replace(' (Jahr)', ''))}</h4><div class="offer-price">${net(p.netto_cents)} <small>netto ${esc(p.intervall)}</small></div>
        <ul>${p.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
        ${me.tier === t ? '<span class="st ok">Gebucht</span>' : `<button class="btn btn-dark" data-plan="${p.id}" type="button"${billingOn ? '' : ' disabled'}>${billingOn ? 'Buchen' : 'Buchung startet in Kürze'}</button>`}</div>`).join('')).join('')}
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
  if ($('#portal')) $('#portal').onclick = (e) => busy(e.target, async () => {
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
      <label class="consent"><input type="checkbox" name="unternehmer" required> Ich bestätige, dass ich als Unternehmer im Sinne des § 14 BGB handele. Mir ist bekannt, dass kein Widerrufsrecht besteht.</label>
      <label class="consent"><input type="checkbox" name="avv" required> Ich schließe für das Unternehmen den Auftragsverarbeitungsvertrag (Art. 28 DSGVO) in der oben angezeigten Fassung ab und bin dazu berechtigt.</label>
      <label class="consent"><input type="checkbox" required> Ich habe die <a href="/nutzungsbedingungen#b2b" target="_blank">Nutzungsbedingungen für Unternehmen</a> und die <a href="/datenschutz" target="_blank">Datenschutzhinweise</a> gelesen.</label>
      <button class="btn btn-dark" type="submit">Unternehmenskonto anlegen</button>
      <p class="form-note">ImmoAdv ist ein technisches Analyse- und Vorbereitungsinstrument. Keine Kreditvermittlung, keine Kreditzusage, keine Steuer- oder Rechtsberatung.</p>
    </form></div>`;
  $('#reg').onsubmit = (e) => {
    e.preventDefault();
    busy(e.target.querySelector('button[type=submit]'), async () => {
      const f = Object.fromEntries(new FormData(e.target));
      const body = { ...f, unternehmer: f.unternehmer === 'on', avv: f.avv === 'on', referral: ref };
      const r = await api('/api/b2b/account', { method: 'POST', body: JSON.stringify(body) });
      if (!r.ok) throw Error(r.data?.error || 'Registrierung fehlgeschlagen.');
      toast('Unternehmenskonto angelegt.');
      location.hash = '#start';
      await start();
    });
  };
}

async function acceptInvite(tok) {
  const r = await api('/api/b2b/team', { method: 'PUT', body: JSON.stringify({ token: tok }) });
  history.replaceState(null, '', location.pathname + '#start');
  if (!r.ok) { root.innerHTML = `<div class="pt-onb"><h1>Einladung</h1><p>${esc(r.data?.error || 'Fehler')}</p><p><a class="btn btn-dark" href="/auth/login?next=/b2b-portal">Mit anderer Adresse anmelden</a></p></div>`; return false; }
  toast('Sie sind dem Team beigetreten.');
  return true;
}

async function start() {
  if (!session()?.access_token) {
    root.innerHTML = `<div class="pt-onb"><a class="pt-brand dark" href="/"><img src="/logo-icon.svg" alt="" width="30" height="26"><span>Immo<span>Adv</span></span></a><h1>Unternehmensportal</h1><p>Bitte zuerst anmelden oder ein kostenloses Konto anlegen. Danach registrieren Sie hier Ihr Unternehmen.</p>
      <p class="pt-row"><a class="btn btn-dark" href="/auth/login?next=${encodeURIComponent('/b2b-portal' + location.hash)}">Anmelden</a><a class="btn btn-ghost" href="/auth/register?next=${encodeURIComponent('/b2b-portal' + location.hash)}">Konto anlegen</a><a class="btn btn-ghost" href="/b2b">Angebot für Unternehmen</a></p></div>`;
    return;
  }
  const inv = /einladung=([A-Za-z0-9_-]{20,80})/.exec(location.hash);
  if (inv && !(await acceptInvite(inv[1]))) return;
  const r = await api('/api/b2b/account');
  if (r.status === 401) { root.innerHTML = '<div class="pt-onb"><h1>Sitzung abgelaufen</h1><p><a class="btn btn-dark" href="/auth/login?next=/b2b-portal">Neu anmelden</a></p></div>'; return; }
  if (!r.ok) { root.innerHTML = `<div class="pt-onb"><h1>Unternehmensportal</h1><p>${esc(r.data?.error || 'Nicht verfügbar.')}</p></div>`; return; }
  if (!r.data.account) { await onboarding(r.data.avvVersion); return; }
  me = r.data;
  if (new URLSearchParams(location.search).get('checkout') === 'success') toast('Danke! Der Tarif wird aktiviert, sobald die Zahlung bestätigt ist.');
  shell();
  route();
}

window.addEventListener('hashchange', () => { if (me) route(); });
start();
