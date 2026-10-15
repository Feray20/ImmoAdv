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
  // Score-Treiber: Teilwert (0–100), Gewicht und erreichte Punkte je Komponente
  const components=[
    {key:'DSCR',label:'Kapitaldienstdeckung (DSCR)',value:dscr,weight:.25},
    {key:'ICR',label:'Zinsdeckung (ICR)',value:icr,weight:.10},
    {key:'LTV',label:'Beleihung (LTV)',value:ltv,weight:.15},
    {key:'DOC',label:'Unterlagen',value:docs,weight:.15},
    {key:'LEGAL',label:'Rechtliches Risiko',value:legal,weight:.15},
    {key:'TECH',label:'Technisches Risiko',value:technical,weight:.10},
    {key:'LIQ',label:'Liquiditätsreserve',value:reserve,weight:.10},
  ].map(c=>({...c,value:Math.round(c.value),points:Math.round(c.value*c.weight*10)/10,max:c.weight*100}));
  return {score,band:score>=85?'prime':score>=70?'bankable':score>=55?'conditional':'weak',dscrBand:classifyDscr(i.dscr),components};
}
