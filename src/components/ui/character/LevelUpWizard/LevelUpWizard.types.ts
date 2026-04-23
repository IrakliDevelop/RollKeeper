import type { MulticlassInfo, Spell } from '@/types/character';
import type {
  ClassFeature,
  ProcessedClass,
  ProcessedSubclass,
} from '@/types/classes';
import type { ProcessedFeat } from '@/utils/featDataLoader';

export type WizardStepId =
  | 'edition'
  | 'class'
  | 'subclass'
  | 'features'
  | 'asi'
  | 'hp'
  | 'confirm';

export interface WizardStepConfig {
  id: WizardStepId;
  label: string;
}

export type ASIChoice =
  | { type: 'asi'; increases: { ability: string; amount: number }[] }
  | { type: 'feat'; feat: ProcessedFeat; grantedSpells: Spell[] };

export interface SubclassSpellGrant {
  spellName: string;
  grantType: 'prepared' | 'known' | 'expanded';
  isAlwaysPrepared: boolean;
}

export interface LevelUpWizardState {
  targetClassIndex: number;
  targetClass: MulticlassInfo;
  newClassLevel: number;
  newTotalLevel: number;
  matchedClass: ProcessedClass | null;
  features: ClassFeature[];
  subclassFeatures: ClassFeature[];
  subclassSpellGrants: SubclassSpellGrant[];
  requiresSubclass: boolean;
  requiresASI: boolean;
  isCustomClass: boolean;
  selectedEdition?: string;
  selectedSubclass?: ProcessedSubclass;
  asiChoice?: ASIChoice;
  featureChoices: Record<string, string>;
  hpRollResult?: number;
  steps: WizardStepConfig[];
  currentStepIndex: number;
}
