module.exports = [
"[project]/apps/web/.next-internal/server/app/api/spells/route/actions.js [app-rsc] (server actions loader, ecmascript)", ((__turbopack_context__, module, exports) => {

}),
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/action-async-storage.external.js [external] (next/dist/server/app-render/action-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/action-async-storage.external.js", () => require("next/dist/server/app-render/action-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/fs [external] (fs, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("fs", () => require("fs"));

module.exports = mod;
}),
"[externals]/path [external] (path, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("path", () => require("path"));

module.exports = mod;
}),
"[project]/apps/web/src/types/spells.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Spell data types based on the JSON structure from 5e Tools
__turbopack_context__.s([
    "CLASS_SPELL_LISTS",
    ()=>CLASS_SPELL_LISTS,
    "SPELL_SCHOOLS",
    ()=>SPELL_SCHOOLS
]);
const SPELL_SCHOOLS = {
    A: 'Abjuration',
    C: 'Conjuration',
    D: 'Divination',
    E: 'Enchantment',
    I: 'Illusion',
    N: 'Necromancy',
    T: 'Transmutation',
    V: 'Evocation'
};
const CLASS_SPELL_LISTS = {
    artificer: [],
    bard: [],
    cleric: [],
    druid: [],
    paladin: [],
    ranger: [],
    sorcerer: [],
    warlock: [],
    wizard: [],
    'eldritch knight': [],
    'arcane trickster': []
};
}),
"[project]/apps/web/src/utils/sourceUtils.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Utilities for handling D&D source prioritization and display
 *
 * This handles the transition from D&D 5e (2014) to D&D 5e (2024) by:
 * - Prioritizing 2024 versions (XPHB) over 2014 versions (PHB)
 * - Converting XPHB source to "PHB2024" for display
 * - Providing consistent deduplication logic across content types
 */ /**
 * Convert raw source to display source
 * XPHB (2024 Player's Handbook) -> PHB2024 for user-friendly display
 */ __turbopack_context__.s([
    "compareSourcePriority",
    ()=>compareSourcePriority,
    "deduplicateBySourcePriority",
    ()=>deduplicateBySourcePriority,
    "formatSourceForDisplay",
    ()=>formatSourceForDisplay,
    "getSourceEdition",
    ()=>getSourceEdition,
    "is2014Source",
    ()=>is2014Source,
    "is2024Source",
    ()=>is2024Source,
    "shouldReplaceSource",
    ()=>shouldReplaceSource
]);
function formatSourceForDisplay(rawSource) {
    return rawSource === 'XPHB' ? 'PHB2024' : rawSource;
}
function shouldReplaceSource(existingSource, newSource, existingIsSrd = false, newIsSrd = false) {
    // Always prefer 2024 version
    if (newSource === 'PHB2024') return true;
    // Don't replace 2024 version with anything else
    if (existingSource === 'PHB2024') return false;
    // Prefer SRD if no 2024 version exists
    if (!existingIsSrd && newIsSrd) return true;
    // Don't replace SRD with non-SRD (unless it's 2024)
    if (existingIsSrd && !newIsSrd) return false;
    // Prefer PHB over other sources if no 2024/SRD exists
    if (existingSource !== 'PHB' && !existingIsSrd && newSource === 'PHB') return true;
    return false;
}
function deduplicateBySourcePriority(items, getKey = (item)=>item.name.toLowerCase()) {
    const uniqueItems = new Map();
    for (const item of items){
        const key = getKey(item);
        const existingItem = uniqueItems.get(key);
        if (!existingItem) {
            // No existing item, add this one
            uniqueItems.set(key, item);
        } else {
            // Check if we should replace the existing item
            const shouldReplace = shouldReplaceSource(existingItem.source, item.source, existingItem.isSrd || false, item.isSrd || false);
            if (shouldReplace) {
                uniqueItems.set(key, item);
            }
        }
    }
    return Array.from(uniqueItems.values());
}
function getSourceEdition(source) {
    switch(source){
        case 'PHB2024':
        case 'XPHB':
            return '2024';
        case 'PHB':
            return '2014';
        case 'SRD':
            return 'SRD';
        default:
            return 'Other';
    }
}
function is2024Source(source) {
    return source === 'XPHB' || source === 'PHB2024';
}
function is2014Source(source) {
    return source === 'PHB';
}
function compareSourcePriority(sourceA, sourceB) {
    // PHB2024 always comes first
    if (sourceA === 'PHB2024' && sourceB !== 'PHB2024') return -1;
    if (sourceB === 'PHB2024' && sourceA !== 'PHB2024') return 1;
    // If both or neither are PHB2024, check SRD
    if (sourceA === 'SRD' && sourceB !== 'SRD' && sourceB !== 'PHB2024') return -1;
    if (sourceB === 'SRD' && sourceA !== 'SRD' && sourceA !== 'PHB2024') return 1;
    // If both or neither are SRD/PHB2024, check PHB
    if (sourceA === 'PHB' && sourceB !== 'PHB' && sourceB !== 'SRD' && sourceB !== 'PHB2024') return -1;
    if (sourceB === 'PHB' && sourceA !== 'PHB' && sourceA !== 'SRD' && sourceA !== 'PHB2024') return 1;
    // Equal priority, sort alphabetically
    return sourceA.localeCompare(sourceB);
}
}),
"[project]/apps/web/src/utils/spellDataLoader.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "loadAllSpells",
    ()=>loadAllSpells
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$fs__$5b$external$5d$__$28$fs$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/fs [external] (fs, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$path__$5b$external$5d$__$28$path$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/path [external] (path, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$types$2f$spells$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/types/spells.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$sourceUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/utils/sourceUtils.ts [app-route] (ecmascript)");
;
;
;
;
// Cache for loaded spells to avoid reprocessing
let cachedSpells = null;
/**
 * Load all spell JSON files from the json/spells directory
 */ async function loadSpellFiles() {
    const spellsDir = __TURBOPACK__imported__module__$5b$externals$5d2f$path__$5b$external$5d$__$28$path$2c$__cjs$29$__["default"].join(process.cwd(), 'json', 'spells');
    const files = await __TURBOPACK__imported__module__$5b$externals$5d2f$fs__$5b$external$5d$__$28$fs$2c$__cjs$29$__["promises"].readdir(spellsDir);
    const spellFiles = files.filter((file)=>file.endsWith('.json'));
    const allSpells = [];
    for (const file of spellFiles){
        try {
            const filePath = __TURBOPACK__imported__module__$5b$externals$5d2f$path__$5b$external$5d$__$28$path$2c$__cjs$29$__["default"].join(spellsDir, file);
            const fileContent = await __TURBOPACK__imported__module__$5b$externals$5d2f$fs__$5b$external$5d$__$28$fs$2c$__cjs$29$__["promises"].readFile(filePath, 'utf-8');
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
 */ function generateSpellId(name, source) {
    return `${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${source.toLowerCase()}`;
}
/**
 * Convert casting time data to human-readable string
 */ function formatCastingTime(time) {
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
 */ function formatRange(range) {
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
 */ function formatDuration(duration) {
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
 */ function hasConcentration(duration) {
    return duration.some((d)=>d.concentration === true);
}
/**
 * Get the classes that can cast a specific spell
 * This includes the 11 main spellcasting classes and their spell access
 */ function getSpellClasses(spellName) {
    const name = spellName.toLowerCase();
    const classes = [];
    // ARTIFICER SPELLS (Tasha's Cauldron of Everything)
    const artificerSpells = [
        // Cantrips
        'guidance',
        'mage hand',
        'mending',
        'message',
        'prestidigitation',
        'spare the dying',
        // 1st Level
        'alarm',
        'cure wounds',
        'detect magic',
        'detect poison and disease',
        'disguise self',
        'expeditious retreat',
        'false life',
        'feather fall',
        'identify',
        'jump',
        'longstrider',
        'purify food and drink',
        'sanctuary',
        'shield of faith',
        // 2nd Level
        'aid',
        'arcane lock',
        'blur',
        'continual flame',
        'darkvision',
        'enhance ability',
        'enlarge/reduce',
        'heat metal',
        'invisibility',
        'lesser restoration',
        'levitate',
        'magic missile',
        'magic weapon',
        'protection from poison',
        'resist elements',
        'see invisibility',
        'spider climb',
        'web',
        // 3rd Level
        'blink',
        'catnap',
        'create food and water',
        'dispel magic',
        'elemental weapon',
        'flame arrows',
        'fly',
        'gaseous form',
        'glyph of warding',
        'haste',
        'protection from energy',
        'revivify',
        'tiny hut',
        'water breathing',
        'water walk',
        // 4th Level
        'arcane eye',
        'death ward',
        'fabricate',
        'freedom of movement',
        'greater invisibility',
        "otiluke's resilient sphere",
        "mordenkainen's faithful hound",
        'stone shape',
        'stoneskin',
        // 5th Level
        'animate objects',
        'creation',
        'greater restoration',
        'wall of stone'
    ];
    // BARD SPELLS
    const bardSpells = [
        // Cantrips
        'blade ward',
        'dancing lights',
        'friends',
        'light',
        'mage hand',
        'mending',
        'message',
        'minor illusion',
        'prestidigitation',
        'thunderclap',
        'true strike',
        'vicious mockery',
        // 1st Level
        'animal friendship',
        'bane',
        'charm person',
        'comprehend languages',
        'cure wounds',
        'detect magic',
        'disguise self',
        'dissonant whispers',
        'earth tremor',
        'faerie fire',
        'feather fall',
        'healing word',
        'heroism',
        'identify',
        'illusory script',
        'longstrider',
        'silent image',
        'sleep',
        'speak with animals',
        "tasha's hideous laughter",
        'thunderwave',
        'unseen servant',
        // 2nd Level
        'animal messenger',
        'blindness/deafness',
        'calm emotions',
        'cloud of daggers',
        'crown of madness',
        'detect thoughts',
        'enhance ability',
        'enthrall',
        'heat metal',
        'hold person',
        'invisibility',
        'knock',
        'lesser restoration',
        'locate animals or plants',
        'locate object',
        'magic mouth',
        'see invisibility',
        'shatter',
        'silence',
        'suggestion',
        'zone of truth',
        // 3rd Level
        'bestow curse',
        'catnap',
        'clairvoyance',
        'counterspell',
        'dispel magic',
        'fear',
        'feign death',
        'glyph of warding',
        'hypnotic pattern',
        "leomund's tiny hut",
        'major image',
        'nondetection',
        'plant growth',
        'sending',
        'speak with dead',
        'speak with plants',
        'stinking cloud',
        'tongues',
        // 4th Level
        'charm monster',
        'compulsion',
        'confusion',
        'dimension door',
        'freedom of movement',
        'greater invisibility',
        'hallucinatory terrain',
        'locate creature',
        'polymorph',
        // 5th Level
        'animate objects',
        'awaken',
        'dominate person',
        'dream',
        'geas',
        'greater restoration',
        'hold monster',
        'legend lore',
        'mass cure wounds',
        'mislead',
        'modify memory',
        'planar binding',
        'raise dead',
        'scrying',
        'seeming',
        'teleportation circle',
        // 6th Level
        'eyebite',
        'find the path',
        'guards and wards',
        'mass suggestion',
        "otto's irresistible dance",
        'programmed illusion',
        'true seeing',
        // 7th Level
        'etherealness',
        'forcecage',
        'mirage arcane',
        "mordenkainen's magnificent mansion",
        'plane shift',
        'project image',
        'regenerate',
        'resurrection',
        'reverse gravity',
        'teleport',
        // 8th Level
        'dominate monster',
        'feeblemind',
        'glibness',
        'mind blank',
        'power word stun',
        // 9th Level
        'foresight',
        'power word kill',
        'true polymorph'
    ];
    // CLERIC SPELLS
    const clericSpells = [
        // Cantrips
        'guidance',
        'light',
        'mending',
        'resistance',
        'sacred flame',
        'spare the dying',
        'thaumaturgy',
        'toll the dead',
        'word of radiance',
        // 1st Level
        'bane',
        'bless',
        'command',
        'create or destroy water',
        'cure wounds',
        'detect evil and good',
        'detect magic',
        'detect poison and disease',
        'guiding bolt',
        'healing word',
        'inflict wounds',
        'protection from evil and good',
        'purify food and drink',
        'sanctuary',
        'shield of faith',
        // 2nd Level
        'aid',
        'augury',
        'blindness/deafness',
        'calm emotions',
        'continual flame',
        'enhance ability',
        'find traps',
        'gentle repose',
        'hold person',
        'lesser restoration',
        'locate object',
        'prayer of healing',
        'protection from poison',
        'silence',
        'spiritual weapon',
        'warding bond',
        'zone of truth',
        // 3rd Level
        'animate dead',
        'beacon of hope',
        'bestow curse',
        'clairvoyance',
        'create food and water',
        'daylight',
        'dispel magic',
        'feign death',
        'fireball',
        'glyph of warding',
        'magic circle',
        'mass healing word',
        'meld into stone',
        'protection from energy',
        'remove curse',
        'revivify',
        'sending',
        'speak with dead',
        'spirit guardians',
        'tongues',
        'water walk',
        // 4th Level
        'banishment',
        'control water',
        'death ward',
        'divination',
        'freedom of movement',
        'guardian of faith',
        'locate creature',
        'stone shape',
        // 5th Level
        'commune',
        'contagion',
        'dispel evil and good',
        'flame strike',
        'geas',
        'greater restoration',
        'hallow',
        'heal',
        'insect plague',
        'legend lore',
        'mass cure wounds',
        'planar binding',
        'raise dead',
        'scrying',
        // 6th Level
        'find the path',
        'forbiddance',
        'harm',
        'heal',
        'planar ally',
        'true seeing',
        'word of recall',
        // 7th Level
        'divine word',
        'etherealness',
        'fire storm',
        'plane shift',
        'regenerate',
        'resurrection',
        // 8th Level
        'antimagic field',
        'control weather',
        'earthquake',
        'holy aura',
        // 9th Level
        'astral projection',
        'gate',
        'mass heal',
        'true resurrection'
    ];
    // DRUID SPELLS
    const druidSpells = [
        // Cantrips
        'control flames',
        'create bonfire',
        'druidcraft',
        'frostbite',
        'guidance',
        'gust',
        'infestation',
        'magic stone',
        'mending',
        'mold earth',
        'poison spray',
        'produce flame',
        'resistance',
        'shape water',
        'shillelagh',
        'thorn whip',
        'thunderclap',
        // 1st Level
        'absorb elements',
        'animal friendship',
        'beast bond',
        'charm person',
        'create or destroy water',
        'cure wounds',
        'detect magic',
        'detect poison and disease',
        'earth tremor',
        'entangle',
        'faerie fire',
        'fog cloud',
        'goodberry',
        'healing word',
        'ice knife',
        'jump',
        'longstrider',
        'purify food and drink',
        'speak with animals',
        'thunderwave',
        // 2nd Level
        'animal messenger',
        'barkskin',
        'beast sense',
        'darkvision',
        'dust devil',
        'earthbind',
        'enhance ability',
        'find traps',
        'flame blade',
        'flaming sphere',
        'gust of wind',
        'heat metal',
        'hold person',
        'lesser restoration',
        'locate animals or plants',
        'locate object',
        'moonbeam',
        'pass without trace',
        'protection from poison',
        'skywrite',
        'spike growth',
        'warding bond',
        // 3rd Level
        'call lightning',
        'conjure animals',
        'daylight',
        'dispel magic',
        'erupting earth',
        'feign death',
        'fireball',
        'meld into stone',
        'plant growth',
        'protection from energy',
        'sleet storm',
        'speak with plants',
        'tidal wave',
        'wall of water',
        'water breathing',
        'water walk',
        'wind wall',
        // 4th Level
        'blight',
        'confusion',
        'conjure minor elementals',
        'conjure woodland beings',
        'control water',
        'dominate beast',
        'elemental bane',
        'freedom of movement',
        'giant insect',
        'grasping vine',
        'hallucinatory terrain',
        'ice storm',
        'locate creature',
        'polymorph',
        'stone shape',
        'stoneskin',
        'wall of fire',
        // 5th Level
        'antilife shell',
        'awaken',
        'commune with nature',
        'conjure elemental',
        'contagion',
        'control winds',
        'geas',
        'greater restoration',
        'heal',
        'insect plague',
        'legend lore',
        'mass cure wounds',
        'planar binding',
        'reincarnate',
        'scrying',
        'transmute rock',
        'tree stride',
        'wall of stone',
        // 6th Level
        'bones of the earth',
        'conjure fey',
        'find the path',
        'heal',
        "heroes' feast",
        'move earth',
        'primordial ward',
        'sunbeam',
        'transport via plants',
        'wall of thorns',
        'wind walk',
        // 7th Level
        'fire storm',
        'mirage arcane',
        'plane shift',
        'regenerate',
        'reverse gravity',
        // 8th Level
        'animal shapes',
        'antipathy/sympathy',
        'control weather',
        'earthquake',
        'feeblemind',
        'sunburst',
        'tsunami',
        // 9th Level
        'foresight',
        'shapechange',
        'storm of vengeance',
        'true resurrection'
    ];
    // PALADIN SPELLS (2nd level and higher)
    const paladinSpells = [
        // 1st Level
        'bless',
        'command',
        'compelled duel',
        'cure wounds',
        'detect evil and good',
        'detect magic',
        'detect poison and disease',
        'divine favor',
        'heroism',
        'protection from evil and good',
        'purify food and drink',
        'sanctuary',
        'searing smite',
        'shield of faith',
        'thunderous smite',
        'wrathful smite',
        // 2nd Level
        'aid',
        'branding smite',
        'find steed',
        'lesser restoration',
        'locate object',
        'magic weapon',
        'protection from poison',
        'zone of truth',
        // 3rd Level
        'aura of vitality',
        'blinding smite',
        'create food and water',
        "crusader's mantle",
        'daylight',
        'dispel magic',
        'elemental weapon',
        'magic circle',
        'remove curse',
        'revivify',
        // 4th Level
        'aura of life',
        'aura of purity',
        'banishment',
        'death ward',
        'freedom of movement',
        'locate creature',
        'staggering smite',
        // 5th Level
        'banishing smite',
        'circle of power',
        'destructive wave',
        'dispel evil and good',
        'geas',
        'greater restoration',
        'raise dead'
    ];
    // RANGER SPELLS (2nd level and higher)
    const rangerSpells = [
        // 1st Level
        'absorb elements',
        'alarm',
        'animal friendship',
        'beast bond',
        'cure wounds',
        'detect magic',
        'detect poison and disease',
        'ensnaring strike',
        'entangle',
        'fog cloud',
        'goodberry',
        'hail of thorns',
        "hunter's mark",
        'jump',
        'longstrider',
        'speak with animals',
        // 2nd Level
        'animal messenger',
        'barkskin',
        'beast sense',
        'cordon of arrows',
        'darkvision',
        'find traps',
        'lesser restoration',
        'locate animals or plants',
        'locate object',
        'pass without trace',
        'protection from poison',
        'silence',
        'spike growth',
        // 3rd Level
        'conjure animals',
        'conjure barrage',
        'daylight',
        'lightning arrow',
        'nondetection',
        'plant growth',
        'protection from energy',
        'speak with plants',
        'water breathing',
        'water walk',
        'wind wall',
        // 4th Level
        'conjure woodland beings',
        'freedom of movement',
        'grasping vine',
        'guardian of nature',
        'locate creature',
        'stoneskin',
        // 5th Level
        'commune with nature',
        'conjure volley',
        'greater restoration',
        'steel wind strike',
        'swift quiver',
        'tree stride'
    ];
    // SORCERER SPELLS
    const sorcererSpells = [
        // Cantrips
        'acid splash',
        'blade ward',
        'chill touch',
        'control flames',
        'create bonfire',
        'dancing lights',
        'fire bolt',
        'frostbite',
        'gust',
        'infestation',
        'light',
        'mage hand',
        'mending',
        'message',
        'minor illusion',
        'mold earth',
        'poison spray',
        'prestidigitation',
        'ray of frost',
        'shape water',
        'shocking grasp',
        'thunderclap',
        'true strike',
        // 1st Level
        'absorb elements',
        'burning hands',
        'charm person',
        'chromatic orb',
        'color spray',
        'comprehend languages',
        'detect magic',
        'disguise self',
        'earth tremor',
        'expeditious retreat',
        'false life',
        'feather fall',
        'fog cloud',
        'ice knife',
        'jump',
        'mage armor',
        'magic missile',
        'ray of sickness',
        'shield',
        'silent image',
        'sleep',
        'thunderwave',
        'witch bolt',
        // 2nd Level
        'alter self',
        'blindness/deafness',
        'blur',
        'cloud of daggers',
        'crown of madness',
        'darkness',
        'darkvision',
        'detect thoughts',
        'enhance ability',
        'enlarge/reduce',
        'gust of wind',
        'hold person',
        'invisibility',
        'knock',
        'levitate',
        'magic weapon',
        'mirror image',
        'misty step',
        'scorching ray',
        'see invisibility',
        'shatter',
        'spider climb',
        'suggestion',
        'web',
        // 3rd Level
        'blink',
        'clairvoyance',
        'counterspell',
        'daylight',
        'dispel magic',
        'erupting earth',
        'fear',
        'fireball',
        'fly',
        'gaseous form',
        'haste',
        'hypnotic pattern',
        'lightning bolt',
        'major image',
        'protection from energy',
        'sleet storm',
        'slow',
        'stinking cloud',
        'tongues',
        'tidal wave',
        'vampiric touch',
        'wall of water',
        'water breathing',
        'water walk',
        // 4th Level
        'banishment',
        'blight',
        'confusion',
        'dimension door',
        'dominate beast',
        'greater invisibility',
        'ice storm',
        'polymorph',
        'stoneskin',
        'wall of fire',
        // 5th Level
        'animate objects',
        'cloudkill',
        'cone of cold',
        'creation',
        'dominate person',
        'hold monster',
        'insect plague',
        'seeming',
        'telekinesis',
        'teleportation circle',
        'wall of stone',
        // 6th Level
        'arcane gate',
        'chain lightning',
        'circle of death',
        'disintegrate',
        'eyebite',
        'flesh to stone',
        'globe of invulnerability',
        'mass suggestion',
        'move earth',
        'sunbeam',
        'true seeing',
        // 7th Level
        'delayed blast fireball',
        'etherealness',
        'finger of death',
        'fire storm',
        'plane shift',
        'prismatic spray',
        'reverse gravity',
        'teleport',
        // 8th Level
        'dominate monster',
        'earthquake',
        'incendiary cloud',
        'power word stun',
        'sunburst',
        // 9th Level
        'gate',
        'meteor swarm',
        'power word kill',
        'time stop',
        'wish'
    ];
    // WARLOCK SPELLS
    const warlockSpells = [
        // Cantrips
        'blade ward',
        'chill touch',
        'create bonfire',
        'eldritch blast',
        'friends',
        'frostbite',
        'infestation',
        'mage hand',
        'magic stone',
        'minor illusion',
        'poison spray',
        'prestidigitation',
        'toll the dead',
        'true strike',
        // 1st Level
        'armor of agathys',
        'arms of hadar',
        'charm person',
        'comprehend languages',
        'expeditious retreat',
        'hellish rebuke',
        'hex',
        'illusory script',
        'protection from evil and good',
        'unseen servant',
        'witch bolt',
        // 2nd Level
        'blindness/deafness',
        'cloud of daggers',
        'crown of madness',
        'darkness',
        'enthrall',
        'hold person',
        'invisibility',
        'mirror image',
        'misty step',
        'ray of enfeeblement',
        'shatter',
        'spider climb',
        'suggestion',
        // 3rd Level
        'counterspell',
        'dispel magic',
        'fear',
        'fireball',
        'fly',
        'gaseous form',
        'hunger of hadar',
        'hypnotic pattern',
        'magic circle',
        'major image',
        'remove curse',
        'spirit guardians',
        'tongues',
        'vampiric touch',
        // 4th Level
        'banishment',
        'blight',
        'charm monster',
        'confusion',
        'dimension door',
        'hallucinatory terrain',
        'polymorph',
        // 5th Level
        'contact other plane',
        'dream',
        'hold monster',
        'modify memory',
        'planar binding',
        'scrying',
        'synaptic static',
        'teleportation circle',
        // 6th Level
        'arcane gate',
        'circle of death',
        'conjure fey',
        'create undead',
        'flesh to stone',
        'mass suggestion',
        'true seeing',
        // 7th Level
        'etherealness',
        'finger of death',
        'forcecage',
        'plane shift',
        // 8th Level
        'demiplane',
        'dominate monster',
        'feeblemind',
        'glibness',
        'power word stun',
        // 9th Level
        'astral projection',
        'foresight',
        'imprisonment',
        'power word kill',
        'true polymorph'
    ];
    // WIZARD SPELLS
    const wizardSpells = [
        // Cantrips
        'acid splash',
        'blade ward',
        'chill touch',
        'control flames',
        'create bonfire',
        'dancing lights',
        'encode thoughts',
        'fire bolt',
        'friends',
        'frostbite',
        'green-flame blade',
        'gust',
        'infestation',
        'light',
        'lightning lure',
        'mage hand',
        'mending',
        'message',
        'minor illusion',
        'mold earth',
        'poison spray',
        'prestidigitation',
        'ray of frost',
        'shape water',
        'shocking grasp',
        'sword burst',
        'thunderclap',
        'toll the dead',
        'true strike',
        // 1st Level
        'absorb elements',
        'alarm',
        'burning hands',
        'catapult',
        'cause fear',
        'charm person',
        'chromatic orb',
        'color spray',
        'comprehend languages',
        'detect magic',
        'disguise self',
        'earth tremor',
        'expeditious retreat',
        'false life',
        'feather fall',
        'find familiar',
        'fog cloud',
        'grease',
        'ice knife',
        'identify',
        'illusory script',
        'jump',
        'longstrider',
        'mage armor',
        'magic missile',
        'protection from evil and good',
        'ray of sickness',
        'shield',
        'silent image',
        'silvery barbs',
        'sleep',
        "tasha's hideous laughter",
        "tenser's floating disk",
        'thunderwave',
        'unseen servant',
        'witch bolt',
        // 2nd Level
        "aganazzar's scorcher",
        'alter self',
        'arcane lock',
        'blindness/deafness',
        'blur',
        'cloud of daggers',
        'continual flame',
        'crown of madness',
        'darkness',
        'darkvision',
        'detect thoughts',
        'enlarge/reduce',
        'flaming sphere',
        'gentle repose',
        'gust of wind',
        'hold person',
        'invisibility',
        'knock',
        'levitate',
        'locate object',
        'magic mouth',
        'magic weapon',
        "melf's acid arrow",
        'mirror image',
        'misty step',
        'rope trick',
        'scorching ray',
        'see invisibility',
        'shatter',
        'spider climb',
        'suggestion',
        'web',
        // 3rd Level
        'animate dead',
        'bestow curse',
        'blink',
        'catnap',
        'clairvoyance',
        'counterspell',
        'dispel magic',
        'erupting earth',
        'fear',
        'feign death',
        'fireball',
        'fly',
        'gaseous form',
        'glyph of warding',
        'haste',
        'hypnotic pattern',
        "leomund's tiny hut",
        'lightning bolt',
        'magic circle',
        'major image',
        'nondetection',
        'phantom steed',
        'protection from energy',
        'remove curse',
        'sending',
        'sleet storm',
        'slow',
        'stinking cloud',
        'tongues',
        'vampiric touch',
        'wall of water',
        'water breathing',
        // 4th Level
        'arcane eye',
        'banishment',
        'blight',
        'charm monster',
        'confusion',
        'conjure minor elementals',
        'control water',
        'dimension door',
        "evard's black tentacles",
        'fabricate',
        'fire shield',
        'greater invisibility',
        'hallucinatory terrain',
        'ice storm',
        'locate creature',
        "otiluke's resilient sphere",
        'phantasmal killer',
        'polymorph',
        'private sanctum',
        'stone shape',
        'stoneskin',
        'wall of fire',
        // 5th Level
        'animate objects',
        "bigby's hand",
        'cloudkill',
        'cone of cold',
        'conjure elemental',
        'contact other plane',
        'creation',
        'dominate person',
        'dream',
        'geas',
        'hold monster',
        'legend lore',
        'mislead',
        'modify memory',
        'passwall',
        'planar binding',
        'scrying',
        'seeming',
        'synaptic static',
        'telekinesis',
        'telepathic bond',
        'teleportation circle',
        'transmute rock',
        'wall of force',
        'wall of stone',
        // 6th Level
        'arcane gate',
        'chain lightning',
        'circle of death',
        'contingency',
        'create undead',
        'disintegrate',
        'eyebite',
        'flesh to stone',
        'globe of invulnerability',
        'guards and wards',
        'magic jar',
        'mass suggestion',
        'move earth',
        "otho's irresistible dance",
        'programmed illusion',
        'sunbeam',
        'true seeing',
        'wall of ice',
        // 7th Level
        'delayed blast fireball',
        'etherealness',
        'finger of death',
        'forcecage',
        'mirage arcane',
        "mordenkainen's magnificent mansion",
        'plane shift',
        'prismatic spray',
        'project image',
        'reverse gravity',
        'sequester',
        'simulacrum',
        'symbol',
        'teleport',
        // 8th Level
        'antimagic field',
        'antipathy/sympathy',
        'clone',
        'control weather',
        'demiplane',
        'dominate monster',
        'feeblemind',
        'incendiary cloud',
        'maze',
        'mind blank',
        'power word stun',
        'sunburst',
        // 9th Level
        'astral projection',
        'foresight',
        'gate',
        'imprisonment',
        'meteor swarm',
        'power word kill',
        'prismatic wall',
        'shapechange',
        'time stop',
        'true polymorph',
        'wish'
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
        'acid splash',
        'blade ward',
        'booming blade',
        'chill touch',
        'control flames',
        'create bonfire',
        'dancing lights',
        'fire bolt',
        'friends',
        'frostbite',
        'green-flame blade',
        'gust',
        'light',
        'lightning lure',
        'mage hand',
        'mending',
        'message',
        'minor illusion',
        'poison spray',
        'prestidigitation',
        'ray of frost',
        'shocking grasp',
        'sword burst',
        'thunderclap',
        'true strike',
        // 1st Level (abjuration/evocation + exceptions)
        'absorb elements',
        'alarm',
        'burning hands',
        'chromatic orb',
        'expeditious retreat',
        'false life',
        'find familiar',
        'fog cloud',
        'jump',
        'longstrider',
        'mage armor',
        'magic missile',
        'protection from evil and good',
        'shield',
        'thunderwave',
        // 2nd Level (abjuration/evocation + exceptions)
        "aganazzar's scorcher",
        'arcane lock',
        'blur',
        'continual flame',
        'darkness',
        'darkvision',
        'enlarge/reduce',
        'flaming sphere',
        'gust of wind',
        'invisibility',
        'levitate',
        'magic weapon',
        'misty step',
        'scorching ray',
        'see invisibility',
        'shatter',
        'spider climb',
        'web',
        // 3rd Level (abjuration/evocation + exceptions)
        'counterspell',
        'daylight',
        'dispel magic',
        'fear',
        'fireball',
        'fly',
        'gaseous form',
        'haste',
        'lightning bolt',
        'magic circle',
        'nondetection',
        'protection from energy',
        'sleet storm',
        'slow',
        'stinking cloud',
        'tongues',
        'vampiric touch',
        'wall of water',
        'water breathing',
        // 4th Level (abjuration/evocation + exceptions)
        'arcane eye',
        'banishment',
        'confusion',
        'dimension door',
        "evard's black tentacles",
        'fire shield',
        'greater invisibility',
        'ice storm',
        'locate creature',
        "otiluke's resilient sphere",
        'stoneskin',
        'wall of fire'
    ];
    // ARCANE TRICKSTER SPELLS (Rogue subclass)
    // Limited wizard spells - primarily illusion and enchantment, plus some exceptions
    const arcaneTricksterSpells = [
        // Cantrips (any wizard cantrip)
        'acid splash',
        'blade ward',
        'booming blade',
        'chill touch',
        'control flames',
        'create bonfire',
        'dancing lights',
        'encode thoughts',
        'fire bolt',
        'friends',
        'frostbite',
        'green-flame blade',
        'gust',
        'infestation',
        'light',
        'lightning lure',
        'mage hand',
        'mending',
        'message',
        'minor illusion',
        'mold earth',
        'poison spray',
        'prestidigitation',
        'ray of frost',
        'shape water',
        'shocking grasp',
        'sword burst',
        'thunderclap',
        'toll the dead',
        'true strike',
        // 1st Level (illusion/enchantment + exceptions)
        'charm person',
        'color spray',
        'comprehend languages',
        'detect magic',
        'disguise self',
        'expeditious retreat',
        'false life',
        'feather fall',
        'find familiar',
        'fog cloud',
        'illusory script',
        'jump',
        'longstrider',
        'silent image',
        'silvery barbs',
        'sleep',
        "tasha's hideous laughter",
        'unseen servant',
        // 2nd Level (illusion/enchantment + exceptions)
        'blindness/deafness',
        'blur',
        'cloud of daggers',
        'crown of madness',
        'darkness',
        'detect thoughts',
        'hold person',
        'invisibility',
        'knock',
        'levitate',
        'magic mouth',
        'mirror image',
        'misty step',
        'rope trick',
        'see invisibility',
        'spider climb',
        'suggestion',
        'web',
        // 3rd Level (illusion/enchantment + exceptions)
        'catnap',
        'clairvoyance',
        'counterspell',
        'fear',
        'fly',
        'gaseous form',
        'hypnotic pattern',
        'major image',
        'nondetection',
        'sending',
        'slow',
        'tongues',
        // 4th Level (illusion/enchantment + exceptions)
        'charm monster',
        'confusion',
        'dimension door',
        'greater invisibility',
        'hallucinatory terrain',
        'locate creature',
        'phantasmal killer',
        'polymorph'
    ];
    // Check subclass spell lists
    if (eldritchKnightSpells.includes(name)) classes.push('eldritch knight');
    if (arcaneTricksterSpells.includes(name)) classes.push('arcane trickster');
    return classes;
}
/**
 * Parse spell entries that can contain both strings and complex objects
 */ function parseSpellEntries(entries) {
    return entries.map((entry)=>{
        if (typeof entry === 'string') {
            return entry;
        }
        // Handle object entries
        if (entry.type === 'list' && entry.items) {
            // Handle list items - they can be either objects or strings
            return entry.items.map((item)=>{
                // Handle string items in a list
                if (typeof item === 'string') {
                    return item;
                }
                // Handle object items with type 'item'
                if (item.type === 'item' && item.name && item.entries) {
                    return `**${item.name}.** ${item.entries.join(' ')}`;
                }
                return '';
            }).filter(Boolean).join('\n\n');
        }
        if (entry.type === 'entries' && entry.entries) {
            // Handle nested entries - recursively parse them
            let result = '';
            if (entry.name) {
                result += `**${entry.name}**\n\n`;
            }
            // Recursively parse the nested entries instead of just joining
            result += parseSpellEntries(entry.entries);
            return result;
        }
        // Handle table entries
        if (entry.type === 'table') {
            let tableResult = '';
            if (entry.caption) {
                tableResult += `**${entry.caption}**\n\n`;
            }
            // For tables, we'll provide a simple text representation
            // The actual table rendering would need to be done in the UI
            tableResult += '_(See table in source material)_';
            return tableResult;
        }
        // For any other object types, try to extract meaningful text
        if (entry.entries) {
            // Recursively parse nested entries
            return parseSpellEntries(entry.entries);
        }
        // Fallback for unknown object types
        return '';
    }).filter(Boolean).join('\n\n');
}
/**
 * Process raw spell data into our application format
 */ function processSpell(rawSpell) {
    const id = generateSpellId(rawSpell.name, rawSpell.source);
    // Process description using the new parser
    const description = parseSpellEntries(rawSpell.entries);
    // Process higher level description
    let higherLevelDescription;
    if (rawSpell.entriesHigherLevel && rawSpell.entriesHigherLevel.length > 0) {
        higherLevelDescription = rawSpell.entriesHigherLevel.map((entry)=>entry.entries.join('\n')).join('\n\n');
    }
    // Process components
    const components = {
        verbal: rawSpell.components.v || false,
        somatic: rawSpell.components.s || false,
        material: !!rawSpell.components.m,
        materialComponent: typeof rawSpell.components.m === 'string' ? rawSpell.components.m : undefined
    };
    return {
        id,
        name: rawSpell.name,
        level: rawSpell.level,
        school: rawSpell.school,
        schoolName: __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$types$2f$spells$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["SPELL_SCHOOLS"][rawSpell.school] || 'Unknown',
        source: (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$sourceUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["formatSourceForDisplay"])(rawSpell.source),
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
            ...rawSpell.miscTags || [],
            ...rawSpell.areaTags || [],
            ...rawSpell.damageInflict || [],
            rawSpell.school,
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$sourceUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["formatSourceForDisplay"])(rawSpell.source)
        ],
        damage: rawSpell.damageInflict,
        saves: rawSpell.savingThrow,
        isCantrip: rawSpell.level === 0,
        isSrd: rawSpell.srd || false
    };
}
async function loadAllSpells() {
    // Return cached spells if available
    if (cachedSpells) {
        return cachedSpells;
    }
    try {
        const rawSpells = await loadSpellFiles();
        const processedSpells = rawSpells.map(processSpell);
        cachedSpells = processedSpells;
        console.log(`Loaded ${cachedSpells.length} processed spells from ${rawSpells.length} total spell entries`);
        return cachedSpells;
    } catch (error) {
        console.error('Error loading spells:', error);
        return [];
    }
}
}),
"[project]/apps/web/src/app/api/spells/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>GET
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$spellDataLoader$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/utils/spellDataLoader.ts [app-route] (ecmascript)");
;
;
async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = searchParams.get('limit');
        const offset = searchParams.get('offset');
        // Load all spell data
        const spells = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$spellDataLoader$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["loadAllSpells"])();
        // Apply pagination if requested
        if (limit && offset) {
            const limitNum = parseInt(limit, 10);
            const offsetNum = parseInt(offset, 10);
            const paginatedSpells = spells.slice(offsetNum, offsetNum + limitNum);
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                spells: paginatedSpells,
                total: spells.length,
                hasMore: offsetNum + limitNum < spells.length
            });
        }
        // Return all spells
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            spells,
            total: spells.length,
            hasMore: false
        });
    } catch (error) {
        console.error('Error loading spells:', error);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: 'Failed to load spell data'
        }, {
            status: 500
        });
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__4f058edc._.js.map