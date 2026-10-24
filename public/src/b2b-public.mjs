// /b2b: Tarife aus der zentralen Preisliste und Kontaktformular für Demo/Enterprise/Kooperation.
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const net = (c) => (c / 100).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' €';
// Leistungsvergleich der Tarife als Tabelle (Spalte hl hervorgehoben).
const cmpTable = (v, hl = -1) => (v?.zeilen?.length ? `<details class="cmp" open><summary>Tarife im Vergleich</summary><div class="cmp-wrap"><table class="cmp-table"><thead><tr><th></th>${v.spalten.map((s, i) => `<th${i === hl ? ' class="hl"' : ''}>${esc(s)}</th>`).join('')}</tr></thead><tbody>${v.zeilen.map(([l, ...c]) => `<tr><th scope="row">${esc(l)}</th>${c.map((x, i) => `<td class="${x === '✓' ? 'y' : x === '–' ? 'n' : ''}${i === hl ? ' hl' : ''}">${esc(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>` : '');


async function offers() {
  const box = document.getElementById('b2bOffers');
  if (!box) return;
  const d = await fetch('/data/preise.json').then((r) => r.json()).catch(() => null);
  if (!d?.b2b) { box.innerHTML = '<p class="form-note">Tarife derzeit nicht verfügbar.</p>'; return; }
  const b = d.b2b;
  // Zielgruppe und Grenzen je Paket aus den Tarifdaten (Zugänge, Kreditmappen) – keine zusätzlichen Versprechen.
  const FOR = { BASIC: 'Für Einzelberater und kleinere Vermittlerteams.', PRO: 'Für Kanzleien und Baufinanzierungs-Teams.', ENTERPRISE: 'Für Banken, Sparkassen und Filialnetze.' };
  const lim = (p) => [p.seats === 1 ? '1 Berater-Zugang' : p.seats ? `bis ${p.seats} Berater-Zugänge` : '', p.dossiers ? `${p.dossiers} Kreditmappen pro Monat` : 'Kreditmappen ohne Limit'].filter(Boolean).join(' · ');
  const card = (p, rec) => `<div class="offer${rec ? ' rec' : ''}" data-ivl="${p.interval}"${p.interval === 'year' ? ' hidden' : ''}>${rec ? '<span class="offer-rec">Empfohlen für Kanzleien &amp; Baufi-Teams</span>' : ''}
    <h4>${esc(p.name.replace(' (Jahr)', ''))}</h4><p class="offer-for">${esc(FOR[p.tier] || '')}</p><div class="offer-price">${net(p.netto_cents)} <small>netto ${esc(p.intervall)}</small></div><p class="offer-lim"><strong>Enthalten:</strong> ${esc(lim(p))}</p>
    <ul>${p.basis ? `<li class="offer-basis">${esc(p.basis)}</li>` : ''}${p.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul><a class="btn btn-dark" href="#anfrage" data-briefing="pricing">Unternehmenskonto anfragen</a></div>`;
  box.innerHTML = `<div class="seg" role="tablist"><button type="button" data-i="month" aria-selected="true">Monatlich</button><button type="button" data-i="year" aria-selected="false">Jährlich</button></div>
    <div class="offers">${b.plans.map((p) => card(p, p.tier === 'PRO')).join('')}
      <div class="offer"><h4>${esc(b.enterprise.name)}</h4><p class="offer-for">${esc(FOR.ENTERPRISE)}</p><div class="offer-price">${esc(b.enterprise.preis)}</div><p class="offer-lim"><strong>Enthalten:</strong> ab ${b.enterprise.seats} Berater-Zugänge · Kreditmappen ohne Limit · Preis nach Filialgröße</p><ul>${b.enterprise.basis ? `<li class="offer-basis">${esc(b.enterprise.basis)}</li>` : ''}${b.enterprise.features.map((f) => `<li>${esc(f)}</li>`).join('')}</ul><a class="btn btn-ghost" href="#kontakt">Angebot anfragen</a></div></div>
    ${cmpTable(b.vergleich, 1)}<p class="price-note">${esc(b.hinweis)}</p>`;
  box.querySelectorAll('[data-i]').forEach((btn) => btn.onclick = () => {
    box.querySelectorAll('[data-i]').forEach((x) => x.setAttribute('aria-selected', String(x === btn)));
    box.querySelectorAll('.offer[data-ivl]').forEach((o) => { o.hidden = o.dataset.ivl !== btn.dataset.i; });
  });
}

function contact() {
  const f = document.getElementById('b2bContact');
  if (!f) return;
  const ts = Date.now();
  const kind = new URLSearchParams(location.search).get('anliegen');
  if (kind && f.kind.querySelector(`option[value="${kind}"]`)) f.kind.value = kind;
  // Nachweis-Felder nur bei der Kontoanfrage (dort Pflicht).
  const sync = () => { const on = f.kind.value === 'konto'; f.querySelectorAll('[data-konto]').forEach((x) => { x.hidden = !on; x.disabled = !on; }); syncLegal(f); };
  f.kind.addEventListener('change', sync); f.legalForm?.addEventListener('change', () => syncLegal(f)); sync();
  f.onsubmit = async (e) => {
    e.preventDefault();
    const msg = document.getElementById('b2bMsg');
    if (!f.checkValidity()) { f.reportValidity(); return; }
    const fd = new FormData(f), d = Object.fromEntries(fd);
    const btn = f.querySelector('button[type=submit]');
    let r;
    if (d.kind === 'konto') {
      const pf = fd.get('proof');
      if (pf && pf.size > 4 * 1024 * 1024) { msg.textContent = 'Der Nachweis ist größer als 4 MB. Bitte verkleinern oder als PDF speichern.'; return; }
      fd.set('ts', String(ts)); fd.delete('newsletter'); const cp = new URLSearchParams(location.search).get('utm_campaign'); if (cp && /^[a-z0-9-]{3,40}$/.test(cp)) fd.set('camp', cp); btn.disabled = true;
      r = await fetch('/api/b2b/contact', { method: 'POST', body: fd });
    } else {
      delete d.proof; btn.disabled = true;
      const cp = new URLSearchParams(location.search).get('utm_campaign');
      const { newsletter: _nl, ...rest } = d; // eslint-disable-line no-unused-vars
      r = await fetch('/api/b2b/contact', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...rest, privacy: d.privacy === 'on', ts, ...(cp && /^[a-z0-9-]{3,40}$/.test(cp) ? { camp: cp } : {}) }) });
    }
    const j = await r.json().catch(() => ({}));
    btn.disabled = false;
    if (r.ok) {
      let nl = '';
      if (d.newsletter === 'on') { const x = await fetch('/api/newsletter', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: d.email, name: d.name, company: d.company, segment: 'b2b', source: 'b2b-formular', consent: true, ts }) }).catch(() => null); if (x && x.ok) nl = ' Für die Neuigkeiten haben wir Ihnen eine Bestätigungs-E-Mail geschickt.'; }
      f.innerHTML = `<div class="pt-alert full"><strong>Danke!</strong> Ihre Anfrage ist eingegangen. Wir melden uns innerhalb von zwei Werktagen.${nl}</div>`;
    }
    else { msg.textContent = j.error || 'Senden fehlgeschlagen.'; if (j.field === 'email') f.email?.focus(); }
  };
}

// routes.js rendert den Inhalt nach DOMContentLoaded; kurz warten, bis die Container da sind.
function init(tries = 0) {
  if (!document.getElementById('b2bOffers') && tries < 40) { setTimeout(() => init(tries + 1), 50); return; }
  offers().then(() => {
    // Herkunft (z. B. von der Prüfseite) an die Registrierung weitergeben.
    const ref = (new URLSearchParams(location.search).get('ref') || '').replace(/[^a-z0-9-]/gi, '').slice(0, 40);
    if (ref) document.querySelectorAll('a[href="/b2b-portal"]').forEach((a) => { a.href = '/b2b-portal?ref=' + encodeURIComponent(ref); });
  });
  contact();
  landing();
}
// Rückmeldung nach Bestätigen/Abmelden der Neuigkeiten.
{ const nl = new URLSearchParams(location.search).get('newsletter'); const t = { bestaetigt: 'Danke – Ihre Anmeldung für die Neuigkeiten ist bestätigt.', abgemeldet: 'Sie sind abgemeldet und erhalten keine Neuigkeiten mehr.', ungueltig: 'Dieser Link ist ungültig oder abgelaufen.' }[nl]; if (t) { const show = () => { const m = document.createElement('div'); m.className = 'nl-banner'; m.setAttribute('role', 'status'); m.textContent = t; document.body.prepend(m); setTimeout(() => m.remove(), 8000); }; if (document.readyState === 'loading') addEventListener('DOMContentLoaded', show); else show(); } }

// Kontoanfrage: eingetragene Gesellschaften → Registernummer genügt; sonst Steuernummer und Nachweis (Datei) Pflicht.
function syncLegal(f) {
  const sel = f.querySelector('[name=legalForm]'); if (!sel) return;
  const on = !f.querySelector('[data-konto]')?.disabled;
  const hr = sel.selectedOptions[0]?.dataset.hr === '1', chosen = Boolean(sel.value);
  f.querySelectorAll('[data-hr-only]').forEach((x) => { x.hidden = !(chosen && hr); });
  f.querySelectorAll('[data-nohr-only]').forEach((x) => { x.hidden = !(chosen && !hr); });
  const req = (n, v) => { const i = f.querySelector(`[name=${n}]`); if (i) i.required = on && v; };
  req('registerNumber', chosen && hr); req('taxId', chosen && !hr); req('proof', chosen && !hr);
}

// ---------- Landingpage: Branchenwahl, Zeitgewinn-Rechner, Demo-Fall, White-Label-Vorschau ----------
const RB = {
  vermittler: { h: 'Vorqualifizierte Fälle statt Unterlagen-Jagd – Ihr Zeitgewinn, offen gerechnet.', p: 'Ihre Kunden laden Unterlagen hoch und füllen die Selbstauskunft aus. ImmoAdv prüft Beleihungsauslauf, Haushaltsüberschuss, DSCR und Zins-Stresstest automatisch. Sie übernehmen den Fall, wenn er entscheidungsreif ist.', n: 15, m: 120, type: 'BROKER' },
  makler: { h: 'Kaufinteressenten vorqualifiziert – bevor Sie die Besichtigung planen.', p: 'Per QR-Code am Exposé rechnen Interessenten ihre Finanzierung durch und reichen Unterlagen ein. Sie sehen, wer realistisch kaufen kann, und geben bankfertige Fälle an Ihren Finanzierungspartner weiter.', n: 25, m: 60, type: 'REALTOR' },
  bank: { h: 'Kreditmappen in festem Aufbau – Ihre Berater prüfen statt zu sammeln.', p: 'Kreditmappen kommen in festem Aufbau an: Selbstauskunft, Haushaltsrechnung, Objektkennzahlen und nummerierte Anlagen, jeweils mit SHA-256-Prüfsumme. Ihre Berater prüfen statt zu sammeln.', n: 40, m: 90, type: 'BANK' },
  finanzberater: { h: 'Immobilie als Anlageklasse – durchgerechnet und präsentationsfertig.', p: 'Cashflow nach Steuern, Rendite und Zins-Stresstest für Ihre Mandanten, als Präsentation mit Ihrem Logo. Unterlagen und Kennzahlen liegen strukturiert vor, wenn es zur Finanzierung geht.', n: 8, m: 120, type: 'OTHER' },
};
const x$ = (id) => document.getElementById(id);
function landing() {
  if (!x$('roi_out')) return;
  const nf = (v) => Math.round(v).toLocaleString('de-DE');
  const roi = () => {
    const n = +x$('roi_n').value, m = +x$('roi_m').value, sh = +x$('roi_s').value / 100, h = +x$('roi_h').value;
    x$('roi_n_o').textContent = n; x$('roi_m_o').textContent = m + ' Min.'; x$('roi_s_o').textContent = Math.round(sh * 100) + ' %'; x$('roi_h_o').textContent = h + ' €';
    document.querySelectorAll('.roi input[type=range]').forEach((r) => r.style.setProperty('--pct', ((r.value - r.min) / (r.max - r.min)) * 100 + '%'));
    const perCase = m * sh, hours = (n * perCase) / 60, value = hours * h;
    const pro = 139, mult = value / pro;
    x$('roi_out').innerHTML = `<div><strong>${nf(perCase)} Min.</strong><span>weniger je Fall</span></div><div><strong>${hours.toLocaleString('de-DE', { maximumFractionDigits: 1 })} Std.</strong><span>pro Monat</span></div><div class="roi-v"><strong>${nf(value)} €</strong><span>Arbeitszeit pro Monat${mult >= 1 ? ` · ${mult.toLocaleString('de-DE', { maximumFractionDigits: 1 })}-fach der Pro-Gebühr (139 € netto)` : ''}</span></div>`;
  };
  document.querySelectorAll('.roi input').forEach((i) => i.addEventListener('input', roi));
  const setRb = (k, save = true) => {
    const c = RB[k] || RB.vermittler;
    document.querySelectorAll('[data-rb]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.rb === k)));
    x$('rbH').textContent = c.h; x$('rbP').textContent = c.p;
    x$('roi_n').value = c.n; x$('roi_m').value = c.m; roi();
    const f = document.getElementById('b2bContact');
    if (f?.institutionType) f.institutionType.value = c.type;
    if (save) try { localStorage.setItem('ia-b2b-branche', k); } catch { /* ohne Speicher */ }
  };
  document.querySelectorAll('[data-rb]').forEach((b) => b.onclick = () => setRb(b.dataset.rb));
  let start = 'vermittler';
  try { const s = localStorage.getItem('ia-b2b-branche'); if (RB[s]) start = s; } catch { /* ohne Speicher */ }
  setRb(start, false);

  // Demo-Fall in drei Schritten (Musterdaten, nichts wird gesendet).
  const sim = (k) => {
    document.querySelectorAll('[data-sim]').forEach((b) => b.setAttribute('aria-selected', String(+b.dataset.sim === k)));
    document.querySelectorAll('[data-simp]').forEach((p) => { p.hidden = +p.dataset.simp !== k; });
    if (k === 3 && crypto?.subtle) {
      const txt = 'ImmoAdv Kreditmappe · Familie Muster · Eigentumswohnung · Kaufpreis 380000 · Eigenkapital 70000 · BLA 78,4 % · DSCR 1,24 · ' + new Date().toISOString().slice(0, 10);
      crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt)).then((b) => { x$('simHash').textContent = 'SHA-256 ' + [...new Uint8Array(b)].map((v) => v.toString(16).padStart(2, '0')).join(''); });
    }
  };
  document.querySelectorAll('[data-sim]').forEach((b) => b.onclick = () => sim(+b.dataset.sim));
  document.querySelectorAll('[data-sim-go]').forEach((b) => b.onclick = () => {
    if (b.hasAttribute('data-sim-reset')) {
      // Demo von vorn: Unterlagen-Liste, Balken und Upload-Knopf zurücksetzen.
      document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => upload.play(), 450);
    }
    sim(+b.dataset.simGo);
  });
  // Upload-Demo: läuft beim ersten Sichtkontakt von selbst (6 von 7 → Energieausweis kommt nach → 7 von 7).
  // Musterdaten, nichts wird gesendet. „Upload simulieren“ spielt die Sequenz erneut ab.
  const upload = uploadDemo();
  x$('simUp')?.addEventListener('click', () => upload.play());
  const docs = x$('simDocs');
  if (docs && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) { io.disconnect(); upload.play(); } }, { threshold: 0.45 });
    io.observe(docs);
  } else upload.play();

  // White-Label-Vorschau der Kundeneinladung.
  const wl = () => {
    const name = x$('wlName').value.trim() || 'Ihr Unternehmen', col = x$('wlCol').value;
    x$('wlFrom').textContent = name; x$('wlCo').textContent = name;
    x$('wlPrev').style.setProperty('--wl', col);
  };
  ['wlName', 'wlCol'].forEach((id) => x$(id)?.addEventListener('input', wl)); wl();

  // Conversion-Ereignisse (cookielose Messung, nur Ereignisname und Ort – keine Eingaben).
  const tr = (ev, where) => { try { window.iaTrack?.(ev, { seg: 'b2b', plan: where }); } catch { /* nie stören */ } };
  const seen = new Set(); const once = (ev, w) => { if (!seen.has(ev)) { seen.add(ev); tr(ev, w); } };
  x$('simUp')?.addEventListener('click', () => once('demo_started', 'upload'));
  addEventListener('ia:b2b-demo-done', () => once('b2b_demo_completed'));
  document.querySelectorAll('[data-sim]').forEach((b) => b.addEventListener('click', () => { once('demo_started', 'tab'); if (b.dataset.sim === '3') once('demo_completed'); }));
  document.querySelectorAll('[data-sim-go="3"]').forEach((b) => b.addEventListener('click', () => once('demo_completed')));
  document.addEventListener('click', (e) => {
    const a = e.target.closest?.('a[href="#anfrage"], a[href="#b2bContact"], a[href="#demo"], a[href="/b2b-portal"], [data-btrack]');
    if (a) tr('business_cta_clicked', (a.dataset.btrack || a.getAttribute('href') || '').replace(/[^a-z0-9_#/-]/gi, '').slice(0, 40));
    const bf = e.target.closest?.('[data-briefing]');
    if (bf && !e.defaultPrevented && !(e.metaKey || e.ctrlKey || e.shiftKey)) { e.preventDefault(); tr('b2b_cta_clicked', bf.dataset.briefing); openBriefing(bf.dataset.briefing, tr); }
    const w = e.target.closest?.('[data-way="konto"]');
    if (w) { const f = document.getElementById('b2bContact'); if (f?.kind) f.kind.value = 'konto'; setTimeout(() => f?.querySelector('input[name=name]')?.focus({ preventScroll: true }), 400); }
  });
  const pr = document.getElementById('preise');
  if (pr && 'IntersectionObserver' in window) { const io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) { io.disconnect(); once('pricing_viewed'); } }, { threshold: 0.3 }); io.observe(pr); }
}
init();

// ---------- Upload-Demo (Abschnitt „Demo“, Schritt 1) ----------
function uploadDemo() {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let timers = [];
  const later = (ms, fn) => timers.push(setTimeout(fn, ms));
  const pill = (state, text) => { const p = x$('simPill'); if (p) { p.dataset.state = state; p.textContent = text; } };
  const count = (n) => { const c = x$('simCount'); if (c) c.textContent = n === 7 ? '7 von 7 · komplett' : `${n} von 7`; if (x$('simBar')) x$('simBar').style.width = Math.round((n / 7) * 100) + '%'; };
  const note = (t) => { if (x$('simNote')) x$('simNote').textContent = t; };
  const exp = (on) => { const b = x$('simExport'); if (b) { b.disabled = !on; b.classList.toggle('sim-ready', on); } };
  const final = (li) => {
    li.forEach((l) => { l.classList.remove('miss', 'arrive'); l.classList.add('done'); });
    count(7); pill('ok', 'Vollständig · entscheidungsreif'); exp(true);
    note('Alle 7 Unterlagen da und geprüft. Der Fall ist entscheidungsreif – die Kreditmappe kann exportiert werden.');
    const up = x$('simUp'); if (up) { up.disabled = false; up.textContent = 'Erneut abspielen'; }
    dispatchEvent(new Event('ia:b2b-demo-done'));
  };
  return {
    play() {
      timers.forEach(clearTimeout); timers = [];
      const li = [...document.querySelectorAll('#simDocs li')];
      if (!li.length) return;
      if (reduce) { final(li); return; }
      const up = x$('simUp'); if (up) up.disabled = true;
      li.forEach((l) => l.classList.remove('done', 'miss', 'arrive'));
      count(0); exp(false); pill('busy', 'Unterlagen gehen ein …');
      note('Der Mandant lädt Unterlagen über Ihren Einladungslink hoch – geführt, am Handy. Simulation mit Musterdaten.');
      const last = li.length - 1;
      li.slice(0, last).forEach((l, i) => later(320 * (i + 1), () => { l.classList.add('done'); count(i + 1); }));
      const t6 = 320 * last + 200;
      later(t6, () => { li[last].classList.add('miss'); pill('warn', '1 Dokument fehlt'); note('6 von 7 Unterlagen da – der Energieausweis fehlt. ImmoAdv erinnert den Mandanten automatisch.'); });
      later(t6 + 1900, () => { li[last].classList.remove('miss'); li[last].classList.add('arrive'); pill('busy', 'Energieausweis eingegangen …'); });
      later(t6 + 2700, () => final(li));
    },
  };
}

// ---------- B2B-Briefing (Dialog in drei Schritten) ----------
// Öffnet sich über „Unternehmenskonto anfragen“ (Hero, Tarife, Demo). Ohne JavaScript führen die Links zum Formular unten.
const BF = {
  roles: [['BROKER', 'Finanzierungsberater'], ['REALTOR', 'Immobilienmakler'], ['BANK', 'Bank / Sparkasse'], ['OTHER', 'Vermögensberater']],
  volume: ['1–10 Fälle', '10–30 Fälle', '30+ Fälle'],
  crm: ['Europace', 'eHyp', 'onOffice', 'Sonstige', 'Manuell / keine Schnittstelle'],
  pain: ['Unvollständige Unterlagen', 'Zeitaufwand Haushaltsrechnung', 'Bank-Rückfragen'],
};
let bfDlg = null;
function openBriefing(where, tr) {
  if (bfDlg) { bfDlg.remove(); bfDlg = null; }
  const ts = Date.now();
  const st = { step: 1, role: '', volume: '', crm: '', crmOther: '', pain: [] };
  const d = document.createElement('dialog');
  d.className = 'buy-dlg bf-dlg';
  d.setAttribute('aria-labelledby', 'bfH');
  const radio = (name, items, sel) => items.map(([v, l]) => `<button type="button" class="bf-opt" role="radio" aria-checked="${sel === v}" data-${name}="${esc(v)}">${esc(l)}</button>`).join('');
  const steps = ['Rolle', 'Bedarf', 'Zugang'];
  const render = () => {
    const s = st.step;
    const nav = `<ol class="bf-steps">${steps.map((t, i) => `<li${i + 1 === s ? ' aria-current="step"' : ''} class="${i + 1 < s ? 'done' : ''}"><b>0${i + 1}</b> ${t}</li>`).join('')}</ol>`;
    let body = '';
    if (s === 1) body = `<h3 class="bf-q" id="bfQ">Wie arbeiten Sie heute?</h3><div class="bf-grid" role="radiogroup" aria-labelledby="bfQ">${radio('role', BF.roles.map(([v, l]) => [v, l]), st.role)}</div><p class="bf-err" id="bfErr" role="alert"></p>`;
    if (s === 2) body = `<h3 class="bf-q" id="bfQv">Monatliches Fallvolumen</h3><div class="bf-row" role="radiogroup" aria-labelledby="bfQv">${radio('volume', BF.volume.map((v) => [v, v]), st.volume)}</div>
      <h3 class="bf-q" id="bfQc">Genutzte Schnittstelle / CRM</h3><div class="bf-row" role="radiogroup" aria-labelledby="bfQc">${radio('crm', BF.crm.map((v) => [v, v]), st.crm)}</div>
      <label class="bf-other"${st.crm === 'Sonstige' ? '' : ' hidden'}>Welche? (optional)<input id="bfCrmOther" maxlength="60" value="${esc(st.crmOther)}"></label>
      <h3 class="bf-q" id="bfQp">Wo liegt aktuell der größte Engpass? <small>Mehrfachauswahl</small></h3><div class="bf-row" role="group" aria-labelledby="bfQp">${BF.pain.map((v) => `<button type="button" class="bf-opt" aria-pressed="${st.pain.includes(v)}" data-pain="${esc(v)}">${esc(v)}</button>`).join('')}</div><p class="bf-err" id="bfErr" role="alert"></p>`;
    if (s === 3) body = `<h3 class="bf-q">Individueller Testzugang</h3><p class="bf-lead">Wir richten Ihren Zugang passend zu Ihren Angaben ein und melden uns in der Regel innerhalb von zwei Werktagen.</p>
      <form class="bf-form" id="bfForm" novalidate>
        <label>Name*<input name="name" required minlength="2" maxlength="120" autocomplete="name"><span class="bf-ferr"></span></label>
        <label>Unternehmen / Kanzlei*<input name="company" required minlength="2" maxlength="160" autocomplete="organization"><span class="bf-ferr"></span></label>
        <label>Geschäftliche E-Mail-Adresse*<input name="email" type="email" required maxlength="200" autocomplete="email"><span class="bf-ferr"></span></label>
        <label>Telefonnummer*<input name="phone" type="tel" required minlength="6" maxlength="40" autocomplete="tel"><span class="bf-ferr"></span></label>
        <label class="bf-check"><input type="checkbox" name="privacy" required> <span>Ich habe die <a href="/datenschutz" target="_blank" rel="noopener">Datenschutzhinweise</a> gelesen. Meine Angaben werden nur zur Bearbeitung dieser Anfrage verwendet.</span></label>
        <input name="website" tabindex="-1" autocomplete="off" class="bf-hp" aria-hidden="true">
      </form><p class="bf-err" id="bfErr" role="alert"></p>`;
    const foot = `<div class="bf-foot">${s > 1 ? '<button type="button" class="btn btn-outline" data-bf="back">Zurück</button>' : '<span></span>'}${s < 3 ? '<button type="button" class="btn btn-dark" data-bf="next">Weiter</button>' : '<button type="button" class="btn btn-dark" data-bf="send">Individuellen Testzugang anfordern</button>'}</div>`;
    d.innerHTML = `<div class="bf-in"><div class="bf-head"><div><span class="bf-kick">B2B-Briefing · 3 kurze Schritte</span><h2 id="bfH">Unternehmenskonto anfragen</h2></div><button type="button" class="bf-x" data-bf="close" aria-label="Schließen">×</button></div>${nav}<div class="bf-body">${body}</div>${foot}</div>`;
    wire();
  };
  const err = (t) => { const e = d.querySelector('#bfErr'); if (e) e.textContent = t; };
  const pick = (attr, v) => { st[attr] = v; d.querySelectorAll(`[data-${attr}]`).forEach((b) => b.setAttribute('aria-checked', String(b.dataset[attr] === v))); err(''); };
  const wire = () => {
    d.querySelectorAll('[data-role]').forEach((b) => b.onclick = () => pick('role', b.dataset.role));
    d.querySelectorAll('[data-volume]').forEach((b) => b.onclick = () => pick('volume', b.dataset.volume));
    d.querySelectorAll('[data-crm]').forEach((b) => b.onclick = () => { pick('crm', b.dataset.crm); const o = d.querySelector('.bf-other'); if (o) o.hidden = st.crm !== 'Sonstige'; });
    d.querySelectorAll('[data-pain]').forEach((b) => b.onclick = () => { const v = b.dataset.pain; st.pain = st.pain.includes(v) ? st.pain.filter((x) => x !== v) : [...st.pain, v]; b.setAttribute('aria-pressed', String(st.pain.includes(v))); err(''); });
    d.querySelector('#bfCrmOther')?.addEventListener('input', (e) => { st.crmOther = e.target.value; });
    // Pfeiltasten in Auswahlgruppen
    d.querySelectorAll('[role=radiogroup]').forEach((g) => g.addEventListener('keydown', (e) => {
      if (!/^Arrow/.test(e.key)) return; const bs = [...g.querySelectorAll('button')]; const i = bs.indexOf(document.activeElement); if (i < 0) return;
      e.preventDefault(); const n = bs[(i + (/Right|Down/.test(e.key) ? 1 : bs.length - 1)) % bs.length]; n.focus(); n.click();
    }));
    d.querySelectorAll('[data-bf]').forEach((b) => b.onclick = () => act(b.dataset.bf, b));
    const first = d.querySelector('.bf-body [aria-checked="true"], .bf-body button, .bf-body input');
    setTimeout(() => first?.focus({ preventScroll: true }), 30);
  };
  const fieldErr = (f) => {
    let ok = true;
    f.querySelectorAll('input[required]').forEach((i) => {
      const box = i.closest('label')?.querySelector('.bf-ferr'); let m = '';
      if (i.type === 'checkbox') { if (!i.checked) { ok = false; i.closest('label').classList.add('bf-bad'); } else i.closest('label').classList.remove('bf-bad'); return; }
      const v = i.value.trim();
      if (!v) m = 'Bitte ausfüllen.';
      else if (i.type === 'email' && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v)) m = 'Bitte eine gültige E-Mail-Adresse eingeben.';
      else if (i.name === 'phone' && v.replace(/\D/g, '').length < 6) m = 'Bitte eine erreichbare Telefonnummer eingeben.';
      else if (i.minLength > 0 && v.length < i.minLength) m = 'Bitte vollständig angeben.';
      i.setAttribute('aria-invalid', String(Boolean(m))); if (box) box.textContent = m; if (m) ok = false;
    });
    return ok;
  };
  const act = async (a, btn) => {
    if (a === 'close') { d.close(); return; }
    if (a === 'back') { st.step--; render(); return; }
    if (a === 'next') {
      if (st.step === 1 && !st.role) { err('Bitte wählen Sie Ihre Rolle.'); return; }
      if (st.step === 2 && (!st.volume || !st.crm)) { err(!st.volume ? 'Bitte wählen Sie Ihr monatliches Fallvolumen.' : 'Bitte wählen Sie Ihre Schnittstelle bzw. „Manuell“.'); return; }
      tr(`briefing_step_${st.step}_completed`, where); st.step++; render(); return;
    }
    if (a === 'send') {
      const f = d.querySelector('#bfForm');
      if (!fieldErr(f)) { err('Bitte prüfen Sie die markierten Angaben.'); f.querySelector('[aria-invalid="true"], .bf-bad input')?.focus(); return; }
      const v = Object.fromEntries(new FormData(f));
      const role = BF.roles.find(([k]) => k === st.role)?.[1] || st.role;
      const message = ['B2B-Briefing (Testzugang)', `Rolle: ${role}`, `Fallvolumen: ${st.volume}`, `Schnittstelle: ${st.crm}${st.crm === 'Sonstige' && st.crmOther.trim() ? ' – ' + st.crmOther.trim() : ''}`, `Engpässe: ${st.pain.length ? st.pain.join(', ') : '–'}`].join('\n');
      btn.disabled = true; btn.textContent = 'Wird gesendet …'; err('');
      let r = null, j = {};
      try {
        r = await fetch('/api/b2b/contact', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'demo', source: 'briefing', institutionType: st.role, name: v.name, company: v.company, email: v.email, phone: v.phone, message, privacy: true, website: v.website || '', ts }) });
        j = await r.json().catch(() => ({}));
      } catch { r = null; }
      if (r && r.ok) {
        tr('briefing_submitted', where);
        d.querySelector('.bf-steps')?.remove(); d.querySelector('.bf-foot').innerHTML = '<span></span><button type="button" class="btn btn-dark" data-bf="close">Schließen</button>';
        d.querySelector('.bf-body').innerHTML = `<div class="bf-done" role="status"><span class="bf-done-ic" aria-hidden="true">✓</span><h3>Vielen Dank. Wir haben Ihre Anfrage erhalten.</h3><p>Wir melden uns in der Regel innerhalb von zwei Werktagen mit Ihrem individuellen Testzugang.</p>${j.preview ? '<p class="bf-preview">Vorschau-Umgebung: Diese Anfrage wurde nicht gespeichert und nicht versendet.</p>' : ''}</div>`;
        d.querySelector('[data-bf="close"]').onclick = () => d.close(); d.querySelector('[data-bf="close"]').focus();
        return;
      }
      btn.disabled = false; btn.textContent = 'Individuellen Testzugang anfordern';
      err((j && j.error) || 'Senden hat nicht geklappt. Ihre Angaben bleiben erhalten – bitte erneut versuchen.');
      if (j && j.field === 'email') f.email?.focus();
    }
  };
  d.addEventListener('close', () => { document.body.classList.remove('bf-open'); d.remove(); bfDlg = null; });
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  document.body.append(d); bfDlg = d; document.body.classList.add('bf-open');
  render();
  if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
}

// ---------- Mobiler Sticky-CTA (nur /b2b) ----------
{
  const mk = () => {
    if (!document.querySelector('.bx-hero')) return false;
    document.getElementById('bxSticky')?.remove(); // aus dem Vorrendern übernommene Kopie ersetzen
    const s = document.createElement('div'); s.className = 'bx-sticky'; s.id = 'bxSticky'; s.hidden = true;
    s.innerHTML = '<a class="btn bx-sticky-go" href="#anfrage" data-briefing="sticky">B2B-Briefing starten <span aria-hidden="true">→</span></a>';
    document.body.append(s);
    const hero = document.querySelector('.bx-hero'), contact = document.getElementById('kontakt');
    const seen = new Map();
    const upd = () => { s.hidden = Boolean(seen.get(hero) || seen.get(contact)); };
    if ('IntersectionObserver' in window) { const io = new IntersectionObserver((es) => { es.forEach((x) => seen.set(x.target, x.isIntersecting)); upd(); }); [hero, contact].filter(Boolean).forEach((el) => io.observe(el)); }
    return true;
  };
  let n = 0; const tick = () => { if (!mk() && n++ < 40) setTimeout(tick, 50); }; tick();
}
