import { promises as fs } from 'fs';
import path from 'path';
import { parseReferences } from './referenceParser';
import { 
  ClassDataFile, 
  RawClassData, 
  RawSubclassData, 
  ProcessedClass, 
  ProcessedSubclass,
  ClassFeature,
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

  return classFeatures.map((feature) => {
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
      original
    };
  });
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
  if (!subclassFeatures || !Array.isArray(subclassFeatures)) return [];

  return subclassFeatures.map((feature) => {
    let featureName: string;
    let level: number = 3; // Default to 3 for subclass features
    let original: string;

    if (typeof feature === 'string') {
      const parts = feature.split('|');
      featureName = parts[0] || feature;
      original = feature;
      
      // Subclass format: "Feature Name|Class||Subclass||Level"
      if (parts.length >= 6 && parts[2] === '' && parts[4] === '') {
        level = parseInt(parts[5]) || 3;
      } else if (parts.length >= 4) {
        // Fallback format
        level = parseInt(parts[3]) || 3;
      }
    } else {
      featureName = String(feature);
      original = String(feature);
    }

    // Find the feature description in subclassFeatureDescriptions
    const featureDesc = subclassFeatureDescriptions?.find((desc) => 
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
      isSubclassFeature: true,
      subclassShortName,
      original
    };
  });
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
    .map(sub => processSubclass(sub, fileData));
  
  return {
    id,
    name: rawClass.name,
    source: rawClass.source,
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
      requirements: rawClass.multiclassing.requirements || {},
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
 * Process raw subclass data into our application format
 */
function processSubclass(rawSubclass: RawSubclassData, fileData: ClassDataFile): ProcessedSubclass {
  const id = generateSubclassId(rawSubclass.name, rawSubclass.className, rawSubclass.source);
  
  return {
    id,
    name: rawSubclass.name,
    shortName: rawSubclass.shortName,
    source: rawSubclass.source,
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
          // Continue with other classes instead of failing completely
        }
      }
    }
    
    // Remove duplicates (prefer SRD versions when available)
    const uniqueClasses = new Map<string, ProcessedClass>();
    
    for (const processedClass of processedClasses) {
      const key = processedClass.name.toLowerCase();
      if (!uniqueClasses.has(key) || processedClass.isSrd) {
        uniqueClasses.set(key, processedClass);
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

 