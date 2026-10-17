// Werkzeuge für Privatkunden (Ansicht „Werkzeuge“). Alles rechnet im Browser; Eingaben bleiben in diesem Browser.
// Käufer-Pass: Angebotsvergleich der Bankangebote, Bankgespräch-Vorbereitung.
// Investor Pro: zusätzlich Anschlussfinanzierung mit Forward-Aufschlag und Kündigungsrecht nach § 489 BGB.
// Die Freischaltung im Browser ist eine Komfortfunktion; die Rechenwege sind offen dokumentiert.
import { monthlyRate, balanceAfterMonths } from './calc.mjs';

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const E = (v) => (Number.isFinite(v) ? v : 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const E2 = (v) => (Number.isFinite(v) ? v : 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
const P = (v, d = 2) => `${(Number.isFinite(v) ? v : 0).toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d })} %`;
const num = (v) => { let t = String(v ?? '').trim(); if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.'); const x = Number(t); return Number.isFinite(x) ? x : 0; };
const store = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem('ia-tool-' + k) || 'null'); localStorage.setItem('ia-tool-' + k, JSON.stringify(v)); } catch { /* ohne Speicher */ } return null; };

// ---------- Rechenkern (exportiert für Tests) ----------
// Bankangebote vergleichen: Kosten während der Zinsbindung (Zinsen + Gebühren) und Restschuld am Ende.
export function compareOffers(list) {
  const rows = list.filter((o) => o.loan > 0 && o.rate > 0 && o.repay > 0 && o.years > 0).map((o) => {
    const months = Math.round(o.years * 12);
    const pay = monthlyRate(o.loan, o.rate / 100, o.repay / 100);
    const rest = balanceAfterMonths(o.loan, o.rate / 100, o.repay / 100, months);
    const interest = pay * months - (o.loan - rest);
    const cost = interest + (o.fees || 0);
    return { ...o, pay, rest, interest, cost, months };
  });
  if (!rows.length) return { rows, best: null, sameYears: true };
  const sameYears = rows.every((r) => r.years === rows[0].years);
  // Vergleichbar machen: Kosten + Restschuld (was Sie bis zum Ende der Zinsbindung zahlen und danach noch schulden),
  // bezogen auf gleiche Darlehenshöhe. Bei unterschiedlicher Zinsbindung nur eingeschränkt vergleichbar.
  rows.forEach((r) => { r.score = (r.cost + r.rest) / r.loan; });
  const best = rows.reduce((a, b) => (b.score < a.score ? b : a));
  return { rows, best, sameYears };
}

// Anschlussfinanzierung: Restschuld, Vorlauf, Forward-Zins und Vergleich mit Zins-Szenarien bei Ablauf.
export function forwardCalc({ rest, monthsToEnd, todayRate, surchargePerMonth, repay, freeMonths = 0 }) {
  const lead = Math.max(0, monthsToEnd - freeMonths);
  const fwdRate = todayRate + surchargePerMonth * lead;
  const pay = (r) => monthlyRate(rest, r / 100, repay / 100);
  const scen = [-1, 0, 1, 2].map((d) => ({ d, rate: todayRate + d, pay: pay(Math.max(0, todayRate + d)) }));
  return { lead, fwdRate, fwdPay: pay(fwdRate), todayPay: pay(todayRate), scen, breakEven: fwdRate };
}

// § 489 Abs. 1 Nr. 2 BGB: Kündigung 10 Jahre nach vollständiger Auszahlung mit 6 Monaten Frist ohne Vorfälligkeitsentschädigung.
export function kuendigungsrecht489(payout) {
  if (!payout) return null;
  const d = new Date(payout);
  if (Number.isNaN(d.getTime())) return null;
  const from = new Date(d); from.setFullYear(from.getFullYear() + 10);
  const end = new Date(from); end.setMonth(end.getMonth() + 6);
  return { from, end };
}

// ---------- Oberfläche ----------
const lock = (need) => `<div class="tl-lock"><strong>${need === 'pro' ? 'In Investor Pro enthalten' : 'Im Käufer-Pass und in Investor Pro enthalten'}</strong><p>Sie können alles ausprobieren; Ergebnisse speichern, drucken und als Vorlage nutzen ist ${need === 'pro' ? 'mit Investor Pro' : 'mit Käufer-Pass oder Investor Pro'} möglich.</p><a class="btn btn-pay" href="#angebot">Tarife ansehen</a></div>`;

function offersTool(box, ok) {
  const saved = store('offers') || [{ bank: 'Bank A', loan: 280000, rate: 3.65, eff: 3.72, repay: 2, years: 10, fees: 0, special: 5 }, { bank: 'Bank B', loan: 280000, rate: 3.55, eff: 3.68, repay: 2, years: 10, fees: 900, special: 0 }, { bank: '', loan: 280000, rate: 0, eff: 0, repay: 2, years: 10, fees: 0, special: 0 }];
  const F = [['bank', 'Bank / Anbieter', 'text'], ['loan', 'Darlehen (€)'], ['rate', 'Sollzins (%)'], ['eff', 'Effektivzins (%)'], ['repay', 'Tilgung (%)'], ['years', 'Zinsbindung (Jahre)'], ['fees', 'Gebühren (€)'], ['special', 'Sondertilgung p. a. (%)']];
  box.innerHTML = `<h3>Bankangebote vergleichen</h3><p class="form-note">Tragen Sie bis zu drei Angebote aus dem ESIS-Merkblatt (Europäisches Standardisiertes Merkblatt) ein. Verglichen wird, was Sie bis zum Ende der Zinsbindung zahlen und was danach noch an Schulden übrig ist.</p>
    <div class="tl-offers">${saved.map((o, i) => `<fieldset class="tl-off"><legend>Angebot ${i + 1}</legend>${F.map(([k, l, t]) => `<label>${l}<input data-o="${i}" data-k="${k}" ${t === 'text' ? 'type="text" maxlength="40"' : 'type="number" step="any" inputmode="decimal"'} value="${esc(o[k] ?? '')}"></label>`).join('')}</fieldset>`).join('')}</div>
    <div id="tlOffOut" aria-live="polite"></div>${ok ? '<p class="tl-act"><button type="button" class="btn btn-outline" id="tlOffPrint">Vergleich drucken / als PDF sichern</button></p>' : lock('pass')}`;
  const run = () => {
    const list = saved.map((o) => ({ ...o, loan: num(o.loan), rate: num(o.rate), eff: num(o.eff), repay: num(o.repay), years: num(o.years), fees: num(o.fees), special: num(o.special) }));
    const r = compareOffers(list);
    store('offers', saved);
    const out = $('tlOffOut');
    if (!r.rows.length) { out.innerHTML = '<p class="form-note">Bitte mindestens ein Angebot mit Darlehen, Sollzins, Tilgung und Zinsbindung eintragen.</p>'; return; }
    out.innerHTML = `<div class="tl-tablewrap"><table class="tl-table"><thead><tr><th>Angebot</th><th>Rate / Monat</th><th>Zinsen in der Bindung</th><th>Gebühren</th><th>Restschuld am Ende</th><th>Sondertilgung</th></tr></thead><tbody>${r.rows.map((x) => `<tr class="${x === r.best ? 'best' : ''}"><td><strong>${esc(x.bank || 'Angebot')}</strong><small>${P(x.rate)} soll · ${P(x.eff)} eff. · ${x.years} J.</small></td><td>${E2(x.pay)}</td><td>${E(x.interest)}</td><td>${E(x.fees)}</td><td>${E(x.rest)}</td><td>${x.special ? P(x.special, 0) : '–'}</td></tr>`).join('')}</tbody></table></div>
      <p class="tl-verdict">${r.best ? `<strong>Günstigstes Angebot nach Zinsen, Gebühren und Restschuld: ${esc(r.best.bank || 'Angebot')}.</strong>` : ''} ${r.sameYears ? '' : '<strong>Achtung:</strong> Die Zinsbindungen sind unterschiedlich lang – längere Bindung kostet meist etwas mehr, schützt aber länger vor steigenden Zinsen. '}Höhere Tilgung senkt die Restschuld, erhöht aber die Rate; vergleichen Sie bei gleicher Tilgung. Sondertilgungsrechte und Bereitstellungszinsen stehen im ESIS-Merkblatt.</p>`;
  };
  box.addEventListener('input', (e) => { const t = e.target; if (t.dataset.o == null) return; saved[+t.dataset.o][t.dataset.k] = t.type === 'text' ? t.value : t.value; run(); });
  $('tlOffPrint')?.addEventListener('click', () => printBox(box, 'Bankangebote im Vergleich'));
  run();
}

function bankTool(box, ok, d) {
  const p = d.profile || {};
  const objs = (Array.isArray(d.objects) ? d.objects : []).filter((o) => o && o.name);
  const st = store('bank') || {};
  const Q = [
    ['Konditionen', ['Wie hoch sind Soll- und Effektivzins – und für welche Zinsbindung?', 'Welche Sondertilgung ist kostenlos möglich (Prozent pro Jahr)?', 'Kann ich die Tilgung während der Laufzeit ändern (Tilgungssatzwechsel)?', 'Ab wann fallen Bereitstellungszinsen an und wie hoch sind sie?', 'Gibt es Gebühren (Schätzung, Bearbeitung, Teilauszahlung)?']],
    ['Prüfung durch die Bank', ['Welchen Beleihungswert setzen Sie für das Objekt an?', 'Wie hoch ist der Beleihungsauslauf und ab wann steigt der Zins?', 'Mit welchen Lebenshaltungskosten rechnen Sie in der Haushaltsrechnung?', 'Welche Unterlagen fehlen Ihnen noch?']],
    ['Nach der Zusage', ['Wie lange gilt das Angebot?', 'Wann muss die Grundschuld eingetragen sein?', 'Welche Auszahlungsvoraussetzungen gibt es?']],
  ];
  const facts = [
    ['Nettoeinkommen / Monat', p.netIncome ? E(num(p.netIncome)) : '–'],
    ['Eigenkapital', p.equity ? E(num(p.equity)) : '–'],
    ['Wunsch-Kaufpreis', p.targetPrice ? E(num(p.targetPrice)) : '–'],
    ['Objekte im Konto', String(objs.length)],
  ];
  box.innerHTML = `<h3>Bankgespräch vorbereiten</h3><p class="form-note">Ihre wichtigsten Zahlen auf einen Blick, die Fragen, die Sie stellen sollten, und Platz für die Antworten der Bank. Ausdrucken und mitnehmen.</p>
    <div class="tl-facts">${facts.map(([k, v]) => `<div><small>${k}</small><strong>${v}</strong></div>`).join('')}</div>
    <p class="form-note">Fehlt etwas? Ergänzen Sie es im Konto unter Finanzprofil. Die vollständige Haushaltsrechnung steht in Ihrer Kreditmappe.</p>
    ${Q.map(([h, qs], gi) => `<h4 class="tl-sub">${h}</h4><ol class="tl-q">${qs.map((q, qi) => { const k = gi + '_' + qi; return `<li><label><span>${q}</span><input type="text" data-b="${k}" maxlength="200" placeholder="Antwort der Bank" value="${esc(st[k] || '')}"></label></li>`; }).join('')}</ol>`).join('')}
    <label class="tl-notes">Eigene Notizen<textarea data-b="notes" rows="3" maxlength="2000">${esc(st.notes || '')}</textarea></label>
    ${ok ? '<p class="tl-act"><button type="button" class="btn btn-outline" id="tlBankPrint">Gesprächsbogen drucken / als PDF sichern</button><a class="btn btn-ghost" href="#objekte">Kreditmappe öffnen</a></p>' : lock('pass')}`;
  box.addEventListener('input', (e) => { const k = e.target.dataset.b; if (!k) return; st[k] = e.target.value; store('bank', st); });
  $('tlBankPrint')?.addEventListener('click', () => printBox(box, 'Bankgespräch – Vorbereitung'));
}

function forwardTool(box, ok, d) {
  const objs = (Array.isArray(d.objects) ? d.objects : []).filter((o) => o && o.name && num(o.loan) > 0);
  const st = store('fwd') || { rest: 180000, months: 30, today: 3.6, sur: 0.02, free: 0, repay: 2, payout: '' };
  box.innerHTML = `<h3>Anschlussfinanzierung &amp; Forward-Darlehen</h3><p class="form-note">Wann endet Ihre Zinsbindung, was kostet es, sich den heutigen Zins schon jetzt zu sichern – und ab welchem Zins bei Ablauf hätte sich das gelohnt?</p>
    ${objs.length ? `<label class="tl-pick">Aus Objekt übernehmen<select id="fwObj"><option value="">– wählen –</option>${objs.map((o, i) => `<option value="${i}">${esc(o.name)}</option>`).join('')}</select></label>` : ''}
    <div class="tl-grid">
      <label>Restschuld bei Ablauf (€)<input id="fw_rest" type="number" step="any" value="${st.rest}"></label>
      <label>Monate bis Ablauf<input id="fw_m" type="number" min="0" max="66" step="1" value="${st.months}"></label>
      <label>Heutiger Zins (%)<input id="fw_i" type="number" step="0.01" value="${st.today}"></label>
      <label>Forward-Aufschlag je Monat Vorlauf (%-Punkte)<input id="fw_s" type="number" step="0.005" value="${st.sur}"></label>
      <label>Aufschlagsfreie Monate<input id="fw_f" type="number" min="0" max="12" step="1" value="${st.free}"></label>
      <label>Tilgung danach (%)<input id="fw_t" type="number" step="0.1" value="${st.repay}"></label>
      <label>Vollständig ausgezahlt am (für § 489 BGB)<input id="fw_p" type="date" value="${esc(st.payout)}"></label>
    </div>
    <div id="fwOut" aria-live="polite"></div>
    <p class="form-note">Aufschläge sind Annahmen – fragen Sie die tatsächlichen Werte bei Bank oder Vermittler an. Keine Zinsprognose, keine Finanzierungsberatung.</p>
    ${ok ? '<p class="tl-act"><button type="button" class="btn btn-outline" id="fwPrint">Drucken / als PDF sichern</button></p>' : lock('pro')}`;
  const run = () => {
    const v = { rest: num($('fw_rest').value), months: num($('fw_m').value), today: num($('fw_i').value), sur: num($('fw_s').value), free: num($('fw_f').value), repay: num($('fw_t').value), payout: $('fw_p').value };
    store('fwd', v);
    const out = $('fwOut');
    if (!(v.rest > 0) || !(v.repay > 0)) { out.innerHTML = '<p class="form-note">Bitte Restschuld und Tilgung eintragen.</p>'; return; }
    const r = forwardCalc({ rest: v.rest, monthsToEnd: v.months, todayRate: v.today, surchargePerMonth: v.sur, repay: v.repay, freeMonths: v.free });
    const k = kuendigungsrecht489(v.payout);
    out.innerHTML = `<div class="tl-facts"><div><small>Forward-Zins</small><strong>${P(r.fwdRate)}</strong><span>${r.lead} Monate Vorlauf × ${P(v.sur, 3).replace(' %', '')} Pkt.</span></div><div><small>Rate mit Forward</small><strong>${E2(r.fwdPay)}</strong></div><div><small>Rate zum heutigen Zins</small><strong>${E2(r.todayPay)}</strong></div></div>
      <div class="tl-tablewrap"><table class="tl-table"><thead><tr><th>Zins bei Ablauf</th><th>Rate</th><th>Forward günstiger?</th></tr></thead><tbody>${r.scen.map((s) => `<tr><td>${P(s.rate)} (${s.d > 0 ? '+' : ''}${s.d} Pkt.)</td><td>${E2(s.pay)}</td><td>${s.rate > r.fwdRate ? `ja, ${E2(s.pay - r.fwdPay)} / Monat` : 'nein'}</td></tr>`).join('')}</tbody></table></div>
      <p class="tl-verdict"><strong>Der Forward lohnt sich, wenn der Zins bei Ablauf über ${P(r.breakEven)} liegt.</strong> Er ist eine Absicherung gegen steigende Zinsen – fallen sie, zahlen Sie mehr als nötig. Ein Forward ist bindend: Wer ihn nicht abnimmt, muss meist eine Nichtabnahmeentschädigung zahlen.</p>
      ${k ? `<p class="tl-verdict"><strong>Kündigungsrecht nach § 489 BGB:</strong> Ab ${k.from.toLocaleDateString('de-DE')} (10 Jahre nach vollständiger Auszahlung) können Sie mit 6 Monaten Frist ohne Vorfälligkeitsentschädigung kündigen – frühestes Ende also ${k.end.toLocaleDateString('de-DE')}. Das gilt auch bei längerer Zinsbindung.</p>` : ''}`;
  };
  box.addEventListener('input', run);
  $('fwObj')?.addEventListener('change', (e) => {
    const o = objs[+e.target.value]; if (!o) return;
    const years = num(o.fixedYears) || 10;
    const rest = balanceAfterMonths(num(o.loan), num(o.interestPct || 3.5) / 100, num(o.repaymentPct || 2) / 100, years * 12);
    $('fw_rest').value = Math.round(rest);
    if (o.payoutDate) { const end = new Date(o.payoutDate); end.setMonth(end.getMonth() + years * 12); const m = Math.max(0, Math.round((end - Date.now()) / 2629800000)); $('fw_m').value = m; $('fw_p').value = o.payoutDate; }
    run();
  });
  $('fwPrint')?.addEventListener('click', () => printBox(box, 'Anschlussfinanzierung'));
  run();
}

function printBox(box, title) {
  const w = window.open('', '_blank');
  if (!w) return;
  const clone = box.cloneNode(true);
  clone.querySelectorAll('input,textarea,select').forEach((el) => { const s = document.createElement('span'); s.className = 'pv'; s.textContent = el.tagName === 'SELECT' ? (el.selectedOptions[0]?.text || '') : el.value || '—'; el.replaceWith(s); });
  clone.querySelectorAll('.tl-act,.tl-lock,.tl-pick').forEach((el) => el.remove());
  w.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${esc(title)} – ImmoAdv</title><style>body{font:14px/1.5 system-ui,sans-serif;color:#0F172A;margin:28px}h3{color:#0F2C59}table{border-collapse:collapse;width:100%}td,th{border:1px solid #CBD5E1;padding:6px;text-align:left}tr.best{background:#DCFCE7}label{display:block;margin:4px 0}.pv{font-weight:700;margin-left:6px}fieldset{border:1px solid #CBD5E1;margin:0 0 8px}small{display:block;color:#475569}.tl-facts{display:flex;gap:16px;flex-wrap:wrap}footer{margin-top:24px;font-size:11px;color:#64748B}</style></head><body>${clone.innerHTML}<footer>Erstellt mit ImmoAdv am ${new Date().toLocaleDateString('de-DE')}. Rechnerische Orientierung, keine Finanzierungs- oder Rechtsberatung.</footer></body></html>`);
  w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
}

// tier: 'free' | 'starter' (Käufer-Pass) | 'pro' (Investor Pro); b2b: Unternehmenskonto (alles frei)
export function mountTools(view, { d, tier = 'free', b2b = false }) {
  const pass = b2b || tier === 'starter' || tier === 'pro';
  const pro = b2b || tier === 'pro';
  view.innerHTML = `<h2 class="tl-h">Werkzeuge</h2><p class="form-note">Werkzeuge, die Ihnen Stunden sparen – vom Bankangebot bis zur Anschlussfinanzierung. Alles rechnet in Ihrem Browser.</p>
    <nav class="tl-nav" aria-label="Werkzeuge"><a href="#t-offers">Bankangebote vergleichen</a><a href="#t-bank">Bankgespräch vorbereiten</a><a href="#t-fwd">Anschluss &amp; Forward</a><a href="#steuer">Steuer-Werkzeuge</a><a href="/rechner">Alle Rechner</a></nav>
    <section class="tl-card" id="t-offers"></section><section class="tl-card" id="t-bank"></section><section class="tl-card" id="t-fwd"></section>`;
  offersTool($('t-offers'), pass);
  bankTool($('t-bank'), pass, d);
  forwardTool($('t-fwd'), pro, d);
  view.querySelectorAll('.tl-nav a[href^="#t-"]').forEach((a) => a.onclick = (e) => { e.preventDefault(); $(a.getAttribute('href').slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
}
