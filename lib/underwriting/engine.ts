export type UnderwritingInput = {
  annualNetColdRent: number;
  nonRecoverableOperatingCosts: number;
  annualInterest: number;
  annualPrincipal: number;
  loanAmount: number;
  lendingValue: number;
  purchasePrice: number;
  vacancyRate?: number;
  annualMaintenance?: number;
  annualTax?: number;
  annualOtherCashCosts?: number;
  annualTaxEffect?: number;
};

export type StressCase = { name: 'base'|'worst'|'best'; interestRate: number; vacancyRate: number; maintenanceMultiplier: number };
export type UnderwritingResult = {
  grossRent: number; vacancyLoss: number; noi: number; cfads: number;
  debtService: number; dscr: number; icr: number; ltvPurchasePrice: number;
  ltvLendingValue: number; annualAfterTaxCashflow: number; monthlyAfterTaxCashflow: number;
  stress: Array<{case: StressCase; noi: number; debtService: number; dscr: number; annualCashflow: number}>;
};

const n=(v:number|undefined)=>Number.isFinite(v) ? v! : 0;
const ratio=(a:number,b:number)=>b===0 ? null : a/b;
const annualDebt=(loan:number,rate:number,principalRate:number)=>loan*(rate+principalRate);

export function underwrite(i:UnderwritingInput, cases?:StressCase[]):UnderwritingResult {
  if(i.annualNetColdRent<0||i.nonRecoverableOperatingCosts<0||i.loanAmount<0||i.purchasePrice<=0||i.lendingValue<=0) throw new Error('invalid_underwriting_input');
  const vacancy=n(i.vacancyRate);
  const grossRent=i.annualNetColdRent;
  const vacancyLoss=grossRent*vacancy;
  const noi=grossRent-vacancyLoss-i.nonRecoverableOperatingCosts-n(i.annualMaintenance);
  const debtService=i.annualInterest+i.annualPrincipal;
  const cfads=noi-n(i.annualOtherCashCosts)-n(i.annualTax);
  const afterTax=cfads-debtService+n(i.annualTaxEffect);
  const baseCases:StressCase[]=cases??[
    {name:'base',interestRate:0.035,vacancyRate:vacancy,maintenanceMultiplier:1},
    {name:'worst',interestRate:0.075,vacancyRate:Math.max(vacancy,0.08),maintenanceMultiplier:1.25},
    {name:'best',interestRate:0.025,vacancyRate:Math.min(vacancy,0.02),maintenanceMultiplier:0.9}
  ];
  const stress=baseCases.map(c=>{
    const sNoi=grossRent*(1-c.vacancyRate)-i.nonRecoverableOperatingCosts-n(i.annualMaintenance)*c.maintenanceMultiplier;
    const sDebt=annualDebt(i.loanAmount,c.interestRate,i.annualPrincipal/i.loanAmount);
    return {case:c,noi:sNoi,debtService:sDebt,dscr:ratio(sNoi,sDebt)??0,annualCashflow:sNoi-sDebt-n(i.annualOtherCashCosts)-n(i.annualTax)+n(i.annualTaxEffect)};
  });
  return {grossRent,vacancyLoss,noi,cfads,debtService,dscr:ratio(noi,debtService)??0,icr:ratio(noi,i.annualInterest)??0,ltvPurchasePrice:i.loanAmount/i.purchasePrice,ltvLendingValue:i.loanAmount/i.lendingValue,annualAfterTaxCashflow:afterTax,monthlyAfterTaxCashflow:afterTax/12,stress};
}

export function classifyDscr(dscr:number):'red'|'amber'|'green' { return dscr<1.10?'red':dscr<=1.25?'amber':'green'; }
export function classifyLtv(ltv:number):'prime'|'standard'|'high' { return ltv<=0.60?'prime':ltv<=0.80?'standard':'high'; }
