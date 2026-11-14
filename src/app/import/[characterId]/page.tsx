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
      <main className="bg-surface flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <h1 className="type-heading text-heading">Link expired</h1>
          <p className="type-body text-muted mt-2">
            {
              "This share link has expired or doesn't exist. Ask the player who shared it for a new link."
            }
          </p>
        </div>
      </main>
    );
  }

  return <ImportCharacterPage exportData={exportData} />;
}
