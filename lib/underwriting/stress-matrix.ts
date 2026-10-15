import type { UnderwritingInput, StressCase } from './engine';
import { underwrite } from './engine';

export type StressProfile = 'BASE' | 'MODERATE' | 'SEVERE' | 'EXTREME';

const profiles: Record<StressProfile, StressCase> = {
  BASE: { name: 'base', interestRate: 0.035, vacancyRate: 0.02, maintenanceMultiplier: 1 },
  MODERATE: { name: 'base', interestRate: 0.05, vacancyRate: 0.05, maintenanceMultiplier: 1.15 },
  SEVERE: { name: 'worst', interestRate: 0.065, vacancyRate: 0.1, maintenanceMultiplier: 1.5 },
  EXTREME: { name: 'worst', interestRate: 0.08, vacancyRate: 0.15, maintenanceMultiplier: 2 },
};

export function stressMatrix(input: UnderwritingInput) {
  return (Object.keys(profiles) as StressProfile[]).map((profile) => ({
    profile,
    result: underwrite(input, [profiles[profile]]).stress[0],
  }));
}
