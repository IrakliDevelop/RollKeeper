import { CharacterAppearancePage } from '@/components/ui/appearance/CharacterAppearancePage';

export default async function Page({
  params,
}: {
  params: Promise<{ characterId: string }>;
}) {
  const { characterId } = await params;
  return <CharacterAppearancePage characterId={characterId} />;
}
