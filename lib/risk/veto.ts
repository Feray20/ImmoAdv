export type VetoLevel = 'HARD_VETO' | 'CONDITIONAL_VETO' | 'WARNING';
export type RiskSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type VetoFinding = {
  level: VetoLevel;
  severity: RiskSeverity;
  code: string;
  finding: string;
  relevance: string;
  evidenceDocumentIds: string[];
  financialImpactEur?: number;
  clarificationRequired: string;
};

const HARD_CODES = new Set(['UNRESOLVED_TITLE_BURDEN','MISSING_CORE_PURCHASE_DOCS','MATERIAL_PRICE_DEVIATION','UNFUNDED_FINANCING','LIQUIDITY_BREAK','OWNERSHIP_UNCLEAR']);

export function evaluateVetoes(findings: VetoFinding[]) {
  const normalized = findings.map((f) => ({ ...f, level: HARD_CODES.has(f.code) ? 'HARD_VETO' as const : f.level }));
  return {
    findings: normalized,
    hardVeto: normalized.some((f) => f.level === 'HARD_VETO'),
    conditionalVeto: normalized.some((f) => f.level === 'CONDITIONAL_VETO'),
    warnings: normalized.filter((f) => f.level === 'WARNING').length,
  };
}

export function buildFinding(input: Omit<VetoFinding,'evidenceDocumentIds'> & { evidenceDocumentIds?: string[] }): VetoFinding {
  return { ...input, evidenceDocumentIds: input.evidenceDocumentIds ?? [] };
}
