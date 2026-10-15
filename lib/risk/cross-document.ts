import type { RiskSeverity, VetoLevel } from './veto';

export type CrossDocumentConflict = {
  id: string;
  severity: RiskSeverity;
  sourceDocumentIds: string[];
  metric: string;
  financialImpactEur?: number;
  recommendation: string;
  vetoLevel: VetoLevel;
};

export type ComparedValue = { documentId: string; value: number | string | null };

export function compareNumeric(metric: string, values: ComparedValue[], tolerance: number, recommendation: string): CrossDocumentConflict | null {
  const numeric = values.filter((v): v is ComparedValue & { value: number } => typeof v.value === 'number');
  if (numeric.length < 2) return null;
  const min = Math.min(...numeric.map((v) => v.value));
  const max = Math.max(...numeric.map((v) => v.value));
  if (max === 0 || Math.abs(max - min) / Math.abs(max) <= tolerance) return null;
  return {
    id: `conflict:${metric}`,
    severity: 'HIGH',
    sourceDocumentIds: numeric.map((v) => v.documentId),
    metric,
    recommendation,
    vetoLevel: 'CONDITIONAL_VETO',
  };
}
