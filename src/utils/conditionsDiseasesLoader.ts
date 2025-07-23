import {
  RawConditionsDiseasesData,
  RawCondition,
  RawDisease,
  RawStatus,
  ProcessedCondition,
  ProcessedDisease,
  ProcessedStatus,
  RawConditionEntry
} from '@/types/character';
import { processAndFormatDndText } from './textFormatting';

// Cache for loaded data to avoid reprocessing
let cachedConditions: ProcessedCondition[] | null = null;
let cachedDiseases: ProcessedDisease[] | null = null;
let cachedStatuses: ProcessedStatus[] | null = null;

/**
 * Load conditions/diseases JSON file from public directory
 */
async function loadConditionsDiseasesFile(): Promise<RawConditionsDiseasesData> {
  const response = await fetch('/data/conditionsdiseases.json');
  if (!response.ok) {
    throw new Error(`Failed to load conditions/diseases data: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Generate a unique ID for a condition/disease/status
 */
function generateId(name: string, source: string): string {
  return `${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${source.toLowerCase()}`;
}

/**
 * Parse entries that can contain both strings and complex objects
 */
function parseEntries(entries: (string | RawConditionEntry)[]): string {
  const parseEntry = (entry: string | RawConditionEntry): string => {
    if (typeof entry === 'string') {
      return entry;
    }
    
    if (!entry || typeof entry !== 'object') {
      return '';
    }
    
    try {
      // Handle different entry types
      if (entry.type === 'list' && entry.items) {
        const processedItems = entry.items.map((item: string | RawConditionEntry) => {
          if (typeof item === 'string') {
            return `• ${item}`;
          }
          
          if (!item || typeof item !== 'object') {
            return '';
          }
          
          // Handle complex item objects with type: "item"
          if (item.type === 'item') {
            if (item.name && item.entry) {
              return `**${item.name}**: ${item.entry}`;
            }
            if (item.name && item.entries) {
              const entriesText = Array.isArray(item.entries) 
                ? item.entries.map(parseEntry).filter(Boolean).join(' ') 
                : String(item.entries);
              return `**${item.name}**: ${entriesText}`;
            }
            if (item.entries) {
              return Array.isArray(item.entries) 
                ? item.entries.map(parseEntry).filter(Boolean).join(' ') 
                : String(item.entries);
            }
            return item.entry || '';
          }
          
          // Handle other complex item types recursively
          if (item.type && item.entries) {
            return parseEntry(item);
          }
          
          // Handle any object with a name and some content
          if (item.name) {
            const content = item.entry || (item.entries ? 
              (Array.isArray(item.entries) ? item.entries.map(parseEntry).join(' ') : String(item.entries))
              : '');
            return content ? `**${item.name}**: ${content}` : `**${item.name}**`;
          }
          
          // Try to extract any meaningful text
          if (item.entry) {
            return item.entry;
          }
          
          if (item.entries) {
            return Array.isArray(item.entries) 
              ? item.entries.map(parseEntry).filter(Boolean).join(' ')
              : String(item.entries);
          }
          
          return '';
        }).filter(Boolean);
        
        return processedItems.join('\n\n');
      }
      
      if (entry.type === 'entries') {
        let result = '';
        if (entry.name) {
          result += `**${entry.name}**\n\n`;
        }
        if (entry.entries) {
          const entriesText = entry.entries.map(parseEntry).filter(Boolean).join('\n\n');
          result += entriesText;
        }
        return result;
      }
      
      // Handle nested items with names (like "Can't See", "Attacks Affected", etc.)
      if (entry.name && entry.entries) {
        const entriesText = entry.entries.map(parseEntry).filter(Boolean).join(' ');
        return `**${entry.name}**: ${entriesText}`;
      }
      
      // Handle simple arrays
      if (entry.entries && Array.isArray(entry.entries)) {
        return entry.entries.map(parseEntry).filter(Boolean).join('\n\n');
      }
      
      // Handle single entry field
      if (entry.entry) {
        return entry.entry;
      }
      
      // Try to extract meaningful content from any remaining object
      if (entry.name) {
        return `**${entry.name}**`;
      }
      
      return '';
    } catch (error) {
      // Safety fallback for any parsing errors
      return '';
    }
  };

  return entries.map(parseEntry).filter(Boolean).join('\n\n');
}

/**
 * Process raw condition data into application format
 */
function processCondition(rawCondition: RawCondition): ProcessedCondition {
  const id = generateId(rawCondition.name, rawCondition.source);
  const description = processAndFormatDndText(parseEntries(rawCondition.entries));
  
  // Determine if this is exhaustion and if it's stackable
  const isExhaustion = rawCondition.name.toLowerCase() === 'exhaustion';
  const stackable = isExhaustion; // Exhaustion is the main stackable condition
  
  // Determine variant for conditions that have multiple versions
  let variant: '2014' | '2024' | undefined;
  if (rawCondition.source === 'PHB') {
    variant = '2014';
  } else if (rawCondition.source === 'XPHB') {
    variant = '2024';
  }
  
  return {
    id,
    name: rawCondition.name,
    source: rawCondition.source,
    description,
    isExhaustion,
    stackable,
    variant
  };
}

/**
 * Process raw disease data into application format
 */
function processDisease(rawDisease: RawDisease): ProcessedDisease {
  const id = generateId(rawDisease.name, rawDisease.source);
  const description = processAndFormatDndText(rawDisease.entries.join('\n\n'));
  
  return {
    id,
    name: rawDisease.name,
    source: rawDisease.source,
    description,
    type: rawDisease.type
  };
}

/**
 * Process raw status data into application format
 */
function processStatus(rawStatus: RawStatus): ProcessedStatus {
  const id = generateId(rawStatus.name, rawStatus.source);
  const description = processAndFormatDndText(parseEntries(rawStatus.entries));
  
  return {
    id,
    name: rawStatus.name,
    source: rawStatus.source,
    description
  };
}

/**
 * Load and process all conditions
 */
export async function loadAllConditions(): Promise<ProcessedCondition[]> {
  if (cachedConditions) {
    return cachedConditions;
  }
  
  try {
    const data = await loadConditionsDiseasesFile();
    const processedConditions = data.condition.map(processCondition);
    
    cachedConditions = processedConditions;
    
    console.log(`Loaded ${cachedConditions.length} conditions`);
    
    return cachedConditions;
  } catch (error) {
    console.error('Error loading conditions:', error);
    return [];
  }
}

/**
 * Load and process all diseases
 */
export async function loadAllDiseases(): Promise<ProcessedDisease[]> {
  if (cachedDiseases) {
    return cachedDiseases;
  }
  
  try {
    const data = await loadConditionsDiseasesFile();
    const processedDiseases = data.disease.map(processDisease);
    
    cachedDiseases = processedDiseases;
    
    console.log(`Loaded ${cachedDiseases.length} diseases`);
    
    return cachedDiseases;
  } catch (error) {
    console.error('Error loading diseases:', error);
    return [];
  }
}

/**
 * Load and process all statuses
 */
export async function loadAllStatuses(): Promise<ProcessedStatus[]> {
  if (cachedStatuses) {
    return cachedStatuses;
  }
  
  try {
    const data = await loadConditionsDiseasesFile();
    const processedStatuses = data.status.map(processStatus);
    
    cachedStatuses = processedStatuses;
    
    console.log(`Loaded ${cachedStatuses.length} statuses`);
    
    return cachedStatuses;
  } catch (error) {
    console.error('Error loading statuses:', error);
    return [];
  }
}

/**
 * Get exhaustion conditions by variant
 */
export async function getExhaustionByVariant(variant: '2014' | '2024'): Promise<ProcessedCondition | null> {
  const conditions = await loadAllConditions();
  return conditions.find(c => c.isExhaustion && c.variant === variant) || null;
}

/**
 * Search conditions by name
 */
export async function searchConditions(query: string): Promise<ProcessedCondition[]> {
  const conditions = await loadAllConditions();
  const lowerQuery = query.toLowerCase();
  
  return conditions.filter(condition =>
    condition.name.toLowerCase().includes(lowerQuery) ||
    condition.description.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Search diseases by name
 */
export async function searchDiseases(query: string): Promise<ProcessedDisease[]> {
  const diseases = await loadAllDiseases();
  const lowerQuery = query.toLowerCase();
  
  return diseases.filter(disease =>
    disease.name.toLowerCase().includes(lowerQuery) ||
    disease.description.toLowerCase().includes(lowerQuery)
  );
} 