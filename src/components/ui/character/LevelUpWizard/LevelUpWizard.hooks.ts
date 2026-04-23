'use client';

import { useState, useCallback, useMemo } from 'react';
import { useCharacterStore } from '@/store/characterStore';
import { useClassData } from '@/hooks/useClassData';
import { useSpellsData } from '@/hooks/useSpellsData';
import type {
  CharacterState,
  MulticlassInfo,
  Spell,
  ExtendedFeature,
} from '@/types/character';
import type {
  ProcessedClass,
  ProcessedSubclass,
  ClassFeature,
} from '@/types/classes';
import type { ProcessedSpell } from '@/types/spells';
import {
  calculateCharacterSpellSlots,
  calculateCharacterPactMagic,
  calculateModifier,
} from '@/utils/calculations';
import { calculateHitDicePools, migrateToMulticlass } from '@/utils/multiclass';
import {
  matchClassByName,
  getEditionOptions,
  getSubclassSelectionLevel,
  getASILevels,
  getFeaturesForLevel,
  getSubclassFeaturesForLevel,
  getAvailableSubclasses,
  computeWizardSteps,
  getSpellsKnownDelta,
  getCantripsKnownDelta,
} from './LevelUpWizard.utils';
import type {
  LevelUpWizardState,
  ASIChoice,
  SubclassSpellGrant,
  WizardStepConfig,
} from './LevelUpWizard.types';

function resolveSubclassSpellGrants(
  subclass: ProcessedSubclass,
  level: number
): SubclassSpellGrant[] {
  if (!subclass.spellList) return [];
  const grants: SubclassSpellGrant[] = [];
  for (const entry of subclass.spellList) {
    if (entry.level !== level) continue;
    for (const spellName of entry.spells) {
      grants.push({
        spellName,
        grantType: 'prepared',
        isAlwaysPrepared: true,
      });
    }
  }
  return grants;
}

function buildSubclassSpells(
  grants: SubclassSpellGrant[],
  allSpells: ProcessedSpell[],
  subclassName: string,
  existingSpells: Spell[]
): Spell[] {
  const result: Spell[] = [];
  const existingNames = new Set(existingSpells.map(s => s.name.toLowerCase()));

  for (const grant of grants) {
    if (grant.grantType === 'expanded') continue;
    if (existingNames.has(grant.spellName.toLowerCase())) continue;

    const found = allSpells.find(
      s => s.name.toLowerCase() === grant.spellName.toLowerCase()
    );
    if (!found) continue;

    const now = new Date().toISOString();
    const spell: Spell = {
      id: `${found.id}-${subclassName.toLowerCase().replace(/\s+/g, '-')}`,
      name: found.name,
      level: found.level,
      school: found.school,
      castingTime: found.castingTime,
      range: found.range,
      duration: found.duration,
      components: {
        verbal: found.components.verbal,
        somatic: found.components.somatic,
        material: found.components.material,
        materialDescription: found.components.materialComponent,
      },
      description: found.description,
      isPrepared: grant.isAlwaysPrepared,
      isAlwaysPrepared: grant.isAlwaysPrepared,
      castingSource: subclassName,
      createdAt: now,
      updatedAt: now,
    };
    result.push(spell);
  }
  return result;
}

function buildFeatureEntries(
  features: ClassFeature[],
  sourceType: 'class' | 'feat',
  sourceDetail: string,
  startOrder: number
): Omit<ExtendedFeature, 'id' | 'createdAt' | 'updatedAt'>[] {
  return features
    .filter(
      f => f.name !== 'Ability Score Improvement' && f.name !== 'Epic Boon'
    )
    .map((f, i) => ({
      name: f.name,
      description: f.entries?.map(e => `<p>${e}</p>`).join('') || '',
      maxUses: 0,
      usedUses: 0,
      restType: 'long' as const,
      sourceType,
      sourceDetail,
      displayOrder: startOrder + i,
      isPassive: true,
      scaleWithProficiency: false,
      proficiencyMultiplier: 1,
    }));
}

export function useLevelUpWizard(character: CharacterState) {
  const { classData, loading: classLoading } = useClassData();
  const { spells: allSpells, loading: spellsLoading } = useSpellsData();
  const updateCharacter = useCharacterStore(s => s.updateCharacter);
  const addExtendedFeature = useCharacterStore(s => s.addExtendedFeature);

  const migrated = useMemo(() => migrateToMulticlass(character), [character]);
  const classes = migrated.classes || [];
  const totalLevel = migrated.totalLevel || migrated.level || 1;

  const [selectedEdition, setSelectedEdition] = useState<string | undefined>();
  const [targetClassIndex, setTargetClassIndex] = useState<number>(
    classes.length === 1 ? 0 : -1
  );
  const [selectedSubclass, setSelectedSubclass] = useState<
    ProcessedSubclass | undefined
  >();
  const [asiChoice, setASIChoice] = useState<ASIChoice | undefined>();
  const [hpRollResult, setHPRollResult] = useState<number | undefined>();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const targetClass: MulticlassInfo | null =
    targetClassIndex >= 0 ? classes[targetClassIndex] : null;

  const editionToUse = selectedEdition || targetClass?.classSource;

  const matchedClass: ProcessedClass | null = useMemo(() => {
    if (!targetClass || targetClass.isCustom) return null;
    return matchClassByName(classData, targetClass.className, editionToUse);
  }, [classData, targetClass, editionToUse]);

  const editionOptions = useMemo(() => {
    if (!targetClass) return [];
    return getEditionOptions(classData, targetClass.className);
  }, [classData, targetClass]);

  const needsEditionPicker =
    !!targetClass &&
    !targetClass.isCustom &&
    !targetClass.classSource &&
    !selectedEdition &&
    editionOptions.length > 1;

  const newClassLevel = targetClass ? targetClass.level + 1 : 1;
  const newTotalLevel = totalLevel + 1;

  const subclassSelectionLevel = matchedClass
    ? getSubclassSelectionLevel(matchedClass)
    : null;
  const requiresSubclass =
    !!matchedClass &&
    subclassSelectionLevel === newClassLevel &&
    !targetClass?.subclass &&
    !selectedSubclass;

  const asiLevels = matchedClass ? getASILevels(matchedClass) : [];
  const requiresASI = asiLevels.includes(newClassLevel);

  const classFeatures = matchedClass
    ? getFeaturesForLevel(matchedClass, newClassLevel)
    : [];

  const activeSubclass: ProcessedSubclass | undefined = useMemo(() => {
    if (selectedSubclass) return selectedSubclass;
    if (!matchedClass || !targetClass?.subclass) return undefined;
    return matchedClass.subclasses.find(
      sc =>
        sc.shortName === targetClass.subclass ||
        sc.name === targetClass.subclass
    );
  }, [matchedClass, targetClass, selectedSubclass]);

  const subclassFeatures = activeSubclass
    ? getSubclassFeaturesForLevel(activeSubclass, newClassLevel)
    : [];

  const allFeatures = [...classFeatures, ...subclassFeatures];
  const hasFeatures =
    allFeatures.filter(
      f => f.name !== 'Ability Score Improvement' && f.name !== 'Epic Boon'
    ).length > 0;

  const subclassSpellGrants: SubclassSpellGrant[] = useMemo(() => {
    if (!activeSubclass) return [];
    return resolveSubclassSpellGrants(activeSubclass, newClassLevel);
  }, [activeSubclass, newClassLevel]);

  const isCustomClass =
    !!targetClass?.isCustom || (!matchedClass && !!targetClass);
  const needsHPInput = character.hitPoints.calculationMode === 'manual';

  const steps: WizardStepConfig[] = useMemo(() => {
    return computeWizardSteps({
      isCustomClass,
      needsEditionPicker,
      isMulticlassed: classes.length > 1,
      requiresSubclass:
        requiresSubclass ||
        (!!matchedClass &&
          subclassSelectionLevel === newClassLevel &&
          !targetClass?.subclass),
      hasFeatures: hasFeatures || subclassSpellGrants.length > 0,
      requiresASI,
      needsHPInput,
    });
  }, [
    isCustomClass,
    needsEditionPicker,
    classes.length,
    requiresSubclass,
    matchedClass,
    subclassSelectionLevel,
    newClassLevel,
    targetClass,
    hasFeatures,
    subclassSpellGrants.length,
    requiresASI,
    needsHPInput,
  ]);

  const currentStep = steps[currentStepIndex] || steps[0];

  const canGoNext = useCallback((): boolean => {
    if (!currentStep) return false;
    switch (currentStep.id) {
      case 'edition':
        return !!selectedEdition;
      case 'class':
        return targetClassIndex >= 0;
      case 'subclass':
        return !!selectedSubclass;
      case 'features':
        return true;
      case 'asi':
        return !!asiChoice;
      case 'hp':
        return hpRollResult !== undefined && hpRollResult > 0;
      case 'confirm':
        return true;
      default:
        return true;
    }
  }, [
    currentStep,
    selectedEdition,
    targetClassIndex,
    selectedSubclass,
    asiChoice,
    hpRollResult,
  ]);

  const goNext = useCallback(() => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    }
  }, [currentStepIndex, steps.length]);

  const goBack = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  }, [currentStepIndex]);

  const spellsKnownDelta = matchedClass
    ? getSpellsKnownDelta(matchedClass, newClassLevel - 1, newClassLevel)
    : 0;

  const cantripsKnownDelta = matchedClass
    ? getCantripsKnownDelta(matchedClass, newClassLevel - 1, newClassLevel)
    : 0;

  const applyLevelUp = useCallback(() => {
    if (!targetClass) return;
    const classIdx = targetClassIndex;

    const updatedClasses = [...classes];
    updatedClasses[classIdx] = {
      ...updatedClasses[classIdx],
      level: newClassLevel,
      ...(selectedEdition ? { classSource: selectedEdition } : {}),
      ...(selectedSubclass ? { subclass: selectedSubclass.shortName } : {}),
    };

    const updatedCharacter: CharacterState = {
      ...migrated,
      classes: updatedClasses,
      totalLevel: newTotalLevel,
      level: newTotalLevel,
    };

    const hitDicePools = calculateHitDicePools(
      updatedClasses,
      migrated.hitDicePools
    );
    const spellSlots = calculateCharacterSpellSlots(updatedCharacter);
    const pactMagic = calculateCharacterPactMagic(updatedCharacter);

    let abilities = { ...migrated.abilities };
    if (asiChoice?.type === 'asi') {
      for (const inc of asiChoice.increases) {
        const key = inc.ability as keyof typeof abilities;
        abilities = {
          ...abilities,
          [key]: Math.min(20, abilities[key] + inc.amount),
        };
      }
    }

    let newSpells = [...(migrated.spells || [])];
    if (subclassSpellGrants.length > 0 && activeSubclass) {
      const subSpells = buildSubclassSpells(
        subclassSpellGrants,
        allSpells,
        activeSubclass.shortName,
        migrated.spells || []
      );
      newSpells = [...newSpells, ...subSpells];
    }
    if (asiChoice?.type === 'feat' && asiChoice.grantedSpells.length > 0) {
      newSpells = [...newSpells, ...asiChoice.grantedSpells];
    }

    const hpUpdates: Partial<CharacterState['hitPoints']> = {};
    if (needsHPInput && hpRollResult !== undefined) {
      const conMod = calculateModifier(abilities.constitution);
      hpUpdates.max = (migrated.hitPoints.max || 0) + hpRollResult + conMod;
      hpUpdates.current =
        (migrated.hitPoints.current || 0) + hpRollResult + conMod;
    }

    updateCharacter({
      classes: updatedClasses,
      totalLevel: newTotalLevel,
      level: newTotalLevel,
      hitDicePools,
      spellSlots,
      pactMagic,
      abilities,
      spells: newSpells,
      hitPoints: { ...migrated.hitPoints, ...hpUpdates },
    });

    const featureSourceDetail = `${targetClass.className} Level ${newClassLevel}`;
    const classFeatureEntries = buildFeatureEntries(
      classFeatures,
      'class',
      featureSourceDetail,
      (migrated.extendedFeatures || []).length
    );
    const subFeatureEntries = buildFeatureEntries(
      subclassFeatures,
      'class',
      `${activeSubclass?.shortName || targetClass.subclass || ''} (${targetClass.className} ${newClassLevel})`,
      (migrated.extendedFeatures || []).length + classFeatureEntries.length
    );
    if (asiChoice?.type === 'feat') {
      const featEntry = buildFeatureEntries(
        [
          {
            name: asiChoice.feat.name,
            level: newClassLevel,
            source: asiChoice.feat.source,
            entries: [asiChoice.feat.description],
            isSubclassFeature: false,
            original: '',
          },
        ],
        'feat',
        asiChoice.feat.name,
        (migrated.extendedFeatures || []).length +
          classFeatureEntries.length +
          subFeatureEntries.length
      );
      featEntry.forEach(f => addExtendedFeature(f));
    }
    classFeatureEntries.forEach(f => addExtendedFeature(f));
    subFeatureEntries.forEach(f => addExtendedFeature(f));
  }, [
    targetClass,
    targetClassIndex,
    classes,
    newClassLevel,
    newTotalLevel,
    selectedEdition,
    selectedSubclass,
    migrated,
    asiChoice,
    subclassSpellGrants,
    activeSubclass,
    allSpells,
    classFeatures,
    subclassFeatures,
    needsHPInput,
    hpRollResult,
    updateCharacter,
    addExtendedFeature,
  ]);

  return {
    loading: classLoading || spellsLoading,
    state: {
      targetClassIndex,
      targetClass: targetClass as MulticlassInfo,
      newClassLevel,
      newTotalLevel,
      matchedClass,
      features: classFeatures,
      subclassFeatures,
      subclassSpellGrants,
      requiresSubclass,
      requiresASI,
      isCustomClass,
      selectedEdition,
      selectedSubclass,
      asiChoice,
      hpRollResult,
      steps,
      currentStepIndex,
    } as LevelUpWizardState,
    editionOptions,
    availableSubclasses: matchedClass
      ? getAvailableSubclasses(matchedClass)
      : [],
    classes,
    totalLevel,
    character: migrated,
    allSpells,
    spellsKnownDelta,
    cantripsKnownDelta,
    currentStep,
    canGoNext: canGoNext(),
    goNext,
    goBack,
    setSelectedEdition,
    setTargetClassIndex,
    setSelectedSubclass,
    setASIChoice,
    setHPRollResult,
    applyLevelUp,
  };
}
