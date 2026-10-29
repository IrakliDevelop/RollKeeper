'use client';

import { Download, Upload, RotateCcw, ArrowLeft, Share2 } from 'lucide-react';
import Link from 'next/link';
import { SaveIndicator } from '@/components/ui/feedback/SaveIndicator';
import { Badge } from '@/components/ui/layout/badge';
import { AppHeader } from '@/components/ui/layout/AppHeader';
import { usePlayerStore } from '@/store/playerStore';
import { useCharacterStore } from '@/store/characterStore';
import type { SaveStatus } from '@/types/character';
import { useState } from 'react';
import { Button, Input, Switch } from '@/components/ui/forms';
import { AvatarUpload } from './AvatarUpload';
import { QRShareDialog } from './QRShareDialog';
import { useSheetMode } from './SheetMode';

interface CharacterSheetHeaderProps {
  characterId: string;
  characterName: string;
  characterRace: string;
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
  onManualSave,
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
          </>
        }
        subbar={
          editing ? (
            <p className="type-small text-body py-1">Editing sheet</p>
          ) : undefined
        }
      />

      {/* Main Character Header */}
      <header className="relative z-30 mx-auto mb-8 max-w-7xl">
        <div className="border-divider bg-surface-raised/90 rounded-xl border p-6 shadow-xl backdrop-blur-sm">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <AvatarUpload
              avatar={playerCharacter?.avatar}
              characterId={characterId}
              characterName={characterName}
              onAvatarChange={handleAvatarChange}
              size="lg"
              editable={editing}
            />

            {/* Name Input and Buttons - side by side */}
            <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-4">
              <div className="min-w-64 flex-1">
                {editing ? (
                  <Input
                    type="text"
                    placeholder="Character Name"
                    value={characterName}
                    onChange={e => onUpdateName(e.target.value)}
                    className="text-text-primary placeholder-text-tertiary w-full border-none bg-transparent text-3xl font-bold"
                    size="lg"
                  />
                ) : (
                  <h2 className="text-heading w-full text-3xl font-bold">
                    {characterName || 'Unnamed Character'}
                  </h2>
                )}
                {/* Identity line */}
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                  {characterRace && (
                    <span className="text-body text-sm">{characterRace}</span>
                  )}
                  {characterRace && characterClass && (
                    <span className="text-faint">·</span>
                  )}
                  {characterClass && (
                    <Badge variant="info">{characterClass}</Badge>
                  )}
                  {characterCreatureType &&
                    characterCreatureType !== 'Humanoid' && (
                      <>
                        <span className="text-faint">·</span>
                        <Badge variant="neutral">{characterCreatureType}</Badge>
                      </>
                    )}
                  {characterAlignment && (
                    <>
                      <span className="text-faint">·</span>
                      <span className="text-muted text-sm">
                        {characterAlignment}
                      </span>
                    </>
                  )}
                </div>
                <SaveIndicator
                  status={saveStatus}
                  lastSaved={lastSaved}
                  hasUnsavedChanges={hasUnsavedChanges}
                  className="mt-1"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap justify-end gap-2">
                {/* <Button
                  onClick={onManualSave}
                  disabled={!hasUnsavedChanges}
                  variant="success"
                  size="sm"
                  leftIcon={<Save size={16} />}
                >
                  Save
                </Button> */}
                <Button
                  onClick={onExport}
                  variant="outline"
                  size="sm"
                  leftIcon={<Download size={16} />}
                >
                  Export
                </Button>

                <Button
                  onClick={() => setShareOpen(true)}
                  variant="outline"
                  size="sm"
                  leftIcon={<Share2 size={16} />}
                  title="Share character via QR code"
                >
                  Share
                </Button>

                <Button asChild variant="outline" size="sm">
                  <label className="cursor-pointer">
                    <span className="flex items-center gap-2">
                      <Upload size={16} />
                      Import
                    </span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={async e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            const text = await file.text();
                            const data = JSON.parse(text);
                            const { importCharacter: importToPlayerStore } =
                              usePlayerStore.getState();
                            const newCharacterId = importToPlayerStore(data);

                            onAddToast({
                              type: 'success',
                              title: 'Import Successful',
                              message:
                                'Character imported successfully! Redirecting to new character...',
                            });

                            setTimeout(() => {
                              window.location.href = `/player/characters/${newCharacterId}`;
                            }, 1500);
                          } catch (error) {
                            console.error('Import failed:', error);
                            onAddToast({
                              type: 'error',
                              title: 'Import Failed',
                              message:
                                'Failed to import character. Please check the file format.',
                            });
                          }
                        }
                        e.target.value = '';
                      }}
                      className="hidden"
                    />
                  </label>
                </Button>

                <Button
                  onClick={onShowResetModal}
                  variant="danger"
                  size="sm"
                  leftIcon={<RotateCcw size={16} />}
                  title="Reset character - this will clear all data!"
                >
                  Reset
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <QRShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        characterId={characterId}
        getExportData={exportCharacter}
      />
    </>
  );
}
