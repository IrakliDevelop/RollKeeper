/**
 * Feat Data Loader
 * Loads and processes feat data from JSON files
 * Similar structure to backgroundDataLoader.ts
 */

import featsData from '../../json/feats.json';

// Raw feat data from JSON
interface RawFeatData {
  name: string;
  source: string;
  page?: number;
  srd?: boolean;
  srd52?: boolean;
  basicRules?: boolean;
  basicRules2024?: boolean;
  category?: string; // e.g., "G" for general
  prerequisite?: Array<{
    level?: number;
    ability?: Array<{ [key: string]: number }>;
    spellcasting?: boolean;
    proficiency?: Array<{ armor?: string; weapon?: string }>;
    other?: string;
    [key: string]: unknown;
  }>;
  ability?: Array<{
    [key: string]: number | { choose?: { from: string[]; amount: number } };
  }>;
  repeatable?: boolean;
  entries: Array<string | FeatEntry>;
  additionalSpells?: unknown[];
}

interface FeatEntry {
  type: string;
  name?: string;
  entries?: Array<string | unknown>;
  items?: Array<string | unknown>;
  [key: string]: unknown;
}

// Processed feat for our application
export interface ProcessedFeat {
  id: string;
  name: string;
  source: string;
  page?: number;
  description: string; // Parsed and formatted description
  prerequisites: string[]; // Human-readable prerequisites
  abilityIncreases: string; // Description of ability score increases
  category?: string;
  repeatable: boolean;
  grantsSpells: boolean;
  isSrd: boolean;
  tags: string[];
}

// Cache for processed feats
let cachedFeats: ProcessedFeat[] | null = null;

/**
 * Generate unique ID for feat
 */
function generateFeatId(name: string, source: string): string {
  return `${name.toLowerCase().replace(/\s+/g, '-')}-${source.toLowerCase()}`;
}

/**
 * Format source for display
 */
function formatSourceForDisplay(source: string): string {
  const sourceMap: Record<string, string> = {
    PHB: "Player's Handbook",
    XPHB: "Player's Handbook (2024)",
    DMG: "Dungeon Master's Guide",
    XDMG: "Dungeon Master's Guide (2024)",
    SCAG: "Sword Coast Adventurer's Guide",
    XGTE: "Xanathar's Guide to Everything",
    TCE: "Tasha's Cauldron of Everything",
    VRGTR: "Van Richten's Guide to Ravenloft",
    MPMM: 'Mordenkainen Presents: Monsters of the Multiverse',
    ERLW: 'Eberron: Rising from the Last War',
    GGTR: "Guildmasters' Guide to Ravnica",
    MOT: 'Mythic Odysseys of Theros',
    AI: 'Acquisitions Incorporated',
    FTD: "Fizban's Treasury of Dragons",
  };

  return sourceMap[source] || source;
}

/**
 * Parse feat entries to extract descriptions
 */
function parseFeatEntries(entries: Array<string | unknown>): string {
  return entries
    .map(entry => {
      if (typeof entry === 'string') {
        return entry;
      }

      // Handle nested entry objects
      if (entry && typeof entry === 'object') {
        const obj = entry as Record<string, unknown>;

        // Handle nested entries
        if (obj.type === 'entries' && Array.isArray(obj.entries)) {
          let result = '';
          if (obj.name) {
            result += `**${obj.name}**\n\n`;
          }
          result += parseFeatEntries(obj.entries);
          return result;
        }

        // Handle lists
        if (obj.type === 'list' && Array.isArray(obj.items)) {
          return obj.items
            .map((item: unknown) => {
              if (typeof item === 'string') return `• ${item}`;
              if (item && typeof item === 'object') {
                const itemObj = item as Record<string, unknown>;
                if (itemObj.type === 'item') {
                  const itemText = itemObj.entry || itemObj.name || '';
                  return `• ${itemText}`;
                }
              }
              return '';
            })
            .filter(Boolean)
            .join('\n');
        }

        // Handle tables
        if (obj.type === 'table') {
          return '_(See table in source material)_';
        }

        // Handle sections
        if (obj.type === 'section' && Array.isArray(obj.entries)) {
          return parseFeatEntries(obj.entries);
        }
      }

      return '';
    })
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Parse prerequisites into human-readable format
 */
function parsePrerequisites(
  prerequisite?: RawFeatData['prerequisite']
): string[] {
  if (!prerequisite || prerequisite.length === 0) return [];

  const prereqs: string[] = [];

  prerequisite.forEach(prereq => {
    if (prereq.level) {
      prereqs.push(`Level ${prereq.level}+`);
    }

    if (prereq.ability) {
      prereq.ability.forEach(abilityReq => {
        Object.entries(abilityReq).forEach(([ability, value]) => {
          const abilityName = ability.toUpperCase();
          prereqs.push(`${abilityName} ${value}+`);
        });
      });
    }

    if (prereq.spellcasting) {
      prereqs.push('Spellcasting or Pact Magic feature');
    }

    if (prereq.proficiency) {
      prereq.proficiency.forEach(prof => {
        if (prof.armor) {
          prereqs.push(`Proficiency with ${prof.armor} armor`);
        }
        if (prof.weapon) {
          prereqs.push(`Proficiency with ${prof.weapon}`);
        }
      });
    }

    if (prereq.other) {
      prereqs.push(prereq.other);
    }
  });

  return prereqs;
}

/**
 * Parse ability score increases
 */
function parseAbilityIncreases(ability?: RawFeatData['ability']): string {
  if (!ability || ability.length === 0) return '';

  const increases: string[] = [];

  ability.forEach(abilityObj => {
    Object.entries(abilityObj).forEach(([key, value]) => {
      if (key === 'choose' && typeof value === 'object' && value !== null) {
        const choice = value as { from?: string[]; amount?: number };
        if (choice.from && choice.amount) {
          const abilities = choice.from.map(a => a.toUpperCase()).join(', ');
          increases.push(
            `Increase ${choice.amount} ability score${choice.amount > 1 ? 's' : ''} from: ${abilities}`
          );
        }
      } else if (typeof value === 'number') {
        increases.push(`+${value} ${key.toUpperCase()}`);
      } else if (key === 'hidden') {
        // Skip hidden entries
      }
    });
  });

  return increases.join('; ') || '';
}

/**
 * Check if feat grants spells
 */
function grantsSpells(feat: RawFeatData): boolean {
  return !!(feat.additionalSpells && feat.additionalSpells.length > 0);
}

/**
 * Process raw feat data into our application format
 */
function processFeat(rawFeat: RawFeatData): ProcessedFeat {
  const id = generateFeatId(rawFeat.name, rawFeat.source);
  const description = parseFeatEntries(rawFeat.entries);
  const prerequisites = parsePrerequisites(rawFeat.prerequisite);
  const abilityIncreases = parseAbilityIncreases(rawFeat.ability);

  return {
    id,
    name: rawFeat.name,
    source: formatSourceForDisplay(rawFeat.source),
    page: rawFeat.page,
    description,
    prerequisites,
    abilityIncreases,
    category: rawFeat.category,
    repeatable: rawFeat.repeatable || false,
    grantsSpells: grantsSpells(rawFeat),
    isSrd:
      rawFeat.srd ||
      rawFeat.srd52 ||
      rawFeat.basicRules ||
      rawFeat.basicRules2024 ||
      false,
    tags: [
      rawFeat.source,
      ...(rawFeat.category ? [rawFeat.category] : []),
      ...(prerequisites.length > 0 ? ['has-prerequisites'] : []),
      ...(abilityIncreases ? ['ability-increase'] : []),
      ...(grantsSpells(rawFeat) ? ['grants-spells'] : []),
    ],
  };
}

/**
 * Load and process all feats from JSON files
 */
export async function loadAllFeats(): Promise<ProcessedFeat[]> {
  // Return cached feats if available
  if (cachedFeats) {
    return cachedFeats;
  }

  try {
    const rawFeats = featsData.feat as RawFeatData[];

    const processedFeats = rawFeats.map(feat => processFeat(feat));

    // Cache the processed feats
    cachedFeats = processedFeats;

    console.log(`Loaded ${processedFeats.length} feats`);

    return processedFeats;
  } catch (error) {
    console.error('Error loading feats:', error);
    throw error;
  }
}

/**
 * Clear the cache (useful for testing or forced reloads)
 */
export function clearFeatCache(): void {
  cachedFeats = null;
}

/**
 * Get feat by name
 */
export async function getFeatByName(
  name: string
): Promise<ProcessedFeat | undefined> {
  const feats = await loadAllFeats();
  return feats.find(feat => feat.name.toLowerCase() === name.toLowerCase());
}

/**
 * Search feats by query
 */
export async function searchFeats(query: string): Promise<ProcessedFeat[]> {
  if (!query.trim()) {
    return loadAllFeats();
  }

  const feats = await loadAllFeats();
  const queryLower = query.toLowerCase().trim();

  return feats.filter(
    feat =>
      feat.name.toLowerCase().includes(queryLower) ||
      feat.description.toLowerCase().includes(queryLower) ||
      feat.prerequisites.some(p => p.toLowerCase().includes(queryLower)) ||
      feat.tags.some(t => t.toLowerCase().includes(queryLower))
  );
}
