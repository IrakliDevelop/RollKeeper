'use client';

import { FileText, ArrowLeft, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { usePlayerStore } from '@/store/playerStore';
import { useCharacterStore } from '@/store/characterStore';
import { useAutoSave } from '@/hooks/useAutoSave';
import { Button } from '@/components/ui/forms';
import { Badge } from '@/components/ui/layout';

import SpellSlotTracker from '@/components/ui/character/SpellSlotTracker';
import TraitTracker from '@/components/ui/character/TraitTracker';
import HeroicInspirationTracker from '@/components/ui/character/HeroicInspirationTracker';
import XPTracker from '@/components/ui/character/XPTracker';

import HitPointManager from '@/components/ui/character/HitPointManager';
import ExperimentalFeaturesSection from '@/components/ui/layout/ExperimentalFeaturesSection';
import ErrorBoundary from '@/components/ui/feedback/ErrorBoundary';
import { WeaponProficiencies } from '@/components/WeaponProficiencies';
import { ToastContainer, useToast } from '@/components/ui/feedback/Toast';
import { ConfirmationModal } from '@/components/ui/feedback/ConfirmationModal';
import { YouDiedOverlay } from '@/components/ui/feedback/YouDiedOverlay';
import { LevelUpOverlay } from '@/components/ui/feedback/LevelUpOverlay';

import CharacterSheetHeader from '@/components/ui/character/CharacterSheetHeader';
import CharacterBasicInfo from '@/components/ui/character/CharacterBasicInfo';
import HitDiceTracker from '@/components/ui/character/HitDiceTracker';
import RestManager from '@/components/ui/character/RestManager';
import DaysSpentTracker from '@/components/ui/character/DaysSpentTracker';
import AbilityScores from '@/components/ui/character/AbilityScores';
import ArmorClassManager from '@/components/ui/character/ArmorClassManager';
import SavingThrows from '@/components/ui/character/SavingThrows';
import Skills from '@/components/ui/character/Skills';
import CombatStats from '@/components/ui/character/CombatStats';
import ActionsSection from '@/components/ui/character/ActionsSection';
import CollapsibleSection from '@/components/ui/layout/CollapsibleSection';
import QuickStats from '@/components/ui/character/QuickStats';
import LanguagesAndProficiencies from '@/components/ui/character/LanguagesAndProficiencies';
import { ExtendedFeaturesSection } from '@/components/ui/character/ExtendedFeatures';
import { useHydration } from '@/hooks/useHydration';
import { ABILITY_NAMES, SKILL_NAMES } from '@/utils/constants';
import {
  calculateModifier,
  getProficiencyBonus,
  hasSpellSlots,
  calculateSkillModifier,
} from '@/utils/calculations';
import { exportCharacterToFile } from '@/utils/fileOperations';
import {
  AbilityName,
  SkillName,
  CharacterState,
  ExtendedFeature,
} from '@/types/character';
import { useCallback, useEffect, useState, useRef } from 'react';
import GroupedTabs, {
  GroupedTabsRef,
} from '@/components/ui/layout/GroupedTabs';
import { NavigationContext } from '@/contexts/NavigationContext';
import { createCharacterSheetTabsConfig } from './characterSheetTabs';
import { useSimpleDiceRoll } from '@/hooks/useSimpleDiceRoll';

import { RollSummary } from '@/types/dice';
import NotHydrated from '@/components/ui/feedback/NotHydrated';

export default function CharacterSheet() {
  const params = useParams();
  const characterId = params.characterId as string;

  const { getCharacterById, updateCharacterData } = usePlayerStore();
  const playerCharacter = getCharacterById(characterId);

  const hasHydrated = useHydration();

  const { isReady: diceBoxInitialized, roll: rollDice } = useSimpleDiceRoll({
    containerId: 'main-dice-container',
    onRollComplete: (summary: RollSummary) => {
      console.log('Dice roll completed:', summary);
    },
    onError: (error: string) => {
      console.error('Dice roll error:', error);
    },
  });

  const {
    toasts,
    dismissToast,
    showAttackRoll,
    showSavingThrow,
    showDamageRoll,
    showShortRest,
    showLongRest,
    addToast,
  } = useToast();

  const {
    character,
    saveStatus,
    lastSaved,
    hasUnsavedChanges,
    updateCharacter,
    updateAbilityScore,
    updateSkillProficiency,
    updateSkillExpertise,
    updateSavingThrowProficiency,
    updateHitPoints,
    updateInitiative,
    resetInitiativeToDefault,
    applyDamageToCharacter,
    applyHealingToCharacter,
    addTemporaryHPToCharacter,
    makeDeathSavingThrow,
    resetDeathSavingThrows,
    toggleHPCalculationMode,
    recalculateMaxHP,
    updateClass,
    updateLevel,
    updateSpellSlot,
    updatePactMagicSlot,
    resetSpellSlots,
    resetPactMagicSlots,
    addExperience,
    setExperience,
    addFeature,
    updateFeature,
    deleteFeature,
    addTrait,
    updateTrait,
    deleteTrait,
    addNote,
    updateNote,
    deleteNote,
    reorderNotes,
    addExtendedFeature,
    updateExtendedFeature,
    deleteExtendedFeature,
    useExtendedFeature,
    resetExtendedFeatures,
    reorderExtendedFeatures,
    migrateTraitsToExtendedFeatures,
    updateCharacterBackground,
    exportCharacter,
    resetCharacter,
    addHeroicInspiration,
    updateHeroicInspiration,
    useHeroicInspiration,
    resetHeroicInspiration,
    toggleReaction,
    resetReaction,
    updateTempArmorClass,
    toggleJackOfAllTrades,
    toggleShield,
    updateShieldBonus,
    stopConcentration,
    loadCharacterState,
    // Multiclass methods
    addClassLevel,
    removeClassLevel,
    updateClassLevel,
    getClassDisplayString,
    // Hit dice methods
    useHitDie,
    restoreHitDice,
    resetAllHitDice,
    // Rest management (centralized)
    takeShortRest,
    takeLongRest,
    // Language and tool proficiency methods
    addLanguage,
    deleteLanguage,
    addToolProficiency,
    updateToolProficiency,
    deleteToolProficiency,
    // Campaign tracking
    updateDaysSpent,
    incrementDaysSpent,
    // Easter egg animations
    showDeathAnimation,
    clearDeathAnimation,
    showLevelUpAnimation,
    levelUpAnimationLevel,
    clearLevelUpAnimation,
  } = useCharacterStore();

  const [showResetModal, setShowResetModal] = useState(false);

  const { manualSave } = useAutoSave();

  const lastLoadedCharacterRef = useRef<string | null>(null);
  const lastSyncedCharacterRef = useRef<CharacterState | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Load character data into store when component mounts or character changes
  useEffect(() => {
    if (playerCharacter && hasHydrated) {
      const currentCharacterId = playerCharacter.characterData.id;

      // Only load if we haven't loaded this character yet or if it's a different character
      if (lastLoadedCharacterRef.current !== currentCharacterId) {
        setIsInitialLoad(true);
        loadCharacterState(playerCharacter.characterData);
        lastLoadedCharacterRef.current = currentCharacterId;
        lastSyncedCharacterRef.current = playerCharacter.characterData;

        // Auto-migrate existing traits to extended features if needed
        const hasTraits =
          (playerCharacter.characterData.trackableTraits || []).length > 0;
        const hasExtended =
          (playerCharacter.characterData.extendedFeatures || []).length > 0;

        if (hasTraits && !hasExtended) {
          // Small delay to ensure character state is loaded first
          setTimeout(() => {
            migrateTraitsToExtendedFeatures();
          }, 100);
        }

        // Mark initial load as complete after state has been set
        const timer = setTimeout(() => {
          setIsInitialLoad(false);
        }, 50);

        return () => clearTimeout(timer);
      }
    }
  }, [
    playerCharacter,
    hasHydrated,
    loadCharacterState,
    migrateTraitsToExtendedFeatures,
  ]);

  // Sync character data back to player store when it changes (skip during initial load)
  useEffect(() => {
    if (!isInitialLoad && hasHydrated && character.id === characterId) {
      // Deep comparison to prevent unnecessary updates and infinite loops
      const hasActualChanges =
        !lastSyncedCharacterRef.current ||
        JSON.stringify(lastSyncedCharacterRef.current) !==
          JSON.stringify(character);

      if (hasActualChanges) {
        // Create a deep copy to avoid reference issues
        const characterCopy = JSON.parse(JSON.stringify(character));
        updateCharacterData(characterId, characterCopy);
        lastSyncedCharacterRef.current = characterCopy;
      }
    }
  }, [character, characterId, updateCharacterData, hasHydrated, isInitialLoad]);

  // Calculate derived values (needs to be before early returns due to hooks)
  const totalLevel = character.totalLevel || character.level;
  const proficiencyBonus = getProficiencyBonus(totalLevel);

  // Helper function to get ability modifier
  const getAbilityModifier = useCallback(
    (ability: AbilityName) => {
      return calculateModifier(character.abilities[ability]);
    },
    [character.abilities]
  );

  // All other hooks and refs that were after early returns
  const tabsRef = useRef<GroupedTabsRef>(null);

  // Navigation helper
  const switchToTab = useCallback((tabId: string) => {
    tabsRef.current?.switchToTab(tabId);
  }, []);

  // Auto-update initiative when dexterity changes (if not overridden)
  useEffect(() => {
    if (!character.initiative.isOverridden) {
      const dexModifier = getAbilityModifier('dexterity');
      if (character.initiative.value !== dexModifier) {
        updateInitiative(dexModifier, false);
      }
    }
  }, [
    character.abilities.dexterity,
    character.initiative.isOverridden,
    character.initiative.value,
    getAbilityModifier,
    updateInitiative,
  ]);

  // Auto-recalculate max HP when level or constitution changes (if in auto mode)
  useEffect(() => {
    if (character.hitPoints.calculationMode === 'auto') {
      recalculateMaxHP();
    }
  }, [
    character.level,
    character.abilities.constitution,
    character.class.name,
    character.hitPoints.calculationMode,
    recalculateMaxHP,
  ]);

  if (!hasHydrated) {
    return <NotHydrated />;
  }

  if (!playerCharacter) {
    return (
      <div className="bg-surface flex min-h-screen items-center justify-center">
        <div className="text-center">
          <FileText size={64} className="text-faint mx-auto mb-6" />
          <h1 className="text-heading mb-2 text-2xl font-bold">
            Character Not Found
          </h1>
          <p className="text-body mb-6">
            The character you&apos;re looking for doesn&apos;t exist or has been
            deleted.
          </p>
          <Link
            href="/player"
            className="bg-accent-blue-text-muted text-inverse hover:bg-accent-blue-text inline-flex items-center gap-2 rounded-lg px-4 py-2 transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Characters
          </Link>
        </div>
      </div>
    );
  }

  // Helper function to get skill modifier
  const getSkillModifier = (skillName: SkillName) => {
    return calculateSkillModifier(character, skillName);
  };

  // Helper function to get saving throw modifier
  const getSavingThrowModifier = (ability: AbilityName) => {
    const savingThrow = character.savingThrows[ability];
    let modifier = getAbilityModifier(ability);

    if (savingThrow.proficient) modifier += proficiencyBonus;
    if (savingThrow.customModifier) modifier += savingThrow.customModifier;

    return modifier;
  };

  // Get initiative modifier - either calculated or overridden
  const getInitiativeModifier = () => {
    if (character.initiative.isOverridden) {
      return character.initiative.value;
    }
    return getAbilityModifier('dexterity');
  };

  // Roll saving throw
  const rollSavingThrow = async (ability: AbilityName) => {
    const saveModifier = getSavingThrowModifier(ability);

    // Roll 3D dice and use actual result
    if (diceBoxInitialized) {
      try {
        const rollResult = await rollDice(
          `1d20${saveModifier > 0 ? `+${saveModifier}` : saveModifier}`
        );
        if (
          rollResult &&
          typeof rollResult === 'object' &&
          'individualValues' in rollResult
        ) {
          const summary = rollResult as RollSummary;
          const roll = summary.individualValues[0] || 1; // Get the d20 result
          const isCrit = roll === 20;

          // Use showAttackRoll since it's more appropriate for displaying dice rolls
          showAttackRoll(
            `${ABILITY_NAMES[ability]} Save`,
            roll,
            saveModifier,
            isCrit
          );
          return;
        }
      } catch (error) {
        console.warn(
          'Dice animation failed, falling back to random roll:',
          error
        );
      }
    }

    // Fallback to random roll if animation fails or isn't available
    const roll = Math.floor(Math.random() * 20) + 1;
    const isCrit = roll === 20;

    // Use showAttackRoll since it's more appropriate for displaying dice rolls
    showAttackRoll(
      `${ABILITY_NAMES[ability]} Save`,
      roll,
      saveModifier,
      isCrit
    );
  };

  // Roll skill check
  const rollSkillCheck = async (skillName: SkillName) => {
    const skillModifier = getSkillModifier(skillName);

    // Roll 3D dice and use actual result
    if (diceBoxInitialized) {
      try {
        const rollResult = await rollDice(
          `1d20${skillModifier > 0 ? `+${skillModifier}` : skillModifier}`
        );
        if (
          rollResult &&
          typeof rollResult === 'object' &&
          'individualValues' in rollResult
        ) {
          const summary = rollResult as RollSummary;
          const roll = summary.individualValues[0] || 1; // Get the d20 result
          const isCrit = roll === 20;

          showAttackRoll(SKILL_NAMES[skillName], roll, skillModifier, isCrit);
          return;
        }
      } catch (error) {
        console.warn(
          'Dice animation failed, falling back to random roll:',
          error
        );
      }
    }

    // Fallback to random roll if animation fails or isn't available
    const roll = Math.floor(Math.random() * 20) + 1;
    const isCrit = roll === 20;

    showAttackRoll(SKILL_NAMES[skillName], roll, skillModifier, isCrit);
  };

  // Roll ability check
  const rollAbilityCheck = async (ability: AbilityName) => {
    const abilityModifier = getAbilityModifier(ability);

    // Roll 3D dice and use actual result
    if (diceBoxInitialized) {
      try {
        const rollResult = await rollDice(
          `1d20${abilityModifier > 0 ? `+${abilityModifier}` : abilityModifier}`
        );
        if (
          rollResult &&
          typeof rollResult === 'object' &&
          'individualValues' in rollResult
        ) {
          const summary = rollResult as RollSummary;
          const roll = summary.individualValues[0] || 1; // Get the d20 result
          const isCrit = roll === 20;

          showAttackRoll(
            `${ABILITY_NAMES[ability]} Check`,
            roll,
            abilityModifier,
            isCrit
          );
          return;
        }
      } catch (error) {
        console.warn(
          'Dice animation failed, falling back to random roll:',
          error
        );
      }
    }

    // Fallback to random roll if animation fails or isn't available
    const roll = Math.floor(Math.random() * 20) + 1;
    const isCrit = roll === 20;

    showAttackRoll(
      `${ABILITY_NAMES[ability]} Check`,
      roll,
      abilityModifier,
      isCrit
    );
  };

  // Roll initiative
  const rollInitiative = async () => {
    const initiativeModifier = getInitiativeModifier();

    // Roll 3D dice and use actual result
    if (diceBoxInitialized) {
      try {
        const rollResult = await rollDice(
          `1d20${initiativeModifier > 0 ? `+${initiativeModifier}` : initiativeModifier}`
        );
        if (
          rollResult &&
          typeof rollResult === 'object' &&
          'individualValues' in rollResult
        ) {
          const summary = rollResult as RollSummary;
          const roll = summary.individualValues[0] || 1; // Get the d20 result
          const isCrit = roll === 20;

          showAttackRoll('Initiative', roll, initiativeModifier, isCrit);
          return;
        }
      } catch (error) {
        console.warn(
          'Dice animation failed, falling back to random roll:',
          error
        );
      }
    }

    // Fallback to random roll if animation fails or isn't available
    const roll = Math.floor(Math.random() * 20) + 1;
    const isCrit = roll === 20;

    showAttackRoll('Initiative', roll, initiativeModifier, isCrit);
  };

  // Check if character has spell capabilities
  const characterHasSpells = hasSpellSlots(
    character.spellSlots,
    character.pactMagic
  );

  // Export functionality
  const handleExport = () => {
    try {
      const exportData = exportCharacter();
      exportCharacterToFile(exportData);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export character. Please try again.');
    }
  };

  return (
    <ErrorBoundary>
      <NavigationContext.Provider value={{ switchToTab }}>
        <div className="relative min-h-screen bg-gradient-to-br from-[var(--gradient-page-from)] via-[var(--gradient-page-via)] to-[var(--gradient-page-to)]">
          {/* Header */}
          <CharacterSheetHeader
            characterId={characterId}
            characterName={character.name}
            characterRace={character.race}
            characterClass={character.class?.name || 'Unknown Class'}
            characterLevel={character.level}
            saveStatus={saveStatus}
            lastSaved={lastSaved}
            hasUnsavedChanges={hasUnsavedChanges}
            onManualSave={manualSave}
            onExport={handleExport}
            onShowResetModal={() => setShowResetModal(true)}
            onUpdateName={name => updateCharacter({ name })}
            onAddToast={addToast}
          />

          <div className="p-4">
            {/* Main Dice Container */}
            <div
              id="main-dice-container"
              className="pointer-events-none fixed inset-0 z-[9999]"
              style={{
                width: '100vw',
                height: '100vh',
                top: 0,
                left: 0,
              }}
            ></div>
            <style jsx global>{`
              #main-dice-container {
                position: fixed;
                inset: 0;
                width: 100vw;
                height: 100vh;
              }
              #main-dice-container canvas,
              #main-dice-container > div,
              #main-dice-container > canvas {
                position: absolute !important;
                top: 0 !important;
                left: 0 !important;
                width: 100% !important;
                height: 100% !important;
                max-width: 100% !important;
                max-height: 100% !important;
                display: block !important;
              }
            `}</style>

            <ExperimentalFeaturesSection />

            {/* Main Character Sheet */}
            <main className="relative z-10 mx-auto max-w-7xl space-y-8">
              {/* Actions Section */}
              <CollapsibleSection
                title="Actions & Combat"
                icon="⚔️"
                defaultExpanded={true}
                persistKey="actions-combat"
                className="border-divider-strong rounded-xl border-2 bg-gradient-to-r from-[var(--gradient-slate-from)] to-[var(--gradient-slate-to)] shadow-lg backdrop-blur-sm"
                headerClassName="rounded-t-xl"
                contentClassName="px-6 pb-6"
                badge={
                  character.concentration.isConcentrating && (
                    <span className="bg-accent-orange-bg-strong text-accent-orange-text rounded-full px-3 py-1 text-sm font-medium">
                      Concentrating
                    </span>
                  )
                }
              >
                <ActionsSection
                  character={character}
                  showAttackRoll={showAttackRoll}
                  showSavingThrow={showSavingThrow}
                  showDamageRoll={showDamageRoll}
                  animateRoll={diceBoxInitialized ? rollDice : undefined}
                  switchToTab={switchToTab}
                  onStopConcentration={stopConcentration}
                />
              </CollapsibleSection>

              {/* Rest & Recovery - Standalone Section */}
              <CollapsibleSection
                title="Rest & Recovery"
                icon="🛌"
                defaultExpanded={false}
                persistKey="rest-recovery"
                className="border-divider bg-surface-raised rounded-lg border shadow-lg"
                contentClassName="px-6 pb-6"
                badge={
                  <div className="flex items-center gap-2">
                    <span className="bg-accent-amber-bg-strong text-accent-amber-text-muted rounded-md px-2 py-0.5 text-xs font-medium">
                      Day {character.daysSpent || 0}
                    </span>
                    <span className="bg-accent-blue-bg-strong text-accent-blue-text-muted rounded-md px-2 py-0.5 text-xs font-medium">
                      Short Rest
                    </span>
                    <span className="bg-accent-indigo-bg-strong text-accent-indigo-text rounded-md px-2 py-0.5 text-xs font-medium">
                      Long Rest
                    </span>
                  </div>
                }
              >
                <div className="space-y-6">
                  {/* Rest Manager */}
                  <RestManager
                    onShortRest={takeShortRest}
                    onLongRest={takeLongRest}
                    onShowShortRestToast={showShortRest}
                    onShowLongRestToast={showLongRest}
                  />

                  {/* Days Spent Tracker - Full Width */}
                  <DaysSpentTracker
                    daysSpent={character.daysSpent || 0}
                    onUpdateDays={updateDaysSpent}
                    onIncrementDays={incrementDaysSpent}
                  />
                </div>
              </CollapsibleSection>

              {/* Section Divider */}
              <div className="flex items-center justify-center">
                <div className="via-divider-strong h-px w-full max-w-md bg-gradient-to-r from-transparent to-transparent"></div>
                <span className="text-muted px-4 font-medium">Core Stats</span>
                <div className="via-divider-strong h-px w-full max-w-md bg-gradient-to-r from-transparent to-transparent"></div>
              </div>

              {/* Core D&D Stats Section */}
              <CollapsibleSection
                title="Character Statistics"
                icon="📊"
                defaultExpanded={true}
                persistKey="character-statistics"
                className="border-accent-blue-border-strong rounded-xl border-2 bg-gradient-to-r from-[var(--gradient-blue-from)] to-[var(--gradient-indigo-to)] shadow-lg backdrop-blur-sm"
                headerClassName="rounded-t-xl"
                contentClassName="px-6 pb-6"
                badge={
                  <div className="flex items-center gap-2">
                    <span className="bg-accent-blue-bg-strong text-accent-blue-text rounded-full px-3 py-1 text-sm font-medium">
                      Level {totalLevel}
                    </span>
                    <span className="bg-accent-green-bg-strong text-accent-green-text rounded-full px-3 py-1 text-sm font-medium">
                      HP: {character.hitPoints.current}/
                      {character.hitPoints.max}
                    </span>
                  </div>
                }
              >
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                  {/* Left Column - Basic Info & Ability Scores */}
                  <div className="space-y-6 lg:col-span-4">
                    {/* Basic Character Information */}
                    <CharacterBasicInfo
                      character={character}
                      race={character.race}
                      characterClass={character.class}
                      level={character.level}
                      background={character.background}
                      playerName={character.playerName}
                      alignment={character.alignment}
                      onUpdateRace={race => updateCharacter({ race })}
                      onUpdateClass={updateClass}
                      onUpdateLevel={updateLevel}
                      onUpdateBackground={background =>
                        updateCharacter({ background })
                      }
                      onUpdatePlayerName={playerName =>
                        updateCharacter({ playerName })
                      }
                      onUpdateAlignment={alignment =>
                        updateCharacter({ alignment })
                      }
                      onAddClassLevel={addClassLevel}
                      onRemoveClassLevel={removeClassLevel}
                      onUpdateClassLevel={updateClassLevel}
                      getClassDisplayString={getClassDisplayString}
                    />

                    {/* Ability Scores */}
                    <AbilityScores
                      abilities={character.abilities}
                      characterLevel={totalLevel}
                      onUpdateAbilityScore={updateAbilityScore}
                      onRollAbilityCheck={rollAbilityCheck}
                    />

                    {/* Weapon Proficiencies */}
                    <ErrorBoundary
                      fallback={
                        <div className="border-accent-amber-border bg-surface-raised rounded-lg border p-4 shadow">
                          <h3 className="text-body mb-2 text-sm font-medium">
                            Weapon Proficiencies
                          </h3>
                          <p className="text-muted">
                            Unable to load weapon proficiencies
                          </p>
                        </div>
                      }
                    >
                      <WeaponProficiencies />
                    </ErrorBoundary>

                    {/* Heroic Inspiration */}
                    <HeroicInspirationTracker
                      inspiration={character.heroicInspiration}
                      onAddInspiration={addHeroicInspiration}
                      onUpdateInspiration={updateHeroicInspiration}
                      onUseInspiration={useHeroicInspiration}
                      onResetInspiration={resetHeroicInspiration}
                    />

                    {/* Conditions & Diseases Quick View */}
                    {hasHydrated &&
                      (character.conditionsAndDiseases?.activeConditions
                        ?.length > 0 ||
                        character.conditionsAndDiseases?.activeDiseases
                          ?.length > 0) && (
                        <div className="border-accent-red-border rounded-lg border-2 bg-gradient-to-br from-[var(--gradient-red-from)] to-[var(--gradient-red-to)] p-4 shadow-sm">
                          <div className="mb-3 flex items-center justify-between">
                            <h3 className="text-accent-red-text flex items-center gap-2 text-base font-semibold">
                              <AlertTriangle className="h-5 w-5" />
                              Active Conditions & Diseases
                            </h3>
                            <Button
                              onClick={() =>
                                tabsRef.current?.switchToTab('conditions')
                              }
                              variant="ghost"
                              size="xs"
                              className="text-accent-red-text-muted hover:bg-accent-red-bg-strong"
                            >
                              Manage →
                            </Button>
                          </div>
                          <div className="space-y-2">
                            {character.conditionsAndDiseases?.activeConditions?.map?.(
                              condition => (
                                <div
                                  key={condition.id}
                                  className="border-accent-red-border bg-surface-raised flex items-center justify-between gap-2 rounded-lg border-2 p-2"
                                >
                                  <div className="flex items-center gap-2">
                                    <Badge variant="danger" size="sm">
                                      {condition.name}
                                    </Badge>
                                    {condition.stackable &&
                                      condition.count > 1 && (
                                        <Badge variant="warning" size="sm">
                                          Level {condition.count}
                                        </Badge>
                                      )}
                                  </div>
                                  <Badge variant="neutral" size="sm">
                                    {condition.source}
                                  </Badge>
                                </div>
                              )
                            )}
                            {character.conditionsAndDiseases?.activeDiseases?.map?.(
                              disease => (
                                <div
                                  key={disease.id}
                                  className="border-accent-purple-border bg-surface-raised flex items-center justify-between gap-2 rounded-lg border-2 p-2"
                                >
                                  <Badge variant="info" size="sm">
                                    {disease.name}
                                  </Badge>
                                  <Badge variant="neutral" size="sm">
                                    {disease.source}
                                  </Badge>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}

                    {/* Quick Stats */}
                    <QuickStats
                      passivePerception={10 + getSkillModifier('perception')}
                      proficiencyBonus={proficiencyBonus}
                    />

                    {/* Special Abilities - Read-only, only show active abilities from extendedFeatures */}
                    <TraitTracker<ExtendedFeature>
                      traits={(character.extendedFeatures || []).filter(
                        trait => !trait.isPassive
                      )}
                      characterLevel={totalLevel}
                      onUpdateTrait={updateExtendedFeature}
                      onDeleteTrait={deleteExtendedFeature}
                      onUseTrait={useExtendedFeature}
                      onResetTraits={resetExtendedFeatures}
                      readonly={false}
                      hideControls={true}
                      enableViewModal={true}
                    />
                  </div>

                  {/* Middle Column - Skills & Saving Throws */}
                  <div className="space-y-6 lg:col-span-4">
                    {/* Saving Throws */}
                    <SavingThrows
                      savingThrows={character.savingThrows}
                      getSavingThrowModifier={getSavingThrowModifier}
                      onUpdateSavingThrowProficiency={
                        updateSavingThrowProficiency
                      }
                      onRollSavingThrow={rollSavingThrow}
                    />

                    {/* Skills */}
                    <Skills
                      skills={character.skills}
                      jackOfAllTrades={character.jackOfAllTrades ?? false}
                      proficiencyBonus={proficiencyBonus}
                      getSkillModifier={getSkillModifier}
                      onUpdateSkillProficiency={updateSkillProficiency}
                      onUpdateSkillExpertise={updateSkillExpertise}
                      onToggleJackOfAllTrades={toggleJackOfAllTrades}
                      onRollSkillCheck={rollSkillCheck}
                    />

                    {/* Experience Points */}
                    <div className="border-accent-amber-border bg-surface-raised rounded-lg border p-6 shadow-lg">
                      <h2 className="border-divider text-heading mb-4 border-b pb-2 text-lg font-bold">
                        Experience Points
                      </h2>
                      <XPTracker
                        currentXP={character.experience}
                        currentLevel={totalLevel}
                        onAddXP={addExperience}
                        onSetXP={setExperience}
                      />
                    </div>

                    {/* Spell Slots */}
                    {characterHasSpells && (
                      <SpellSlotTracker
                        spellSlots={character.spellSlots}
                        pactMagic={character.pactMagic}
                        onSpellSlotChange={updateSpellSlot}
                        onPactMagicChange={
                          character.pactMagic ? updatePactMagicSlot : undefined
                        }
                        onResetSpellSlots={resetSpellSlots}
                        onResetPactMagic={
                          character.pactMagic ? resetPactMagicSlots : undefined
                        }
                      />
                    )}
                  </div>

                  {/* Right Column - Combat Stats & Features */}
                  <div className="space-y-6 lg:col-span-4">
                    {/* Combat Stats */}
                    <div className="border-accent-amber-border bg-surface-raised rounded-lg border p-6 shadow-lg">
                      <h2 className="border-divider text-heading mb-4 border-b pb-2 text-lg font-bold">
                        Combat Stats
                      </h2>

                      {/* Armor Class */}
                      <ArmorClassManager
                        character={character}
                        onUpdateArmorClass={ac =>
                          updateCharacter({ armorClass: ac })
                        }
                        onUpdateTempArmorClass={updateTempArmorClass}
                        onToggleShield={toggleShield}
                        onUpdateShieldBonus={updateShieldBonus}
                      />

                      {/* Combat Stats */}
                      <CombatStats
                        character={character}
                        getInitiativeModifier={getInitiativeModifier}
                        onUpdateInitiative={updateInitiative}
                        onResetInitiativeToDefault={resetInitiativeToDefault}
                        onUpdateSpeed={speed => updateCharacter({ speed })}
                        onToggleReaction={toggleReaction}
                        onResetReaction={resetReaction}
                        onRollInitiative={rollInitiative}
                      />

                      {/* Hit Points - Now using comprehensive HP Manager */}
                      <div className="mb-6">
                        <ErrorBoundary
                          fallback={
                            <div className="border-accent-red-border bg-surface-raised rounded-lg border p-6 shadow-lg">
                              <h3 className="text-accent-red-text mb-4 text-lg font-bold">
                                Hit Points
                              </h3>
                              <p className="text-muted">
                                Unable to load HP manager
                              </p>
                            </div>
                          }
                        >
                          <HitPointManager
                            hitPoints={character.hitPoints}
                            classInfo={character.class}
                            level={totalLevel}
                            constitutionScore={character.abilities.constitution}
                            onApplyDamage={applyDamageToCharacter}
                            onApplyHealing={applyHealingToCharacter}
                            onAddTemporaryHP={addTemporaryHPToCharacter}
                            onMakeDeathSave={makeDeathSavingThrow}
                            onResetDeathSaves={resetDeathSavingThrows}
                            onToggleCalculationMode={toggleHPCalculationMode}
                            onRecalculateMaxHP={recalculateMaxHP}
                            onUpdateHitPoints={updateHitPoints}
                          />
                        </ErrorBoundary>
                      </div>

                      {/* Hit Dice */}
                      <ErrorBoundary
                        fallback={
                          <div className="border-accent-purple-border bg-surface-raised rounded-lg border p-4 shadow">
                            <h3 className="text-body mb-2 text-sm font-medium">
                              Hit Dice
                            </h3>
                            <p className="text-muted">
                              Unable to load hit dice tracker
                            </p>
                          </div>
                        }
                      >
                        <HitDiceTracker
                          hitDicePools={character.hitDicePools || {}}
                          onUseHitDie={useHitDie}
                          onRestoreHitDice={restoreHitDice}
                          onResetAllHitDice={resetAllHitDice}
                        />
                      </ErrorBoundary>
                    </div>
                    {/* Languages & Tool Proficiencies */}
                    <LanguagesAndProficiencies
                      languages={character.languages || []}
                      toolProficiencies={character.toolProficiencies || []}
                      proficiencyBonus={proficiencyBonus}
                      onAddLanguage={addLanguage}
                      onDeleteLanguage={deleteLanguage}
                      onAddToolProficiency={addToolProficiency}
                      onUpdateToolProficiency={updateToolProficiency}
                      onDeleteToolProficiency={deleteToolProficiency}
                    />
                  </div>
                </div>
              </CollapsibleSection>

              {/* Active Abilities & Features Section */}
              <CollapsibleSection
                title="Active Abilities & Features"
                icon="⚡"
                defaultExpanded={false}
                persistKey="active-features"
                className="border-accent-amber-border-strong rounded-xl border-2 bg-gradient-to-r from-[var(--gradient-amber-from)] to-[var(--gradient-amber-to)] shadow-lg backdrop-blur-sm"
                headerClassName="rounded-t-xl"
                contentClassName="px-6 pb-6"
                badge={
                  <div className="flex items-center gap-2">
                    {(character.extendedFeatures?.length || 0) > 0 && (
                      <span className="bg-accent-amber-bg-strong text-accent-amber-text rounded-full px-3 py-1 text-sm font-medium">
                        {character.extendedFeatures?.length || 0} abilities
                      </span>
                    )}
                    {character.extendedFeatures?.some(f => f.usedUses > 0) && (
                      <span className="bg-accent-red-bg-strong text-accent-red-text rounded-full px-3 py-1 text-sm font-medium">
                        {
                          character.extendedFeatures?.filter(
                            f => f.usedUses > 0
                          ).length
                        }{' '}
                        used
                      </span>
                    )}
                  </div>
                }
              >
                <ExtendedFeaturesSection
                  features={character.extendedFeatures || []}
                  character={character}
                  onAddFeature={addExtendedFeature}
                  onUpdateFeature={updateExtendedFeature}
                  onDeleteFeature={deleteExtendedFeature}
                  onUseFeature={useExtendedFeature}
                  onResetFeatures={resetExtendedFeatures}
                  onReorderFeatures={reorderExtendedFeatures}
                />
              </CollapsibleSection>

              {/* Grouped Tabbed Interface for Additional Sections */}
              <CollapsibleSection
                title="Character Details & Management"
                icon="📋"
                defaultExpanded={true}
                persistKey="character-details"
                className="border-accent-green-border-strong rounded-xl border-2 bg-gradient-to-r from-[var(--gradient-green-from)] to-[var(--gradient-emerald-to)] shadow-lg backdrop-blur-sm"
                headerClassName="rounded-t-xl"
                contentClassName="px-6 pb-6"
                badge={
                  <div className="flex items-center gap-2">
                    {character.spells.length > 0 && (
                      <span className="bg-accent-purple-bg-strong text-accent-purple-text rounded-full px-3 py-1 text-sm font-medium">
                        {character.spells.length} spells
                      </span>
                    )}
                    {(character.features?.length || 0) > 0 && (
                      <span className="bg-accent-green-bg-strong text-accent-green-text rounded-full px-3 py-1 text-sm font-medium">
                        {character.features?.length || 0} features
                      </span>
                    )}
                  </div>
                }
              >
                <GroupedTabs
                  defaultTab="spellcasting"
                  className="w-full"
                  groups={createCharacterSheetTabsConfig({
                    character,
                    hasHydrated,
                    addFeature,
                    updateFeature,
                    deleteFeature,
                    addTrait,
                    updateTrait,
                    deleteTrait,
                    updateCharacterBackground,
                    addNote,
                    updateNote,
                    deleteNote,
                    reorderNotes,
                    addToast,
                  })}
                  ref={tabsRef}
                />
              </CollapsibleSection>
            </main>

            <ToastContainer toasts={toasts} onDismiss={dismissToast} />

            <YouDiedOverlay
              isVisible={showDeathAnimation}
              onDismiss={clearDeathAnimation}
              characterName={character.name}
            />

            <LevelUpOverlay
              isVisible={showLevelUpAnimation}
              onDismiss={clearLevelUpAnimation}
              newLevel={levelUpAnimationLevel}
              characterName={character.name}
            />

            {/* Character Reset Confirmation Modal */}
            <ConfirmationModal
              isOpen={showResetModal}
              onClose={() => setShowResetModal(false)}
              onConfirm={resetCharacter}
              title="Reset Character"
              message="Are you sure you want to reset this character? This will permanently delete all character data, including abilities, equipment, spells, and progress. This action cannot be undone."
              confirmText="Reset Character"
              cancelText="Keep Character"
              type="danger"
            />
          </div>
        </div>
      </NavigationContext.Provider>
    </ErrorBoundary>
  );
}
