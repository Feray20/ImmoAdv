'use client';
import { useMemo, useState } from 'react';

const DISCLAIMER =
  'Reines technisches Analyse-, Informations- und Vorbereitungsinstrument. Keine Rechts-, Steuer- oder Finanzierungsberatung gem. § 34i GewO / KWG.';

const euro = (n: number | null) =>
  n === null || !Number.isFinite(n)
    ? '–'
    : new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const pct = (n: number | null) =>
  n === null || !Number.isFinite(n) ? '–' : `${new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n * 100)} %`;
const dec = (n: number | null) =>
  n === null || !Number.isFinite(n) ? '–' : new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const clamp = (x: number) => Math.min(100, Math.max(0, x));

type P = {
  purchasePrice: number; monthlyNetRent: number; monthlyVacancy: number; monthlyNonRecoverableCosts: number;
  monthlyMaintenance: number; annualOperatingCashCosts: number; debtAmount: number; annualInterest: number;
  annualPrincipal: number; lendingValue: number; liquidityReserve: number;
  documentationScore: number; legalRiskScore: number; technicalRiskScore: number;
};

// Fiktiver Beispielfall – alle Werte sind editierbar.
const DEFAULTS: P = {
  purchasePrice: 400000, monthlyNetRent: 2200, monthlyVacancy: 100, monthlyNonRecoverableCosts: 250,
  monthlyMaintenance: 200, annualOperatingCashCosts: 600, debtAmount: 300000, annualInterest: 12000,
  annualPrincipal: 9000, lendingValue: 350000, liquidityReserve: 30000,
  documentationScore: 0, legalRiskScore: 0, technicalRiskScore: 0,
};

const FIELDS: [keyof P, string, string][] = [
  ['purchasePrice', 'Kaufpreis', '€'],
  ['monthlyNetRent', 'Nettokaltmiete / Monat', '€'],
  ['monthlyVacancy', 'Leerstand / Monat', '€'],
  ['monthlyNonRecoverableCosts', 'Nicht umlagefähig / Monat', '€'],
  ['monthlyMaintenance', 'Instandhaltung / Monat', '€'],
  ['annualOperatingCashCosts', 'Sonstige Kosten / Jahr', '€'],
  ['debtAmount', 'Darlehen', '€'],
  ['annualInterest', 'Zinsen / Jahr', '€'],
  ['annualPrincipal', 'Tilgung / Jahr', '€'],
  ['lendingValue', 'Beleihungswert', '€'],
  ['liquidityReserve', 'Liquiditätsreserve', '€'],
];
const CHECKS: [keyof P, string][] = [
  ['documentationScore', 'Unterlagen geprüft (0–100)'],
  ['legalRiskScore', 'Rechtliche Prüfung (0–100)'],
  ['technicalRiskScore', 'Technische Prüfung (0–100)'],
];

type Tone = 'ok' | 'warn' | 'bad' | 'none';
const tone = (v: number | null, ok: number, warn: number, higherIsBetter = true): Tone => {
  if (v === null || !Number.isFinite(v)) return 'none';
  if (higherIsBetter) return v >= ok ? 'ok' : v >= warn ? 'warn' : 'bad';
  return v <= ok ? 'ok' : v <= warn ? 'warn' : 'bad';
};

export default function Cockpit() {
  const [p, setP] = useState<P>(DEFAULTS);
  const set = (k: keyof P, v: string) => setP((x) => ({ ...x, [k]: v === '' ? 0 : Number(v) }));

  const a = useMemo(() => {
    const rent = p.monthlyNetRent * 12;
    const noi = rent - (p.monthlyVacancy + p.monthlyNonRecoverableCosts + p.monthlyMaintenance) * 12;
    const cfads = noi - p.annualOperatingCashCosts;
    const ds = p.annualInterest + p.annualPrincipal;
    const dscr = ds ? cfads / ds : null;
    const icr = p.annualInterest ? noi / p.annualInterest : null;
    const ltv = p.purchasePrice ? p.debtAmount / p.purchasePrice : null;
    const ltvLending = p.lendingValue ? p.debtAmount / p.lendingValue : null;
    const checksDone = p.documentationScore > 0 && p.legalRiskScore > 0 && p.technicalRiskScore > 0;

    const raw =
      clamp(((dscr ?? 0) / 1.25) * 100) * 0.25 +
      clamp(((icr ?? 0) / 2) * 100) * 0.1 +
      clamp((1 - ((ltv ?? 1) - 0.6) / 0.4) * 100) * 0.15 +
      p.documentationScore * 0.15 + p.legalRiskScore * 0.15 + p.technicalRiskScore * 0.1 +
      clamp((p.liquidityReserve / (ds || 1)) * 100) * 0.1;

    // Harte Abweichung: Deckt die Miete den Kapitaldienst nicht, kann der Fall nicht als bankfähig gelten.
    const veto = dscr !== null && dscr < 1;
    const score = Math.round(veto ? Math.min(raw, 49) : raw);
    return { noi, cfads, ds, dscr, icr, ltv, ltvLending, score, veto, checksDone };
  }, [p]);

  const scenarios = (
    [['Basisfall', 0], ['Moderat', 0.1], ['Schwer', 0.25], ['Extrem', 0.4]] as const
  ).map(([name, d]) => {
    const cf = a.cfads * (1 - d) - p.annualInterest * d;
    const ds = p.annualInterest * (1 + d) + p.annualPrincipal;
    return { name, d, cf, dscr: ds ? cf / ds : null };
  });

  const scoreTone: Tone = a.veto ? 'bad' : !a.checksDone ? 'none' : a.score >= 70 ? 'ok' : a.score >= 50 ? 'warn' : 'bad';

  return (
    <div className="ck">
      <header className="ck-top">
        <a className="ck-brand" href="/"><span>IA</span>ImmoAdv</a>
        <nav><a href="/wissen">Wissen</a><a href="/checkliste">Checkliste</a><a href="/angebote">Angebote</a><a href="/mustermappe">Mustermappe</a></nav>
      </header>

      <main className="ck-wrap">
        <div className="ck-head">
          <div>
            <div className="ck-kicker">Investment-Cockpit</div>
            <h1>Objekt- und Kapitaldienstprüfung</h1>
            <p className="ck-muted">Fiktiver Beispielfall. Alle Werte sind editierbar und werden nur in diesem Browser berechnet.</p>
          </div>
        </div>

        <section className="ck-grid">
          <aside className="ck-card">
            <h2>Objekt &amp; Finanzierung</h2>
            {FIELDS.map(([k, l, u]) => (
              <label key={k} className="ck-field">
                <span>{l}</span>
                <span className="ck-input"><input type="number" inputMode="decimal" value={p[k]} onChange={(e) => set(k, e.target.value)} /><em>{u}</em></span>
              </label>
            ))}
            <h3>Prüfstand (Selbsteinschätzung)</h3>
            {CHECKS.map(([k, l]) => (
              <label key={k} className="ck-field">
                <span>{l}</span>
                <span className="ck-input"><input type="number" min={0} max={100} value={p[k]} onChange={(e) => set(k, e.target.value)} /><em>Pkt.</em></span>
              </label>
            ))}
            <p className="ck-note">0 = ungeprüft. Ohne Prüfung bleibt der Score im Status „Ungeprüft“.</p>
          </aside>

          <section className="ck-main">
            <div className="ck-card">
              <h2>Kennzahlen</h2>
              <table className="ck-table">
                <thead><tr><th>Kennzahl</th><th>Wert</th><th>Status</th></tr></thead>
                <tbody>
                  <tr><td>NOI (Nettomietertrag p. a.)</td><td>{euro(a.noi)}</td><td><i className="st none">Information</i></td></tr>
                  <tr><td>CFADS (verfügbar für Kapitaldienst p. a.)</td><td>{euro(a.cfads)}</td><td><i className="st none">Information</i></td></tr>
                  <tr><td>Kapitaldienst p. a.</td><td>{euro(a.ds)}</td><td><i className="st none">Information</i></td></tr>
                  <tr><td>DSCR (Kapitaldienstdeckung)</td><td>{dec(a.dscr)}</td><td><i className={`st ${tone(a.dscr, 1.2, 1)}`}>{a.dscr === null ? 'Ungeprüft' : a.dscr >= 1.2 ? 'Tragfähig' : a.dscr >= 1 ? 'Knapp' : 'Nicht gedeckt'}</i></td></tr>
                  <tr><td>ICR (Zinsdeckung)</td><td>{dec(a.icr)}</td><td><i className={`st ${tone(a.icr, 2, 1.5)}`}>{a.icr === null ? 'Ungeprüft' : a.icr >= 2 ? 'Tragfähig' : a.icr >= 1.5 ? 'Knapp' : 'Schwach'}</i></td></tr>
                  <tr><td>LTV (Darlehen ÷ Kaufpreis)</td><td>{pct(a.ltv)}</td><td><i className={`st ${tone(a.ltv, 0.8, 0.9, false)}`}>{a.ltv === null ? 'Ungeprüft' : a.ltv <= 0.8 ? 'Im Rahmen' : a.ltv <= 0.9 ? 'Erhöht' : 'Hoch'}</i></td></tr>
                  <tr><td>Beleihungsauslauf (Darlehen ÷ Beleihungswert)</td><td>{pct(a.ltvLending)}</td><td><i className={`st ${tone(a.ltvLending, 0.8, 1, false)}`}>{a.ltvLending === null ? 'Ungeprüft' : a.ltvLending <= 0.8 ? 'Im Rahmen' : a.ltvLending <= 1 ? 'Erhöht' : 'Blankoanteil'}</i></td></tr>
                </tbody>
              </table>
              <p className="ck-note">Schwellenwerte sind ImmoAdv-interne Orientierungswerte, keine Kriterien einer bestimmten Bank.</p>
            </div>

            <div className="ck-card">
              <h2>Stresstest</h2>
              <p className="ck-muted">Gleichzeitige Minderung des CFADS und Erhöhung des Zinsaufwands um den angegebenen Prozentsatz.</p>
              <table className="ck-table">
                <thead><tr><th>Szenario</th><th>Stress</th><th>CFADS p. a.</th><th>DSCR</th></tr></thead>
                <tbody>
                  {scenarios.map((s) => (
                    <tr key={s.name}>
                      <td>{s.name}</td><td>{pct(s.d)}</td><td>{euro(s.cf)}</td>
                      <td><i className={`st ${tone(s.dscr, 1.2, 1)}`}>{dec(s.dscr)}</i></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="ck-side">
            <div className="ck-card">
              <div className="ck-kicker">Banken-Ready-Score</div>
              <div className="ck-score">{a.checksDone || a.veto ? a.score : '–'}<small>/100</small></div>
              <div className="ck-bar"><div className={`ck-fill ${scoreTone}`} style={{ width: `${a.checksDone || a.veto ? a.score : 0}%` }} /></div>
              <p className="ck-note">
                {a.veto
                  ? 'Gedeckelt auf höchstens 49, weil der DSCR unter 1,00 liegt.'
                  : !a.checksDone
                  ? 'Ungeprüft: Bitte den Prüfstand ausfüllen.'
                  : 'Interne ImmoAdv-Einstufung. Keine Bankzusage.'}
              </p>
            </div>

            <div className="ck-card">
              <h2>Veto-Center</h2>
              {a.veto ? (
                <div className="ck-flag bad">Veto: DSCR unter 1,00 – die Mieteinnahmen decken den Kapitaldienst nicht.</div>
              ) : (
                <div className="ck-flag ok">Keine harte Abweichung beim Kapitaldienst erkannt.</div>
              )}
              <div className="ck-flag warn">Kennzahlen sind erst belastbar, wenn sie mit Unterlagen belegt sind.</div>
            </div>

            <div className="ck-card">
              <h2>Dokumentenprüfung</h2>
              <table className="ck-table">
                <tbody>
                  {['Upload & Dateityp-Prüfung', 'Prüfsumme (SHA-256)', 'Texterkennung & Klassifizierung', 'Datenextraktion', 'Belegverknüpfung', 'Abgleich zwischen Dokumenten'].map((x) => (
                    <tr key={x}><td>{x}</td><td><i className="st none">In Entwicklung</i></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </aside>
        </section>

        <footer className="ck-foot">
          <p>{DISCLAIMER}</p>
          <p><a href="/impressum">Impressum</a> · <a href="/datenschutz">Datenschutz</a> · <a href="/nutzungsbedingungen">Nutzungsbedingungen</a> · <a href="/kuendigen">Verträge hier kündigen</a></p>
        </footer>
      </main>
    </div>
  );
}
