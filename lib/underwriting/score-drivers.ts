import type { ScoreInput } from './score';

export type ScoreDriver = { key: string; label: string; impact: number; explanation: string };

export function scoreDrivers(i: ScoreInput): ScoreDriver[] {
  return [
    { key: 'dscr', label: 'DSCR', impact: i.dscr >= 1.25 ? 25 : i.dscr >= 1.1 ? 15 : 0, explanation: 'ImmoAdv-Risikopolitik: Schuldendienstdeckung.' },
    { key: 'icr', label: 'ICR', impact: i.icr >= 3 ? 10 : i.icr >= 2 ? 6 : 2, explanation: 'ImmoAdv-Risikopolitik: Zinsdeckung.' },
    { key: 'ltv', label: 'LTV', impact: i.ltv <= .6 ? 15 : i.ltv <= .8 ? 10 : 4, explanation: 'ImmoAdv-Risikopolitik: Beleihungs-/Kaufpreisrelation.' },
    { key: 'documents', label: 'Dokumentenvollständigkeit', impact: i.documentCompleteness * .15, explanation: 'Gewichteter Dokumentationsfaktor.' },
    { key: 'legal', label: 'Rechtliches Risiko', impact: (100 - i.legalRisk) * .15, explanation: 'Risikoadjustierter Beitrag; keine Rechtsberatung.' },
    { key: 'technical', label: 'Technisches Risiko', impact: (100 - i.technicalRisk) * .1, explanation: 'Risikoadjustierter technischer Beitrag.' },
    { key: 'reserve', label: 'Liquiditätsreserve', impact: Math.min(100, Math.max(0, i.cashReserveMonths / 12 * 100)) * .1, explanation: 'Liquiditätsreserve in Monats-Cashburn.' },
  ];
}
