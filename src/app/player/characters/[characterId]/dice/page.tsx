import { DiceConfigurationPage } from '@/components/ui/game/dice-settings/DiceConfigurationPage';

export default async function Page({
  params,
}: {
  params: Promise<{ characterId: string }>;
}) {
  const { characterId } = await params;
  return <DiceConfigurationPage characterId={characterId} />;
}
