'use client';

import { Save, Download, Upload, RotateCcw } from "lucide-react";
import { useCharacterStore } from "@/store/characterStore";
import { useAutoSave } from "@/hooks/useAutoSave";
import { SaveIndicator } from "@/components/ui/SaveIndicator";
import ClassSelector from "@/components/ui/ClassSelector";
import SpellSlotTracker from "@/components/ui/SpellSlotTracker";
import XPTracker from "@/components/ui/XPTracker";
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
  hasSpellSlots
} from "@/utils/calculations";
import { 
  exportCharacterToFile, 
  importCharacterFromFile 
} from "@/utils/fileOperations";
import { AbilityName, SkillName } from "@/types/character";
import { useEffect } from "react";

export default function CharacterSheet() {
  // Zustand store
  const {
    character,
    saveStatus,
    lastSaved,
    hasUnsavedChanges,
    updateCharacter,
    updateAbilityScore,
    updateSkillProficiency,
    updateSavingThrowProficiency,
    updateHitPoints,
    updateInitiative,
    resetInitiativeToDefault,
    updateClass,
    updateLevel,
    updateSpellSlot,
    updatePactMagicSlot,
    resetSpellSlots,
    resetPactMagicSlots,
    addExperience,
    setExperience,
    exportCharacter,
    importCharacter
  } = useCharacterStore();

  // Auto-save functionality
  const { manualSave } = useAutoSave();

  // Calculate derived values
  const proficiencyBonus = getProficiencyBonus(character.level);
  
  // Helper function to get ability modifier
  const getAbilityModifier = (ability: AbilityName) => {
    return calculateModifier(character.abilities[ability]);
  };

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

  // Auto-update initiative when dexterity changes (if not overridden)
  useEffect(() => {
    if (!character.initiative.isOverridden) {
      const dexModifier = getAbilityModifier('dexterity');
      if (character.initiative.value !== dexModifier) {
        updateInitiative(dexModifier, false);
      }
    }
  }, [character.abilities.dexterity, character.initiative.isOverridden, character.initiative.value, updateInitiative]);

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
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-yellow-50 p-4">
      {/* Header with Character Name and Actions */}
      <header className="max-w-7xl mx-auto mb-8">
        <div className="bg-white rounded-lg shadow-lg border border-amber-200 p-6">
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
                className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                <Save size={16} />
                Save
              </button>
              <button 
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <Download size={16} />
                Export
              </button>
              <button 
                onClick={handleImport}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <Upload size={16} />
                Import
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Character Sheet */}
      <main className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column - Basic Info & Ability Scores */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Basic Character Information */}
            <div className="bg-white rounded-lg shadow-lg border border-amber-200 p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">
                Character Information
              </h2>
              <div className="grid grid-cols-2 gap-4">
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
              <div className="grid grid-cols-2 gap-4">
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
                    <span className="text-sm text-gray-800">{ABILITY_NAMES[ability]}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Skills */}
            <div className="bg-white rounded-lg shadow-lg border border-amber-200 p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">
                Skills
              </h2>
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {(Object.keys(SKILL_NAMES) as SkillName[]).map((skillName) => (
                  <div key={skillName} className="flex items-center gap-3 p-1 hover:bg-green-50 rounded text-sm transition-colors">
                    <input 
                      type="checkbox" 
                      checked={character.skills[skillName].proficient}
                      onChange={(e) => updateSkillProficiency(skillName, e.target.checked)}
                      className="w-4 h-4 text-green-600 rounded" 
                    />
                    <span className="font-mono font-semibold w-8 text-right text-green-800">
                      {formatModifier(getSkillModifier(skillName))}
                    </span>
                    <span className="flex-1 text-gray-800">{SKILL_NAMES[skillName]}</span>
                    <span className="text-xs text-gray-500 w-8">
                      {ABILITY_ABBREVIATIONS[SKILL_ABILITY_MAP[skillName]]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - Combat Stats & Features */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Combat Stats */}
            <div className="bg-white rounded-lg shadow-lg border border-amber-200 p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">
                Combat Stats
              </h2>
              
              {/* AC, Initiative, Speed */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center">
                  <div className="bg-red-50 border-2 border-red-200 rounded-lg p-3 h-20 flex flex-col justify-center">
                    <div className="text-xs font-medium text-red-700 mb-1">ARMOR CLASS</div>
                    <input
                      type="number"
                      value={character.armorClass}
                      onChange={(e) => updateCharacter({ armorClass: parseInt(e.target.value) || 10 })}
                      className="text-xl font-bold text-red-800 bg-transparent border-none outline-none text-center w-full"
                    />
                  </div>
                </div>
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

              {/* Hit Points */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Hit Points</label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Current</label>
                    <input 
                      type="number" 
                      value={character.hitPoints.current}
                      onChange={(e) => updateHitPoints({ current: parseInt(e.target.value) || 0 })}
                      className="w-full p-2 text-center border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Max</label>
                    <input 
                      type="number" 
                      value={character.hitPoints.max}
                      onChange={(e) => updateHitPoints({ max: parseInt(e.target.value) || 0 })}
                      className="w-full p-2 text-center border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 focus:border-transparent text-gray-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Temp</label>
                    <input 
                      type="number" 
                      value={character.hitPoints.temporary}
                      onChange={(e) => updateHitPoints({ temporary: parseInt(e.target.value) || 0 })}
                      className="w-full p-2 text-center border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-800"
                    />
                  </div>
                </div>
              </div>

              {/* Hit Dice */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Hit Dice</label>
                <input 
                  type="text" 
                  value={character.hitDice}
                  onChange={(e) => updateCharacter({ hitDice: e.target.value })}
                  className="w-full p-2 text-center border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent text-gray-800"
                />
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

            {/* Features & Traits */}
            <div className="bg-white rounded-lg shadow-lg border border-amber-200 p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">
                Features & Traits
              </h2>
              <div className="space-y-3">
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
                  <div className="font-medium text-sm text-amber-900">Fighting Style</div>
                  <div className="text-xs text-amber-700 mt-1">Choose a fighting style that suits your combat approach.</div>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
                  <div className="font-medium text-sm text-amber-900">Second Wind</div>
                  <div className="text-xs text-amber-700 mt-1">Regain hit points as a bonus action.</div>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-white rounded-lg shadow-lg border border-amber-200 p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-200 pb-2">
                Quick Stats
              </h2>
              <XPTracker
                currentXP={character.experience}
                currentLevel={character.level}
                onAddXP={addExperience}
                onSetXP={setExperience}
              />
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
      </main>
    </div>
  );
}
