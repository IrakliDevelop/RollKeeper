'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CharacterExport } from '@/types/character';
import { usePlayerStore } from '@/store/playerStore';
import { Button } from '@/components/ui/forms/button';

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
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="bg-surface-raised border-divider w-full max-w-md rounded-xl border p-8 text-center shadow-xl">
        <h1 className="text-heading mb-6 text-2xl font-bold">
          Import Character
        </h1>

        {/* Avatar */}
        <div className="mb-4 flex justify-center">
          {hasS3Avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={character.avatar}
              alt={character.name}
              className="h-24 w-24 rounded-full object-cover"
            />
          ) : (
            <div className="bg-surface-secondary text-heading flex h-24 w-24 items-center justify-center rounded-full text-3xl font-bold">
              {character.name?.[0]?.toUpperCase() ?? '?'}
            </div>
          )}
        </div>

        <h2 className="text-heading mb-1 text-xl font-bold">
          {character.name}
        </h2>
        <p className="text-muted mb-6">
          {character.race} {className} · Level {character.level}
        </p>

        <Button
          onClick={handleImport}
          variant="primary"
          disabled={importing}
          className="w-full"
        >
          {importing ? 'Importing...' : 'Import Character'}
        </Button>
        <p className="text-faint mt-3 text-sm">
          This will add the character to your roster
        </p>
      </div>
    </div>
  );
}
