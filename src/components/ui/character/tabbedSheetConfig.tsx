import React, { useState } from 'react';
import { Angry } from 'lucide-react';
import ErrorBoundary from '@/components/ui/feedback/ErrorBoundary';
import { PlayerCalendarView } from '@/components/ui/calendar/PlayerCalendarView';
import ConditionsDiseasesManager from '@/components/ui/game/ConditionsDiseasesManager';
import TemporaryBuffsManager from '@/components/ui/game/TemporaryBuffsManager';
import DefensesAndSenses from '@/components/ui/game/DefensesAndSenses';
import CharacterBackgroundEditor from '@/components/ui/character/CharacterBackgroundEditor';
import FeaturesTraitsManager from '@/components/ui/game/FeaturesTraitsManager';
import NotesManager from '@/components/ui/game/NotesManager';
import InventoryManager from '@/components/ui/game/InventoryManager';
import CurrencyManager from '@/components/ui/game/CurrencyManager';
import { SpellcastingStats } from '@/components/SpellcastingStats';
import { SpellManagement } from '@/components/SpellManagement';
import { WeaponsTab } from '@/components/ui/character/equipment/WeaponsTab';
import { MagicItemsTab } from '@/components/ui/character/equipment/MagicItemsTab';
import { ArmorTab } from '@/components/ui/character/equipment/ArmorTab';
import ActionsSection from '@/components/ui/character/ActionsSection';
import CharacterBasicInfo from '@/components/ui/character/CharacterBasicInfo';
import AbilityScores from '@/components/ui/character/AbilityScores';
import SavingThrows from '@/components/ui/character/SavingThrows';
import Skills from '@/components/ui/character/Skills';
import QuickStats from '@/components/ui/character/QuickStats';
import XPTracker from '@/components/ui/character/XPTracker';
import SpellSlotTracker from '@/components/ui/character/SpellSlotTracker';
import ArmorClassManager from '@/components/ui/character/ArmorClassManager';
import CombatStats from '@/components/ui/character/CombatStats';
import HitPointManager from '@/components/ui/character/HitPointManager';
import HitDiceTracker from '@/components/ui/character/HitDiceTracker';
import { WeaponProficiencies } from '@/components/WeaponProficiencies';
import { ExtendedFeaturesSection } from '@/components/ui/character/ExtendedFeatures';
import ToolProficienciesSection from '@/components/ui/character/ToolProficienciesSection';
import TraitTracker from '@/components/ui/character/TraitTracker';
import HeroicInspirationTracker from '@/components/ui/character/HeroicInspirationTracker';
import Languages from '@/components/ui/character/LanguagesAndProficiencies';
import { SummonsSubTab } from '@/components/ui/character/summons';
import { ToastData } from '@/components/ui/feedback/Toast';
import type { BookmarkTabItem } from '@/components/ui/layout/BookmarkTabs';
import {
  calculateSpellAttackBonus,
  calculateCarryingCapacity,
  calculateSpellSaveDC,
} from '@/utils/calculations';
import { calculateTotalWeight } from '@/utils/encumbrance';
import {
  CharacterState,
  RichTextContent,
  CharacterBackground,
  ExtendedFeature,
  AbilityName,
  SkillName,
  ClassInfo,
  SpellSlots,
  HeroicInspiration,
  ToolProficiency,
  Language,
  Spell,
} from '@/types/character';

export interface TabbedSheetConfigParams {
  character: CharacterState;
  hasHydrated: boolean;
  totalLevel: number;
  proficiencyBonus: number;
  characterHasSpells: boolean;

  // Ability / skill / save handlers
  updateAbilityScore: (ability: AbilityName, score: number) => void;
  rollAbilityCheck: (ability: AbilityName) => void;
  getSavingThrowModifier: (ability: AbilityName) => number;
  updateSavingThrowProficiency: (
    ability: AbilityName,
    proficient: boolean
  ) => void;
  rollSavingThrow: (ability: AbilityName) => void;
  getSkillModifier: (skillName: SkillName) => number;
  updateSkillProficiency: (skill: SkillName, proficient: boolean) => void;
  updateSkillExpertise: (skill: SkillName, expertise: boolean) => void;
  toggleJackOfAllTrades: () => void;
  rollSkillCheck: (skillName: SkillName) => void;
  toggleSkillBonusAbility: (skill: SkillName, ability: AbilityName) => void;

  // Character info handlers
  updateCharacter: (updates: Partial<CharacterState>) => void;
  updateClass: (classInfo: ClassInfo) => void;
  updateLevel: (level: number) => void;
  addClassLevel: (
    className: string,
    isCustom?: boolean,
    spellcaster?: 'full' | 'half' | 'third' | 'warlock' | 'none',
    hitDie?: number,
    subclass?: string
  ) => void;
  removeClassLevel: (className: string) => void;
  updateClassLevel: (className: string, newLevel: number) => void;
  getClassDisplayString: () => string;

  // XP
  addExperience: (xp: number) => void;
  setExperience: (xp: number) => void;

  // Spell slots
  updateSpellSlot: (level: keyof SpellSlots, used: number) => void;
  updatePactMagicSlot: (used: number) => void;
  resetSpellSlots: () => void;
  resetPactMagicSlots: () => void;

  // Combat handlers
  getInitiativeModifier: () => number;
  updateInitiative: (value: number, isOverridden: boolean) => void;
  resetInitiativeToDefault: () => void;
  toggleReaction: () => void;
  resetReaction: () => void;
  rollInitiative: () => void;
  updateTempArmorClass: (tempAC: number) => void;
  toggleTempAC: () => void;
  toggleShield: () => void;
  updateShieldBonus: (bonus: number) => void;

  // HP handlers
  applyDamageToCharacter: (damage: number) => void;
  applyHealingToCharacter: (healing: number) => void;
  addTemporaryHPToCharacter: (tempHP: number) => void;
  makeDeathSavingThrow: (success: boolean) => void;
  resetDeathSavingThrows: () => void;
  toggleHPCalculationMode: () => void;
  recalculateMaxHP: () => void;
  updateHitPoints: (updates: Partial<CharacterState['hitPoints']>) => void;

  // Hit dice
  useHitDie: (dieType: string) => void;
  restoreHitDice: (dieType: string, count?: number) => void;
  resetAllHitDice: () => void;

  // Actions section props
  showAttackRoll: (
    name: string,
    roll: number,
    modifier: number,
    isCrit: boolean
  ) => void;
  showSavingThrow: (
    spellName: string,
    saveDC: number,
    saveType?: string,
    damage?: string,
    damageType?: string
  ) => void;
  showDamageRoll: (
    weaponName: string,
    damageRoll: string,
    damageType?: string,
    versatile?: boolean
  ) => void;
  animateRoll?: (notation: string) => Promise<unknown>;
  switchToTab: (tabId: string) => void;
  stopConcentration: () => void;

  // Extended features
  addExtendedFeature: (
    feature: Omit<ExtendedFeature, 'id' | 'createdAt' | 'updatedAt'>
  ) => void;
  updateExtendedFeature: (
    id: string,
    updates: Partial<ExtendedFeature>
  ) => void;
  deleteExtendedFeature: (id: string) => void;
  useExtendedFeature: (id: string) => void;
  resetExtendedFeatures: (restType: 'short' | 'long') => void;
  reorderExtendedFeatures: (
    sourceIndex: number,
    destinationIndex: number,
    sourceType?: string
  ) => void;
  addSpellsFromFeat?: (spells: Spell[]) => void;

  // Tool proficiencies
  addToolProficiency: (
    tool: Omit<ToolProficiency, 'id' | 'createdAt' | 'updatedAt'>
  ) => void;
  updateToolProficiency: (
    id: string,
    updates: Partial<ToolProficiency>
  ) => void;
  deleteToolProficiency: (id: string) => void;

  // Heroic inspiration
  addHeroicInspiration: (amount?: number) => void;
  updateHeroicInspiration: (updates: Partial<HeroicInspiration>) => void;
  useHeroicInspiration: () => void;
  resetHeroicInspiration: () => void;

  // Bardic inspiration
  useBardicInspiration: () => void;
  restoreBardicInspiration: () => void;
  resetBardicInspiration: () => void;

  // Languages
  addLanguage: (
    language: Omit<Language, 'id' | 'createdAt' | 'updatedAt'>
  ) => void;
  deleteLanguage: (id: string) => void;

  // Character details / notes
  addFeature: (
    item: Omit<RichTextContent, 'id' | 'createdAt' | 'updatedAt'>
  ) => void;
  updateFeature: (id: string, updates: Partial<RichTextContent>) => void;
  deleteFeature: (id: string) => void;
  addTrait: (
    item: Omit<RichTextContent, 'id' | 'createdAt' | 'updatedAt'>
  ) => void;
  updateTrait: (id: string, updates: Partial<RichTextContent>) => void;
  deleteTrait: (id: string) => void;
  updateCharacterBackground: (updates: Partial<CharacterBackground>) => void;
  addNote: (
    item: Omit<RichTextContent, 'id' | 'createdAt' | 'updatedAt'>
  ) => void;
  updateNote: (id: string, updates: Partial<RichTextContent>) => void;
  deleteNote: (id: string) => void;
  reorderNotes: (sourceIndex: number, destinationIndex: number) => void;
  addToast: (toast: Omit<ToastData, 'id'>) => void;
  calendarDays?: number | null;
  campaignCode?: string;
  customCounter?: { label: string; value: number } | null;
}

export function createTabbedSheetConfig(
  params: TabbedSheetConfigParams
): BookmarkTabItem[] {
  const {
    character,
    hasHydrated,
    totalLevel,
    proficiencyBonus,
    characterHasSpells,
  } = params;

  const isBard =
    character.classes?.some(c => c.className.toLowerCase() === 'bard') ||
    character.class?.name?.toLowerCase() === 'bard';

  const tabs: BookmarkTabItem[] = [
    // Tab 1: Actions
    {
      id: 'actions',
      label: 'Actions',
      icon: '⚔️',
      badge: character.concentration?.isConcentrating ? (
        <span className="bg-accent-orange-bg-strong text-accent-orange-text rounded-full px-1.5 py-0.5 text-[10px] font-medium">
          Conc.
        </span>
      ) : undefined,
      content: (
        <div className="space-y-6">
          <ActionsSection
            character={character}
            showAttackRoll={params.showAttackRoll}
            showSavingThrow={params.showSavingThrow}
            showDamageRoll={params.showDamageRoll}
            animateRoll={params.animateRoll}
            switchToTab={params.switchToTab}
            onStopConcentration={params.stopConcentration}
            isBard={hasHydrated && isBard}
            onUseBardicInspiration={params.useBardicInspiration}
            onRestoreBardicInspiration={params.restoreBardicInspiration}
            onResetBardicInspiration={params.resetBardicInspiration}
          />
          {characterHasSpells && (
            <SpellSlotTracker
              spellSlots={character.spellSlots}
              pactMagic={character.pactMagic}
              onSpellSlotChange={params.updateSpellSlot}
              onPactMagicChange={
                character.pactMagic ? params.updatePactMagicSlot : undefined
              }
              onResetSpellSlots={params.resetSpellSlots}
              onResetPactMagic={
                character.pactMagic ? params.resetPactMagicSlots : undefined
              }
              compact
            />
          )}
        </div>
      ),
    },

    // Tab 2: Stats
    {
      id: 'stats',
      label: 'Stats',
      icon: '📊',
      content: (
        <div className="space-y-6">
          {/* Header row: Basic Info + Quick Stats */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <CharacterBasicInfo
              character={character}
              race={character.race}
              characterClass={character.class}
              level={character.level}
              background={character.background}
              playerName={character.playerName}
              alignment={character.alignment}
              creatureType={character.creatureType || 'Humanoid'}
              onUpdateRace={race => params.updateCharacter({ race })}
              onUpdateClass={params.updateClass}
              onUpdateLevel={params.updateLevel}
              onUpdateBackground={background =>
                params.updateCharacter({ background })
              }
              onUpdatePlayerName={playerName =>
                params.updateCharacter({ playerName })
              }
              onUpdateAlignment={alignment =>
                params.updateCharacter({ alignment })
              }
              onUpdateCreatureType={creatureType =>
                params.updateCharacter({ creatureType })
              }
              onAddClassLevel={params.addClassLevel}
              onRemoveClassLevel={params.removeClassLevel}
              onUpdateClassLevel={params.updateClassLevel}
              getClassDisplayString={params.getClassDisplayString}
            />
            <QuickStats
              passivePerception={10 + params.getSkillModifier('perception')}
              passiveInsight={10 + params.getSkillModifier('insight')}
              passiveInvestigation={
                10 + params.getSkillModifier('investigation')
              }
              proficiencyBonus={proficiencyBonus}
              carryingCapacity={calculateCarryingCapacity(character)}
              currentWeight={calculateTotalWeight(character)}
              itemCount={character.inventoryItems.length}
              spellAttackBonus={calculateSpellAttackBonus(character)}
              spellSaveDC={calculateSpellSaveDC(character)}
            />
          </div>

          {/* Core stats: Abilities + Saves + XP on left, Skills on right (sticky) */}
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
            <div className="space-y-6">
              <AbilityScores
                abilities={character.abilities}
                characterLevel={totalLevel}
                onUpdateAbilityScore={params.updateAbilityScore}
                onRollAbilityCheck={params.rollAbilityCheck}
              />
              <SavingThrows
                savingThrows={character.savingThrows}
                getSavingThrowModifier={params.getSavingThrowModifier}
                onUpdateSavingThrowProficiency={
                  params.updateSavingThrowProficiency
                }
                onRollSavingThrow={params.rollSavingThrow}
              />
              <div className="border-accent-amber-border bg-surface-raised rounded-lg border p-6 shadow-lg">
                <h2 className="border-divider text-heading mb-4 border-b pb-2 text-lg font-bold">
                  Experience Points
                </h2>
                <XPTracker
                  currentXP={character.experience}
                  currentLevel={totalLevel}
                  onAddXP={params.addExperience}
                  onSetXP={params.setExperience}
                />
              </div>
            </div>

            <div className="lg:sticky lg:top-4">
              <Skills
                skills={character.skills}
                jackOfAllTrades={character.jackOfAllTrades ?? false}
                proficiencyBonus={proficiencyBonus}
                getSkillModifier={params.getSkillModifier}
                onUpdateSkillProficiency={params.updateSkillProficiency}
                onUpdateSkillExpertise={params.updateSkillExpertise}
                onToggleJackOfAllTrades={params.toggleJackOfAllTrades}
                onRollSkillCheck={params.rollSkillCheck}
                onToggleSkillBonusAbility={params.toggleSkillBonusAbility}
              />
            </div>
          </div>
        </div>
      ),
    },

    // Tab 3: Combat (with sub-tabs)
    {
      id: 'combat',
      label: 'Combat',
      icon: '🛡️',
      badge:
        (character.summons?.length || 0) > 0 ? (
          <span className="bg-accent-emerald-bg text-accent-emerald-text rounded-full px-1.5 py-0.5 text-[10px] font-medium">
            {character.summons!.length}
          </span>
        ) : undefined,
      content: (
        <CombatTabContent
          character={character}
          hasHydrated={hasHydrated}
          totalLevel={totalLevel}
          params={params}
        />
      ),
    },

    // Tab 4: Spells (hidden for non-casters)
    {
      id: 'spells',
      label: 'Spells',
      icon: '✨',
      hidden: !characterHasSpells && character.spells.length === 0,
      badge:
        character.spells.length > 0 ? (
          <span className="bg-accent-purple-bg text-accent-purple-text rounded-full px-1.5 py-0.5 text-[10px] font-medium">
            {character.spells.length}
          </span>
        ) : undefined,
      content: (
        <div className="space-y-6">
          <ErrorBoundary
            fallback={
              <div className="border-accent-purple-border bg-surface-raised rounded-lg border p-4 shadow">
                <p className="text-muted">
                  Unable to load spellcasting statistics
                </p>
              </div>
            }
          >
            <SpellcastingStats />
          </ErrorBoundary>
          <SpellSlotTracker
            spellSlots={character.spellSlots}
            pactMagic={character.pactMagic}
            onSpellSlotChange={params.updateSpellSlot}
            onPactMagicChange={
              character.pactMagic ? params.updatePactMagicSlot : undefined
            }
            onResetSpellSlots={params.resetSpellSlots}
            onResetPactMagic={
              character.pactMagic ? params.resetPactMagicSlots : undefined
            }
          />
          <ErrorBoundary
            fallback={
              <div className="border-accent-purple-border bg-surface-raised rounded-lg border p-4 shadow">
                <p className="text-muted">Unable to load spell management</p>
              </div>
            }
          >
            <SpellManagement />
          </ErrorBoundary>
        </div>
      ),
    },

    // Tab 5: Inventory (with internal sub-tabs)
    {
      id: 'inventory',
      label: 'Inventory',
      icon: '🎒',
      content: <InventoryTabContent character={character} />,
    },

    // Tab 6: Features
    {
      id: 'features',
      label: 'Features',
      icon: '⚡',
      badge:
        (character.extendedFeatures?.length || 0) > 0 ? (
          <span className="bg-accent-amber-bg text-accent-amber-text rounded-full px-1.5 py-0.5 text-[10px] font-medium">
            {character.extendedFeatures?.length}
          </span>
        ) : undefined,
      content: (
        <FeaturesTabContent
          character={character}
          totalLevel={totalLevel}
          proficiencyBonus={proficiencyBonus}
          params={params}
          customCounter={params.customCounter}
        />
      ),
    },

    // Tab 7: Character
    {
      id: 'character',
      label: 'Character',
      icon: '📋',
      content: <CharacterTabContent character={character} params={params} />,
    },

    // Tab 8: Calendar
    {
      id: 'calendar',
      label: 'Calendar',
      icon: '📅',
      content: (
        <ErrorBoundary
          fallback={
            <div className="border-accent-amber-border bg-surface-raised rounded-lg border p-6 shadow-lg">
              <p className="text-muted">Unable to load calendar</p>
            </div>
          }
        >
          <PlayerCalendarView
            characterId={character.id}
            campaignCode={params.campaignCode}
            addToast={params.addToast}
          />
        </ErrorBoundary>
      ),
    },
  ];

  return tabs;
}

const INVENTORY_SUB_TABS = [
  { id: 'weapons', label: 'Weapons', icon: '⚔️' },
  { id: 'magic-items', label: 'Magic Items', icon: '✨' },
  { id: 'armor', label: 'Armor', icon: '🛡️' },
  { id: 'items', label: 'Items', icon: '🎒' },
  { id: 'currency', label: 'Currency', icon: '💰' },
] as const;

type InventorySubTab = (typeof INVENTORY_SUB_TABS)[number]['id'];

function InventoryTabContent({ character }: { character: CharacterState }) {
  const [activeSubTab, setActiveSubTab] = useState<InventorySubTab>('weapons');

  return (
    <div className="space-y-4">
      <div className="bg-surface-secondary inline-flex flex-wrap rounded-lg p-1">
        {INVENTORY_SUB_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`rounded-md px-3 py-2 text-sm font-medium transition-all ${
              activeSubTab === tab.id
                ? 'bg-surface-raised text-heading shadow-sm'
                : 'text-muted hover:text-body'
            }`}
          >
            <span className="mr-1.5">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {activeSubTab === 'weapons' && (
        <ErrorBoundary
          fallback={
            <div className="text-muted p-6 text-center">
              Unable to load weapons
            </div>
          }
        >
          <WeaponsTab />
        </ErrorBoundary>
      )}

      {activeSubTab === 'magic-items' && (
        <ErrorBoundary
          fallback={
            <div className="text-muted p-6 text-center">
              Unable to load magic items
            </div>
          }
        >
          <MagicItemsTab />
        </ErrorBoundary>
      )}

      {activeSubTab === 'armor' && (
        <ErrorBoundary
          fallback={
            <div className="text-muted p-6 text-center">
              Unable to load armor
            </div>
          }
        >
          <ArmorTab />
        </ErrorBoundary>
      )}

      {activeSubTab === 'items' && (
        <ErrorBoundary
          fallback={
            <div className="border-accent-purple-border bg-surface-raised rounded-lg border p-6 shadow-lg">
              <p className="text-muted">Unable to load inventory management</p>
            </div>
          }
        >
          <InventoryManager />
        </ErrorBoundary>
      )}

      {activeSubTab === 'currency' && (
        <ErrorBoundary
          fallback={
            <div className="border-accent-amber-border bg-surface-raised rounded-lg border p-6 shadow-lg">
              <p className="text-muted">Unable to load currency management</p>
            </div>
          }
        >
          <CurrencyManager />
        </ErrorBoundary>
      )}
    </div>
  );
}

const CHARACTER_SUB_TABS = [
  { id: 'notes', label: 'Session Notes', icon: '📝' },
  { id: 'details', label: 'Features & Background', icon: '📋' },
] as const;

type CharacterSubTab = (typeof CHARACTER_SUB_TABS)[number]['id'];

// Global setter so external code (e.g. DM message accept) can switch to the notes sub-tab
let characterSubTabSetter: ((tab: CharacterSubTab) => void) | null = null;
export function setCharacterSubTab(tab: CharacterSubTab) {
  characterSubTabSetter?.(tab);
}

function CharacterTabContent({
  character,
  params,
}: {
  character: CharacterState;
  params: TabbedSheetConfigParams;
}) {
  const [activeSubTab, setActiveSubTab] = useState<CharacterSubTab>('notes');

  // Register the setter so external code can switch sub-tabs
  React.useEffect(() => {
    characterSubTabSetter = setActiveSubTab;
    return () => {
      characterSubTabSetter = null;
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="bg-surface-secondary inline-flex rounded-lg p-1">
        {CHARACTER_SUB_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-all ${
              activeSubTab === tab.id
                ? 'bg-surface-raised text-heading shadow-sm'
                : 'text-muted hover:text-body'
            }`}
          >
            <span className="mr-1.5">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {activeSubTab === 'notes' && (
        <div className="space-y-6">
          {(() => {
            const days = params.calendarDays ?? character.daysSpent ?? 0;
            return (
              <span className="border-accent-amber-border text-accent-amber-text inline-flex items-center gap-1.5 rounded-full border bg-gradient-to-r from-[var(--gradient-amber-from)] to-[var(--gradient-amber-to)] px-3 py-1 text-sm font-medium shadow-sm">
                <span className="text-base">📅</span>
                Campaign Day {days + 1}
              </span>
            );
          })()}

          <ErrorBoundary
            fallback={
              <div className="border-accent-blue-border bg-surface-raised rounded-lg border p-6 shadow-lg">
                <p className="text-muted">Unable to load notes editor</p>
              </div>
            }
          >
            <NotesManager
              items={character.notes}
              onAdd={params.addNote}
              onUpdate={params.updateNote}
              onDelete={params.deleteNote}
              onReorder={params.reorderNotes}
              onAddToast={params.addToast}
            />
          </ErrorBoundary>
        </div>
      )}

      {activeSubTab === 'details' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <ErrorBoundary
              fallback={
                <div className="border-accent-amber-border bg-surface-raised rounded-lg border p-6 shadow-lg">
                  <p className="text-muted">Unable to load features editor</p>
                </div>
              }
            >
              <FeaturesTraitsManager
                items={character.features}
                category="feature"
                onAdd={params.addFeature}
                onUpdate={params.updateFeature}
                onDelete={params.deleteFeature}
              />
            </ErrorBoundary>
            <ErrorBoundary
              fallback={
                <div className="border-accent-emerald-border bg-surface-raised rounded-lg border p-6 shadow-lg">
                  <p className="text-muted">Unable to load traits editor</p>
                </div>
              }
            >
              <FeaturesTraitsManager
                items={character.traits}
                category="trait"
                onAdd={params.addTrait}
                onUpdate={params.updateTrait}
                onDelete={params.deleteTrait}
              />
            </ErrorBoundary>
          </div>

          <ErrorBoundary
            fallback={
              <div className="border-accent-emerald-border bg-surface-raised rounded-lg border p-6 shadow-lg">
                <p className="text-muted">Unable to load background editor</p>
              </div>
            }
          >
            <CharacterBackgroundEditor
              background={character.characterBackground}
              onChange={params.updateCharacterBackground}
            />
          </ErrorBoundary>
        </div>
      )}
    </div>
  );
}

const COMBAT_SUB_TABS = [
  { id: 'player', label: 'Player', icon: '🗡️' },
  { id: 'defenses', label: 'Defenses & Buffs', icon: '🛡️' },
  { id: 'summons', label: 'Summons', icon: '🐾' },
] as const;

type CombatSubTab = (typeof COMBAT_SUB_TABS)[number]['id'];

function CombatTabContent({
  character,
  hasHydrated,
  totalLevel,
  params,
}: {
  character: CharacterState;
  hasHydrated: boolean;
  totalLevel: number;
  params: TabbedSheetConfigParams;
}) {
  const [activeSubTab, setActiveSubTab] = useState<CombatSubTab>('player');
  const summonCount = character.summons?.length || 0;

  return (
    <div className="space-y-4">
      <div className="bg-surface-secondary inline-flex rounded-lg p-1">
        {COMBAT_SUB_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`rounded-md px-3 py-2 text-sm font-medium transition-all ${
              activeSubTab === tab.id
                ? 'bg-surface-raised text-heading shadow-sm'
                : 'text-muted hover:text-body'
            }`}
          >
            <span className="mr-1.5">{tab.icon}</span>
            {tab.label}
            {tab.id === 'summons' && summonCount > 0 && (
              <span className="bg-accent-emerald-bg text-accent-emerald-text ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium">
                {summonCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeSubTab === 'player' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-6">
              <ArmorClassManager
                character={character}
                onUpdateArmorClass={ac =>
                  params.updateCharacter({ armorClass: ac })
                }
                onUpdateTempArmorClass={params.updateTempArmorClass}
                onToggleTempAC={params.toggleTempAC}
                onToggleShield={params.toggleShield}
                onUpdateShieldBonus={params.updateShieldBonus}
              />
              <CombatStats
                character={character}
                getInitiativeModifier={params.getInitiativeModifier}
                onUpdateInitiative={params.updateInitiative}
                onResetInitiativeToDefault={params.resetInitiativeToDefault}
                onUpdateSpeed={speed => params.updateCharacter({ speed })}
                onUpdateCharacter={params.updateCharacter}
                onToggleReaction={params.toggleReaction}
                onResetReaction={params.resetReaction}
                onRollInitiative={params.rollInitiative}
              />
            </div>
            <div className="space-y-6">
              <ErrorBoundary
                fallback={
                  <div className="border-accent-red-border bg-surface-raised rounded-lg border p-6 shadow-lg">
                    <p className="text-muted">Unable to load HP manager</p>
                  </div>
                }
              >
                <HitPointManager
                  hitPoints={character.hitPoints}
                  classInfo={character.class}
                  level={totalLevel}
                  constitutionScore={character.abilities.constitution}
                  onApplyDamage={params.applyDamageToCharacter}
                  onApplyHealing={params.applyHealingToCharacter}
                  onAddTemporaryHP={params.addTemporaryHPToCharacter}
                  onMakeDeathSave={params.makeDeathSavingThrow}
                  onResetDeathSaves={params.resetDeathSavingThrows}
                  onToggleCalculationMode={params.toggleHPCalculationMode}
                  onRecalculateMaxHP={params.recalculateMaxHP}
                  onUpdateHitPoints={params.updateHitPoints}
                />
              </ErrorBoundary>
              <ErrorBoundary
                fallback={
                  <div className="border-accent-purple-border bg-surface-raised rounded-lg border p-4 shadow">
                    <p className="text-muted">
                      Unable to load hit dice tracker
                    </p>
                  </div>
                }
              >
                <HitDiceTracker
                  hitDicePools={character.hitDicePools || {}}
                  onUseHitDie={params.useHitDie}
                  onRestoreHitDice={params.restoreHitDice}
                  onResetAllHitDice={params.resetAllHitDice}
                />
              </ErrorBoundary>
            </div>
          </div>

          <ErrorBoundary
            fallback={
              <div className="border-accent-amber-border bg-surface-raised rounded-lg border p-4 shadow">
                <p className="text-muted">
                  Unable to load weapon proficiencies
                </p>
              </div>
            }
          >
            <WeaponProficiencies />
          </ErrorBoundary>

          <div id="conditions-section">
            <ErrorBoundary
              fallback={
                <div className="border-accent-red-border bg-surface-raised rounded-lg border p-6 shadow-lg">
                  <p className="text-muted">
                    Unable to load conditions and diseases manager
                  </p>
                </div>
              }
            >
              {hasHydrated ? (
                <ConditionsDiseasesManager />
              ) : (
                <div className="border-divider bg-surface-raised rounded-lg border p-6 shadow-lg">
                  <div className="py-4 text-center">
                    <div className="border-accent-blue-text-muted mx-auto h-8 w-8 animate-spin rounded-full border-b-2" />
                    <p className="text-body mt-2">
                      Loading conditions and diseases...
                    </p>
                  </div>
                </div>
              )}
            </ErrorBoundary>
          </div>
        </div>
      )}

      {activeSubTab === 'defenses' && (
        <div className="space-y-6">
          <ErrorBoundary
            fallback={
              <div className="border-accent-blue-border bg-surface-raised rounded-lg border p-4 shadow">
                <p className="text-muted">Unable to load temporary buffs</p>
              </div>
            }
          >
            <TemporaryBuffsManager />
          </ErrorBoundary>
          <ErrorBoundary
            fallback={
              <div className="border-accent-emerald-border bg-surface-raised rounded-lg border p-6 shadow-lg">
                <p className="text-muted">Unable to load defenses and senses</p>
              </div>
            }
          >
            <DefensesAndSenses />
          </ErrorBoundary>
        </div>
      )}

      {activeSubTab === 'summons' && (
        <ErrorBoundary
          fallback={
            <div className="border-divider bg-surface-raised rounded-lg border p-6">
              <p className="text-muted">Unable to load summons</p>
            </div>
          }
        >
          <SummonsSubTab />
        </ErrorBoundary>
      )}
    </div>
  );
}

function DmCustomCounterDisplay({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="from-accent-purple-bg to-accent-purple-bg-strong border-accent-purple-border-strong rounded-lg border-2 bg-linear-to-br p-4">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <Angry className="h-5 w-5 text-purple-600 dark:text-purple-400" />
        <h3 className="text-accent-purple-text text-lg font-bold">{label}</h3>
      </div>

      {/* Count */}
      <div className="mb-4 text-center">
        <div className="text-accent-purple-text text-3xl font-bold">
          {value}
        </div>
        <div className="text-accent-purple-text-muted text-sm">
          {value === 1 ? '1 point' : `${value} points`}
        </div>
      </div>

      {/* Visual boxes — one per point, no empty placeholders */}
      <div className="mb-4 flex flex-wrap justify-center gap-2">
        {Array.from({ length: value }, (_, i) => (
          <div
            key={i}
            className="border-accent-purple-border-strong bg-accent-purple-bg-strong text-accent-purple-text flex h-10 w-10 scale-110 transform items-center justify-center rounded-lg border-2 shadow-lg"
          >
            <Angry size={16} />
          </div>
        ))}
      </div>

      {/* Helper text */}
      <div className="bg-accent-purple-bg-strong text-accent-purple-text-muted rounded p-2 text-center text-xs">
        <p>
          <strong>{label}</strong> are assigned by your DM.
        </p>
      </div>
    </div>
  );
}

const FEATURES_SUB_TABS = [
  { id: 'abilities', label: 'Abilities', icon: '⚡' },
  { id: 'inspiration', label: 'Inspiration', icon: '✨' },
  { id: 'proficiencies', label: 'Proficiencies', icon: '🔧' },
] as const;

type FeaturesSubTab = (typeof FEATURES_SUB_TABS)[number]['id'];

function FeaturesTabContent({
  character,
  totalLevel,
  proficiencyBonus,
  params,
  customCounter,
}: {
  character: CharacterState;
  totalLevel: number;
  proficiencyBonus: number;
  params: TabbedSheetConfigParams;
  customCounter?: { label: string; value: number } | null;
}) {
  const [activeSubTab, setActiveSubTab] = useState<FeaturesSubTab>('abilities');

  return (
    <div className="space-y-4">
      {/* Segmented control */}
      <div className="bg-surface-secondary inline-flex rounded-lg p-1">
        {FEATURES_SUB_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-all ${
              activeSubTab === tab.id
                ? 'bg-surface-raised text-heading shadow-sm'
                : 'text-muted hover:text-body'
            }`}
          >
            <span className="mr-1.5">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      {activeSubTab === 'abilities' && (
        <div className="space-y-6">
          <TraitTracker<ExtendedFeature>
            traits={(character.extendedFeatures || []).filter(
              t => !t.isPassive
            )}
            characterLevel={totalLevel}
            onUpdateTrait={params.updateExtendedFeature}
            onDeleteTrait={params.deleteExtendedFeature}
            onUseTrait={params.useExtendedFeature}
            onResetTraits={params.resetExtendedFeatures}
            readonly={false}
            hideControls={true}
            enableViewModal={true}
          />
          <ExtendedFeaturesSection
            features={character.extendedFeatures || []}
            character={character}
            onAddFeature={params.addExtendedFeature}
            onUpdateFeature={params.updateExtendedFeature}
            onDeleteFeature={params.deleteExtendedFeature}
            onUseFeature={params.useExtendedFeature}
            onResetFeatures={params.resetExtendedFeatures}
            onReorderFeatures={params.reorderExtendedFeatures}
            onAddSpells={params.addSpellsFromFeat}
          />
        </div>
      )}

      {activeSubTab === 'inspiration' && (
        <div className="space-y-6">
          <HeroicInspirationTracker
            inspiration={character.heroicInspiration}
            onAddInspiration={params.addHeroicInspiration}
            onUpdateInspiration={params.updateHeroicInspiration}
            onUseInspiration={params.useHeroicInspiration}
            onResetInspiration={params.resetHeroicInspiration}
          />
          {customCounter && customCounter.value > 0 && (
            <DmCustomCounterDisplay
              label={customCounter.label}
              value={customCounter.value}
            />
          )}
        </div>
      )}

      {activeSubTab === 'proficiencies' && (
        <div className="space-y-6">
          <ToolProficienciesSection
            toolProficiencies={character.toolProficiencies || []}
            proficiencyBonus={proficiencyBonus}
            onAddToolProficiency={params.addToolProficiency}
            onUpdateToolProficiency={params.updateToolProficiency}
            onDeleteToolProficiency={params.deleteToolProficiency}
          />
          <Languages
            languages={character.languages || []}
            onAddLanguage={params.addLanguage}
            onDeleteLanguage={params.deleteLanguage}
          />
        </div>
      )}
    </div>
  );
}
