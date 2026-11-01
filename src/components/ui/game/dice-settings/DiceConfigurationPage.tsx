'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { AppHeader } from '@/components/ui/layout/AppHeader';
import { SaveIndicator } from '@/components/ui/feedback/SaveIndicator';
import { DiceSetEditor } from '../DiceSetEditor';
import { useCharacterSettings } from '@/hooks/useCharacterSettings';
import { DEFAULT_DICE_SET, parseDiceSet } from '@/utils/diceSet';

export function DiceConfigurationPage({
  characterId,
}: {
  characterId: string;
}) {
  const {
    character,
    updateCharacter,
    saveStatus,
    lastSaved,
    hasUnsavedChanges,
    loading,
    missing,
  } = useCharacterSettings(characterId);
  if (loading)
    return (
      <p role="status" className="type-body text-muted p-6">
        Loading dice settings…
      </p>
    );
  if (missing)
    return (
      <main className="mx-auto max-w-5xl space-y-4 p-6">
        <h1 className="type-heading text-heading">
          Character not found on this device
        </h1>
        <Button asChild>
          <Link href="/player">Back to characters</Link>
        </Button>
      </main>
    );
  return (
    <>
      <AppHeader
        sticky
        leading={
          <Button asChild variant="ghost" leftIcon={<ArrowLeft size={16} />}>
            <Link
              href={`/player/characters/${encodeURIComponent(characterId)}`}
            >
              Character sheet
            </Link>
          </Button>
        }
        title={
          <div>
            <h1 className="type-subheading text-heading">Configure dice</h1>
            <p className="type-small text-muted truncate">{character.name}</p>
          </div>
        }
        actions={
          <SaveIndicator
            status={saveStatus}
            lastSaved={lastSaved}
            hasUnsavedChanges={hasUnsavedChanges}
          />
        }
      />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <p className="type-body text-muted">
          These dice belong to {character.name}. Changes save automatically and
          apply to rolls from this character sheet.
        </p>
        <DiceSetEditor
          key={characterId}
          value={parseDiceSet(character.diceSet) ?? DEFAULT_DICE_SET}
          onChange={diceSet => updateCharacter({ diceSet })}
        />
      </main>
    </>
  );
}
