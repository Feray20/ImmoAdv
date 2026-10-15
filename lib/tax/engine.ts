import { assertCriticalEvidence, type EvidencedValue } from '../domain/evidence';

export type TaxInput = {
  purchasePrice: EvidencedValue<number>;
  buildingShare: EvidencedValue<number>;
  acquisitionAncillaryCosts: EvidencedValue<number>;
  firstThreeYearNetMaintenance: EvidencedValue<number>;
};

export type TaxResult = {
  buildingAcquisitionBasis: number;
  landAcquisitionBasis: number;
  totalAcquisitionBasis: number;
  threshold15PercentEur: number;
  firstThreeYearMaintenanceEur: number;
  fifteenPercentExceeded: boolean;
};

export function calculateTaxModel(input: TaxInput): TaxResult {
  const purchase = assertCriticalEvidence(input.purchasePrice);
  const buildingShare = assertCriticalEvidence(input.buildingShare);
  const ancillary = assertCriticalEvidence(input.acquisitionAncillaryCosts);
  const maintenance = assertCriticalEvidence(input.firstThreeYearNetMaintenance);
  if (buildingShare < 0 || buildingShare > 1 || purchase <= 0 || ancillary < 0 || maintenance < 0) throw new Error('invalid_tax_input');
  const buildingAcquisitionBasis = purchase * buildingShare;
  const landAcquisitionBasis = purchase - buildingAcquisitionBasis;
  const totalAcquisitionBasis = purchase + ancillary;
  const threshold15PercentEur = buildingAcquisitionBasis * 0.15;
  return { buildingAcquisitionBasis, landAcquisitionBasis, totalAcquisitionBasis, threshold15PercentEur, firstThreeYearMaintenanceEur: maintenance, fifteenPercentExceeded: maintenance > threshold15PercentEur };
}
