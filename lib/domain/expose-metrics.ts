// Typisiertes Ergebnis des Exposé-Imports (Metrics Engine). Berechnung: exposeMetrics() in public/src/calc.mjs –
// derselbe Rechenkern für Website, Privatbereich, Unternehmensportal und PDF-Export.
export type EnergyClass = 'A+' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';

export interface ExposeMetricsResult {
  property: {
    title: string;
    address: { street?: string; zip: string; city: string; state: string };
    purchasePrice: number;
    livingAreaSqm: number;
    monthlyColdRent: number;
    monthlyHausgeld: number;
    monthlyMaintenanceReserve: number;
    nonAllocatableCosts: number;
    constructionYear: number;
    energyClass: EnergyClass;
    energyValueKwh: number;
  };
  metrics: {
    pricePerSqm: number; // Kaufpreis / Wohnfläche
    rentPerSqm: number; // Kaltmiete / Wohnfläche
    purchaseMultiplier: number; // Kaufpreisfaktor (Kaufpreis / Jahreskaltmiete)
    grossRentalYieldPercent: number; // Bruttomietrendite in %
    netRentalYieldPercent: number; // Nettomietrendite in % (auf Gesamtinvestition)
    incidentalCosts: {
      propertyTransferTax: number; // Grunderwerbsteuer nach Bundesland
      notaryAndRegistry: number; // Notar 1,5 % + Grundbuch 0,5 % (Richtwerte)
      brokerCommission: number; // z. B. 3,57 % Käuferanteil
      totalIncidentalCosts: number;
      totalInvestment: number; // Kaufpreis + Nebenkosten
    };
    financingQuickCheck: {
      calculatedMonthlyRate: number; // Annuität (Zins + Tilgung)
      monthlyPreTaxCashflow: number; // Kaltmiete − Rate − nicht umlegbare Kosten − Rücklage
      dscrValue: number; // Schuldendienstdeckung (Soll ≥ 1,20)
      ltvPercent: number; // Beleihungsauslauf (Darlehen / Kaufpreis)
      stressTestRateDelta: number; // Raten-Mehrbelastung bei +2 Prozentpunkten Zins
    };
    sanitationRisk: {
      riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
      recommendedSanitationBuffer: number; // Pauschale bei Energieklasse E–H (ImmoAdv-Annahme je m²)
    };
  };
}
