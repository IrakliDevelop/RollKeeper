import { changedOnAnotherBrowserMessage } from './familyConflictMessage';

export async function npcApi<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch('/api/npc-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-rollkeeper-csrf': '1' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = new Error(
      response.status === 409
        ? changedOnAnotherBrowserMessage('NPCs')
        : 'NPC cloud request failed.'
    ) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return (await response.json()) as T;
}
