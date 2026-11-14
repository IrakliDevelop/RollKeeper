'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CharacterExport } from '@/types/character';
import { usePlayerStore } from '@/store/playerStore';
import { Button } from '@/components/ui/forms/button';
import { Card } from '@/components/ui/layout/card';

interface ImportCharacterPageProps {
  exportData: CharacterExport;
}

export default function ImportCharacterPage({
  exportData,
}: ImportCharacterPageProps) {
  const router = useRouter();
  const [importing, setImporting] = useState(false);
  const { character } = exportData;

  // Prefer first class in multiclass array; fall back to legacy single class
  const className =
    character.classes?.[0]?.className ?? character.class?.name ?? 'Unknown';

  const handleImport = () => {
    setImporting(true);
    const newId = usePlayerStore.getState().importCharacter(exportData);
    router.push(`/player/characters/${newId}`);
  };

  const hasS3Avatar =
    character.avatar && !character.avatar.startsWith('data:image/');

  return (
    <main className="bg-surface flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <h1 className="type-heading text-heading">Import character</h1>

        <Card className="mt-6 flex min-w-0 items-center gap-4">
          {hasS3Avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={character.avatar}
              alt=""
              className="size-16 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div
              aria-hidden
              className="bg-surface-secondary text-heading type-subheading flex size-16 shrink-0 items-center justify-center rounded-full"
            >
              {character.name?.[0]?.toUpperCase() ?? '?'}
            </div>
          )}
          <div className="min-w-0">
            <h2 className="type-subheading text-heading break-words">
              {character.name}
            </h2>
            <p className="type-small text-muted mt-1">
              {[character.race, className, `Level ${character.level}`]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        </Card>

        <Button
          onClick={handleImport}
          variant="primary"
          disabled={importing}
          className="mt-6 w-full"
        >
          {importing ? 'Importing…' : 'Import character'}
        </Button>
        <p className="type-small text-muted mt-3">
          Adds this character to your roster on this device.
        </p>
      </div>
    </main>
  );
}
