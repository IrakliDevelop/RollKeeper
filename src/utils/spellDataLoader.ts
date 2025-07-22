import { promises as fs } from 'fs';
import path from 'path';
import { RawSpellData, ProcessedSpell, SpellClass, SPELL_SCHOOLS } from '@/types/spells';
import { formatSourceForDisplay } from './sourceUtils';

// Cache for loaded spells to avoid reprocessing
let cachedSpells: ProcessedSpell[] | null = null;

/**
 * Load all spell JSON files from the json/spells directory
 */
async function loadSpellFiles(): Promise<RawSpellData[]> {
  const spellsDir = path.join(process.cwd(), 'json', 'spells');
  const files = await fs.readdir(spellsDir);
  const spellFiles = files.filter(file => file.endsWith('.json'));
  
  const allSpells: RawSpellData[] = [];
  
  for (const file of spellFiles) {
    try {
      const filePath = path.join(spellsDir, file);
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(fileContent);
      
      if (data.spell && Array.isArray(data.spell)) {
        allSpells.push(...data.spell);
      }
    } catch (error) {
      console.error(`Error loading spell file ${file}:`, error);
    }
  }
  
  return allSpells;
}

/**
 * Generate a unique ID for a spell based on name and source
 */
function generateSpellId(name: string, source: string): string {
  return `${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${source.toLowerCase()}`;
}

/**
 * Convert casting time data to human-readable string
 */
function formatCastingTime(time: RawSpellData['time']): string {
  if (!time || time.length === 0) return 'Unknown';
  
  const primary = time[0];
  let result = `${primary.number} ${primary.unit}`;
  
  if (primary.number !== 1) {
    result += 's';
  }
  
  if (primary.condition) {
    result += ` (${primary.condition})`;
  }
  
  return result;
}

/**
 * Convert range data to human-readable string
 */
function formatRange(range: RawSpellData['range']): string {
  if (range.type === 'self') return 'Self';
  if (range.type === 'touch') return 'Touch';
  if (range.type === 'sight') return 'Sight';
  if (range.type === 'unlimited') return 'Unlimited';
  
  if (range.distance) {
    if (range.distance.type === 'self') return 'Self';
    if (range.distance.type === 'touch') return 'Touch';
    if (range.distance.type === 'sight') return 'Sight';
    if (range.distance.type === 'unlimited') return 'Unlimited';
    
    if (range.distance.amount) {
      return `${range.distance.amount} ${range.distance.type}`;
    }
  }
  
  return 'Special';
}

/**
 * Convert duration data to human-readable string
 */
function formatDuration(duration: RawSpellData['duration']): string {
  if (!duration || duration.length === 0) return 'Unknown';
  
  const primary = duration[0];
  
  if (primary.type === 'instant') return 'Instantaneous';
  if (primary.type === 'permanent') return 'Permanent';
  if (primary.type === 'special') return 'Special';
  
  if (primary.type === 'timed' && primary.duration) {
    let result = `${primary.duration.amount || 1} ${primary.duration.type}`;
    if ((primary.duration.amount || 1) !== 1) {
      result += 's';
    }
    return result;
  }
  
  return 'Special';
}

/**
 * Check if a duration has concentration
 */
function hasConcentration(duration: RawSpellData['duration']): boolean {
  return duration.some(d => d.concentration === true);
}

/**
 * Map spell names to their available classes based on D&D 5e rules
 * This includes the 11 main spellcasting classes and their spell access
 */
function getSpellClasses(spellName: string): SpellClass[] {
  const name = spellName.toLowerCase();
  const classes: SpellClass[] = [];

  // ARTIFICER SPELLS (Tasha's Cauldron of Everything)
  const artificerSpells = [
    // Cantrips
    'guidance', 'mage hand', 'mending', 'message', 'prestidigitation', 'spare the dying',
    // 1st Level
    'alarm', 'cure wounds', 'detect magic', 'detect poison and disease', 'disguise self', 
    'expeditious retreat', 'false life', 'feather fall', 'identify', 'jump', 'longstrider',
    'purify food and drink', 'sanctuary', 'shield of faith',
    // 2nd Level
    'aid', 'arcane lock', 'blur', 'continual flame', 'darkvision', 'enhance ability',
    'enlarge/reduce', 'heat metal', 'invisibility', 'lesser restoration', 'levitate',
    'magic missile', 'magic weapon', 'protection from poison', 'resist elements', 'see invisibility',
    'spider climb', 'web',
    // 3rd Level
    'blink', 'catnap', 'create food and water', 'dispel magic', 'elemental weapon',
    'flame arrows', 'fly', 'gaseous form', 'glyph of warding', 'haste', 'protection from energy',
    'revivify', 'tiny hut', 'water breathing', 'water walk',
    // 4th Level
    'arcane eye', 'death ward', 'fabricate', 'freedom of movement', 'greater invisibility',
    'otiluke\'s resilient sphere', 'mordenkainen\'s faithful hound', 'stone shape', 'stoneskin',
    // 5th Level
    'animate objects', 'creation', 'greater restoration', 'wall of stone'
  ];

  // BARD SPELLS
  const bardSpells = [
    // Cantrips
    'blade ward', 'dancing lights', 'friends', 'light', 'mage hand', 'mending', 'message',
    'minor illusion', 'prestidigitation', 'thunderclap', 'true strike', 'vicious mockery',
    // 1st Level
    'animal friendship', 'bane', 'charm person', 'comprehend languages', 'cure wounds',
    'detect magic', 'disguise self', 'dissonant whispers', 'earth tremor', 'faerie fire',
    'feather fall', 'healing word', 'heroism', 'identify', 'illusory script', 'longstrider',
    'silent image', 'sleep', 'speak with animals', 'tasha\'s hideous laughter', 'thunderwave',
    'unseen servant',
    // 2nd Level
    'animal messenger', 'blindness/deafness', 'calm emotions', 'cloud of daggers', 'crown of madness',
    'detect thoughts', 'enhance ability', 'enthrall', 'heat metal', 'hold person', 'invisibility',
    'knock', 'lesser restoration', 'locate animals or plants', 'locate object', 'magic mouth',
    'see invisibility', 'shatter', 'silence', 'suggestion', 'zone of truth',
    // 3rd Level  
    'bestow curse', 'catnap', 'clairvoyance', 'counterspell', 'dispel magic', 'fear',
    'feign death', 'glyph of warding', 'hypnotic pattern', 'leomund\'s tiny hut', 'major image',
    'nondetection', 'plant growth', 'sending', 'speak with dead', 'speak with plants',
    'stinking cloud', 'tongues',
    // 4th Level
    'charm monster', 'compulsion', 'confusion', 'dimension door', 'freedom of movement',
    'greater invisibility', 'hallucinatory terrain', 'locate creature', 'polymorph',
    // 5th Level
    'animate objects', 'awaken', 'dominate person', 'dream', 'geas', 'greater restoration',
    'hold monster', 'legend lore', 'mass cure wounds', 'mislead', 'modify memory',
    'planar binding', 'raise dead', 'scrying', 'seeming', 'teleportation circle',
    // 6th Level
    'eyebite', 'find the path', 'guards and wards', 'mass suggestion', 'otto\'s irresistible dance',
    'programmed illusion', 'true seeing',
    // 7th Level
    'etherealness', 'forcecage', 'mirage arcane', 'mordenkainen\'s magnificent mansion',
    'plane shift', 'project image', 'regenerate', 'resurrection', 'reverse gravity', 'teleport',
    // 8th Level
    'dominate monster', 'feeblemind', 'glibness', 'mind blank', 'power word stun',
    // 9th Level
    'foresight', 'power word kill', 'true polymorph'
  ];

  // CLERIC SPELLS
  const clericSpells = [
    // Cantrips
    'guidance', 'light', 'mending', 'resistance', 'sacred flame', 'spare the dying', 'thaumaturgy',
    'toll the dead', 'word of radiance',
    // 1st Level
    'bane', 'bless', 'command', 'create or destroy water', 'cure wounds', 'detect evil and good',
    'detect magic', 'detect poison and disease', 'guiding bolt', 'healing word', 'inflict wounds',
    'protection from evil and good', 'purify food and drink', 'sanctuary', 'shield of faith',
    // 2nd Level
    'aid', 'augury', 'blindness/deafness', 'calm emotions', 'continual flame', 'enhance ability',
    'find traps', 'gentle repose', 'hold person', 'lesser restoration', 'locate object',
    'prayer of healing', 'protection from poison', 'silence', 'spiritual weapon', 'warding bond',
    'zone of truth',
    // 3rd Level
    'animate dead', 'beacon of hope', 'bestow curse', 'clairvoyance', 'create food and water',
    'daylight', 'dispel magic', 'feign death', 'fireball', 'glyph of warding', 'magic circle',
    'mass healing word', 'meld into stone', 'protection from energy', 'remove curse',
    'revivify', 'sending', 'speak with dead', 'spirit guardians', 'tongues', 'water walk',
    // 4th Level
    'banishment', 'control water', 'death ward', 'divination', 'freedom of movement',
    'guardian of faith', 'locate creature', 'stone shape',
    // 5th Level
    'commune', 'contagion', 'dispel evil and good', 'flame strike', 'geas', 'greater restoration',
    'hallow', 'heal', 'insect plague', 'legend lore', 'mass cure wounds', 'planar binding',
    'raise dead', 'scrying',
    // 6th Level
    'find the path', 'forbiddance', 'harm', 'heal', 'planar ally', 'true seeing', 'word of recall',
    // 7th Level
    'divine word', 'etherealness', 'fire storm', 'plane shift', 'regenerate', 'resurrection',
    // 8th Level
    'antimagic field', 'control weather', 'earthquake', 'holy aura',
    // 9th Level
    'astral projection', 'gate', 'mass heal', 'true resurrection'
  ];

  // DRUID SPELLS
  const druidSpells = [
    // Cantrips
    'control flames', 'create bonfire', 'druidcraft', 'frostbite', 'guidance', 'gust',
    'infestation', 'magic stone', 'mending', 'mold earth', 'poison spray', 'produce flame',
    'resistance', 'shape water', 'shillelagh', 'thorn whip', 'thunderclap',
    // 1st Level
    'absorb elements', 'animal friendship', 'beast bond', 'charm person', 'create or destroy water',
    'cure wounds', 'detect magic', 'detect poison and disease', 'earth tremor', 'entangle',
    'faerie fire', 'fog cloud', 'goodberry', 'healing word', 'ice knife', 'jump', 'longstrider',
    'purify food and drink', 'speak with animals', 'thunderwave',
    // 2nd Level  
    'animal messenger', 'barkskin', 'beast sense', 'darkvision', 'dust devil', 'earthbind',
    'enhance ability', 'find traps', 'flame blade', 'flaming sphere', 'gust of wind',
    'heat metal', 'hold person', 'lesser restoration', 'locate animals or plants',
    'locate object', 'moonbeam', 'pass without trace', 'protection from poison',
    'skywrite', 'spike growth', 'warding bond',
    // 3rd Level
    'call lightning', 'conjure animals', 'daylight', 'dispel magic', 'erupting earth',
    'feign death', 'fireball', 'meld into stone', 'plant growth', 'protection from energy',
    'sleet storm', 'speak with plants', 'tidal wave', 'wall of water', 'water breathing',
    'water walk', 'wind wall',
    // 4th Level
    'blight', 'confusion', 'conjure minor elementals', 'conjure woodland beings',
    'control water', 'dominate beast', 'elemental bane', 'freedom of movement',
    'giant insect', 'grasping vine', 'hallucinatory terrain', 'ice storm', 'locate creature',
    'polymorph', 'stone shape', 'stoneskin', 'wall of fire',
    // 5th Level
    'antilife shell', 'awaken', 'commune with nature', 'conjure elemental', 'contagion',
    'control winds', 'geas', 'greater restoration', 'heal', 'insect plague', 'legend lore',
    'mass cure wounds', 'planar binding', 'reincarnate', 'scrying', 'transmute rock', 'tree stride',
    'wall of stone',
    // 6th Level
    'bones of the earth', 'conjure fey', 'find the path', 'heal', 'heroes\' feast',
    'move earth', 'primordial ward', 'sunbeam', 'transport via plants', 'wall of thorns',
    'wind walk',
    // 7th Level
    'fire storm', 'mirage arcane', 'plane shift', 'regenerate', 'reverse gravity',
    // 8th Level
    'animal shapes', 'antipathy/sympathy', 'control weather', 'earthquake', 'feeblemind',
    'sunburst', 'tsunami',
    // 9th Level
    'foresight', 'shapechange', 'storm of vengeance', 'true resurrection'
  ];

  // PALADIN SPELLS (2nd level and higher)
  const paladinSpells = [
    // 1st Level
    'bless', 'command', 'compelled duel', 'cure wounds', 'detect evil and good', 'detect magic',
    'detect poison and disease', 'divine favor', 'heroism', 'protection from evil and good',
    'purify food and drink', 'sanctuary', 'searing smite', 'shield of faith', 'thunderous smite',
    'wrathful smite',
    // 2nd Level
    'aid', 'branding smite', 'find steed', 'lesser restoration', 'locate object',
    'magic weapon', 'protection from poison', 'zone of truth',
    // 3rd Level
    'aura of vitality', 'blinding smite', 'create food and water', 'crusader\'s mantle',
    'daylight', 'dispel magic', 'elemental weapon', 'magic circle', 'remove curse',
    'revivify',
    // 4th Level
    'aura of life', 'aura of purity', 'banishment', 'death ward', 'freedom of movement',
    'locate creature', 'staggering smite',
    // 5th Level
    'banishing smite', 'circle of power', 'destructive wave', 'dispel evil and good',
    'geas', 'greater restoration', 'raise dead'
  ];

  // RANGER SPELLS (2nd level and higher)
  const rangerSpells = [
    // 1st Level
    'absorb elements', 'alarm', 'animal friendship', 'beast bond', 'cure wounds',
    'detect magic', 'detect poison and disease', 'ensnaring strike', 'entangle',
    'fog cloud', 'goodberry', 'hail of thorns', 'hunter\'s mark', 'jump', 'longstrider',
    'speak with animals',
    // 2nd Level
    'animal messenger', 'barkskin', 'beast sense', 'cordon of arrows', 'darkvision',
    'find traps', 'lesser restoration', 'locate animals or plants', 'locate object',
    'pass without trace', 'protection from poison', 'silence', 'spike growth',
    // 3rd Level
    'conjure animals', 'conjure barrage', 'daylight', 'lightning arrow', 'nondetection',
    'plant growth', 'protection from energy', 'speak with plants', 'water breathing',
    'water walk', 'wind wall',
    // 4th Level
    'conjure woodland beings', 'freedom of movement', 'grasping vine', 'guardian of nature',
    'locate creature', 'stoneskin',
    // 5th Level
    'commune with nature', 'conjure volley', 'greater restoration', 'steel wind strike',
    'swift quiver', 'tree stride'
  ];

  // SORCERER SPELLS
  const sorcererSpells = [
    // Cantrips
    'acid splash', 'blade ward', 'chill touch', 'control flames', 'create bonfire',
    'dancing lights', 'fire bolt', 'frostbite', 'gust', 'infestation', 'light',
    'mage hand', 'mending', 'message', 'minor illusion', 'mold earth', 'poison spray',
    'prestidigitation', 'ray of frost', 'shape water', 'shocking grasp', 'thunderclap',
    'true strike',
    // 1st Level
    'absorb elements', 'burning hands', 'charm person', 'chromatic orb', 'color spray',
    'comprehend languages', 'detect magic', 'disguise self', 'earth tremor', 'expeditious retreat',
    'false life', 'feather fall', 'fog cloud', 'ice knife', 'jump', 'mage armor',
    'magic missile', 'ray of sickness', 'shield', 'silent image', 'sleep',
    'thunderwave', 'witch bolt',
    // 2nd Level
    'alter self', 'blindness/deafness', 'blur', 'cloud of daggers', 'crown of madness',
    'darkness', 'darkvision', 'detect thoughts', 'enhance ability', 'enlarge/reduce',
    'gust of wind', 'hold person', 'invisibility', 'knock', 'levitate', 'magic weapon',
    'mirror image', 'misty step', 'scorching ray', 'see invisibility', 'shatter',
    'spider climb', 'suggestion', 'web',
    // 3rd Level
    'blink', 'clairvoyance', 'counterspell', 'daylight', 'dispel magic', 'erupting earth',
    'fear', 'fireball', 'fly', 'gaseous form', 'haste', 'hypnotic pattern',
    'lightning bolt', 'major image', 'protection from energy', 'sleet storm',
    'slow', 'stinking cloud', 'tongues', 'tidal wave', 'vampiric touch',
    'wall of water', 'water breathing', 'water walk',
    // 4th Level
    'banishment', 'blight', 'confusion', 'dimension door', 'dominate beast',
    'greater invisibility', 'ice storm', 'polymorph', 'stoneskin', 'wall of fire',
    // 5th Level
    'animate objects', 'cloudkill', 'cone of cold', 'creation', 'dominate person',
    'hold monster', 'insect plague', 'seeming', 'telekinesis', 'teleportation circle',
    'wall of stone',
    // 6th Level
    'arcane gate', 'chain lightning', 'circle of death', 'disintegrate',
    'eyebite', 'flesh to stone', 'globe of invulnerability', 'mass suggestion',
    'move earth', 'sunbeam', 'true seeing',
    // 7th Level
    'delayed blast fireball', 'etherealness', 'finger of death', 'fire storm',
    'plane shift', 'prismatic spray', 'reverse gravity', 'teleport',
    // 8th Level
    'dominate monster', 'earthquake', 'incendiary cloud', 'power word stun', 'sunburst',
    // 9th Level
    'gate', 'meteor swarm', 'power word kill', 'time stop', 'wish'
  ];

  // WARLOCK SPELLS
  const warlockSpells = [
    // Cantrips
    'blade ward', 'chill touch', 'create bonfire', 'eldritch blast', 'friends',
    'frostbite', 'infestation', 'mage hand', 'magic stone', 'minor illusion',
    'poison spray', 'prestidigitation', 'toll the dead', 'true strike',
    // 1st Level
    'armor of agathys', 'arms of hadar', 'charm person', 'comprehend languages',
    'expeditious retreat', 'hellish rebuke', 'hex', 'illusory script',
    'protection from evil and good', 'unseen servant', 'witch bolt',
    // 2nd Level
    'blindness/deafness', 'cloud of daggers', 'crown of madness', 'darkness',
    'enthrall', 'hold person', 'invisibility', 'mirror image', 'misty step',
    'ray of enfeeblement', 'shatter', 'spider climb', 'suggestion',
    // 3rd Level
    'counterspell', 'dispel magic', 'fear', 'fireball', 'fly', 'gaseous form',
    'hunger of hadar', 'hypnotic pattern', 'magic circle', 'major image',
    'remove curse', 'spirit guardians', 'tongues', 'vampiric touch',
    // 4th Level
    'banishment', 'blight', 'charm monster', 'confusion', 'dimension door',
    'hallucinatory terrain', 'polymorph',
    // 5th Level
    'contact other plane', 'dream', 'hold monster', 'modify memory', 'planar binding',
    'scrying', 'synaptic static', 'teleportation circle',
    // 6th Level
    'arcane gate', 'circle of death', 'conjure fey', 'create undead', 'flesh to stone',
    'mass suggestion', 'true seeing',
    // 7th Level
    'etherealness', 'finger of death', 'forcecage', 'plane shift',
    // 8th Level
    'demiplane', 'dominate monster', 'feeblemind', 'glibness', 'power word stun',
    // 9th Level
    'astral projection', 'foresight', 'imprisonment', 'power word kill', 'true polymorph'
  ];

  // WIZARD SPELLS
  const wizardSpells = [
    // Cantrips
    'acid splash', 'blade ward', 'chill touch', 'control flames', 'create bonfire',
    'dancing lights', 'encode thoughts', 'fire bolt', 'friends', 'frostbite',
    'green-flame blade', 'gust', 'infestation', 'light', 'lightning lure',
    'mage hand', 'mending', 'message', 'minor illusion', 'mold earth',
    'poison spray', 'prestidigitation', 'ray of frost', 'shape water',
    'shocking grasp', 'sword burst', 'thunderclap', 'toll the dead', 'true strike',
    // 1st Level
    'absorb elements', 'alarm', 'burning hands', 'catapult', 'cause fear',
    'charm person', 'chromatic orb', 'color spray', 'comprehend languages',
    'detect magic', 'disguise self', 'earth tremor', 'expeditious retreat',
    'false life', 'feather fall', 'find familiar', 'fog cloud', 'grease',
    'ice knife', 'identify', 'illusory script', 'jump', 'longstrider',
    'mage armor', 'magic missile', 'protection from evil and good',
    'ray of sickness', 'shield', 'silent image', 'silvery barbs', 'sleep',
    'tasha\'s hideous laughter', 'tenser\'s floating disk', 'thunderwave',
    'unseen servant', 'witch bolt',
    // 2nd Level
    'aganazzar\'s scorcher', 'alter self', 'arcane lock', 'blindness/deafness',
    'blur', 'cloud of daggers', 'continual flame', 'crown of madness',
    'darkness', 'darkvision', 'detect thoughts', 'enlarge/reduce',
    'flaming sphere', 'gentle repose', 'gust of wind', 'hold person',
    'invisibility', 'knock', 'levitate', 'locate object', 'magic mouth',
    'magic weapon', 'melf\'s acid arrow', 'mirror image', 'misty step',
    'rope trick', 'scorching ray', 'see invisibility', 'shatter',
    'spider climb', 'suggestion', 'web',
    // 3rd Level  
    'animate dead', 'bestow curse', 'blink', 'catnap', 'clairvoyance',
    'counterspell', 'dispel magic', 'erupting earth', 'fear', 'feign death',
    'fireball', 'fly', 'gaseous form', 'glyph of warding', 'haste',
    'hypnotic pattern', 'leomund\'s tiny hut', 'lightning bolt', 'magic circle',
    'major image', 'nondetection', 'phantom steed', 'protection from energy',
    'remove curse', 'sending', 'sleet storm', 'slow', 'stinking cloud',
    'tongues', 'vampiric touch', 'wall of water', 'water breathing',
    // 4th Level
    'arcane eye', 'banishment', 'blight', 'charm monster', 'confusion',
    'conjure minor elementals', 'control water', 'dimension door',
    'evard\'s black tentacles', 'fabricate', 'fire shield', 'greater invisibility',
    'hallucinatory terrain', 'ice storm', 'locate creature', 'otiluke\'s resilient sphere',
    'phantasmal killer', 'polymorph', 'private sanctum', 'stone shape',
    'stoneskin', 'wall of fire',
    // 5th Level
    'animate objects', 'bigby\'s hand', 'cloudkill', 'cone of cold',
    'conjure elemental', 'contact other plane', 'creation', 'dominate person',
    'dream', 'geas', 'hold monster', 'legend lore', 'mislead',
    'modify memory', 'passwall', 'planar binding', 'scrying', 'seeming',
    'synaptic static', 'telekinesis', 'telepathic bond', 'teleportation circle',
    'transmute rock', 'wall of force', 'wall of stone',
    // 6th Level
    'arcane gate', 'chain lightning', 'circle of death', 'contingency',
    'create undead', 'disintegrate', 'eyebite', 'flesh to stone',
    'globe of invulnerability', 'guards and wards', 'magic jar',
    'mass suggestion', 'move earth', 'otho\'s irresistible dance',
    'programmed illusion', 'sunbeam', 'true seeing', 'wall of ice',
    // 7th Level
    'delayed blast fireball', 'etherealness', 'finger of death', 'forcecage',
    'mirage arcane', 'mordenkainen\'s magnificent mansion', 'plane shift',
    'prismatic spray', 'project image', 'reverse gravity', 'sequester',
    'simulacrum', 'symbol', 'teleport',
    // 8th Level
    'antimagic field', 'antipathy/sympathy', 'clone', 'control weather',
    'demiplane', 'dominate monster', 'feeblemind', 'incendiary cloud',
    'maze', 'mind blank', 'power word stun', 'sunburst',
    // 9th Level
    'astral projection', 'foresight', 'gate', 'imprisonment', 'meteor swarm',
    'power word kill', 'prismatic wall', 'shapechange', 'time stop',
    'true polymorph', 'wish'
  ];

  // Check each class list for the spell
  if (artificerSpells.includes(name)) classes.push('artificer');
  if (bardSpells.includes(name)) classes.push('bard');
  if (clericSpells.includes(name)) classes.push('cleric');
  if (druidSpells.includes(name)) classes.push('druid');
  if (paladinSpells.includes(name)) classes.push('paladin');
  if (rangerSpells.includes(name)) classes.push('ranger');
  if (sorcererSpells.includes(name)) classes.push('sorcerer');
  if (warlockSpells.includes(name)) classes.push('warlock');
  if (wizardSpells.includes(name)) classes.push('wizard');

  // ELDRITCH KNIGHT SPELLS (Fighter subclass)
  // Limited wizard spells - primarily abjuration and evocation, plus some exceptions
  const eldritchKnightSpells = [
    // Cantrips (any wizard cantrip)
    'acid splash', 'blade ward', 'booming blade', 'chill touch', 'control flames', 'create bonfire',
    'dancing lights', 'fire bolt', 'friends', 'frostbite', 'green-flame blade', 'gust',
    'light', 'lightning lure', 'mage hand', 'mending', 'message', 'minor illusion',
    'poison spray', 'prestidigitation', 'ray of frost', 'shocking grasp', 'sword burst',
    'thunderclap', 'true strike',
    // 1st Level (abjuration/evocation + exceptions)
    'absorb elements', 'alarm', 'burning hands', 'chromatic orb', 'expeditious retreat',
    'false life', 'find familiar', 'fog cloud', 'jump', 'longstrider', 'mage armor',
    'magic missile', 'protection from evil and good', 'shield', 'thunderwave',
    // 2nd Level (abjuration/evocation + exceptions)  
    'aganazzar\'s scorcher', 'arcane lock', 'blur', 'continual flame', 'darkness',
    'darkvision', 'enlarge/reduce', 'flaming sphere', 'gust of wind', 'invisibility',
    'levitate', 'magic weapon', 'misty step', 'scorching ray', 'see invisibility',
    'shatter', 'spider climb', 'web',
    // 3rd Level (abjuration/evocation + exceptions)
    'counterspell', 'daylight', 'dispel magic', 'fear', 'fireball', 'fly',
    'gaseous form', 'haste', 'lightning bolt', 'magic circle', 'nondetection',
    'protection from energy', 'sleet storm', 'slow', 'stinking cloud', 'tongues',
    'vampiric touch', 'wall of water', 'water breathing',
    // 4th Level (abjuration/evocation + exceptions)
    'arcane eye', 'banishment', 'confusion', 'dimension door', 'evard\'s black tentacles',
    'fire shield', 'greater invisibility', 'ice storm', 'locate creature',
    'otiluke\'s resilient sphere', 'stoneskin', 'wall of fire'
  ];

  // ARCANE TRICKSTER SPELLS (Rogue subclass)  
  // Limited wizard spells - primarily illusion and enchantment, plus some exceptions
  const arcaneTricksterSpells = [
    // Cantrips (any wizard cantrip)
    'acid splash', 'blade ward', 'booming blade', 'chill touch', 'control flames', 'create bonfire',
    'dancing lights', 'encode thoughts', 'fire bolt', 'friends', 'frostbite', 'green-flame blade',
    'gust', 'infestation', 'light', 'lightning lure', 'mage hand', 'mending', 'message',
    'minor illusion', 'mold earth', 'poison spray', 'prestidigitation', 'ray of frost',
    'shape water', 'shocking grasp', 'sword burst', 'thunderclap', 'toll the dead', 'true strike',
    // 1st Level (illusion/enchantment + exceptions)
    'charm person', 'color spray', 'comprehend languages', 'detect magic', 'disguise self',
    'expeditious retreat', 'false life', 'feather fall', 'find familiar', 'fog cloud',
    'illusory script', 'jump', 'longstrider', 'silent image', 'silvery barbs', 'sleep',
    'tasha\'s hideous laughter', 'unseen servant',
    // 2nd Level (illusion/enchantment + exceptions)
    'blindness/deafness', 'blur', 'cloud of daggers', 'crown of madness', 'darkness',
    'detect thoughts', 'hold person', 'invisibility', 'knock', 'levitate', 'magic mouth',
    'mirror image', 'misty step', 'rope trick', 'see invisibility', 'spider climb', 'suggestion', 'web',
    // 3rd Level (illusion/enchantment + exceptions)
    'catnap', 'clairvoyance', 'counterspell', 'fear', 'fly', 'gaseous form', 'hypnotic pattern',
    'major image', 'nondetection', 'sending', 'slow', 'tongues',
    // 4th Level (illusion/enchantment + exceptions)
    'charm monster', 'confusion', 'dimension door', 'greater invisibility', 'hallucinatory terrain',
    'locate creature', 'phantasmal killer', 'polymorph'
  ];

  // Check subclass spell lists
  if (eldritchKnightSpells.includes(name)) classes.push('eldritch knight');
  if (arcaneTricksterSpells.includes(name)) classes.push('arcane trickster');

  return classes;
}

/**
 * Process raw spell data into our application format
 */
function processSpell(rawSpell: RawSpellData): ProcessedSpell {
  const id = generateSpellId(rawSpell.name, rawSpell.source);
  
  // Process description
  const description = rawSpell.entries.join('\n\n');
  
  // Process higher level description
  let higherLevelDescription: string | undefined;
  if (rawSpell.entriesHigherLevel && rawSpell.entriesHigherLevel.length > 0) {
    higherLevelDescription = rawSpell.entriesHigherLevel
      .map(entry => entry.entries.join('\n'))
      .join('\n\n');
  }
  
  // Process components
  const components = {
    verbal: rawSpell.components.v || false,
    somatic: rawSpell.components.s || false,
    material: !!rawSpell.components.m,
    materialComponent: typeof rawSpell.components.m === 'string' ? rawSpell.components.m : undefined,
  };
  
  return {
    id,
    name: rawSpell.name,
    level: rawSpell.level,
    school: rawSpell.school,
    schoolName: SPELL_SCHOOLS[rawSpell.school] || 'Unknown',
    source: formatSourceForDisplay(rawSpell.source),
    page: rawSpell.page,
    isRitual: rawSpell.meta?.ritual || false,
    concentration: hasConcentration(rawSpell.duration),
    castingTime: formatCastingTime(rawSpell.time),
    range: formatRange(rawSpell.range),
    components,
    duration: formatDuration(rawSpell.duration),
    description,
    higherLevelDescription,
    classes: getSpellClasses(rawSpell.name),
    tags: [
      ...(rawSpell.miscTags || []),
      ...(rawSpell.areaTags || []),
      ...(rawSpell.damageInflict || []),
      rawSpell.school,
      formatSourceForDisplay(rawSpell.source)
    ],
    damage: rawSpell.damageInflict,
    saves: rawSpell.savingThrow,
    isCantrip: rawSpell.level === 0,
    isSrd: rawSpell.srd || false,
  };
}

/**
 * Load and process all spells from JSON files
 */
export async function loadAllSpells(): Promise<ProcessedSpell[]> {
  // Return cached spells if available
  if (cachedSpells) {
    return cachedSpells;
  }
  
  try {
    const rawSpells = await loadSpellFiles();
    const processedSpells = rawSpells.map(processSpell);
    
    // Remove duplicates (same spell from different sources)
    // Priority: PHB2024 (XPHB) > SRD > PHB > others
    // const uniqueSpells = new Map<string, ProcessedSpell>();
    
    // for (const spell of processedSpells) {
    //   const key = spell.name.toLowerCase();
    //   const existingSpell = uniqueSpells.get(key);
      
    //   if (!existingSpell) {
    //     // No existing spell, add this one
    //     uniqueSpells.set(key, spell);
    //   } else {
    //     // Check if we should replace the existing spell
    //     const shouldReplace = 
    //       spell.source === 'PHB2024' || // Always prefer 2024 version
    //       (existingSpell.source !== 'PHB2024' && spell.isSrd) || // Prefer SRD if no 2024 version
    //       (existingSpell.source !== 'PHB2024' && !existingSpell.isSrd && spell.source === 'PHB'); // Prefer PHB over others if no 2024/SRD
        
    //     if (shouldReplace) {
    //       uniqueSpells.set(key, spell);
    //     }
    //   }
    // }
    
    cachedSpells = processedSpells;
    
    console.log(`Loaded ${cachedSpells.length} unique spells from ${rawSpells.length} total spell entries`);
    
    return cachedSpells;
  } catch (error) {
    console.error('Error loading spells:', error);
    return [];
  }
} 