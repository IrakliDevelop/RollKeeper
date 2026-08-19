interface GuestProjectionSource {
  playerId: string;
  playerName: string;
  characterId: string;
  characterName: string;
  lastSynced: string;
  characterData?: unknown;
}

export interface GuestPlayerProjection {
  playerId: string;
  playerName: string;
  characterId: string;
  characterName: string;
  lastSynced: string;
  character: {
    id: string;
    name: string;
    playerName: string;
    avatar?: string;
    revision: number;
    level: number;
    className: string;
    armorClass: number;
    hitPoints: {
      current: number;
      max: number;
      temporary: number;
    } | null;
  };
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function projectGuestPlayer(
  source: GuestProjectionSource
): GuestPlayerProjection {
  const character = record(source.characterData);
  const legacyClass = record(character.class);
  const classes = Array.isArray(character.classes) ? character.classes : [];
  const primaryClass = record(classes[0]);
  const hitPoints = record(character.hitPoints);
  const hasHitPoints =
    typeof hitPoints.current === 'number' ||
    typeof hitPoints.max === 'number' ||
    typeof hitPoints.temporary === 'number';

  return {
    playerId: source.playerId,
    playerName: source.playerName,
    characterId: source.characterId,
    characterName: source.characterName,
    lastSynced: source.lastSynced,
    character: {
      id: typeof character.id === 'string' ? character.id : source.characterId,
      name:
        typeof character.name === 'string'
          ? character.name
          : source.characterName,
      playerName:
        typeof character.playerName === 'string'
          ? character.playerName
          : source.playerName,
      ...(typeof character.avatar === 'string'
        ? { avatar: character.avatar }
        : {}),
      revision: finiteNumber(character.revision, 0),
      level:
        classes.length > 0
          ? classes.reduce(
              (sum, entry) => sum + finiteNumber(record(entry).level, 0),
              0
            ) || 1
          : finiteNumber(character.level, 1),
      className:
        typeof primaryClass.className === 'string'
          ? primaryClass.className
          : typeof legacyClass.name === 'string'
            ? legacyClass.name
            : 'Unknown',
      armorClass: finiteNumber(character.armorClass, 10),
      hitPoints: hasHitPoints
        ? {
            current: finiteNumber(hitPoints.current, 0),
            max: finiteNumber(hitPoints.max, 0),
            temporary: finiteNumber(hitPoints.temporary, 0),
          }
        : null,
    },
  };
}
