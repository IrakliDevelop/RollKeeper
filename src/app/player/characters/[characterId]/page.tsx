'use client';

import { FileText, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { usePlayerStore } from '@/store/playerStore';
import { useCharacterStore } from '@/store/characterStore';
import { useAutoSave } from '@/hooks/useAutoSave';

import SpellSlotTracker from '@/components/ui/character/SpellSlotTracker';
import TraitTracker from '@/components/ui/character/TraitTracker';
import HeroicInspirationTracker from '@/components/ui/character/HeroicInspirationTracker';
import XPTracker from '@/components/ui/character/XPTracker';

import HitPointManager from '@/components/ui/character/HitPointManager';
import ExperimentalFeaturesSection from '@/components/ui/layout/ExperimentalFeaturesSection';
import HitDiceManager from '@/components/ui/character/HitDiceManager';
import ErrorBoundary from '@/components/ui/feedback/ErrorBoundary';
import { WeaponProficiencies } from '@/components/WeaponProficiencies';
import { ToastContainer, useToast } from '@/components/ui/feedback/Toast';
import { ConfirmationModal } from '@/components/ui/feedback/ConfirmationModal';

import CharacterSheetHeader from '@/components/ui/character/CharacterSheetHeader';
import CharacterBasicInfo from '@/components/ui/character/CharacterBasicInfo';
import AbilityScores from '@/components/ui/character/AbilityScores';
import ArmorClassManager from '@/components/ui/character/ArmorClassManager';
import SavingThrows from '@/components/ui/character/SavingThrows';
import Skills from '@/components/ui/character/Skills';
import CombatStats from '@/components/ui/character/CombatStats';
import ActionsSection from '@/components/ui/character/ActionsSection';
import QuickStats from '@/components/ui/character/QuickStats';
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
import { AbilityName, SkillName, CharacterState } from '@/types/character';
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
    addTrackableTrait,
    updateTrackableTrait,
    deleteTrackableTrait,
    useTrackableTrait,
    resetTrackableTraits,
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
    resetTempArmorClass,
    updateShieldBonus,
    stopConcentration,
    loadCharacterState,
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
        const hasTraits = (playerCharacter.characterData.trackableTraits || []).length > 0;
        const hasExtended = (playerCharacter.characterData.extendedFeatures || []).length > 0;
        
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
  }, [playerCharacter, hasHydrated, loadCharacterState, migrateTraitsToExtendedFeatures]);

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
  const proficiencyBonus = getProficiencyBonus(character.level);

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
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <FileText size={64} className="mx-auto mb-6 text-gray-400" />
          <h1 className="mb-2 text-2xl font-bold text-slate-800">
            Character Not Found
          </h1>
          <p className="mb-6 text-slate-600">
            The character you&apos;re looking for doesn&apos;t exist or has been
            deleted.
          </p>
          <Link
            href="/player"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
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
        <div className="relative min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
          {/* Header */}
          <CharacterSheetHeader
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
              <ActionsSection
                character={character}
                showAttackRoll={showAttackRoll}
                showSavingThrow={showSavingThrow}
                showDamageRoll={showDamageRoll}
                animateRoll={diceBoxInitialized ? rollDice : undefined}
                switchToTab={switchToTab}
                onStopConcentration={stopConcentration}
              />

              {/* Section Divider */}
              <div className="flex items-center justify-center">
                <div className="h-px w-full max-w-md bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
                <span className="px-4 font-medium text-gray-500">
                  Core Stats
                </span>
                <div className="h-px w-full max-w-md bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
              </div>

              {/* Core D&D Stats Section */}
              <section className="rounded-xl border-2 border-blue-300 bg-gradient-to-r from-blue-50 to-indigo-50 p-6 shadow-lg backdrop-blur-sm">
                <h2 className="mb-6 border-b-2 border-blue-400 pb-3 text-center text-2xl font-bold text-blue-900">
                  📊 Character Statistics
                </h2>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                  {/* Left Column - Basic Info & Ability Scores */}
                  <div className="space-y-6 lg:col-span-4">
                    {/* Basic Character Information */}
                    <CharacterBasicInfo
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
                    />

                    {/* Ability Scores */}
                    <AbilityScores
                      abilities={character.abilities}
                      characterLevel={character.level}
                      onUpdateAbilityScore={updateAbilityScore}
                      onRollAbilityCheck={rollAbilityCheck}
                    />

                    {/* Hit Dice */}
                    <ErrorBoundary
                      fallback={
                        <div className="rounded-lg border border-purple-200 bg-white p-4 shadow">
                          <h3 className="mb-2 text-sm font-medium text-gray-700">
                            Hit Dice
                          </h3>
                          <p className="text-gray-500">
                            Unable to load hit dice manager
                          </p>
                        </div>
                      }
                    >
                      <HitDiceManager
                        classInfo={character.class}
                        level={character.level}
                        hitDice={character.hitDice}
                        onUpdateClass={updateClass}
                        onUpdateHitDice={hitDice =>
                          updateCharacter({ hitDice })
                        }
                      />
                    </ErrorBoundary>

                    {/* Weapon Proficiencies */}
                    <ErrorBoundary
                      fallback={
                        <div className="rounded-lg border border-amber-200 bg-white p-4 shadow">
                          <h3 className="mb-2 text-sm font-medium text-gray-700">
                            Weapon Proficiencies
                          </h3>
                          <p className="text-gray-500">
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
                        <div className="rounded-lg border border-red-200 bg-white p-4 shadow">
                          <h3 className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-700">
                            <span className="text-red-600">🤒</span>
                            Active Conditions & Diseases
                            <button
                              onClick={() =>
                                tabsRef.current?.switchToTab('conditions')
                              }
                              className="ml-auto text-xs text-blue-600 hover:text-blue-800"
                            >
                              Manage →
                            </button>
                          </h3>
                          <div className="space-y-1">
                            {character.conditionsAndDiseases?.activeConditions?.map?.(
                              condition => (
                                <div
                                  key={condition.id}
                                  className="flex items-center justify-between text-xs text-red-700"
                                >
                                  <span>
                                    {condition.name}
                                    {condition.stackable &&
                                      condition.count > 1 &&
                                      ` (Level ${condition.count})`}
                                  </span>
                                  <span className="text-gray-500">
                                    {condition.source}
                                  </span>
                                </div>
                              )
                            )}
                            {character.conditionsAndDiseases?.activeDiseases?.map?.(
                              disease => (
                                <div
                                  key={disease.id}
                                  className="flex items-center justify-between text-xs text-purple-700"
                                >
                                  <span>{disease.name}</span>
                                  <span className="text-gray-500">
                                    {disease.source}
                                  </span>
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
                    <div className="rounded-lg border border-amber-200 bg-white p-6 shadow-lg">
                      <h2 className="mb-4 border-b border-gray-200 pb-2 text-lg font-bold text-gray-800">
                        Experience Points
                      </h2>
                      <XPTracker
                        currentXP={character.experience}
                        currentLevel={character.level}
                        onAddXP={addExperience}
                        onSetXP={setExperience}
                      />
                    </div>
                  </div>

                  {/* Right Column - Combat Stats & Features */}
                  <div className="space-y-6 lg:col-span-4">
                    {/* Combat Stats */}
                    <div className="rounded-lg border border-amber-200 bg-white p-6 shadow-lg">
                      <h2 className="mb-4 border-b border-gray-200 pb-2 text-lg font-bold text-gray-800">
                        Combat Stats
                      </h2>

                      {/* Armor Class */}
                      <ArmorClassManager
                        character={character}
                        onUpdateArmorClass={ac =>
                          updateCharacter({ armorClass: ac })
                        }
                        onUpdateTempArmorClass={updateTempArmorClass}
                        onResetTempArmorClass={resetTempArmorClass}
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
                            <div className="rounded-lg border border-red-200 bg-white p-6 shadow-lg">
                              <h3 className="mb-4 text-lg font-bold text-red-800">
                                Hit Points
                              </h3>
                              <p className="text-gray-500">
                                Unable to load HP manager
                              </p>
                            </div>
                          }
                        >
                          <HitPointManager
                            hitPoints={character.hitPoints}
                            classInfo={character.class}
                            level={character.level}
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

                    {/* Special Abilities */}
                    <TraitTracker
                      traits={character.trackableTraits || []}
                      characterLevel={character.level}
                      onAddTrait={addTrackableTrait}
                      onUpdateTrait={updateTrackableTrait}
                      onDeleteTrait={deleteTrackableTrait}
                      onUseTrait={useTrackableTrait}
                      onResetTraits={resetTrackableTraits}
                    />
                  </div>
                </div>
              </section>

              {/* Extended Character Features Section */}
              <section className="mt-8">
                <ExtendedFeaturesSection
                  features={character.extendedFeatures || []}
                  characterLevel={character.level}
                  onAddFeature={addExtendedFeature}
                  onUpdateFeature={updateExtendedFeature}
                  onDeleteFeature={deleteExtendedFeature}
                  onUseFeature={useExtendedFeature}
                  onResetFeatures={resetExtendedFeatures}
                  onReorderFeatures={reorderExtendedFeatures}
                />
              </section>

              {/* Grouped Tabbed Interface for Additional Sections */}
              <section className="mt-8">
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
                  })}
                  ref={tabsRef}
                />
              </section>
            </main>

            <ToastContainer toasts={toasts} onDismiss={dismissToast} />

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
