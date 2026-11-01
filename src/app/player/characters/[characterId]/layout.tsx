import type { ReactNode } from 'react';
import { CharacterThemeScope } from '@/components/ui/character/CharacterThemeScope';

export default async function CharacterLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ characterId: string }>;
}) {
  const { characterId } = await params;
  return (
    <CharacterThemeScope characterId={characterId}>
      {children}
    </CharacterThemeScope>
  );
}
