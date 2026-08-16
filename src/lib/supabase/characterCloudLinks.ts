export const CHARACTER_CLOUD_LINKS_STORAGE_KEY =
  'rollkeeper-character-cloud-links-v1';

export interface PendingCharacterMutation {
  mutationId: string;
  contentFingerprint: string;
}

export interface CharacterCloudLink {
  accountId: string;
  legacyId: string;
  cloudId: string;
  serverVersion: number;
  contentFingerprint: string | null;
  pendingMutation?: PendingCharacterMutation | null;
}

export interface CharacterCloudLinkRepository {
  get(accountId: string, legacyId: string): CharacterCloudLink | null;
  save(link: CharacterCloudLink): void;
}

function identity(accountId: string, legacyId: string): string {
  return `${accountId}:${legacyId}`;
}

function parseLinks(raw: string | null): Record<string, CharacterCloudLink> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, CharacterCloudLink>)
      : {};
  } catch {
    return {};
  }
}

export function createCharacterCloudLinkRepository(
  storage: Pick<Storage, 'getItem' | 'setItem'>
): CharacterCloudLinkRepository {
  return {
    get(accountId, legacyId) {
      const links = parseLinks(
        storage.getItem(CHARACTER_CLOUD_LINKS_STORAGE_KEY)
      );
      return links[identity(accountId, legacyId)] ?? null;
    },
    save(link) {
      const links = parseLinks(
        storage.getItem(CHARACTER_CLOUD_LINKS_STORAGE_KEY)
      );
      links[identity(link.accountId, link.legacyId)] = structuredClone(link);
      storage.setItem(CHARACTER_CLOUD_LINKS_STORAGE_KEY, JSON.stringify(links));
    },
  };
}

export function createMemoryCharacterCloudLinkRepository(): CharacterCloudLinkRepository {
  const links = new Map<string, CharacterCloudLink>();
  return {
    get(accountId, legacyId) {
      const link = links.get(identity(accountId, legacyId));
      return link ? structuredClone(link) : null;
    },
    save(link) {
      links.set(identity(link.accountId, link.legacyId), structuredClone(link));
    },
  };
}
