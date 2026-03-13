import type { EncounterEntity } from './encounter';

export type SummonType = 'familiar' | 'summon' | 'wild-shape';

export interface Summon {
  id: string;
  type: SummonType;
  entity: EncounterEntity;
  sourceSpellName: string;
  sourceSpellId?: string;
  castAtLevel?: number;
  requiresConcentration: boolean;
  duration?: string;
  createdAt: string;
  customName?: string;
}
