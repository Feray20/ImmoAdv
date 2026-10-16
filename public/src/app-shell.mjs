// App-Rahmen für das Konto: Handy wie eine App (Tab-Leiste unten), Desktop wie ein Investment-Tool (Seitenleiste).
// Ansichten über #hash; vorhandene Karten werden den Ansichten zugeordnet. Modus Einsteiger/Profi frei wählbar.
import { rank } from './calc.mjs';

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const E = (cents) => (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

const ICON = {
  start: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  suche: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  objekte: '<path d="M4 21V9l8-6 8 6v12"/><path d="M9 21v-6h6v6"/>',
  lernen: '<path d="M2 8l10-5 10 5-10 5z"/><path d="M6 10v5c0 2 3 4 6 4s6-2 6-4v-5"/>',
  angebot: '<path d="M20 12l-8 8-9-9V3h8z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  konto: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  steuer: '<line x1="19" y1="5" x2="5" y2="19"/><circle cx="7.5" cy="7.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/>',
};
const svg = (k) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;

const VIEWS = {
  einsteiger: [['start', 'Übersicht'], ['suche', 'Suche'], ['objekte', 'Objekte'], ['steuer', 'Steuer'], ['lernen', 'Wissen'], ['angebot', 'Angebot'], ['konto', 'Konto']],
  profi: [['start', 'Cockpit'], ['suche', 'Suche & Analyse'], ['objekte', 'Objekte'], ['steuer', 'Steuer'], ['lernen', 'Wissen'], ['angebot', 'Tarif'], ['konto', 'Konto']],
};
const TABS = ['start', 'suche', 'objekte', 'steuer', 'lernen', 'konto'];

// Lernbereich: Themen frei wählbar (keine feste Reihenfolge). Wissen aus /data/faq.json (Kurz- und Detailantwort).
// [id, Titel, Kurzbeschreibung, FAQ-Indizes, [Werkzeug-Text, Link], Bereich]
const LERN = [
  ['budget', 'Was kann ich mir leisten?', 'Rate, Darlehen und Kaufpreis aus Einkommen und Eigenkapital.', [0, 5, 6], ['Budget-Rechner', '/rechner/budget'], 'Leisten & Finanzieren'],
  ['eigenkapital', 'Eigenkapital und Kaufnebenkosten', 'Wie viel eigenes Geld nötig ist und was zum Kaufpreis dazukommt.', [1, 2], ['Kaufnebenkosten-Rechner', '/rechner/kaufnebenkosten'], 'Leisten & Finanzieren'],
  ['annuitaet', 'Zins, Tilgung, Zinsbindung', 'Wie sich die Rate zusammensetzt.', [3], ['Tilgungsplan', '/rechner/tilgungsplan'], 'Leisten & Finanzieren'],
  ['fristen', 'Wenn die Zinsbindung endet', 'Anschlussfinanzierung, Kipp-Punkt und wichtige Fristen.', [23, 24], ['Fristen-Rechner', '/fristen'], 'Leisten & Finanzieren'],
  ['beruf', 'Was die Bank je nach Beruf prüft', 'Angestellt, selbstständig, verbeamtet – und welche Unterlagen.', [4], ['Erwerbsstatus im Detail', '/wissen/erwerbsstatus'], 'Leisten & Finanzieren'],
  ['beleihung', 'Beleihungswert: wie die Bank rechnet', 'Warum die Bank anders bewertet als der Verkäufer.', [7], ['Deal-Scorecard', '/rechner/scorecard'], 'Leisten & Finanzieren'],
  ['suche', 'Objekte suchen und vergleichen', 'Vom Inserat zur Kennzahl – und mehrere Angebote nebeneinander.', [10], ['Suche & Analyse', '#suche'], 'Objekt finden & prüfen'],
  ['etw', 'Eigentumswohnung richtig prüfen', 'Teilungserklärung, Protokolle, Rücklage.', [8, 9], ['Unterlagen-Checkliste', '/checkliste'], 'Objekt finden & prüfen'],
  ['cashflow', 'Rendite und Cashflow', 'Brutto, netto, vor und nach Steuern.', [12, 13, 14], ['Cashflow-Rechner', '/rechner/cashflow'], 'Rendite, Steuer & Miete'],
  ['steuer', 'Steuern: AfA, 15-%-Grenze, steuerfreier Verkauf', 'Was die Steuer beim Kauf, Vermieten und Verkaufen bedeutet.', [15, 16, 17], ['Steuer-Bereich', '#steuer'], 'Rendite, Steuer & Miete'],
  ['miete', 'Mietrecht für Vermieter', 'Mietpreisbremse, Kappungsgrenze, Staffelmiete, Mietausfall.', [18, 19, 20, 21], ['Mieterhöhung prüfen', '/rechner/mieterhoehung'], 'Rendite, Steuer & Miete'],
  ['unterlagen', 'Unterlagen und Kreditmappe', 'Was die Bank sehen will und wie Sie es vollständig machen.', [11, 25, 26, 27], ['Unterlagen-Checkliste', '/checkliste'], 'Bank & Unterlagen'],
  ['mahnung', 'Mieter zahlt nicht: Mahnung, Mahnverfahren, Kündigung', 'So sichern Sie sich rechtlich ab – Schritt für Schritt.', [33, 34, 35, 36], ['Online-Mahnantrag der Justiz', 'https://www.online-mahnantrag.de'], 'Vermieten & Absicherung'],
];
// Phasen = die vier Stufen von „Ihr Weg“. Frei wählbar (profile.phase 0–3), sonst automatisch erkannt.
// Die gewählte Phase steuert Startaktionen, Reihenfolge im Steuer-Bereich und empfohlene Wissensthemen.
export const PHASES = [
  { name: 'Orientieren', steuer: 'kauf', lern: ['budget', 'eigenkapital', 'annuitaet', 'beruf'],
    actions: [['/rechner/budget', 'Budget berechnen', 'Was kann ich mir leisten?'], ['#lernen', 'Grundlagen auffrischen', 'Eigenkapital, Zins, Tilgung'], ['#suche', 'Immobilien ansehen', 'Suche bei den großen Portalen']] },
  { name: 'Objekte prüfen', steuer: 'kauf', lern: ['suche', 'etw', 'cashflow', 'beleihung'],
    actions: [['#suche', 'Objekt analysieren', 'Inserat übernehmen, Kennzahlen sehen'], ['#objekte', 'Objekte im Konto', 'Anlegen, vergleichen, Bankreife'], ['#steuer', 'Steuern beim Kauf', 'Kaufkosten, Inventar, AfA']] },
  { name: 'Bankgespräch', steuer: 'kauf', lern: ['unterlagen', 'beruf', 'beleihung', 'annuitaet'],
    actions: [['#objekte', 'Kreditmappe erstellen', 'Objekt wählen → Vorschau → PDF'], ['/checkliste', 'Unterlagen vollständig machen', 'Bankreife auf 90 % bringen'], ['#lernen', 'Was die Bank prüft', 'Beleihungswert, Unterlagen']] },
  { name: 'Bestand', steuer: 'halten', lern: ['steuer', 'miete', 'mahnung', 'fristen'],
    actions: [['/fristen', 'Fristen im Blick', 'Zinsbindung, 15-%-Grenze, Spekulationsfrist'], ['#steuer', 'Steuern & Werbungskosten', 'Anlage V, 66-%-Check, Verkauf'], ['#lernen', 'Mieter zahlt nicht?', 'Mahnung, Mahnverfahren, Kündigung']] },
];
export function phaseOf(d) {
  const p = d.profile?.phase;
  if (Number.isInteger(p) && p >= 0 && p < PHASES.length) return { idx: p, chosen: true };
  try { return { idx: Math.max(0, Math.min(3, rank(d.profile || {}, Array.isArray(d.objects) ? d.objects : [], []).level - 1)), chosen: false }; } catch { return { idx: 0, chosen: false }; }
}
const phasePicker = (idx, chosen) => `<div class="ph-pick" role="group" aria-label="Ihre Phase"><span class="ph-label">Ihre Phase${chosen ? '' : ' (automatisch erkannt)'}:</span>${PHASES.map((p, i) => `<button type="button" class="ph-btn${i === idx ? ' on' : ''}" data-phase="${i}" aria-pressed="${i === idx}">${i + 1} · ${p.name}</button>`).join('')}</div>`;

const PROFI = [
  ['Szenarien: Anschlusszins und Verkauf', '/szenarien'], ['AfA-Plan inkl. Sonder-AfA § 7b', '/rechner/afa'], ['Mieterhöhung mit Briefentwurf', '/rechner/mieterhoehung'],
  ['Angebotsvergleich', '/rechner/vergleich'], ['Kaufen oder mieten', '/rechner/kaufen-mieten'], ['Investment-Cockpit (Stresstest)', '/cockpit'],
  ['Mietrecht- und Steuerrechner', '/rechner'], ['Glossar', '/wissen/glossar'],
];

function classify(el) {
  if (el.dataset.view) return el.dataset.view;
  const id = el.id || '', h = el.querySelector('h3')?.textContent || '', mode = document.body.dataset.mode;
  if (id === 'rankCard') return mode === 'profi' ? 'konto' : 'start konto';
  if (['termineCard', 'pendingCard'].includes(id) || el.classList.contains('req-card')) return 'start';
  if (id === 'portfolioCard') return mode === 'profi' ? 'start objekte' : 'objekte';
  if (['docsCard', 'bankreifeCard'].includes(id) || h === 'Objekte') return 'objekte';
  if (id === 'billingCard') return 'none'; // ersetzt durch „Tarif & Rechnungen“ (finCard)
  if (id === 'accountCard' || h === 'Finanzprofil') return 'konto';
  if (h === 'Weiter') return 'none';
  return 'start';
}

export function setupApp({ u, d, saveData, reload }) {
  const app = $('app'), grid = document.querySelector('.dashboard-grid');
  if (!app || !grid) return;
  try { if (sessionStorage.getItem('ia-import') && !location.hash.startsWith('#suche')) history.replaceState(null, '', location.pathname + location.search + '#suche'); } catch { /* ohne Speicher */ }
  const q = new URLSearchParams(location.search);
  const qm = q.get('modus');
  let mode = qm === 'profi' || qm === 'einsteiger' ? qm : d.profile?.mode;
  if (qm && qm !== d.profile?.mode) { d.profile = { ...(d.profile || {}), mode: qm }; saveData(u, d).catch(() => {}); }
  document.body.classList.add('is-app');
  document.body.dataset.mode = mode || 'einsteiger';
  const views = VIEWS[mode || 'einsteiger'];

  // Seitenleiste (Desktop), obere Leiste und Tab-Leiste (Handy)
  app.insertAdjacentHTML('afterbegin', `<nav class="app-side" aria-label="Anwendung"><a class="brand" href="/"><img class="brand-logo" src="/logo-icon.svg" alt="" width="34" height="29"><span>Immo<span>Adv</span></span></a>
    ${views.map(([k, l]) => `<a class="app-nav" data-go="${k}" href="#${k}">${svg(k)}<span>${l}</span></a>`).join('')}
    <div class="app-side-foot"><a class="text-btn" href="/b2b-portal">Unternehmensportal</a><span class="app-user">${esc(u.email)}</span><button class="text-btn" id="appLogout" type="button">Abmelden</button></div></nav>`);
  const main = app.querySelector('main');
  main.insertAdjacentHTML('afterbegin', `<div class="app-top"><a class="brand app-top-brand" href="/"><img class="brand-logo" src="/logo-icon.svg" alt="" width="30" height="26"><span>Immo<span>Adv</span></span></a><h1 id="appTitle"></h1>
    <button class="mode-chip" id="modeChip" type="button" aria-label="Modus wechseln">${mode === 'profi' ? 'Profi' : 'Einsteiger'} <span aria-hidden="true">⇄</span></button></div>`);
  app.insertAdjacentHTML('beforeend', `<nav class="app-tabs" aria-label="Schnellnavigation">${TABS.map((k) => `<a class="app-tab" data-go="${k}" href="#${k}">${svg(k)}<span>${views.find((v) => v[0] === k)[1].split(' ')[0]}</span></a>`).join('')}</nav>`);
  $('appLogout').onclick = () => document.getElementById('logout')?.click();
  $('modeChip').onclick = async () => {
    d.profile = { ...(d.profile || {}), mode: mode === 'profi' ? 'einsteiger' : 'profi' };
    try { await saveData(u, d); } catch { /* Anzeige wechselt trotzdem */ }
    history.replaceState(null, '', location.pathname + location.hash);
    reload();
  };

  // Eigene Karten: Start, Suche, Lernpfad, Angebot
  grid.insertAdjacentHTML('afterbegin', kmCard());
  grid.insertAdjacentHTML('beforeend', `<article class="dash-card wide fin-card" data-view="konto" id="finCard"><h3>Tarif &amp; Rechnungen</h3><div id="finBody"><p class="form-note">Wird geladen …</p></div></article>`);
  grid.insertAdjacentHTML('afterbegin', startCard(mode, d));
  // Sitzung: Angemeldet bleiben, automatische Abmeldung, Abmelden (auch auf dem Handy erreichbar).
  {
    const A = window.iaAuth;
    grid.insertAdjacentHTML('beforeend', `<article class="dash-card wide sess-card" data-view="konto" id="sessCard"><h3>Anmeldung &amp; Sicherheit</h3>
      <p class="form-note">Angemeldet als <strong>${esc(u.email)}</strong></p>
      <label class="chk sess-rem"><input type="checkbox" id="sessRem"${A && A.remembered() ? ' checked' : ''}> Auf diesem Gerät angemeldet bleiben</label>
      <p class="form-note" id="sessNote"></p>
      <div class="sess-act"><button class="btn btn-dark" type="button" id="sessOut">Abmelden</button><a class="btn btn-outline" href="/auth/forgot">Passwort ändern</a></div>
      <p class="form-note">Ihr Passwort können Sie im Browser bzw. im iPhone-Schlüsselbund speichern lassen – beim Anmelden einfach „Passwort sichern“ bestätigen.</p></article>`);
    const note = () => { const n = $('sessNote'); if (n) n.textContent = $('sessRem').checked ? 'Sie bleiben angemeldet, bis Sie sich abmelden oder 30 Tage nicht aktiv waren. Nur auf eigenen Geräten verwenden.' : 'Automatische Abmeldung nach 30 Minuten ohne Aktivität.'; };
    note();
    $('sessRem').onchange = () => { if (A) { A.setRemember($('sessRem').checked); try { localStorage.setItem('ia-last-active', String(Date.now())); } catch { /* ignore */ } } note(); };
    $('sessOut').onclick = () => document.getElementById('logout')?.click();
  }
  grid.insertAdjacentHTML('beforeend', `<article class="dash-card wide" data-view="suche" id="sucheView"></article>`);
  grid.insertAdjacentHTML('beforeend', `<article class="dash-card wide" data-view="steuer" id="steuerView"></article>`);
  grid.insertAdjacentHTML('beforeend', lernCard(mode, d));
  grid.insertAdjacentHTML('beforeend', `<article class="dash-card wide" data-view="angebot" id="angebotView"><h3>${mode === 'profi' ? 'Tarif' : 'Angebot'}</h3><div id="offerBody"><p class="form-note">Wird geladen …</p></div></article>`);
  bindStart(mode, d, u, saveData, reload);
  bindKm(d);
  renderFin();
  bindLern(d, u, saveData);

  const apply = () => {
    const v = (location.hash.slice(1) || 'start').split('?')[0];
    const cur = views.some((x) => x[0] === v) ? v : 'start';
    const sc = grid.querySelector('.start-card'); if (sc && grid.firstElementChild !== sc) grid.prepend(sc);
    [...grid.children].forEach((el) => { el.dataset.view = classify(el); el.classList.toggle('v-show', el.dataset.view.split(' ').includes(cur)); });
    document.querySelectorAll('[data-go]').forEach((a) => a.classList.toggle('on', a.dataset.go === cur));
    $('appTitle').textContent = views.find((x) => x[0] === cur)[1];
    if (cur === 'suche' && !$('sucheView').dataset.ready) {
      $('sucheView').dataset.ready = '1';
      import('/src/objekt-ui.mjs').then((m) => m.mountObjekt($('sucheView'), { pdf: true })).catch(() => { $('sucheView').innerHTML = '<p class="auth-message error">Suche konnte nicht geladen werden.</p>'; });
    }
    if (cur === 'steuer' && !$('steuerView').dataset.ready) {
      $('steuerView').dataset.ready = '1';
      import('/src/steuer.mjs').then((m) => m.mountSteuer($('steuerView'), { mode, phase: PHASES[phaseOf(d).idx].steuer })).catch(() => { $('steuerView').innerHTML = '<p class="auth-message error">Steuer-Bereich konnte nicht geladen werden.</p>'; });
    }
    if (cur === 'angebot' && !$('angebotView').dataset.ready) { $('angebotView').dataset.ready = '1'; renderOffers(mode); }
  };
  if (window.__iaHash) window.removeEventListener('hashchange', window.__iaHash);
  window.__iaHash = () => { apply(); window.scrollTo(0, 0); };
  window.addEventListener('hashchange', window.__iaHash);
  new MutationObserver(apply).observe(grid, { childList: true });
  apply();
}

// „PDF erstellen“ im Bereich Objekte: Kreditmappe oder Objekt-Analyse, jeweils automatisch (aus den gespeicherten
// Daten) oder manuell (selbst im Formular eintragen bzw. Vorlage zum Ausfüllen von Hand). Ausgabe als PDF oder E-Mail.
let KM = { doc: 'km', way: 'auto' };
// Rückkehr aus dem Checkout (wird beim Laden des Moduls gelesen, bevor die Adresse bereinigt wird).
const CHECKOUT = new URLSearchParams(location.search).get('checkout');
// Nach einem Kauf den Navigationsstatus neu laden (Zur Anwendung / App-Leiste).
if (CHECKOUT === 'success') { try { localStorage.removeItem('ia-access'); } catch { /* ignore */ } }
function kmCard() {
  return `<article class="dash-card wide km-card" data-view="objekte" id="kmCard"><h3>PDF erstellen</h3>
    <div class="km-switch">
      <div class="seg" role="tablist" aria-label="Dokument"><button type="button" role="tab" data-kmdoc="km">Kreditmappe</button><button type="button" role="tab" data-kmdoc="an">Objekt-Analyse</button></div>
      <div class="seg" role="tablist" aria-label="Weg"><button type="button" role="tab" data-kmway="auto">Automatisch</button><button type="button" role="tab" data-kmway="man">Manuell</button></div>
    </div>
    <div id="kmBody"></div><p class="km-msg" id="kmMsg" role="status" aria-live="polite"></p></article>`;
}

function kmBody(d) {
  const os = (Array.isArray(d.objects) ? d.objects : []).filter((o) => o && o.id);
  const km = KM.doc === 'km';
  const pick = `<label class="km-pick">Objekt<select id="kmObj">${os.map((o) => `<option value="${esc(o.id)}">${esc(o.name || 'Objekt')}</option>`).join('')}</select></label>`;
  if (KM.way === 'man') {
    const tpl = km ? '/api/unterlagen/kreditmappe-vorlage' : '/api/unterlagen/analyse-vorlage';
    return `<div class="km-grid">
      <div class="km-box"><strong>Selbst eintragen</strong><span>${km ? 'Alle Angaben im Objekt-Formular eintragen (Bereich „Angaben für die Kreditmappe“). Danach unter „Automatisch“ als PDF ausgeben.' : 'Kaufpreis, Miete, Kosten und Finanzierung selbst eintragen – die Kennzahlen rechnen sich sofort.'}</span>
        <div class="km-actions"><button class="btn btn-dark" type="button" id="kmManual">${km ? 'Formular öffnen' : 'Analyse-Formular öffnen'}</button></div></div>
      <div class="km-box"><strong>Vorlage zum Ausfüllen von Hand</strong><span>${km ? 'Kreditmappe als PDF-Formular zum Ausdrucken: Angaben, Finanzierung, Haushaltsrechnung, Unterlagen-Checkliste.' : 'Rechenblatt mit allen Formeln: Rendite, Faktor, Rate, Cashflow, DSCR.'}</span>
        <div class="km-actions"><a class="btn btn-dark" href="${tpl}" target="_blank" rel="noopener">Ansehen</a><a class="btn btn-outline" href="${tpl}" download>Herunterladen</a></div></div>
    </div>`;
  }
  if (!os.length) {
    return `<p class="form-note">Für die automatische ${km ? 'Kreditmappe' : 'Analyse'} braucht es ein gespeichertes Objekt. Legen Sie eines an – oder übernehmen Sie ein Inserat bzw. Exposé in der Suche.</p>
      <div class="km-actions"><a class="btn btn-dark" href="#objekte" id="kmAdd">Objekt anlegen</a><a class="btn btn-outline" href="#suche">Exposé / Inserat übernehmen</a><a class="btn btn-outline" href="/mustermappe">Beispiel ansehen</a></div>`;
  }
  if (!km) {
    return `${pick}<div class="km-grid"><div class="km-box"><strong>Objekt-Analyse</strong><span>Rendite, Cashflow vor und nach Steuern, Finanzierung, Risiko und Wert – automatisch aus den Objektdaten berechnet.</span>
      <div class="km-actions"><button class="btn btn-dark" type="button" data-an="pdf">PDF herunterladen</button><button class="btn btn-outline" type="button" data-an="mail">Per E-Mail</button><button class="btn btn-ghost" type="button" data-an="open">Ansehen und anpassen</button></div></div></div>`;
  }
  return `${pick}<div class="km-grid">
      <div class="km-box"><strong>Vorschau</strong><span>Vollständiger Inhalt mit Wasserzeichen „Vorschau“ – zum Prüfen Ihrer Angaben. Kostenlos.</span>
        <div class="km-actions"><button class="btn btn-dark" type="button" data-km="preview">PDF herunterladen</button><button class="btn btn-outline" type="button" data-km="preview" data-mail="1">Per E-Mail</button></div></div>
      <div class="km-box"><strong>Kreditmappe für die Bank</strong><span>Mit Echtheits-QR und Prüfsumme, versioniert. Nach Freischaltung.</span>
        <div class="km-actions"><button class="btn btn-dark" type="button" data-km="final">PDF herunterladen</button><button class="btn btn-outline" type="button" data-km="final" data-mail="1">Per E-Mail</button></div></div>
    </div>
    <p class="form-note">Fehlende Angaben (z. B. Zinsbindung) ergänzen Sie beim Objekt unter „Bearbeiten“ → „Angaben für die Kreditmappe“.</p>`;
}

function bindKm(d) {
  const box = $('kmCard'); if (!box) return;
  const draw = () => {
    box.querySelectorAll('[data-kmdoc]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.kmdoc === KM.doc)));
    box.querySelectorAll('[data-kmway]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.kmway === KM.way)));
    $('kmBody').innerHTML = kmBody(d); msg('');
    wire();
  };
  const msg = (t, cls = '') => { const m = $('kmMsg'); if (m) { m.className = `km-msg ${cls}`; m.innerHTML = t; } };
  const token = () => { try { return JSON.parse(localStorage.getItem('immoadv-auth-session-v1') || 'null')?.access_token || ''; } catch { return ''; } };
  const openForm = () => {
    const det = document.querySelector('#objectForm .obj-more'); if (det) det.open = true;
    const f = document.getElementById('objName'); if (f) { f.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => f.focus({ preventScroll: true }), 300); }
  };
  const wire = () => {
    $('kmAdd')?.addEventListener('click', (e) => { e.preventDefault(); openForm(); });
    $('kmManual')?.addEventListener('click', () => {
      if (KM.doc === 'km') openForm();
      else location.hash = 'suche';
    });
    box.querySelectorAll('[data-an]').forEach((b) => b.onclick = () => {
      const o = (d.objects || []).find((x) => x.id === $('kmObj')?.value); if (!o) return;
      try { sessionStorage.setItem('ia-analyse-load', JSON.stringify({ o, then: b.dataset.an === 'open' ? null : b.dataset.an })); } catch { /* ohne Speicher */ }
      location.hash = 'suche';
    });
    box.querySelectorAll('[data-km]').forEach((b) => b.onclick = async () => {
      const kind = b.dataset.km, mail = b.dataset.mail === '1', objectId = $('kmObj')?.value;
      if (!objectId) return;
      box.querySelectorAll('[data-km]').forEach((x) => { x.disabled = true; });
      msg(mail ? 'Wird erstellt und gesendet …' : 'Wird erstellt …');
      try {
        const r = await fetch(kind === 'final' ? '/api/kreditmappe' : '/api/kreditmappe/preview', { method: 'POST', headers: { Authorization: 'Bearer ' + token(), 'content-type': 'application/json' }, body: JSON.stringify({ objectId, email: mail }) });
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          const more = r.status === 402 || j.code === 'not_yet' ? ' <a class="ck-link" href="#angebot">Angebote ansehen</a>' : '';
          throw Object.assign(new Error(j.error || 'Das hat nicht geklappt.'), { more });
        }
        if (mail) { const j = await r.json(); msg(`Gesendet an ${esc(j.sentTo || 'Ihre E-Mail-Adresse')}. Bitte auch im Spam-Ordner nachsehen.`, 'ok'); return; }
        const ver = r.headers.get('X-Document-Version'), sha = r.headers.get('X-Document-SHA256') || '';
        const blob = await r.blob(), a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = kind === 'final' ? `ImmoAdv_Kreditmappe${ver ? '_v' + ver : ''}.pdf` : 'ImmoAdv_Kreditmappe_Vorschau.pdf';
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 8000);
        msg(kind === 'final' ? `Kreditmappe${ver ? ' Version ' + esc(ver) : ''} erstellt.${sha ? ' Prüfsumme: ' + esc(sha.slice(0, 16)) + '…' : ''}` : 'Vorschau erstellt. Prüfen Sie Ihre Angaben – für die Bank ist die freigeschaltete Kreditmappe gedacht.', 'ok');
      } catch (e) { msg(esc(e.message) + (e.more || ''), 'bad'); }
      finally { box.querySelectorAll('[data-km]').forEach((x) => { x.disabled = false; }); }
    });
  };
  box.querySelectorAll('[data-kmdoc]').forEach((b) => b.onclick = () => { KM.doc = b.dataset.kmdoc; draw(); });
  box.querySelectorAll('[data-kmway]').forEach((b) => b.onclick = () => { KM.way = b.dataset.kmway; draw(); });
  draw();
}

// Konto: Tarif, Rechnungen (PDF, beliebig oft), Tarif wechseln, Zahlungsmittel, Kündigen.
async function renderFin() {
  const box = $('finBody'); if (!box) return;
  const token = (() => { try { return JSON.parse(localStorage.getItem('immoadv-auth-session-v1') || 'null')?.access_token || ''; } catch { return ''; } })();
  const H = { Authorization: 'Bearer ' + token };
  let cfg = { enabled: false }, st = { tier: 'free' }, inv = { invoices: [] };
  try { cfg = await fetch('/api/billing/config', { cache: 'no-store' }).then((r) => r.json()); } catch { /* aus */ }
  if (cfg.enabled) {
    [st, inv] = await Promise.all([
      fetch('/api/billing/status', { headers: H, cache: 'no-store' }).then((r) => r.json()).catch(() => ({ tier: 'free' })),
      fetch('/api/billing/invoices', { headers: H, cache: 'no-store' }).then((r) => r.json()).catch(() => ({ invoices: [] })),
    ]);
  }
  const tierName = { free: 'Kostenlos', starter: 'Einsteiger', pro: 'Profi' }[st.tier || 'free'] || 'Kostenlos';
  const until = st.pro ? st.proUntil : st.starter ? st.starterUntil : null;
  const money = (c, cur = 'eur') => (Number(c || 0) / 100).toLocaleString('de-DE', { style: 'currency', currency: String(cur).toUpperCase() });
  const dte = (x) => (x ? new Date(x).toLocaleDateString('de-DE') : '–');
  const list = Array.isArray(inv.invoices) ? inv.invoices : [];
  box.innerHTML = `${CHECKOUT === 'success' ? '<p class="auth-message success">Vielen Dank – Ihre Zahlung wurde übermittelt. Die Rechnung erscheint unten und kommt per E-Mail.</p>' : CHECKOUT === 'cancel' ? '<p class="form-note">Bezahlung abgebrochen – es wurde nichts berechnet.</p>' : ''}<div class="fin-grid">
    <div class="fin-box"><small>Ihr Tarif</small><strong>${tierName}</strong><span>${until ? `aktiv bis ${dte(until)}` : st.tier === 'free' ? 'Suche, Analyse und Rechner kostenlos' : ''}${st.creditMaps ? ` · Kreditmappen: ${Math.max(0, (st.creditMaps || 0) - (st.creditMapsUsed || 0))} frei` : ''}</span></div>
    <div class="fin-actions">
      <a class="btn btn-dark" href="#angebot">${st.tier === 'free' ? 'Tarif buchen' : 'Upgrade / Tarife ansehen'}</a>
      <button class="btn btn-outline" type="button" data-flow="update"${cfg.enabled && st.tier !== 'free' ? '' : ' disabled'}>Tarif wechseln</button>
      <button class="btn btn-outline" type="button" data-flow="payment"${cfg.enabled && st.hasCustomer ? '' : ' disabled'}>Zahlungsmittel ändern</button>
      <button class="btn btn-outline fin-cancel" type="button" data-flow="cancel"${cfg.enabled && st.tier !== 'free' ? '' : ' disabled'}>Abo kündigen</button>
    </div></div>
    ${cfg.enabled ? '' : '<p class="form-note">Die Zahlungsabwicklung startet in Kürze. Danach können Sie hier Tarife wechseln, Zahlungsmittel ändern, kündigen und alle Rechnungen herunterladen.</p>'}
    <h4 class="fin-h">Rechnungen</h4>
    ${list.length ? `<ul class="fin-list">${list.map((i) => `<li><div><strong>${esc(i.number || 'Rechnung')}</strong><span>${dte(i.date)} · ${money(i.total, i.currency)}${i.status === 'open' ? ' · <b class="st warn">offen</b>' : ' · bezahlt'}${i.description ? ` · ${esc(i.description.slice(0, 60))}` : ''}</span></div>${i.pdf ? `<a class="btn btn-outline" href="${esc(i.pdf)}" target="_blank" rel="noopener noreferrer">PDF herunterladen</a>` : ''}</li>`).join('')}</ul>` : '<p class="form-note">Noch keine Rechnungen.</p>'}
    <p class="form-note">Rechnungen können Sie jederzeit erneut herunterladen. Kündigen geht auch ohne Anmeldung über <a class="ck-link" href="/kuendigen">„Verträge hier kündigen“</a>.</p>
    <p class="fin-msg" id="finMsg" role="status" aria-live="polite"></p>`;
  box.querySelectorAll('[data-flow]').forEach((b) => b.onclick = async () => {
    b.disabled = true; const m = $('finMsg'); m.textContent = 'Wird geöffnet …';
    try {
      const r = await fetch('/api/billing/portal', { method: 'POST', headers: { ...H, 'content-type': 'application/json' }, body: JSON.stringify({ flow: b.dataset.flow }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.url) throw Error(j.error || 'Konnte nicht geöffnet werden.');
      location.href = j.url;
    } catch (e) { m.textContent = e.message; b.disabled = false; }
  });
}

function startCard(mode, d) {
  const done = Object.values(d.progress?.lern || {}).filter(Boolean).length;
  if (!d.profile?.mode && !new URLSearchParams(location.search).get('modus')) {
    return `<article class="dash-card wide start-card" data-view="start"><h3>Willkommen! Wo stehen Sie gerade?</h3><p class="form-note">Sie können jederzeit wechseln – oben rechts.</p>
      <div class="mode-pick"><button class="mode-card" type="button" data-pick="einsteiger"><span class="mode-tag">Einsteiger</span><strong>Ich fange gerade an</strong><span>Lernpfad, Erklärungen, Schritt für Schritt zur Finanzierung.</span></button>
      <button class="mode-card pro" type="button" data-pick="profi"><span class="mode-tag">Profi</span><strong>Ich investiere schon</strong><span>Cockpit mit Kennzahlen, Portfolio, Datenraum.</span></button></div></article>`;
  }
  const ph = phaseOf(d);
  const extra = mode === 'profi' ? [['/rechner/vergleich', 'Angebote vergleichen', 'Bis zu drei nebeneinander']] : [['#lernen', 'Wissen auffrischen', `${done} von ${LERN.length} Themen verstanden`]];
  const actions = [...PHASES[ph.idx].actions, ...extra];
  return `<article class="dash-card wide start-card" data-view="start">${phasePicker(ph.idx, ph.chosen)}<div class="quick">${actions.map(([h, t, s]) => `<a class="quick-a" href="${h}"><strong>${t}</strong><span>${s}</span></a>`).join('')}</div></article>`;
}

function bindStart(mode, d, u, saveData, reload) {
  document.querySelectorAll('[data-phase]').forEach((b) => b.onclick = async () => {
    d.profile = { ...(d.profile || {}), phase: Number(b.dataset.phase) };
    b.closest('.ph-pick')?.querySelectorAll('.ph-btn').forEach((x) => x.classList.toggle('on', x === b));
    try { await saveData(u, d); } catch { /* weiter */ }
    reload();
  });
  document.querySelectorAll('[data-pick]').forEach((b) => b.onclick = async () => {
    d.profile = { ...(d.profile || {}), mode: b.dataset.pick };
    try { await saveData(u, d); } catch { /* weiter */ }
    reload();
  });
}

function lernTopics(st, rec = [], recName = '') {
  const groups = [...new Set(LERN.map((x) => x[5]))];
  const one = ([id, t, sub]) => `
    <details class="lt${st[id] ? ' done' : ''}" data-topic="${id}">
      <summary><span class="lt-title"><strong>${t}</strong><span>${sub}</span></span><span class="lt-state">${st[id] ? '✓ verstanden' : ''}</span></summary>
      <div class="lt-body" data-body="${id}"><p class="form-note">Wird geladen …</p></div>
    </details>`;
  const recT = rec.map((id) => LERN.find((x) => x[0] === id)).filter(Boolean);
  const head = recT.length ? `<h4 class="lt-group lt-rec">Empfohlen für Ihre Phase: ${recName}</h4>${recT.map(one).join('')}` : '';
  return head + groups.map((g) => { const items = LERN.filter((x) => x[5] === g && !rec.includes(x[0])); return items.length ? `<h4 class="lt-group">${g}</h4>${items.map(one).join('')}` : ''; }).join('');
}

function lernCard(mode, d) {
  const st = d.progress?.lern || {};
  const n = LERN.filter(([id]) => st[id]).length;
  const head = mode === 'profi'
    ? `<h3>Werkzeuge und Wissen</h3><div class="quick">${PROFI.map(([t, h]) => `<a class="quick-a" href="${h}"><strong>${t}</strong></a>`).join('')}</div>
       <h3 class="lt-h">Wissen auffrischen</h3><p class="form-note">Themen antippen, Fragen lesen, bei Bedarf „Mehr erklären“.</p>`
    : `<h3>Wissen: wählen Sie, was Sie interessiert</h3>
       <p class="form-note">Keine feste Reihenfolge – frischen Sie auf, was Sie gerade brauchen. Thema antippen, Fragen lesen, danach als verstanden markieren.</p>`;
  return `<article class="dash-card wide" data-view="lernen" id="lernView">${head}
    <div class="lp-bar" role="progressbar" aria-label="Verstandene Themen" aria-valuenow="${n}" aria-valuemin="0" aria-valuemax="${LERN.length}"><span style="width:${Math.round((n / LERN.length) * 100)}%"></span></div>
    <p class="form-note" id="lpNote">${n} von ${LERN.length} Themen verstanden.</p>
    <div class="lt-list">${lernTopics(st, PHASES[phaseOf(d).idx].lern, PHASES[phaseOf(d).idx].name)}</div></article>`;
}

let FAQ = null;
const escH = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lnk = (t) => escH(t).replace(/https:\/\/[^\s<]*[^\s<.,;)]/g, (u) => `<a class="ck-link" href="${u}" target="_blank" rel="noopener noreferrer">${u.replace(/^https:\/\/(www\.)?/, '')}</a>`);
const slugQ = (q) => { let t = q.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); if (t.length > 70) { t = t.slice(0, 70); t = t.slice(0, t.lastIndexOf('-') > 30 ? t.lastIndexOf('-') : 70); } return t; };

function fillTopic(id, d) {
  const box = document.querySelector(`[data-body="${id}"]`);
  const topic = LERN.find((x) => x[0] === id);
  if (!box || !topic || !FAQ || box.dataset.ready) return;
  box.dataset.ready = '1';
  const [, , , idx, [toolText, toolHref]] = topic;
  const done = !!d.progress?.lern?.[id];
  box.innerHTML = `${idx.map((i) => FAQ[i]).filter(Boolean).map((q, k) => `<div class="lt-qa">
      <p class="lt-q">${escH(q.question)}</p>
      <p class="lt-a">${lnk(q.level1)}</p>
      <div class="lt-more" id="more-${id}-${k}" hidden><p>${lnk(q.level2)}</p>${q.nextStep ? `<p class="lt-next"><strong>Nächster Schritt:</strong> ${lnk(q.nextStep)}</p>` : ''}<a class="ck-link" href="/wissen/${slugQ(q.question)}">Ganze Seite öffnen →</a></div>
      <button class="lt-mini" type="button" data-more="more-${id}-${k}" aria-expanded="false" aria-controls="more-${id}-${k}">Mehr erklären</button>
    </div>`).join('')}
    <div class="lt-actions"><a class="btn btn-outline" href="${toolHref}"${/^https:/.test(toolHref) ? ' target="_blank" rel="noopener noreferrer"' : ''}>${toolText}${/^https:/.test(toolHref) ? ' öffnen ↗' : ' ausprobieren'}</a>
      <button class="btn ${done ? 'btn-outline' : 'btn-dark'}" type="button" data-done="${id}">${done ? 'Als offen markieren' : '✓ Verstanden'}</button></div>`;
}

function bindLern(d, u, saveData) {
  const ensure = async () => { if (FAQ) return; try { FAQ = (await fetch('/data/faq.json').then((r) => r.json())).entries; } catch { FAQ = []; } };
  document.querySelectorAll('details.lt').forEach((det) => det.addEventListener('toggle', async () => { if (!det.open) return; await ensure(); fillTopic(det.dataset.topic, d); }));
  const view = $('lernView');
  if (!view) return;
  view.addEventListener('click', async (e) => {
    const more = e.target.closest('[data-more]');
    if (more) { const el = $(more.dataset.more); const open = el.hidden; el.hidden = !open; more.setAttribute('aria-expanded', String(open)); more.textContent = open ? 'Weniger' : 'Mehr erklären'; return; }
    const btn = e.target.closest('[data-done]');
    if (!btn) return;
    const id = btn.dataset.done, val = !d.progress?.lern?.[id];
    d.progress = { ...(d.progress || {}), lern: { ...(d.progress?.lern || {}), [id]: val } };
    const det = btn.closest('details.lt');
    det.classList.toggle('done', val);
    det.querySelector('.lt-state').textContent = val ? '✓ verstanden' : '';
    btn.textContent = val ? 'Als offen markieren' : '✓ Verstanden';
    btn.className = `btn ${val ? 'btn-outline' : 'btn-dark'}`;
    if (val) det.open = false;
    const n = LERN.filter(([k]) => d.progress.lern[k]).length;
    const bar = view.querySelector('.lp-bar span'); if (bar) bar.style.width = `${Math.round((n / LERN.length) * 100)}%`;
    view.querySelector('.lp-bar')?.setAttribute('aria-valuenow', String(n));
    $('lpNote').textContent = `${n} von ${LERN.length} Themen verstanden.${n === LERN.length ? ' Stark – der Profi-Modus passt jetzt zu Ihnen.' : ''}`;
    try { await saveData(u, d); } catch { /* nächster Speichervorgang holt es nach */ }
  });
}

async function renderOffers(mode) {
  const box = $('offerBody');
  const token = (() => { try { return JSON.parse(localStorage.getItem('immoadv-auth-session-v1') || 'null')?.access_token || ''; } catch { return ''; } })();
  let P, st, cfg;
  try {
    [P, cfg] = await Promise.all([fetch('/data/preise.json').then((r) => r.json()), fetch('/api/billing/config', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({ enabled: false }))]);
    st = cfg.enabled ? await fetch('/api/billing/status', { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' }).then((r) => r.json()) : { tier: 'free' };
  } catch { box.innerHTML = '<p class="auth-message error">Angebote konnten nicht geladen werden.</p>'; return; }
  const tier = st.tier || (st.pro ? 'pro' : 'free');
  let shown = mode === 'profi' ? 'profi' : 'einsteiger';
  // Nächster sinnvoller Schritt je Buchung und Modus
  const next = tier === 'pro' ? null : tier === 'starter' ? (shown === 'profi' ? 'pro-monthly' : 'credit-map-starter') : shown === 'profi' ? 'pro-monthly' : 'starter-monthly';
  const tierName = { free: 'Kostenlos', starter: 'Einsteiger', pro: 'Profi' }[tier];
  const draw = () => {
    const m = P.modi[shown];
    box.innerHTML = `<div class="offer-head"><div><span class="form-note">Ihr Tarif</span><strong>${tierName}</strong></div>
      <div class="seg" role="tablist"><button type="button" role="tab" data-seg="einsteiger" aria-selected="${shown === 'einsteiger'}">Einsteiger</button><button type="button" role="tab" data-seg="profi" aria-selected="${shown === 'profi'}">Profi</button></div></div>
      <p class="form-note">${esc(m.zielgruppe)}</p>
      ${tier === 'pro' ? '<p class="auth-message">Profi ist aktiv – alle Funktionen und Kreditmappen sind enthalten.</p>' : ''}
      <div class="offers">${m.plans.map((p) => `<div class="offer${p.id === next ? ' rec' : ''}">${p.id === next ? '<span class="offer-rec">Empfohlener nächster Schritt</span>' : ''}<h4>${esc(p.name)}</h4><div class="offer-price">${E(p.cents)} <small>${esc(p.intervall)}</small></div><ul>${p.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
        ${cfg.enabled ? `<button class="btn ${p.id === next ? 'btn-dark' : 'btn-outline'}" type="button" data-buy="${p.id}"${(tier === 'pro' && shown === 'profi' && p.id !== 'credit-map') || (p.id === 'credit-map-starter' && tier !== 'starter') ? ' disabled' : ''}>${p.id === 'credit-map-starter' && tier !== 'starter' ? 'Mit Einsteiger-Begleitung' : 'Weiter zur Bezahlung'}</button>` : '<button class="btn btn-outline" type="button" disabled>Buchung startet in Kürze</button>'}</div>`).join('')}</div>
      <div class="offer-free"><strong>Immer kostenlos:</strong> ${P.kostenlos.features.map(esc).join(' · ')}</div>
      <p class="form-note">Makler, Vermittler oder Bank? <a class="ck-link" href="/b2b-portal">Unternehmensportal</a> mit Widget, QR-Codes und Anfragen (Tarife netto, <a class="ck-link" href="/b2b">Übersicht</a>).</p>
      ${cfg.enabled ? '<label class="consent"><input type="checkbox" id="offerConsent"> Ich verlange ausdrücklich, dass ImmoAdv vor Ablauf der Widerrufsfrist mit der Leistung beginnt. Mir ist bekannt, dass mein Widerrufsrecht bei digitalen Inhalten damit erlischt und ich bei einem Widerruf eines Abos Wertersatz für bereits erbrachte Leistungen schulde.</label><p class="form-note">Es gelten die <a class="ck-link" href="/nutzungsbedingungen">Nutzungsbedingungen</a> mit <a class="ck-link" href="/nutzungsbedingungen#widerruf">Widerrufsbelehrung</a>. Die Bestellung schließen Sie auf der folgenden Bezahlseite ab.</p>' : ''}
      <p class="form-note">${esc(P.hinweis)} Es gelten die <a class="ck-link" href="/nutzungsbedingungen">Nutzungsbedingungen mit Widerrufsbelehrung</a>. Kündigung jederzeit über <a class="ck-link" href="/kuendigen">„Verträge hier kündigen“</a>.</p>`;
    box.querySelectorAll('[data-seg]').forEach((b) => b.onclick = () => { shown = b.dataset.seg; draw(); });
    // Aus der öffentlichen Angebotsseite vorgewählter Tarif: zur Karte springen und hervorheben.
    const want = new URLSearchParams(location.search).get('buy');
    if (want) { const card = box.querySelector(`[data-buy="${CSS.escape(want)}"]`)?.closest('.offer'); if (card) { card.classList.add('offer-want'); card.scrollIntoView({ behavior: 'smooth', block: 'center' }); } }
    box.querySelectorAll('[data-buy]').forEach((b) => b.onclick = async () => {
      if (!$('offerConsent')?.checked) { $('offerConsent')?.closest('label')?.classList.add('consent-missing'); $('offerConsent')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); alert('Bitte zuerst der sofortigen Bereitstellung zustimmen.'); return; }
      b.disabled = true;
      try {
        const r = await fetch('/api/billing/checkout', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify({ plan: b.dataset.buy, consent: true }) });
        const j = await r.json(); if (!r.ok) throw Error(j.error || 'Checkout fehlgeschlagen.');
        location.href = j.url;
      } catch (e) { alert(e.message); b.disabled = false; }
    });
  };
  draw();
}
