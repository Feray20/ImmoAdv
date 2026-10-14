export type ScoreInput={dscr:number;icr:number;ltv:number;documentCompleteness:number;legalRisk:number;technicalRisk:number;liquidityReserve:number};
const clamp=(x:number)=>Math.max(0,Math.min(100,x));
export function bankReadyScore(i:ScoreInput){const dscr=clamp((i.dscr-1)*50+50);const icr=clamp(i.icr*25);const ltv=clamp(100-(i.ltv*100));return Math.round(clamp(dscr*.25+icr*.10+ltv*.15+i.documentCompleteness*.15+i.legalRisk*.15+i.technicalRisk*.10+i.liquidityReserve*.10));}
