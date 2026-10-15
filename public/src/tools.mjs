// Bindet Rechner, Fristen und Szenarien an den gemeinsamen Rechenkern (calc.mjs).
import { anschluss, verkauf, indexmiete, staffelmiete, kaufpreisaufteilung, grenze15, fristen, toICS, GREST, kaufnebenkosten } from './calc.mjs';

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
};

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
