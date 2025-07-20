import { promises as fs } from 'fs';
import path from 'path';
import { parseReferences } from './referenceParser';
import { formatSourceForDisplay, compareSourcePriority } from './sourceUtils';
import { 
  ClassDataFile, 
  RawClassData, 
  RawSubclassData, 
  ProcessedClass, 
  ProcessedSubclass,
  ClassFeature,
  SubclassSpellList,
  SpellcastingType
} from '@/types/classes';

// Cache for loaded classes to avoid reprocessing
let cachedClasses: ProcessedClass[] | null = null;

/**
 * Load all class JSON files from the json/class directory
 */
async function loadClassFiles(): Promise<ClassDataFile[]> {
  const classDir = path.join(process.cwd(), 'json', 'class');
  const files = await fs.readdir(classDir);
  const classFiles = files.filter(file => file.endsWith('.json'));
  
  const allClassData: ClassDataFile[] = [];
  
  for (const file of classFiles) {
    try {
      const filePath = path.join(classDir, file);
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const data: ClassDataFile = JSON.parse(fileContent);
      
      if (data.class && Array.isArray(data.class)) {
        allClassData.push(data);
      }
    } catch (error) {
      console.error(`Error loading class file ${file}:`, error);
    }
  }
  
  return allClassData;
}

/**
 * Generate a unique ID for a class based on name and source
 */
function generateClassId(name: string, source: string): string {
  return `${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${source.toLowerCase()}`;
}

/**
 * Generate a unique ID for a subclass
 */
function generateSubclassId(name: string, className: string, source: string): string {
  return `${className.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${source.toLowerCase()}`;
}

/**
 * Convert hit die data to readable string
 */
function formatHitDie(hd: { number: number; faces: number } | undefined): string {
  if (!hd || !hd.faces) {
    return 'd8'; // Default hit die if not specified
  }
  return `d${hd.faces}`;
}

/**
 * Determine spellcasting type from class data
 */
function determineSpellcastingType(classData: RawClassData): SpellcastingType {
  if (classData.casterProgression) {
    return classData.casterProgression;
  }
  
  // Fallback logic based on class name
  const className = classData.name.toLowerCase();
  if (className.includes('warlock')) return 'warlock';
  if (['wizard', 'sorcerer', 'bard', 'cleric', 'druid'].some(c => className.includes(c))) {
    return 'full';
  }
  if (['paladin', 'ranger'].some(c => className.includes(c))) {
    return 'half';
  }
  if (['eldritch knight', 'arcane trickster'].some(c => className.includes(c))) {
    return 'third';
  }
  
  return 'none';
}

/**
 * Extract skill choices from starting proficiencies
 */
function extractSkillChoices(skills?: Array<{ choose?: { from: string[]; count: number } } | string>) {
  if (!skills || skills.length === 0) return undefined;
  
  for (const skill of skills) {
    if (typeof skill === 'object' && skill.choose) {
      return {
        from: skill.choose.from,
        count: skill.choose.count
      };
    }
  }
  
  return undefined;
}

/**
 * Process multiclassing requirements to handle complex OR logic
 */
function processMulticlassingRequirements(requirements?: Record<string, unknown>): Record<string, number> {
  if (!requirements) return {};
  
  // Handle OR requirements (e.g., Fighter needs STR 13 OR DEX 13)
  if (requirements.or && Array.isArray(requirements.or)) {
    // For now, take the first option in OR requirements
    const firstOption = requirements.or[0] as Record<string, number>;
    if (firstOption && typeof firstOption === 'object') {
      return firstOption;
    }
  }
  
  // Handle direct requirements (e.g., Paladin needs STR 13 AND CHA 13)
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(requirements)) {
    if (key !== 'or' && typeof value === 'number') {
      result[key] = value;
    }
  }
  
  return result;
}

/**
 * Clean and format equipment strings
 */
function formatEquipment(equipment?: string[]): string[] {
  if (!equipment) return [];
  
  return equipment.map(item => {
    // Ensure item is a string before processing
    const itemStr = typeof item === 'string' ? item : String(item);
    // Parse references and return the HTML with proper styling
    return parseReferences(itemStr).html;
  });
}

/**
 * Process class features and extract descriptions
 */
function processClassFeatures(
  classFeatures: string[] | Record<string, unknown>[], 
  classFeatureDescriptions: Record<string, unknown>[], 
  className: string,
  source: string
): ClassFeature[] {
  if (!classFeatures || !Array.isArray(classFeatures)) return [];

  const features = classFeatures.map((feature) => {
    let featureName: string;
    let level: number = 1;
    let isSubclassFeature = false;
    let original: string;

    if (typeof feature === 'string') {
      const parts = feature.split('|');
      featureName = parts[0] || feature;
      original = feature;
      
      // Determine if this is a subclass feature based on format
      // Subclass format: "Feature Name|Class||Subclass||Level"
      // Class format: "Feature Name|Class|Source|Level"
      if (parts.length >= 6 && parts[2] === '' && parts[4] === '') {
        // Subclass feature format
        level = parseInt(parts[5]) || 3; // Default to 3 for subclass features
        isSubclassFeature = true;
      } else {
        // Class feature format
        level = parseInt(parts[3]) || 1;
        isSubclassFeature = false;
      }
    } else if (feature && typeof feature === 'object' && 'classFeature' in feature) {
      const parts = String(feature.classFeature).split('|');
      featureName = parts[0] || String(feature.classFeature);
      original = String(feature.classFeature);
      isSubclassFeature = Boolean(feature.gainSubclassFeature);
      
      // Apply same logic for object format
      if (parts.length >= 6 && parts[2] === '' && parts[4] === '') {
        level = parseInt(parts[5]) || 3;
      } else {
        level = parseInt(parts[3]) || 1;
      }
    } else {
      featureName = String(feature);
      original = String(feature);
    }

    // Find the feature description in classFeatureDescriptions
    const featureDesc = classFeatureDescriptions?.find((desc) => 
      desc.name === featureName && 
      desc.className === className && 
      desc.level === level
    );

    let entries: string[] = [];
    if (featureDesc?.entries && Array.isArray(featureDesc.entries)) {
      entries = processFeatureEntries(featureDesc.entries);
    }

    return {
      name: featureName,
      level,
      source: (featureDesc?.source as string) || source,
      className,
      entries,
      isSubclassFeature,
      original,
      is2024Rules: Boolean(featureDesc?.basicRules2024)
    };
  });

  // Prioritize 2024 features over 2014 features for the same level and name
  return prioritize2024Features(features);
}

/**
 * Process subclass features specifically
 */
function processSubclassFeatures(
  subclassFeatures: string[] | Record<string, unknown>[], 
  subclassFeatureDescriptions: Record<string, unknown>[], 
  className: string,
  source: string,
  subclassShortName: string
): ClassFeature[] {
  if (!subclassFeatureDescriptions || !Array.isArray(subclassFeatureDescriptions)) return [];

  // Instead of processing subclassFeatures references, directly process all individual subclass features
  // that belong to this specific subclass
  const relevantFeatures = subclassFeatureDescriptions.filter((desc) => {
    const feature = desc as Record<string, unknown>;
    return feature.className === className && 
           feature.subclassShortName === subclassShortName &&
           feature.name && 
           feature.level;
  });

  const features = relevantFeatures.map((featureDesc) => {
    const feature = featureDesc as Record<string, unknown>;
    let entries: string[] = [];
    if (feature.entries && Array.isArray(feature.entries)) {
      entries = processFeatureEntries(feature.entries);
    }

    // Force 2024 D&D compliance: all subclass features start at level 3 minimum
    const originalLevel = Number(feature.level) || 3;
    const adjustedLevel = originalLevel < 3 ? 3 : originalLevel;

    return {
      name: String(feature.name || ''),
      level: adjustedLevel,
      source: String(feature.source || source),
      className,
      entries,
      isSubclassFeature: true,
      subclassShortName,
      original: `${feature.name}|${className}||${subclassShortName}||${feature.level}`,
      is2024Rules: Boolean(feature.basicRules2024)
    };
  });

  // Prioritize 2024 features over 2014 features for the same level and name
  return prioritize2024Features(features);
}

/**
 * Process feature entries and flatten nested structures
 */
function processFeatureEntries(entries: unknown[]): string[] {
  const result: string[] = [];
  
  for (const entry of entries) {
    if (typeof entry === 'string') {
      result.push(parseReferences(entry).html);
    } else if (entry && typeof entry === 'object') {
      const entryObj = entry as Record<string, unknown>;
      if (entryObj.type === 'entries' && Array.isArray(entryObj.entries)) {
        // Nested entries
        if (entryObj.name) {
          result.push(`<strong>${entryObj.name}</strong>`);
        }
        result.push(...processFeatureEntries(entryObj.entries));
      } else if (entryObj.type === 'inset' && Array.isArray(entryObj.entries)) {
        // Inset boxes
        if (entryObj.name) {
          result.push(`<div class="inset"><strong>${entryObj.name}</strong></div>`);
        }
        result.push(...processFeatureEntries(entryObj.entries));
      } else if (entryObj.type === 'list' && Array.isArray(entryObj.items)) {
        // Lists
        result.push('<ul>');
        for (const item of entryObj.items) {
          if (typeof item === 'string') {
            result.push(`<li>${parseReferences(item).html}</li>`);
          }
        }
        result.push('</ul>');
      } else if (Array.isArray(entryObj.entries)) {
        // Generic nested entries
        result.push(...processFeatureEntries(entryObj.entries));
      }
    }
  }
  
  return result;
}

/**
 * Extract spell slot progression from class table data
 */
function extractSpellSlotProgression(classData: RawClassData): Record<number, Record<number, number>> | undefined {
  if (!classData.classTableGroups) return undefined;
  
  for (const group of classData.classTableGroups) {
    if (group.title?.includes('Spell Slots') && group.rowsSpellProgression) {
      const progression: Record<number, Record<number, number>> = {};
      
      group.rowsSpellProgression.forEach((row, levelIndex) => {
        const level = levelIndex + 1;
        progression[level] = {};
        
        row.forEach((slots, spellLevelIndex) => {
          const spellLevel = spellLevelIndex + 1;
          if (slots > 0) {
            progression[level][spellLevel] = slots;
          }
        });
      });
      
      return progression;
    }
  }
  
  return undefined;
}

/**
 * Process raw class data into our application format
 */
function processClass(rawClass: RawClassData, subclasses: RawSubclassData[], fileData: ClassDataFile): ProcessedClass {
  const id = generateClassId(rawClass.name, rawClass.source);
  const spellcastingType = determineSpellcastingType(rawClass);
  
  // Process subclasses for this class  
  const processedSubclasses = subclasses
    .filter(sub => sub.className === rawClass.name && sub.classSource === rawClass.source)
    .filter(sub => sub.source !== 'PHB')
    .filter(sub => !(sub.source !== 'XPHB' && sub.classSource === 'XPHB')) // avoid copies
    .map(sub => processSubclass(sub, fileData))
    .sort((a, b) => {
      // First sort by source priority (PHB2024 > SRD > PHB > others)
      const sourcePriority = compareSourcePriority(a.source, b.source);
      if (sourcePriority !== 0) return sourcePriority;
      // Then sort alphabetically by name
      return a.name.localeCompare(b.name);
    })
  
  return {
    id,
    name: rawClass.name,
    source: formatSourceForDisplay(rawClass.source),
    page: rawClass.page,
    hitDie: formatHitDie(rawClass.hd),
    primaryAbilities: rawClass.proficiency || [],
    spellcasting: {
      type: spellcastingType,
      ability: rawClass.spellcastingAbility,
      preparedSpellsFormula: rawClass.preparedSpells,
      cantripProgression: rawClass.cantripProgression,
      spellsKnownProgression: rawClass.spellsKnownProgressionFixed,
    },
    proficiencies: {
      armor: formatEquipment(rawClass.startingProficiencies?.armor),
      weapons: formatEquipment(rawClass.startingProficiencies?.weapons),
      tools: formatEquipment(rawClass.startingProficiencies?.tools),
      savingThrows: rawClass.proficiency || [],
      skillChoices: extractSkillChoices(rawClass.startingProficiencies?.skills),
    },
    startingEquipment: formatEquipment(rawClass.startingEquipment?.default),
    multiclassing: rawClass.multiclassing ? {
      requirements: processMulticlassingRequirements(rawClass.multiclassing.requirements),
      proficienciesGained: {
        armor: formatEquipment(rawClass.multiclassing.proficienciesGained?.armor),
        weapons: formatEquipment(rawClass.multiclassing.proficienciesGained?.weapons),
        tools: formatEquipment(rawClass.multiclassing.proficienciesGained?.tools),
      }
    } : undefined,
    features: processClassFeatures(
      rawClass.classFeatures || [], 
      (fileData.classFeature || []) as Record<string, unknown>[], 
      rawClass.name, 
      rawClass.source
    ),
    spellSlotProgression: extractSpellSlotProgression(rawClass),
    subclasses: processedSubclasses,
    isSrd: rawClass.srd || false,
    tags: [
      rawClass.source || 'unknown',
      spellcastingType,
      rawClass.spellcastingAbility || 'none',
      formatHitDie(rawClass.hd),
      ...(rawClass.edition ? [rawClass.edition] : [])
    ]
  };
}

/**
 * Prioritize 2024 features over 2014 features when both exist for the same level and name
 */
function prioritize2024Features(features: ClassFeature[]): ClassFeature[] {
  const featureMap = new Map<string, ClassFeature[]>();
  
  // Group features by level and name
  for (const feature of features) {
    const key = `${feature.level}-${feature.name}`;
    if (!featureMap.has(key)) {
      featureMap.set(key, []);
    }
    featureMap.get(key)!.push(feature);
  }
  
  const prioritizedFeatures: ClassFeature[] = [];
  
  // For each group, prioritize 2024 version if available
  for (const [key, featureGroup] of featureMap.entries()) {
    if (featureGroup.length === 1) {
      // Only one version, use it
      prioritizedFeatures.push(featureGroup[0]);
    } else {
      // Multiple versions - find 2024 version
      const rules2024Feature = featureGroup.find(f => f.is2024Rules);
      if (rules2024Feature) {
        prioritizedFeatures.push(rules2024Feature);
      } else {
        // No 2024 version found, use the first one (should be prioritized by source already)
        prioritizedFeatures.push(featureGroup[0]);
      }
    }
  }
  
  return prioritizedFeatures.sort((a, b) => a.level - b.level);
}

/**
 * Clean spell name by removing source suffix (e.g., "fireball|xphb" -> "fireball")
 */
function cleanSpellName(spellName: unknown): string {
  try {
    // Handle null/undefined
    if (spellName == null) {
      return '';
    }
    
    // Handle various input types
    if (typeof spellName === 'string') {
      // Remove source suffixes like "|xphb", "|phb", etc.
      const cleaned = spellName.split('|')[0] || spellName;
      return cleaned.trim();
    } else if (typeof spellName === 'object') {
      // Handle object format like { "name": "fireball", "source": "xphb" }
      const spellObj = spellName as Record<string, unknown>;
      
      // Try different object properties
      if (spellObj.name && typeof spellObj.name === 'string') {
        const cleaned = spellObj.name.split('|')[0] || spellObj.name;
        return cleaned.trim();
      }
      if (spellObj.spell && typeof spellObj.spell === 'string') {
        const cleaned = spellObj.spell.split('|')[0] || spellObj.spell;
        return cleaned.trim();
      }
      
      // Skip logging for known spell selection rules (these are intentional)
      if (spellObj.all || spellObj.choose || spellObj.daily || spellObj._) {
        return ''; // These are spell selection rules, not actual spells
      }
      
      // Log truly unexpected objects for debugging
      console.warn('Unexpected spell object format:', JSON.stringify(spellObj));
      return '';
    }
    
    // Fallback for other types (numbers, etc.)
    const fallbackStr = String(spellName);
    const cleaned = fallbackStr.includes('|') ? fallbackStr.split('|')[0] : fallbackStr;
    return cleaned.trim();
  } catch (error) {
    console.error('Error in cleanSpellName with input:', spellName, 'Error:', error);
    return '';
  }
}

/**
 * Process additional spells for subclasses
 */
function processSubclassSpells(additionalSpells?: Array<{
  prepared?: Record<string, unknown>;
  known?: Record<string, unknown>;
  expanded?: Record<string, unknown>;
}>): SubclassSpellList[] {
  if (!additionalSpells || additionalSpells.length === 0) return [];

  const spellList: SubclassSpellList[] = [];
  
  additionalSpells.forEach(spellGroup => {
    // Process prepared spells (most common for Domain, Oath, etc.)
    if (spellGroup.prepared) {
      Object.entries(spellGroup.prepared).forEach(([level, spells]) => {
        // Handle various spell list formats
        let cleanedSpells: string[] = [];
        
        try {
          if (Array.isArray(spells) && typeof spells.map === 'function') {
            cleanedSpells = spells
              .map(cleanSpellName)
              .filter(name => typeof name === 'string' && name.trim().length > 0);
          } else if (typeof spells === 'string') {
            const cleaned = cleanSpellName(spells);
            if (cleaned && cleaned.trim().length > 0) {
              cleanedSpells = [cleaned];
            }
          } else if (spells && typeof spells === 'object') {
            // Handle object format - might be a single spell object
            const cleaned = cleanSpellName(spells);
            if (cleaned && cleaned.trim().length > 0) {
              cleanedSpells = [cleaned];
            }
          }
          
          // Additional validation - ensure all entries are valid strings
          cleanedSpells = cleanedSpells.filter(spell => 
            typeof spell === 'string' && 
            spell.trim().length > 0 && 
            !spell.includes('[object Object]')
          );
        } catch (error) {
          console.error(`Error processing prepared spells at level ${level}:`, spells, 'Error:', error);
        }
            
        if (cleanedSpells.length > 0) {
          spellList.push({
            level: parseInt(level),
            spells: cleanedSpells
          });
        }
      });
    }
    
    // Process known spells (some subclasses like Aberrant Mind Sorcerer)
    if (spellGroup.known) {
      Object.entries(spellGroup.known).forEach(([level, spells]) => {
        // Handle various spell list formats
        let cleanedSpells: string[] = [];
        
        try {
          if (Array.isArray(spells) && typeof spells.map === 'function') {
            cleanedSpells = spells
              .map(cleanSpellName)
              .filter(name => typeof name === 'string' && name.trim().length > 0);
          } else if (typeof spells === 'string') {
            const cleaned = cleanSpellName(spells);
            if (cleaned && cleaned.trim().length > 0) {
              cleanedSpells = [cleaned];
            }
          } else if (spells && typeof spells === 'object') {
            // Handle object format - might be a single spell object
            const cleaned = cleanSpellName(spells);
            if (cleaned && cleaned.trim().length > 0) {
              cleanedSpells = [cleaned];
            }
          }
          
          // Additional validation - ensure all entries are valid strings
          cleanedSpells = cleanedSpells.filter(spell => 
            typeof spell === 'string' && 
            spell.trim().length > 0 && 
            !spell.includes('[object Object]')
          );
        } catch (error) {
          console.error(`Error processing known spells at level ${level}:`, spells, 'Error:', error);
        }
            
        if (cleanedSpells.length > 0) {
          spellList.push({
            level: parseInt(level),
            spells: cleanedSpells
          });
        }
      });
    }
    
    // Process expanded spells (Warlocks)
    if (spellGroup.expanded) {
      Object.entries(spellGroup.expanded).forEach(([level, spells]) => {
        // Handle various spell list formats
        let cleanedSpells: string[] = [];
        
        try {
          if (Array.isArray(spells) && typeof spells.map === 'function') {
            cleanedSpells = spells
              .map(cleanSpellName)
              .filter(name => typeof name === 'string' && name.trim().length > 0);
          } else if (typeof spells === 'string') {
            const cleaned = cleanSpellName(spells);
            if (cleaned && cleaned.trim().length > 0) {
              cleanedSpells = [cleaned];
            }
          } else if (spells && typeof spells === 'object') {
            // Handle object format - might be a single spell object
            const cleaned = cleanSpellName(spells);
            if (cleaned && cleaned.trim().length > 0) {
              cleanedSpells = [cleaned];
            }
          }
          
          // Additional validation - ensure all entries are valid strings
          cleanedSpells = cleanedSpells.filter(spell => 
            typeof spell === 'string' && 
            spell.trim().length > 0 && 
            !spell.includes('[object Object]')
          );
        } catch (error) {
          console.error(`Error processing expanded spells at level ${level}:`, spells, 'Error:', error);
        }
            
        if (cleanedSpells.length > 0) {
          spellList.push({
            level: parseInt(level),
            spells: cleanedSpells
          });
        }
      });
    }
  });

  return spellList.sort((a, b) => a.level - b.level);
}

/**
 * Process raw subclass data into our application format
 */
function processSubclass(rawSubclass: RawSubclassData, fileData: ClassDataFile): ProcessedSubclass {
  const id = generateSubclassId(rawSubclass.name, rawSubclass.className, rawSubclass.source);
  
  return {
    id,
    name: rawSubclass.name,
    shortName: rawSubclass.shortName,
    source: formatSourceForDisplay(rawSubclass.source),
    page: rawSubclass.page,
    parentClassName: rawSubclass.className,
    parentClassSource: rawSubclass.classSource,
    features: processSubclassFeatures(
      rawSubclass.subclassFeatures || [],
      (fileData.subclassFeature || []) as Record<string, unknown>[],
      rawSubclass.className,
      rawSubclass.source,
      rawSubclass.shortName || rawSubclass.name
    ),
    spellList: (() => {
      try {
        // Only process spell lists for classes that should have them
        const classesWithSubclassSpells = ['Cleric', 'Paladin', 'Warlock', 'Sorcerer', 'Ranger'];
        if (!classesWithSubclassSpells.includes(rawSubclass.className)) {
          return [];
        }
        return processSubclassSpells(rawSubclass.additionalSpells);
      } catch (error) {
        console.error(`Error processing spell list for ${rawSubclass.name}:`, error);
        return [];
      }
    })(),
    tags: [
      rawSubclass.source,
      rawSubclass.className.toLowerCase(),
      ...(rawSubclass.edition ? [rawSubclass.edition] : [])
    ]
  };
}

/**
 * Load and process all classes from JSON files
 */
export async function loadAllClasses(): Promise<ProcessedClass[]> {
  // Return cached classes if available
  if (cachedClasses) {
    return cachedClasses;
  }
  
  try {
    const classDataFiles = await loadClassFiles();
    const processedClasses: ProcessedClass[] = [];
    
    for (const classFile of classDataFiles) {
      // Process each class in the file
      for (const rawClass of classFile.class || []) {
        try {
          const processedClass = processClass(rawClass, classFile.subclass || [], classFile);
          processedClasses.push(processedClass);
        } catch (error) {
          console.error(`Error processing class ${rawClass.name}:`, error);
          // Log more details about the error for debugging
          if (error instanceof Error) {
            console.error(`Stack trace:`, error.stack);
          }
          // Continue with other classes instead of failing completely
        }
      }
    }
    
    // Remove duplicates (same class from different sources)
    // Priority: PHB2024 (XPHB) > SRD > PHB > others
    const uniqueClasses = new Map<string, ProcessedClass>();
    
    for (const processedClass of processedClasses) {
      const key = processedClass.name.toLowerCase();
      const existingClass = uniqueClasses.get(key);
      
      if (!existingClass) {
        // No existing class, add this one
        uniqueClasses.set(key, processedClass);
      } else {
        // Check if we should replace the existing class
        const shouldReplace = 
          processedClass.source === 'PHB2024' || // Always prefer 2024 version
          (existingClass.source !== 'PHB2024' && processedClass.isSrd) || // Prefer SRD if no 2024 version
          (existingClass.source !== 'PHB2024' && !existingClass.isSrd && processedClass.source === 'PHB'); // Prefer PHB over others if no 2024/SRD
        
        if (shouldReplace) {
          processedClass.subclasses = [...existingClass.subclasses, ...processedClass.subclasses]
          .sort((a, b) => a.name.localeCompare(b.name));
          uniqueClasses.set(key, processedClass);
        }
      }
    }
    
    cachedClasses = Array.from(uniqueClasses.values());
    
    console.log(`Loaded ${cachedClasses.length} unique classes from ${processedClasses.length} total class entries`);
    
    return cachedClasses;
  } catch (error) {
    console.error('Error loading classes:', error);
    return [];
  }
}

 