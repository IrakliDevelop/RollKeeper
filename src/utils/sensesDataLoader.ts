import sensesData from '../../json/senses.json';

interface RawSenseEntry {
  type?: string;
  name?: string;
  entries?: Array<string | RawSenseEntry>;
  items?: Array<string | RawSenseEntry>;
  entry?: string;
  style?: string;
}

interface RawSenseData {
  name: string;
  source: string;
  page?: number;
  srd?: boolean;
  srd52?: boolean;
  basicRules?: boolean;
  basicRules2024?: boolean;
  reprintedAs?: string[];
  entries: Array<string | RawSenseEntry>;
}

export interface ProcessedSense {
  id: string;
  name: string;
  source: string;
  page?: number;
  description: string;
  isSrd: boolean;
}

let cachedSenses: ProcessedSense[] | null = null;

const SOURCE_MAP: Record<string, string> = {
  PHB: "Player's Handbook",
  XPHB: "Player's Handbook (2024)",
  MM: 'Monster Manual',
  DMG: "Dungeon Master's Guide",
};

function generateSenseId(name: string, source: string): string {
  return `${name.toLowerCase().replace(/\s+/g, '-')}-${source.toLowerCase()}`;
}

function formatSource(source: string): string {
  return SOURCE_MAP[source] || source;
}

function parseEntries(entries: Array<string | RawSenseEntry>): string {
  return entries
    .map(entry => {
      if (typeof entry === 'string') return entry;

      if (entry && typeof entry === 'object') {
        if (entry.type === 'entries' && Array.isArray(entry.entries)) {
          let result = '';
          if (entry.name) result += `**${entry.name}**\n\n`;
          result += parseEntries(entry.entries);
          return result;
        }

        if (entry.type === 'list' && Array.isArray(entry.items)) {
          return entry.items
            .map((item: string | RawSenseEntry) => {
              if (typeof item === 'string') return `• ${item}`;
              if (item && typeof item === 'object') {
                if (item.type === 'item' && item.name) {
                  const text = Array.isArray(item.entries)
                    ? parseEntries(item.entries)
                    : item.entry || '';
                  return `• **${item.name}**: ${text}`;
                }
              }
              return '';
            })
            .filter(Boolean)
            .join('\n');
        }
      }

      return '';
    })
    .filter(Boolean)
    .join('\n\n');
}

function cleanFormatTags(text: string): string {
  return text
    .replace(/\{@\w+\s+([^|}]+?)(?:\|[^}]*)?\}/g, '$1')
    .replace(/\{@\w+\s+([^}]+)\}/g, '$1');
}

function processSense(raw: RawSenseData): ProcessedSense {
  const description = cleanFormatTags(parseEntries(raw.entries));

  return {
    id: generateSenseId(raw.name, raw.source),
    name: raw.name,
    source: formatSource(raw.source),
    page: raw.page,
    description,
    isSrd:
      raw.srd || raw.srd52 || raw.basicRules || raw.basicRules2024 || false,
  };
}

export async function loadAllSenses(): Promise<ProcessedSense[]> {
  if (cachedSenses) return cachedSenses;

  try {
    const rawSenses = sensesData.sense as RawSenseData[];
    cachedSenses = rawSenses.map(processSense);
    return cachedSenses;
  } catch (error) {
    console.error('Error loading senses:', error);
    throw error;
  }
}

export function clearSensesCache(): void {
  cachedSenses = null;
}
