// App-Rahmen für das Konto: Handy wie eine App (Tab-Leiste unten), Desktop wie ein Investment-Tool (Seitenleiste).
// Ansichten über #hash; vorhandene Karten werden den Ansichten zugeordnet. Modus Einsteiger/Profi frei wählbar.
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
};
const svg = (k) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;

const VIEWS = {
  einsteiger: [['start', 'Übersicht'], ['suche', 'Suche'], ['objekte', 'Objekte'], ['lernen', 'Lernpfad'], ['angebot', 'Angebot'], ['konto', 'Konto']],
  profi: [['start', 'Cockpit'], ['suche', 'Suche & Analyse'], ['objekte', 'Objekte'], ['lernen', 'Wissen'], ['angebot', 'Tarif'], ['konto', 'Konto']],
};
const TABS = ['start', 'suche', 'objekte', 'lernen', 'konto'];

// Lernpfad: aufeinander aufbauende Module aus vorhandenen Inhalten.
const LERN = [
  ['budget', 'Was kann ich mir leisten?', 'Rate, Darlehen und Kaufpreis aus Einkommen und Eigenkapital.', '/rechner/budget'],
  ['eigenkapital', 'Wie viel Eigenkapital brauche ich?', 'Nebenkosten, Puffer und warum Banken darauf schauen.', '/wissen/wie-viel-eigenkapital-brauche-ich'],
  ['nebenkosten', 'Kaufnebenkosten im eigenen Bundesland', 'Grunderwerbsteuer, Notar, Grundbuch, Makler.', '/rechner/kaufnebenkosten'],
  ['beruf', 'Was die Bank je nach Beruf prüft', 'Angestellt, selbstständig, verbeamtet – und welche Unterlagen.', '/wissen/erwerbsstatus'],
  ['annuitaet', 'Zins, Tilgung, Zinsbindung', 'Wie sich die Rate zusammensetzt und was nach der Zinsbindung passiert.', '/wissen/was-bedeuten-zins-tilgung-annuitaet-und-zinsbindung'],
  ['suche', 'Immobilie suchen und prüfen', 'Portalsuche, dann Kaufpreis und Miete in die Analyse.', '#suche'],
  ['scorecard', 'Ampel für Haushalt, Eigenkapital, Objekt', 'Die Deal-Scorecard zeigt, wo es hakt.', '/rechner/scorecard'],
  ['etw', 'Eigentumswohnung richtig prüfen', 'Teilungserklärung, Protokolle, Rücklage.', '/wissen/wie-pruefe-ich-eine-eigentumswohnung'],
  ['cashflow', 'Cashflow vor und nach Steuern', 'AfA, Zinsen und Grenzsteuersatz verstehen.', '/rechner/cashflow'],
  ['beleihung', 'Beleihungswert und Bankblick', 'Warum die Bank anders rechnet als der Verkäufer.', '/wissen/was-ist-der-beleihungswert'],
  ['unterlagen', 'Unterlagen vollständig machen', 'Checkliste abarbeiten, Bankreife auf 90 % bringen.', '/checkliste'],
  ['fristen', 'Nach dem Kauf: Fristen im Griff', '15-%-Grenze, Spekulationsfrist, Zinsbindung, Mieterhöhung.', '/fristen'],
];
const PROFI = [
  ['Szenarien: Anschlusszins und Verkauf', '/szenarien'], ['AfA-Plan inkl. Sonder-AfA § 7b', '/rechner/afa'], ['Mieterhöhung mit Briefentwurf', '/rechner/mieterhoehung'],
  ['Angebotsvergleich', '/rechner/vergleich'], ['Kaufen oder mieten', '/rechner/kaufen-mieten'], ['Investment-Cockpit (Stresstest)', '/cockpit'],
  ['Mietrecht- und Steuerrechner', '/rechner'], ['Glossar', '/wissen/glossar'],
];

function classify(el) {
  if (el.dataset.view) return el.dataset.view;
  const id = el.id || '', h = el.querySelector('h3')?.textContent || '', mode = document.body.dataset.mode;
  if (id === 'rankCard') return mode === 'profi' ? 'konto' : 'start';
  if (['termineCard', 'pendingCard'].includes(id) || el.classList.contains('req-card')) return 'start';
  if (id === 'portfolioCard') return mode === 'profi' ? 'start objekte' : 'objekte';
  if (['docsCard', 'bankreifeCard'].includes(id) || h === 'Objekte') return 'objekte';
  if (['billingCard', 'accountCard'].includes(id) || h === 'Finanzprofil') return 'konto';
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
  grid.insertAdjacentHTML('afterbegin', startCard(mode, d));
  grid.insertAdjacentHTML('beforeend', `<article class="dash-card wide" data-view="suche" id="sucheView"></article>`);
  grid.insertAdjacentHTML('beforeend', lernCard(mode, d));
  grid.insertAdjacentHTML('beforeend', `<article class="dash-card wide" data-view="angebot" id="angebotView"><h3>${mode === 'profi' ? 'Tarif' : 'Angebot'}</h3><div id="offerBody"><p class="form-note">Wird geladen …</p></div></article>`);
  bindStart(mode, d, u, saveData, reload);
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
    if (cur === 'angebot' && !$('angebotView').dataset.ready) { $('angebotView').dataset.ready = '1'; renderOffers(mode); }
  };
  if (window.__iaHash) window.removeEventListener('hashchange', window.__iaHash);
  window.__iaHash = () => { apply(); window.scrollTo(0, 0); };
  window.addEventListener('hashchange', window.__iaHash);
  new MutationObserver(apply).observe(grid, { childList: true });
  apply();
}

function startCard(mode, d) {
  const os = Array.isArray(d.objects) ? d.objects : [];
  const done = Object.values(d.progress?.lern || {}).filter(Boolean).length;
  if (!d.profile?.mode && !new URLSearchParams(location.search).get('modus')) {
    return `<article class="dash-card wide start-card" data-view="start"><h3>Willkommen! Wo stehen Sie gerade?</h3><p class="form-note">Sie können jederzeit wechseln – oben rechts.</p>
      <div class="mode-pick"><button class="mode-card" type="button" data-pick="einsteiger"><span class="mode-tag">Einsteiger</span><strong>Ich fange gerade an</strong><span>Lernpfad, Erklärungen, Schritt für Schritt zur Finanzierung.</span></button>
      <button class="mode-card pro" type="button" data-pick="profi"><span class="mode-tag">Profi</span><strong>Ich investiere schon</strong><span>Cockpit mit Kennzahlen, Portfolio, Datenraum.</span></button></div></article>`;
  }
  const actions = mode === 'profi'
    ? [['#suche', 'Objekt analysieren', 'Suche, Analyse, Merkliste, PDF'], ['#objekte', 'Objekte und Datenraum', `${os.length} Objekt(e) im Konto`], ['/rechner/vergleich', 'Angebote vergleichen', 'Bis zu drei nebeneinander']]
    : [['#suche', 'Immobilie suchen', 'ImmoScout24, Immowelt, Kleinanzeigen'], ['#lernen', 'Lernpfad fortsetzen', `${done} von ${LERN.length} Schritten erledigt`], ['#objekte', os.length ? 'Meine Objekte' : 'Erstes Objekt anlegen', os.length ? `${os.length} Objekt(e)` : 'Kaufpreis und Miete reichen für den Anfang']];
  return `<article class="dash-card wide start-card" data-view="start"><div class="quick">${actions.map(([h, t, s]) => `<a class="quick-a" href="${h}"><strong>${t}</strong><span>${s}</span></a>`).join('')}</div></article>`;
}

function bindStart(mode, d, u, saveData, reload) {
  document.querySelectorAll('[data-pick]').forEach((b) => b.onclick = async () => {
    d.profile = { ...(d.profile || {}), mode: b.dataset.pick };
    try { await saveData(u, d); } catch { /* weiter */ }
    reload();
  });
}

function lernCard(mode, d) {
  if (mode === 'profi') {
    return `<article class="dash-card wide" data-view="lernen" id="lernView"><h3>Werkzeuge und Wissen für Profis</h3><div class="quick">${PROFI.map(([t, h]) => `<a class="quick-a" href="${h}"><strong>${t}</strong></a>`).join('')}</div>
      <p class="form-note">Neu dabei oder Wissenslücke? Der Einsteiger-Lernpfad ist jederzeit über den Moduswechsel oben erreichbar.</p></article>`;
  }
  const st = d.progress?.lern || {};
  const n = LERN.filter(([id]) => st[id]).length;
  return `<article class="dash-card wide" data-view="lernen" id="lernView"><h3>Ihr Lernpfad: vom ersten Gedanken zur Finanzierung</h3>
    <div class="lp-bar" role="progressbar" aria-valuenow="${n}" aria-valuemin="0" aria-valuemax="${LERN.length}"><span style="width:${Math.round((n / LERN.length) * 100)}%"></span></div>
    <p class="form-note">${n} von ${LERN.length} Schritten erledigt.${n === LERN.length ? ' Stark – der Profi-Modus passt jetzt zu Ihnen.' : ''}</p>
    <ol class="lp">${LERN.map(([id, t, s, h], i) => `<li class="${st[id] ? 'done' : ''}"><label class="lp-check"><input type="checkbox" data-lern="${id}"${st[id] ? ' checked' : ''}><span class="sr-only">erledigt</span></label><a href="${h}"><strong>${i + 1}. ${t}</strong><span>${s}</span></a></li>`).join('')}</ol></article>`;
}

function bindLern(d, u, saveData) {
  document.querySelectorAll('[data-lern]').forEach((c) => c.onchange = async () => {
    d.progress = { ...(d.progress || {}), lern: { ...(d.progress?.lern || {}), [c.dataset.lern]: c.checked } };
    c.closest('li').classList.toggle('done', c.checked);
    const n = Object.values(d.progress.lern).filter(Boolean).length;
    const bar = document.querySelector('.lp-bar span'); if (bar) bar.style.width = `${Math.round((n / LERN.length) * 100)}%`;
    const note = bar?.parentElement?.nextElementSibling; if (note) note.textContent = `${n} von ${LERN.length} Schritten erledigt.${n === LERN.length ? ' Stark – der Profi-Modus passt jetzt zu Ihnen.' : ''}`;
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
