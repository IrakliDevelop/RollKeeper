import { promises as fs } from 'fs';
import path from 'path';

export interface RawRaceData {
  name: string;
  source: string;
  page?: number;
  size?: string[];
  speed?:
    | number
    | {
        walk?: number;
        fly?: number;
        swim?: number;
      };
  ability?: Array<
    Record<
      string,
      | number
      | {
          from?: string[];
          count?: number;
          choose?: { from?: string[]; count?: number };
        }
    >
  >;
  age?: {
    mature?: number;
    max?: number;
  };
  languageProficiencies?: Array<Record<string, boolean | number>>;
  entries?: Array<{
    name?: string;
    type?: string;
    entries?: string[];
  }>;
  hasFluff?: boolean;
  hasFluffImages?: boolean;
  darkvision?: number;
  skillProficiencies?: Array<Record<string, boolean>>;
  traitTags?: string[];
  resist?: string[];
  immune?: string[];
  conditionImmune?: string[];
}

export interface ProcessedRace {
  name: string;
  source: string;
  displayName: string;
  size?: string;
  speed?: {
    walk?: number;
    fly?: number;
    swim?: number;
  };
  abilityScores?: string[];
  darkvision?: number;
  traits?: string[];
  age?: {
    mature?: number;
    max?: number;
  };
  languages?: string[];
  resistances?: string[];
  immunities?: string[];
  skillProficiencies?: string[];
  features?: Array<{
    name: string;
    description: string;
  }>;
}

// Maximum length for feature descriptions before truncation
const MAX_DESCRIPTION_LENGTH = 200;

// Cache for loaded races to avoid reprocessing
let cachedRaces: ProcessedRace[] | null = null;

/**
 * Load the races JSON file
 */
async function loadRacesFile(): Promise<RawRaceData[]> {
  const racesPath = path.join(process.cwd(), 'json', 'races.json');

  try {
    const fileContent = await fs.readFile(racesPath, 'utf-8');
    const data = JSON.parse(fileContent);

    if (data.race && Array.isArray(data.race)) {
      return data.race;
    }

    return [];
  } catch (error) {
    console.error('Error loading races file:', error);
    return [];
  }
}

/**
 * Format source for display
 */
function formatSource(source: string): string {
  const sourceMap: Record<string, string> = {
    PHB: "Player's Handbook",
    XPHB: "Player's Handbook 2024",
    DMG: "Dungeon Master's Guide",
    MM: 'Monster Manual',
    MPMM: 'Mordenkainen Presents: Monsters of the Multiverse',
    VGTM: "Volo's Guide to Monsters",
    MTF: "Mordenkainen's Tome of Foes",
    EEPC: "Elemental Evil Player's Companion",
    SCAG: "Sword Coast Adventurer's Guide",
    EGW: "Explorer's Guide to Wildemount",
    TCE: "Tasha's Cauldron of Everything",
    FTD: "Fizban's Treasury of Dragons",
    SRD: 'System Reference Document',
  };

  return sourceMap[source] || source;
}

/**
 * Process raw race data into our application format
 */
function processRace(rawRace: RawRaceData): ProcessedRace {
  // Parse ability scores from the ability array
  const abilityScores: string[] = [];
  if (rawRace.ability && Array.isArray(rawRace.ability)) {
    rawRace.ability.forEach(abilityObj => {
      Object.keys(abilityObj).forEach(key => {
        const value = abilityObj[key];
        if (typeof value === 'number' && value > 0) {
          abilityScores.push(`${key.toUpperCase()} +${value}`);
        } else if (
          typeof value === 'object' &&
          value !== null &&
          'from' in value &&
          'count' in value
        ) {
          // Handle choose options like "choose 2 from STR, DEX, CON, INT, WIS"
          const fromList =
            value.from?.map(a => a.toUpperCase()).join(', ') || 'any';
          abilityScores.push(`Choose +${value.count || 1} from ${fromList}`);
        }
      });
    });
  }

  // Get size display
  const sizeMap: Record<string, string> = {
    T: 'Tiny',
    S: 'Small',
    M: 'Medium',
    L: 'Large',
    H: 'Huge',
    G: 'Gargantuan',
  };
  const sizeDisplay =
    rawRace.size && rawRace.size[0]
      ? sizeMap[rawRace.size[0]] || rawRace.size[0]
      : undefined;

  // Parse speed (can be number or object)
  let speed: { walk?: number; fly?: number; swim?: number } | undefined;
  if (typeof rawRace.speed === 'number') {
    speed = { walk: rawRace.speed };
  } else if (rawRace.speed && typeof rawRace.speed === 'object') {
    speed = rawRace.speed;
  }

  // Parse languages
  const languages: string[] = [];
  if (
    rawRace.languageProficiencies &&
    Array.isArray(rawRace.languageProficiencies)
  ) {
    rawRace.languageProficiencies.forEach(langObj => {
      Object.keys(langObj).forEach(key => {
        const value = langObj[key];
        if (value === true) {
          languages.push(key.charAt(0).toUpperCase() + key.slice(1));
        } else if (typeof value === 'number') {
          languages.push(`Choose ${value} languages`);
        } else if (key === 'anyStandard') {
          languages.push(`Any ${value} standard languages`);
        }
      });
    });
  }

  // Parse skill proficiencies
  const skillProfs: string[] = [];
  if (rawRace.skillProficiencies && Array.isArray(rawRace.skillProficiencies)) {
    rawRace.skillProficiencies.forEach(skillObj => {
      Object.keys(skillObj).forEach(key => {
        if (skillObj[key] === true) {
          skillProfs.push(key.charAt(0).toUpperCase() + key.slice(1));
        }
      });
    });
  }

  // Parse racial features from entries
  const features: Array<{ name: string; description: string }> = [];
  if (rawRace.entries && Array.isArray(rawRace.entries)) {
    rawRace.entries.forEach(entry => {
      if (entry.name && entry.entries && entry.type === 'entries') {
        // Skip generic entries like "Age", "Size", "Alignment" that are better shown in dedicated sections
        const skipNames = ['Age', 'Size', 'Alignment', 'Languages'];
        if (!skipNames.includes(entry.name)) {
          const description = entry.entries
            .join(' ')
            // Remove 5etools formatting tags like {@skill Intimidation}, {@damage 1d6}, etc.
            .replace(/\{@\w+\s+([^}]+)\}/g, '$1')
            .replace(/\{@\w+\}/g, '')
            .trim();

          if (description && description.length > 0) {
            features.push({
              name: entry.name,
              description:
                description.length > MAX_DESCRIPTION_LENGTH
                  ? description.substring(0, MAX_DESCRIPTION_LENGTH) + '...'
                  : description,
            });
          }
        }
      }
    });
  }

  return {
    name: rawRace.name,
    source: rawRace.source,
    displayName: `${rawRace.name} (${formatSource(rawRace.source)})`,
    size: sizeDisplay,
    speed,
    abilityScores: abilityScores.length > 0 ? abilityScores : undefined,
    darkvision: rawRace.darkvision,
    traits: rawRace.traitTags,
    age: rawRace.age,
    languages: languages.length > 0 ? languages : undefined,
    resistances: rawRace.resist,
    immunities: rawRace.immune,
    skillProficiencies: skillProfs.length > 0 ? skillProfs : undefined,
    features: features.length > 0 ? features : undefined,
  };
}

/**
 * Load and process all races from JSON file
 */
export async function loadAllRaces(): Promise<ProcessedRace[]> {
  // Return cached races if available
  if (cachedRaces) {
    return cachedRaces;
  }

  try {
    const rawRaces = await loadRacesFile();

    // Process all races
    const processedRaces = rawRaces.map(processRace);

    // Remove duplicates (prioritize PHB2024 > PHB > others)
    const uniqueRaces = new Map<string, ProcessedRace>();

    const sourceOrder = [
      'XPHB',
      'PHB',
      'MPMM',
      'VGTM',
      'MTF',
      'TCE',
      'FTD',
      'EEPC',
      'SCAG',
      'EGW',
      'SRD',
      'DMG',
      'MM',
    ];

    for (const race of processedRaces) {
      const existingRace = uniqueRaces.get(race.name);

      if (!existingRace) {
        uniqueRaces.set(race.name, race);
      } else {
        // Keep the one with higher priority source
        const existingPriority = sourceOrder.indexOf(existingRace.source);
        const newPriority = sourceOrder.indexOf(race.source);

        if (
          newPriority !== -1 &&
          (existingPriority === -1 || newPriority < existingPriority)
        ) {
          uniqueRaces.set(race.name, race);
        }
      }
    }

    // Convert to array and sort alphabetically
    cachedRaces = Array.from(uniqueRaces.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    return cachedRaces;
  } catch (error) {
    console.error('Error loading races:', error);
    return [];
  }
}

/**
 * Get unique race names for simple selection
 */
export async function getRaceNames(): Promise<string[]> {
  const races = await loadAllRaces();
  return races.map(race => race.name);
}
