export type InvestorProfile = 'SUBSTANCE_CONSERVATIVE' | 'CASHFLOW_STRATEGIST' | 'LEVERAGE_STRATEGIST' | 'TAX_ORIENTED' | 'BALANCED';

export type InvestorAnswers = { capitalPreservation: number; cashflowPriority: number; leverageTolerance: number; taxPriority: number };

export function inferInvestorProfile(a: InvestorAnswers): InvestorProfile {
  const scores: Record<InvestorProfile, number> = {
    SUBSTANCE_CONSERVATIVE: a.capitalPreservation,
    CASHFLOW_STRATEGIST: a.cashflowPriority,
    LEVERAGE_STRATEGIST: a.leverageTolerance,
    TAX_ORIENTED: a.taxPriority,
    BALANCED: 50,
  };
  const ranked = (Object.entries(scores) as Array<[InvestorProfile, number]>).sort((x, y) => y[1] - x[1]);
  return ranked[0][0];
}
