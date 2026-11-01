'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Plus,
  Archive,
  Edit3,
  Trash2,
  Copy,
  Upload,
  Download,
  Link2,
} from 'lucide-react';
import { usePlayerStore, PlayerCharacter } from '@/store/playerStore';
import { Button } from '@/components/ui/forms';
import { Badge, Card, Section } from '@/components/ui/layout';
import { AppHeader } from '@/components/ui/layout/AppHeader';
import { Switch } from '@/components/ui/forms/switch';
import { AvatarUpload } from '@/components/ui/character/AvatarUpload';
import { JoinCampaignDialog } from '@/components/ui/campaign/JoinCampaignDialog';
import { ToastContainer, useToast } from '@/components/ui/feedback/Toast';
import {
  alertDialog,
  confirmDialog,
  promptDialog,
} from '@/components/ui/feedback/confirm-dialog';
import { DataSafetyBanner } from '@/components/ui/feedback/DataSafetyBanner';
import { DeviceRecoveryControls } from '@/components/ui/feedback/DeviceRecoveryControls';
import { CharacterStorageMigrationControls } from '@/components/ui/feedback/CharacterStorageMigrationControls';
import { CharacterCloudBackupControls } from '@/components/ui/character/CharacterCloudBackupControls';
import { CharacterAutomaticSyncControls } from '@/components/ui/character/CharacterAutomaticSyncControls';
import { PlayerBackupDashboardSurface } from '@/components/ui/character/PlayerBackupDashboardSurface';
import { awaitCharacterPersistenceResult } from '@/lib/indexeddb/characterPersistenceRuntime';
import { isPlayerBackupWizardVisible } from '@/lib/playerBackup/playerBackupFlags';
import { recordAutomaticCharacterDelete } from '@/lib/supabase/automaticCharacterSyncRuntime';
import { useStorageQuotaListener } from '@/hooks/useStorageQuotaListener';
import {
  exportAllCharactersToFile,
  isCharacterBackup,
} from '@/utils/fileOperations';

export default function PlayerDashboardPage() {
  const {
    characters,
    getActiveCharacters,
    getArchivedCharacters,
    setActiveCharacter,
    archiveCharacter,
    restoreCharacter,
    deleteCharacter,
    duplicateCharacter,
    addCloudRecoveredCharacter,
    migrateFromOldStorage,
    importCharacter,
    updateCharacter,
    settings,
    updateSettings,
  } = usePlayerStore();

  const [showSettings, setShowSettings] = useState(false);
  const [focusSection, setFocusSection] = useState<
    'active' | 'archived' | null
  >(null);
  const pageHeadingRef = React.useRef<HTMLHeadingElement>(null);
  const activeHeadingRef = React.useRef<HTMLHeadingElement>(null);
  const archivedHeadingRef = React.useRef<HTMLHeadingElement>(null);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const { toasts, addToast, dismissToast } = useToast();

  const activeCharacters = getActiveCharacters();
  const archivedCharacters = getArchivedCharacters();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const wizardOwnsBackup = isPlayerBackupWizardVisible();

  useEffect(() => {
    if (!focusSection) return;
    const target = (
      focusSection === 'active' ? activeHeadingRef : archivedHeadingRef
    ).current;
    (target ?? pageHeadingRef.current)?.focus();
    setFocusSection(null);
  }, [focusSection, characters]);

  const handleExportAll = useCallback(() => {
    if (characters.length === 0) return;
    exportAllCharactersToFile(characters);
    addToast({
      type: 'success',
      title: 'Backup exported',
      message: `Saved a backup of ${characters.length} character${
        characters.length === 1 ? '' : 's'
      }. Keep it somewhere safe.`,
      duration: 5000,
    });
  }, [characters, addToast]);

  // Surface a clear warning if a localStorage save ever fails (quota full).
  useStorageQuotaListener(
    useCallback(() => {
      addToast({
        type: 'error',
        title: 'Save failed — storage full',
        message:
          'Your latest change could not be saved. Export a backup now to avoid losing data.',
        duration: 12000,
      });
    }, [addToast])
  );

  // Check for migration on component mount
  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (characters.length === 0) {
      const migrated = migrateFromOldStorage();
      if (migrated) {
        console.log('Successfully migrated character from old storage');
      }
    }
  }, [characters.length, migrateFromOldStorage]);

  const handlePlayCharacter = (character: PlayerCharacter) => {
    setActiveCharacter(character.id);
  };

  const characterNameFor = (characterId: string) =>
    characters.find(character => character.id === characterId)?.name ??
    'this character';

  const handleArchiveCharacter = async (characterId: string) => {
    const confirmed = await confirmDialog({
      title: `Archive ${characterNameFor(characterId)}?`,
      message: 'You can restore it from your archived characters.',
      confirmLabel: 'Archive character',
    });
    if (confirmed) {
      archiveCharacter(characterId);
      setFocusSection('archived');
    }
  };

  const handleDeleteCharacter = async (characterId: string) => {
    const confirmed = await confirmDialog({
      title: `Delete ${characterNameFor(characterId)}?`,
      message: "This can't be undone.",
      confirmLabel: 'Delete character',
      tone: 'danger',
    });
    if (!confirmed) return;
    // Read the roster after the dialog: it may have changed while it was open.
    const beforeImage = usePlayerStore
      .getState()
      .characters.find(character => character.id === characterId);
    deleteCharacter(characterId);
    setFocusSection('archived');
    if (beforeImage) {
      void awaitCharacterPersistenceResult().then(result => {
        if (result.saved) return recordAutomaticCharacterDelete(beforeImage);
      });
    }
  };

  const handleDuplicateCharacter = async (character: PlayerCharacter) => {
    const newName = await promptDialog({
      title: `Duplicate ${character.name}`,
      label: 'Name',
      defaultValue: `${character.name} (Copy)`,
      confirmLabel: 'Duplicate character',
    });
    if (newName) {
      duplicateCharacter(character.id, newName);
    }
  };

  const handleImportCharacter = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        const fileText = await file.text();
        const characterData = JSON.parse(fileText);

        // Full-roster backup bundle → restore every character in it.
        if (isCharacterBackup(characterData)) {
          const count = characterData.characters.length;
          characterData.characters.forEach(c => importCharacter(c));
          addToast({
            type: 'success',
            title: 'Backup restored',
            message: `Imported ${count} character${count === 1 ? '' : 's'} from the backup.`,
            duration: 5000,
          });
          event.target.value = '';
          return;
        }

        let characterName = 'Imported Character';
        if (characterData.name) {
          characterName = characterData.name;
        } else if (characterData.characterName) {
          characterName = characterData.characterName;
        } else if (characterData.state?.name) {
          characterName = characterData.state.name;
        } else if (characterData.character?.name) {
          characterName = characterData.character.name;
        } else if (characterData.characterData?.name) {
          characterName = characterData.characterData.name;
        }

        const characterId = importCharacter(characterData, characterName);
        // Clear the input now: the dialog below waits for the player.
        event.target.value = '';
        const openSheet = await confirmDialog({
          title: `${characterName} imported`,
          confirmLabel: 'Open character',
          cancelLabel: 'Stay here',
        });
        if (openSheet) {
          window.location.href = `/player/characters/${characterId}`;
        }
      } catch (error) {
        console.error('Import failed:', error);
        void alertDialog({
          title: "Couldn't import the character",
          message: 'Check that the file is a RollKeeper character export.',
        });
      }
    }
    // Reset the input
    event.target.value = '';
  };

  const handleTryMigration = () => {
    const migrated = migrateFromOldStorage();
    void alertDialog({
      title: migrated
        ? 'Old character migrated'
        : 'No old character data found',
    });
  };

  const handleJoinCampaign = (
    code: string,
    characterId: string,
    campaignName: string
  ) => {
    updateCharacter(characterId, {
      campaignCode: code,
      campaignName,
      syncEnabled: true,
      autoSync: true,
      lastSyncedAt: new Date().toISOString(),
    });

    const character = characters.find(c => c.id === characterId);
    addToast({
      type: 'success',
      title: 'Campaign Joined',
      message: `${character?.name ?? 'Your character'} is now synced to "${campaignName}".`,
      details: ['Auto-sync is enabled', 'Your DM will see your character data'],
      duration: 5000,
    });
  };

  const renderCharacter = (character: PlayerCharacter, isArchived = false) => (
    <Card key={character.id} padding="none" className="min-w-0 p-4 sm:p-5">
      <div className="flex min-w-0 items-start gap-3">
        <AvatarUpload
          avatar={character.avatar}
          characterId={character.id}
          characterName={character.name || 'Character'}
          onAvatarChange={() => {}}
          size="sm"
          editable={false}
        />
        <div className="min-w-0 flex-1">
          <h3 className="type-subheading text-heading break-words">
            {character.name || 'Unnamed character'}
          </h3>
          <p className="type-small text-body mt-1">
            {[
              character.race,
              character.class,
              character.level && `Level ${character.level}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {character.campaignCode && (
            <p className="type-small text-muted mt-1 break-words">
              {character.campaignName || character.campaignCode}
            </p>
          )}
          {(character.tags ?? []).length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {(character.tags ?? []).map(tag => (
                <Badge key={tag} variant="neutral" size="sm">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {!isArchived ? (
          <>
            <Button asChild variant="secondary" size="sm">
              <Link
                href={`/player/characters/${character.id}`}
                onClick={() => handlePlayCharacter(character)}
              >
                Open character
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link
                href={`/player/characters/${character.id}/edit`}
                aria-label={`Edit ${character.name || 'character'}`}
              >
                <Edit3 size={16} aria-hidden />
              </Link>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Duplicate ${character.name || 'character'}`}
              onClick={() => void handleDuplicateCharacter(character)}
            >
              <Copy size={16} aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Archive ${character.name || 'character'}`}
              onClick={() => void handleArchiveCharacter(character.id)}
            >
              <Archive size={16} aria-hidden />
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                restoreCharacter(character.id);
                setFocusSection('archived');
              }}
            >
              Restore character
            </Button>
            <Button
              variant="danger"
              size="sm"
              aria-label={`Delete ${character.name || 'character'}`}
              onClick={() => void handleDeleteCharacter(character.id)}
            >
              <Trash2 size={16} aria-hidden />
            </Button>
          </>
        )}
      </div>
    </Card>
  );

  if (!hasMounted) return null;

  return (
    <div className="bg-surface min-h-screen">
      <AppHeader
        title={
          <h1
            ref={pageHeadingRef}
            tabIndex={-1}
            className="type-heading text-heading"
          >
            Characters
          </h1>
        }
      />
      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            asChild
            variant="primary"
            leftIcon={<Plus size={18} aria-hidden />}
          >
            <Link href="/player/characters/new">Create character</Link>
          </Button>
          <Button
            onClick={() => setJoinDialogOpen(true)}
            leftIcon={<Link2 size={18} aria-hidden />}
          >
            Join campaign
          </Button>
          <Button
            onClick={() => fileInputRef.current?.click()}
            leftIcon={<Upload size={18} aria-hidden />}
          >
            Import character
          </Button>
          {characters.length > 0 && !wizardOwnsBackup && (
            <Button
              onClick={handleExportAll}
              leftIcon={<Download size={18} aria-hidden />}
            >
              Export all
            </Button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            aria-label="Character import file"
            onChange={handleImportCharacter}
            className="sr-only"
          />
        </div>

        {wizardOwnsBackup ? <PlayerBackupDashboardSurface /> : null}
        {!wizardOwnsBackup && characters.length > 0 && (
          <DataSafetyBanner onExport={handleExportAll} />
        )}

        {activeCharacters.length === 0 && archivedCharacters.length === 0 ? (
          <div className="py-10 text-center">
            <h2 className="type-subheading text-heading">
              Create your first character
            </h2>
            <p className="type-body text-muted mt-2">
              Create a character or import a RollKeeper character file.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            <p className="type-small text-muted">
              {activeCharacters.length} active · {archivedCharacters.length}{' '}
              archived
            </p>
            {activeCharacters.length > 0 && (
              <Section
                heading={`Active characters (${activeCharacters.length})`}
                level={2}
              >
                <h2 ref={activeHeadingRef} tabIndex={-1} className="sr-only">
                  Active characters
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {activeCharacters.map(character =>
                    renderCharacter(character)
                  )}
                </div>
              </Section>
            )}
            {archivedCharacters.length > 0 && (
              <Section
                heading={`Archived characters (${archivedCharacters.length})`}
                level={2}
              >
                <h2 ref={archivedHeadingRef} tabIndex={-1} className="sr-only">
                  Archived characters
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {archivedCharacters.map(character =>
                    renderCharacter(character, true)
                  )}
                </div>
              </Section>
            )}
          </div>
        )}

        {!wizardOwnsBackup && (
          <>
            <Section heading="Full browser recovery" level={2}>
              <p className="type-body text-muted mb-3">
                Back up all RollKeeper browser data or stage a recovery file for
                review without replacing active values.
              </p>
              <DeviceRecoveryControls />
              <CharacterStorageMigrationControls />
            </Section>
            <CharacterCloudBackupControls
              characters={characters}
              onAddCharacter={character =>
                addCloudRecoveredCharacter(character as PlayerCharacter)
              }
            />
            <CharacterAutomaticSyncControls characters={characters} />
          </>
        )}

        <Section heading="Settings" level={2}>
          <Button
            variant="ghost"
            aria-expanded={showSettings}
            onClick={() => setShowSettings(!showSettings)}
          >
            {showSettings
              ? 'Hide animation settings'
              : 'Show animation settings'}
          </Button>
          {showSettings && (
            <div className="mt-4 space-y-4">
              <Switch
                label="Death animation"
                description="Show the death screen when your character dies."
                checked={settings?.enableDeathAnimation ?? false}
                onCheckedChange={checked =>
                  updateSettings({ enableDeathAnimation: checked })
                }
              />
              <Switch
                label="Level up animation"
                description="Show the level up animation."
                checked={settings?.enableLevelUpAnimation ?? false}
                onCheckedChange={checked =>
                  updateSettings({ enableLevelUpAnimation: checked })
                }
              />
              <Switch
                label="Combat start banner"
                description="Show a banner when the DM starts combat."
                checked={settings?.enableCombatStartBanner ?? false}
                onCheckedChange={checked =>
                  updateSettings({ enableCombatStartBanner: checked })
                }
              />
            </div>
          )}
        </Section>
        <JoinCampaignDialog
          open={joinDialogOpen}
          onOpenChange={setJoinDialogOpen}
          characters={characters}
          onJoin={handleJoinCampaign}
        />
      </main>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
