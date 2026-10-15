// ImmoAdv – gemeinsamer Rechenkern für Rechner, Fristen, Szenarien und Portfolio.
// Reine Funktionen ohne DOM; im Browser als Modul geladen und mit node:test geprüft.
// Alle Rechtsangaben: Stand Oktober 2026; maßgeblich ist die jeweils aktuelle Fassung.

const r2 = (x) => Math.round(x * 100) / 100;

// ---------- Annuitätendarlehen ----------
export function monthlyRate(loan, ratePa, repaymentPa) {
  return loan > 0 ? (loan * (ratePa + repaymentPa)) / 12 : 0;
}

export function balanceAfterMonths(loan, ratePa, repaymentPa, months) {
  if (loan <= 0) return 0;
  const i = ratePa / 12;
  const a = monthlyRate(loan, ratePa, repaymentPa);
  if (i === 0) return Math.max(0, loan - a * months);
  const q = Math.pow(1 + i, months);
  return Math.max(0, loan * q - a * ((q - 1) / i));
}

// Monatliche Bewirtschaftung vor Finanzierung: Miete abzüglich Mietausfall und nicht umlagefähiger Kosten.
export function netOperatingMonthly({ rent = 0, vacancyPct = 0, nonRecoverable = 0, maintenance = 0 }) {
  return rent * (1 - vacancyPct / 100) - nonRecoverable - maintenance;
}

// ---------- Anschlussfinanzierung ----------
// Restschuld am Ende der Zinsbindung, neue Rate je Zinssatz und Kipp-Punkt (Zins, bei dem der Cashflow vor Steuern 0 wird).
export function anschluss({ loan, ratePa, repaymentPa, fixedYears, noiMonthly, newRepaymentPa = repaymentPa, rates = [0.03, 0.04, 0.05, 0.06, 0.07] }) {
  const rest = balanceAfterMonths(loan, ratePa, repaymentPa, Math.round(fixedYears * 12));
  const oldRate = monthlyRate(loan, ratePa, repaymentPa);
  const rows = rates.map((r) => {
    const rate = monthlyRate(rest, r, newRepaymentPa);
    return { ratePa: r, rate: r2(rate), diff: r2(rate - oldRate), cashflow: r2(noiMonthly - rate) };
  });
  // Kipp-Punkt: noi = rest*(r+t)/12  →  r = 12*noi/rest − t
  const kipp = rest > 0 ? (12 * noiMonthly) / rest - newRepaymentPa : null;
  return { rest: r2(rest), oldRate: r2(oldRate), rows, kippPunktPa: kipp === null ? null : Math.round(kipp * 10000) / 10000 };
}

// ---------- Verkaufsszenario ----------
// Veräußerungsgewinn nach § 23 EStG: Verkaufserlös − Verkaufskosten − (Anschaffungskosten − in Anspruch genommene AfA).
// Steuerpflicht nur bei Verkauf innerhalb von zehn Jahren; Freigrenze 1.000 € je Jahr (§ 23 Abs. 3 Satz 5 EStG, seit VZ 2024).
export function verkauf({ price, purchaseCostPct = 0, buildingSharePct = 80, afaRatePa = 0.02, years, growthPa = 0, saleCostPct = 0, loan = 0, ratePa = 0, repaymentPa = 0, taxPct = 0 }) {
  const ak = price * (1 + purchaseCostPct / 100);
  const afaBasis = ak * (buildingSharePct / 100);
  const afaTaken = Math.min(afaBasis, afaBasis * afaRatePa * years);
  const value = price * Math.pow(1 + growthPa, years);
  const saleNet = value * (1 - saleCostPct / 100);
  const book = ak - afaTaken;
  const gain = saleNet - book;
  const within10 = years < 10;
  const taxable = within10 && gain >= 1000 ? gain : 0;
  const tax = Math.max(0, taxable) * (taxPct / 100);
  const rest = balanceAfterMonths(loan, ratePa, repaymentPa, Math.round(years * 12));
  return {
    ak: r2(ak), afaTaken: r2(afaTaken), value: r2(value), saleNet: r2(saleNet), book: r2(book), gain: r2(gain),
    within10, tax: r2(tax), rest: r2(rest), cashAfterSale: r2(saleNet - rest - tax),
  };
}

// ---------- Mietrecht ----------
// Indexmiete (§ 557b BGB): Änderung im Verhältnis des Verbraucherpreisindex; frühestens zwölf Monate nach der letzten Änderung wirksam.
export function indexmiete({ rent, indexOld, indexNew, lastChange, effective }) {
  if (!(indexOld > 0) || !(indexNew > 0)) return null;
  const factor = indexNew / indexOld;
  const out = { newRent: r2(rent * factor), changePct: Math.round((factor - 1) * 10000) / 100, diff: r2(rent * factor - rent) };
  if (lastChange && effective) {
    const earliest = addMonths(parseDate(lastChange), 12);
    out.earliest = iso(earliest);
    out.timingOk = parseDate(effective) >= earliest;
  }
  return out;
}

// Staffelmiete (§ 557a BGB): Beträge in Euro, jede Staffel mindestens ein Jahr unverändert;
// in Gebieten mit Mietpreisbremse gilt die Grenze für jede Staffel (§ 557a Abs. 4).
export function staffelmiete({ steps, area = 0, vergleichsmieteQm = 0, bremse = false }) {
  const s = [...steps].filter((x) => x.date && x.rent > 0).sort((a, b) => (a.date < b.date ? -1 : 1));
  const cap = bremse && vergleichsmieteQm > 0 && area > 0 ? vergleichsmieteQm * 1.1 * area : null;
  return s.map((x, i) => {
    const prev = s[i - 1];
    const gapOk = !prev || parseDate(x.date) >= addMonths(parseDate(prev.date), 12);
    return {
      date: x.date, rent: r2(x.rent), increase: prev ? r2(x.rent - prev.rent) : 0,
      increasePct: prev ? Math.round((x.rent / prev.rent - 1) * 10000) / 100 : 0,
      gapOk, capOk: cap === null ? null : x.rent <= cap + 0.005, cap: cap === null ? null : r2(cap),
    };
  });
}

// ---------- Steuer ----------
// Kaufpreisaufteilung nach der Restwertmethode: Bodenwert = Grundstücksfläche × Bodenrichtwert × Miteigentumsanteil.
// Vereinfachung: Die BMF-Arbeitshilfe nutzt ein Sachwertverfahren; das Finanzamt kann abweichen.
export function kaufpreisaufteilung({ price, landArea, bodenrichtwert, meaShare = 1, meaTotal = 1 }) {
  const frac = meaTotal > 0 ? meaShare / meaTotal : 1;
  const land = Math.min(price, landArea * bodenrichtwert * frac);
  const building = price - land;
  return { land: r2(land), building: r2(building), buildingSharePct: price > 0 ? Math.round((building / price) * 10000) / 100 : 0 };
}

// Anschaffungsnahe Herstellungskosten (§ 6 Abs. 1 Nr. 1a EStG): 15 % der Gebäude-Anschaffungskosten netto, drei Jahre ab Anschaffung.
export function grenze15({ price, purchaseCostPct = 0, buildingSharePct = 80, spentNet = 0 }) {
  const akGebaeude = price * (1 + purchaseCostPct / 100) * (buildingSharePct / 100);
  const limit = akGebaeude * 0.15;
  return { akGebaeude: r2(akGebaeude), limit: r2(limit), spent: r2(spentNet), headroom: r2(limit - spentNet), exceeded: spentNet > limit };
}

// ---------- Fristen ----------
export function parseDate(s) {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}
export function iso(d) { return d.toISOString().slice(0, 10); }
export function addMonths(d, n) {
  const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  const last = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).getUTCDate();
  x.setUTCDate(Math.min(d.getUTCDate(), last));
  return x;
}
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);

// Liefert sortierte Termine. Eingaben als ISO-Datum (JJJJ-MM-TT); fehlende Angaben werden übersprungen.
export function fristen({ purchaseDate, payoutDate, fixedYears, lastRentChange, indexRent = false, energyCertDate }) {
  const out = [];
  const push = (date, title, detail, source, kind = 'frist') => out.push({ date: iso(date), title, detail, source, kind });
  if (purchaseDate) {
    const p = parseDate(purchaseDate);
    push(addMonths(p, 36), 'Ende der 15-%-Frist für Instandsetzungen',
      'Bis hier zählen Instandsetzungs- und Modernisierungskosten (netto) für die 15-%-Grenze der Gebäude-Anschaffungskosten. Beginn ist die Anschaffung (Übergang von Nutzen und Lasten); bitte mit diesem Datum rechnen.',
      '§ 6 Abs. 1 Nr. 1a EStG');
    push(addDays(addMonths(p, 120), 1), 'Verkauf ohne Spekulationssteuer möglich',
      'Ab diesem Tag liegen zwischen Kaufvertrag und Verkaufsvertrag mehr als zehn Jahre. Maßgeblich sind die Daten der notariellen Verträge.',
      '§ 23 Abs. 1 Satz 1 Nr. 1 EStG');
  }
  const pay = payoutDate || purchaseDate;
  if (pay && fixedYears > 0) {
    const p = parseDate(pay);
    const end = addMonths(p, Math.round(fixedYears * 12));
    push(addMonths(end, -12), 'Anschlussfinanzierung vorbereiten',
      'Empfehlung: zwölf Monate vor Ablauf Angebote einholen und Restschuld prüfen. Forward-Darlehen sind je nach Bank deutlich früher möglich.',
      'Empfehlung ImmoAdv', 'hinweis');
    push(end, 'Ende der Zinsbindung', 'Ab hier gilt der neue Zinssatz. Restschuld und Anschluss-Szenarien in „Szenarien“ prüfen.', 'Darlehensvertrag');
    if (fixedYears > 10) {
      const notice = addMonths(p, 120);
      push(notice, 'Kündigungsrecht nach zehn Jahren (frühestens kündigen)',
        'Bei Zinsbindung über zehn Jahre kann der Darlehensnehmer zehn Jahre nach vollständigem Empfang des Darlehens mit sechs Monaten Frist kündigen. Auszahlungsdatum laut Bank verwenden.',
        '§ 489 Abs. 1 Nr. 2 BGB');
      push(addMonths(notice, 6), 'Frühestes Vertragsende nach Kündigung', 'Sechs Monate nach der Kündigung.', '§ 489 Abs. 1 Nr. 2 BGB');
    }
  }
  if (lastRentChange) {
    const c = parseDate(lastRentChange);
    if (indexRent) {
      push(addMonths(c, 12), 'Indexmiete: nächste Anpassung frühestens wirksam',
        'Die Miete muss jeweils mindestens ein Jahr unverändert bleiben (Erhöhungen nach § 559 BGB und Änderungen nach § 557b ausgenommen).',
        '§ 557b Abs. 2 BGB');
    } else {
      push(addMonths(c, 12), 'Mieterhöhung bis zur Vergleichsmiete frühestens verlangen',
        'Das Erhöhungsverlangen kann frühestens ein Jahr nach der letzten Erhöhung gestellt werden.', '§ 558 Abs. 1 Satz 2 BGB');
      push(addMonths(c, 15), 'Mieterhöhung frühestens wirksam',
        'Die Miete muss zum Zeitpunkt der Erhöhung seit 15 Monaten unverändert sein; Kappungsgrenze 20 % bzw. 15 % in drei Jahren beachten.',
        '§ 558 Abs. 1 Satz 1, Abs. 3 BGB');
    }
  }
  if (energyCertDate) {
    push(addMonths(parseDate(energyCertDate), 120), 'Energieausweis läuft ab',
      'Energieausweise gelten zehn Jahre. Bei Verkauf oder Neuvermietung muss ein gültiger Ausweis vorliegen.', 'Energieausweis-Recht (seit 29.07.2026 GModG, zuvor § 79 GEG)');
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

// iCalendar-Datei (RFC 5545) mit ganztägigen Terminen.
export function toICS(events, { name = 'ImmoAdv Fristen', stamp = new Date() } = {}) {
  const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  const fold = (line) => {
    const parts = [];
    let rest = line;
    while (rest.length > 74) { parts.push(rest.slice(0, 74)); rest = ' ' + rest.slice(74); }
    parts.push(rest);
    return parts.join('\r\n');
  };
  const dt = (s) => s.replace(/-/g, '');
  const ts = stamp.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ImmoAdv//Fristen//DE', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${esc(name)}`];
  events.forEach((e, i) => {
    const end = iso(addDays(parseDate(e.date), 1));
    lines.push('BEGIN:VEVENT', `UID:immoadv-${dt(e.date)}-${i}@immoadv.de`, `DTSTAMP:${ts}`,
      `DTSTART;VALUE=DATE:${dt(e.date)}`, `DTEND;VALUE=DATE:${dt(end)}`,
      fold(`SUMMARY:${esc(e.title)}`), fold(`DESCRIPTION:${esc(`${e.detail} Quelle: ${e.source}. Keine Rechtsberatung.`)}`), 'END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

// ---------- Portfolio ----------
// Kennzahlen je Objekt und Summen; Zinsschock wirkt erst ab Ende der jeweiligen Zinsbindung.
export function portfolio(objects, { shockPp = 0 } = {}) {
  const rows = objects.map((o) => {
    const noi = netOperatingMonthly(o);
    const rate = monthlyRate(o.loan || 0, (o.interestPct || 0) / 100, (o.repaymentPct || 0) / 100);
    const cf = noi - rate;
    let after = null;
    if (o.fixedYears > 0 && o.loan > 0) {
      const a = anschluss({ loan: o.loan, ratePa: o.interestPct / 100, repaymentPa: o.repaymentPct / 100, fixedYears: o.fixedYears, noiMonthly: noi,
        rates: [o.interestPct / 100 + shockPp / 100] });
      after = { rest: a.rest, cashflow: a.rows[0].cashflow, rate: a.rows[0].rate };
    }
    return {
      id: o.id, name: o.name, price: o.price || 0, loan: o.loan || 0, rentYear: r2((o.rent || 0) * 12),
      noiMonthly: r2(noi), rate: r2(rate), cashflow: r2(cf),
      dscr: rate > 0 ? Math.round((noi / rate) * 100) / 100 : null,
      ltv: o.price > 0 ? Math.round(((o.loan || 0) / o.price) * 10000) / 100 : null,
      grossYieldPct: o.price > 0 ? Math.round(((o.rent || 0) * 12 / o.price) * 10000) / 100 : null,
      after,
    };
  });
  const sum = (k) => r2(rows.reduce((s, r) => s + (r[k] || 0), 0));
  const noi = sum('noiMonthly'), rate = sum('rate');
  const price = sum('price'), loan = sum('loan');
  return {
    rows,
    total: {
      price, loan, rentYear: sum('rentYear'), noiMonthly: noi, rate, cashflow: sum('cashflow'),
      dscr: rate > 0 ? Math.round((noi / rate) * 100) / 100 : null,
      ltv: price > 0 ? Math.round((loan / price) * 10000) / 100 : null,
      afterCashflow: rows.every((r) => r.after) ? r2(rows.reduce((s, r) => s + r.after.cashflow, 0)) : null,
    },
  };
}
