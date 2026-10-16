// Unternehmensportal → Fachwissen: Mindmap, Struktogramm, Prozess-Swimlane, Kennzahlenbaum, Diagramme und Fachglossar
// für Makler, Finanzierungsvermittler und Banken. Alle Beispielzahlen werden hier nachvollziehbar berechnet.
// Hinweis: Orientierungswissen, keine Rechts- oder Finanzierungsberatung; bankindividuelle Vorgaben gehen vor.

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const E = (v, d = 0) => v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: d, maximumFractionDigits: d });
const P = (v, d = 1) => (v * 100).toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }) + ' %';
const N = (v, d = 2) => v.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });

// ---------- Beispielfall (durchgängig) ----------
const FALL = {
  kaufpreis: 400000, marktwert: 400000, abschlag: 0.10, nebenkosten: 0.105, eigenkapital: 120000,
  zins: 0.036, tilgung: 0.02, netto: 5200, lebenshaltung: 1600, verpflichtungen: 300, bewirtschaftung: 350,
  kaltmiete: 1200, nichtUmlage: 150,
};
FALL.darlehen = FALL.kaufpreis * (1 + FALL.nebenkosten) - FALL.eigenkapital; // 322.000
FALL.beleihungswert = FALL.marktwert * (1 - FALL.abschlag);
FALL.annuitaet = FALL.darlehen * (FALL.zins + FALL.tilgung);
FALL.rate = FALL.annuitaet / 12;

function tilgungsplan(darlehen, zins, tilgung, jahre = 30) {
  const rateM = (darlehen * (zins + tilgung)) / 12;
  let rest = darlehen; const out = [];
  for (let j = 1; j <= jahre && rest > 0.5; j++) {
    let z = 0, t = 0;
    for (let m = 0; m < 12 && rest > 0.005; m++) { const zm = rest * zins / 12; const tm = Math.min(rateM - zm, rest); z += zm; t += tm; rest -= tm; }
    out.push({ j, z, t, rest });
  }
  return out;
}

// ---------- 1. Mindmap: Einflussfaktoren der Kreditentscheidung ----------
const MIND = [
  { t: 'Kapitaldienstfähigkeit', c: 'a', k: ['Haushaltsrechnung (Einnahmen − Lebenshaltung − Verpflichtungen)', 'Kapitaldienst = Zins + Tilgung (Annuität)', 'Zinsänderungsrisiko nach Ablauf der Sollzinsbindung (Stresszins)', 'DSCR bei Kapitalanlagen'] },
  { t: 'Objekt & Sicherheit', c: 'b', k: ['Marktwert (§ 194 BauGB) vs. Beleihungswert (BelWertV)', 'Sicherheitsabschlag, Beleihungsauslauf, LTV', 'Grundschuld, Rangstelle, Zweckerklärung', 'Lage, Zustand, Drittverwendbarkeit, Energieeffizienz'] },
  { t: 'Bonität', c: 'c', k: ['SCHUFA-Score, Negativmerkmale', 'internes Rating → Ausfallwahrscheinlichkeit (PD)', 'Beschäftigung: Probezeit, Befristung, Selbstständigkeit', 'Vermögen und Verbindlichkeiten (Selbstauskunft)'] },
  { t: 'Eigenkapital', c: 'd', k: ['Erwerbsnebenkosten aus Eigenmitteln (GrESt, Notar, Grundbuch, Makler)', 'Eigenkapitalquote am Gesamtaufwand', 'Eigenleistung nur eingeschränkt anrechenbar', 'Liquiditätsreserve nach Kauf'] },
  { t: 'Regulatorik', c: 'e', k: ['Kreditwürdigkeitsprüfung §§ 505a–505e BGB (WIKR)', 'ESIS-Merkblatt, vorvertragliche Information', 'CRR (Basel III): Risikogewichte, Eigenmittel', 'MaRisk BTO 1.2: Trennung Markt / Marktfolge; § 18 KWG'] },
  { t: 'Unterlagen', c: 'f', k: ['Selbstauskunft, Ausweis, Einkommensnachweise', 'Exposé, Grundbuchauszug, Flurkarte, Baubeschreibung', 'WEG: Teilungserklärung, Protokolle, Wirtschaftsplan, Rücklage', 'Kaufvertragsentwurf, Wohnflächenberechnung, Energieausweis'] },
];
function mindmap() {
  return `<div class="bw-mind" role="img" aria-label="Mindmap: Einflussfaktoren der Kreditentscheidung">
    <div class="bw-mind-core"><span>Kredit&shy;entscheidung</span><small>Wohnimmobilienfinanzierung</small></div>
    ${MIND.map((b, i) => `<div class="bw-mind-b bw-c-${b.c}" style="--i:${i}"><strong>${b.t}</strong><ul>${b.k.map((k) => `<li>${esc(k)}</li>`).join('')}</ul></div>`).join('')}
  </div>`;
}

// ---------- 2. Struktogramm (Nassi-Shneiderman): Kreditvorprüfung ----------
function ns() {
  const seq = (t) => `<div class="ns-s">${t}</div>`;
  const ifb = (cond, yes, no) => `<div class="ns-if"><div class="ns-cond"><span class="ns-tri" aria-hidden="true"></span><b>${cond}</b><i class="ns-j">ja</i><i class="ns-n">nein</i></div><div class="ns-br"><div class="ns-yes">${yes}</div><div class="ns-no">${no}</div></div></div>`;
  const loop = (cond, body) => `<div class="ns-loop"><div class="ns-lh">${cond}</div><div class="ns-lb">${body}</div></div>`;
  return `<div class="ns" role="img" aria-label="Struktogramm der Kreditvorprüfung">
    <div class="ns-title">Algorithmus „Kreditvorprüfung Wohnimmobilie“</div>
    ${seq('Selbstauskunft, Einkommens- und Objektunterlagen erfassen')}
    ${loop('solange Pflichtunterlagen unvollständig', seq('fehlende Unterlagen anfordern (Dokumentenanforderung, Erinnerung)'))}
    ${seq('Gesamtaufwand = Kaufpreis + Erwerbsnebenkosten; Darlehensbedarf = Gesamtaufwand − Eigenkapital')}
    ${seq('Beleihungswert = Marktwert × (1 − Sicherheitsabschlag); Beleihungsauslauf = Darlehen ÷ Beleihungswert')}
    ${ifb('Erwerbsnebenkosten aus Eigenkapital gedeckt?',
    seq('Standardfinanzierung prüfen'),
    seq('Vollfinanzierung (> 100 %): Zinsaufschlag, strengere Bonitätsanforderung'))}
    ${seq('Haushaltsrechnung: frei verfügbares Einkommen − Kapitaldienst (inkl. Stresszins)')}
    ${ifb('Kapitaldienstfähigkeit gegeben (Überschuss ≥ 0 auch im Stressfall)?',
    ifb('Beleihungsauslauf ≤ 80 %?', seq('Regelfall: Bankanfrage vorbereiten'), seq('Eigenkapital erhöhen, Zusatzsicherheit oder höhere Tilgung prüfen')),
    seq('Ablehnungsgrund dokumentieren; Alternativen: längere Laufzeit, niedrigerer Kaufpreis, Mitdarlehensnehmer'))}
    ${seq('Kreditmappe (BankReady) mit Prüfsumme erzeugen → Einreichung an Bank / Partner')}
  </div>`;
}

// ---------- 3. Swimlane: von der Anfrage bis zur Auszahlung ----------
const LANES = ['Interessent', 'Makler / Vermittler', 'ImmoAdv', 'Bank'];
const STEPS = [
  [0, 'Anfrage über Widget, Partnerseite oder QR-Code (mit Einwilligung)'],
  [2, 'Lead mit Eckdaten und Kennzahlen im Postkorb'],
  [1, 'Erstgespräch, Bedarfsanalyse, Unterlagenliste'],
  [0, 'Selbstauskunft und Unterlagen hochladen'],
  [2, 'RenditeRadar: Kennzahlen, Stresstest, Plausibilitäten'],
  [2, 'BankReady: Kreditmappe mit Prüfsumme und Echtheits-QR'],
  [1, 'Einreichung, Konditionsanfrage'],
  [3, 'Kreditwürdigkeitsprüfung, Objektbewertung, Votum (Markt / Marktfolge)'],
  [3, 'ESIS-Merkblatt, Darlehensangebot'],
  [0, 'Vertrag, Grundschuldbestellung beim Notar'],
  [3, 'Auszahlung nach Erfüllung der Auszahlungsvoraussetzungen'],
];
function swimlane() {
  return `<div class="bw-swim" role="img" aria-label="Prozess von der Anfrage bis zur Auszahlung in vier Bahnen">
    <div class="bw-swim-h">${LANES.map((l, i) => `<span class="bw-l${i}">${l}</span>`).join('')}</div>
    ${STEPS.map(([l, t], i) => `<div class="bw-swim-r"><b class="bw-swim-n">${i + 1}</b>${LANES.map((_, k) => `<div class="bw-swim-c">${k === l ? `<div class="bw-swim-box bw-l${l}"><small>${LANES[l]}</small>${esc(t)}</div>` : ''}</div>`).join('')}</div>`).join('')}
  </div>`;
}

// ---------- 4. Kennzahlenbaum ----------
function baum() {
  const f = FALL;
  const nk = f.kaufpreis * f.nebenkosten, ges = f.kaufpreis + nk;
  const noi = (f.kaltmiete - f.nichtUmlage) * 12;
  const node = (t, formel, wert, kids = '') => `<li><div class="bw-node"><strong>${t}</strong><code>${formel}</code><span>${wert}</span></div>${kids ? `<ul>${kids}</ul>` : ''}</li>`;
  return `<ul class="bw-tree" aria-label="Kennzahlenbaum">${node('Finanzierbarkeit', 'Objekt × Kunde × Bank', 'Gesamturteil',
    node('Gesamtaufwand', 'Kaufpreis + Erwerbsnebenkosten', E(ges),
      node('Erwerbsnebenkosten', 'GrESt + Notar/Grundbuch + Makler', `${E(nk)} (${P(f.nebenkosten)})`))
    + node('Darlehensbedarf', 'Gesamtaufwand − Eigenkapital', E(f.darlehen),
      node('Beleihungsauslauf', 'Darlehen ÷ Beleihungswert', P(f.darlehen / f.beleihungswert))
      + node('LTV', 'Darlehen ÷ Marktwert', P(f.darlehen / f.marktwert)))
    + node('Kapitaldienst', 'Darlehen × (Sollzins + Anfangstilgung)', `${E(f.annuitaet)} p. a. · ${E(f.rate)} mtl.`,
      node('Kapitaldienstfähigkeit', 'frei verfügbar − Rate ≥ 0', E(f.netto - f.lebenshaltung - f.verpflichtungen - f.bewirtschaftung - f.rate) + ' mtl.')
      + node('DSCR (Kapitalanlage)', 'Nettomietertrag ÷ Kapitaldienst', N(noi / f.annuitaet))))}</ul>`;
}

// ---------- 5. Diagramme (SVG, aus dem Beispielfall berechnet) ----------
function chartBeleihung() {
  const f = FALL;
  const rows = [
    ['Kaufpreis', f.kaufpreis, '#94A3B8'],
    ['Marktwert', f.marktwert, '#0369A1'],
    ['Beleihungswert', f.beleihungswert, '#0F2C59'],
    ['Realkredit (60 %)', f.beleihungswert * 0.6, '#16A34A'],
    ['Darlehen', f.darlehen, '#DC2626'],
  ];
  const max = 450000, W = 640, L = 170, bh = 34, gap = 14, H = rows.length * (bh + gap) + 40;
  const x = (v) => L + (v / max) * (W - L - 110);
  return `<svg class="bw-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Balkendiagramm Beleihungswert">
    ${[0, 100000, 200000, 300000, 400000].map((t) => `<line x1="${x(t)}" y1="8" x2="${x(t)}" y2="${H - 26}" stroke="#E2E8F0"/><text x="${x(t)}" y="${H - 8}" text-anchor="middle" class="bw-ax">${t / 1000} Tsd.</text>`).join('')}
    ${rows.map(([l, v, c], i) => { const y = 10 + i * (bh + gap); return `<text x="${L - 10}" y="${y + bh / 2 + 5}" text-anchor="end" class="bw-lb">${l}</text><rect x="${L}" y="${y}" width="${x(v) - L}" height="${bh}" rx="4" fill="${c}"/><text x="${x(v) + 6}" y="${y + bh / 2 + 5}" class="bw-val">${E(v)}</text>`; }).join('')}
    <line x1="${x(f.beleihungswert)}" y1="6" x2="${x(f.beleihungswert)}" y2="${H - 26}" stroke="#0F2C59" stroke-dasharray="4 3"/>
  </svg>`;
}

function chartWasserfall() {
  const f = FALL;
  const steps = [['Netto&shy;einkommen', f.netto, 'pos'], ['Lebens&shy;haltung', -f.lebenshaltung, 'neg'], ['Verpflich&shy;tungen', -f.verpflichtungen, 'neg'], ['Bewirt&shy;schaftung', -f.bewirtschaftung, 'neg'], ['Rate', -f.rate, 'rate']];
  const W = 640, H = 300, top = 20, base = 250, sc = (base - top) / 5600, bw = 78, gx = 104;
  let run = 0; const bars = [];
  steps.forEach(([l, v, k], i) => { const a = run, b = run + v; run = b; bars.push({ l, v, k, y1: Math.max(a, b), y2: Math.min(a, b), x: 30 + i * gx }); });
  const rest = run;
  const yy = (v) => base - v * sc;
  return `<svg class="bw-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Wasserfalldiagramm Haushaltsrechnung">
    <line x1="20" y1="${base}" x2="${W - 10}" y2="${base}" stroke="#94A3B8"/>
    ${bars.map((b) => `<rect x="${b.x}" y="${yy(b.y1)}" width="${bw}" height="${Math.max(2, (b.y1 - b.y2) * sc)}" rx="3" fill="${b.k === 'pos' ? '#0F2C59' : b.k === 'rate' ? '#0284C7' : '#F87171'}"/><text x="${b.x + bw / 2}" y="${yy(b.y1) - 6}" text-anchor="middle" class="bw-val">${b.v > 0 ? '' : '−'}${E(Math.abs(b.v))}</text><foreignObject x="${b.x - 12}" y="${base + 4}" width="${bw + 24}" height="40"><div class="bw-fo">${b.l}</div></foreignObject>`).join('')}
    <rect x="${30 + 5 * gx}" y="${yy(rest)}" width="${bw}" height="${rest * sc}" rx="3" fill="#16A34A"/><text x="${30 + 5 * gx + bw / 2}" y="${yy(rest) - 6}" text-anchor="middle" class="bw-val">${E(rest)}</text><foreignObject x="${30 + 5 * gx - 12}" y="${base + 4}" width="${bw + 24}" height="40"><div class="bw-fo"><b>Überschuss</b></div></foreignObject>
  </svg>`;
}

function chartAnnuitaet() {
  const f = FALL, plan = tilgungsplan(f.darlehen, f.zins, f.tilgung, 30);
  const W = 640, H = 280, L = 54, B = 240, T = 16, R = 16, bw = (W - L - R) / plan.length;
  const maxA = f.annuitaet * 1.05, y = (v) => B - (v / maxA) * (B - T);
  const yr = (v) => B - (v / f.darlehen) * (B - T);
  const pts = plan.map((p, i) => `${L + i * bw + bw / 2},${yr(p.rest)}`).join(' ');
  const z10 = plan[9];
  return `<svg class="bw-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Annuitätendarlehen: Zins- und Tilgungsanteil je Jahr">
    ${[0, 0.25, 0.5, 0.75, 1].map((t) => `<line x1="${L}" y1="${y(maxA * t)}" x2="${W - R}" y2="${y(maxA * t)}" stroke="#EEF2F7"/><text x="${L - 6}" y="${y(maxA * t) + 4}" text-anchor="end" class="bw-ax">${Math.round(maxA * t / 1000)} Tsd.</text>`).join('')}
    ${plan.map((p, i) => `<rect x="${L + i * bw + 1}" y="${y(p.z + p.t)}" width="${bw - 2}" height="${(p.t / maxA) * (B - T)}" fill="#16A34A"/><rect x="${L + i * bw + 1}" y="${y(p.z)}" width="${bw - 2}" height="${(p.z / maxA) * (B - T)}" fill="#0F2C59"/>`).join('')}
    <polyline points="${pts}" fill="none" stroke="#F59E0B" stroke-width="2.5"/>
    ${[1, 10, 20, plan.length].map((j) => `<text x="${L + (j - 1) * bw + bw / 2}" y="${B + 16}" text-anchor="middle" class="bw-ax">Jahr ${j}</text>`).join('')}
    <line x1="${L + 10 * bw}" y1="${T}" x2="${L + 10 * bw}" y2="${B}" stroke="#DC2626" stroke-dasharray="4 3"/><text x="${L + 10 * bw + 6}" y="${T + 14}" class="bw-ax bw-red">Ende Zinsbindung (10 J.): Restschuld ${E(z10.rest)}</text>
  </svg>
  <div class="bw-legend"><span><i style="background:#0F2C59"></i>Zinsanteil</span><span><i style="background:#16A34A"></i>Tilgungsanteil</span><span><i style="background:#F59E0B"></i>Restschuld (Linie; ganz oben = ${E(f.darlehen)})</span></div>`;
}

function dscrGauge() {
  const f = FALL, noi = (f.kaltmiete - f.nichtUmlage) * 12, d = noi / f.annuitaet;
  const ang = (v) => Math.PI * (1 - Math.min(v, 2) / 2);
  const pt = (v, r) => [160 + r * Math.cos(ang(v)), 150 - r * Math.sin(ang(v))];
  const arc = (a, b, c) => { const [x1, y1] = pt(a, 110), [x2, y2] = pt(b, 110); return `<path d="M${x1},${y1} A110,110 0 0 1 ${x2},${y2}" stroke="${c}" stroke-width="22" fill="none"/>`; };
  const [nx, ny] = pt(d, 92);
  return `<svg class="bw-svg bw-gauge" viewBox="0 0 320 190" role="img" aria-label="DSCR ${N(d)}">
    ${arc(0, 1, '#FCA5A5')}${arc(1, 1.2, '#FDE68A')}${arc(1.2, 2, '#86EFAC')}
    <line x1="160" y1="150" x2="${nx}" y2="${ny}" stroke="#0F2C59" stroke-width="4" stroke-linecap="round"/><circle cx="160" cy="150" r="7" fill="#0F2C59"/>
    <text x="160" y="182" text-anchor="middle" class="bw-big">DSCR ${N(d)}</text>
    <text x="40" y="168" class="bw-ax">0</text><text x="160" y="22" text-anchor="middle" class="bw-ax">1,0</text><text x="268" y="168" class="bw-ax">2,0</text>
  </svg>`;
}

// ---------- 6. Rechtsrahmen ----------
const RECHT = [
  ['§ 34c GewO', 'Immobilienmakler, Darlehensvermittler (ohne Immobiliar-Verbraucherdarlehen), Bauträger, WEG-Verwalter', 'Erlaubnis der IHK/Gewerbeamt, MaBV-Pflichten, Weiterbildung 20 Std. in 3 Jahren'],
  ['§ 34i GewO', 'Immobiliardarlehensvermittler (Verbraucher-Baufinanzierung)', 'Sachkundeprüfung, Berufshaftpflicht, Registrierung im Vermittlerregister (DIHK), ImmVermV'],
  ['KWG / CRR', 'Kreditinstitute', 'Erlaubnis BaFin, Eigenmittel nach CRR (Basel III), § 18 KWG: Offenlegung der wirtschaftlichen Verhältnisse ab 750.000 €'],
  ['MaRisk BTO 1', 'Kreditgeschäft der Banken', 'Funktionstrennung Markt / Marktfolge, Votierung, Kreditprozesse, Risikoklassifizierung'],
  ['§§ 491 ff., 505a–505e BGB', 'Immobiliar-Verbraucherdarlehen (Umsetzung der Wohnimmobilienkreditrichtlinie)', 'Kreditwürdigkeitsprüfung, ESIS-Merkblatt (Art. 247 EGBGB), Widerrufsrecht, Beratungsstandards'],
  ['§ 656c BGB', 'Maklerprovision bei Wohnung / Einfamilienhaus an Verbraucher', 'Halbteilungsgrundsatz: Käufer zahlt höchstens so viel wie der Verkäufer'],
  ['Art. 28 DSGVO', 'Verarbeitung von Kundendaten im Auftrag', 'Auftragsverarbeitungsvertrag (AVV) – im Portal unter „Profil“ abgeschlossen'],
];

// ---------- 7. Fachglossar ----------
const GLOSSAR = [
  ['Annuität', 'Gleichbleibende Jahresleistung aus Zins und Tilgung. Der Zinsanteil sinkt, der Tilgungsanteil steigt mit jeder Rate.'],
  ['Anschlussfinanzierung', 'Neue Konditionen für die Restschuld nach Ablauf der Sollzinsbindung – intern als Prolongation oder extern als Umschuldung.'],
  ['Auszahlungsvoraussetzungen', 'Bedingungen vor der Valutierung, z. B. eingetragene Grundschuld, Notarbestätigung, Nachweis der Eigenmittel.'],
  ['Beleihungsauslauf', 'Darlehen im Verhältnis zum Beleihungswert. Wichtigster Treiber der Zinsstaffel neben der Bonität.'],
  ['Beleihungswert', 'Vorsichtig ermittelter, langfristig erzielbarer Wert nach BelWertV – meist unter dem Marktwert.'],
  ['Bereitstellungszinsen', 'Entgelt für zugesagte, aber noch nicht abgerufene Darlehensbeträge nach Ablauf der bereitstellungsfreien Zeit.'],
  ['Bonität', 'Kreditwürdigkeit des Kunden aus Einkommen, Vermögen, Zahlungsverhalten und Beschäftigungssituation.'],
  ['CRR', 'Capital Requirements Regulation (EU) – setzt Basel III um; regelt u. a. die Risikogewichte für immobilienbesicherte Kredite.'],
  ['DSCR', 'Debt Service Coverage Ratio: Nettomietertrag ÷ Kapitaldienst. Unter 1,0 muss der Kapitaldienst teilweise aus anderem Einkommen getragen werden.'],
  ['Eigenkapitalquote', 'Eigenmittel im Verhältnis zum Gesamtaufwand (Kaufpreis + Nebenkosten).'],
  ['Erwerbsnebenkosten', 'Grunderwerbsteuer (3,5–6,5 % je Bundesland), Notar und Grundbuch (rund 1,5–2 %), ggf. Maklerprovision.'],
  ['ESIS-Merkblatt', 'Europäisches Standardisiertes Merkblatt mit allen wesentlichen Darlehensbedingungen vor Vertragsschluss.'],
  ['Grundschuld', 'Grundpfandrecht im Grundbuch (Abt. III) als Sicherheit der Bank; mit Sicherungszweckerklärung an das Darlehen gebunden.'],
  ['Haushaltsrechnung', 'Gegenüberstellung von Einnahmen und Ausgaben zur Prüfung der Kapitaldienstfähigkeit.'],
  ['Kapitaldienstfähigkeit (KDF)', 'Fähigkeit, Zins und Tilgung dauerhaft aus dem verfügbaren Einkommen zu leisten – auch nach einem Zinsanstieg.'],
  ['KfW-Förderung', 'Förderkredite der KfW (z. B. Wohneigentum, energieeffiziente Gebäude), meist über die Hausbank beantragt.'],
  ['LTV', 'Loan-to-Value: Darlehen im Verhältnis zum Markt- oder Kaufpreis (international üblich).'],
  ['Marktwert', 'Verkehrswert nach § 194 BauGB: Preis, der am Stichtag im gewöhnlichen Geschäftsverkehr erzielbar wäre.'],
  ['Nachrangdarlehen', 'Darlehen mit schlechterer Rangstelle im Grundbuch; höheres Risiko, daher höherer Zins.'],
  ['PD', 'Probability of Default: geschätzte Ausfallwahrscheinlichkeit aus dem internen Rating der Bank.'],
  ['Realkredit', 'Grundpfandrechtlich gesicherter Kredit innerhalb von 60 % des Beleihungswerts (Pfandbrief-Deckungsgrenze nach § 14 PfandBG).'],
  ['Restschuld', 'Offener Darlehensbetrag zu einem Stichtag, insbesondere zum Ende der Sollzinsbindung.'],
  ['Sicherheitsabschlag', 'Bankindividueller Abschlag vom Marktwert zur Ermittlung des Beleihungswerts (häufig 10–20 %).'],
  ['Sollzinsbindung', 'Zeitraum mit festem Sollzins. Nach 10 Jahren besteht ein gesetzliches Kündigungsrecht (§ 489 Abs. 1 Nr. 2 BGB) mit 6 Monaten Frist.'],
  ['Sondertilgung', 'Vertraglich vereinbarte außerplanmäßige Tilgung, z. B. 5 % der Darlehenssumme pro Jahr.'],
  ['Stresszins', 'Angenommener höherer Zins nach Zinsbindungsende, mit dem die Tragfähigkeit vorsichtig geprüft wird.'],
  ['Valutierung', 'Auszahlung des Darlehens; ab dann laufen Sollzinsen.'],
  ['Vorfälligkeitsentschädigung', 'Ausgleich des Zinsschadens der Bank bei vorzeitiger Rückzahlung innerhalb der Zinsbindung (§ 502 BGB).'],
  ['Zweckerklärung', 'Sicherungsabrede, welche Forderungen die Grundschuld absichert (eng oder weit).'],
];

const CHAPTERS = [
  ['mind', 'Mindmap'], ['ns', 'Struktogramm'], ['prozess', 'Prozess'], ['kpi', 'Kennzahlen'], ['charts', 'Diagramme'], ['recht', 'Rechtsrahmen'], ['glossar', 'Glossar'],
];

export function renderWissen(box) {
  const f = FALL;
  const noi = (f.kaltmiete - f.nichtUmlage) * 12;
  box.innerHTML = `<div class="bw">
    <section class="pt-card bw-hero"><span class="bw-kick">ImmoAdv Academy · für Makler, Vermittler und Banken</span>
      <h2>Fachwissen Baufinanzierung – visuell erklärt</h2>
      <p>Wie Banken eine Wohnimmobilienfinanzierung prüfen, welche Kennzahlen entscheiden und wo ImmoAdv im Prozess unterstützt. Alle Grafiken beruhen auf einem durchgängigen, nachrechenbaren Beispielfall.</p>
      <nav class="bw-toc" aria-label="Kapitel">${CHAPTERS.map(([k, l], i) => `<a href="#wissen=${k}" data-ch="${k}"><b>${i + 1}</b>${l}</a>`).join('')}</nav>
      <div class="bw-case"><strong>Beispielfall</strong><span>Kaufpreis ${E(f.kaufpreis)}</span><span>Nebenkosten ${P(f.nebenkosten)}</span><span>Eigenkapital ${E(f.eigenkapital)}</span><span>Darlehen ${E(f.darlehen)}</span><span>Sollzins ${P(f.zins, 2)} · Tilgung ${P(f.tilgung, 0)}</span><span>Rate ${E(f.rate, 2)} mtl.</span></div>
    </section>

    <section class="pt-card" id="bw-mind"><h2><b class="bw-no">1</b> Mindmap: Was die Kreditentscheidung bestimmt</h2>
      <p class="form-note">Sechs Prüffelder, die in jedem Kreditvotum zusammenlaufen. Schwächen in einem Feld lassen sich teilweise durch Stärken in einem anderen ausgleichen – etwa ein hoher Beleihungsauslauf durch sehr gute Bonität.</p>${mindmap()}</section>

    <section class="pt-card" id="bw-ns"><h2><b class="bw-no">2</b> Struktogramm: Kreditvorprüfung</h2>
      <p class="form-note">Nassi-Shneiderman-Darstellung des typischen Prüfablaufs: Sequenzen (Rechteck), Verzweigungen (Dreieck mit ja / nein) und Wiederholung (Schleife). So bereiten Sie Fälle vor, bevor sie zur Bank gehen.</p>${ns()}</section>

    <section class="pt-card" id="bw-prozess"><h2><b class="bw-no">3</b> Prozess: Von der Anfrage bis zur Auszahlung</h2>
      <p class="form-note">Swimlane-Diagramm mit vier Beteiligten. ImmoAdv bereitet Daten und Unterlagen technisch auf – Beratung, Vermittlung und Kreditentscheidung bleiben bei Ihnen bzw. der Bank.</p>${swimlane()}</section>

    <section class="pt-card" id="bw-kpi"><h2><b class="bw-no">4</b> Kennzahlenbaum mit Formeln</h2>
      <p class="form-note">Wie die Kennzahlen voneinander abhängen – berechnet für den Beispielfall.</p>${baum()}</section>

    <section class="pt-card" id="bw-charts"><h2><b class="bw-no">5</b> Diagramme</h2>
      <div class="bw-grid">
        <figure class="bw-fig"><figcaption><strong>Beleihungswert und Beleihungsauslauf</strong><span>Sicherheitsabschlag ${P(f.abschlag, 0)} · Beleihungsauslauf ${P(f.darlehen / f.beleihungswert)} · LTV ${P(f.darlehen / f.marktwert)}</span></figcaption>${chartBeleihung()}
          <p class="form-note">Der Teil des Darlehens oberhalb von 60 % des Beleihungswerts ist für die Bank kein „Realkredit“ und wird vorsichtiger bewertet. Faustregel: Jede Stufe beim Beleihungsauslauf (60 / 80 / 90 / 100 %) kann die Zinskondition verändern – die genaue Staffel ist bankindividuell.</p></figure>
        <figure class="bw-fig"><figcaption><strong>Haushaltsrechnung (Wasserfall)</strong><span>Kapitaldienstfähigkeit im Beispielfall</span></figcaption>${chartWasserfall()}
          <p class="form-note">Banken setzen Lebenshaltungskosten pauschal je Person an und prüfen die Rate zusätzlich mit einem Stresszins nach Ablauf der Zinsbindung.</p></figure>
        <figure class="bw-fig bw-wide"><figcaption><strong>Annuitätendarlehen über 30 Jahre</strong><span>${E(f.darlehen)} · ${P(f.zins, 2)} Sollzins · ${P(f.tilgung, 0)} Anfangstilgung</span></figcaption>${chartAnnuitaet()}
          <p class="form-note">Die Rate bleibt gleich, der Zinsanteil sinkt. Die Restschuld am Ende der Zinsbindung ist das Zinsänderungsrisiko – deshalb gehört sie in jedes Beratungsprotokoll.</p></figure>
        <figure class="bw-fig"><figcaption><strong>DSCR – wenn die Wohnung vermietet wird</strong><span>Nettomietertrag ${E(noi)} p. a. ÷ Kapitaldienst ${E(f.annuitaet)}</span></figcaption>${dscrGauge()}
          <p class="form-note">Rot: Miete deckt den Kapitaldienst nicht (unter 1,0). Gelb: knapp (1,0–1,2). Grün: komfortabel (ab 1,2). Bei Kapitalanlagen rechnen viele Banken die Miete nur zu 70–80 % an.</p></figure>
      </div></section>

    <section class="pt-card" id="bw-recht"><h2><b class="bw-no">6</b> Rechtsrahmen: Wer darf was?</h2>
      <div class="ad-wrap"><table class="bw-table"><thead><tr><th>Norm</th><th>Gilt für</th><th>Kernpflichten</th></tr></thead><tbody>${RECHT.map(([a, b, c]) => `<tr><td><strong>${a}</strong></td><td>${b}</td><td>${c}</td></tr>`).join('')}</tbody></table></div>
      <p class="form-note">ImmoAdv ist ein technisches Analyse- und Vorbereitungswerkzeug und vermittelt keine Kredite. Stand: Oktober 2026 – Orientierung, keine Rechtsberatung.</p></section>

    <section class="pt-card" id="bw-glossar"><h2><b class="bw-no">7</b> Fachglossar</h2>
      <input type="search" id="bwQ" class="bw-q" placeholder="Fachbegriff suchen, z. B. Beleihungswert" aria-label="Fachbegriff suchen">
      <dl class="bw-gl">${GLOSSAR.map(([t, d]) => `<div data-q="${esc((t + ' ' + d).toLowerCase())}"><dt>${t}</dt><dd>${d}</dd></div>`).join('')}</dl>
      <p class="form-note" id="bwCount">${GLOSSAR.length} Begriffe</p></section>
  </div>`;
  const q = box.querySelector('#bwQ');
  q.oninput = () => {
    const t = q.value.trim().toLowerCase(); let n = 0;
    box.querySelectorAll('.bw-gl > div').forEach((d) => { const ok = !t || d.dataset.q.includes(t); d.hidden = !ok; if (ok) n++; });
    box.querySelector('#bwCount').textContent = `${n} von ${GLOSSAR.length} Begriffen`;
  };
  box.querySelectorAll('[data-ch]').forEach((a) => a.onclick = (e) => { e.preventDefault(); box.querySelector('#bw-' + a.dataset.ch)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  const want = /wissen=([a-z]+)/.exec(location.hash)?.[1];
  if (want) requestAnimationFrame(() => box.querySelector('#bw-' + want)?.scrollIntoView({ block: 'start' }));
}
