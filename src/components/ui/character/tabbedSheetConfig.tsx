import { Section } from '@/components/ui/layout/section';
import { SubTabs } from '@/components/ui/layout/SubTabs';
import { SheetLoadError } from './SheetLoadError';
import React, { useState, useEffect } from 'react';
import { Angry } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { AppIcon } from '@/components/ui/icons';
import LevelUpWizard from '@/components/ui/character/LevelUpWizard';
import ErrorBoundary from '@/components/ui/feedback/ErrorBoundary';
import { DEFAULT_DICE_SET, parseDiceSet } from '@/utils/diceSet';
import { PlayerCalendarView } from '@/components/ui/calendar/PlayerCalendarView';
import PlayerLocationView from '@/components/ui/campaign/location-map/PlayerLocationView';
import ConditionsDiseasesManager from '@/components/ui/game/ConditionsDiseasesManager';
import TemporaryBuffsManager from '@/components/ui/game/TemporaryBuffsManager';
import DefensesAndSenses from '@/components/ui/game/DefensesAndSenses';
import CharacterBackgroundEditor from '@/components/ui/character/CharacterBackgroundEditor';
import FeaturesTraitsManager from '@/components/ui/game/FeaturesTraitsManager';
import NotesManager from '@/components/ui/game/NotesManager';
import { DiceSetEditor } from '@/components/ui/game/DiceSetEditor';
import InventoryManager from '@/components/ui/game/InventoryManager';
import CurrencyManager from '@/components/ui/game/CurrencyManager';
import { SpellcastingStats } from '@/components/SpellcastingStats';
import { SpellManagement } from '@/components/SpellManagement';
import { WeaponsTab } from '@/components/ui/character/equipment/WeaponsTab';
import { MagicItemsTab } from '@/components/ui/character/equipment/MagicItemsTab';
import { ArmorTab } from '@/components/ui/character/equipment/ArmorTab';
import ActionsSection from '@/components/ui/character/ActionsSection';
import CharacterBasicInfo from '@/components/ui/character/CharacterBasicInfo';
import { AbilitiesSection } from '@/components/ui/character/AbilitiesSection';
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
  shouldLevelUp,
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
  InventoryItem,
} from '@/types/character';

function LevelUpButton({
  pendingLevelUp = false,
}: {
  pendingLevelUp?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <Button
        variant={pendingLevelUp ? 'primary' : 'secondary'}
        size="sm"
        onClick={() => setIsOpen(true)}
      >
        <AppIcon name="levelUp" size={14} />
        Level up
      </Button>
      {isOpen && (
        <LevelUpWizard isOpen={isOpen} onClose={() => setIsOpen(false)} />
      )}
    </>
  );
}

export interface TabbedSheetConfigParams {
  character: CharacterState;
  hasHydrated: boolean;
  totalLevel: number;
  proficiencyBonus: number;
  characterHasSpells: boolean;
  /**
   * Sheet mode (`SheetMode.tsx`): false = play mode, build values are plain
   * text. Passed to the Combat tab's max HP, base AC and speed, and to the
   * Stats tab's abilities (scores, save and skill proficiencies, Jack of All
   * Trades, bonus abilities; rolls only in play mode).
   */
  editing: boolean;

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

  // Spell slots — delta forms (forwarded-intent safe)
  changeSpellSlotBy: (level: keyof SpellSlots, delta: number) => void;
  changePactMagicBy: (delta: number) => void;
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
  setTempACActive: (active: boolean) => void;
  setShieldEquipped: (equipped: boolean) => void;
  updateShieldBonus: (bonus: number) => void;

  // HP handlers
  applyDamageToCharacter: (damage: number) => void;
  applyHealingToCharacter: (healing: number) => void;
  addTemporaryHPToCharacter: (tempHP: number) => void;
  makeDeathSavingThrow: (success: boolean) => void;
  resetDeathSavingThrows: () => void;
  toggleHPCalculationMode: () => void;
  recalculateMaxHP: () => void;
  setCurrentHitPoints: (value: number) => void;
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
  toggleFavoriteFeature: (id: string) => void;

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
  stackableInspiration?: boolean;
  inCampaign?: boolean;
  setStackableInspiration?: (enabled: boolean) => void;

  // Class resources
  useClassResource: (id: string, amount?: number) => void;
  restoreClassResource: (id: string, amount?: number) => void;
  resetClassResource: (id: string) => void;

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
  locationCount?: number;
  onSendItem?: (item: InventoryItem) => void;
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
    onSendItem,
  } = params;

  const renderSlotTracker = (compact = false) => (
    <SpellSlotTracker
      spellSlots={character.spellSlots}
      pactMagic={character.pactMagic}
      onSpellSlotChange={params.changeSpellSlotBy}
      onPactMagicChange={
        character.pactMagic ? params.changePactMagicBy : undefined
      }
      onResetSpellSlots={params.resetSpellSlots}
      onResetPactMagic={
        character.pactMagic ? params.resetPactMagicSlots : undefined
      }
      compact={compact}
    />
  );

  const tabs: BookmarkTabItem[] = [
    // Tab 1: Actions
    {
      id: 'actions',
      label: 'Actions',
      icon: <AppIcon name="attack" className="h-4 w-4" />,
      badge: character.concentration?.isConcentrating ? (
        <span className="border-lapis-border text-lapis-text rounded-full border px-1.5 py-0.5 text-[10px] font-medium">
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
            showClassResources={hasHydrated}
            onUseClassResource={params.useClassResource}
            onRestoreClassResource={params.restoreClassResource}
            onResetClassResource={params.resetClassResource}
            spellSlotsPanel={
              characterHasSpells ? renderSlotTracker(true) : undefined
            }
          />
        </div>
      ),
    },

    // Tab 2: Stats
    {
      id: 'stats',
      label: 'Stats',
      icon: <AppIcon name="abilities" className="h-4 w-4" />,
      content: (
        <div className="space-y-6">
          {/* Header row: Basic Info + Quick Stats */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <CharacterBasicInfo
              editing={params.editing}
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

          <AbilitiesSection
            abilities={character.abilities}
            savingThrows={character.savingThrows}
            skills={character.skills}
            jackOfAllTrades={character.jackOfAllTrades ?? false}
            getSavingThrowModifier={params.getSavingThrowModifier}
            getSkillModifier={params.getSkillModifier}
            onUpdateAbilityScore={params.updateAbilityScore}
            onRollAbilityCheck={params.rollAbilityCheck}
            onUpdateSavingThrowProficiency={params.updateSavingThrowProficiency}
            onRollSavingThrow={params.rollSavingThrow}
            onUpdateSkillProficiency={params.updateSkillProficiency}
            onUpdateSkillExpertise={params.updateSkillExpertise}
            onToggleJackOfAllTrades={params.toggleJackOfAllTrades}
            onRollSkillCheck={params.rollSkillCheck}
            onToggleSkillBonusAbility={params.toggleSkillBonusAbility}
            editing={params.editing}
          />

          {(() => {
            const pendingLevelUp = shouldLevelUp(
              character.experience,
              totalLevel
            );
            return (
              <Section
                heading="Experience points"
                trailing={
                  totalLevel < 20 ? (
                    <LevelUpButton pendingLevelUp={pendingLevelUp} />
                  ) : undefined
                }
              >
                <XPTracker
                  editing={params.editing}
                  currentXP={character.experience}
                  currentLevel={totalLevel}
                  onAddXP={params.addExperience}
                  onSetXP={params.setExperience}
                  pendingLevelUp={pendingLevelUp}
                />
              </Section>
            );
          })()}
        </div>
      ),
    },

    // Tab 3: Combat (with sub-tabs)
    {
      id: 'combat',
      label: 'Combat',
      icon: <AppIcon name="armor" className="h-4 w-4" />,
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
      icon: <AppIcon name="spell" className="h-4 w-4" />,
      hidden: !characterHasSpells && character.spells.length === 0,
      badge:
        character.spells.length > 0 ? (
          <span className="bg-accent-purple-bg text-accent-purple-text rounded-full px-1.5 py-0.5 text-[10px] font-medium">
            {character.spells.length}
          </span>
        ) : undefined,
      content: (
        <div className="space-y-6">
          <ErrorBoundary fallback={<SheetLoadError thing="Spellcasting" />}>
            <SpellcastingStats editing={params.editing} />
          </ErrorBoundary>
          {renderSlotTracker()}
          <ErrorBoundary fallback={<SheetLoadError thing="Spells" />}>
            <SpellManagement />
          </ErrorBoundary>
        </div>
      ),
    },

    // Tab 5: Inventory (with internal sub-tabs)
    {
      id: 'inventory',
      label: 'Inventory',
      icon: <AppIcon name="inventory" className="h-4 w-4" />,
      content: (
        <InventoryTabContent character={character} onSendItem={onSendItem} />
      ),
    },

    // Tab 6: Features
    {
      id: 'features',
      label: 'Features',
      icon: <AppIcon name="features" className="h-4 w-4" />,
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
      icon: <AppIcon name="features" className="h-4 w-4" />,
      content: <CharacterTabContent character={character} params={params} />,
    },

    // Tab 8: Calendar
    {
      id: 'calendar',
      label: 'Calendar',
      icon: <AppIcon name="calendar" className="h-4 w-4" />,
      content: (
        <ErrorBoundary fallback={<SheetLoadError thing="Calendar" />}>
          <PlayerCalendarView
            characterId={character.id}
            campaignCode={params.campaignCode}
            addToast={params.addToast}
          />
        </ErrorBoundary>
      ),
    },
  ];

  // Tab 9: Map (conditional — only shown when campaign has at least one synced location)
  if (params.locationCount && params.locationCount > 0) {
    tabs.push({
      id: 'map',
      label: 'Map',
      icon: <AppIcon name="map" className="h-4 w-4" />,
      content: (
        <ErrorBoundary fallback={<SheetLoadError thing="Map" />}>
          <PlayerLocationView
            characterId={character.id}
            campaignCode={params.campaignCode}
          />
        </ErrorBoundary>
      ),
    });
  }

  return tabs;
}

const INVENTORY_SUB_TABS = [
  {
    id: 'weapons',
    label: 'Weapons',
    icon: <AppIcon name="weapon" className="h-4 w-4" />,
  },
  {
    id: 'magic-items',
    label: 'Magic items',
    icon: <AppIcon name="magicItem" className="h-4 w-4" />,
  },
  {
    id: 'armor',
    label: 'Armor',
    icon: <AppIcon name="armor" className="h-4 w-4" />,
  },
  {
    id: 'items',
    label: 'Items',
    icon: <AppIcon name="inventory" className="h-4 w-4" />,
  },
  {
    id: 'currency',
    label: 'Currency',
    icon: <AppIcon name="currency" className="h-4 w-4" />,
  },
] as const;

type InventorySubTab = (typeof INVENTORY_SUB_TABS)[number]['id'];

// Global setter so external code (e.g. item transfer notification) can switch to items sub-tab
let inventorySubTabSetter: ((tab: InventorySubTab) => void) | null = null;
let pendingInventorySubTab: InventorySubTab | null = null;
export function setInventorySubTab(tab: InventorySubTab) {
  if (inventorySubTabSetter) inventorySubTabSetter(tab);
  else pendingInventorySubTab = tab;
}

function InventoryTabContent({
  character: _character,
  onSendItem,
}: {
  character: CharacterState;
  onSendItem?: (item: InventoryItem) => void;
}) {
  const [activeSubTab, setActiveSubTab] = useState<InventorySubTab>('weapons');

  useEffect(() => {
    inventorySubTabSetter = setActiveSubTab;
    if (pendingInventorySubTab) {
      setActiveSubTab(pendingInventorySubTab);
      pendingInventorySubTab = null;
    }
    return () => {
      if (inventorySubTabSetter === setActiveSubTab)
        inventorySubTabSetter = null;
    };
  }, []);

  return (
    <SubTabs
      label="Inventory"
      value={activeSubTab}
      onValueChange={value => setActiveSubTab(value as InventorySubTab)}
      tabs={INVENTORY_SUB_TABS.map(tab => ({
        value: tab.id,
        id: `inventory-${tab.id}`,
        label: tab.label,
        content: {
          weapons: (
            <ErrorBoundary fallback={<SheetLoadError thing="Weapons" />}>
              <WeaponsTab />
            </ErrorBoundary>
          ),
          'magic-items': (
            <ErrorBoundary fallback={<SheetLoadError thing="Magic items" />}>
              <MagicItemsTab />
            </ErrorBoundary>
          ),
          armor: (
            <ErrorBoundary fallback={<SheetLoadError thing="Armor" />}>
              <ArmorTab />
            </ErrorBoundary>
          ),
          items: (
            <ErrorBoundary fallback={<SheetLoadError thing="Items" />}>
              <InventoryManager onSendItem={onSendItem} />
            </ErrorBoundary>
          ),
          currency: (
            <ErrorBoundary fallback={<SheetLoadError thing="Currency" />}>
              <CurrencyManager />
            </ErrorBoundary>
          ),
        }[tab.id],
      }))}
    />
  );
}

const CHARACTER_SUB_TABS = [
  {
    id: 'notes',
    label: 'Session notes',
    icon: <AppIcon name="features" className="h-4 w-4" />,
  },
  {
    id: 'details',
    label: 'Features and background',
    icon: <AppIcon name="character" className="h-4 w-4" />,
  },
  {
    id: 'dice',
    label: 'Dice',
    icon: <AppIcon name="dice" className="h-4 w-4" />,
  },
] as const;

type CharacterSubTab = (typeof CHARACTER_SUB_TABS)[number]['id'];

// Global setter so external code (e.g. DM message accept) can switch to the notes sub-tab
let characterSubTabSetter: ((tab: CharacterSubTab) => void) | null = null;
let pendingCharacterSubTab: CharacterSubTab | null = null;
export function setCharacterSubTab(tab: CharacterSubTab) {
  if (characterSubTabSetter) characterSubTabSetter(tab);
  else pendingCharacterSubTab = tab;
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
    if (pendingCharacterSubTab) {
      setActiveSubTab(pendingCharacterSubTab);
      pendingCharacterSubTab = null;
    }
    return () => {
      if (characterSubTabSetter === setActiveSubTab)
        characterSubTabSetter = null;
    };
  }, []);

  return (
    <SubTabs
      label="Character"
      value={activeSubTab}
      onValueChange={value => setActiveSubTab(value as CharacterSubTab)}
      tabs={CHARACTER_SUB_TABS.map(tab => ({
        value: tab.id,
        id: `character-${tab.id}`,
        label: tab.label,
        content: {
          notes: (
            <div className="space-y-6">
              {(() => {
                const days = params.calendarDays ?? character.daysSpent ?? 0;
                return (
                  <span className="border-accent-amber-border text-accent-amber-text inline-flex items-center gap-1.5 rounded-full border bg-gradient-to-r from-[var(--gradient-amber-from)] to-[var(--gradient-amber-to)] px-3 py-1 text-sm font-medium shadow-sm">
                    <AppIcon name="calendar" className="h-4 w-4" />
                    Campaign Day {days + 1}
                  </span>
                );
              })()}

              <ErrorBoundary
                fallback={<SheetLoadError thing="Session notes" />}
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
          ),
          details: (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <ErrorBoundary fallback={<SheetLoadError thing="Features" />}>
                  <FeaturesTraitsManager
                    items={character.features}
                    category="feature"
                    onAdd={params.addFeature}
                    onUpdate={params.updateFeature}
                    onDelete={params.deleteFeature}
                  />
                </ErrorBoundary>
                <ErrorBoundary fallback={<SheetLoadError thing="Traits" />}>
                  <FeaturesTraitsManager
                    items={character.traits}
                    category="trait"
                    onAdd={params.addTrait}
                    onUpdate={params.updateTrait}
                    onDelete={params.deleteTrait}
                  />
                </ErrorBoundary>
              </div>

              <ErrorBoundary fallback={<SheetLoadError thing="Background" />}>
                <CharacterBackgroundEditor
                  background={character.characterBackground}
                  onChange={params.updateCharacterBackground}
                />
              </ErrorBoundary>
            </div>
          ),
          dice: (
            <DiceSetEditor
              value={parseDiceSet(character.diceSet) ?? DEFAULT_DICE_SET}
              onChange={diceSet => params.updateCharacter({ diceSet })}
              onPreview={
                params.animateRoll
                  ? () => {
                      void params.animateRoll?.('1d20+1d8+1d6');
                    }
                  : undefined
              }
            />
          ),
        }[tab.id],
      }))}
    />
  );
}

const COMBAT_SUB_TABS = [
  {
    id: 'player',
    label: 'Player',
    icon: <AppIcon name="character" className="h-4 w-4" />,
  },
  {
    id: 'defenses',
    label: 'Defenses and buffs',
    icon: <AppIcon name="armor" className="h-4 w-4" />,
  },
  {
    id: 'summons',
    label: 'Summons',
    icon: <AppIcon name="summon" className="h-4 w-4" />,
  },
] as const;

type CombatSubTab = (typeof COMBAT_SUB_TABS)[number]['id'];
type CombatNavigationRequest = {
  tab: CombatSubTab;
  scrollToConditions?: boolean;
};
let combatSubTabSetter: ((request: CombatNavigationRequest) => void) | null =
  null;
let pendingCombatSubTab: CombatNavigationRequest | null = null;
const USER_TAKEOVER_EVENTS = [
  'wheel',
  'touchstart',
  'pointerdown',
  'keydown',
] as const;
export function setCombatSubTab(
  tab: CombatSubTab,
  options?: { scrollToConditions?: boolean }
) {
  const request = { tab, scrollToConditions: options?.scrollToConditions };
  if (combatSubTabSetter) combatSubTabSetter(request);
  else pendingCombatSubTab = request;
}

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
  const [request, setRequest] = useState<CombatNavigationRequest>({
    tab: 'player',
  });
  const activeSubTab = request.tab;
  const [conditionsTarget, setConditionsTarget] =
    useState<HTMLDivElement | null>(null);
  const handledRequest = React.useRef<CombatNavigationRequest | null>(null);
  useEffect(() => {
    combatSubTabSetter = setRequest;
    if (pendingCombatSubTab) {
      setRequest(pendingCombatSubTab);
      pendingCombatSubTab = null;
    }
    return () => {
      if (combatSubTabSetter === setRequest) combatSubTabSetter = null;
    };
  }, []);
  useEffect(() => {
    if (
      request.tab !== 'player' ||
      !request.scrollToConditions ||
      handledRequest.current === request ||
      !conditionsTarget
    )
      return;
    handledRequest.current = request;
    const align = () =>
      conditionsTarget.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'auto'
          : 'smooth',
        block: 'start',
      });
    align();
    if (typeof ResizeObserver === 'undefined') return;
    // The conditions load after the section mounts; re-aim as it grows until
    // the player scrolls, taps or types.
    let height = conditionsTarget.getBoundingClientRect().height;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.height === height) return;
      height = entry.contentRect.height;
      align();
    });
    observer.observe(conditionsTarget);
    const stop = () => {
      observer.disconnect();
      for (const type of USER_TAKEOVER_EVENTS)
        window.removeEventListener(type, stop, true);
    };
    for (const type of USER_TAKEOVER_EVENTS)
      window.addEventListener(type, stop, { capture: true, passive: true });
    return stop;
  }, [request, conditionsTarget]);

  return (
    <SubTabs
      label="Combat"
      value={activeSubTab}
      onValueChange={value => setRequest({ tab: value as CombatSubTab })}
      tabs={COMBAT_SUB_TABS.map(tab => ({
        value: tab.id,
        id: `combat-${tab.id}`,
        label:
          tab.id === 'summons' && (character.summons?.length || 0) > 0 ? (
            <>
              {tab.label}
              <span className="type-caption text-muted ml-1.5">
                {character.summons?.length}
              </span>
            </>
          ) : (
            tab.label
          ),
        content: {
          player: (
            <div className="space-y-8">
              <div className="grid grid-cols-1 items-start gap-x-10 gap-y-8 lg:grid-cols-2">
                <ErrorBoundary fallback={<SheetLoadError thing="Hit points" />}>
                  <HitPointManager
                    editing={params.editing}
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
                    onSetCurrentHitPoints={params.setCurrentHitPoints}
                    onUpdateHitPoints={params.updateHitPoints}
                  />
                </ErrorBoundary>
                <ArmorClassManager
                  layout="ledger"
                  editing={params.editing}
                  character={character}
                  onUpdateArmorClass={ac =>
                    params.updateCharacter({ armorClass: ac })
                  }
                  onUpdateTempArmorClass={params.updateTempArmorClass}
                  onSetTempACActive={params.setTempACActive}
                  onSetShieldEquipped={params.setShieldEquipped}
                  onUpdateShieldBonus={params.updateShieldBonus}
                />
                <ErrorBoundary fallback={<SheetLoadError thing="Hit dice" />}>
                  <HitDiceTracker
                    hitDicePools={character.hitDicePools || {}}
                    onUseHitDie={params.useHitDie}
                    onRestoreHitDice={params.restoreHitDice}
                    onResetAllHitDice={params.resetAllHitDice}
                  />
                </ErrorBoundary>
                <Section heading="Initiative and speed" level={3}>
                  <CombatStats
                    editing={params.editing}
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
                </Section>
                <div className="lg:col-span-2">
                  <ErrorBoundary
                    fallback={<SheetLoadError thing="Weapon proficiencies" />}
                  >
                    <WeaponProficiencies editing={params.editing} />
                  </ErrorBoundary>
                </div>
              </div>

              <div
                id="conditions-section"
                ref={setConditionsTarget}
                className="scroll-mt-[calc(var(--app-header-height,4rem)+1rem)]"
              >
                <ErrorBoundary
                  fallback={<SheetLoadError thing="Conditions and effects" />}
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
          ),
          defenses: (
            <div className="space-y-6">
              <ErrorBoundary fallback={<SheetLoadError thing="Buffs" />}>
                <TemporaryBuffsManager />
              </ErrorBoundary>
              <ErrorBoundary
                fallback={<SheetLoadError thing="Defenses and senses" />}
              >
                <DefensesAndSenses />
              </ErrorBoundary>
            </div>
          ),
          summons: (
            <ErrorBoundary fallback={<SheetLoadError thing="Summons" />}>
              <SummonsSubTab />
            </ErrorBoundary>
          ),
        }[tab.id],
      }))}
    />
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
  {
    id: 'abilities',
    label: 'Abilities',
    icon: <AppIcon name="abilities" className="h-4 w-4" />,
  },
  {
    id: 'inspiration',
    label: 'Inspiration',
    icon: <AppIcon name="inspiration" className="h-4 w-4" />,
  },
  {
    id: 'proficiencies',
    label: 'Proficiencies',
    icon: <AppIcon name="proficiencies" className="h-4 w-4" />,
  },
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
    <SubTabs
      label="Features"
      value={activeSubTab}
      onValueChange={value => setActiveSubTab(value as FeaturesSubTab)}
      tabs={FEATURES_SUB_TABS.map(tab => ({
        value: tab.id,
        id: `features-${tab.id}`,
        label: tab.label,
        content: {
          abilities: (
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
                favoriteFeatureIds={character.favoriteFeatureIds || []}
                onToggleFavoriteFeature={params.toggleFavoriteFeature}
              />
            </div>
          ),
          inspiration: (
            <div className="space-y-6">
              <HeroicInspirationTracker
                inspiration={character.heroicInspiration}
                onAddInspiration={params.addHeroicInspiration}
                onUpdateInspiration={params.updateHeroicInspiration}
                onUseInspiration={params.useHeroicInspiration}
                onResetInspiration={params.resetHeroicInspiration}
                stackable={params.stackableInspiration ?? false}
                showStackableControl={
                  !params.inCampaign && Boolean(params.setStackableInspiration)
                }
                dmControlled={Boolean(params.inCampaign)}
                onToggleStackable={params.setStackableInspiration}
              />
              {customCounter && customCounter.value > 0 && (
                <DmCustomCounterDisplay
                  label={customCounter.label}
                  value={customCounter.value}
                />
              )}
            </div>
          ),
          proficiencies: (
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
          ),
        }[tab.id],
      }))}
    />
  );
}
