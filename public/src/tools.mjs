// Bindet Rechner, Fristen und Szenarien an den gemeinsamen Rechenkern (calc.mjs).
import { anschluss, verkauf, indexmiete, staffelmiete, kaufpreisaufteilung, grenze15, fristen, toICS, GREST, kaufnebenkosten, einstieg, tilgungsplan, tilgungsplanCSV, budget, scorecard } from './calc.mjs';

const $ = (id) => document.getElementById(id);
const num = (id) => { const v = $(id)?.value; return v === '' || v == null ? 0 : Number(v); };
const val = (id) => $(id)?.value || '';
const chk = (id) => Boolean($(id)?.checked);
const E = (x) => (x ?? 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
const P = (x, d = 2) => `${(x ?? 0).toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d })} %`;
const D = (s) => (s ? new Date(s + 'T00:00:00Z').toLocaleDateString('de-DE', { timeZone: 'UTC' }) : '–');
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const table = (rows, head) => `<table class="bill-table">${head ? `<thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead>` : ''}<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
const flag = (ok, yes, no) => `<span class="st ${ok ? 'ok' : 'bad'}">${ok ? yes : no}</span>`;
const watch = (ids, fn) => { ids.forEach((id) => $(id)?.addEventListener('input', fn)); ids.forEach((id) => $(id)?.addEventListener('change', fn)); fn(); };
const KEY = (k) => `ia-tool-${k}`;
// Werte aus dem Link (#feld=wert) haben Vorrang, z. B. aus dem Konto übernommene Objektdaten.
const fromHash = new URLSearchParams(location.hash.slice(1));
const remember = (k, ids) => {
  try { const s = JSON.parse(localStorage.getItem(KEY(k)) || '{}'); ids.forEach((id) => { if (s[id] !== undefined && $(id)) { if ($(id).type === 'checkbox') $(id).checked = s[id]; else $(id).value = s[id]; } }); } catch {}
  const save = () => { try { const o = {}; ids.forEach((id) => { if ($(id)) o[id] = $(id).type === 'checkbox' ? $(id).checked : $(id).value; }); localStorage.setItem(KEY(k), JSON.stringify(o)); } catch {} };
  ids.forEach((id) => { if (fromHash.has(id) && $(id)) $(id).value = fromHash.get(id); });
  ids.forEach((id) => $(id)?.addEventListener('change', save));
  share(ids);
};
// „Link zum Ergebnis“: Eingaben als #feld=wert im Link, damit Ergebnisse geteilt oder gemerkt werden können.
function share(ids) {
  const first = ids.map($).find(Boolean);
  const card = first?.closest('.dash-card, .wz, #wz, article');
  if (!card || card.querySelector('.share-btn')) return;
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'btn btn-outline share-btn'; b.textContent = 'Link zum Ergebnis kopieren';
  const note = document.createElement('span'); note.className = 'form-note share-note'; note.setAttribute('role', 'status');
  b.onclick = async () => {
    const q = new URLSearchParams();
    ids.forEach((id) => { const el = $(id); if (el && el.type !== 'checkbox' && el.value !== '') q.set(id, el.value); });
    const url = `${location.origin}${location.pathname}#${q.toString()}`;
    try { await navigator.clipboard.writeText(url); note.textContent = ' Link kopiert.'; }
    catch { history.replaceState(null, '', url); note.textContent = ' Link steht jetzt in der Adresszeile.'; }
  };
  const wrap = document.createElement('p'); wrap.className = 'share-row'; wrap.append(b, note);
  card.append(wrap);
}
document.querySelectorAll('.calc-out').forEach((e) => e.setAttribute('aria-live', 'polite'));

// Indexmiete
if ($('ix_out')) {
  const ids = ['ix_r', 'ix_a', 'ix_b', 'ix_l', 'ix_e'];
  watch(ids, () => {
    const r = indexmiete({ rent: num('ix_r'), indexOld: num('ix_a'), indexNew: num('ix_b'), lastChange: val('ix_l'), effective: val('ix_e') });
    if (!r) { $('ix_out').innerHTML = '<p class="form-note">Bitte beide Indexwerte eintragen (VPI, Basis 2020 = 100).</p>'; return; }
    const rows = [['Veränderung des Index', P(r.changePct)], ['Neue Nettokaltmiete', `<strong>${E(r.newRent)}</strong>`], ['Differenz pro Monat', E(r.diff)]];
    if (r.earliest) rows.push(['Frühestens wirksam ab', `${D(r.earliest)} ${flag(r.timingOk, 'Termin passt', 'zu früh')}`]);
    $('ix_out').innerHTML = table(rows);
  });
}

// Staffelmiete
if ($('st_out')) {
  const ids = ['st_a', 'st_v', 'st_b', ...[0, 1, 2, 3].flatMap((i) => ['st_d' + i, 'st_r' + i])];
  watch(ids, () => {
    const steps = [0, 1, 2, 3].map((i) => ({ date: val('st_d' + i), rent: num('st_r' + i) }));
    const res = staffelmiete({ steps, area: num('st_a'), vergleichsmieteQm: num('st_v'), bremse: chk('st_b') });
    if (!res.length) { $('st_out').innerHTML = '<p class="form-note">Bitte mindestens eine Staffel mit Datum und Betrag eintragen.</p>'; return; }
    const head = ['Ab', 'Miete', 'Erhöhung', 'Abstand ≥ 1 Jahr', ...(res[0].cap !== null ? ['Mietpreisbremse'] : [])];
    const rows = res.map((x) => [D(x.date), E(x.rent), x.increase ? `${E(x.increase)} (${P(x.increasePct)})` : '–', flag(x.gapOk, 'ja', 'nein'), ...(x.cap !== null ? [flag(x.capOk, `≤ ${E(x.cap)}`, `über ${E(x.cap)}`)] : [])]);
    $('st_out').innerHTML = table(rows, head);
  });
}

// Kaufpreisaufteilung und 15-%-Grenze
if ($('kp_out')) {
  const ids = ['kp_p', 'kp_n', 'kp_l', 'kp_b', 'kp_ms', 'kp_mt', 'kp_s'];
  watch(ids, () => {
    const k = kaufpreisaufteilung({ price: num('kp_p'), landArea: num('kp_l'), bodenrichtwert: num('kp_b'), meaShare: num('kp_ms') || 1, meaTotal: num('kp_mt') || 1 });
    const g = grenze15({ price: num('kp_p'), purchaseCostPct: num('kp_n'), buildingSharePct: k.buildingSharePct, spentNet: num('kp_s') });
    $('kp_out').innerHTML = table([
      ['Bodenwert (anteilig)', E(k.land)], ['Gebäudewert', E(k.building)], ['Gebäudeanteil', `<strong>${P(k.buildingSharePct)}</strong>`],
      ['Gebäude-Anschaffungskosten inkl. Nebenkosten', E(g.akGebaeude)], ['15-%-Grenze (netto, 3 Jahre)', `<strong>${E(g.limit)}</strong>`],
      ['Geplante Instandsetzung', `${E(g.spent)} ${flag(!g.exceeded, `${E(g.headroom)} Spielraum`, 'Grenze überschritten')}`],
    ]) + (g.exceeded ? '<p class="form-note">Bei Überschreitung werden die Kosten nicht sofort abgezogen, sondern über die Nutzungsdauer abgeschrieben. Mit Steuerberatung abstimmen.</p>' : '');
  });
}

// Fristen
if ($('fr_out')) {
  const ids = ['fr_p', 'fr_a', 'fr_z', 'fr_m', 'fr_e', 'fr_i'];
  remember('fristen', ids);
  let last = [];
  watch(ids, () => {
    last = fristen({ purchaseDate: val('fr_p'), payoutDate: val('fr_a'), fixedYears: num('fr_z'), lastRentChange: val('fr_m'), indexRent: chk('fr_i'), energyCertDate: val('fr_e') });
    $('fr_ics').disabled = !last.length;
    if (!last.length) { $('fr_out').innerHTML = '<p>Bitte mindestens das Kaufvertragsdatum eintragen.</p>'; return; }
    const today = new Date().toISOString().slice(0, 10);
    $('fr_out').innerHTML = `<ol class="frist-list">${last.map((e) => `<li class="${e.date < today ? 'past' : ''}${e.kind === 'hinweis' ? ' hint' : ''}"><time datetime="${e.date}">${D(e.date)}</time><div><strong>${esc(e.title)}</strong><p>${esc(e.detail)}</p><small>${esc(e.source)}</small></div></li>`).join('')}</ol>`;
  });
  $('fr_ics')?.addEventListener('click', () => {
    if (!last.length) return;
    const blob = new Blob([toICS(last)], { type: 'text/calendar;charset=utf-8' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'ImmoAdv_Fristen.ics' });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
}

// Anschlussfinanzierung
if ($('an_out')) {
  const ids = ['an_l', 'an_i', 'an_t', 'an_z', 'an_r', 'an_v', 'an_n', 'an_m', 'an_t2'];
  remember('anschluss', ids);
  watch(ids, () => {
    const noi = num('an_r') * (1 - num('an_v') / 100) - num('an_n') - num('an_m');
    const a = anschluss({ loan: num('an_l'), ratePa: num('an_i') / 100, repaymentPa: num('an_t') / 100, fixedYears: num('an_z'), noiMonthly: noi, newRepaymentPa: num('an_t2') / 100 });
    const kipp = a.kippPunktPa === null ? 'nicht berechenbar' : a.kippPunktPa <= 0 ? 'bereits bei 0 % negativ' : P(a.kippPunktPa * 100);
    $('an_out').innerHTML = table([['Rate heute', E(a.oldRate)], ['Überschuss vor Rate / Monat', E(noi)], [`Restschuld nach ${num('an_z')} Jahren`, `<strong>${E(a.rest)}</strong>`], ['Kipp-Punkt (Cashflow = 0)', `<strong>${kipp}</strong>`]])
      + table(a.rows.map((r) => [P(r.ratePa * 100), E(r.rate), (r.diff > 0 ? '+' : '') + E(r.diff), `<span class="${r.cashflow < 0 ? 'neg' : 'pos'}">${(r.cashflow > 0 ? '+' : '') + E(r.cashflow)}</span>`]), ['Anschlusszins', 'Neue Rate', 'Differenz', 'Cashflow v. St.']);
  });
}

// Verkauf
if ($('vk_out')) {
  const ids = ['vk_p', 'vk_n', 'vk_g', 'vk_a', 'vk_y', 'vk_w', 'vk_k', 'vk_l', 'vk_i', 'vk_t', 'vk_s'];
  remember('verkauf', ids);
  watch(ids, () => {
    const v = verkauf({ price: num('vk_p'), purchaseCostPct: num('vk_n'), buildingSharePct: num('vk_g'), afaRatePa: num('vk_a') / 100, years: num('vk_y'), growthPa: num('vk_w') / 100, saleCostPct: num('vk_k'), loan: num('vk_l'), ratePa: num('vk_i') / 100, repaymentPa: num('vk_t') / 100, taxPct: num('vk_s') });
    $('vk_out').innerHTML = table([
      ['Angenommener Verkaufspreis', E(v.value)], ['Erlös nach Verkaufskosten', E(v.saleNet)],
      ['Anschaffungskosten inkl. Nebenkosten', E(v.ak)], ['In Anspruch genommene AfA', E(v.afaTaken)], ['Restbuchwert', E(v.book)],
      ['Veräußerungsgewinn', `<strong>${E(v.gain)}</strong>`],
      ['Spekulationsfrist', v.within10 ? flag(false, '', 'innerhalb von 10 Jahren: steuerpflichtig') : flag(true, 'nach 10 Jahren: steuerfrei', '')],
      ['Einkommensteuer darauf (Modell)', E(v.tax)], ['Restschuld bei Verkauf', E(v.rest)], ['Liquidität nach Verkauf', `<strong>${E(v.cashAfterSale)}</strong>`],
    ]);
  });
}

// Kaufnebenkosten je Bundesland
const landEl = document.querySelector('[data-land]');
if (landEl && $('kn_out')) {
  const land = landEl.dataset.land, g = GREST[land];
  if (g && $('kn_rate')) $('kn_rate').innerHTML = `In ${esc(g.name)} beträgt die Grunderwerbsteuer <strong>${P(g.pct, 1)}</strong> des Kaufpreises${g.since ? ` (gültig seit ${D(g.since)})` : ''}.`;
  watch(['kn_p', 'kn_m', 'kn_n', 'kn_g'], () => {
    const k = kaufnebenkosten({ price: num('kn_p'), land, notaryPct: num('kn_n'), landRegistryPct: num('kn_g'), brokerPct: num('kn_m') });
    if (!k) { $('kn_out').innerHTML = '<p class="form-note">Bitte einen Kaufpreis eintragen.</p>'; return; }
    $('kn_out').innerHTML = table([...k.parts.map((x) => [`${esc(x.label)} (${P(x.pct)})`, E(x.amount)]), ['<strong>Kaufnebenkosten gesamt</strong>', `<strong>${E(k.total)}</strong> (${P(k.totalPct)})`], ['Gesamtkosten inkl. Kaufpreis', E(k.allIn)]]);
  });
}
if ($('kn_table')) {
  const rows = Object.entries(GREST).sort((a, b) => a[1].pct - b[1].pct || a[1].name.localeCompare(b[1].name, 'de'))
    .map(([slug, g]) => [`<a class="ck-link" href="/rechner/kaufnebenkosten/${slug}">${esc(g.name)}</a>`, P(g.pct, 1), E(300000 * g.pct / 100)]);
  $('kn_table').innerHTML = table(rows, ['Bundesland', 'Grunderwerbsteuer', 'bei 300.000 €']);
}

// Tilgungsplan
if ($('tp_out')) {
  const ids = ['tp_l', 'tp_z', 'tp_t', 'tp_f', 'tp_s'];
  remember('tilgung', ids);
  let plan = null;
  watch(ids, () => {
    plan = tilgungsplan({ loan: num('tp_l'), ratePa: num('tp_z') / 100, repaymentPa: num('tp_t') / 100, fixedYears: num('tp_f'), specialPa: num('tp_s') });
    if (!plan) { $('tp_sum').innerHTML = '<p class="form-note">Bitte Darlehensbetrag, Zins und Tilgung eintragen.</p>'; $('tp_out').innerHTML = ''; return; }
    const dur = plan.months ? `${Math.floor(plan.months / 12)} Jahre${plan.months % 12 ? ` und ${plan.months % 12} Monate` : ''}` : 'über 60 Jahre';
    $('tp_sum').innerHTML = table([
      ['Monatsrate (Zins + Tilgung)', `<strong>${E(plan.monthly)}</strong>`],
      [`Restschuld nach ${num('tp_f')} Jahren Zinsbindung`, `<strong>${E(plan.restAtFixed ?? 0)}</strong>`],
      ['Laufzeit bis zur Volltilgung (gleicher Zins)', dur],
      ['Zinsen insgesamt', E(plan.totalInterest)],
      ...(plan.totalSpecial > 0 ? [['Sondertilgungen insgesamt', E(plan.totalSpecial)]] : []),
    ]);
    const fy = Math.round(num('tp_f'));
    $('tp_out').innerHTML = table(plan.years.map((r) => [r.year === fy ? `<strong>${r.year}</strong>` : r.year, E(r.interest), E(r.principal), r.special ? E(r.special) : '–', r.year === fy ? `<strong>${E(r.balance)}</strong>` : E(r.balance)]), ['Jahr', 'Zinsen', 'Tilgung', 'Sondertilgung', 'Restschuld']);
  });
  $('tp_csv')?.addEventListener('click', () => {
    if (!plan) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + tilgungsplanCSV(plan)], { type: 'text/csv;charset=utf-8' }));
    a.download = 'ImmoAdv_Tilgungsplan.csv'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  });
}

// Budget-Rechner
if ($('bu_out')) {
  const ids = ['bu_n', 'bu_a', 'bu_p', 'bu_e', 'bu_m', 'bu_s', 'bu_k', 'bu_z', 'bu_t', 'bu_land', 'bu_b'];
  remember('budget', ids);
  watch(ids, () => {
    const b = budget({ netIncome: num('bu_n'), expenses: num('bu_a'), bufferPct: num('bu_p'), equity: num('bu_e'), rent: num('bu_m'), rentSharePct: num('bu_s'), objectCosts: num('bu_k'), ratePa: num('bu_z') / 100, repaymentPa: num('bu_t') / 100, land: val('bu_land'), brokerPct: num('bu_b') });
    if (!b) { $('bu_out').innerHTML = '<p class="form-note">Bitte Zins und Tilgung eintragen.</p>'; return; }
    if (b.rate <= 0) { $('bu_out').innerHTML = '<p class="form-note">Nach Ausgaben und Puffer bleibt kein Betrag für eine Rate. Ausgaben prüfen oder Eigenkapital erhöhen.</p>'; return; }
    const dur = b.months ? `${Math.floor(b.months / 12)} Jahre${b.months % 12 ? ` und ${b.months % 12} Monate` : ''}` : '–';
    $('bu_out').innerHTML = table([
      ['Monatlicher Überschuss (inkl. angerechneter Miete)', E(b.surplus)],
      ['Tragbare Rate nach Puffer', `<strong>${E(b.rate)}</strong>`],
      ['Darlehen bei dieser Rate', `<strong>${E(b.loan)}</strong>`],
      ['Kaufpreis, der damit darstellbar ist', `<strong>${E(b.price)}</strong>`],
      [`Kaufnebenkosten (${P(b.nkPct)})`, E(b.nebenkosten)],
      ['Eigenkapital deckt die Nebenkosten', b.equityCoversNk ? flag(true, 'ja', '') : flag(false, '', 'nein – Banken finanzieren Nebenkosten selten mit')],
      ['Darlehen im Verhältnis zum Kaufpreis', P(b.loanToPrice, 1)],
      ['Restschuld nach 10 Jahren', E(b.restAfter10)],
      ['Laufzeit bis zur Volltilgung (gleicher Zins)', dur],
    ]) + `<p><a class="ck-link" href="/rechner/tilgungsplan#tp_l=${Math.round(b.loan)}&tp_z=${num('bu_z')}&tp_t=${num('bu_t')}">Tilgungsplan zu diesem Darlehen</a> · <a class="ck-link" href="/rechner/kaufnebenkosten/${val('bu_land')}">Nebenkosten im Detail</a></p>`;
  });
}

// Deal-Scorecard
if ($('sc_overall')) {
  const ids = ['sc_n', 'sc_p', 'sc_o', 'sc_e', 'sc_z', 'sc_t', 'sc_land', 'sc_b', 'sc_k', 'sc_m', 'sc_a', 'sc_i', 'sc_u', 'sc_v', 'sc_b2'];
  remember('scorecard', ids);
  const L = { ok: 'Freigegeben', warn: 'In Prüfung', bad: 'Kritisch', na: 'Ungeprüft' };
  const badge = (st) => `<span class="st ${st}">${L[st]}</span>`;
  const opt = (id) => ($(id)?.value === '' ? '' : num(id));
  watch(ids, () => {
    const s = scorecard({ netIncome: opt('sc_n'), householdSize: num('sc_p'), otherObligations: num('sc_o'), equity: opt('sc_e'), ratePct: num('sc_z'), repaymentPct: num('sc_t'),
      land: val('sc_land'), brokerPct: num('sc_b'), price: opt('sc_k'), rent: opt('sc_m'), area: opt('sc_a'), maintenanceQm: num('sc_i'), nonRecoverable: num('sc_u'),
      vergleichsmieteQm: opt('sc_v'), mietpreisbremse: chk('sc_b2') });
    const h = s.haushalt, e = s.eigenkapital, o = s.objekt;
    $('sc_h').innerHTML = `<p>${badge(h.status)}</p>` + (h.status === 'na' ? `<p class="form-note">${h.lines[0]}</p>` : table([
      ['Lebenshaltungspauschale', E(h.living)], ['Monatsrate', E(h.rate)], ['Überschuss nach Rate und Objektkosten', `<strong>${E(h.surplus)}</strong>`]]));
    $('sc_e_out').innerHTML = `<p>${badge(e.status)}</p>` + (e.status === 'na' ? `<p class="form-note">${e.lines[0]}</p>` : table([
      ['Kaufnebenkosten', E(e.nebenkosten)], ['Reserve (3 Monatsausgaben)', E(e.reserve)], ['Zielwert Eigenkapital', `<strong>${E(e.target)}</strong>`], ['Darlehen', E(s.loan)]]));
    $('sc_ob').innerHTML = `<p>${badge(o.status)}</p>` + (o.status === 'na' ? `<p class="form-note">${o.lines[0]}</p>` : table([
      ['Bruttomietrendite', P(o.yieldPct)], ['Kaufpreisfaktor', String(o.factor).replace('.', ',')], ['Instandhaltung', `${String(num('sc_i')).replace('.', ',')} €/m²${num('sc_i') < 1 ? ' ' + flag(false, '', 'unter 1,00 €/m²') : ''}`],
      ['Grenze Mietpreisbremse', o.cap == null ? '–' : `${E(o.cap)}${num('sc_m') > o.cap ? ' ' + flag(false, '', 'Miete liegt darüber') : ''}`]]));
    const t = { ok: 'Alle drei Bereiche im grünen Bereich.', warn: 'Mindestens ein Bereich braucht Aufmerksamkeit.', bad: 'Mindestens ein Bereich ist kritisch.', na: 'Noch nicht alle Bereiche prüfbar – bitte Angaben ergänzen.' };
    $('sc_overall').className = `sc-overall ${s.overall}`;
    $('sc_overall').innerHTML = `<strong>Gesamt: ${L[s.overall]}</strong> ${t[s.overall]}`;
  });
}

// Glossar-Suche
if ($('gl_q')) {
  const items = [...document.querySelectorAll('.gl-item')];
  const norm = (t) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  $('gl_q').addEventListener('input', () => {
    const q = norm($('gl_q').value.trim());
    let n = 0;
    items.forEach((it) => { const hit = !q || norm(it.textContent).includes(q); it.hidden = !hit; if (hit) n++; });
    $('gl_none').hidden = n > 0;
  });
}

// Erklär-Hinweise (Tooltips): Klick oder Tastatur öffnet, Escape oder Klick daneben schließt.
document.addEventListener('click', (e) => {
  const b = e.target.closest('.tip');
  document.querySelectorAll('.tip[aria-expanded="true"]').forEach((x) => { if (x !== b) { x.setAttribute('aria-expanded', 'false'); x.nextElementSibling.hidden = true; } });
  if (b) { const open = b.getAttribute('aria-expanded') !== 'true'; b.setAttribute('aria-expanded', String(open)); b.nextElementSibling.hidden = !open; }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.querySelectorAll('.tip[aria-expanded="true"]').forEach((x) => { x.setAttribute('aria-expanded', 'false'); x.nextElementSibling.hidden = true; }); });

// Einstieg „Meine erste Immobilie“
if ($('ez_out')) {
  const form = $('wz');
  form.classList.add('js');
  const show = (n) => {
    form.querySelectorAll('fieldset').forEach((f) => { f.hidden = f.dataset.step !== String(n); });
    document.querySelectorAll('.steps li').forEach((li) => li.classList.toggle('on', Number(li.dataset.step) <= n));
    form.querySelector(`fieldset[data-step="${n}"] input, fieldset[data-step="${n}"] select`)?.focus({ preventScroll: true });
  };
  form.querySelectorAll('[data-next]').forEach((b) => b.addEventListener('click', () => show(Number(b.dataset.next))));
  show(1);
  const ids = ['ez_p', 'ez_l', 'ez_m', 'ez_r', 'ez_c', 'ez_e', 'ez_s', 'ez_i', 'ez_t', 'ez_g'];
  remember('einstieg', ids);
  watch(ids, () => {
    const e = einstieg({ price: num('ez_p'), rent: num('ez_r'), equity: num('ez_e'), land: val('ez_l'), ratePa: num('ez_i') / 100, repaymentPa: num('ez_t') / 100, brokerPct: num('ez_m'), costSharePct: num('ez_c'), reserve: num('ez_s'), growthPa: num('ez_g') / 100 });
    if (!e) { $('ez_out').innerHTML = '<p class="form-note">Bitte einen Kaufpreis eintragen.</p>'; return; }
    const card = (h, big, txt, tone = '') => `<div class="ez-card ${tone ? 'ez-' + tone : ''}"><h3>${h}</h3><p class="ez-big">${big}</p><p>${txt}</p></div>`;
    $('ez_out').innerHTML = `<div class="ez-grid">`
      + card('Darlehen und Rate', E(e.rate) + ' / Monat', `Darlehen ${E(e.loan)} bei Kaufnebenkosten von ${E(e.nk.total)} (${P(e.nk.totalPct)}).${e.equityCoversCosts ? '' : ' <strong>Ihr Eigenkapital deckt die Nebenkosten nicht</strong> – das verteuert die Finanzierung deutlich.'}`, e.equityCoversCosts ? '' : 'warn')
      + card('Ihr Tilgungshebel', E(e.firstPrincipal) + ' / Monat', `So viel Darlehen zahlen Sie schon im ersten Monat zurück – Vermögen, das Sie aufbauen. Die Miete deckt ${e.rentCoversPct === null ? '–' : P(e.rentCoversPct, 1)} der Rate.`)
      + card('Monatlicher Cashflow', (e.cashflow >= 0 ? '+' : '') + E(e.cashflow), e.cashflow >= 0 ? 'Die Wohnung trägt sich vor Steuern selbst.' : `Sie zahlen monatlich ${E(-e.cashflow)} zu (vor Steuern; die Steuerwirkung kann einen Teil ausgleichen).`, e.cashflow >= 0 ? 'ok' : 'warn')
      + card('Sicherheitsnetz', e.reserveMonths === null ? '–' : `${e.reserveMonths} Monate`, `So lange trägt Ihr Notgroschen Rate und Kosten (${E(e.vacantBurden)} pro Monat), falls die Miete ausfällt.`, e.reserveMonths !== null && e.reserveMonths < 6 ? 'warn' : 'ok')
      + card('In zehn Jahren', E(e.repaid10) + ' getilgt', `Restschuld dann ${E(e.rest10)}. Bei ${P(num('ez_g'), 1)} Wertentwicklung pro Jahr: Immobilie ${E(e.value10)}, Ihr Anteil ${E(e.netWorth10)}. Nach zehn Jahren ist ein Verkaufsgewinn steuerfrei (§ 23 EStG).`)
      + `</div><p class="obj-actions"><a class="btn btn-dark" href="/auth/register">Objekt speichern und Kreditmappe vorbereiten</a><a class="btn btn-ghost" href="/szenarien">Anschlusszins prüfen</a></p>`;
  });
}
