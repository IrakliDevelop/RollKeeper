import type {
  ClassFeature,
  ProcessedClass,
  ProcessedSubclass,
} from '@/types/classes';
import type { WizardStepConfig } from './LevelUpWizard.types';
import type { ASIChoice } from './LevelUpWizard.types';
import type { CharacterAbilities } from '@/types/character';
import { calculateModifier } from '@/utils/calculations';

/** A selection changes the edition's data, not the wizard's navigation shape. */
export function shouldShowEditionStep(
  classSource: string | undefined,
  optionCount: number
): boolean {
  return !classSource && optionCount > 1;
}

export function isValidASIChoice(
  choice: ASIChoice | undefined,
  abilities: CharacterAbilities
): boolean {
  if (!choice) return false;
  if (choice.type === 'feat') return !!choice.feat;
  const seen = new Set<string>();
  let points = 0;
  for (const increase of choice.increases) {
    if (seen.has(increase.ability)) return false;
    seen.add(increase.ability);
    const base = abilities[increase.ability as keyof CharacterAbilities];
    if (
      typeof base !== 'number' ||
      !Number.isInteger(increase.amount) ||
      increase.amount < 1 ||
      increase.amount > 2 ||
      base + increase.amount > 20
    )
      return false;
    points += increase.amount;
  }
  return points === 2;
}

export function calculateLevelUpHp({
  max,
  current,
  previousLevel,
  oldConstitution,
  newConstitution,
  roll,
}: {
  max: number;
  current: number;
  previousLevel: number;
  oldConstitution: number;
  newConstitution: number;
  roll: number;
}) {
  const oldModifier = calculateModifier(oldConstitution);
  const newModifier = calculateModifier(newConstitution);
  const newLevelGain = Math.max(1, roll + newModifier);
  const retroactiveGain = (newModifier - oldModifier) * previousLevel;
  const maxAfter = Math.max(1, max + newLevelGain + retroactiveGain);
  const gained = maxAfter - max;
  const currentAfter = Math.max(0, Math.min(maxAfter, current + gained));
  return { max: maxAfter, current: currentAfter, gained };
}

export function getSubclassSelectionLevel(
  processedClass: ProcessedClass
): number | null {
  const first = processedClass.features.find(f => f.isSubclassFeature);
  return first ? first.level : null;
}

export function getASILevels(processedClass: ProcessedClass): number[] {
  return processedClass.features
    .filter(
      f => f.name === 'Ability Score Improvement' || f.name === 'Epic Boon'
    )
    .map(f => f.level);
}

export function getFeaturesForLevel(
  processedClass: ProcessedClass,
  level: number
): ClassFeature[] {
  return processedClass.features.filter(
    f => f.level === level && !f.isSubclassFeature
  );
}

export function getSubclassFeaturesForLevel(
  subclass: ProcessedSubclass,
  level: number
): ClassFeature[] {
  return subclass.features.filter(f => f.level === level);
}

export function matchClassByName(
  classes: ProcessedClass[],
  className: string,
  classSource?: string
): ProcessedClass | null {
  const nameLower = className.toLowerCase();
  const matches = classes.filter(c => c.name.toLowerCase() === nameLower);
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];
  if (classSource) {
    const sourceMatch = matches.find(c => {
      const src = c.source.toUpperCase();
      return (
        src === classSource.toUpperCase() ||
        (classSource === 'XPHB' && src === 'PHB2024') ||
        (classSource === 'PHB' && src === 'PHB')
      );
    });
    if (sourceMatch) return sourceMatch;
  }
  return matches[0];
}

export function getEditionOptions(
  classes: ProcessedClass[],
  className: string
): ProcessedClass[] {
  const nameLower = className.toLowerCase();
  return classes.filter(c => c.name.toLowerCase() === nameLower);
}

export function getAvailableSubclasses(
  matchedClass: ProcessedClass
): ProcessedSubclass[] {
  return matchedClass.subclasses;
}

export function getMissedSubclassFeatureLevels(
  subclass: ProcessedSubclass,
  fromLevel: number,
  toLevel: number
): number[] {
  const levels = new Set<number>();
  for (const f of subclass.features) {
    if (f.level >= fromLevel && f.level <= toLevel) {
      levels.add(f.level);
    }
  }
  return Array.from(levels).sort((a, b) => a - b);
}

export function computeWizardSteps(params: {
  isCustomClass: boolean;
  needsEditionPicker: boolean;
  isMulticlassed: boolean;
  needsSubclassMigration: boolean;
  requiresSubclass: boolean;
  hasFeatures: boolean;
  requiresASI: boolean;
  needsHPInput: boolean;
}): WizardStepConfig[] {
  const steps: WizardStepConfig[] = [];

  if (params.isCustomClass) {
    if (params.needsHPInput) {
      steps.push({ id: 'hp', label: 'Hit points' });
    }
    steps.push({ id: 'confirm', label: 'Confirm' });
    return steps;
  }

  if (params.isMulticlassed) {
    steps.push({ id: 'class', label: 'Class' });
  }
  if (params.needsEditionPicker) {
    steps.push({ id: 'edition', label: 'Edition' });
  }
  if (params.needsSubclassMigration) {
    steps.push({ id: 'subclass-migration', label: 'Subclass' });
  }
  if (params.requiresSubclass) {
    steps.push({ id: 'subclass', label: 'Subclass' });
  }
  if (params.hasFeatures) {
    steps.push({ id: 'features', label: 'Features' });
  }
  if (params.requiresASI) {
    steps.push({ id: 'asi', label: 'Ability scores' });
  }
  if (params.needsHPInput) {
    steps.push({ id: 'hp', label: 'Hit points' });
  }
  steps.push({ id: 'confirm', label: 'Confirm' });

  return steps;
}

export function getSpellsKnownDelta(
  processedClass: ProcessedClass,
  oldLevel: number,
  newLevel: number
): number {
  const prog = processedClass.spellcasting.spellsKnownProgression;
  if (!prog) return 0;
  const oldCount = prog[oldLevel - 1] ?? 0;
  const newCount = prog[newLevel - 1] ?? 0;
  return newCount - oldCount;
}

export function getCantripsKnownDelta(
  processedClass: ProcessedClass,
  oldLevel: number,
  newLevel: number
): number {
  const prog = processedClass.spellcasting.cantripProgression;
  if (!prog) return 0;
  const oldCount = prog[oldLevel - 1] ?? 0;
  const newCount = prog[newLevel - 1] ?? 0;
  return newCount - oldCount;
}
