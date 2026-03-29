'use client';

import { FileText, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { usePlayerStore } from '@/store/playerStore';
import { useCharacterStore } from '@/store/characterStore';
import { useAutoSave } from '@/hooks/useAutoSave';
import { usePlayerSync } from '@/hooks/usePlayerSync';
import { SyncIndicator } from '@/components/ui/campaign/SyncIndicator';
import { PartyHPSidebar } from '@/components/ui/campaign/PartyHPSidebar';
import { DmMessageNotification } from '@/components/ui/campaign/DmMessageNotification';
import { ItemTransferNotification } from '@/components/ui/campaign/ItemTransferNotification';
import { DmEffectsNotification } from '@/components/ui/campaign/DmEffectsNotification';
import { DmCounterNotification } from '@/components/ui/campaign/DmCounterNotification';
import { useDmConditionOverrides } from '@/hooks/useDmConditionOverrides';
import type { DmEffect } from '@/types/sharedState';
import ExperimentalFeaturesSection from '@/components/ui/layout/ExperimentalFeaturesSection';
import ErrorBoundary from '@/components/ui/feedback/ErrorBoundary';
import { ToastContainer, useToast } from '@/components/ui/feedback/Toast';
import { ConfirmationModal } from '@/components/ui/feedback/ConfirmationModal';
import { YouDiedOverlay } from '@/components/ui/feedback/YouDiedOverlay';
import { LevelUpOverlay } from '@/components/ui/feedback/LevelUpOverlay';

import CharacterSheetHeader from '@/components/ui/character/CharacterSheetHeader';
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
  Spell,
} from '@/types/character';
import { useCallback, useEffect, useState, useRef } from 'react';
import { NavigationContext } from '@/contexts/NavigationContext';
import { useSimpleDiceRoll } from '@/hooks/useSimpleDiceRoll';
import { useLocationSync } from '@/hooks/useLocationSync';

import { RollSummary } from '@/types/dice';
import NotHydrated from '@/components/ui/feedback/NotHydrated';
import CharacterHUD from '@/components/ui/character/CharacterHUD';
import RestDialog from '@/components/ui/character/RestDialog';
import { useCalendarStore } from '@/store/calendarStore';
import { useSharedCampaignState } from '@/hooks/useSharedCampaignState';
import { getMsPerDay, getCampaignDays } from '@/utils/calendarCalculations';
import TabbedCharacterSheet from '@/components/ui/character/TabbedCharacterSheet';
import type { TabbedCharacterSheetRef } from '@/components/ui/character/TabbedCharacterSheet';
import { setCharacterSubTab } from '@/components/ui/character/tabbedSheetConfig';

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
    toggleSkillBonusAbility,
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
    useHeroicInspiration: spendHeroicInspiration,
    resetHeroicInspiration,
    toggleReaction,
    resetReaction,
    // Bardic inspiration methods
    useBardicInspiration,
    restoreBardicInspiration,
    resetBardicInspiration,
    updateTempArmorClass,
    toggleTempAC,
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
    // Temporary buffs
    toggleBuff,
    // Campaign tracking
    updateDaysSpent,
    incrementDaysSpent,
    toggleShareHpWithParty,
    // Easter egg animations
    showDeathAnimation,
    clearDeathAnimation,
    showLevelUpAnimation,
    levelUpAnimationLevel,
    clearLevelUpAnimation,
    addInventoryItem,
    deleteInventoryItem,
  } = useCharacterStore();

  // Derive campaign days from local calendar (may be overridden by shared state below)
  const playerCalendar = useCalendarStore(state =>
    state.calendars.find(c => c.campaignCode === characterId)
  );

  const handleAddSpellsFromFeat = useCallback(
    (spells: Spell[]) => {
      if (spells.length === 0) return;
      updateCharacter({
        spells: [...(character.spells || []), ...spells],
      });
    },
    [character.spells, updateCharacter]
  );

  const [showResetModal, setShowResetModal] = useState(false);
  const [pendingRestType, setPendingRestType] = useState<
    'short' | 'long' | null
  >(null);
  const tabbedSheetRef = useRef<TabbedCharacterSheetRef>(null);

  const playerSync = usePlayerSync({ characterId });

  // Location sync — used to conditionally show Map tab
  const { locations: syncedLocations } = useLocationSync(
    playerSync.campaignCode ?? undefined
  );

  // Shared DM calendar state (when in a campaign)
  const {
    sharedState,
    acknowledgeMessage,
    acknowledgeDmEffects,
    acknowledgeTransfers,
    pendingTransfers,
    clearPendingTransfer,
  } = useSharedCampaignState(playerSync.campaignCode, characterId);
  const sharedCalendar = sharedState?.calendar ?? null;

  // Auto-save DM messages to notes on arrival so they're never lost
  const savedMessageIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const messages = sharedState?.messages ?? [];
    for (const msg of messages) {
      if (!savedMessageIdsRef.current.has(msg.id)) {
        savedMessageIdsRef.current.add(msg.id);
        addNote({
          title: `[DM] ${msg.title}`,
          content: msg.content,
          category: 'note',
        });
      }
    }
  }, [sharedState?.messages, addNote]);

  // Auto-merge incoming item transfers into inventory
  const processedTransferIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const transfers = sharedState?.transfers ?? [];
    if (transfers.length === 0) return;

    let added = false;
    for (const transfer of transfers) {
      if (processedTransferIdsRef.current.has(transfer.id)) continue;
      processedTransferIdsRef.current.add(transfer.id);

      addInventoryItem({
        name: transfer.item.name,
        category: transfer.item.category || 'misc',
        quantity: transfer.item.quantity,
        description: transfer.item.description,
        weight: transfer.item.weight,
        value: transfer.item.value,
        rarity: transfer.item.rarity,
        type: transfer.item.type,
        location: transfer.item.location || 'Backpack',
        tags: transfer.item.tags || [],
      });
      added = true;
    }

    if (added) {
      acknowledgeTransfers();
    }
  }, [sharedState?.transfers, addInventoryItem, acknowledgeTransfers]);

  // Latch DM effects into local state for the notification toast before
  // acknowledgment clears them from shared state.
  const [pendingEffectToasts, setPendingEffectToasts] = useState<DmEffect[]>(
    []
  );

  useEffect(() => {
    const additions = (sharedState?.dmEffects ?? []).filter(
      e => e.action === 'add'
    );
    if (additions.length > 0) {
      setPendingEffectToasts(additions);
    }
  }, [sharedState?.dmEffects]);

  // Apply DM condition overrides (additions/removals) to character store,
  // then acknowledge to clear them from Redis so the player owns the conditions.
  useDmConditionOverrides(sharedState?.dmEffects, acknowledgeDmEffects);

  // Detect custom counter changes from the DM and show a toast
  const prevCounterRef = useRef<number | null>(null);
  const [counterToast, setCounterToast] = useState<{
    label: string;
    value: number;
    delta: number;
  } | null>(null);

  useEffect(() => {
    const counter = sharedState?.customCounter;
    if (!counter) return;

    const prev = prevCounterRef.current;
    prevCounterRef.current = counter.value;

    if (prev !== null && counter.value !== prev) {
      setCounterToast({
        label: counter.label,
        value: counter.value,
        delta: counter.value - prev,
      });
    }
  }, [sharedState?.customCounter]);

  const calendarDays = sharedCalendar
    ? getCampaignDays(
        sharedCalendar.currentTime,
        sharedCalendar.startTime,
        sharedCalendar.config
      )
    : playerCalendar
      ? getCampaignDays(
          playerCalendar.currentTime,
          playerCalendar.startTime ?? 0,
          playerCalendar.config
        )
      : null;

  const handleAfterSave = useCallback(() => {
    if (playerSync.syncEnabled && playerSync.autoSync && character) {
      playerSync.syncNow(character);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    playerSync.syncEnabled,
    playerSync.autoSync,
    playerSync.syncNow,
    character,
  ]);

  const { manualSave } = useAutoSave({ onAfterSave: handleAfterSave });

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

  const switchToTab = useCallback((tabId: string) => {
    tabbedSheetRef.current?.switchToTab(tabId);
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

  const handleToggleInspiration = () => {
    if ((character.heroicInspiration?.count || 0) > 0) {
      spendHeroicInspiration();
    } else {
      addHeroicInspiration();
    }
  };

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
          {/* Party HP Sidebar */}
          <PartyHPSidebar
            campaignCode={playerSync.campaignCode ?? null}
            currentCharacterId={characterId}
          />

          {/* Header */}
          <CharacterSheetHeader
            characterId={characterId}
            characterName={character.name}
            characterRace={character.race}
            characterClass={
              getClassDisplayString() ||
              character.class?.name ||
              'Unknown Class'
            }
            characterLevel={character.totalLevel || character.level}
            characterAlignment={character.alignment}
            characterCreatureType={character.creatureType || 'Humanoid'}
            saveStatus={saveStatus}
            lastSaved={lastSaved}
            hasUnsavedChanges={hasUnsavedChanges}
            onManualSave={manualSave}
            onExport={handleExport}
            onShowResetModal={() => setShowResetModal(true)}
            onUpdateName={name => updateCharacter({ name })}
            onAddToast={addToast}
            extraHeaderContent={
              <SyncIndicator
                syncStatus={playerSync.syncStatus}
                lastSyncedAt={playerSync.lastSyncedAt}
                campaignCode={playerSync.campaignCode}
                campaignName={playerSync.campaignName}
                autoSync={playerSync.autoSync}
                syncEnabled={playerSync.syncEnabled}
                onSyncNow={playerSync.syncNow}
                onToggleAutoSync={playerSync.toggleAutoSync}
                onLeaveCampaign={playerSync.leaveCampaign}
                characterData={character}
                shareHpWithParty={character.shareHpWithParty ?? true}
                onToggleShareHp={toggleShareHpWithParty}
              />
            }
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

            {/* Character HUD */}
            <CharacterHUD
              character={character}
              calendarDays={calendarDays}
              onShortRest={() => setPendingRestType('short')}
              onLongRest={() => setPendingRestType('long')}
              onIncrementDays={incrementDaysSpent}
              onDecrementDays={() =>
                updateDaysSpent(Math.max(0, (character.daysSpent || 0) - 1))
              }
              onToggleInspiration={handleToggleInspiration}
              onToggleReaction={toggleReaction}
              onUseBardicInspiration={useBardicInspiration}
              onRestoreBardicInspiration={restoreBardicInspiration}
              onStopConcentration={stopConcentration}
              onNavigateToConditions={() => {
                switchToTab('conditions');
                setTimeout(() => {
                  document
                    .getElementById('conditions-section')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 150);
              }}
              onNavigateToBuffs={() => {
                switchToTab('combat');
              }}
              onNavigateToCombat={() => {
                switchToTab('combat');
              }}
              onNavigateToSpells={() => {
                switchToTab('spells');
              }}
              onToggleBuff={toggleBuff}
              onUpdateCharacter={updateCharacter}
            />

            {/* DM Effects (applied by DM in encounter) */}
            {pendingEffectToasts.length > 0 && (
              <DmEffectsNotification
                effects={pendingEffectToasts}
                onDismiss={() => setPendingEffectToasts([])}
              />
            )}

            {/* DM Custom Counter change notification */}
            {counterToast && (
              <DmCounterNotification
                label={counterToast.label}
                value={counterToast.value}
                delta={counterToast.delta}
                onDismiss={() => setCounterToast(null)}
              />
            )}

            {/* DM Message Notifications */}
            {(sharedState?.messages?.length ?? 0) > 0 && (
              <DmMessageNotification
                messages={sharedState!.messages}
                onAccept={msg => {
                  acknowledgeMessage(msg.id);
                  switchToTab('character');
                  setCharacterSubTab('notes');
                }}
                onDismiss={messageId => {
                  acknowledgeMessage(messageId);
                }}
              />
            )}

            {/* Item Transfer Notifications */}
            {pendingTransfers.length > 0 && (
              <ItemTransferNotification
                transfers={pendingTransfers}
                onDismiss={clearPendingTransfer}
                onNavigateToInventory={() => {
                  switchToTab('inventory');
                }}
              />
            )}

            {/* Rest Dialog triggered from HUD */}
            <RestDialog
              restType={pendingRestType}
              onConfirm={() => {
                if (pendingRestType === 'short') {
                  takeShortRest();
                  showShortRest();
                } else if (pendingRestType === 'long') {
                  takeLongRest();
                  showLongRest();
                  // Advance calendar by 1 day if not synced with DM
                  if (!sharedCalendar) {
                    const cal = useCalendarStore
                      .getState()
                      .getCalendar(characterId);
                    if (cal) {
                      useCalendarStore
                        .getState()
                        .advanceTime(characterId, getMsPerDay(cal.config));
                    }
                  }
                }
              }}
              onClose={() => setPendingRestType(null)}
            />

            <main className="relative z-10 mx-auto max-w-7xl">
              <TabbedCharacterSheet
                ref={tabbedSheetRef}
                character={character}
                hasHydrated={hasHydrated}
                totalLevel={totalLevel}
                proficiencyBonus={proficiencyBonus}
                characterHasSpells={characterHasSpells}
                updateAbilityScore={updateAbilityScore}
                rollAbilityCheck={rollAbilityCheck}
                getSavingThrowModifier={getSavingThrowModifier}
                updateSavingThrowProficiency={updateSavingThrowProficiency}
                rollSavingThrow={rollSavingThrow}
                getSkillModifier={getSkillModifier}
                updateSkillProficiency={updateSkillProficiency}
                updateSkillExpertise={updateSkillExpertise}
                toggleJackOfAllTrades={toggleJackOfAllTrades}
                rollSkillCheck={rollSkillCheck}
                toggleSkillBonusAbility={toggleSkillBonusAbility}
                updateCharacter={updateCharacter}
                updateClass={updateClass}
                updateLevel={updateLevel}
                addClassLevel={addClassLevel}
                removeClassLevel={removeClassLevel}
                updateClassLevel={updateClassLevel}
                getClassDisplayString={getClassDisplayString}
                addExperience={addExperience}
                setExperience={setExperience}
                updateSpellSlot={updateSpellSlot}
                updatePactMagicSlot={updatePactMagicSlot}
                resetSpellSlots={resetSpellSlots}
                resetPactMagicSlots={resetPactMagicSlots}
                getInitiativeModifier={getInitiativeModifier}
                updateInitiative={updateInitiative}
                resetInitiativeToDefault={resetInitiativeToDefault}
                toggleReaction={toggleReaction}
                resetReaction={resetReaction}
                rollInitiative={rollInitiative}
                updateTempArmorClass={updateTempArmorClass}
                toggleTempAC={toggleTempAC}
                toggleShield={toggleShield}
                updateShieldBonus={updateShieldBonus}
                applyDamageToCharacter={applyDamageToCharacter}
                applyHealingToCharacter={applyHealingToCharacter}
                addTemporaryHPToCharacter={addTemporaryHPToCharacter}
                makeDeathSavingThrow={makeDeathSavingThrow}
                resetDeathSavingThrows={resetDeathSavingThrows}
                toggleHPCalculationMode={toggleHPCalculationMode}
                recalculateMaxHP={recalculateMaxHP}
                updateHitPoints={updateHitPoints}
                useHitDie={useHitDie}
                restoreHitDice={restoreHitDice}
                resetAllHitDice={resetAllHitDice}
                showAttackRoll={showAttackRoll}
                showSavingThrow={showSavingThrow}
                showDamageRoll={showDamageRoll}
                animateRoll={diceBoxInitialized ? rollDice : undefined}
                switchToTab={switchToTab}
                stopConcentration={stopConcentration}
                addExtendedFeature={addExtendedFeature}
                updateExtendedFeature={updateExtendedFeature}
                deleteExtendedFeature={deleteExtendedFeature}
                useExtendedFeature={useExtendedFeature}
                resetExtendedFeatures={resetExtendedFeatures}
                reorderExtendedFeatures={reorderExtendedFeatures}
                addSpellsFromFeat={handleAddSpellsFromFeat}
                addToolProficiency={addToolProficiency}
                updateToolProficiency={updateToolProficiency}
                deleteToolProficiency={deleteToolProficiency}
                addHeroicInspiration={addHeroicInspiration}
                updateHeroicInspiration={updateHeroicInspiration}
                useHeroicInspiration={spendHeroicInspiration}
                resetHeroicInspiration={resetHeroicInspiration}
                useBardicInspiration={useBardicInspiration}
                restoreBardicInspiration={restoreBardicInspiration}
                resetBardicInspiration={resetBardicInspiration}
                addLanguage={addLanguage}
                deleteLanguage={deleteLanguage}
                addFeature={addFeature}
                updateFeature={updateFeature}
                deleteFeature={deleteFeature}
                addTrait={addTrait}
                updateTrait={updateTrait}
                deleteTrait={deleteTrait}
                updateCharacterBackground={updateCharacterBackground}
                addNote={addNote}
                updateNote={updateNote}
                deleteNote={deleteNote}
                reorderNotes={reorderNotes}
                addToast={addToast}
                calendarDays={calendarDays}
                campaignCode={playerSync.campaignCode ?? undefined}
                customCounter={sharedState?.customCounter}
                locationCount={syncedLocations.length}
              />
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
