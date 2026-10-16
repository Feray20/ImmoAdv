// App-Rahmen für das Konto: Handy wie eine App (Tab-Leiste unten), Desktop wie ein Investment-Tool (Seitenleiste).
// Ansichten über #hash; vorhandene Karten werden den Ansichten zugeordnet. Modus Einsteiger/Profi frei wählbar.
import { openBuy, PAY_BADGES, resumeIntent } from './buy.mjs';
import { rank, GREST } from './calc.mjs';
const GREST_KEYS = Object.keys(GREST);

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
  ['geld', 'Wie funktioniert Geld?', 'Wie Geld entsteht, was Inflation mit Ihrem Geld macht, warum sich Investieren lohnt und wie Vermögen wächst.', [37, 38, 39, 40, 41, 42, 43], ['Kaufen oder mieten?', '/rechner/kaufen-mieten'], 'Geld & Vermögen'],
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
  { name: 'Orientieren', plan: 'Erst verstehen, wie Geld, Eigenkapital und Finanzierung funktionieren – dann wissen Sie, was Sie sich leisten können.', steuer: 'kauf', lern: ['geld', 'budget', 'eigenkapital', 'annuitaet', 'beruf'],
    actions: [['/rechner/budget', 'Budget berechnen', 'Was kann ich mir leisten?'], ['#lernen', 'Grundlagen auffrischen', 'Eigenkapital, Zins, Tilgung'], ['#suche', 'Immobilien ansehen', 'Suche bei den großen Portalen']] },
  { name: 'Objekte prüfen', plan: 'Lernen Sie, Angebote wie ein Profi zu lesen: Rendite, Cashflow, Zustand und was die Bank vom Objekt hält.', steuer: 'kauf', lern: ['suche', 'etw', 'cashflow', 'beleihung'],
    actions: [['#suche', 'Objekt analysieren', 'Inserat übernehmen, Kennzahlen sehen'], ['#objekte', 'Objekte im Konto', 'Anlegen, vergleichen, Bankreife'], ['#steuer', 'Steuern beim Kauf', 'Kaufkosten, Inventar, AfA']] },
  { name: 'Bankgespräch', plan: 'Bereiten Sie sich auf die Bank vor: Unterlagen, Beleihungswert und wie Ihr Beruf bewertet wird.', steuer: 'kauf', lern: ['unterlagen', 'beruf', 'beleihung', 'annuitaet'],
    actions: [['#objekte', 'Kreditmappe erstellen', 'Objekt wählen → Vorschau → PDF'], ['/checkliste', 'Unterlagen vollständig machen', 'Bankreife auf 90 % bringen'], ['#lernen', 'Was die Bank prüft', 'Beleihungswert, Unterlagen']] },
  { name: 'Bestand', plan: 'Ihre Immobilie gut führen: Steuern, Mietrecht, Fristen und was tun, wenn die Miete ausbleibt.', steuer: 'halten', lern: ['steuer', 'miete', 'mahnung', 'fristen'],
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
  if (id === 'rankCard') return 'start';
  if (['termineCard', 'pendingCard'].includes(id) || el.classList.contains('req-card')) return 'start';
  if (id === 'portfolioCard') return mode === 'profi' ? 'start objekte' : 'objekte';
  if (['docsCard', 'bankreifeCard'].includes(id) || h === 'Objekte') return 'objekte';
  if (id === 'billingCard') return 'none'; // ersetzt durch „Tarif & Rechnungen“ (finCard)
  if (id === 'accountCard' || h === 'Finanzprofil') return 'konto';
  if (h === 'Weiter') return 'none';
  return 'start';
}

export function setupApp({ u, d, saveData, reload }) {
  // Kaufwunsch von der Angebotsseite (vor der Anmeldung gemerkt): direkt weiter zur Bezahlseite.
  resumeIntent((t) => alert(t));
  const reloadFull = reload;
  reload = () => { document.body.classList.add('ia-switching'); reloadFull({ u, d }); };
  requestAnimationFrame(() => document.body.classList.remove('ia-switching'));
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
    <div class="app-side-foot"><span class="app-user">${esc(u.email)}</span><button class="text-btn" id="appLogout" type="button">Abmelden</button></div></nav>`);
  const main = app.querySelector('main');
  main.insertAdjacentHTML('afterbegin', `<div class="app-top"><a class="brand app-top-brand" href="/"><img class="brand-logo" src="/logo-icon.svg" alt="" width="30" height="26"><span>Immo<span>Adv</span></span></a><h1 id="appTitle"></h1>
    <button class="mode-chip" id="modeChip" type="button" aria-label="Modus wechseln">${mode === 'profi' ? 'Profi' : 'Einsteiger'} <span aria-hidden="true">⇄</span></button></div>`);
  app.insertAdjacentHTML('beforeend', `<nav class="app-tabs" aria-label="Schnellnavigation">${TABS.map((k) => `<a class="app-tab" data-go="${k}" href="#${k}">${svg(k)}<span>${views.find((v) => v[0] === k)[1].split(' ')[0]}</span></a>`).join('')}</nav>`);
  $('appLogout').onclick = () => document.getElementById('logout')?.click();
  $('modeChip').onclick = async () => {
    d.profile = { ...(d.profile || {}), mode: mode === 'profi' ? 'einsteiger' : 'profi' };
    saveData(u, d).catch(() => { /* wird beim nächsten Speichern nachgeholt */ });
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
      <p class="form-note">Ihr Passwort können Sie im Browser bzw. im iPhone-Schlüsselbund speichern lassen – beim Anmelden einfach „Passwort sichern“ bestätigen.</p>
      <h4 class="mfa-h">Zwei-Faktor-Schutz (Authenticator-App)</h4><div id="mfaBox"><p class="form-note">Wird geladen …</p></div></article>`);
    import('/src/mfa.mjs').then((m) => m.manageUI($('mfaBox'))).catch(() => { const b = $('mfaBox'); if (b) b.textContent = 'Konnte nicht geladen werden.'; });
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
  bindKm(d, u, saveData, reload);
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

// ImmoAdv Studio (Bereich Objekte): Produkt wählen – BankReady (Kreditmappe) oder RenditeRadar (Objekt-Analyse) –
// und wie die Daten kommen: AutoPilot (Exposé-PDF hochladen, Link eintragen oder gespeichertes Objekt – ImmoAdv
// rechnet alles automatisch) oder Manuell (online eintragen oder PDF-Formular herunterladen, ausfüllen, wieder hochladen).
// Das Ergebnis erscheint zuerst als PDF auf dem Bildschirm und kann dann heruntergeladen werden.
let KM = { doc: 'km', way: 'auto' };
// Rückkehr aus dem Checkout (wird beim Laden des Moduls gelesen, bevor die Adresse bereinigt wird).
const CHECKOUT = new URLSearchParams(location.search).get('checkout');
// Nach einem Kauf den Navigationsstatus neu laden (Zur Anwendung / App-Leiste).
if (CHECKOUT === 'success') { try { localStorage.removeItem('ia-access'); } catch { /* ignore */ } }
const PROD = {
  km: { name: 'BankReady', sub: 'Kreditmappe für die Bank', form: 'kreditmappe' },
  an: { name: 'RenditeRadar', sub: 'Objekt-Analyse in Sekunden', form: 'analyse' },
};
// Zahlender Kunde? (Tarif, Unternehmenskonto, Admin) – sonst kostenlose Demo mit Wasserzeichen auf PDFs.
let ACCESS = null;
const getAccess = () => (ACCESS ||= fetch('/api/me/access', { headers: { Authorization: 'Bearer ' + sessToken() }, cache: 'no-store' }).then((r) => (r.ok ? r.json() : { paid: false })).catch(() => ({ paid: false })));
const DEMO_NOTE = 'Kostenlose Demo: PDFs tragen ein ImmoAdv-Wasserzeichen. Mit einem Abo bzw. gebuchten Tarif entfällt es.';
const sessToken = () => { try { return JSON.parse(localStorage.getItem('immoadv-auth-session-v1') || 'null')?.access_token || ''; } catch { return ''; } };
// Darlehen, wenn nicht angegeben: Kaufpreis + Nebenkosten − Eigenkapital (mindestens 0).
const autoLoan = (o) => Math.max(0, Math.round(Number(o.price) * (1 + (Number(o.purchaseCostPct) || 0) / 100) - (Number(o.equity) || 0)));
const newObjId = () => { const b = new Uint8Array(6); crypto.getRandomValues(b); return 'o' + [...b].map((x) => x.toString(16).padStart(2, '0')).join(''); };
// Analyse-Modul (Suche) bei Bedarf laden – AutoPilot nutzt denselben Rechenweg wie die Analyse.
async function objektModule() {
  const v = $('sucheView');
  const m = await import('/src/objekt-ui.mjs');
  if (v && !v.dataset.ready) { v.dataset.ready = '1'; m.mountObjekt(v, { pdf: true }); }
  return m;
}
const fileName = (r, fallback) => { const m = /filename\*=UTF-8''([^;]+)|filename="([^"]+)"/.exec(r.headers.get('content-disposition') || ''); return m ? decodeURIComponent(m[1] || m[2]) : fallback; };

function kmCard() {
  return `<article class="dash-card wide km-card" data-view="objekte" id="kmCard">
    <div class="studio-head"><h3>ImmoAdv Studio</h3><p class="form-note">Produkt wählen – und entscheiden, ob ImmoAdv alles automatisch erledigt oder Sie selbst eintragen.</p></div>
    <div class="studio-prod" role="tablist" aria-label="Produkt">${Object.entries(PROD).map(([k, p]) => `<button type="button" role="tab" data-kmdoc="${k}"><strong>${p.name}</strong><small>${p.sub}</small></button>`).join('')}</div>
    <div class="seg studio-way" role="tablist" aria-label="Weg"><button type="button" role="tab" data-kmway="auto"><strong>AutoPilot</strong><small>Exposé oder Link – ImmoAdv rechnet</small></button><button type="button" role="tab" data-kmway="man"><strong>Manuell</strong><small>Online oder per PDF-Formular</small></button></div>
    <p class="demo-hint" id="kmDemo" hidden></p><div id="kmBody"></div><p class="km-msg" id="kmMsg" role="status" aria-live="polite"></p><div id="kmRes"></div></article>`;
}

function kmBody(d) {
  const os = (Array.isArray(d.objects) ? d.objects : []).filter((o) => o && o.id);
  const km = KM.doc === 'km', P = PROD[KM.doc];
  if (KM.way === 'man') {
    return `<div class="km-grid">
      <div class="km-box"><strong>Online eintragen</strong><span>${km ? 'Alle Angaben direkt auf der Website eintragen (Objekt und „Angaben für die Kreditmappe“). Danach erstellt BankReady die Kreditmappe per AutoPilot aus dem gespeicherten Objekt.' : 'Kaufpreis, Miete, Kosten und Finanzierung im Analyse-Formular eintragen – RenditeRadar rechnet jede Kennzahl sofort mit.'}</span>
        <div class="km-actions"><button class="btn btn-dark" type="button" id="kmManual">${km ? 'Formular öffnen' : 'Analyse-Formular öffnen'}</button></div></div>
      <div class="km-box"><strong>PDF-Formular</strong><span>Formular herunterladen, am Handy oder Computer ausfüllen (z. B. Acrobat Reader, Dateien-App, Vorschau), speichern und hier wieder hochladen – ${P.name} übernimmt alle Werte automatisch.</span>
        <div class="km-actions"><button class="btn btn-dark" type="button" id="kmFormGet">Formular ansehen &amp; herunterladen</button><label class="btn btn-outline km-file">Ausgefülltes PDF hochladen<input type="file" accept="application/pdf,.pdf" id="kmFormUp" hidden></label></div>
        <small class="form-note">Handschriftlich ausgefüllte Scans können nicht automatisch gelesen werden.</small></div>
    </div>`;
  }
  return `<div class="km-grid">
    <div class="km-box"><strong>Exposé hochladen</strong><span>PDF vom Makler oder Portal – ${P.name} liest Kaufpreis, Miete, Fläche, Baujahr und mehr aus und ${km ? 'erstellt die Kreditmappe' : 'rechnet alle Kennzahlen'} automatisch.</span>
      <div class="km-actions"><label class="btn btn-dark km-file">Exposé-PDF wählen<input type="file" accept="application/pdf,.pdf" id="kmPdf" hidden></label></div></div>
    <div class="km-box"><strong>Link eintragen</strong><span>Link zum Exposé-PDF oder zur Seite des Anbieters. Für ImmoScout24, Immowelt und Kleinanzeigen nutzen Sie die <a class="ck-link" href="#suche">Ein-Klick-Übernahme</a> oder das Exposé-PDF.</span>
      <form class="km-link" id="kmLinkF"><input type="url" id="kmLink" inputmode="url" autocomplete="off" placeholder="https://…" aria-label="Link zum Exposé" required><button class="btn btn-dark" type="submit">Auswerten</button></form></div>
    ${os.length ? `<div class="km-box"><strong>Aus meinen Objekten</strong><span>Gespeichertes Objekt wählen – ${P.name} erstellt das Dokument aus Ihren Angaben.</span>
      <label class="km-pick">Objekt<select id="kmObj">${os.map((o) => `<option value="${esc(o.id)}">${esc(o.name || 'Objekt')}</option>`).join('')}</select></label>
      <div class="km-actions"><button class="btn btn-dark" type="button" id="kmGo">${km ? 'Kreditmappe erstellen' : 'Analyse erstellen'}</button></div></div>` : ''}
  </div>
  ${km && !(Number(d.profile?.netIncome) > 0) ? '<p class="form-note">Tipp: Für die Haushaltsrechnung der Kreditmappe im Finanzprofil das Nettoeinkommen eintragen.</p>' : ''}`;
}

function bindKm(d, u, saveData, reload) {
  const box = $('kmCard'); if (!box) return;
  const msg = (t, cls = '') => { const m = $('kmMsg'); if (m) { m.className = `km-msg ${cls}`; m.innerHTML = t; } };
  const res = (h) => { const r = $('kmRes'); if (r) r.innerHTML = h; };
  const draw = () => {
    box.querySelectorAll('[data-kmdoc]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.kmdoc === KM.doc)));
    box.querySelectorAll('[data-kmway]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.kmway === KM.way)));
    $('kmBody').innerHTML = kmBody(d); msg(''); res('');
    wire();
  };
  const openForm = () => {
    const det = document.querySelector('#objectForm .obj-more'); if (det) det.open = true;
    const f = document.getElementById('objName'); if (f) { f.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => f.focus({ preventScroll: true }), 300); }
  };
  const land = () => { try { const s = JSON.parse(localStorage.getItem('ia-objekt-v1') || '{}'); return GREST_KEYS.includes(s.a_land) ? s.a_land : GREST_KEYS.includes(s.s_land) ? s.s_land : 'hessen'; } catch { return 'hessen'; } };
  const mainBtns = () => box.querySelectorAll('button, .km-file, input');
  const busy = (on) => mainBtns().forEach((x) => { if ('disabled' in x) x.disabled = on; x.classList?.toggle('is-busy', on); });

  // ---------- Kreditmappe (BankReady) für ein gespeichertes Objekt erzeugen und anzeigen ----------
  async function mappeFor(objectId, w, extraNote = '') {
    const H = { Authorization: 'Bearer ' + sessToken(), 'content-type': 'application/json' };
    let r = await fetch('/api/kreditmappe', { method: 'POST', headers: H, body: JSON.stringify({ objectId }) });
    let preview = false;
    if (!r.ok) {
      const j = await r.clone().json().catch(() => ({}));
      if (r.status === 402 || r.status === 503 || j.code === 'not_yet') {
        preview = true;
        r = await fetch('/api/kreditmappe/preview', { method: 'POST', headers: H, body: JSON.stringify({ objectId }) });
        if (!r.ok) { const k = await r.json().catch(() => ({})); throw Error(k.error || 'Die Kreditmappe konnte nicht erstellt werden.'); }
      } else throw Error(j.error || 'Die Kreditmappe konnte nicht erstellt werden.');
    }
    const ver = r.headers.get('X-Document-Version');
    const blob = await r.blob();
    await w.done('Kreditmappe fertig');
    const { showPdf } = await import('/src/pdf-view.mjs');
    const o = (d.objects || []).find((x) => x.id === objectId);
    showPdf(blob, {
      filename: fileName(r, preview ? 'ImmoAdv_BankReady_Vorschau.pdf' : `ImmoAdv_BankReady${ver ? '_v' + ver : ''}.pdf`),
      title: `BankReady · ${o?.name || 'Kreditmappe'}`,
      note: (preview ? 'Kostenlose Demo: Vorschau mit Wasserzeichen. Mit einem Abo bzw. gebuchten Tarif erhalten Sie die Fassung für die Bank – ohne Wasserzeichen und mit Echtheits-QR. <a class="ck-link" href="#angebot">Tarife ansehen</a>. ' : '') + extraNote,
      onClose: () => reload?.(),
    });
    msg(preview ? 'BankReady-Vorschau erstellt. Fehlende Angaben ergänzen Sie beim Objekt unter „Bearbeiten“.' : `BankReady-Kreditmappe${ver ? ' Version ' + esc(ver) : ''} erstellt.`, 'ok');
  }

  // ---------- Objekt aus Exposé-/Link-Daten anlegen ----------
  function objectFromListing(r) {
    const l = land(), g = GREST[l];
    const area = Number(r.area) || 0;
    const o = {
      id: newObjId(), name: String(r.name || r.title || 'Objekt aus Exposé').slice(0, 160), price: Math.round(r.price), rent: Number(r.rent) || 0, area,
      yearBuilt: Number(r.year) || 0, efficiencyClass: r.energyClass || '', brokerPct: r.brokerPct != null ? Number(r.brokerPct) : 3.57, grestPct: g.pct, notaryPct: 2,
      purchaseCostPct: Math.round((g.pct + 2 + (r.brokerPct != null ? Number(r.brokerPct) : 3.57)) * 100) / 100,
      equity: Number(d.profile?.equity) || 0, interestPct: 3.5, repaymentPct: 2, fixedYears: 10, vacancyPct: 2, maintenance: area ? Math.round(area * 100) / 100 : 0,
      source: r.url || '', createdVia: 'autopilot',
    };
    o.loan = autoLoan(o);
    return o;
  }

  // ---------- Gemeinsamer Ablauf für AutoPilot (Exposé-Text) ----------
  async function runListing(listing, w) {
    if (KM.doc === 'an') {
      const mod = await objektModule();
      await w.step(2);
      const sum = mod.autoAnalyse({ listing });
      await w.step(3);
      const out = await mod.analysePdf(false);
      await w.done('RenditeRadar fertig');
      showResult(sum);
      const { showPdf } = await import('/src/pdf-view.mjs');
      const demo = !(await getAccess()).paid ? DEMO_NOTE + ' ' : '';
      showPdf(out.blob, { filename: out.filename, title: `RenditeRadar · ${sum.name}`, note: demo + (sum.missing.length ? `Nicht im Exposé gefunden: ${esc(sum.missing.join(', '))} – in der Analyse ergänzen.` : '') });
      return;
    }
    const { parseListing } = await import('/src/listing-parse.mjs');
    await w.step(2);
    const r = parseListing(listing);
    if (r.price == null) throw Error('Im Exposé wurde kein Kaufpreis gefunden. Bitte ein einzelnes Kaufangebot verwenden oder die Werte manuell eintragen.');
    const o = objectFromListing(r);
    d.objects = [...(Array.isArray(d.objects) ? d.objects : []), o];
    await saveData(u, d);
    await w.step(3);
    const miss = [...r.missing, ...(Number(d.profile?.netIncome) > 0 ? [] : ['Nettoeinkommen im Finanzprofil'])];
    await mappeFor(o.id, w, `Objekt „${esc(o.name)}“ wurde angelegt (Bundesland ${esc(GREST[land()].name)}, Zins 3,5 %, Tilgung 2 % als Annahme – bitte prüfen).${miss.length ? ' Noch offen: ' + esc(miss.join(', ')) + '.' : ''}`);
  }

  function showResult(sum) {
    const E0 = (x) => (x == null ? '–' : Number(x).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }));
    const Pc = (x) => (x == null ? '–' : `${Number(x).toLocaleString('de-DE', { maximumFractionDigits: 2 })} %`);
    res(`<div class="km-result"><strong>RenditeRadar: ${esc(sum.name)}</strong>
      <div class="km-kpis"><span><small>Kaufpreis</small>${E0(sum.price)}</span><span><small>Bruttorendite</small>${Pc(sum.grossYield)}</span><span><small>Cashflow / Monat</small>${E0(sum.cashflow)}</span><span><small>DSCR</small>${sum.dscr == null ? '–' : Number(sum.dscr).toLocaleString('de-DE', { maximumFractionDigits: 2 })}</span></div>
      <div class="km-actions"><a class="btn btn-outline" href="#suche">In der Analyse ansehen &amp; anpassen</a></div></div>`);
  }

  const wire = () => {
    $('kmManual')?.addEventListener('click', () => { if (KM.doc === 'km') openForm(); else location.hash = 'suche'; });

    // Exposé-PDF (AutoPilot)
    $('kmPdf')?.addEventListener('change', async (e) => {
      const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
      if (f.size > 40 * 1024 * 1024) { msg('Die Datei ist größer als 40 MB.', 'bad'); return; }
      msg(''); busy(true);
      const { work } = await import('/src/loader.mjs');
      const w = work(`${PROD[KM.doc].name} AutoPilot`, ['Exposé öffnen', 'Text erkennen', 'Eckdaten übernehmen', KM.doc === 'km' ? 'Kreditmappe erstellen' : 'Kennzahlen & PDF erstellen']);
      try {
        await w.step(0);
        const mod = await objektModule();
        await w.step(1);
        const t = await mod.exposeText(f);
        if (t.replace(/\s+/g, '').length < 150) throw Error('In diesem PDF ist kein lesbarer Text (vermutlich ein Scan). Bitte die Werte manuell eintragen.');
        await runListing({ u: '', t, ti: f.name.replace(/\.pdf$/i, '') }, w);
      } catch (err) { w.close(); msg(esc(err.message), 'bad'); }
      finally { busy(false); }
    });

    // Link (AutoPilot)
    $('kmLinkF')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const url = $('kmLink').value.trim(); if (!url) return;
      msg(''); busy(true);
      const { work } = await import('/src/loader.mjs');
      const w = work(`${PROD[KM.doc].name} AutoPilot`, ['Link abrufen', 'Inhalt erkennen', 'Eckdaten übernehmen', KM.doc === 'km' ? 'Kreditmappe erstellen' : 'Kennzahlen & PDF erstellen']);
      try {
        await w.step(0);
        const r = await fetch('/api/expose-link', { method: 'POST', headers: { Authorization: 'Bearer ' + sessToken(), 'content-type': 'application/json' }, body: JSON.stringify({ url }) });
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw Object.assign(Error(j.error || 'Der Link konnte nicht ausgewertet werden.'), { more: j.code === 'portal' ? ' <a class="ck-link" href="#suche">Zur Ein-Klick-Übernahme</a>' : '' });
        }
        await w.step(1);
        let listing;
        if ((r.headers.get('content-type') || '').includes('application/pdf')) {
          const mod = await objektModule();
          const t = await mod.exposeText(await r.blob());
          if (t.replace(/\s+/g, '').length < 150) throw Error('Das verlinkte PDF enthält keinen lesbaren Text (vermutlich ein Scan).');
          listing = { u: url, t, ti: '' };
        } else {
          const j = await r.json();
          listing = { u: j.u || url, t: j.t, ti: j.ti, j: j.j };
        }
        await runListing(listing, w);
        $('kmLink').value = '';
      } catch (err) { w.close(); msg(esc(err.message) + (err.more || ''), 'bad'); }
      finally { busy(false); }
    });

    // Gespeichertes Objekt (AutoPilot)
    $('kmGo')?.addEventListener('click', async () => {
      const id = $('kmObj')?.value; const o = (d.objects || []).find((x) => x.id === id); if (!o) return;
      msg(''); busy(true);
      const { work } = await import('/src/loader.mjs');
      const w = work(`${PROD[KM.doc].name} wird erstellt`, KM.doc === 'km' ? ['Objekt und Finanzprofil laden', 'Kennzahlen und Stresstest rechnen', 'Kreditmappe erzeugen'] : ['Objekt laden', 'Kennzahlen berechnen', 'PDF erzeugen']);
      try {
        await w.step(0);
        if (KM.doc === 'km') { await w.step(1); await w.step(2); await mappeFor(id, w); }
        else {
          const mod = await objektModule();
          mod.loadFromObject(o);
          await w.step(1);
          const sum = mod.autoAnalyse({});
          await w.step(2);
          const out = await mod.analysePdf(false);
          await w.done('RenditeRadar fertig');
          showResult(sum);
          const { showPdf } = await import('/src/pdf-view.mjs');
          showPdf(out.blob, { filename: out.filename, title: `RenditeRadar · ${sum.name}`, note: (await getAccess()).paid ? '' : DEMO_NOTE });
        }
      } catch (err) { w.close(); msg(esc(err.message), 'bad'); }
      finally { busy(false); }
    });

    // PDF-Formular ansehen und herunterladen (zahlende Kunden ohne Wasserzeichen)
    $('kmFormGet')?.addEventListener('click', async () => {
      busy(true); msg('');
      const { work } = await import('/src/loader.mjs');
      const w = work('Formular wird vorbereitet', ['Felder anlegen', 'PDF erzeugen']);
      try {
        await w.step(0);
        const r = await fetch(`/api/formular/${PROD[KM.doc].form}`, { headers: { Authorization: 'Bearer ' + sessToken() } });
        if (!r.ok) throw Error('Das Formular konnte nicht erstellt werden.');
        await w.step(1);
        const blob = await r.blob(); const clean = r.headers.get('X-Form-Clean') === '1';
        await w.done('Formular bereit');
        const { showPdf } = await import('/src/pdf-view.mjs');
        showPdf(blob, { filename: fileName(r, `ImmoAdv_${PROD[KM.doc].name}_Formular.pdf`), title: `${PROD[KM.doc].name} · Formular zum Ausfüllen`,
          note: `Herunterladen, ausfüllen, speichern – dann unter „Ausgefülltes PDF hochladen“ wieder einlesen.${clean ? '' : ' ' + DEMO_NOTE}` });
      } catch (err) { w.close(); msg(esc(err.message), 'bad'); }
      finally { busy(false); }
    });

    // Ausgefülltes PDF-Formular hochladen (Manuell)
    $('kmFormUp')?.addEventListener('change', async (e) => {
      const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
      msg(''); busy(true);
      const { work } = await import('/src/loader.mjs');
      const kind = PROD[KM.doc].form;
      const w = work(`${PROD[KM.doc].name}: Formular wird eingelesen`, ['PDF öffnen', 'Eingaben lesen', 'Daten übernehmen', KM.doc === 'km' ? 'Kreditmappe erstellen' : 'Kennzahlen & PDF erstellen']);
      try {
        await w.step(0);
        const [{ readPdfForm, showPdf }, spec] = await Promise.all([import('/src/pdf-view.mjs'), import('/src/form-spec.mjs')]);
        const raw = await readPdfForm(f);
        await w.step(1);
        const other = kind === 'analyse' ? 'kreditmappe' : 'analyse';
        if (raw.id === spec.FORMS[other].id) throw Error(`Das ist das ${spec.FORMS[other].product}-Formular. Bitte oben „${spec.FORMS[other].product}“ wählen und erneut hochladen.`);
        const { values, filled } = spec.readForm(kind, raw.values);
        if (!filled) throw Error(raw.id === spec.FORMS[kind].id ? 'Das Formular ist noch leer. Bitte ausfüllen, speichern und erneut hochladen.' : 'In dieser Datei wurden keine ImmoAdv-Formularfelder gefunden. Bitte das Formular über „Formular ansehen & herunterladen“ verwenden.');
        await w.step(2);
        if (kind === 'analyse') {
          const mod = await objektModule();
          const sum = mod.autoAnalyse({ values });
          await w.step(3);
          const out = await mod.analysePdf(false);
          await w.done('RenditeRadar fertig');
          showResult(sum);
          showPdf(out.blob, { filename: out.filename, title: `RenditeRadar · ${sum.name}`, note: `${filled} Angaben aus dem Formular übernommen.${(await getAccess()).paid ? '' : ' ' + DEMO_NOTE}` });
          return;
        }
        // BankReady: Finanzprofil und Objekt aus dem Formular übernehmen
        if (!(values.o_price > 0)) throw Error('Im Formular fehlt der Kaufpreis.');
        const prof = { ...(d.profile || {}) };
        if (values.p_employment) prof.employment = values.p_employment;
        for (const k of ['netIncome', 'householdSize', 'equity']) if (values['p_' + k] != null) prof[k] = values['p_' + k];
        d.profile = prof;
        const l = values.o_land || land(), g = GREST[l];
        const o = { id: newObjId(), name: values.o_name || 'Objekt aus Formular', createdVia: 'formular', grestPct: g.pct, notaryPct: 2, brokerPct: 0, interestPct: 3.5, repaymentPct: 2, fixedYears: 10, vacancyPct: 2, equity: Number(prof.equity) || 0, rent: 0 };
        for (const [k, v] of Object.entries(values)) if (k.startsWith('o_') && k !== 'o_land' && k !== 'o_name') o[k.slice(2)] = v;
        o.purchaseCostPct = Math.round((g.pct + (Number(o.notaryPct) || 0) + (Number(o.brokerPct) || 0)) * 100) / 100;
        if (!(Number(o.loan) > 0)) o.loan = autoLoan(o);
        d.objects = [...(Array.isArray(d.objects) ? d.objects : []), o];
        await saveData(u, d);
        await w.step(3);
        await mappeFor(o.id, w, `${filled} Angaben aus dem Formular übernommen; Objekt „${esc(o.name)}“ und Finanzprofil wurden gespeichert.`);
      } catch (err) { w.close(); msg(esc(err.message), 'bad'); }
      finally { busy(false); }
    });
  };
  getAccess().then((a) => { const h = $('kmDemo'); if (h && !a.paid) { h.hidden = false; h.innerHTML = `${DEMO_NOTE} <a class="ck-link" href="#angebot">Tarife ansehen</a>`; } });
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
  const acc = await getAccess();
  try { cfg = await fetch('/api/billing/config', { cache: 'no-store' }).then((r) => r.json()); } catch { /* aus */ }
  if (cfg.enabled) {
    [st, inv] = await Promise.all([
      fetch('/api/billing/status', { headers: H, cache: 'no-store' }).then((r) => r.json()).catch(() => ({ tier: 'free' })),
      fetch('/api/billing/invoices', { headers: H, cache: 'no-store' }).then((r) => r.json()).catch(() => ({ invoices: [] })),
    ]);
  }
  const tierName = acc.paid && (st.tier || 'free') === 'free' ? (acc.admin ? 'Administrator (voller Zugang)' : acc.b2b ? 'Unternehmenskonto' : 'Voller Zugang') : ({ free: 'Kostenlose Demo', starter: 'Einsteiger', pro: 'Profi' }[st.tier || 'free'] || 'Kostenlose Demo');
  const demoBox = acc.paid ? '' : `<div class="demo-box"><strong>Sie nutzen die kostenlose Demo</strong><p>Probieren Sie alles aus: RenditeRadar-Analysen, BankReady-Vorschau, PDF-Formulare und den Lernbereich. In der Demo tragen alle PDFs ein ImmoAdv-Wasserzeichen. Sobald Sie ein Abo besitzen bzw. einen Tarif gebucht haben, entfallen die Wasserzeichen – Ihre Dokumente sind dann fertig für Bank und Weitergabe.</p><a class="btn btn-dark" href="#angebot">Tarife ansehen</a></div>`;
  const until = st.pro ? st.proUntil : st.starter ? st.starterUntil : null;
  const money = (c, cur = 'eur') => (Number(c || 0) / 100).toLocaleString('de-DE', { style: 'currency', currency: String(cur).toUpperCase() });
  const dte = (x) => (x ? new Date(x).toLocaleDateString('de-DE') : '–');
  const list = Array.isArray(inv.invoices) ? inv.invoices : [];
  box.innerHTML = `${demoBox}${CHECKOUT === 'success' ? '<p class="auth-message success">Vielen Dank – Ihre Zahlung wurde übermittelt. Die Rechnung erscheint unten und kommt per E-Mail.</p>' : CHECKOUT === 'cancel' ? '<p class="form-note">Bezahlung abgebrochen – es wurde nichts berechnet.</p>' : ''}<div class="fin-grid">
    <div class="fin-box"><small>Ihr Tarif</small><strong>${tierName}</strong><span>${until ? `aktiv bis ${dte(until)}` : st.tier === 'free' ? (acc.paid ? 'Alle Funktionen, PDFs ohne Wasserzeichen' : 'Alles ausprobieren · PDFs mit Wasserzeichen') : ''}${st.creditMaps ? ` · Kreditmappen: ${Math.max(0, (st.creditMaps || 0) - (st.creditMapsUsed || 0))} frei` : ''}</span></div>
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
    saveData(u, d).catch(() => { /* wird nachgeholt */ });
    reload();
  });
  document.querySelectorAll('[data-pick]').forEach((b) => b.onclick = async () => {
    d.profile = { ...(d.profile || {}), mode: b.dataset.pick };
    saveData(u, d).catch(() => { /* wird nachgeholt */ });
    reload();
  });
}

function lernTopics(st, rec = [], recName = '', plan = '') {
  const one = ([id, t, sub], k = -1, next = false) => `
    <details class="lt${st[id] ? ' done' : ''}${next ? ' next' : ''}" data-topic="${id}">
      <summary>${k >= 0 ? `<span class="lt-num" aria-hidden="true">${st[id] ? '✓' : k + 1}</span>` : ''}<span class="lt-title">${next ? '<em class="lt-next-tag">Als Nächstes</em>' : ''}<strong>${t}</strong><span>${sub}</span></span><span class="lt-state">${st[id] ? '✓ verstanden' : ''}</span></summary>
      <div class="lt-body" data-body="${id}"><p class="form-note">Wird geladen …</p></div>
    </details>`;
  const recT = rec.map((id) => LERN.find((x) => x[0] === id)).filter(Boolean);
  const nextId = recT.find(([id]) => !st[id])?.[0];
  const doneRec = recT.filter(([id]) => st[id]).length;
  const head = recT.length ? `<div class="lt-plan"><h4 class="lt-group lt-rec">Ihr Lernplan · Phase ${recName}</h4>${plan ? `<p class="form-note">${plan}</p>` : ''}<p class="form-note lt-plan-n">${doneRec} von ${recT.length} Themen Ihres Lernplans verstanden.</p>${recT.map((x, k) => one(x, k, x[0] === nextId)).join('')}</div>` : '';
  // Übrige Gruppen: zuerst die, die zur Phase passen (enthalten empfohlene Themen), dann der Rest.
  const groups = [...new Set(LERN.map((x) => x[5]))];
  const recGroups = new Set(recT.map((x) => x[5]));
  groups.sort((a, b) => Number(recGroups.has(b)) - Number(recGroups.has(a)));
  const rest = groups.map((g) => { const items = LERN.filter((x) => x[5] === g && !rec.includes(x[0])); return items.length ? `<h4 class="lt-group">${g}</h4>${items.map((x) => one(x)).join('')}` : ''; }).join('');
  return head + (rest ? `<h4 class="lt-group lt-more-h">Weitere Themen</h4>${rest}` : '');
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
    ${phasePicker(phaseOf(d).idx, phaseOf(d).chosen)}
    <div class="lt-list">${lernTopics(st, PHASES[phaseOf(d).idx].lern, PHASES[phaseOf(d).idx].name, PHASES[phaseOf(d).idx].plan)}</div></article>`;
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
      <div class="lt-more" id="more-${id}-${k}"${document.body.dataset.mode === 'profi' ? '' : ' hidden'}><p>${lnk(q.level2)}</p>${q.nextStep ? `<p class="lt-next"><strong>Nächster Schritt:</strong> ${lnk(q.nextStep)}</p>` : ''}<a class="ck-link" href="/wissen/${slugQ(q.question)}">Ganze Seite öffnen →</a></div>
      ${document.body.dataset.mode === 'profi' ? '' : `<button class="lt-mini" type="button" data-more="more-${id}-${k}" aria-expanded="false" aria-controls="more-${id}-${k}">Mehr erklären</button>`}
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
        ${cfg.enabled ? `<button class="btn ${p.id === next ? 'btn-dark' : 'btn-outline'}" type="button" data-buy="${p.id}"${(tier === 'pro' && shown === 'profi' && p.id !== 'credit-map') || (p.id === 'credit-map-starter' && tier !== 'starter') ? ' disabled' : ''}>${p.id === 'credit-map-starter' && tier !== 'starter' ? 'Mit Einsteiger-Begleitung' : 'Jetzt buchen'}</button>` : '<button class="btn btn-outline" type="button" disabled>Buchung startet in Kürze</button>'}</div>`).join('')}</div>
      <div class="offer-free"><strong>Immer kostenlos:</strong> ${P.kostenlos.features.map(esc).join(' · ')}</div>
      <div class="offer-pay"><p class="form-note">Bezahlen Sie auf der sicheren Bezahlseite mit:</p>${PAY_BADGES}</div>
      <p class="form-note">${esc(P.hinweis)} Es gelten die <a class="ck-link" href="/nutzungsbedingungen">Nutzungsbedingungen mit Widerrufsbelehrung</a>. Kündigung jederzeit über <a class="ck-link" href="/kuendigen">„Verträge hier kündigen“</a>.</p>`;
    box.querySelectorAll('[data-seg]').forEach((b) => b.onclick = () => { shown = b.dataset.seg; draw(); });
    // Aus der öffentlichen Angebotsseite vorgewählter Tarif: zur Karte springen und hervorheben.
    const want = new URLSearchParams(location.search).get('buy');
    if (want) { const card = box.querySelector(`[data-buy="${CSS.escape(want)}"]`)?.closest('.offer'); if (card) { card.classList.add('offer-want'); card.scrollIntoView({ behavior: 'smooth', block: 'center' }); } }
    box.querySelectorAll('[data-buy]').forEach((b) => b.onclick = () => {
      const offer = m.plans.find((x) => x.id === b.dataset.buy);
      if (offer) openBuy(offer, { onError: (t) => alert(t) });
    });
  };
  draw();
}
