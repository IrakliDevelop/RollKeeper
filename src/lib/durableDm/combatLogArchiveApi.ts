import { changedOnAnotherBrowserMessage } from './familyConflictMessage';

export async function combatLogArchiveApi<T>(
  body: Record<string, unknown>
): Promise<T> {
  const response = await fetch('/api/combat-log-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-rollkeeper-csrf': '1' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = new Error(
      response.status === 409
        ? changedOnAnotherBrowserMessage('Combat log archives')
        : 'Combat log archive cloud request failed.'
    ) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return (await response.json()) as T;
}
