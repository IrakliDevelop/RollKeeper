import { getRedis, characterShareKey } from '@/lib/redis';
import { CharacterExport } from '@/types/character';
import ImportCharacterPage from './ImportCharacterPage';

export default async function ImportPage({
  params,
}: {
  params: Promise<{ characterId: string }>;
}) {
  const { characterId } = await params;
  const redis = getRedis();

  let exportData: CharacterExport | null = null;
  try {
    const raw = await redis.get<string>(characterShareKey(characterId));
    if (raw) {
      exportData =
        typeof raw === 'string' ? JSON.parse(raw) : (raw as CharacterExport);
    }
  } catch {
    // Redis unavailable — treat as expired
  }

  if (!exportData) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-heading mb-2 text-2xl font-bold">Link Expired</h1>
          <p className="text-muted">
            This share link has expired or is invalid. Ask the character owner
            to generate a new one.
          </p>
        </div>
      </div>
    );
  }

  return <ImportCharacterPage exportData={exportData} />;
}
