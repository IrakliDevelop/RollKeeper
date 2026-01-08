/**
 * Background Data Loader
 * Loads and processes background data from JSON files
 * Similar structure to spellDataLoader.ts
 */

import backgroundsData from '../../json/backgrounds.json';

// Raw background data from JSON
interface RawBackgroundData {
  name: string;
  source: string;
  page?: number;
  srd?: boolean;
  basicRules?: boolean;
  reprintedAs?: string[];
  skillProficiencies?: Array<Record<string, boolean | number>>;
  languageProficiencies?: Array<Record<string, number>>;
  startingEquipment?: unknown[];
  entries?: Array<string | BackgroundEntry>; // Optional since some backgrounds may not have entries
}

interface BackgroundEntry {
  type: string;
  name?: string;
  entries?: Array<string | unknown>;
  data?: {
    isFeature?: boolean;
  };
  [key: string]: unknown;
}

// Processed background feature for our application
export interface ProcessedBackgroundFeature {
  id: string;
  name: string; // Feature name (e.g., "Shelter of the Faithful")
  backgroundName: string; // Background name (e.g., "Acolyte")
  source: string;
  page?: number;
  description: string; // Parsed and formatted description
  skills?: string[]; // Skill proficiencies granted
  languages?: number; // Number of languages granted
  isSrd: boolean;
}

// Processed background with all features
export interface ProcessedBackground {
  id: string;
  name: string;
  source: string;
  page?: number;
  features: ProcessedBackgroundFeature[];
  skills: string[];
  languages: number;
  isSrd: boolean;
  tags: string[];
}

// Cache for processed backgrounds
let cachedBackgrounds: ProcessedBackground[] | null = null;
let cachedFeatures: ProcessedBackgroundFeature[] | null = null;

/**
 * Generate unique ID for background
 */
function generateBackgroundId(name: string, source: string): string {
  return `${name.toLowerCase().replace(/\s+/g, '-')}-${source.toLowerCase()}`;
}

/**
 * Generate unique ID for background feature
 */
function generateFeatureId(
  featureName: string,
  backgroundName: string,
  source: string
): string {
  return `${featureName.toLowerCase().replace(/\s+/g, '-')}-${backgroundName.toLowerCase().replace(/\s+/g, '-')}-${source.toLowerCase()}`;
}

/**
 * Format source for display
 */
function formatSourceForDisplay(source: string): string {
  const sourceMap: Record<string, string> = {
    PHB: "Player's Handbook",
    XPHB: "Player's Handbook (2024)",
    DMG: "Dungeon Master's Guide",
    SCAG: "Sword Coast Adventurer's Guide",
    XGTE: "Xanathar's Guide to Everything",
    TCE: "Tasha's Cauldron of Everything",
    VRGTR: "Van Richten's Guide to Ravenloft",
    MPMM: 'Mordenkainen Presents: Monsters of the Multiverse',
    ERLW: 'Eberron: Rising from the Last War',
    GGTR: "Guildmasters' Guide to Ravnica",
    MOT: 'Mythic Odysseys of Theros',
    AI: 'Acquisitions Incorporated',
  };

  return sourceMap[source] || source;
}

/**
 * Parse background entries to extract feature descriptions
 */
function parseFeatureEntries(entries: Array<string | unknown>): string {
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
          return parseFeatureEntries(obj.entries);
        }

        // Handle lists
        if (obj.type === 'list' && Array.isArray(obj.items)) {
          return obj.items
            .map((item: unknown) => {
              if (typeof item === 'string') return item;
              if (item && typeof item === 'object') {
                const itemObj = item as Record<string, unknown>;
                if (itemObj.type === 'item' && itemObj.entry) {
                  return `• ${itemObj.entry}`;
                }
              }
              return '';
            })
            .filter(Boolean)
            .join('\n');
        }

        // Handle tables - provide simplified text representation
        if (obj.type === 'table') {
          return '_(See table in source material)_';
        }
      }

      return '';
    })
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Extract skills from skill proficiencies
 */
function extractSkills(
  skillProficiencies?: Array<Record<string, boolean | number>>
): string[] {
  if (!skillProficiencies || skillProficiencies.length === 0) return [];

  const skills: string[] = [];

  skillProficiencies.forEach(prof => {
    Object.keys(prof).forEach(key => {
      if (prof[key] === true) {
        // Convert to proper case
        const skill = key.replace(/([A-Z])/g, ' $1').trim();
        skills.push(skill.charAt(0).toUpperCase() + skill.slice(1));
      }
    });
  });

  return skills;
}

/**
 * Extract number of language proficiencies
 */
function extractLanguages(
  languageProficiencies?: Array<Record<string, number>>
): number {
  if (!languageProficiencies || languageProficiencies.length === 0) return 0;

  let count = 0;
  languageProficiencies.forEach(prof => {
    if (prof.anyStandard) {
      count += prof.anyStandard;
    }
    if (prof.any) {
      count += prof.any;
    }
  });

  return count;
}

/**
 * Process raw background data into our application format
 */
function processBackground(
  rawBackground: RawBackgroundData
): ProcessedBackground {
  const id = generateBackgroundId(rawBackground.name, rawBackground.source);
  const skills = extractSkills(rawBackground.skillProficiencies);
  const languages = extractLanguages(rawBackground.languageProficiencies);

  // Extract features from entries (entries marked with data.isFeature: true)
  const features: ProcessedBackgroundFeature[] = [];

  // Check if entries exist before processing
  if (rawBackground.entries && Array.isArray(rawBackground.entries)) {
    rawBackground.entries.forEach(entry => {
      if (entry && typeof entry === 'object') {
        const entryObj = entry as BackgroundEntry;

        // Check if this is a feature entry
        if (entryObj.data?.isFeature && entryObj.name && entryObj.entries) {
          // Remove "Feature: " prefix if present
          const featureName = entryObj.name.replace(/^Feature:\s*/i, '');

          const featureDescription = parseFeatureEntries(entryObj.entries);

          const feature: ProcessedBackgroundFeature = {
            id: generateFeatureId(
              featureName,
              rawBackground.name,
              rawBackground.source
            ),
            name: featureName,
            backgroundName: rawBackground.name,
            source: formatSourceForDisplay(rawBackground.source),
            page: rawBackground.page,
            description: featureDescription,
            skills: skills,
            languages: languages > 0 ? languages : undefined,
            isSrd: rawBackground.srd || false,
          };

          features.push(feature);
        }
      }
    });
  }

  return {
    id,
    name: rawBackground.name,
    source: formatSourceForDisplay(rawBackground.source),
    page: rawBackground.page,
    features,
    skills,
    languages,
    isSrd: rawBackground.srd || false,
    tags: [rawBackground.source, ...skills.map(s => s.toLowerCase())],
  };
}

/**
 * Load and process all backgrounds from JSON files
 */
export async function loadAllBackgrounds(): Promise<ProcessedBackground[]> {
  // Return cached backgrounds if available
  if (cachedBackgrounds) {
    return cachedBackgrounds;
  }

  try {
    const rawBackgrounds = backgroundsData.background as RawBackgroundData[];

    const processedBackgrounds = rawBackgrounds.map(bg =>
      processBackground(bg)
    );

    // Cache the processed backgrounds
    cachedBackgrounds = processedBackgrounds;

    console.log(`Loaded ${processedBackgrounds.length} backgrounds`);

    return processedBackgrounds;
  } catch (error) {
    console.error('Error loading backgrounds:', error);
    throw error;
  }
}

/**
 * Load all background features (flat list)
 */
export async function loadAllBackgroundFeatures(): Promise<
  ProcessedBackgroundFeature[]
> {
  // Return cached features if available
  if (cachedFeatures) {
    return cachedFeatures;
  }

  try {
    const backgrounds = await loadAllBackgrounds();

    // Flatten all features from all backgrounds
    const allFeatures = backgrounds.flatMap(bg => bg.features);

    // Cache the features
    cachedFeatures = allFeatures;

    console.log(
      `Loaded ${allFeatures.length} background features from ${backgrounds.length} backgrounds`
    );

    return allFeatures;
  } catch (error) {
    console.error('Error loading background features:', error);
    throw error;
  }
}

/**
 * Clear the cache (useful for testing or forced reloads)
 */
export function clearBackgroundCache(): void {
  cachedBackgrounds = null;
  cachedFeatures = null;
}

/**
 * Get background by name
 */
export async function getBackgroundByName(
  name: string
): Promise<ProcessedBackground | undefined> {
  const backgrounds = await loadAllBackgrounds();
  return backgrounds.find(bg => bg.name.toLowerCase() === name.toLowerCase());
}
