import type { InitiativeRollRequest } from '@/types/sharedState';

const STORAGE_KEY = 'rollkeeper-initiative-submitted';

function readMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function getSubmittedRequestId(characterId: string): string | null {
  return readMap()[characterId] ?? null;
}

export function markSubmitted(characterId: string, requestId: string): void {
  try {
    const map = readMap();
    map[characterId] = requestId;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // storage unavailable — prompt re-shows after reload; harmless
  }
}

/** Prompt shows for an active, unanswered request while combat hasn't started. */
export function shouldShowInitiativePrompt({
  request,
  initiativeActive,
  submittedRequestId,
}: {
  request: InitiativeRollRequest | null;
  initiativeActive: boolean;
  submittedRequestId: string | null;
}): boolean {
  if (!request || initiativeActive) return false;
  return request.requestId !== submittedRequestId;
}
