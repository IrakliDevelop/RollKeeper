'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { SaveIndicator } from '@/components/ui/feedback/SaveIndicator';
import { InPlaceTextField } from '@/components/ui/forms/InPlaceTextField';
import { CharacterActions } from './CharacterActions';
import { AppHeader } from '@/components/ui/layout/AppHeader';
import { usePlayerStore } from '@/store/playerStore';
import { useCharacterStore } from '@/store/characterStore';
import type { SaveStatus } from '@/types/character';
import { useState } from 'react';
import { Button, Switch } from '@/components/ui/forms';
import { AvatarUpload } from './AvatarUpload';
import { QRShareDialog } from './QRShareDialog';
import { useSheetMode } from './SheetMode';

interface CharacterSheetHeaderProps {
  characterId: string;
  characterName: string;
  characterRace: string;
  /** Already formatted by getClassDisplayString(), including class levels. */
  characterClass: string;
  characterLevel: number;
  characterAlignment: string;
  characterCreatureType: string;
  saveStatus: SaveStatus;
  lastSaved: Date | string | null;
  hasUnsavedChanges: boolean;
  onManualSave: () => void;
  onExport: () => void;
  onShowResetModal: () => void;
  onUpdateName: (name: string) => void;
  onAddToast: (toast: {
    type: 'error' | 'damage' | 'attack' | 'save' | 'info' | 'success';
    title: string;
    message: string;
  }) => void;
  extraHeaderContent?: React.ReactNode;
}

export default function CharacterSheetHeader({
  characterId,
  characterName,
  characterRace,
  characterClass,
  characterLevel,
  characterAlignment,
  characterCreatureType,
  saveStatus,
  lastSaved,
  hasUnsavedChanges,
  onExport,
  onShowResetModal,
  onUpdateName,
  onAddToast,
  extraHeaderContent,
}: CharacterSheetHeaderProps) {
  const { exportCharacter, updateCharacter } = useCharacterStore();
  const { getCharacterById, updateCharacterData } = usePlayerStore();

  // Get character data for avatar
  const playerCharacter = getCharacterById(characterId);

  // Handle avatar change
  const handleAvatarChange = (newAvatar: string | undefined) => {
    // Update the live character store first — it is the source of truth that
    // useCharacterRosterSync writes back to the roster. Without this, the roster
    // write-back would overwrite (clobber) the uploaded avatar on the next edit
    // or reload.
    updateCharacter({ avatar: newAvatar });

    // Also update the roster blob directly for immediate display feedback.
    if (playerCharacter?.characterData) {
      updateCharacterData(characterId, {
        ...playerCharacter.characterData,
        avatar: newAvatar,
      });
    }
  };

  const { editing, setEditing } = useSheetMode();
  const [shareOpen, setShareOpen] = useState(false);

  return (
    <>
      <AppHeader
        sticky
        wrapControls
        leading={
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="shrink-0 px-2 whitespace-nowrap sm:px-4"
            leftIcon={<ArrowLeft size={20} />}
          >
            <Link href="/player">
              <span className="sr-only sm:not-sr-only">Characters</span>
            </Link>
          </Button>
        }
        title={
          <>
            <h1 className="type-subheading text-heading truncate">
              {characterName}
            </h1>
            <p className="type-small text-body truncate">
              {characterRace} {characterClass || 'Unknown Class'} • Level{' '}
              {characterLevel}
            </p>
          </>
        }
        actions={
          <>
            <Switch
              label="Edit sheet"
              size="sm"
              checked={editing}
              onCheckedChange={setEditing}
              labelClassName="sr-only sm:not-sr-only"
              wrapperClassName="min-h-6 shrink-0 items-center gap-0 whitespace-nowrap sm:gap-3"
            />
            <SaveIndicator
              lastSaved={lastSaved}
              status={saveStatus}
              textClassName="sr-only sm:not-sr-only"
            />
            {extraHeaderContent}
            <CharacterActions
              onExport={onExport}
              onShare={() => setShareOpen(true)}
              onReset={onShowResetModal}
              onAddToast={onAddToast}
            />
          </>
        }
        subbar={
          editing ? (
            <p className="type-small text-body py-1">Editing sheet</p>
          ) : undefined
        }
      />

      <section
        aria-labelledby="character-identity-name"
        className="border-divider relative z-30 mx-auto mb-8 max-w-7xl border-b pb-6"
      >
        <div className="flex flex-col items-start gap-4 sm:flex-row">
          <AvatarUpload
            avatar={playerCharacter?.avatar}
            characterId={characterId}
            characterName={characterName}
            onAvatarChange={handleAvatarChange}
            size="lg"
            editable={editing}
          />
          <div className="w-full min-w-0 flex-1">
            <h2
              id="character-identity-name"
              className="type-heading text-heading min-w-0"
            >
              <InPlaceTextField
                label="Character name"
                placeholder="Thalia Vane"
                value={
                  editing ? characterName : characterName || 'Unnamed character'
                }
                onCommit={onUpdateName}
                editing={editing}
              />
            </h2>
            <p className="type-body text-body mt-2">
              {[
                characterRace,
                characterClass,
                characterCreatureType,
                characterAlignment,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <SaveIndicator
              status={saveStatus}
              lastSaved={lastSaved}
              hasUnsavedChanges={hasUnsavedChanges}
              className="mt-1"
            />
          </div>
        </div>
      </section>

      <QRShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        characterId={characterId}
        getExportData={exportCharacter}
      />
    </>
  );
}
