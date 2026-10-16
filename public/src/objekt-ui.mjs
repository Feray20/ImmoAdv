// Immobiliensuche (Weiterleitung zu Portalen) und Objekt-Analyse – gemeinsam genutzt von Startseite, Anwendung und internem Bereich.
// Rechtlicher Rahmen: Es werden keine Inhalte von Portalen geladen, gespeichert oder angezeigt.
// Die Suche baut nur Links zu den Suchseiten der Portale (Formate an öffentlich indexierten Portalseiten geprüft);
// die Analyse rechnet ausschließlich mit Angaben, die der Nutzer selbst einträgt.
import { GREST, kaufnebenkosten, budget, analyse, portalLinks } from './calc.mjs';

const SESSION = 'immoadv-auth-session-v1';
const $ = (id) => document.getElementById(id);
let root = null;
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const E = (x) => (x == null || Number.isNaN(x) ? '–' : x.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }));
const E2 = (x) => (x == null || Number.isNaN(x) ? '–' : x.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }));
const P = (x, d = 2) => (x == null || Number.isNaN(x) ? '–' : `${x.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d })} %`);
const D = (x, d = 2) => (x == null || Number.isNaN(x) ? '–' : x.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }));
const num = (id) => { const v = $(id)?.value; return v === '' || v == null ? 0 : Number(v); };
const val = (id) => $(id)?.value || '';
const table = (rows) => `<table class="bill-table"><tbody>${rows.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')}</tbody></table>`;
const tone = (v, good, warn) => (v == null ? 'na' : v >= good ? 'ok' : v >= warn ? 'warn' : 'bad');

const LAND_OPTS = Object.entries(GREST).map(([k, g]) => `<option value="${k}"${k === 'hessen' ? ' selected' : ''}>${g.name}</option>`).join('');
const F = (id, label, value = '', step = 'any', type = 'number') => `<label>${label}<input id="${id}" type="${type}" ${type === 'number' ? `step="${step}" min="0"` : ''} value="${esc(value)}"></label>`;

function renderSearch() {
  return `<section class="is-search" aria-label="Objektsuche">
  <div class="is-bar">
    <label class="is-what">Objektart<select id="s_art"><option value="wohnung">Wohnung kaufen</option><option value="haus">Haus kaufen</option><option value="mfh">Mehrfamilienhaus kaufen</option></select></label>
    <label class="is-where">Ort<input id="s_ort" type="text" placeholder="z. B. Darmstadt" autocomplete="off"></label>
    <label>Bundesland<select id="s_land">${LAND_OPTS}</select></label>
    <label>Preis ab (€)<input id="s_pmin" type="number" min="0" step="1000" value=""></label>
    <label>Preis bis (€)<input id="s_price" type="number" min="0" step="1000" value="350000"></label>
    <label>Fläche ab (m²)<input id="s_area" type="number" min="0" step="1" value="50"></label>
    <label>Zimmer ab<input id="s_rooms" type="number" min="0" step="0.5" value="2"></label>
  </div>
  <details class="is-more"><summary>Landkreis, Finanzierung und Mindestkapital</summary><div class="obj-grid">
    ${F('s_kreis', 'Landkreis (nur bei kreisangehörigen Gemeinden, z. B. Darmstadt-Dieburg)', '', 'any', 'text')}
    ${F('s_eq', 'Eigenkapital (€)', 60000)}${F('s_net', 'Haushaltsnetto pro Monat (€, optional)', '')}${F('s_out', 'Lebenshaltung und Raten pro Monat (€, optional)', '')}
    ${F('s_broker', 'Makler, Käuferanteil (%)', 3.57, '0.01')}${F('s_z', 'Sollzins p. a. (%)', 3.5, '0.01')}${F('s_t', 'Anfängliche Tilgung p. a. (%)', 2, '0.1')}
  </div></details>
  <div class="is-result" id="s_out_box" aria-live="polite"></div>
  <div class="is-portals" id="s_links"></div>
  <p class="form-note">Die Suche öffnet die Trefferlisten direkt bei den Portalen. ImmoAdv lädt, speichert und zeigt keine Inserate. Die Portalnamen sind Marken ihrer Inhaber; ImmoAdv steht mit ihnen in keiner Verbindung. Gefundenes Objekt? Link und Kernfakten unten in die Analyse übernehmen.</p>
</section>`;
}

function updateSearch() {
  const land = val('s_land'), price = num('s_price');
  const links = portalLinks({ land, kreis: val('s_kreis'), ort: val('s_ort'), art: val('s_art'), minPrice: num('s_pmin'), maxPrice: price, minArea: num('s_area'), minRooms: num('s_rooms') });
  $('s_links').innerHTML = links.map((l) => `<a class="is-portal" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer nofollow"><strong>Treffer bei ${l.name} öffnen ↗</strong><small>Übergeben: ${esc(l.filters)}</small></a>`).join('');
  const nk = price > 0 ? kaufnebenkosten({ price, land, brokerPct: num('s_broker') }) : null;
  const eq = num('s_eq');
  const rows = [];
  if (nk) {
    rows.push(['Kaufnebenkosten beim Höchstpreis', `${E(nk.total)} (${P(nk.totalPct)})`]);
    rows.push(['<strong>Mindestkapital</strong> (Nebenkosten – werden selten finanziert)', `<strong>${E(nk.total)}</strong> ${eq >= nk.total ? '<span class="st ok">gedeckt</span>' : '<span class="st bad">nicht gedeckt</span>'}`]);
    rows.push(['Empfohlen: Nebenkosten + 10 % des Kaufpreises', `${E(nk.total + price * 0.1)} ${eq >= nk.total + price * 0.1 ? '<span class="st ok">gedeckt</span>' : '<span class="st warn">nicht gedeckt</span>'}`]);
    const loan = Math.max(0, nk.allIn - eq), r = (loan * (num('s_z') + num('s_t')) / 100) / 12;
    rows.push(['Darlehen und Monatsrate beim Höchstpreis', `${E(loan)} · ${E2(r)} / Monat`]);
  }
  if (num('s_net') > 0) {
    const b = budget({ netIncome: num('s_net'), expenses: num('s_out'), equity: eq, ratePa: num('s_z') / 100, repaymentPa: num('s_t') / 100, land, brokerPct: num('s_broker') });
    if (b) rows.push(['Preisrahmen laut Haushalt (20 % Puffer)', `bis ${E(b.price)} · Rate ${E2(b.rate)}`]);
  }
  $('s_out_box').innerHTML = rows.length ? table(rows) : '<p class="form-note">Höchstpreis eintragen, um Mindestkapital und Rate zu sehen.</p>';
}

// ---------- Objekt-Analyse ----------
function renderAnalyse() {
  return `<section class="an" aria-label="Objekt-Analyse">
  <h2>Objekt-Analyse</h2>
  <div class="an-bar" id="a_bar" aria-live="polite"></div>
  <div class="an-grid">
  <article class="dash-card"><h3>Inserat und Lage</h3><div class="obj-grid">
    ${F('a_url', 'Link zum Inserat (wird nur verlinkt)', '', 'any', 'url')}${F('a_addr', 'Adresse oder Lagebezeichnung', '', 'any', 'text')}
    <label>Bundesland<select id="a_land">${LAND_OPTS}</select></label>
    <label>Objektart<select id="a_art"><option value="ETW">Eigentumswohnung</option><option value="EFH">Einfamilienhaus</option><option value="MFH">Mehrfamilienhaus</option></select></label>
  </div></article>
  <article class="dash-card"><h3>Kernfakten</h3><div class="obj-grid">
    ${F('a_price', 'Kaufpreis (€)', '', '1000')}${F('a_area', 'Wohnfläche (m²)', '', '0.5')}${F('a_rooms', 'Zimmer', '', '0.5')}${F('a_year', 'Baujahr', '', '1')}
    <label>Effizienzklasse<select id="a_ec"><option value="">unbekannt</option>${['A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((c) => `<option>${c}</option>`).join('')}</select></label>
    ${F('a_broker', 'Makler, Käuferanteil (%)', 3.57, '0.01')}
  </div></article>
  <article class="dash-card"><h3>Miete und Mietspiegel</h3><div class="obj-grid">
    ${F('a_rent', 'Ist-Nettokaltmiete (€/Monat, leer bei Leerstand)', '')}${F('a_vq', 'Ortsübliche Vergleichsmiete laut Mietspiegel (€/m²)', '', '0.01')}
    <label class="consent"><input type="checkbox" id="a_mpb"> Gebiet mit Mietpreisbremse</label>
    ${F('a_vac', 'Mietausfall (%)', 2, '0.5')}${F('a_nonrec', 'Nicht umlagefähige Kosten (€/Monat, z. B. Verwaltung)', '', '1')}${F('a_mqm', 'Instandhaltung (€/m² und Monat)', 1, '0.05')}
  </div><p class="form-note" id="a_mslink"></p></article>
  <article class="dash-card"><h3>Finanzierung</h3><div class="obj-grid">
    ${F('a_eq', 'Eigenkapital (€)', 60000)}${F('a_z', 'Sollzins p. a. (%)', 3.5, '0.01')}${F('a_t', 'Anfängliche Tilgung p. a. (%)', 2, '0.1')}${F('a_fix', 'Zinsbindung (Jahre)', 10, '1')}
  </div></article>
  <article class="dash-card"><h3>Steuer und Wert (für Spezialisten)</h3><div class="obj-grid">
    ${F('a_bs', 'Gebäudeanteil (%)', 75, '1')}<label>AfA-Satz<select id="a_afa"><option value="2">2 % (1925–2022)</option><option value="2.5">2,5 % (vor 1925)</option><option value="3">3 % (ab 2023)</option></select></label>${F('a_tax', 'Grenzsteuersatz (%)', 42, '1')}
    ${F('a_lv', 'Bodenwert (€, für Ertragswert)', '')}${F('a_lz', 'Liegenschaftszins (%)', '', '0.1')}${F('a_rnd', 'Restnutzungsdauer (Jahre)', '', '1')}
  </div><p class="form-note">Bodenwert: Bodenrichtwert × Grundstücksanteil (BORIS des Landes). Liegenschaftszins und Restnutzungsdauer: Grundstücksmarktbericht des Gutachterausschusses.</p></article>
  </div>
  <div class="an-out" id="a_out"></div>
  <p class="an-actions" id="a_actions" hidden><button class="btn btn-dark" id="a_keep" type="button">In Merkliste</button> <button class="btn btn-outline" id="a_pdf" type="button">Analyse als PDF</button> <button class="btn btn-outline" id="a_save" type="button">Als Objekt im Konto speichern</button> <button class="btn btn-ghost" id="a_print" type="button">Drucken</button> <span class="form-note" id="a_msg" role="status"></span></p>
</section>`;
}

const PENDING = 'ia-pending-object';
const LIST = 'ia-intern-list-v1';
let last = null;
const token = () => { try { return JSON.parse(localStorage.getItem(SESSION) || 'null')?.access_token || ''; } catch { return ''; } };
function updateAnalyse() {
  const ort = val('a_addr');
  $('a_mslink').innerHTML = `Mietspiegel: Wert aus dem offiziellen Mietspiegel der Gemeinde übernehmen${ort ? ` – <a class="ck-link" href="https://www.google.com/search?q=${encodeURIComponent('Mietspiegel ' + ort)}" target="_blank" rel="noopener noreferrer">Mietspiegel ${esc(ort)} suchen ↗</a>` : ''}. Ohne Wert rechnet die Analyse mit der Ist-Miete.`;
  const a = analyse({ price: num('a_price'), area: num('a_area'), land: val('a_land'), brokerPct: num('a_broker'), rent: num('a_rent'), vergleichQm: num('a_vq'), mietpreisbremse: $('a_mpb').checked,
    vacancyPct: num('a_vac'), nonRecoverable: num('a_nonrec'), maintenanceQm: num('a_mqm'), equity: num('a_eq'), ratePct: num('a_z'), repaymentPct: num('a_t'), fixedYears: num('a_fix'),
    buildingSharePct: num('a_bs'), afaPct: Number(val('a_afa')), taxPct: num('a_tax'), landValue: num('a_lv'), capRatePct: num('a_lz'), remainingLife: num('a_rnd'), yearBuilt: num('a_year'), energyClass: val('a_ec') });
  const url = val('a_url').trim();
  const okUrl = /^https:\/\/[^\s]+$/i.test(url);
  if (!a) { $('a_bar').innerHTML = '<p class="form-note">Kaufpreis eintragen – die Leiste füllt sich sofort.</p>'; $('a_out').innerHTML = ''; $('a_actions').hidden = true; last = null; return; }
  const chip = (label, v, cls = '') => `<div class="an-chip ${cls}"><small>${label}</small><strong>${v}</strong></div>`;
  $('a_bar').innerHTML = `<div class="an-head"><div><strong>${esc(ort || 'Objekt ohne Adresse')}</strong><span>${esc(val('a_art'))}${num('a_area') ? ` · ${D(num('a_area'), 0)} m²` : ''}${num('a_rooms') ? ` · ${D(num('a_rooms'), 1)} Zi.` : ''}${num('a_year') ? ` · Bj. ${num('a_year')}` : ''}</span></div>${okUrl ? `<a class="btn btn-outline" href="${esc(url)}" target="_blank" rel="noopener noreferrer nofollow">Inserat öffnen ↗</a>` : ''}</div>
  <div class="an-chips">${chip('Kaufpreis', E(a.price))}${chip('€/m²', a.pricePerQm ? E(a.pricePerQm) : '–')}${chip('Kaufpreisfaktor', a.factor == null ? '–' : D(a.factor, 1), a.factor == null ? 'na' : a.factor <= 22 ? 'ok' : a.factor <= 28 ? 'warn' : 'bad')}
  ${chip('Bruttorendite', P(a.grossYield), a.grossYield == null ? 'na' : '')}${chip('Cashflow v. St.', E2(a.cashflow), a.rent ? (a.cashflow >= 0 ? 'ok' : 'bad') : 'na')}${chip('Cashflow n. St.', E2(a.cashflowAfterTax), a.rent ? (a.cashflowAfterTax >= 0 ? 'ok' : 'warn') : 'na')}
  ${chip('DSCR', a.dscr == null ? '–' : D(a.dscr), tone(a.dscr, 1.2, 1))}${chip('Mindestkapital', E(a.nebenkosten), num('a_eq') >= a.nebenkosten ? 'ok' : 'bad')}</div>
  <p class="form-note an-src">Miete: ${a.rentSource === 'ist' ? 'Ist-Miete' : a.rentSource === 'mietspiegel' ? 'Mietspiegel × Fläche (keine Ist-Miete angegeben)' : 'nicht angegeben – Rendite und Cashflow nicht aussagekräftig'}. Ampelgrenzen beim Faktor (≤ 22 grün, ≤ 28 gelb) sind ImmoAdv-Annahmen.</p>`;
  const SECTIONS = [
    { title: 'Kosten und Kapital', rows: [['Kaufnebenkosten', `${E(a.nebenkosten)} (${P(a.nkPct)})`], ['Gesamtkosten', E(a.allIn)], ['Gesamtkosten je m²', a.allInPerQm ? E(a.allInPerQm) : '–'],
      ['Mindestkapital (Nebenkosten)', E(a.nebenkosten)], ['Empfohlen (+ 10 % Kaufpreis)', E(a.nebenkosten + a.price * 0.1)], ['Darlehen / Beleihung', `${E(a.loan)} · ${P(a.ltv, 1)} vom Kaufpreis`]] },
    { title: 'Miete und Mietrecht', rows: [['Angesetzte Miete', `${E2(a.rent)} (${a.rentPerQm ? E2(a.rentPerQm) + '/m²' : '–'})`], ['Miete laut Mietspiegel', a.rentMarket ? E2(a.rentMarket) : 'kein Wert eingetragen'],
      ['Abstand Ist zu Mietspiegel', a.rentGapPct == null ? '–' : `${a.rentGapPct > 0 ? '+' : ''}${D(a.rentGapPct, 1)} % Potenzial`], ['Obergrenze Mietpreisbremse', a.rentCap ? E2(a.rentCap) : 'nicht relevant / keine Angabe'],
      ['Break-even-Miete (Cashflow 0)', E2(a.rentBreakEven)], ['Miete für DSCR 1,2', E2(a.rentDscr12)], ['Miete für 5 % Nettorendite', E2(a.rentYield5)]] },
    { title: 'Rendite', rows: [['Bruttomietrendite', P(a.grossYield)], ['Nettomietrendite (auf Gesamtkosten)', P(a.netYield)], ['Kaufpreisfaktor', a.factor == null ? '–' : D(a.factor, 1)], ['Cash-on-Cash (Cashflow / EK)', P(a.cashOnCash)],
      ['Eigenkapitalrendite inkl. Tilgung', P(a.equityReturn)], ['Reinertrag (NOI) pro Monat', E2(a.noi)]] },
    { title: 'Finanzierung und Risiko', rows: [['Monatsrate', `${E2(a.rate)} (Zins ${E2(a.interestM)}, Tilgung ${E2(a.principalM)})`], ['DSCR (Kapitaldienstdeckung)', a.dscr == null ? '–' : D(a.dscr)], ['ICR (Zinsdeckung)', a.icr == null ? '–' : D(a.icr)],
      ['Debt Yield', P(a.debtYield)], ['Kipp-Zins (Cashflow 0 nach Zinsbindung)', P(a.kippZins)], ['Rate bei +2 Prozentpunkten', E2(a.rateStress)], ['Restschuld nach Zinsbindung', E(a.restAfterFixed)], ['Volltilgung nach (gleicher Zins)', a.payoffYears ? `${D(a.payoffYears, 1)} Jahren` : '–']] },
    { title: 'Steuer (Jahr 1, Modell)', rows: [['AfA pro Jahr', E(a.afa)], ['Steuerliches Ergebnis', E(a.taxable)], [a.tax < 0 ? 'Steuervorteil (Erstattung)' : 'Steuerlast', E(Math.abs(a.tax))], ['Steuereffekt pro Monat', E2(-a.tax / 12)], ['Cashflow nach Steuern pro Monat', E2(a.cashflowAfterTax)]] },
    { title: 'Wert', rows: [['Ertragswert (vereinfacht, ImmoWertV)', a.ertragswert ? E(a.ertragswert) : 'Bodenwert, Liegenschaftszins und RND fehlen'], ['Kaufpreis zum Ertragswert', a.ertragswertGapPct == null ? '–' : `${a.ertragswertGapPct > 0 ? '+' : ''}${D(a.ertragswertGapPct, 1)} %`]] },
  ];
  last = { a, ort, url: okUrl ? url : '', sections: SECTIONS,
    chips: [['Kaufpreis', E(a.price)], ['€/m²', a.pricePerQm ? E(a.pricePerQm) : '–'], ['Kaufpreisfaktor', a.factor == null ? '–' : D(a.factor, 1)], ['Bruttorendite', P(a.grossYield)],
      ['Cashflow v. St.', E2(a.cashflow)], ['Cashflow n. St.', E2(a.cashflowAfterTax)], ['DSCR', a.dscr == null ? '–' : D(a.dscr)], ['Mindestkapital', E(a.nebenkosten)]],
    subtitle: `${val('a_art')}${num('a_area') ? ` · ${D(num('a_area'), 0)} m²` : ''}${num('a_rooms') ? ` · ${D(num('a_rooms'), 1)} Zimmer` : ''}${num('a_year') ? ` · Baujahr ${num('a_year')}` : ''} · ${GREST[val('a_land')].name}` };
  $('a_out').innerHTML = `<div class="an-grid">${SECTIONS.map((x) => `<article class="dash-card"><h3>${x.title}</h3>${table(x.rows.map((r) => [esc(r[0]), esc(r[1])]))}</article>`).join('')}</div>
  ${a.hints.length ? `<article class="dash-card"><h3>Hinweise</h3><ul class="plain-list">${a.hints.map((h) => `<li>${esc(h)}</li>`).join('')}</ul></article>` : ''}
  <p class="faq-disclaimer">Reines technisches Analyse-, Informations- und Vorbereitungsinstrument. Keine Rechts-, Steuer- oder Finanzierungsberatung gem. § 34i GewO / KWG. Alle Werte beruhen auf Ihren Eingaben; Inseratsinhalte werden nicht übernommen.</p>`;
  $('a_actions').hidden = false;
}

function bindActions() {
  $('a_print').onclick = () => window.print();
  $('a_keep').onclick = () => {
    if (!last) return; const { a, ort } = last;
    const inputs = {}; root.querySelectorAll('.an input, .an select').forEach((el) => { inputs[el.id] = el.type === 'checkbox' ? el.checked : el.value; });
    const item = { id: Date.now().toString(36), at: new Date().toISOString(), name: ort || 'Objekt ohne Adresse', url: last.url, inputs,
      k: { price: a.price, pqm: a.pricePerQm, factor: a.factor, gross: a.grossYield, cf: a.cashflow, cfat: a.cashflowAfterTax, dscr: a.dscr, minCap: a.nebenkosten } };
    const list = readList(); list.unshift(item); writeList(list.slice(0, 50)); renderList(); $('a_msg').textContent = ' In der Merkliste gespeichert (nur in diesem Browser).';
  };
  $('a_pdf').onclick = async () => {
    if (!last) return; const { a } = last;
    const b = $('a_pdf'); b.disabled = true; $('a_msg').textContent = ' PDF wird erstellt …';
    try {
      const body = { title: last.ort || 'Objekt-Analyse', subtitle: last.subtitle, url: last.url, chips: last.chips, sections: last.sections, hints: a.hints };
      const r = await fetch('/api/analyse-pdf', { method: 'POST', headers: { Authorization: 'Bearer ' + token(), 'content-type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw Error(j.error || 'PDF fehlgeschlagen.'); }
      const blob = await r.blob(), l = document.createElement('a'); l.href = URL.createObjectURL(blob); l.download = 'ImmoAdv_Analyse.pdf'; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(l.href), 5000);
      $('a_msg').textContent = ' PDF erstellt.';
    } catch (e) { $('a_msg').textContent = ' ' + e.message; }
    b.disabled = false;
  };
  $('a_save').onclick = () => {
    if (!last) return; const { a, ort } = last;
    const nk = kaufnebenkosten({ price: a.price, land: val('a_land'), brokerPct: num('a_broker') });
    const o = { name: (ort || 'Objekt aus Analyse').slice(0, 160), price: a.price, rent: a.rent, area: num('a_area'), yearBuilt: num('a_year'), equity: num('a_eq'), interestPct: num('a_z'), repaymentPct: num('a_t'),
      fixedYears: num('a_fix'), loan: Math.round(a.loan), nonRecoverable: num('a_nonrec'), maintenance: Math.round(num('a_mqm') * num('a_area') * 100) / 100, vacancyPct: num('a_vac'),
      purchaseCostPct: nk.totalPct, grestPct: GREST[val('a_land')].pct, notaryPct: 2, brokerPct: num('a_broker'), buildingSharePct: num('a_bs'), marginalTaxPct: num('a_tax'),
      vergleichsmieteQm: num('a_vq'), mietpreisbremse: $('a_mpb').checked, efficiencyClass: val('a_ec'), liegenschaftszinsPct: num('a_lz'), restnutzungsdauer: num('a_rnd') };
    try { localStorage.setItem(PENDING, JSON.stringify({ ...o, source: '/intern/objektsuche', at: Date.now() })); location.href = '/app/dashboard'; } catch { alert('Speichern im Browser nicht möglich.'); }
  };
}

const readList = () => { try { return JSON.parse(localStorage.getItem(LIST) || '[]'); } catch { return []; } };
const writeList = (l) => { try { localStorage.setItem(LIST, JSON.stringify(l)); } catch { /* ohne Speicher */ } };
function renderList() {
  const box = $('m_list'); if (!box) return;
  const l = readList();
  if (!l.length) { box.innerHTML = '<p class="form-note">Noch keine Objekte gemerkt. Analyse ausfüllen und „In Merkliste“ wählen.</p>'; return; }
  const best = (k, hi) => { const v = l.map((x) => x.k[k]).filter((x) => x != null); return v.length > 1 ? (hi ? Math.max(...v) : Math.min(...v)) : null; };
  const cell = (x, k, f, hi) => { const b = best(k, hi); return x.k[k] == null ? '–' : x.k[k] === b ? `<strong>${f(x.k[k])}</strong>` : f(x.k[k]); };
  box.innerHTML = `<div class="calc-out"><table class="bill-table"><thead><tr><th>Objekt</th><th>Kaufpreis</th><th>€/m²</th><th>Faktor</th><th>Brutto</th><th>CF v. St.</th><th>CF n. St.</th><th>DSCR</th><th>Mindestkapital</th><th></th></tr></thead><tbody>${l.map((x) => `<tr><td>${x.url ? `<a class="ck-link" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer nofollow">${esc(x.name)}</a>` : esc(x.name)}<br><small class="form-note">${new Date(x.at).toLocaleDateString('de-DE')}</small></td><td>${cell(x, 'price', E, false)}</td><td>${cell(x, 'pqm', E, false)}</td><td>${cell(x, 'factor', (v) => D(v, 1), false)}</td><td>${cell(x, 'gross', (v) => P(v), true)}</td><td>${cell(x, 'cf', E2, true)}</td><td>${cell(x, 'cfat', E2, true)}</td><td>${cell(x, 'dscr', (v) => D(v), true)}</td><td>${cell(x, 'minCap', E, false)}</td><td><button class="text-btn" data-load="${x.id}" type="button">Laden</button> <button class="text-btn del" data-drop="${x.id}" type="button">Entfernen</button></td></tr>`).join('')}</tbody></table></div><p class="form-note">Fett: jeweils bester Wert. Die Merkliste liegt nur in diesem Browser.</p>`;
  box.querySelectorAll('[data-drop]').forEach((b) => b.onclick = () => { writeList(readList().filter((x) => x.id !== b.dataset.drop)); renderList(); });
  box.querySelectorAll('[data-load]').forEach((b) => b.onclick = () => {
    const x = readList().find((y) => y.id === b.dataset.load); if (!x) return;
    Object.entries(x.inputs).forEach(([id, v]) => { const el = $(id); if (!el) return; if (el.type === 'checkbox') el.checked = v; else el.value = v; });
    updateAnalyse(); $('a_bar').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

// Baut Suche, Analyse und Merkliste in einen Container. opts.pdf: Analyse-PDF anbieten.
export function mountObjekt(container, opts = {}) {
  root = container;
  root.insertAdjacentHTML('beforeend', `<h2 class="is-h">Immobiliensuche</h2>${renderSearch()}${renderAnalyse()}<section class="dash-card"><h2>Merkliste</h2><div id="m_list"></div></section>`);
  if (!opts.pdf) $('a_pdf')?.remove();
  const KEY = 'ia-objekt-v1';
  const ids = [...root.querySelectorAll('.is-search input, .is-search select, .an input, .an select')].map((e) => e.id).filter(Boolean);
  try { const s = JSON.parse(localStorage.getItem(KEY) || '{}'); ids.forEach((id) => { if (s[id] !== undefined) { const el = $(id); if (el.type === 'checkbox') el.checked = s[id]; else el.value = s[id]; } }); } catch { /* ohne Speicher */ }
  const save = () => { try { const o = {}; ids.forEach((id) => { const el = $(id); o[id] = el.type === 'checkbox' ? el.checked : el.value; }); localStorage.setItem(KEY, JSON.stringify(o)); } catch { /* ohne Speicher */ } };
  const q = new URLSearchParams(location.search);
  [['ort', 's_ort'], ['land', 's_land'], ['art', 's_art'], ['preisab', 's_pmin'], ['preis', 's_price'], ['flaeche', 's_area'], ['zimmer', 's_rooms']].forEach(([k, id]) => { if (q.get(k) && $(id)) $(id).value = q.get(k); });
  root.addEventListener('input', (e) => { if (!e.target.id) return; if (e.target.id.startsWith('s_')) updateSearch(); else if (e.target.id.startsWith('a_')) updateAnalyse(); save(); });
  root.addEventListener('change', (e) => { if (e.target.tagName !== 'SELECT' && e.target.type !== 'checkbox') return; if (e.target.id.startsWith('s_')) updateSearch(); else updateAnalyse(); save(); });
  bindActions(); updateSearch(); updateAnalyse(); renderList();
}
