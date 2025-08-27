'use client';

import { FileText, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { usePlayerStore } from "@/store/playerStore";
import { useCharacterStore } from "@/store/characterStore";
import { useAutoSave } from "@/hooks/useAutoSave";

import SpellSlotTracker from "@/components/ui/character/SpellSlotTracker";
import TraitTracker from "@/components/ui/character/TraitTracker";
import HeroicInspirationTracker from "@/components/ui/character/HeroicInspirationTracker";
import XPTracker from "@/components/ui/character/XPTracker";
import FeaturesTraitsManager from "@/components/ui/game/FeaturesTraitsManager";
import NotesManager from "@/components/ui/game/NotesManager";
import CharacterBackgroundEditor from "@/components/ui/character/CharacterBackgroundEditor";
import HitPointManager from "@/components/ui/character/HitPointManager";
import ExperimentalFeaturesSection from "@/components/ui/layout/ExperimentalFeaturesSection";
import FeaturesNavigationSection from "@/components/ui/layout/FeaturesNavigationSection";
import HitDiceManager from "@/components/ui/character/HitDiceManager";
import ErrorBoundary from "@/components/ui/feedback/ErrorBoundary";
import { WeaponInventory } from "@/components/WeaponInventory";
import { WeaponProficiencies } from "@/components/WeaponProficiencies";
import { SpellcastingStats } from "@/components/SpellcastingStats";
import { SpellManagement } from "@/components/SpellManagement";
import { ToastContainer, useToast } from "@/components/ui/feedback/Toast";
import { ConfirmationModal } from "@/components/ui/feedback/ConfirmationModal";
import ConditionsDiseasesManager from "@/components/ui/game/ConditionsDiseasesManager";
import CharacterSheetHeader from "@/components/ui/character/CharacterSheetHeader";
import CharacterBasicInfo from "@/components/ui/character/CharacterBasicInfo";
import AbilityScores from "@/components/ui/character/AbilityScores";
import ArmorClassManager from "@/components/ui/character/ArmorClassManager";
import SavingThrows from "@/components/ui/character/SavingThrows";
import Skills from "@/components/ui/character/Skills";
import CombatStats from "@/components/ui/character/CombatStats";
import ActionsSection from "@/components/ui/character/ActionsSection";
import QuickStats from "@/components/ui/character/QuickStats";
import { useHydration } from "@/hooks/useHydration";
import { 
  ABILITY_NAMES, 
  SKILL_NAMES
} from "@/utils/constants";
import { 
  calculateModifier, 
  getProficiencyBonus, 
  hasSpellSlots,
  calculateSkillModifier,
} from "@/utils/calculations";
import { 
  exportCharacterToFile
} from "@/utils/fileOperations";
import { AbilityName, SkillName, CharacterState } from "@/types/character";
import { useCallback, useEffect, useState, useRef } from "react";
import GroupedTabs, { TabContent, GroupedTabsRef } from "@/components/ui/layout/GroupedTabs";
import { NavigationContext } from "@/contexts/NavigationContext";
import ArmorDefenseManager from "@/components/ArmorDefenseManager";
import InventoryManager from "@/components/ui/game/InventoryManager";
import CurrencyManager from "@/components/ui/game/CurrencyManager";
import { useSimpleDiceRoll } from "@/hooks/useSimpleDiceRoll";

import { RollSummary } from "@/types/dice";
import NotHydrated from "@/components/ui/feedback/NotHydrated";


export default function CharacterSheet() {
  const params = useParams();
  const characterId = params.characterId as string;
  
  const { getCharacterById, updateCharacterData } = usePlayerStore();
  const playerCharacter = getCharacterById(characterId);

  // Hydration check to prevent SSR/client mismatches
  const hasHydrated = useHydration();
  
  // Dice rolling with new modular system
  const { isReady: diceBoxInitialized, roll: rollDice } = useSimpleDiceRoll({
    containerId: 'main-dice-container',
    onRollComplete: (summary: RollSummary) => {
      console.log('Dice roll completed:', summary);
    },
    onError: (error: string) => {
      console.error('Dice roll error:', error);
    }
  });
  
  // Toast system
  const { toasts, dismissToast, showAttackRoll, showSavingThrow, showDamageRoll, addToast } = useToast();
  
  // Zustand store
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
    loadCharacterState
  } = useCharacterStore();

  // Modal state for character reset
  const [showResetModal, setShowResetModal] = useState(false);

  // Auto-save functionality
  const { manualSave } = useAutoSave();

  // Track the last loaded character to prevent sync loops
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
        
        // Mark initial load as complete after state has been set
        const timer = setTimeout(() => {
          setIsInitialLoad(false);
        }, 50);
        
        return () => clearTimeout(timer);
      }
    }
  }, [playerCharacter, hasHydrated, loadCharacterState]);

  // Sync character data back to player store when it changes (skip during initial load)
  useEffect(() => {
    if (
      !isInitialLoad &&
      hasHydrated && 
      character.id === characterId
    ) {
      // Deep comparison to prevent unnecessary updates and infinite loops
      const hasActualChanges = !lastSyncedCharacterRef.current || 
        JSON.stringify(lastSyncedCharacterRef.current) !== JSON.stringify(character);
      
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
  const getAbilityModifier = useCallback((ability: AbilityName) => {
    return calculateModifier(character.abilities[ability]);
  }, [character.abilities]);

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
  }, [character.abilities.dexterity, character.initiative.isOverridden, character.initiative.value, getAbilityModifier, updateInitiative]);

  // Auto-recalculate max HP when level or constitution changes (if in auto mode)
  useEffect(() => {
    if (character.hitPoints.calculationMode === 'auto') {
      recalculateMaxHP();
    }
  }, [character.level, character.abilities.constitution, character.class.name, character.hitPoints.calculationMode, recalculateMaxHP]);

  if (!hasHydrated) {
    return <NotHydrated />;
  }

  if (!playerCharacter) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FileText size={64} className="mx-auto mb-6 text-gray-400" />
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Character Not Found</h1>
          <p className="text-slate-600 mb-6">
            The character you&apos;re looking for doesn&apos;t exist or has been deleted.
          </p>
          <Link href="/player" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
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
        const rollResult = await rollDice(`1d20${saveModifier > 0 ? `+${saveModifier}` : saveModifier}`);
        if (rollResult && typeof rollResult === 'object' && 'individualValues' in rollResult) {
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
        console.warn('Dice animation failed, falling back to random roll:', error);
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
        const rollResult = await rollDice(`1d20${skillModifier > 0 ? `+${skillModifier}` : skillModifier}`);
        if (rollResult && typeof rollResult === 'object' && 'individualValues' in rollResult) {
          const summary = rollResult as RollSummary;
          const roll = summary.individualValues[0] || 1; // Get the d20 result
          const isCrit = roll === 20;
          
          showAttackRoll(
            SKILL_NAMES[skillName],
            roll,
            skillModifier,
            isCrit
          );
          return;
        }
      } catch (error) {
        console.warn('Dice animation failed, falling back to random roll:', error);
      }
    }
    
    // Fallback to random roll if animation fails or isn't available
    const roll = Math.floor(Math.random() * 20) + 1;
    const isCrit = roll === 20;
    
    showAttackRoll(
      SKILL_NAMES[skillName],
      roll,
      skillModifier,
      isCrit
    );
  };

  // Roll ability check
  const rollAbilityCheck = async (ability: AbilityName) => {
    const abilityModifier = getAbilityModifier(ability);
    
    // Roll 3D dice and use actual result
    if (diceBoxInitialized) {
      try {
        const rollResult = await rollDice(`1d20${abilityModifier > 0 ? `+${abilityModifier}` : abilityModifier}`);
        if (rollResult && typeof rollResult === 'object' && 'individualValues' in rollResult) {
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
        console.warn('Dice animation failed, falling back to random roll:', error);
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
        const rollResult = await rollDice(`1d20${initiativeModifier > 0 ? `+${initiativeModifier}` : initiativeModifier}`);
        if (rollResult && typeof rollResult === 'object' && 'individualValues' in rollResult) {
          const summary = rollResult as RollSummary;
          const roll = summary.individualValues[0] || 1; // Get the d20 result
          const isCrit = roll === 20;
          
          showAttackRoll(
            'Initiative',
            roll,
            initiativeModifier,
            isCrit
          );
          return;
        }
      } catch (error) {
        console.warn('Dice animation failed, falling back to random roll:', error);
      }
    }
    
    // Fallback to random roll if animation fails or isn't available
    const roll = Math.floor(Math.random() * 20) + 1;
    const isCrit = roll === 20;
    
    showAttackRoll(
      'Initiative',
      roll,
      initiativeModifier,
      isCrit
    );
  };

  // Check if character has spell capabilities
  const characterHasSpells = hasSpellSlots(character.spellSlots, character.pactMagic);

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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 relative">
      
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
        onUpdateName={(name) => updateCharacter({ name })}
        onAddToast={addToast}
      />

      <div className="p-4">
      {/* Main Dice Container */}
      <div 
        id="main-dice-container" 
        className="fixed inset-0 pointer-events-none z-[9999]"
        style={{ 
          width: '100vw', 
          height: '100vh',
          top: 0,
          left: 0
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
      


      {/* Features Navigation Section */}
      <FeaturesNavigationSection />

      {/* Experimental Features Section */}
      <ExperimentalFeaturesSection />

      {/* Main Character Sheet */}
      <main className="max-w-7xl mx-auto space-y-8 relative z-20">
        
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
          <div className="h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent w-full max-w-md"></div>
          <span className="px-4 text-gray-500 font-medium">Core Stats</span>
          <div className="h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent w-full max-w-md"></div>
        </div>
        
        {/* Core D&D Stats Section */}
        <section className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-300 shadow-lg backdrop-blur-sm">
          <h2 className="text-2xl font-bold text-blue-900 mb-6 text-center border-b-2 border-blue-400 pb-3">
            📊 Character Statistics
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column - Basic Info & Ability Scores */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Basic Character Information */}
            <CharacterBasicInfo
              race={character.race}
              characterClass={character.class}
              level={character.level}
              background={character.background}
              playerName={character.playerName}
              alignment={character.alignment}
              onUpdateRace={(race) => updateCharacter({ race })}
              onUpdateClass={updateClass}
              onUpdateLevel={updateLevel}
              onUpdateBackground={(background) => updateCharacter({ background })}
              onUpdatePlayerName={(playerName) => updateCharacter({ playerName })}
              onUpdateAlignment={(alignment) => updateCharacter({ alignment })}
            />

            {/* Ability Scores */}
            <AbilityScores
              abilities={character.abilities}
              characterLevel={character.level}
              onUpdateAbilityScore={updateAbilityScore}
              onRollAbilityCheck={rollAbilityCheck}
            />

            {/* Hit Dice */}
            <ErrorBoundary fallback={
              <div className="bg-white rounded-lg shadow border border-purple-200 p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Hit Dice</h3>
                <p className="text-gray-500">Unable to load hit dice manager</p>
              </div>
            }>
              <HitDiceManager
                classInfo={character.class}
                level={character.level}
                hitDice={character.hitDice}
                onUpdateClass={updateClass}
                onUpdateHitDice={(hitDice) => updateCharacter({ hitDice })}
              />
            </ErrorBoundary>

            {/* Weapon Proficiencies */}
            <ErrorBoundary fallback={
              <div className="bg-white rounded-lg shadow border border-amber-200 p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Weapon Proficiencies</h3>
                <p className="text-gray-500">Unable to load weapon proficiencies</p>
              </div>
            }>
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
            {hasHydrated && (character.conditionsAndDiseases?.activeConditions?.length > 0 || character.conditionsAndDiseases?.activeDiseases?.length > 0) && (
              <div className="bg-white rounded-lg shadow border border-red-200 p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <span className="text-red-600">🤒</span>
                  Active Conditions & Diseases
                  <button
                    onClick={() => tabsRef.current?.switchToTab('conditions')}
                    className="ml-auto text-xs text-blue-600 hover:text-blue-800"
                  >
                    Manage →
                  </button>
                </h3>
                <div className="space-y-1">
                  {character.conditionsAndDiseases?.activeConditions?.map?.(condition => (
                    <div key={condition.id} className="text-xs text-red-700 flex items-center justify-between">
                      <span>
                        {condition.name}
                        {condition.stackable && condition.count > 1 && ` (Level ${condition.count})`}
                      </span>
                      <span className="text-gray-500">{condition.source}</span>
                    </div>
                  ))}
                  {character.conditionsAndDiseases?.activeDiseases?.map?.(disease => (
                    <div key={disease.id} className="text-xs text-purple-700 flex items-center justify-between">
                      <span>{disease.name}</span>
                      <span className="text-gray-500">{disease.source}</span>
                    </div>
                  ))}
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
          <div className="lg:col-span-4 space-y-6">
            
            {/* Saving Throws */}
            <SavingThrows
              savingThrows={character.savingThrows}
              getSavingThrowModifier={getSavingThrowModifier}
              onUpdateSavingThrowProficiency={updateSavingThrowProficiency}
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
            <div className="bg-white rounded-lg shadow-lg border border-amber-200 p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">
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
          <div className="lg:col-span-4 space-y-6">
            
            {/* Combat Stats */}
            <div className="bg-white rounded-lg shadow-lg border border-amber-200 p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">
                Combat Stats
              </h2>
              
              {/* Armor Class */}
              <ArmorClassManager
                character={character}
                onUpdateArmorClass={(ac) => updateCharacter({ armorClass: ac })}
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
                onUpdateSpeed={(speed) => updateCharacter({ speed })}
                onToggleReaction={toggleReaction}
                onResetReaction={resetReaction}
                onRollInitiative={rollInitiative}
              />

              {/* Hit Points - Now using comprehensive HP Manager */}
              <div className="mb-6">
                <ErrorBoundary fallback={
                  <div className="bg-white rounded-lg shadow-lg border border-red-200 p-6">
                    <h3 className="text-lg font-bold text-red-800 mb-4">Hit Points</h3>
                    <p className="text-gray-500">Unable to load HP manager</p>
                  </div>
                }>
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
                onPactMagicChange={character.pactMagic ? updatePactMagicSlot : undefined}
                onResetSpellSlots={resetSpellSlots}
                onResetPactMagic={character.pactMagic ? resetPactMagicSlots : undefined}
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

        {/* Grouped Tabbed Interface for Additional Sections */}
        <section className="mt-8">
          <GroupedTabs
            defaultTab="spellcasting"
            className="w-full"
            groups={[
              {
                id: 'combat-magic',
                label: 'Combat & Magic',
                icon: '⚔️',
                defaultOpen: true,
                tabs: [
                  {
                    id: 'spellcasting',
                    label: 'Spellcasting',
                    icon: '✨',
                    content: (
                      <TabContent>
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                          {/* Spellcasting Statistics */}
                          <ErrorBoundary fallback={
                            <div className="bg-white rounded-lg shadow border border-purple-200 p-4">
                              <h3 className="text-lg font-bold text-purple-800 mb-4">Spellcasting Stats</h3>
                              <p className="text-gray-500">Unable to load spellcasting statistics</p>
                            </div>
                          }>
                            <SpellcastingStats />
                          </ErrorBoundary>

                          {/* Spell Management */}
                          <ErrorBoundary fallback={
                            <div className="bg-white rounded-lg shadow border border-purple-200 p-4">
                              <h3 className="text-lg font-bold text-purple-800 mb-4">Spells & Cantrips</h3>
                              <p className="text-gray-500">Unable to load spell management</p>
                            </div>
                          }>
                            <SpellManagement />
                          </ErrorBoundary>
                        </div>
                      </TabContent>
                    )
                  },
                  {
                    id: 'equipment',
                    label: 'Equipment',
                    icon: '🛡️',
                    content: (
                      <TabContent>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Weapons */}
                          <ErrorBoundary fallback={
                            <div className="bg-white rounded-lg shadow border border-purple-200 p-4">
                              <h3 className="text-lg font-bold text-purple-800 mb-4 flex items-center gap-2">
                                <span className="text-red-600">⚔️</span>
                                Weapons
                              </h3>
                              <p className="text-gray-500">Unable to load weapon inventory</p>
                            </div>
                          }>
                            <WeaponInventory />
                          </ErrorBoundary>

                          {/* Armor & Defense */}
                          <ErrorBoundary fallback={
                            <div className="bg-white rounded-lg shadow border border-purple-200 p-4">
                              <h3 className="text-lg font-bold text-purple-800 mb-4 flex items-center gap-2">
                                <span className="text-blue-600">🛡️</span>
                                Armor & Defense
                              </h3>
                              <p className="text-gray-500">Unable to load armor management</p>
                            </div>
                          }>
                            <ArmorDefenseManager />
                          </ErrorBoundary>
                        </div>
                      </TabContent>
                    )
                  },
                  {
                    id: 'conditions',
                    label: 'Conditions & Diseases',
                    icon: '🤒',
                    content: (
                      <TabContent>
                        <ErrorBoundary fallback={
                          <div className="bg-white rounded-lg shadow-lg border border-red-200 p-6">
                            <h3 className="text-lg font-bold text-red-800 mb-4">Conditions & Diseases</h3>
                            <p className="text-gray-500">Unable to load conditions and diseases manager</p>
                          </div>
                        }>
                          {hasHydrated ? (
                            <ConditionsDiseasesManager />
                          ) : (
                            <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6">
                              <div className="text-center py-4">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                                <p className="mt-2 text-gray-600">Loading conditions and diseases...</p>
                              </div>
                            </div>
                          )}
                        </ErrorBoundary>
                      </TabContent>
                    )
                  }
                ]
              },
              {
                id: 'items-wealth',
                label: 'Items & Wealth',
                icon: '💰',
                defaultOpen: false,
                tabs: [
                  {
                    id: 'inventory',
                    label: 'Inventory',
                    icon: '🎒',
                    content: (
                      <TabContent>
                        <div className="max-w-none">
                          <ErrorBoundary fallback={
                            <div className="bg-white rounded-lg shadow-lg border border-purple-200 p-6">
                              <h3 className="text-lg font-bold text-purple-800 mb-4">Inventory</h3>
                              <p className="text-gray-500">Unable to load inventory management</p>
                            </div>
                          }>
                            <InventoryManager />
                          </ErrorBoundary>
                        </div>
                      </TabContent>
                    )
                  },
                  {
                    id: 'currency',
                    label: 'Currency',
                    icon: '💰',
                    content: (
                      <TabContent>
                        <div className="max-w-4xl mx-auto">
                          <ErrorBoundary fallback={
                            <div className="bg-white rounded-lg shadow-lg border border-yellow-200 p-6">
                              <h3 className="text-lg font-bold text-amber-800 mb-4">Currency</h3>
                              <p className="text-gray-500">Unable to load currency management</p>
                            </div>
                          }>
                            <CurrencyManager />
                          </ErrorBoundary>
                        </div>
                      </TabContent>
                    )
                  }
                ]
              },
              {
                id: 'character-story',
                label: 'Character & Story',
                icon: '📖',
                defaultOpen: false,
                tabs: [
                  {
                    id: 'character-details',
                    label: 'Character Details',
                    icon: '📜',
                    content: (
                      <TabContent>
                        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-2 gap-6">
                          {/* Features */}
                          <ErrorBoundary fallback={
                            <div className="bg-white rounded-lg shadow-lg border border-amber-200 p-6">
                              <h3 className="text-lg font-bold text-amber-800 mb-4">Features</h3>
                              <p className="text-gray-500">Unable to load features editor</p>
                            </div>
                          }>
                            <FeaturesTraitsManager
                              items={character.features}
                              category="feature"
                              onAdd={addFeature}
                              onUpdate={updateFeature}
                              onDelete={deleteFeature}
                            />
                          </ErrorBoundary>

                          {/* Traits */}
                          <ErrorBoundary fallback={
                            <div className="bg-white rounded-lg shadow-lg border border-emerald-200 p-6">
                              <h3 className="text-lg font-bold text-emerald-800 mb-4">Traits</h3>
                              <p className="text-gray-500">Unable to load traits editor</p>
                            </div>
                          }>
                            <FeaturesTraitsManager
                              items={character.traits}
                              category="trait"
                              onAdd={addTrait}
                              onUpdate={updateTrait}
                              onDelete={deleteTrait}
                            />
                          </ErrorBoundary>

                          {/* Character Background - Full Width */}
                          <div className="lg:col-span-2">
                            <ErrorBoundary fallback={
                              <div className="bg-white rounded-lg shadow-lg border border-emerald-200 p-6">
                                <h3 className="text-lg font-bold text-emerald-800 mb-4">Character Background</h3>
                                <p className="text-gray-500">Unable to load background editor</p>
                              </div>
                            }>
                              <CharacterBackgroundEditor
                                background={character.characterBackground}
                                onChange={updateCharacterBackground}
                              />
                            </ErrorBoundary>
                          </div>
                        </div>
                      </TabContent>
                    )
                  },
                  {
                    id: 'notes',
                    label: 'Session Notes',
                    icon: '📝',
                    content: (
                      <TabContent>
                        <div className="max-w-none">
                          <ErrorBoundary fallback={
                            <div className="bg-white rounded-lg shadow-lg border border-blue-200 p-6">
                              <h3 className="text-lg font-bold text-blue-800 mb-4">Notes</h3>
                              <p className="text-gray-500">Unable to load notes editor</p>
                            </div>
                          }>
                            <NotesManager
                              items={character.notes}
                              onAdd={addNote}
                              onUpdate={updateNote}
                              onDelete={deleteNote}
                              onReorder={reorderNotes}
                            />
                          </ErrorBoundary>
                        </div>
                      </TabContent>
                    )
                  }
                ]
              }
            ]}
            ref={tabsRef}
          />
        </section>
      </main>
      
      {/* Toast Notifications */}
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
      </div> {/* Close p-4 div */}
      </div> {/* Close main div */}
    </NavigationContext.Provider>
    </ErrorBoundary>
  );
}
