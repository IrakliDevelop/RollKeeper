'use client';

import { Save, Download, Upload, RotateCcw } from "lucide-react";
import { useCharacterStore } from "@/store/characterStore";
import { useAutoSave } from "@/hooks/useAutoSave";
import { SaveIndicator } from "@/components/ui/SaveIndicator";
import ClassSelector from "@/components/ui/ClassSelector";
import SpellSlotTracker from "@/components/ui/SpellSlotTracker";
import TraitTracker from "@/components/ui/TraitTracker";
import HeroicInspirationTracker from "@/components/ui/HeroicInspirationTracker";
import XPTracker from "@/components/ui/XPTracker";
import FeaturesTraitsManager from "@/components/ui/FeaturesTraitsManager";
import NotesManager from "@/components/ui/NotesManager";
import CharacterBackgroundEditor from "@/components/ui/CharacterBackgroundEditor";
import HitPointManager from "@/components/ui/HitPointManager";
import HitDiceManager from "@/components/ui/HitDiceManager";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import { WeaponInventory } from "@/components/WeaponInventory";
import { EquippedWeapons } from "@/components/EquippedWeapons";
import { WeaponProficiencies } from "@/components/WeaponProficiencies";
import { SpellcastingStats } from "@/components/SpellcastingStats";
import { SpellManagement } from "@/components/SpellManagement";
import { QuickSpells } from "@/components/QuickSpells";
import { ToastContainer, useToast } from "@/components/ui/Toast";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { 
  ABILITY_ABBREVIATIONS, 
  ABILITY_NAMES, 
  SKILL_NAMES, 
  SKILL_ABILITY_MAP, 
  ALIGNMENTS 
} from "@/utils/constants";
import { 
  calculateModifier, 
  getProficiencyBonus, 
  formatModifier,
  hasSpellSlots,
  calculateCharacterArmorClass
} from "@/utils/calculations";
import { 
  exportCharacterToFile, 
  importCharacterFromFile 
} from "@/utils/fileOperations";
import { AbilityName, SkillName } from "@/types/character";
import { useCallback, useEffect, useState } from "react";

export default function CharacterSheet() {
  // Toast system
  const { toasts, dismissToast, showAttackRoll, showSavingThrow, showDamageRoll } = useToast();
  
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
    addTrackableTrait,
    updateTrackableTrait,
    deleteTrackableTrait,
    useTrackableTrait,
    resetTrackableTraits,
    updateCharacterBackground,
    exportCharacter,
    importCharacter,
    resetCharacter,
    addHeroicInspiration,
    updateHeroicInspiration,
    useHeroicInspiration,
    resetHeroicInspiration,
    toggleReaction,
    resetReaction,
    updateTempArmorClass,
    toggleShield,
    resetTempArmorClass,
    updateShieldBonus
  } = useCharacterStore();

  // Modal state for character reset
  const [showResetModal, setShowResetModal] = useState(false);

  // Auto-save functionality
  const { manualSave } = useAutoSave();

  // Calculate derived values
  const proficiencyBonus = getProficiencyBonus(character.level);
  
  // Helper function to get ability modifier
  const getAbilityModifier = useCallback((ability: AbilityName) => {
    return calculateModifier(character.abilities[ability]);
  }, [character.abilities]);

  // Helper function to get skill modifier
  const getSkillModifier = (skillName: SkillName) => {
    const skill = character.skills[skillName];
    const relatedAbility = SKILL_ABILITY_MAP[skillName];
    const abilityModifier = getAbilityModifier(relatedAbility);
    
    let modifier = abilityModifier;
    if (skill.proficient) modifier += proficiencyBonus;
    if (skill.expertise && skill.proficient) modifier += proficiencyBonus;
    if (skill.customModifier) modifier += skill.customModifier;
    
    return modifier;
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
  const rollSavingThrow = (ability: AbilityName) => {
    const roll = Math.floor(Math.random() * 20) + 1;
    const modifier = getSavingThrowModifier(ability);
    const isCrit = roll === 20;
    
    // Use showAttackRoll since it's more appropriate for displaying dice rolls
    showAttackRoll(
      `${ABILITY_NAMES[ability]} Save`,
      roll,
      modifier,
      isCrit
    );
  };

  // Roll skill check
  const rollSkillCheck = (skillName: SkillName) => {
    const roll = Math.floor(Math.random() * 20) + 1;
    const modifier = getSkillModifier(skillName);
    const isCrit = roll === 20;
    
    showAttackRoll(
      SKILL_NAMES[skillName],
      roll,
      modifier,
      isCrit
    );
  };

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

  // Import functionality
  const handleImport = async () => {
    try {
      const importData = await importCharacterFromFile();
      const success = importCharacter(importData);
      
      if (success) {
        alert('Character imported successfully!');
      } else {
        alert('Failed to import character. Please check the file format.');
      }
    } catch (error) {
      console.error('Import failed:', error);
      if (error instanceof Error) {
        alert(`Import failed: ${error.message}`);
      } else {
        alert('Failed to import character. Please try again.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4">
      {/* Header with Character Name and Actions */}
      <header className="max-w-7xl mx-auto mb-8">
        <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-xl border border-slate-200 p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Character Name"
                value={character.name}
                onChange={(e) => updateCharacter({ name: e.target.value })}
                className="text-3xl font-bold bg-transparent border-none outline-none placeholder-gray-400 text-gray-800 w-full"
              />
              <SaveIndicator 
                status={saveStatus}
                lastSaved={lastSaved}
                hasUnsavedChanges={hasUnsavedChanges}
                className="mt-1"
              />
            </div>
            <div className="flex gap-2">
              <button 
                onClick={manualSave}
                disabled={!hasUnsavedChanges}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-lg hover:from-emerald-700 hover:to-emerald-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all shadow-md"
              >
                <Save size={16} />
                Save
              </button>
              <button 
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-gradient-to-r from-slate-600 to-slate-700 text-white rounded-lg hover:from-slate-700 hover:to-slate-800 transition-all shadow-md"
              >
                <Download size={16} />
                Export
              </button>
              <button 
                onClick={handleImport}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-gradient-to-r from-slate-600 to-slate-700 text-white rounded-lg hover:from-slate-700 hover:to-slate-800 transition-all shadow-md"
              >
                <Upload size={16} />
                Import
              </button>
              <button 
                onClick={() => setShowResetModal(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-all shadow-md"
                title="Reset character - this will clear all data!"
              >
                <RotateCcw size={16} />
                Reset
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Character Sheet */}
      <main className="max-w-7xl mx-auto space-y-8">
        
        {/* Actions Section */}
        <section className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl p-6 border-2 border-slate-300 shadow-lg backdrop-blur-sm">
          <h2 className="text-2xl font-bold text-slate-800 mb-6 text-center border-b-2 border-slate-400 pb-3">
            ⚔️ Actions & Combat
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Attack Actions */}
            <ErrorBoundary fallback={
              <div className="bg-white rounded-lg shadow border border-blue-200 p-4">
                <h3 className="text-lg font-bold text-blue-800 mb-4 flex items-center gap-2">
                  <span className="text-red-600">⚔️</span>
                  Ready Weapons
                </h3>
                <p className="text-gray-500">Unable to load equipped weapons</p>
              </div>
            }>
              <EquippedWeapons showAttackRoll={showAttackRoll} showDamageRoll={showDamageRoll} />
            </ErrorBoundary>

            {/* Cantrips & Spells */}
            <ErrorBoundary fallback={
              <div className="bg-white rounded-lg shadow border border-blue-200 p-4">
                <h3 className="text-lg font-bold text-blue-800 mb-4 flex items-center gap-2">
                  <span className="text-purple-600">✨</span>
                  Quick Spells
                </h3>
                <p className="text-gray-500">Unable to load quick spells</p>
              </div>
            }>
              <div className="bg-white rounded-lg shadow border border-blue-200 p-4">
                <h3 className="text-lg font-bold text-blue-800 mb-4 flex items-center gap-2">
                  <span className="text-purple-600">✨</span>
                  Quick Spells
                </h3>
                <QuickSpells showAttackRoll={showAttackRoll} showSavingThrow={showSavingThrow} showDamageRoll={showDamageRoll} />
                <div className="mt-4 pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-500 text-center">
                    Manage spells in the{' '}
                    <button
                      onClick={() => {
                        const spellcastingSection = document.getElementById('spellcasting-section');
                        if (spellcastingSection) {
                          spellcastingSection.scrollIntoView({ 
                            behavior: 'smooth',
                            block: 'start'
                          });
                        }
                      }}
                      className="text-purple-600 hover:text-purple-800 underline hover:no-underline transition-colors font-semibold"
                    >
                      Spellcasting section
                    </button>.
                  </p>
                </div>
              </div>
            </ErrorBoundary>
          </div>
        </section>

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
            <div className="bg-white rounded-lg shadow-lg border border-amber-200 p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">
                Character Information
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Race</label>
                  <input 
                    type="text" 
                    placeholder="Human"
                    value={character.race}
                    onChange={(e) => updateCharacter({ race: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-400"
                  />
                </div>
                <ClassSelector
                  value={character.class}
                  onChange={updateClass}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Level</label>
                  <input 
                    type="number" 
                    placeholder="1"
                    min="1" 
                    max="20"
                    value={character.level}
                    onChange={(e) => updateLevel(parseInt(e.target.value) || 1)}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Background</label>
                  <input 
                    type="text" 
                    placeholder="Soldier"
                    value={character.background}
                    onChange={(e) => updateCharacter({ background: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Player Name</label>
                  <input 
                    type="text" 
                    placeholder="Your Name"
                    value={character.playerName}
                    onChange={(e) => updateCharacter({ playerName: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800 placeholder-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Alignment</label>
                  <select 
                    value={character.alignment}
                    onChange={(e) => updateCharacter({ alignment: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800"
                  >
                    <option value="">Select...</option>
                    {ALIGNMENTS.map(alignment => (
                      <option key={alignment} value={alignment}>{alignment}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Ability Scores */}
            <div className="bg-white rounded-lg shadow-lg border border-amber-200 p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">
                Ability Scores
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-2 gap-3 sm:gap-4">
                {(Object.keys(ABILITY_ABBREVIATIONS) as AbilityName[]).map((ability) => (
                  <div key={ability} className="text-center">
                    <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 hover:border-blue-400 transition-colors">
                      <div className="font-bold text-sm text-blue-900 mb-2">
                        {ABILITY_ABBREVIATIONS[ability]}
                      </div>
                      <input 
                        type="number" 
                        value={character.abilities[ability]}
                        onChange={(e) => updateAbilityScore(ability, parseInt(e.target.value) || 10)}
                        min="1" 
                        max="30"
                        className="w-full text-2xl font-bold text-center bg-transparent border-none outline-none text-blue-900"
                      />
                      <div className="text-lg font-semibold text-blue-700 mt-1">
                        {formatModifier(getAbilityModifier(ability))}
                      </div>
                      <div className="text-xs text-blue-600">modifier</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-indigo-50 border border-indigo-200 rounded-md">
                <div className="text-sm font-medium text-indigo-900">
                  Proficiency Bonus: <span className="font-bold">{formatModifier(proficiencyBonus)}</span>
                </div>
              </div>
            </div>

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

          </div>

          {/* Middle Column - Skills & Saving Throws */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Saving Throws */}
            <div className="bg-white rounded-lg shadow-lg border border-amber-200 p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">
                Saving Throws
              </h2>
              <div className="space-y-2">
                {(Object.keys(ABILITY_NAMES) as AbilityName[]).map((ability) => (
                  <div key={ability} className="flex items-center gap-3 p-2 hover:bg-purple-50 rounded transition-colors">
                    <input 
                      type="checkbox" 
                      checked={character.savingThrows[ability].proficient}
                      onChange={(e) => updateSavingThrowProficiency(ability, e.target.checked)}
                      className="w-4 h-4 text-purple-600 rounded" 
                    />
                    <span className="font-mono text-sm font-semibold w-8 text-right text-purple-800">
                      {formatModifier(getSavingThrowModifier(ability))}
                    </span>
                    <button
                      onClick={() => rollSavingThrow(ability)}
                      className="text-sm text-gray-800 hover:text-purple-700 hover:bg-purple-100 px-2 py-1 rounded transition-colors cursor-pointer font-medium"
                      title={`Roll ${ABILITY_NAMES[ability]} saving throw (d20 + ${formatModifier(getSavingThrowModifier(ability))})`}
                    >
                      {ABILITY_NAMES[ability]}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Skills */}
            <div className="bg-white rounded-lg shadow-lg border border-amber-200 p-6 flex flex-col">
              <h2 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">
                Skills
              </h2>
              
              {/* Skills Legend */}
              <div className="flex items-center gap-4 mb-3 text-xs text-gray-600 bg-gray-50 p-2 rounded">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-green-600 rounded"></div>
                  <span>P = Proficient ({formatModifier(proficiencyBonus)})</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 bg-yellow-600 rounded"></div>
                  <span>E = Expertise ({formatModifier(proficiencyBonus * 2)})</span>
                </div>
              </div>
              
              <div className="space-y-1 flex-1 min-h-0 max-h-[40vh] lg:max-h-[60vh] xl:max-h-none overflow-y-auto border border-gray-100 rounded-lg p-2 bg-gradient-to-b from-white to-gray-50">
                {(Object.keys(SKILL_NAMES) as SkillName[]).map((skillName) => {
                  const skill = character.skills[skillName];
                  const isProficient = skill.proficient;
                  const hasExpertise = skill.expertise;
                  
                  return (
                    <div key={skillName} className="flex items-center gap-2 p-1 hover:bg-green-50 rounded text-sm transition-colors">
                      {/* Proficiency Checkbox */}
                      <div className="flex flex-col items-center">
                        <input 
                          type="checkbox" 
                          checked={isProficient}
                          onChange={(e) => {
                            updateSkillProficiency(skillName, e.target.checked);
                            // Remove expertise if proficiency is removed
                            if (!e.target.checked && hasExpertise) {
                              updateSkillExpertise(skillName, false);
                            }
                          }}
                          className="w-4 h-4 text-green-600 rounded" 
                          title="Proficient"
                        />
                        <span className="text-xs text-gray-500 mt-0.5">P</span>
                      </div>
                      
                      {/* Expertise Checkbox */}
                      <div className="flex flex-col items-center">
                        <input 
                          type="checkbox" 
                          checked={hasExpertise && isProficient}
                          onChange={(e) => updateSkillExpertise(skillName, e.target.checked)}
                          disabled={!isProficient}
                          className={`w-4 h-4 rounded ${
                            isProficient 
                              ? 'text-yellow-600 focus:ring-yellow-500' 
                              : 'text-gray-300 cursor-not-allowed'
                          }`}
                          title="Expertise (Double Proficiency)"
                        />
                        <span className={`text-xs mt-0.5 ${
                          isProficient ? 'text-yellow-600' : 'text-gray-300'
                        }`}>E</span>
                      </div>
                      
                      {/* Skill Modifier */}
                      <span className={`font-mono font-semibold w-10 text-right ${
                        hasExpertise && isProficient ? 'text-yellow-700' : 
                        isProficient ? 'text-green-800' : 'text-gray-600'
                      }`}>
                        {formatModifier(getSkillModifier(skillName))}
                      </span>
                      
                      {/* Skill Name */}
                      <button
                        onClick={() => rollSkillCheck(skillName)}
                        className="flex-1 text-left text-gray-800 hover:text-green-700 hover:bg-green-100 px-2 py-1 rounded transition-colors cursor-pointer font-medium"
                        title={`Roll ${SKILL_NAMES[skillName]} check (d20 + ${formatModifier(getSkillModifier(skillName))})`}
                      >
                        {SKILL_NAMES[skillName]}
                      </button>
                      
                      {/* Ability Abbreviation */}
                      <span className="text-xs text-gray-500 w-8">
                        {ABILITY_ABBREVIATIONS[SKILL_ABILITY_MAP[skillName]]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

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
              
              {/* Armor Class - Full Width Row */}
              <div className="mb-6">
                <div className="bg-gradient-to-r from-red-50 to-red-100 border-2 border-red-200 rounded-xl p-6">
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-bold text-red-800 mb-3 flex items-center justify-center gap-2">
                      🛡️ ARMOR CLASS
                    </h3>
                    <div className="text-5xl font-bold text-red-900 mb-2">
                      {calculateCharacterArmorClass(character)}
                    </div>
                    <div className="text-base text-red-700 font-medium">Total AC</div>
                  </div>
                  
                  {/* AC Components - Row Layout */}
                  <div className="space-y-4 mb-6">
                    {/* Base AC Row */}
                    <div className="bg-white rounded-lg border-2 border-red-300 p-4 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="text-lg font-bold text-red-800">Base AC</div>
                          <div className="text-sm text-red-600">From armor & dexterity</div>
                        </div>
                        <input
                          type="number"
                          value={character.armorClass}
                          onChange={(e) => updateCharacter({ armorClass: parseInt(e.target.value) || 10 })}
                          className="w-20 h-12 text-2xl font-bold text-center bg-red-50 border-2 border-red-300 rounded-lg text-red-900 focus:ring-2 focus:ring-red-500 focus:border-red-500"
                          min="0"
                          max="30"
                        />
                      </div>
                    </div>
                    
                    {/* Temporary AC Row */}
                    <div className="bg-white rounded-lg border-2 border-orange-300 p-4 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="text-lg font-bold text-orange-800">Temporary AC</div>
                          <div className="text-sm text-orange-600">From spells & effects</div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xl font-bold text-orange-700">+</span>
                            <input
                              type="number"
                              value={character.tempArmorClass}
                              onChange={(e) => updateTempArmorClass(parseInt(e.target.value) || 0)}
                              className="w-20 h-12 text-2xl font-bold text-center bg-orange-50 border-2 border-orange-300 rounded-lg text-orange-900 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                              min="0"
                              max="20"
                            />
                          </div>
                          {character.tempArmorClass > 0 && (
                            <button
                              onClick={resetTempArmorClass}
                              className="px-3 py-1 text-xs text-orange-600 hover:text-orange-800 hover:bg-orange-50 border border-orange-300 rounded-md transition-colors"
                            >
                              Reset
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Shield Row */}
                    <div className="bg-white rounded-lg border-2 border-blue-300 p-4 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="text-lg font-bold text-blue-800">Shield</div>
                          <div className="text-sm text-blue-600">
                            {character.isWearingShield ? `+${character.shieldBonus} AC bonus` : 'Click to equip'}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={toggleShield}
                            className={`w-12 h-12 rounded-lg text-2xl transition-all duration-200 flex items-center justify-center ${
                              character.isWearingShield
                                ? 'bg-blue-600 text-white shadow-lg transform scale-105 border-2 border-blue-700'
                                : 'bg-blue-50 border-2 border-blue-300 text-blue-600 hover:bg-blue-100'
                            }`}
                            title={`${character.isWearingShield ? 'Unequip' : 'Equip'} shield`}
                          >
                            🛡️
                          </button>
                          
                          {character.isWearingShield && (
                            <div className="flex items-center gap-2">
                              <span className="text-xl font-bold text-blue-700">+</span>
                              <input
                                type="number"
                                value={character.shieldBonus}
                                onChange={(e) => updateShieldBonus(parseInt(e.target.value) || 2)}
                                className="w-16 h-10 text-lg font-bold text-center bg-blue-50 border-2 border-blue-300 rounded-lg text-blue-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                min="0"
                                max="5"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* AC Formula Display */}
                  <div className="text-center">
                    <div className="inline-flex items-center gap-3 px-6 py-3 bg-white rounded-lg border-2 border-red-300 text-lg font-medium text-red-800 shadow-sm">
                      <span className="text-xl font-bold">{character.armorClass}</span>
                      <span className="text-red-600 text-lg">+</span>
                      <span className="text-xl font-bold">{character.tempArmorClass}</span>
                      {character.isWearingShield && (
                        <>
                          <span className="text-red-600 text-lg">+</span>
                          <span className="text-xl font-bold">{character.shieldBonus}</span>
                        </>
                      )}
                      <span className="text-red-600 text-lg">=</span>
                      <span className="font-bold text-2xl text-red-900">{calculateCharacterArmorClass(character)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Initiative and Speed Row */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {/* Initiative */}
                  <div className="text-center">
                    <div className={`rounded-lg p-3 h-20 flex flex-col justify-center border-2 transition-colors ${
                      character.initiative.isOverridden 
                        ? 'bg-orange-50 border-orange-300' 
                        : 'bg-yellow-50 border-yellow-200'
                    }`}>
                      <div className="text-xs font-medium text-yellow-700 mb-1 flex items-center justify-center gap-1">
                        INITIATIVE
                        {character.initiative.isOverridden && (
                          <button
                            onClick={resetInitiativeToDefault}
                            className="text-orange-600 hover:text-orange-800 transition-colors"
                            title="Reset to DEX modifier"
                          >
                            <RotateCcw size={10} />
                          </button>
                        )}
                      </div>
                      <input
                        type="number"
                        value={getInitiativeModifier()}
                        onChange={(e) => updateInitiative(parseInt(e.target.value) || 0, true)}
                        className={`text-xl font-bold bg-transparent border-none outline-none text-center w-full ${
                          character.initiative.isOverridden ? 'text-orange-800' : 'text-yellow-800'
                        }`}
                        title={character.initiative.isOverridden ? 'Custom initiative (overridden)' : 'DEX modifier (auto-calculated)'}
                      />
                    </div>
                  </div>
                  
                  {/* Speed */}
                  <div className="text-center">
                    <div className="bg-green-50 border-2 border-green-200 rounded-lg p-3 h-20 flex flex-col justify-center">
                      <div className="text-xs font-medium text-green-700 mb-1">SPEED</div>
                      <input
                        type="number"
                        value={character.speed}
                        onChange={(e) => updateCharacter({ speed: parseInt(e.target.value) || 30 })}
                        className="text-xl font-bold text-green-800 bg-transparent border-none outline-none text-center w-full"
                      />
                    </div>
                  </div>
                </div>

              {/* Reaction Tracking */}
              <div className="mb-6">
                <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-bold text-purple-800">REACTION</div>
                      <div className="text-xs text-purple-600">
                        {character.reaction.hasUsedReaction ? 'Used this turn' : 'Available'}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={toggleReaction}
                        className={`
                          relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                          ${character.reaction.hasUsedReaction 
                            ? 'bg-red-600' 
                            : 'bg-green-600'
                          }
                        `}
                        title={character.reaction.hasUsedReaction ? 'Mark reaction as available' : 'Mark reaction as used'}
                      >
                        <span
                          className={`
                            inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                            ${character.reaction.hasUsedReaction ? 'translate-x-6' : 'translate-x-1'}
                          `}
                        />
                      </button>
                      
                      <button
                        onClick={resetReaction}
                        className="p-1 text-purple-600 hover:bg-purple-100 rounded transition-colors"
                        title="Reset reaction to available"
                      >
                        <RotateCcw size={14} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="mt-2 text-xs text-purple-700 bg-purple-100 rounded p-2">
                    <strong>Reaction:</strong> One reaction per turn - used for opportunity attacks, spells like Shield, or other triggered abilities.
                  </div>
                </div>
              </div>

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
              onAddTrait={addTrackableTrait}
              onUpdateTrait={updateTrackableTrait}
              onDeleteTrait={deleteTrackableTrait}
              onUseTrait={useTrackableTrait}
              onResetTraits={resetTrackableTraits}
            />

            {/* Heroic Inspiration */}
            <HeroicInspirationTracker
              inspiration={character.heroicInspiration}
              onAddInspiration={addHeroicInspiration}
              onUpdateInspiration={updateHeroicInspiration}
              onUseInspiration={useHeroicInspiration}
              onResetInspiration={resetHeroicInspiration}
            />

            {/* Quick Stats */}
            <div className="bg-white rounded-lg shadow-lg border border-amber-200 p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">
                Quick Stats
              </h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Passive Perception</span>
                  <span className="font-semibold text-gray-800">
                    {10 + getSkillModifier('perception')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Proficiency Bonus</span>
                  <span className="font-semibold text-gray-800">{formatModifier(proficiencyBonus)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        </section>

        {/* Section Divider */}
        <div className="flex items-center justify-center">
          <div className="h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent w-full max-w-md"></div>
          <span className="px-4 text-gray-500 font-medium">Spellcasting</span>
          <div className="h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent w-full max-w-md"></div>
        </div>

        {/* Spellcasting Section */}
        <section id="spellcasting-section" className="bg-gradient-to-r from-navy-50 to-indigo-100 rounded-xl p-6 border-2 border-navy-300 shadow-lg backdrop-blur-sm" style={{background: 'linear-gradient(to right, rgb(241 245 249), rgb(224 231 255))'}}>
          <h2 className="text-2xl font-bold text-navy-900 mb-6 text-center border-b-2 border-navy-400 pb-3" style={{color: 'rgb(15 23 42)', borderColor: 'rgb(71 85 105)'}}>
            ✨ Spellcasting
          </h2>
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
        </section>

        {/* Section Divider */}
        <div className="flex items-center justify-center">
          <div className="h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent w-full max-w-md"></div>
          <span className="px-4 text-gray-500 font-medium">Character Details</span>
          <div className="h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent w-full max-w-md"></div>
        </div>

        {/* Character Details Section */}
        <section className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-6 border-2 border-emerald-300 shadow-lg backdrop-blur-sm">
          <h2 className="text-2xl font-bold text-emerald-800 mb-6 text-center border-b-2 border-emerald-400 pb-3">
            📜 Character Details
          </h2>
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
        </section>

        {/* Section Divider */}
        <div className="flex items-center justify-center">
          <div className="h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent w-full max-w-md"></div>
          <span className="px-4 text-gray-500 font-medium">Session Notes</span>
          <div className="h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent w-full max-w-md"></div>
        </div>

        {/* Notes Section */}
        <section className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-300 shadow-lg backdrop-blur-sm">
          <h2 className="text-2xl font-bold text-blue-800 mb-6 text-center border-b-2 border-blue-400 pb-3">
            📝 Session Notes
          </h2>
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
              />
            </ErrorBoundary>
          </div>
        </section>

        {/* Section Divider */}
        <div className="flex items-center justify-center">
          <div className="h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent w-full max-w-md"></div>
          <span className="px-4 text-gray-500 font-medium">Equipment & Inventory</span>
          <div className="h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent w-full max-w-md"></div>
        </div>

        {/* Equipment Section */}
        <section id="equipment-section" className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-xl p-6 border-2 border-violet-300 shadow-lg backdrop-blur-sm">
          <h2 className="text-2xl font-bold text-violet-800 mb-6 text-center border-b-2 border-violet-400 pb-3">
            🎒 Equipment & Inventory
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            
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
            <div className="bg-white rounded-lg shadow border border-purple-200 p-4">
              <h3 className="text-lg font-bold text-purple-800 mb-4 flex items-center gap-2">
                <span className="text-blue-600">🛡️</span>
                Armor & Defense
              </h3>
              <div className="text-center py-6 text-gray-500">
                <p>Coming soon: Armor and shields</p>
                <p className="text-sm mt-1">Manage armor, AC calculations, and defenses.</p>
              </div>
            </div>

            {/* General Items */}
            <div className="bg-white rounded-lg shadow border border-purple-200 p-4 lg:col-span-2 xl:col-span-1">
              <h3 className="text-lg font-bold text-purple-800 mb-4 flex items-center gap-2">
                <span className="text-yellow-600">💰</span>
                Items & Currency
              </h3>
              <div className="text-center py-6 text-gray-500">
                <p>Coming soon: General inventory</p>
                <p className="text-sm mt-1">Track items, currency, and supplies.</p>
              </div>
            </div>
          </div>
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
    </div>
  );
}
