export type WegAssessment={hoaReserveTotal?:number;ownerReserveShare?:number;annualHouseMoney?:number;specialAssessments:Array<{amount:number;dueDate?:string;resolutionDate?:string;purpose:string}>;recentMinutesIds:string[];riskNotes:string[]};
export function specialAssessmentExposure(w:WegAssessment){return w.specialAssessments.reduce((s,x)=>s+Math.max(0,x.amount),0);}
