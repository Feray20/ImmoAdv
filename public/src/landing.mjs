// Startseite: interaktive Demo mit Beispielimmobilie (Kaufpreis, Nebenkosten, Rate, Risiken, Score).
// Rechnet ausschließlich im Browser mit dem gemeinsamen Rechenkern; es wird nichts gespeichert oder gesendet.
import { demoAnalyse } from './calc.mjs';

const $ = (id) => document.getElementById(id);
const form = $('lpDemo');

if (form) {
  const E = (v) => Math.round(v).toLocaleString('de-DE') + ' €';
  const P = (v, d = 1) => v.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }) + ' %';
  const LBL = { ok: ['l0', 'Passt'], warn: ['l1', 'Knapp'], bad: ['l2', 'Kritisch'], na: ['l1', 'Offen'] };
  const NK = { grest: 'Grunderwerbsteuer', notar: 'Notar', grundbuch: 'Grundbuch', makler: 'Makler' };
  const ids = { price: 'lpd_price', rent: 'lpd_rent', equity: 'lpd_equity', ratePct: 'lpd_rate', netIncome: 'lpd_income' };
  const val = (id) => Number($(id).value);
  const result = $('lpd_result');
  const ph = $('lpd_ph');
  let revealed = false;

  const li = (cls, chip, title, text) => {
    const el = document.createElement('li');
    el.className = cls;
    const em = document.createElement('em'); em.textContent = chip;
    const sp = document.createElement('span');
    const st = document.createElement('strong'); st.textContent = title;
    sp.append(st, text);
    el.append(em, sp);
    return el;
  };

  const texts = (l, d) => {
    if (l.key === 'haushalt') return ['Haushalt trägt die Rate', l.surplus == null ? 'Bitte Einkommen angeben.'
      : l.surplus < 0 ? `Nach Rate und Lebenshaltung fehlen ${E(-l.surplus)} im Monat.`
      : `Nach Rate, Lebenshaltung und 75 % der Miete bleiben ${E(l.surplus)} im Monat.`];
    if (l.key === 'eigenkapital') return ['Eigenkapital', l.status === 'ok' ? `Deckt Nebenkosten, 10 % des Kaufpreises und eine Reserve (Ziel ${E(l.target)}).`
      : l.status === 'warn' ? `Deckt die Nebenkosten, liegt aber unter dem Ziel von ${E(l.target)} (Nebenkosten, 10 % des Kaufpreises und Reserve).`
      : `Deckt nicht einmal die Nebenkosten von ${E(d.nk.total)} – die finanziert die Bank selten mit.`];
    if (l.key === 'objekt') return ['Objekt', `Bruttomietrendite ${P(l.yieldPct)}, Instandhaltung ist eingeplant.`];
    return ['Zins-Puffer +2 %', l.surplus == null ? 'Bitte Einkommen angeben.' : l.surplus < 0
      ? `Mit 2 Prozentpunkten mehr Zins fehlen ${E(-l.surplus)} im Monat.`
      : `Auch mit 2 Prozentpunkten mehr Zins bleiben ${E(l.surplus)} Überschuss.`];
  };

  const render = () => {
    const input = Object.fromEntries(Object.entries(ids).map(([k, id]) => [k, val(id)]));
    const d = demoAnalyse(input);
    $('lpd_price_o').textContent = E(input.price);
    $('lpd_rent_o').textContent = E(input.rent);
    $('lpd_equity_o').textContent = E(input.equity);
    $('lpd_rate_o').textContent = P(input.ratePct);
    $('lpd_income_o').textContent = E(input.netIncome);
    $('lpd_qm').textContent = `${E(input.price / d.input.area)} pro m²`;
    form.querySelectorAll('.qz-range').forEach((r) => r.style.setProperty('--pct', ((r.value - r.min) / (r.max - r.min)) * 100 + '%'));

    $('lpd_k_price').textContent = E(input.price);
    $('lpd_k_nk').textContent = E(d.nk.total);
    $('lpd_k_nkparts').replaceChildren(...d.nk.parts.map((p) => { const x = document.createElement('li'); x.textContent = `${NK[p.key] || p.label} ${E(p.amount)}`; return x; }));
    $('lpd_k_loan').textContent = E(d.loan);
    $('lpd_k_eq').textContent = `Darlehen · Eigenkapitalquote ${P(d.equityQuotePct)}`;
    $('lpd_k_rate').textContent = E(d.rate);
    $('lpd_k_burden').textContent = d.burdenPct == null ? '' : `${P(d.burdenPct)} deines Nettoeinkommens`;

    $('lpd_score').textContent = String(d.score);
    $('lpd_label').textContent = d.label;
    $('lpd_bar').style.width = d.score + '%';
    result.dataset.level = d.score >= 65 ? '0' : d.score >= 45 ? '1' : '2';
    $('lpd_risks').replaceChildren(
      ...d.lamps.map((l) => { const [cls, chip] = LBL[l.status] || LBL.na; const [t, x] = texts(l, d); return li(cls, chip, t, x); }),
      li('li', 'Hinweis', 'Anschlussfinanzierung', `Nach 10 Jahren bleiben ${E(d.rest10)} Restschuld, die zu dann gültigen Zinsen weiterfinanziert werden.`),
    );
  };

  const reveal = () => {
    revealed = true;
    result.hidden = false;
    ph.hidden = true;
    result.focus({ preventScroll: true });
  };

  // Ohne JavaScript bleibt das vorberechnete Standardergebnis sichtbar; mit JavaScript erst nach dem Klick.
  result.hidden = true;
  result.tabIndex = -1;
  ph.hidden = false;
  form.addEventListener('input', render);
  $('lpd_go').addEventListener('click', () => { render(); if (!revealed) reveal(); });
  render();
}
