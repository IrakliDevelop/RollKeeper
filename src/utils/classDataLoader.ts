import { promises as fs } from 'fs';
import path from 'path';
import { 
  ClassDataFile, 
  RawClassData, 
  RawSubclassData, 
  ProcessedClass, 
  ProcessedSubclass,
  SpellcastingType,
  SpellcastingAbility,
  ProficiencyType
} from '@/types/classes';

// Cache for loaded classes to avoid reprocessing
let cachedClasses: ProcessedClass[] | null = null;

/**
 * Load all class JSON files from the json/class directory
 */
async function loadClassFiles(): Promise<ClassDataFile[]> {
  const classDir = path.join(process.cwd(), 'json', 'class');
  console.log(`Looking for class files in: ${classDir}`);
  
  const files = await fs.readdir(classDir);
  const classFiles = files.filter(file => file.endsWith('.json'));
  console.log(`Found ${classFiles.length} JSON files: ${classFiles.join(', ')}`);
  
  const allClassData: ClassDataFile[] = [];
  
  for (const file of classFiles) {
    try {
      const filePath = path.join(classDir, file);
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const data: ClassDataFile = JSON.parse(fileContent);
      
      console.log(`File ${file}: ${data.class?.length || 0} classes, ${data.subclass?.length || 0} subclasses`);
      
      if (data.class && Array.isArray(data.class)) {
        allClassData.push(data);
      } else {
        console.warn(`File ${file} does not contain valid class array`);
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
    // Remove D&D Beyond formatting like {@item ...}
    return itemStr.replace(/\{@[^}]+\|([^|}]+)(\|[^}]*)?\}/g, '$1');
  });
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
function processClass(rawClass: RawClassData, subclasses: RawSubclassData[]): ProcessedClass {
  const id = generateClassId(rawClass.name, rawClass.source);
  const spellcastingType = determineSpellcastingType(rawClass);
  
  // Process subclasses for this class
  const processedSubclasses = subclasses
    .filter(sub => sub.className === rawClass.name && sub.classSource === rawClass.source)
    .map(sub => processSubclass(sub));
  
  return {
    id,
    name: rawClass.name,
    source: rawClass.source,
    page: rawClass.page,
    hitDie: formatHitDie(rawClass.hd),
    primaryAbilities: rawClass.proficiency,
    spellcasting: {
      type: spellcastingType,
      ability: rawClass.spellcastingAbility,
      preparedSpellsFormula: rawClass.preparedSpells,
      cantripProgression: rawClass.cantripProgression,
      spellsKnownProgression: rawClass.spellsKnownProgressionFixed,
    },
    proficiencies: {
      armor: formatEquipment(rawClass.startingProficiencies.armor),
      weapons: formatEquipment(rawClass.startingProficiencies.weapons),
      tools: formatEquipment(rawClass.startingProficiencies.tools),
      savingThrows: rawClass.proficiency,
      skillChoices: extractSkillChoices(rawClass.startingProficiencies.skills),
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
    features: rawClass.classFeatures || [],
    spellSlotProgression: extractSpellSlotProgression(rawClass),
    subclasses: processedSubclasses,
    isSrd: rawClass.srd || false,
    tags: [
      rawClass.source,
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
function processSubclass(rawSubclass: RawSubclassData): ProcessedSubclass {
  const id = generateSubclassId(rawSubclass.name, rawSubclass.className, rawSubclass.source);
  
  return {
    id,
    name: rawSubclass.name,
    shortName: rawSubclass.shortName,
    source: rawSubclass.source,
    page: rawSubclass.page,
    parentClassName: rawSubclass.className,
    parentClassSource: rawSubclass.classSource,
    features: rawSubclass.subclassFeatures,
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
    console.log(`Loaded ${classDataFiles.length} class data files`);
    
    const processedClasses: ProcessedClass[] = [];
    
    for (const classFile of classDataFiles) {
      console.log(`Processing file with ${classFile.class?.length || 0} classes`);
      
      // Process each class in the file
      for (const rawClass of classFile.class || []) {
        try {
          const processedClass = processClass(rawClass, classFile.subclass || []);
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

 