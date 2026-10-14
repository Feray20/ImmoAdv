import { classifyDscr } from './engine';

export type ScoreInput = {
  dscr: number; icr: number; ltv: number; documentCompleteness: number;
  legalRisk: number; technicalRisk: number; cashReserveMonths: number;
};

export function bankReadyScore(i: ScoreInput) {
  const dscr = Math.max(0, Math.min(100, (i.dscr / 1.50) * 100));
  const icr = Math.max(0, Math.min(100, (i.icr / 3.00) * 100));
  const ltv = Math.max(0, Math.min(100, (1 - Math.max(0,i.ltv-0.60)/0.40) * 100));
  const docs = Math.max(0, Math.min(100,i.documentCompleteness));
  const legal = Math.max(0, Math.min(100,100-i.legalRisk));
  const technical = Math.max(0, Math.min(100,100-i.technicalRisk));
  const reserve = Math.max(0, Math.min(100,(i.cashReserveMonths/12)*100));
  const score=Math.round(dscr*.25+icr*.10+ltv*.15+docs*.15+legal*.15+technical*.10+reserve*.10);
  return {score,band:score>=85?'prime':score>=70?'bankable':score>=55?'conditional':'weak',dscrBand:classifyDscr(i.dscr)};
}
