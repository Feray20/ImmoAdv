import { z } from 'zod';
import { underwrite, type StressCase } from '@/lib/underwriting/engine';
import { bankReadyScore } from '@/lib/underwriting/score';
import type { VetoFinding, VetoLevel } from '@/lib/domain/veto';
import { highestVeto } from '@/lib/domain/veto';

// Eingaben, wie sie im Konto (immo_user_data) gespeichert werden. Alle Beträge in Euro.
const num = (min = 0, max = 1e9) => z.coerce.number().finite().min(min).max(max);

export const ProfileSchema = z.object({
  employment: z.string().max(60).default('Angestellt'),
  netIncome: num().default(0),
  equity: num().default(0),
  householdSize: z.coerce.number().int().min(1).max(12).default(1),
});

export const ObjectSchema = z.object({
  id: z.string().min(4).max(40),
  name: z.string().min(1).max(160),
  price: num(1),
  rent: num(), // Nettokaltmiete pro Monat
  area: num(0, 100000).default(0), // Wohnfläche m²
  yearBuilt: z.coerce.number().int().min(0).max(2100).default(0),
  purchaseCostPct: num(0, 25).default(0), // Kaufnebenkosten in % vom Kaufpreis
  nonRecoverable: num().default(0), // nicht umlagefähige Kosten pro Monat
  maintenance: num().default(0), // Instandhaltung pro Monat
  vacancyPct: num(0, 100).default(0),
  loan: num().default(0),
  interestPct: num(0, 20).default(0),
  repaymentPct: num(0, 20).default(0),
  lendingValue: num().default(0),
  equity: num().default(0),
});

export type Profile = z.infer<typeof ProfileSchema>;
export type PropertyObject = z.infer<typeof ObjectSchema>;

// Lebenshaltungspauschale als ImmoAdv-Annahme (Banken setzen eigene Werte an).
export const LIVING_BASE = 1000;
export const LIVING_PER_PERSON = 350;
// Anteil der Mieteinnahmen, der in der Haushaltsrechnung angesetzt wird (Annahme).
export const RENT_RECOGNITION = 0.75;

export type StressRow = { name: string; assumption: string; cfads: number; debtService: number; dscr: number; cashflow: number };

export type Kreditmappe = {
  object: PropertyObject;
  profile: Profile;
  createdAt: string;
  financing: {
    purchaseCosts: number; totalCost: number; equity: number; loan: number; gap: number;
    monthlyRate: number; annualInterest: number; annualPrincipal: number; balanceAfter10y: number | null;
  };
  metrics: {
    grossYield: number; noi: number; cfads: number; debtService: number; dscr: number; icr: number;
    ltvPurchase: number; ltvLending: number | null; monthlyCashflow: number; pricePerSqm: number | null;
    maintenancePerSqm: number | null;
  };
  household: { income: number; recognizedRent: number; living: number; costs: number; rate: number; surplus: number };
  stress: StressRow[];
  score: { value: number; capped: boolean; note: string };
  vetos: VetoFinding[];
  vetoLevel: VetoLevel;
  documents: { name: string; status: 'Ungeprüft' }[];
};

// Restschuld eines Annuitätendarlehens nach n Jahren (monatliche Zahlung).
export function balanceAfterYears(loan: number, ratePa: number, repaymentPa: number, years: number): number | null {
  if (loan <= 0) return 0;
  const i = ratePa / 12;
  const rate = (loan * (ratePa + repaymentPa)) / 12;
  const m = years * 12;
  if (i === 0) return Math.max(0, loan - rate * m);
  const rest = loan * Math.pow(1 + i, m) - rate * ((Math.pow(1 + i, m) - 1) / i);
  return Math.max(0, rest);
}

const DOCUMENTS = [
  'Personalausweis / Reisepass (Kopie)', 'Selbstauskunft', 'Einkommensnachweise (letzte 3 Monate)',
  'Steuerbescheide (letzte 2–3 Jahre)', 'Eigenkapitalnachweis', 'Bestehende Kredite',
  'Exposé', 'Grundbuchauszug (nicht älter als 3 Monate)', 'Flurkarte', 'Grundrisse und Wohnflächenberechnung',
  'Energieausweis', 'Teilungserklärung (bei ETW)', 'Protokolle der letzten 3 Eigentümerversammlungen (bei ETW)',
  'Wirtschaftsplan und Rücklagenstand (bei ETW)', 'Mietvertrag (bei Vermietung)', 'Kaufvertragsentwurf',
];

export function buildKreditmappe(o: PropertyObject, p: Profile, now = new Date()): Kreditmappe {
  const interest = o.interestPct / 100;
  const repayment = o.repaymentPct / 100;
  const purchaseCosts = (o.price * o.purchaseCostPct) / 100;
  const totalCost = o.price + purchaseCosts;
  const equity = o.equity > 0 ? o.equity : p.equity;
  const annualInterest = o.loan * interest;
  const annualPrincipal = o.loan * repayment;
  const monthlyRate = (annualInterest + annualPrincipal) / 12;

  const uw = underwrite(
    {
      annualNetColdRent: o.rent * 12,
      vacancyRate: o.vacancyPct / 100,
      nonRecoverableOperatingCosts: o.nonRecoverable * 12,
      annualMaintenance: o.maintenance * 12,
      annualInterest,
      annualPrincipal,
      loanAmount: o.loan,
      lendingValue: o.lendingValue > 0 ? o.lendingValue : o.price,
      purchasePrice: o.price,
    },
    stressCases(o),
  );

  const stressNames = ['Basisfall', 'Moderat', 'Schwer', 'Extrem'];
  const stressText = [
    'Eingegebene Werte',
    'Zins +1,0 Pkt., Leerstand +3 Pkt., Instandhaltung +10 %',
    'Zins +2,5 Pkt., Leerstand +8 Pkt., Instandhaltung +25 %',
    'Zins +4,0 Pkt., Leerstand +15 Pkt., Instandhaltung +50 %',
  ];
  const stress: StressRow[] = uw.stress.map((s, k) => ({
    name: stressNames[k] ?? s.case.name,
    assumption: stressText[k] ?? '',
    cfads: s.annualCashflow + s.debtService,
    debtService: s.debtService,
    dscr: s.dscr,
    cashflow: s.annualCashflow,
  }));

  const living = LIVING_BASE + LIVING_PER_PERSON * Math.max(0, p.householdSize - 1);
  const recognizedRent = o.rent * RENT_RECOGNITION;
  const costs = o.nonRecoverable + o.maintenance;
  const surplus = p.netIncome + recognizedRent - living - costs - monthlyRate;

  const gap = totalCost - equity - o.loan;
  const ltvLending = o.lendingValue > 0 ? o.loan / o.lendingValue : null;
  const maintenancePerSqm = o.area > 0 ? o.maintenance / o.area : null;

  const vetos = evaluate({ o, gap, surplus, dscr: uw.dscr, ltvLending, equity, purchaseCosts, maintenancePerSqm, monthlyCashflow: (uw.cfads - uw.debtService) / 12 });

  const raw = bankReadyScore({
    dscr: uw.dscr,
    icr: uw.icr,
    ltv: uw.ltvPurchasePrice,
    documentCompleteness: 0, // keine geprüften Unterlagen
    legalRisk: 100, // rechtlich ungeprüft
    technicalRisk: 100, // technisch ungeprüft
    cashReserveMonths: 0,
  }).score;
  const capped = uw.dscr < 1;
  const score = {
    value: capped ? Math.min(raw, 49) : raw,
    capped,
    note: capped
      ? 'Vorläufig und auf höchstens 49 gedeckelt, weil der DSCR unter 1,00 liegt. Unterlagen, Recht und Technik sind ungeprüft und fließen mit 0 Punkten ein.'
      : 'Vorläufig: Unterlagen, Recht, Technik und Liquiditätsreserve sind ungeprüft und fließen mit 0 Punkten ein.',
  };

  return {
    object: o,
    profile: p,
    createdAt: now.toISOString(),
    financing: {
      purchaseCosts, totalCost, equity, loan: o.loan, gap, monthlyRate, annualInterest, annualPrincipal,
      balanceAfter10y: o.loan > 0 ? balanceAfterYears(o.loan, interest, repayment, 10) : null,
    },
    metrics: {
      grossYield: o.price > 0 ? (o.rent * 12) / o.price : 0,
      noi: uw.noi, cfads: uw.cfads, debtService: uw.debtService, dscr: uw.dscr, icr: uw.icr,
      ltvPurchase: uw.ltvPurchasePrice, ltvLending,
      monthlyCashflow: (uw.cfads - uw.debtService) / 12,
      pricePerSqm: o.area > 0 ? o.price / o.area : null,
      maintenancePerSqm,
    },
    household: { income: p.netIncome, recognizedRent, living, costs, rate: monthlyRate, surplus },
    stress,
    score,
    vetos,
    vetoLevel: highestVeto(vetos),
    documents: DOCUMENTS.map((name) => ({ name, status: 'Ungeprüft' as const })),
  };
}

function stressCases(o: PropertyObject): StressCase[] {
  const i = o.interestPct / 100;
  const v = o.vacancyPct / 100;
  return [
    { name: 'base', interestRate: i, vacancyRate: v, maintenanceMultiplier: 1 },
    { name: 'base', interestRate: i + 0.01, vacancyRate: Math.min(1, v + 0.03), maintenanceMultiplier: 1.1 },
    { name: 'worst', interestRate: i + 0.025, vacancyRate: Math.min(1, v + 0.08), maintenanceMultiplier: 1.25 },
    { name: 'worst', interestRate: i + 0.04, vacancyRate: Math.min(1, v + 0.15), maintenanceMultiplier: 1.5 },
  ];
}

type EvalInput = {
  o: PropertyObject; gap: number; surplus: number; dscr: number; ltvLending: number | null;
  equity: number; purchaseCosts: number; maintenancePerSqm: number | null; monthlyCashflow: number;
};

// Entscheidungsunterstützung. Keine Aussage über den Eintritt von Rechtsfolgen oder Bankentscheidungen.
function evaluate(x: EvalInput): VetoFinding[] {
  const f: VetoFinding[] = [];
  const eur = (v: number) => Math.round(v);
  if (x.gap > 0.5) {
    f.push({
      id: 'FINANCING_GAP', level: 'HARD_VETO', title: 'Finanzierung rechnerisch nicht gedeckt',
      reason: 'Kaufpreis und Kaufnebenkosten übersteigen Eigenkapital und Darlehen.',
      evidenceIds: ['eingabe:kaufpreis', 'eingabe:nebenkosten', 'eingabe:darlehen', 'eingabe:eigenkapital'],
      financialImpactEur: eur(x.gap),
      recommendation: 'Finanzierungslücke vor dem Bankgespräch schließen oder Annahmen korrigieren.',
    });
  }
  if (x.surplus < 0) {
    f.push({
      id: 'HOUSEHOLD_DEFICIT', level: 'HARD_VETO', title: 'Haushaltsrechnung negativ',
      reason: 'Nach Lebenshaltungspauschale, Objektkosten und Rate bleibt monatlich kein Überschuss.',
      evidenceIds: ['eingabe:nettoeinkommen', 'annahme:lebenshaltung'],
      financialImpactEur: eur(x.surplus * 12),
      recommendation: 'Rate, Kaufpreis oder Einkommen prüfen; Banken setzen eigene Pauschalen an.',
    });
  }
  if (x.dscr < 1 && x.o.loan > 0) {
    f.push({
      id: 'DSCR_BELOW_1', level: 'CONDITIONAL_VETO', title: 'Kapitaldienst nicht durch das Objekt gedeckt',
      reason: 'Der DSCR liegt unter 1,00; die Differenz muss aus dem Einkommen getragen werden.',
      evidenceIds: ['eingabe:miete', 'eingabe:zins', 'eingabe:tilgung'],
      financialImpactEur: eur(x.monthlyCashflow * 12),
      recommendation: 'Tragfähigkeit in der Haushaltsrechnung belegen oder Finanzierungsstruktur anpassen.',
    });
  }
  if (x.ltvLending !== null && x.ltvLending > 1) {
    f.push({
      id: 'BLANK_PORTION', level: 'CONDITIONAL_VETO', title: 'Darlehen über dem Beleihungswert',
      reason: 'Ein Blankoanteil führt bei Banken üblicherweise zu Zinsaufschlägen oder Zusatzsicherheiten.',
      evidenceIds: ['eingabe:darlehen', 'eingabe:beleihungswert'],
      recommendation: 'Mehr Eigenkapital einplanen oder Beleihungswert mit der Bank klären.',
    });
  }
  if (x.equity < x.purchaseCosts) {
    f.push({
      id: 'EQUITY_BELOW_COSTS', level: 'CONDITIONAL_VETO', title: 'Eigenkapital deckt Nebenkosten nicht',
      reason: 'Die Kaufnebenkosten werden nicht vollständig aus Eigenkapital bezahlt.',
      evidenceIds: ['eingabe:eigenkapital', 'eingabe:nebenkosten'],
      financialImpactEur: eur(x.purchaseCosts - x.equity),
      recommendation: 'Vollfinanzierung nur mit sehr guter Bonität; Konditionen vorab vergleichen.',
    });
  }
  if (x.maintenancePerSqm !== null && x.maintenancePerSqm < 1) {
    f.push({
      id: 'LOW_MAINTENANCE', level: 'WARNING', title: 'Instandhaltung niedrig angesetzt',
      reason: 'Unter 1,00 € je m² und Monat; ältere Gebäude benötigen meist mehr.',
      evidenceIds: ['eingabe:instandhaltung', 'eingabe:wohnflaeche'],
      recommendation: 'Wirtschaftsplan und Rücklagenstand prüfen.',
    });
  }
  if (x.o.vacancyPct === 0) {
    f.push({
      id: 'NO_VACANCY', level: 'WARNING', title: 'Kein Mietausfallwagnis angesetzt',
      reason: 'Üblich sind rund 2 % der Jahreskaltmiete.',
      evidenceIds: ['eingabe:leerstand'],
      recommendation: 'Leerstand bzw. Mietausfall in der Rechnung berücksichtigen.',
    });
  }
  return f;
}
