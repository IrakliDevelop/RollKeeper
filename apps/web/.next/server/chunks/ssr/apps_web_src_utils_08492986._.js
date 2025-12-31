module.exports = [
"[project]/apps/web/src/utils/constants.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ABILITY_ABBREVIATIONS",
    ()=>ABILITY_ABBREVIATIONS,
    "ABILITY_NAMES",
    ()=>ABILITY_NAMES,
    "ALIGNMENTS",
    ()=>ALIGNMENTS,
    "APP_VERSION",
    ()=>APP_VERSION,
    "AUTOSAVE_DELAY",
    ()=>AUTOSAVE_DELAY,
    "BACKGROUNDS",
    ()=>BACKGROUNDS,
    "CLASS_HIT_DICE",
    ()=>CLASS_HIT_DICE,
    "COMMON_CLASSES",
    ()=>COMMON_CLASSES,
    "COMMON_RACES",
    ()=>COMMON_RACES,
    "DEFAULT_CHARACTER_STATE",
    ()=>DEFAULT_CHARACTER_STATE,
    "FALLBACK_RACE_OPTIONS",
    ()=>FALLBACK_RACE_OPTIONS,
    "FULL_CASTER_SPELL_SLOTS",
    ()=>FULL_CASTER_SPELL_SLOTS,
    "HALF_CASTER_SPELL_SLOTS",
    ()=>HALF_CASTER_SPELL_SLOTS,
    "MAX_AVATAR_SIZE_BYTES",
    ()=>MAX_AVATAR_SIZE_BYTES,
    "MAX_AVATAR_SIZE_MB",
    ()=>MAX_AVATAR_SIZE_MB,
    "PROFICIENCY_BONUS_BY_LEVEL",
    ()=>PROFICIENCY_BONUS_BY_LEVEL,
    "SKILL_ABILITY_MAP",
    ()=>SKILL_ABILITY_MAP,
    "SKILL_NAMES",
    ()=>SKILL_NAMES,
    "SPELL_SOURCE_BOOKS",
    ()=>SPELL_SOURCE_BOOKS,
    "SPELL_SOURCE_COLORS",
    ()=>SPELL_SOURCE_COLORS,
    "STORAGE_KEY",
    ()=>STORAGE_KEY,
    "THIRD_CASTER_SPELL_SLOTS",
    ()=>THIRD_CASTER_SPELL_SLOTS,
    "WARLOCK_PACT_SLOTS",
    ()=>WARLOCK_PACT_SLOTS,
    "XP_THRESHOLDS",
    ()=>XP_THRESHOLDS
]);
const SKILL_ABILITY_MAP = {
    acrobatics: 'dexterity',
    animalHandling: 'wisdom',
    arcana: 'intelligence',
    athletics: 'strength',
    deception: 'charisma',
    history: 'intelligence',
    insight: 'wisdom',
    intimidation: 'charisma',
    investigation: 'intelligence',
    medicine: 'wisdom',
    nature: 'intelligence',
    perception: 'wisdom',
    performance: 'charisma',
    persuasion: 'charisma',
    religion: 'intelligence',
    sleightOfHand: 'dexterity',
    stealth: 'dexterity',
    survival: 'wisdom'
};
const SKILL_NAMES = {
    acrobatics: 'Acrobatics',
    animalHandling: 'Animal Handling',
    arcana: 'Arcana',
    athletics: 'Athletics',
    deception: 'Deception',
    history: 'History',
    insight: 'Insight',
    intimidation: 'Intimidation',
    investigation: 'Investigation',
    medicine: 'Medicine',
    nature: 'Nature',
    perception: 'Perception',
    performance: 'Performance',
    persuasion: 'Persuasion',
    religion: 'Religion',
    sleightOfHand: 'Sleight of Hand',
    stealth: 'Stealth',
    survival: 'Survival'
};
const ABILITY_NAMES = {
    strength: 'Strength',
    dexterity: 'Dexterity',
    constitution: 'Constitution',
    intelligence: 'Intelligence',
    wisdom: 'Wisdom',
    charisma: 'Charisma'
};
const ABILITY_ABBREVIATIONS = {
    strength: 'STR',
    dexterity: 'DEX',
    constitution: 'CON',
    intelligence: 'INT',
    wisdom: 'WIS',
    charisma: 'CHA'
};
const PROFICIENCY_BONUS_BY_LEVEL = {
    1: 2,
    2: 2,
    3: 2,
    4: 2,
    5: 3,
    6: 3,
    7: 3,
    8: 3,
    9: 4,
    10: 4,
    11: 4,
    12: 4,
    13: 5,
    14: 5,
    15: 5,
    16: 5,
    17: 6,
    18: 6,
    19: 6,
    20: 6
};
const XP_THRESHOLDS = {
    1: 0,
    2: 300,
    3: 900,
    4: 2700,
    5: 6500,
    6: 14000,
    7: 23000,
    8: 34000,
    9: 48000,
    10: 64000,
    11: 85000,
    12: 100000,
    13: 120000,
    14: 140000,
    15: 165000,
    16: 195000,
    17: 225000,
    18: 265000,
    19: 305000,
    20: 355000
};
const COMMON_RACES = [
    'Human',
    'Elf',
    'Dwarf',
    'Halfling',
    'Dragonborn',
    'Gnome',
    'Half-Elf',
    'Half-Orc',
    'Tiefling',
    'Aarakocra',
    'Aasimar',
    'Bugbear',
    'Centaur',
    'Changeling',
    'Firbolg',
    'Genasi',
    'Githyanki',
    'Githzerai',
    'Goblin',
    'Goliath',
    'Hobgoblin',
    'Kenku',
    'Kobold',
    'Lizardfolk',
    'Minotaur',
    'Orc',
    'Satyr',
    'Tabaxi',
    'Triton',
    'Warforged',
    'Yuan-Ti'
];
const FALLBACK_RACE_OPTIONS = [
    {
        value: 'Human',
        label: 'Human'
    },
    {
        value: 'Elf',
        label: 'Elf'
    },
    {
        value: 'Dwarf',
        label: 'Dwarf'
    },
    {
        value: 'Halfling',
        label: 'Halfling'
    },
    {
        value: 'Dragonborn',
        label: 'Dragonborn'
    },
    {
        value: 'Gnome',
        label: 'Gnome'
    },
    {
        value: 'Half-Elf',
        label: 'Half-Elf'
    },
    {
        value: 'Half-Orc',
        label: 'Half-Orc'
    },
    {
        value: 'Tiefling',
        label: 'Tiefling'
    }
];
const CLASS_HIT_DICE = {
    Barbarian: 12,
    Fighter: 10,
    Paladin: 10,
    Ranger: 10,
    Artificer: 8,
    Bard: 8,
    Cleric: 8,
    Druid: 8,
    Monk: 8,
    Rogue: 8,
    Warlock: 8,
    Sorcerer: 6,
    Wizard: 6,
    'Blood Hunter': 10
};
const COMMON_CLASSES = [
    {
        name: 'Barbarian',
        spellcaster: 'none',
        hitDie: 12
    },
    {
        name: 'Bard',
        spellcaster: 'full',
        hitDie: 8
    },
    {
        name: 'Cleric',
        spellcaster: 'full',
        hitDie: 8
    },
    {
        name: 'Druid',
        spellcaster: 'full',
        hitDie: 8
    },
    {
        name: 'Fighter',
        spellcaster: 'third',
        hitDie: 10
    },
    {
        name: 'Monk',
        spellcaster: 'none',
        hitDie: 8
    },
    {
        name: 'Paladin',
        spellcaster: 'half',
        hitDie: 10
    },
    {
        name: 'Ranger',
        spellcaster: 'half',
        hitDie: 10
    },
    {
        name: 'Rogue',
        spellcaster: 'third',
        hitDie: 8
    },
    {
        name: 'Sorcerer',
        spellcaster: 'full',
        hitDie: 6
    },
    {
        name: 'Warlock',
        spellcaster: 'warlock',
        hitDie: 8
    },
    {
        name: 'Wizard',
        spellcaster: 'full',
        hitDie: 6
    },
    {
        name: 'Artificer',
        spellcaster: 'half',
        hitDie: 8
    },
    {
        name: 'Blood Hunter',
        spellcaster: 'none',
        hitDie: 10
    }
];
const FULL_CASTER_SPELL_SLOTS = {
    1: {
        1: 2
    },
    2: {
        1: 3
    },
    3: {
        1: 4,
        2: 2
    },
    4: {
        1: 4,
        2: 3
    },
    5: {
        1: 4,
        2: 3,
        3: 2
    },
    6: {
        1: 4,
        2: 3,
        3: 3
    },
    7: {
        1: 4,
        2: 3,
        3: 3,
        4: 1
    },
    8: {
        1: 4,
        2: 3,
        3: 3,
        4: 2
    },
    9: {
        1: 4,
        2: 3,
        3: 3,
        4: 3,
        5: 1
    },
    10: {
        1: 4,
        2: 3,
        3: 3,
        4: 3,
        5: 2
    },
    11: {
        1: 4,
        2: 3,
        3: 3,
        4: 3,
        5: 2,
        6: 1
    },
    12: {
        1: 4,
        2: 3,
        3: 3,
        4: 3,
        5: 2,
        6: 1
    },
    13: {
        1: 4,
        2: 3,
        3: 3,
        4: 3,
        5: 2,
        6: 1,
        7: 1
    },
    14: {
        1: 4,
        2: 3,
        3: 3,
        4: 3,
        5: 2,
        6: 1,
        7: 1
    },
    15: {
        1: 4,
        2: 3,
        3: 3,
        4: 3,
        5: 2,
        6: 1,
        7: 1,
        8: 1
    },
    16: {
        1: 4,
        2: 3,
        3: 3,
        4: 3,
        5: 2,
        6: 1,
        7: 1,
        8: 1
    },
    17: {
        1: 4,
        2: 3,
        3: 3,
        4: 3,
        5: 2,
        6: 1,
        7: 1,
        8: 1,
        9: 1
    },
    18: {
        1: 4,
        2: 3,
        3: 3,
        4: 3,
        5: 3,
        6: 1,
        7: 1,
        8: 1,
        9: 1
    },
    19: {
        1: 4,
        2: 3,
        3: 3,
        4: 3,
        5: 3,
        6: 2,
        7: 1,
        8: 1,
        9: 1
    },
    20: {
        1: 4,
        2: 3,
        3: 3,
        4: 3,
        5: 3,
        6: 2,
        7: 2,
        8: 1,
        9: 1
    }
};
const HALF_CASTER_SPELL_SLOTS = {
    1: {},
    2: {
        1: 2
    },
    3: {
        1: 3
    },
    4: {
        1: 3
    },
    5: {
        1: 4,
        2: 2
    },
    6: {
        1: 4,
        2: 2
    },
    7: {
        1: 4,
        2: 3
    },
    8: {
        1: 4,
        2: 3
    },
    9: {
        1: 4,
        2: 3,
        3: 2
    },
    10: {
        1: 4,
        2: 3,
        3: 2
    },
    11: {
        1: 4,
        2: 3,
        3: 3
    },
    12: {
        1: 4,
        2: 3,
        3: 3
    },
    13: {
        1: 4,
        2: 3,
        3: 3,
        4: 1
    },
    14: {
        1: 4,
        2: 3,
        3: 3,
        4: 1
    },
    15: {
        1: 4,
        2: 3,
        3: 3,
        4: 2
    },
    16: {
        1: 4,
        2: 3,
        3: 3,
        4: 2
    },
    17: {
        1: 4,
        2: 3,
        3: 3,
        4: 3,
        5: 1
    },
    18: {
        1: 4,
        2: 3,
        3: 3,
        4: 3,
        5: 1
    },
    19: {
        1: 4,
        2: 3,
        3: 3,
        4: 3,
        5: 2
    },
    20: {
        1: 4,
        2: 3,
        3: 3,
        4: 3,
        5: 2
    }
};
const THIRD_CASTER_SPELL_SLOTS = {
    1: {},
    2: {},
    3: {
        1: 2
    },
    4: {
        1: 3
    },
    5: {},
    6: {},
    7: {
        1: 4,
        2: 2
    },
    8: {
        1: 4,
        2: 2
    },
    9: {},
    10: {
        1: 4,
        2: 3
    },
    11: {
        1: 4,
        2: 3
    },
    12: {},
    13: {
        1: 4,
        2: 3,
        3: 2
    },
    14: {
        1: 4,
        2: 3,
        3: 2
    },
    15: {},
    16: {
        1: 4,
        2: 3,
        3: 3
    },
    17: {},
    18: {},
    19: {
        1: 4,
        2: 3,
        3: 3,
        4: 1
    },
    20: {
        1: 4,
        2: 3,
        3: 3,
        4: 1
    }
};
const WARLOCK_PACT_SLOTS = {
    1: {
        slots: 1,
        level: 1
    },
    2: {
        slots: 2,
        level: 1
    },
    3: {
        slots: 2,
        level: 2
    },
    4: {
        slots: 2,
        level: 2
    },
    5: {
        slots: 2,
        level: 3
    },
    6: {
        slots: 2,
        level: 3
    },
    7: {
        slots: 2,
        level: 4
    },
    8: {
        slots: 2,
        level: 4
    },
    9: {
        slots: 2,
        level: 5
    },
    10: {
        slots: 2,
        level: 5
    },
    11: {
        slots: 3,
        level: 5
    },
    12: {
        slots: 3,
        level: 5
    },
    13: {
        slots: 3,
        level: 5
    },
    14: {
        slots: 3,
        level: 5
    },
    15: {
        slots: 3,
        level: 5
    },
    16: {
        slots: 3,
        level: 5
    },
    17: {
        slots: 4,
        level: 5
    },
    18: {
        slots: 4,
        level: 5
    },
    19: {
        slots: 4,
        level: 5
    },
    20: {
        slots: 4,
        level: 5
    }
};
const ALIGNMENTS = [
    'Lawful Good',
    'Neutral Good',
    'Chaotic Good',
    'Lawful Neutral',
    'True Neutral',
    'Chaotic Neutral',
    'Lawful Evil',
    'Neutral Evil',
    'Chaotic Evil'
];
const BACKGROUNDS = [
    'Acolyte',
    'Criminal',
    'Folk Hero',
    'Noble',
    'Sage',
    'Soldier',
    'Charlatan',
    'Entertainer',
    'Guild Artisan',
    'Hermit',
    'Outlander',
    'Sailor'
];
const DEFAULT_CHARACTER_STATE = {
    name: '',
    race: '',
    class: {
        name: '',
        isCustom: false,
        spellcaster: 'none',
        hitDie: 8
    },
    level: 1,
    experience: 0,
    background: '',
    alignment: '',
    playerName: '',
    abilities: {
        strength: 10,
        dexterity: 10,
        constitution: 10,
        intelligence: 10,
        wisdom: 10,
        charisma: 10
    },
    skills: {
        acrobatics: {
            proficient: false,
            expertise: false
        },
        animalHandling: {
            proficient: false,
            expertise: false
        },
        arcana: {
            proficient: false,
            expertise: false
        },
        athletics: {
            proficient: false,
            expertise: false
        },
        deception: {
            proficient: false,
            expertise: false
        },
        history: {
            proficient: false,
            expertise: false
        },
        insight: {
            proficient: false,
            expertise: false
        },
        intimidation: {
            proficient: false,
            expertise: false
        },
        investigation: {
            proficient: false,
            expertise: false
        },
        medicine: {
            proficient: false,
            expertise: false
        },
        nature: {
            proficient: false,
            expertise: false
        },
        perception: {
            proficient: false,
            expertise: false
        },
        performance: {
            proficient: false,
            expertise: false
        },
        persuasion: {
            proficient: false,
            expertise: false
        },
        religion: {
            proficient: false,
            expertise: false
        },
        sleightOfHand: {
            proficient: false,
            expertise: false
        },
        stealth: {
            proficient: false,
            expertise: false
        },
        survival: {
            proficient: false,
            expertise: false
        }
    },
    hitPoints: {
        current: 8,
        max: 8,
        temporary: 0,
        calculationMode: 'auto',
        manualMaxOverride: undefined,
        deathSaves: undefined
    },
    deathSavingThrows: {
        successes: 0,
        failures: 0,
        isStabilized: false
    },
    armorClass: 10,
    tempArmorClass: 0,
    isWearingShield: false,
    shieldBonus: 2,
    initiative: {
        value: 0,
        isOverridden: false
    },
    reaction: {
        hasUsedReaction: false
    },
    speed: 30,
    hitDice: '1d8',
    savingThrows: {
        strength: {
            proficient: false
        },
        dexterity: {
            proficient: false
        },
        constitution: {
            proficient: false
        },
        intelligence: {
            proficient: false
        },
        wisdom: {
            proficient: false
        },
        charisma: {
            proficient: false
        }
    },
    spellSlots: {
        1: {
            max: 0,
            used: 0
        },
        2: {
            max: 0,
            used: 0
        },
        3: {
            max: 0,
            used: 0
        },
        4: {
            max: 0,
            used: 0
        },
        5: {
            max: 0,
            used: 0
        },
        6: {
            max: 0,
            used: 0
        },
        7: {
            max: 0,
            used: 0
        },
        8: {
            max: 0,
            used: 0
        },
        9: {
            max: 0,
            used: 0
        }
    },
    heroicInspiration: {
        count: 0,
        maxCount: undefined
    },
    trackableTraits: [],
    extendedFeatures: [],
    features: [],
    traits: [],
    notes: [],
    characterBackground: {
        backstory: '',
        personality: '',
        ideals: '',
        bonds: '',
        flaws: ''
    },
    weapons: [],
    magicItems: [],
    armorItems: [],
    inventoryItems: [],
    currency: {
        copper: 0,
        silver: 0,
        electrum: 0,
        gold: 0,
        platinum: 0
    },
    attunementSlots: {
        used: 0,
        max: 3
    },
    weaponProficiencies: {
        simpleWeapons: false,
        martialWeapons: false,
        specificWeapons: []
    },
    spells: [],
    spellcastingStats: {
        spellcastingAbility: null,
        isAbilityOverridden: false,
        customSpellcastingAbility: null,
        spellAttackBonus: undefined,
        spellSaveDC: undefined
    },
    concentration: {
        isConcentrating: false,
        spellName: undefined,
        spellId: undefined,
        castAt: undefined,
        startedAt: undefined
    },
    // Spellbook system
    spellbook: {
        knownSpells: [],
        preparedSpells: [],
        favoriteSpells: [],
        customSpells: [],
        spellbookSettings: {
            showOnlyClassSpells: true,
            showOnlyKnownSpells: false,
            preferredSources: [
                'PHB',
                'XGE',
                'TCE'
            ],
            spellbookName: 'My Spellbook',
            theme: 'classic'
        }
    },
    // Conditions and diseases
    conditionsAndDiseases: {
        activeConditions: [],
        activeDiseases: [],
        exhaustionVariant: '2024'
    },
    // Class Features
    jackOfAllTrades: false,
    languages: [],
    toolProficiencies: [],
    // Campaign Tracking
    daysSpent: 0
};
const SPELL_SOURCE_COLORS = {
    PHB: 'bg-blue-500',
    PHB2024: 'bg-indigo-500',
    XPHB: 'bg-violet-500',
    XGE: 'bg-green-500',
    TCE: 'bg-red-500',
    ERLW: 'bg-amber-500',
    AI: 'bg-cyan-500',
    AAG: 'bg-teal-500',
    EEPC: 'bg-emerald-500',
    EGW: 'bg-sky-500',
    RMR: 'bg-purple-500',
    FTD: 'bg-fuchsia-500',
    GGR: 'bg-rose-500',
    IDRotF: 'bg-orange-500',
    MOTF: 'bg-yellow-500',
    MTG: 'bg-lime-500',
    SatO: 'bg-pink-500',
    SCC: 'bg-slate-500',
    SCAG: 'bg-zinc-500',
    TDCSR: 'bg-emerald-600',
    BMT: 'bg-violet-600',
    BoET: 'bg-indigo-600',
    DoDk: 'bg-blue-600',
    GHLoE: 'bg-cyan-600',
    VG: 'bg-teal-600',
    'AitFR-AVT': 'bg-green-600'
};
const SPELL_SOURCE_BOOKS = {
    PHB: "Player's Handbook",
    PHB2024: "Player's Handbook 2024",
    XPHB: "Player's Handbook 2024",
    XGE: "Xanathar's Guide to Everything",
    TCE: "Tasha's Cauldron of Everything",
    ERLW: 'Eberron: Rising from the Last War',
    AI: 'Acquisitions Incorporated',
    AAG: `Astral Adventurers Guild`,
    EEPC: `Elemental Evil Player's Companion`,
    EGW: `Explorer's Guide to Wildemount`,
    RMR: `Dungeons & Dragons vs Rick & Morty`,
    FTD: `Fizban's Treasury of Dragons`,
    GGR: `Guildmasters' Guide to Ravnica`,
    IDRotF: `Icewind Dale: Rime of the Frostmaiden`,
    MOTF: `Mythic Odysseys of Theros`,
    MTG: `Magic: The Gathering`,
    SatO: 'Sigil and the Outlands',
    SCC: 'Strixhaven: A Curriculum of Chaos',
    SCAG: "Sword Coast Adventurer's Guide",
    TDCSR: `Tal'Dorei Campaign Setting Reborn`,
    BMT: 'The Book of Many Things',
    BoET: 'Book of Ebon Tides',
    DoDk: 'Dungeons of Drakkenheim',
    GHLoE: 'Grim Hollow: Lairs of Etharis',
    VG: "Volo's Guide to Monsters",
    'AitFR-AVT': `Adventures in the Forgotten Realms: A Verdant Tomb`,
    'AitFR-FCD': `Adventures in the Forgotten Realms: From Cyan Depths`,
    LLK: 'Lost Laboratory of Kwalish',
    DMG: "Dungeon Master's Guide",
    DMG2024: "Dungeon Master's Guide 2024",
    XDMG: "Dungeon Master's Guide 2024"
};
const AUTOSAVE_DELAY = 500; // ms
const STORAGE_KEY = 'rollkeeper-character';
const APP_VERSION = '1.0.0';
const MAX_AVATAR_SIZE_MB = 5; // Maximum avatar file size in megabytes
const MAX_AVATAR_SIZE_BYTES = MAX_AVATAR_SIZE_MB * 1024 * 1024;
}),
"[project]/apps/web/src/utils/calculations.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "calculateCarryingCapacity",
    ()=>calculateCarryingCapacity,
    "calculateCharacterArmorClass",
    ()=>calculateCharacterArmorClass,
    "calculateCharacterHitDicePools",
    ()=>calculateCharacterHitDicePools,
    "calculateCharacterPactMagic",
    ()=>calculateCharacterPactMagic,
    "calculateCharacterSpellSlots",
    ()=>calculateCharacterSpellSlots,
    "calculateHitPointMaximum",
    ()=>calculateHitPointMaximum,
    "calculateInitiativeModifier",
    ()=>calculateInitiativeModifier,
    "calculateLevelFromXP",
    ()=>calculateLevelFromXP,
    "calculateModifier",
    ()=>calculateModifier,
    "calculateMulticlassSpellSlots",
    ()=>calculateMulticlassSpellSlots,
    "calculatePactMagic",
    ()=>calculatePactMagic,
    "calculatePassivePerception",
    ()=>calculatePassivePerception,
    "calculateSavingThrowModifier",
    ()=>calculateSavingThrowModifier,
    "calculateSkillModifier",
    ()=>calculateSkillModifier,
    "calculateSpellAttackBonus",
    ()=>calculateSpellAttackBonus,
    "calculateSpellSaveDC",
    ()=>calculateSpellSaveDC,
    "calculateSpellSlots",
    ()=>calculateSpellSlots,
    "calculateTotalArmorClass",
    ()=>calculateTotalArmorClass,
    "calculateTraitMaxUses",
    ()=>calculateTraitMaxUses,
    "calculateWeaponAttackBonus",
    ()=>calculateWeaponAttackBonus,
    "calculateWeaponDamageBonus",
    ()=>calculateWeaponDamageBonus,
    "formatModifier",
    ()=>formatModifier,
    "getCalculatedFields",
    ()=>getCalculatedFields,
    "getCharacterSpellcastingAbility",
    ()=>getCharacterSpellcastingAbility,
    "getCharacterTotalLevel",
    ()=>getCharacterTotalLevel,
    "getClassSpellcastingAbility",
    ()=>getClassSpellcastingAbility,
    "getProficiencyBonus",
    ()=>getProficiencyBonus,
    "getSpellAttackString",
    ()=>getSpellAttackString,
    "getSpellSaveDCString",
    ()=>getSpellSaveDCString,
    "getSpellcastingAbilityModifier",
    ()=>getSpellcastingAbilityModifier,
    "getWeaponAbilityModifier",
    ()=>getWeaponAbilityModifier,
    "getWeaponAttackString",
    ()=>getWeaponAttackString,
    "getWeaponDamageString",
    ()=>getWeaponDamageString,
    "getXPForLevel",
    ()=>getXPForLevel,
    "getXPProgress",
    ()=>getXPProgress,
    "getXPToNextLevel",
    ()=>getXPToNextLevel,
    "hasSpellSlots",
    ()=>hasSpellSlots,
    "hasSpellcasting",
    ()=>hasSpellcasting,
    "hasWarlockLevels",
    ()=>hasWarlockLevels,
    "isSpellcaster",
    ()=>isSpellcaster,
    "isWeaponProficient",
    ()=>isWeaponProficient,
    "rollDamage",
    ()=>rollDamage,
    "shouldLevelUp",
    ()=>shouldLevelUp,
    "updateSpellSlotsPreservingUsed",
    ()=>updateSpellSlotsPreservingUsed
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/utils/constants.ts [app-ssr] (ecmascript)");
;
const calculateModifier = (score)=>{
    return Math.floor((score - 10) / 2);
};
const getProficiencyBonus = (level)=>{
    const clampedLevel = Math.max(1, Math.min(20, level));
    return __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["PROFICIENCY_BONUS_BY_LEVEL"][clampedLevel] || 2;
};
const calculateSkillModifier = (character, skillName)=>{
    const skill = character.skills[skillName];
    const relatedAbility = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SKILL_ABILITY_MAP"][skillName];
    const abilityScore = character.abilities[relatedAbility];
    const abilityModifier = calculateModifier(abilityScore);
    const proficiencyBonus = getProficiencyBonus(character.level);
    let modifier = abilityModifier;
    // Add proficiency bonus if proficient
    if (skill.proficient) {
        modifier += proficiencyBonus;
    } else if (character.jackOfAllTrades) {
        // Jack of All Trades: add half proficiency bonus (rounded down) to non-proficient skills
        modifier += Math.floor(proficiencyBonus / 2);
    }
    // Double proficiency bonus for expertise
    if (skill.expertise && skill.proficient) {
        modifier += proficiencyBonus;
    }
    // Add any custom modifier
    if (skill.customModifier !== undefined) {
        modifier += skill.customModifier;
    }
    return modifier;
};
const calculateSavingThrowModifier = (character, ability)=>{
    const abilityScore = character.abilities[ability];
    const abilityModifier = calculateModifier(abilityScore);
    const savingThrow = character.savingThrows[ability];
    const proficiencyBonus = getProficiencyBonus(character.level);
    let modifier = abilityModifier;
    // Add proficiency bonus if proficient
    if (savingThrow.proficient) {
        modifier += proficiencyBonus;
    }
    // Add any custom modifier
    if (savingThrow.customModifier !== undefined) {
        modifier += savingThrow.customModifier;
    }
    return modifier;
};
const calculateInitiativeModifier = (character)=>{
    return calculateModifier(character.abilities.dexterity);
};
const calculateTotalArmorClass = (baseAC, tempAC, isWearingShield, shieldBonus = 2)=>{
    return baseAC + tempAC + (isWearingShield ? shieldBonus : 0);
};
const calculateCharacterArmorClass = (character)=>{
    return calculateTotalArmorClass(character.armorClass, character.tempArmorClass, character.isWearingShield, character.shieldBonus);
};
const calculatePassivePerception = (character)=>{
    const perceptionModifier = calculateSkillModifier(character, 'perception');
    return 10 + perceptionModifier;
};
const calculateHitPointMaximum = (character, hitDieType = 8 // Default d8, could be passed from class data
)=>{
    const constitutionModifier = calculateModifier(character.abilities.constitution);
    const level = character.level;
    // First level gets max hit die + con mod
    // Subsequent levels get average of hit die + con mod
    const firstLevelHP = hitDieType + constitutionModifier;
    const additionalLevelsHP = (level - 1) * (Math.floor(hitDieType / 2) + 1 + constitutionModifier);
    return Math.max(1, firstLevelHP + additionalLevelsHP);
};
const calculateCarryingCapacity = (character)=>{
    return character.abilities.strength * 15;
};
const formatModifier = (modifier)=>{
    if (modifier >= 0) {
        return `+${modifier}`;
    }
    return modifier.toString();
};
const getCalculatedFields = (character)=>{
    const abilityModifiers = {
        strength: calculateModifier(character.abilities.strength),
        dexterity: calculateModifier(character.abilities.dexterity),
        constitution: calculateModifier(character.abilities.constitution),
        intelligence: calculateModifier(character.abilities.intelligence),
        wisdom: calculateModifier(character.abilities.wisdom),
        charisma: calculateModifier(character.abilities.charisma)
    };
    const skillModifiers = Object.keys(character.skills).reduce((acc, skillName)=>{
        acc[skillName] = calculateSkillModifier(character, skillName);
        return acc;
    }, {});
    const savingThrowModifiers = Object.keys(character.savingThrows).reduce((acc, abilityName)=>{
        acc[abilityName] = calculateSavingThrowModifier(character, abilityName);
        return acc;
    }, {});
    return {
        proficiencyBonus: getProficiencyBonus(character.level),
        abilityModifiers,
        skillModifiers,
        savingThrowModifiers,
        initiativeModifier: calculateInitiativeModifier(character),
        passivePerception: calculatePassivePerception(character),
        carryingCapacity: calculateCarryingCapacity(character)
    };
};
const isWeaponProficient = (character, weapon)=>{
    // Check manual proficiency override first
    if (weapon.manualProficiency !== undefined) {
        return weapon.manualProficiency;
    }
    // Check category proficiency
    if (weapon.category === 'simple' && character.weaponProficiencies.simpleWeapons) {
        return true;
    }
    if (weapon.category === 'martial' && character.weaponProficiencies.martialWeapons) {
        return true;
    }
    // Check specific weapon proficiency
    return character.weaponProficiencies.specificWeapons.includes(weapon.name.toLowerCase());
};
const getWeaponAbilityModifier = (character, weapon)=>{
    // Finesse weapons can use DEX or STR (we'll use the higher one)
    if (weapon.weaponType.includes('finesse')) {
        return Math.max(calculateModifier(character.abilities.strength), calculateModifier(character.abilities.dexterity));
    }
    // Ranged weapons use DEX
    if (weapon.weaponType.includes('ranged')) {
        return calculateModifier(character.abilities.dexterity);
    }
    // Melee weapons use STR by default
    return calculateModifier(character.abilities.strength);
};
const calculateWeaponAttackBonus = (character, weapon)=>{
    let attackBonus = 0;
    // Add ability modifier
    attackBonus += getWeaponAbilityModifier(character, weapon);
    // Add proficiency bonus if proficient
    if (isWeaponProficient(character, weapon)) {
        attackBonus += getProficiencyBonus(character.level);
    }
    // Add enhancement bonus
    attackBonus += weapon.enhancementBonus;
    // Add custom attack bonus
    if (weapon.attackBonus) {
        attackBonus += weapon.attackBonus;
    }
    return attackBonus;
};
const calculateWeaponDamageBonus = (character, weapon)=>{
    let damageBonus = 0;
    // Add ability modifier
    damageBonus += getWeaponAbilityModifier(character, weapon);
    // Add enhancement bonus
    damageBonus += weapon.enhancementBonus;
    // Add custom damage bonus
    if (weapon.damageBonus) {
        damageBonus += weapon.damageBonus;
    }
    return damageBonus;
};
const getWeaponAttackString = (character, weapon)=>{
    const attackBonus = calculateWeaponAttackBonus(character, weapon);
    return `${formatModifier(attackBonus)} to hit`;
};
const getWeaponDamageString = (character, weapon, versatile = false)=>{
    const damageBonus = calculateWeaponDamageBonus(character, weapon);
    // Handle backward compatibility - check if damage is old format (object) or new format (array)
    if (!Array.isArray(weapon.damage)) {
        // Old format: weapon.damage is an object with dice, type, versatiledice
        const legacyDamage = weapon.damage;
        if (legacyDamage && legacyDamage.dice && legacyDamage.type) {
            const dice = versatile && legacyDamage.versatiledice ? legacyDamage.versatiledice : legacyDamage.dice;
            if (damageBonus === 0) {
                return `${dice} ${legacyDamage.type}`;
            }
            return `${dice}${formatModifier(damageBonus)} ${legacyDamage.type}`;
        }
        return 'No damage';
    }
    // New format: weapon.damage is an array
    if (weapon.damage.length === 0) {
        return 'No damage';
    }
    const damageStrings = weapon.damage.map((damage, index)=>{
        const dice = versatile && damage.versatiledice ? damage.versatiledice : damage.dice;
        const bonus = index === 0 ? damageBonus : 0; // Only add weapon damage bonus to first damage
        if (bonus === 0) {
            return `${dice} ${damage.type}`;
        }
        return `${dice}${formatModifier(bonus)} ${damage.type}`;
    });
    return damageStrings.join(', ');
};
const rollDamage = (dice, bonus = 0)=>{
    // Parse dice string (e.g., "1d8", "2d6", "3d4+2")
    const diceMatch = dice.match(/(\d+)d(\d+)(?:\+(\d+))?(?:-(\d+))?/i);
    if (!diceMatch) {
        // If not a valid dice string, return as-is
        return dice;
    }
    const numDice = parseInt(diceMatch[1]);
    const dieSize = parseInt(diceMatch[2]);
    const diceBonus = diceMatch[3] ? parseInt(diceMatch[3]) : diceMatch[4] ? -parseInt(diceMatch[4]) : 0;
    let total = 0;
    const rolls = [];
    // Roll each die
    for(let i = 0; i < numDice; i++){
        const roll = Math.floor(Math.random() * dieSize) + 1;
        rolls.push(roll);
        total += roll;
    }
    // Add bonuses
    total += diceBonus + bonus;
    // Format result
    if (numDice === 1) {
        return `${total}${diceBonus + bonus !== 0 ? ` (${rolls[0]}${diceBonus + bonus > 0 ? `+${diceBonus + bonus}` : diceBonus + bonus})` : ''}`;
    } else {
        return `${total} (${rolls.join('+')}${diceBonus + bonus !== 0 ? `${diceBonus + bonus > 0 ? `+${diceBonus + bonus}` : diceBonus + bonus}` : ''})`;
    }
};
function calculateSpellSlots(classInfo, level) {
    const emptySlots = {
        1: {
            max: 0,
            used: 0
        },
        2: {
            max: 0,
            used: 0
        },
        3: {
            max: 0,
            used: 0
        },
        4: {
            max: 0,
            used: 0
        },
        5: {
            max: 0,
            used: 0
        },
        6: {
            max: 0,
            used: 0
        },
        7: {
            max: 0,
            used: 0
        },
        8: {
            max: 0,
            used: 0
        },
        9: {
            max: 0,
            used: 0
        }
    };
    if (classInfo.spellcaster === 'none' || classInfo.spellcaster === 'warlock') {
        return emptySlots;
    }
    let slotsTable;
    switch(classInfo.spellcaster){
        case 'full':
            slotsTable = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["FULL_CASTER_SPELL_SLOTS"];
            break;
        case 'half':
            slotsTable = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["HALF_CASTER_SPELL_SLOTS"];
            break;
        case 'third':
            slotsTable = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["THIRD_CASTER_SPELL_SLOTS"];
            break;
        default:
            return emptySlots;
    }
    const levelSlots = slotsTable[level] || {};
    const result = {
        ...emptySlots
    };
    for (const [spellLevel, maxSlots] of Object.entries(levelSlots)){
        const level = parseInt(spellLevel);
        result[level] = {
            max: maxSlots,
            used: 0
        };
    }
    return result;
}
function calculatePactMagic(level) {
    const pactData = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["WARLOCK_PACT_SLOTS"][level];
    if (!pactData) return undefined;
    return {
        slots: {
            max: pactData.slots,
            used: 0
        },
        level: pactData.level
    };
}
function updateSpellSlotsPreservingUsed(newSlots, currentSlots) {
    const result = {
        ...newSlots
    };
    // Preserve used slots where possible, but don't exceed new max
    for(let i = 1; i <= 9; i++){
        const level = i;
        const currentUsed = currentSlots[level].used;
        const newMax = newSlots[level].max;
        result[level].used = Math.min(currentUsed, newMax);
    }
    return result;
}
function hasSpellSlots(spellSlots, pactMagic) {
    const hasRegularSlots = spellSlots ? Object.values(spellSlots).some((slot)=>slot.max > 0) : false;
    const hasPactSlots = pactMagic && pactMagic.slots.max > 0;
    return hasRegularSlots || !!hasPactSlots;
}
function calculateLevelFromXP(xp) {
    // Find the highest level where XP threshold is met
    for(let level = 20; level >= 1; level--){
        if (xp >= __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["XP_THRESHOLDS"][level]) {
            return level;
        }
    }
    return 1; // Fallback to level 1
}
function getXPForLevel(level) {
    return __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["XP_THRESHOLDS"][Math.max(1, Math.min(20, level))] || 0;
}
function getXPToNextLevel(currentXP, currentLevel) {
    if (currentLevel >= 20) return 0; // Max level reached
    const nextLevelXP = getXPForLevel(currentLevel + 1);
    return Math.max(0, nextLevelXP - currentXP);
}
function getXPProgress(currentXP, currentLevel) {
    if (currentLevel >= 20) return 100; // Max level reached
    const currentLevelXP = getXPForLevel(currentLevel);
    const nextLevelXP = getXPForLevel(currentLevel + 1);
    const xpInCurrentLevel = currentXP - currentLevelXP;
    const xpNeededForLevel = nextLevelXP - currentLevelXP;
    return Math.min(100, Math.max(0, xpInCurrentLevel / xpNeededForLevel * 100));
}
function shouldLevelUp(currentXP, currentLevel) {
    const calculatedLevel = calculateLevelFromXP(currentXP);
    return calculatedLevel > currentLevel;
}
function getClassSpellcastingAbility(className) {
    const normalizedClass = className.toLowerCase();
    // Intelligence-based spellcasters
    if (normalizedClass.includes('wizard') || normalizedClass.includes('artificer') || normalizedClass.includes('eldritch knight') || normalizedClass.includes('arcane trickster')) {
        return 'intelligence';
    }
    // Wisdom-based spellcasters
    if (normalizedClass.includes('cleric') || normalizedClass.includes('druid') || normalizedClass.includes('ranger')) {
        return 'wisdom';
    }
    // Charisma-based spellcasters
    if (normalizedClass.includes('sorcerer') || normalizedClass.includes('warlock') || normalizedClass.includes('bard') || normalizedClass.includes('paladin')) {
        return 'charisma';
    }
    // Non-spellcaster or unknown class
    return null;
}
function getCharacterSpellcastingAbility(character) {
    if (character.spellcastingStats.isAbilityOverridden) {
        return character.spellcastingStats.spellcastingAbility;
    }
    return getClassSpellcastingAbility(character.class.name);
}
function calculateSpellAttackBonus(character) {
    // Check for manual override first
    if (character.spellcastingStats.spellAttackBonus !== undefined) {
        return character.spellcastingStats.spellAttackBonus;
    }
    const spellcastingAbility = getCharacterSpellcastingAbility(character);
    if (!spellcastingAbility) {
        return null; // Not a spellcaster
    }
    const abilityModifier = calculateModifier(character.abilities[spellcastingAbility]);
    const proficiencyBonus = getProficiencyBonus(character.level);
    return abilityModifier + proficiencyBonus;
}
function calculateSpellSaveDC(character) {
    // Check for manual override first
    if (character.spellcastingStats.spellSaveDC !== undefined) {
        return character.spellcastingStats.spellSaveDC;
    }
    const spellcastingAbility = getCharacterSpellcastingAbility(character);
    if (!spellcastingAbility) {
        return null; // Not a spellcaster
    }
    const abilityModifier = calculateModifier(character.abilities[spellcastingAbility]);
    const proficiencyBonus = getProficiencyBonus(character.level);
    return 8 + abilityModifier + proficiencyBonus;
}
function isSpellcaster(character) {
    return getCharacterSpellcastingAbility(character) !== null || character.class.spellcaster !== 'none';
}
function getSpellcastingAbilityModifier(character) {
    const spellcastingAbility = getCharacterSpellcastingAbility(character);
    if (!spellcastingAbility) {
        return null;
    }
    return calculateModifier(character.abilities[spellcastingAbility]);
}
function getSpellAttackString(character) {
    const attackBonus = calculateSpellAttackBonus(character);
    if (attackBonus === null) {
        return '—';
    }
    return attackBonus >= 0 ? `+${attackBonus}` : `${attackBonus}`;
}
function getSpellSaveDCString(character) {
    const saveDC = calculateSpellSaveDC(character);
    if (saveDC === null) {
        return '—';
    }
    return `${saveDC}`;
}
function calculateTraitMaxUses(trait, characterLevel) {
    if (!trait.scaleWithProficiency) {
        return trait.maxUses;
    }
    const proficiencyBonus = getProficiencyBonus(characterLevel);
    const multiplier = trait.proficiencyMultiplier || 1;
    return Math.max(1, Math.floor(proficiencyBonus * multiplier));
}
function calculateCharacterSpellSlots(character) {
    // If character has multiclass data, use multiclass calculation
    if (character.classes && character.classes.length > 0) {
        return calculateMulticlassSpellSlots(character.classes);
    }
    // Fallback to single class calculation
    return calculateSpellSlots(character.class, character.level);
}
function calculateMulticlassSpellSlots(classes) {
    let casterLevel = 0;
    for (const classInfo of classes){
        switch(classInfo.spellcaster){
            case 'full':
                casterLevel += classInfo.level;
                break;
            case 'half':
                casterLevel += Math.floor(classInfo.level / 2);
                break;
            case 'third':
                casterLevel += Math.floor(classInfo.level / 3);
                break;
            case 'warlock':
                break;
            case 'none':
            default:
                break;
        }
    }
    // If no caster levels, return empty slots
    if (casterLevel === 0) {
        return {
            1: {
                max: 0,
                used: 0
            },
            2: {
                max: 0,
                used: 0
            },
            3: {
                max: 0,
                used: 0
            },
            4: {
                max: 0,
                used: 0
            },
            5: {
                max: 0,
                used: 0
            },
            6: {
                max: 0,
                used: 0
            },
            7: {
                max: 0,
                used: 0
            },
            8: {
                max: 0,
                used: 0
            },
            9: {
                max: 0,
                used: 0
            }
        };
    }
    // Use full caster progression table for the combined caster level
    const levelSlots = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["FULL_CASTER_SPELL_SLOTS"][casterLevel] || {};
    const result = {
        1: {
            max: 0,
            used: 0
        },
        2: {
            max: 0,
            used: 0
        },
        3: {
            max: 0,
            used: 0
        },
        4: {
            max: 0,
            used: 0
        },
        5: {
            max: 0,
            used: 0
        },
        6: {
            max: 0,
            used: 0
        },
        7: {
            max: 0,
            used: 0
        },
        8: {
            max: 0,
            used: 0
        },
        9: {
            max: 0,
            used: 0
        }
    };
    for (const [spellLevel, maxSlots] of Object.entries(levelSlots)){
        const level = parseInt(spellLevel);
        result[level] = {
            max: maxSlots,
            used: 0
        };
    }
    return result;
}
function calculateCharacterPactMagic(character) {
    // If character has multiclass data, find warlock levels
    if (character.classes && character.classes.length > 0) {
        const warlockClass = character.classes.find((cls)=>cls.spellcaster === 'warlock');
        if (warlockClass) {
            return calculatePactMagic(warlockClass.level);
        }
        return undefined;
    }
    // Fallback to single class calculation
    if (character.class.spellcaster === 'warlock') {
        return calculatePactMagic(character.level);
    }
    return undefined;
}
function calculateCharacterHitDicePools(character) {
    // If character has multiclass data, calculate from classes
    if (character.classes && character.classes.length > 0) {
        const hitDicePools = {};
        for (const classInfo of character.classes){
            const dieType = `d${classInfo.hitDie}`;
            if (!hitDicePools[dieType]) {
                hitDicePools[dieType] = {
                    max: 0,
                    used: 0
                };
            }
            hitDicePools[dieType].max += classInfo.level;
        }
        return hitDicePools;
    }
    // Fallback to single class calculation
    const dieType = `d${character.class.hitDie}`;
    return {
        [dieType]: {
            max: character.level,
            used: 0
        }
    };
}
function getCharacterTotalLevel(character) {
    if (character.totalLevel !== undefined) {
        return character.totalLevel;
    }
    if (character.classes && character.classes.length > 0) {
        return character.classes.reduce((total, cls)=>total + cls.level, 0);
    }
    return character.level || 1;
}
function hasSpellcasting(character) {
    if (character.classes && character.classes.length > 0) {
        return character.classes.some((cls)=>cls.spellcaster && cls.spellcaster !== 'none');
    }
    return character.class.spellcaster !== 'none' && character.class.spellcaster !== undefined;
}
function hasWarlockLevels(character) {
    if (character.classes && character.classes.length > 0) {
        return character.classes.some((cls)=>cls.spellcaster === 'warlock');
    }
    return character.class.spellcaster === 'warlock';
}
}),
"[project]/apps/web/src/utils/multiclass.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "addClassLevel",
    ()=>addClassLevel,
    "calculateHitDicePools",
    ()=>calculateHitDicePools,
    "calculateMulticlassSpellSlots",
    ()=>calculateMulticlassSpellSlots,
    "getClassDisplayString",
    ()=>getClassDisplayString,
    "getPrimaryClass",
    ()=>getPrimaryClass,
    "getTotalLevel",
    ()=>getTotalLevel,
    "isMulticlassed",
    ()=>isMulticlassed,
    "migrateToMulticlass",
    ()=>migrateToMulticlass,
    "removeClassLevel",
    ()=>removeClassLevel,
    "validateMulticlassRequirements",
    ()=>validateMulticlassRequirements
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$calculations$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/utils/calculations.ts [app-ssr] (ecmascript)");
;
function migrateToMulticlass(character) {
    // If already has multiclass data, return as-is
    if (character.classes && character.classes.length > 0) {
        return character;
    }
    // Convert single class to multiclass format
    const singleClass = {
        className: character.class?.name || '',
        level: character.level || 1,
        isCustom: character.class?.isCustom || false,
        spellcaster: character.class?.spellcaster,
        hitDie: character.class?.hitDie || 8
    };
    // Calculate hit dice pools from single class
    const hitDicePools = {};
    const dieType = `d${singleClass.hitDie}`;
    hitDicePools[dieType] = {
        max: singleClass.level,
        used: 0
    };
    return {
        ...character,
        classes: [
            singleClass
        ],
        totalLevel: character.level || 1,
        hitDicePools,
        // Keep old fields for backwards compatibility
        class: character.class,
        level: character.level
    };
}
function isMulticlassed(character) {
    return (character.classes?.length || 0) > 1;
}
function calculateHitDicePools(classes, existingPools) {
    const hitDicePools = {};
    // Calculate max dice for each die type
    classes.forEach((cls)=>{
        const dieType = `d${cls.hitDie}`;
        if (!hitDicePools[dieType]) {
            hitDicePools[dieType] = {
                max: 0,
                used: 0
            };
        }
        hitDicePools[dieType].max += cls.level;
    });
    // Preserve used dice from existing pools, but cap at new max
    if (existingPools) {
        Object.keys(hitDicePools).forEach((dieType)=>{
            if (existingPools[dieType]) {
                hitDicePools[dieType].used = Math.min(existingPools[dieType].used, hitDicePools[dieType].max);
            }
        });
    }
    return hitDicePools;
}
function getTotalLevel(character) {
    if (character.totalLevel !== undefined) {
        return character.totalLevel;
    }
    if (character.classes && character.classes.length > 0) {
        return character.classes.reduce((total, cls)=>total + cls.level, 0);
    }
    return character.level || 1;
}
function getPrimaryClass(character) {
    if (!character.classes || character.classes.length === 0) {
        // Fallback to single class format
        if (character.class) {
            return {
                className: character.class.name,
                level: character.level || 1,
                isCustom: character.class.isCustom,
                spellcaster: character.class.spellcaster,
                hitDie: character.class.hitDie
            };
        }
        return null;
    }
    return character.classes.reduce((primary, current)=>current.level > primary.level ? current : primary);
}
function calculateMulticlassSpellSlots(classes) {
    let casterLevel = 0;
    for (const classInfo of classes){
        switch(classInfo.spellcaster){
            case 'full':
                casterLevel += classInfo.level;
                break;
            case 'half':
                casterLevel += Math.floor(classInfo.level / 2);
                break;
            case 'third':
                casterLevel += Math.floor(classInfo.level / 3);
                break;
            case 'warlock':
                break;
            case 'none':
            default:
                break;
        }
    }
    // Use the existing spell slot calculation with the combined caster level
    const dummyClassInfo = {
        name: 'Multiclass',
        isCustom: false,
        spellcaster: 'full',
        hitDie: 8
    };
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$calculations$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["calculateSpellSlots"])(dummyClassInfo, casterLevel);
}
// Hardcoded multiclassing requirements as fallback
const MULTICLASS_REQUIREMENTS = {
    'Barbarian': {
        strength: 13
    },
    'Bard': {
        charisma: 13
    },
    'Cleric': {
        wisdom: 13
    },
    'Druid': {
        wisdom: 13
    },
    'Fighter': {
        strength: 13
    },
    'Monk': {
        dexterity: 13,
        wisdom: 13
    },
    'Paladin': {
        strength: 13,
        charisma: 13
    },
    'Ranger': {
        dexterity: 13,
        wisdom: 13
    },
    'Rogue': {
        dexterity: 13
    },
    'Sorcerer': {
        charisma: 13
    },
    'Warlock': {
        charisma: 13
    },
    'Wizard': {
        intelligence: 13
    },
    'Artificer': {
        intelligence: 13
    },
    'Blood Hunter': {
        strength: 13
    }
};
function validateMulticlassRequirements(currentClasses, newClassName, abilities, classData) {
    const errors = [];
    const warnings = [];
    // Try to get requirements from API data first, then fallback to hardcoded
    let newClassRequirements = {};
    const newClassData = classData?.find((cls)=>cls.name === newClassName);
    if (newClassData?.multiclassing?.requirements && Object.keys(newClassData.multiclassing.requirements).length > 0) {
        newClassRequirements = newClassData.multiclassing.requirements;
    } else {
        newClassRequirements = MULTICLASS_REQUIREMENTS[newClassName] || {};
        if (Object.keys(newClassRequirements).length === 0) {
            errors.push(`Multiclassing requirements not found for ${newClassName}`);
            return {
                valid: false,
                errors,
                warnings
            };
        }
    }
    // Check requirements for the new class
    for (const [ability, requiredScore] of Object.entries(newClassRequirements)){
        const abilityScore = abilities[ability];
        if (abilityScore < requiredScore) {
            errors.push(`${newClassName} requires ${ability.charAt(0).toUpperCase() + ability.slice(1)} ${requiredScore} (you have ${abilityScore})`);
        }
    }
    // Check requirements for existing classes (must maintain them)
    for (const existingClass of currentClasses){
        let existingClassRequirements = {};
        const existingClassData = classData?.find((cls)=>cls.name === existingClass.className);
        if (existingClassData?.multiclassing?.requirements && Object.keys(existingClassData.multiclassing.requirements).length > 0) {
            existingClassRequirements = existingClassData.multiclassing.requirements;
        } else {
            existingClassRequirements = MULTICLASS_REQUIREMENTS[existingClass.className] || {};
        }
        for (const [ability, requiredScore] of Object.entries(existingClassRequirements)){
            const abilityScore = abilities[ability];
            if (abilityScore < requiredScore) {
                errors.push(`You must maintain ${ability.charAt(0).toUpperCase() + ability.slice(1)} ${requiredScore} for ${existingClass.className} (you have ${abilityScore})`);
            }
        }
    }
    // Check for level 20 limit
    const totalLevel = currentClasses.reduce((sum, cls)=>sum + cls.level, 0) + 1; // +1 for new level
    if (totalLevel > 20) {
        errors.push('Total character level cannot exceed 20');
    }
    // Add warnings for common multiclassing considerations
    if (currentClasses.length === 0) {
        warnings.push('Consider taking your first class to level 2 before multiclassing to gain important features');
    }
    const hasSpellcaster = currentClasses.some((cls)=>cls.spellcaster && cls.spellcaster !== 'none');
    const newClassIsSpellcaster = newClassData?.spellcasting?.type && newClassData.spellcasting.type !== 'none';
    if (hasSpellcaster && newClassIsSpellcaster) {
        warnings.push('Multiclassing spellcasters have complex spell slot and spell preparation rules');
    }
    return {
        valid: errors.length === 0,
        errors,
        warnings: warnings.length > 0 ? warnings : undefined
    };
}
function addClassLevel(character, className, isCustom = false, spellcaster, hitDie = 8, subclass) {
    // Ensure character has multiclass structure
    const migratedCharacter = migrateToMulticlass(character);
    const classes = [
        ...migratedCharacter.classes || []
    ];
    // Find existing class or create new one
    const existingClassIndex = classes.findIndex((cls)=>cls.className === className);
    if (existingClassIndex >= 0) {
        // Level up existing class
        classes[existingClassIndex] = {
            ...classes[existingClassIndex],
            level: classes[existingClassIndex].level + 1,
            subclass: subclass || classes[existingClassIndex].subclass
        };
    } else {
        // Add new class
        classes.push({
            className,
            level: 1,
            isCustom,
            spellcaster,
            hitDie,
            subclass
        });
    }
    const totalLevel = classes.reduce((sum, cls)=>sum + cls.level, 0);
    const hitDicePools = calculateHitDicePools(classes);
    // Update backwards compatibility fields
    const primaryClass = classes.reduce((primary, current)=>current.level > primary.level ? current : primary);
    const compatibilityClass = {
        name: primaryClass.className,
        isCustom: primaryClass.isCustom,
        spellcaster: primaryClass.spellcaster,
        hitDie: primaryClass.hitDie
    };
    return {
        ...migratedCharacter,
        classes,
        totalLevel,
        hitDicePools,
        // Update backwards compatibility fields
        class: compatibilityClass,
        level: totalLevel
    };
}
function removeClassLevel(character, className) {
    const migratedCharacter = migrateToMulticlass(character);
    const classes = [
        ...migratedCharacter.classes || []
    ];
    const classIndex = classes.findIndex((cls)=>cls.className === className);
    if (classIndex === -1) {
        return migratedCharacter; // Class not found
    }
    if (classes[classIndex].level > 1) {
        // Reduce level by 1
        classes[classIndex] = {
            ...classes[classIndex],
            level: classes[classIndex].level - 1
        };
    } else {
        // Remove class entirely
        classes.splice(classIndex, 1);
    }
    // If no classes left, this shouldn't happen but handle gracefully
    if (classes.length === 0) {
        return migratedCharacter;
    }
    const totalLevel = classes.reduce((sum, cls)=>sum + cls.level, 0);
    const hitDicePools = calculateHitDicePools(classes);
    // Update backwards compatibility fields
    const primaryClass = classes.reduce((primary, current)=>current.level > primary.level ? current : primary);
    const compatibilityClass = {
        name: primaryClass.className,
        isCustom: primaryClass.isCustom,
        spellcaster: primaryClass.spellcaster,
        hitDie: primaryClass.hitDie
    };
    return {
        ...migratedCharacter,
        classes,
        totalLevel,
        hitDicePools,
        // Update backwards compatibility fields
        class: compatibilityClass,
        level: totalLevel
    };
}
function getClassDisplayString(character) {
    if (!character.classes || character.classes.length === 0) {
        // Fallback to single class format
        return `${character.class?.name || 'Unknown'} ${character.level || 1}`;
    }
    if (character.classes.length === 1) {
        const cls = character.classes[0];
        return `${cls.className} ${cls.level}`;
    }
    // Sort classes by level (descending) for display
    const sortedClasses = [
        ...character.classes
    ].sort((a, b)=>b.level - a.level);
    const classStrings = sortedClasses.map((cls)=>`${cls.className} ${cls.level}`);
    const totalLevel = getTotalLevel(character);
    return `${classStrings.join(' / ')} (Level ${totalLevel})`;
}
}),
"[project]/apps/web/src/utils/hpCalculations.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "addTemporaryHP",
    ()=>addTemporaryHP,
    "applyDamage",
    ()=>applyDamage,
    "applyHealing",
    ()=>applyHealing,
    "calculateMaxHP",
    ()=>calculateMaxHP,
    "getClassHitDie",
    ()=>getClassHitDie,
    "isDead",
    ()=>isDead,
    "isDying",
    ()=>isDying,
    "isStabilized",
    ()=>isStabilized,
    "makeDeathSave",
    ()=>makeDeathSave,
    "resetDeathSaves",
    ()=>resetDeathSaves
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$calculations$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/utils/calculations.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/utils/constants.ts [app-ssr] (ecmascript)");
;
;
function calculateMaxHP(classInfo, level, constitutionScore, manualOverride) {
    if (manualOverride !== undefined) {
        return manualOverride;
    }
    const conModifier = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$calculations$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["calculateModifier"])(constitutionScore);
    const hitDie = classInfo.hitDie;
    // Level 1: Full hit die + CON modifier
    let maxHP = hitDie + conModifier;
    // Subsequent levels: Average hit die (rounded up) + CON modifier
    if (level > 1) {
        const averageHitDieRoll = Math.floor(hitDie / 2) + 1; // (hitDie + 1) / 2 rounded up
        maxHP += (level - 1) * (averageHitDieRoll + conModifier);
    }
    // Minimum 1 HP per level
    return Math.max(maxHP, level);
}
function getClassHitDie(className, customHitDie) {
    if (customHitDie) {
        return customHitDie;
    }
    return __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CLASS_HIT_DICE"][className] || 8; // Default to d8 for unknown classes
}
function applyDamage(hitPoints, damage) {
    if (damage <= 0) return hitPoints;
    let remainingDamage = damage;
    let newTempHP = hitPoints.temporary;
    let newCurrentHP = hitPoints.current;
    let deathSaves = hitPoints.deathSaves;
    // First, damage temporary HP
    if (newTempHP > 0) {
        const tempDamage = Math.min(remainingDamage, newTempHP);
        newTempHP -= tempDamage;
        remainingDamage -= tempDamage;
    }
    // Then damage current HP
    if (remainingDamage > 0) {
        // Calculate how much damage it takes to reach 0 HP
        const damageToZero = Math.min(remainingDamage, newCurrentHP);
        newCurrentHP -= damageToZero;
        // If we hit 0 HP or below
        if (newCurrentHP <= 0) {
            newCurrentHP = 0;
            // Calculate excess damage after reaching 0 HP (massive damage calculation)
            const excessDamage = remainingDamage - damageToZero;
            // Check for massive damage (excess damage >= max HP)
            if (excessDamage >= hitPoints.max) {
                // Instant death from massive damage
                deathSaves = {
                    successes: 0,
                    failures: 3,
                    isStabilized: false
                };
            } else if (!deathSaves) {
                // Start death saving throws (unconscious but not dead)
                deathSaves = {
                    successes: 0,
                    failures: 0,
                    isStabilized: false
                };
            }
        }
    }
    return {
        ...hitPoints,
        current: newCurrentHP,
        temporary: newTempHP,
        deathSaves
    };
}
function applyHealing(hitPoints, healing) {
    if (healing <= 0) return hitPoints;
    const newCurrentHP = Math.min(hitPoints.current + healing, hitPoints.max);
    let deathSaves = hitPoints.deathSaves;
    // Any healing while at 0 HP removes death save state
    if (hitPoints.current === 0 && healing > 0) {
        deathSaves = undefined;
    }
    return {
        ...hitPoints,
        current: newCurrentHP,
        deathSaves
    };
}
function addTemporaryHP(hitPoints, tempHP) {
    if (tempHP <= 0) return hitPoints;
    return {
        ...hitPoints,
        temporary: Math.max(hitPoints.temporary, tempHP)
    };
}
function makeDeathSave(hitPoints, isSuccess, isCritical = false) {
    if (!hitPoints.deathSaves) {
        return hitPoints;
    }
    let newDeathSaves = {
        ...hitPoints.deathSaves
    };
    let newCurrentHP = hitPoints.current;
    if (isSuccess) {
        if (isCritical) {
            // Natural 20: regain 1 HP and become conscious
            newCurrentHP = 1;
            newDeathSaves = undefined; // Remove death saves
        } else {
            // Regular success
            newDeathSaves.successes = Math.min(newDeathSaves.successes + 1, 3);
            // 3 successes = stabilized
            if (newDeathSaves.successes >= 3) {
                newDeathSaves.isStabilized = true;
            }
        }
    } else {
        // Failure
        newDeathSaves.failures = Math.min(newDeathSaves.failures + 1, 3);
    }
    return {
        ...hitPoints,
        current: newCurrentHP,
        deathSaves: newDeathSaves
    };
}
function resetDeathSaves(hitPoints) {
    return {
        ...hitPoints,
        deathSaves: undefined
    };
}
function isDying(hitPoints) {
    return hitPoints.current === 0 && !!hitPoints.deathSaves && !hitPoints.deathSaves.isStabilized;
}
function isDead(hitPoints) {
    return !!hitPoints.deathSaves && hitPoints.deathSaves.failures >= 3;
}
function isStabilized(hitPoints) {
    return hitPoints.current === 0 && !!hitPoints.deathSaves && hitPoints.deathSaves.isStabilized;
}
}),
"[project]/apps/web/src/utils/cn.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "cn",
    ()=>cn
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$clsx$2f$dist$2f$clsx$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/clsx/dist/clsx.mjs [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$tailwind$2d$merge$2f$dist$2f$bundle$2d$mjs$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/tailwind-merge/dist/bundle-mjs.mjs [app-ssr] (ecmascript)");
;
;
function cn(...inputs) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$tailwind$2d$merge$2f$dist$2f$bundle$2d$mjs$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["twMerge"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$clsx$2f$dist$2f$clsx$2e$mjs__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["clsx"])(inputs));
}
}),
"[project]/apps/web/src/utils/currency.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Currency conversion utility functions
__turbopack_context__.s([
    "formatCurrencyFromCopper",
    ()=>formatCurrencyFromCopper,
    "formatCurrencyFromCopperShort",
    ()=>formatCurrencyFromCopperShort
]);
function formatCurrencyFromCopper(totalCopper) {
    if (!totalCopper || totalCopper <= 0) return '0 cp';
    const gold = Math.floor(totalCopper / 100);
    const remainingAfterGold = totalCopper % 100;
    const silver = Math.floor(remainingAfterGold / 10);
    const copper = remainingAfterGold % 10;
    const parts = [];
    if (gold > 0) parts.push(`${gold} gp`);
    if (silver > 0) parts.push(`${silver} sp`);
    if (copper > 0) parts.push(`${copper} cp`);
    return parts.join(', ');
}
function formatCurrencyFromCopperShort(totalCopper) {
    if (!totalCopper || totalCopper <= 0) return '0cp';
    const gold = Math.floor(totalCopper / 100);
    const remainingAfterGold = totalCopper % 100;
    const silver = Math.floor(remainingAfterGold / 10);
    const copper = remainingAfterGold % 10;
    const parts = [];
    if (gold > 0) parts.push(`${gold}g`);
    if (silver > 0) parts.push(`${silver}s`);
    if (copper > 0) parts.push(`${copper}c`);
    return parts.join(' ');
}
}),
"[project]/apps/web/src/utils/fileOperations.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "copyCharacterToClipboard",
    ()=>copyCharacterToClipboard,
    "exportCharacterToFile",
    ()=>exportCharacterToFile,
    "importCharacterFromFile",
    ()=>importCharacterFromFile,
    "pasteCharacterFromClipboard",
    ()=>pasteCharacterFromClipboard,
    "validateCharacterExport",
    ()=>validateCharacterExport
]);
const exportCharacterToFile = (exportData)=>{
    const characterName = exportData.character.name || 'character';
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const filename = `${characterName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${timestamp}.json`;
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', filename);
    linkElement.style.display = 'none';
    document.body.appendChild(linkElement);
    linkElement.click();
    document.body.removeChild(linkElement);
};
const importCharacterFromFile = ()=>{
    return new Promise((resolve, reject)=>{
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.style.display = 'none';
        input.onchange = async (event)=>{
            const file = event.target.files?.[0];
            if (!file) {
                reject(new Error('No file selected'));
                return;
            }
            if (!file.name.toLowerCase().endsWith('.json')) {
                reject(new Error('Please select a valid JSON file'));
                return;
            }
            try {
                const text = await file.text();
                const data = JSON.parse(text);
                // Basic validation
                if (!data.character || typeof data.character !== 'object') {
                    reject(new Error('Invalid character file format'));
                    return;
                }
                // Check for required character properties
                const requiredProps = [
                    'name',
                    'abilities',
                    'skills',
                    'savingThrows'
                ];
                for (const prop of requiredProps){
                    if (!(prop in data.character)) {
                        reject(new Error(`Missing required character property: ${prop}`));
                        return;
                    }
                }
                resolve(data);
            } catch (error) {
                if (error instanceof SyntaxError) {
                    reject(new Error('Invalid JSON file format'));
                } else {
                    reject(error);
                }
            } finally{
                document.body.removeChild(input);
            }
        };
        input.oncancel = ()=>{
            document.body.removeChild(input);
            reject(new Error('File selection cancelled'));
        };
        document.body.appendChild(input);
        input.click();
    });
};
const copyCharacterToClipboard = async (exportData)=>{
    const dataStr = JSON.stringify(exportData, null, 2);
    if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(dataStr);
    } else {
        // Fallback for older browsers or non-secure contexts
        const textArea = document.createElement('textarea');
        textArea.value = dataStr;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        return new Promise((resolve, reject)=>{
            if (document.execCommand('copy')) {
                resolve();
            } else {
                reject(new Error('Failed to copy to clipboard'));
            }
            document.body.removeChild(textArea);
        });
    }
};
const pasteCharacterFromClipboard = async ()=>{
    let text;
    if (navigator.clipboard && window.isSecureContext) {
        text = await navigator.clipboard.readText();
    } else {
        throw new Error('Clipboard access not available in this browser');
    }
    if (!text.trim()) {
        throw new Error('Clipboard is empty');
    }
    try {
        const data = JSON.parse(text);
        // Basic validation
        if (!data.character || typeof data.character !== 'object') {
            throw new Error('Invalid character data in clipboard');
        }
        return data;
    } catch (error) {
        if (error instanceof SyntaxError) {
            throw new Error('Invalid JSON format in clipboard');
        }
        throw error;
    }
};
const validateCharacterExport = (data)=>{
    if (!data || typeof data !== 'object') {
        return false;
    }
    const dataObj = data;
    if (!dataObj.character || typeof dataObj.character !== 'object') {
        return false;
    }
    const character = dataObj.character;
    // Check required properties exist
    const requiredProps = [
        'name',
        'abilities',
        'skills',
        'savingThrows',
        'hitPoints'
    ];
    for (const prop of requiredProps){
        if (!(prop in character)) {
            return false;
        }
    }
    // Validate abilities structure
    if (!character.abilities || typeof character.abilities !== 'object') {
        return false;
    }
    const abilities = character.abilities;
    const requiredAbilities = [
        'strength',
        'dexterity',
        'constitution',
        'intelligence',
        'wisdom',
        'charisma'
    ];
    for (const ability of requiredAbilities){
        if (typeof abilities[ability] !== 'number') {
            return false;
        }
    }
    // Validate skills structure
    if (!character.skills || typeof character.skills !== 'object') {
        return false;
    }
    // Validate saving throws structure
    if (!character.savingThrows || typeof character.savingThrows !== 'object') {
        return false;
    }
    // Validate hit points structure
    if (!character.hitPoints || typeof character.hitPoints !== 'object') {
        return false;
    }
    const hitPoints = character.hitPoints;
    const requiredHPProps = [
        'current',
        'max',
        'temporary'
    ];
    for (const prop of requiredHPProps){
        if (typeof hitPoints[prop] !== 'number') {
            return false;
        }
    }
    return true;
};
}),
"[project]/apps/web/src/utils/apiClient.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * API client utilities for D&D data fetching
 */ __turbopack_context__.s([
    "fetchBestiary",
    ()=>fetchBestiary,
    "fetchClasses",
    ()=>fetchClasses,
    "fetchPopularMonsters",
    ()=>fetchPopularMonsters,
    "fetchSpells",
    ()=>fetchSpells,
    "searchMonsters",
    ()=>searchMonsters
]);
// Base API configuration
const API_BASE = '/api';
/**
 * Generic fetch wrapper with error handling
 */ async function apiRequest(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return {
            data
        };
    } catch (error) {
        console.error(`API request failed for ${url}:`, error);
        return {
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}
async function fetchBestiary() {
    const result = await apiRequest(`${API_BASE}/bestiary`);
    return result.data?.monsters || [];
}
async function searchMonsters(query = '', filters = {}, limit = 20, offset = 0) {
    const params = new URLSearchParams({
        q: query,
        limit: limit.toString(),
        offset: offset.toString()
    });
    // Add filters to params
    if (filters.sizes?.length) params.set('sizes', filters.sizes.join(','));
    if (filters.types?.length) params.set('types', filters.types.join(','));
    if (filters.alignments?.length) params.set('alignments', filters.alignments.join(','));
    if (filters.sources?.length) params.set('sources', filters.sources.join(','));
    if (filters.crRange?.min !== undefined) params.set('crMin', filters.crRange.min.toString());
    if (filters.crRange?.max !== undefined) params.set('crMax', filters.crRange.max.toString());
    if (filters.hasLegendaryActions !== undefined) params.set('hasLegendaryActions', filters.hasLegendaryActions.toString());
    if (filters.hasSpellcasting !== undefined) params.set('hasSpellcasting', filters.hasSpellcasting.toString());
    if (filters.hasConditionImmunities !== undefined) params.set('hasConditionImmunities', filters.hasConditionImmunities.toString());
    if (filters.hasDamageResistances !== undefined) params.set('hasDamageResistances', filters.hasDamageResistances.toString());
    const result = await apiRequest(`${API_BASE}/bestiary/search?${params}`);
    return {
        monsters: result.data?.monsters || [],
        total: result.data?.total || 0,
        hasMore: result.data?.hasMore || false
    };
}
async function fetchSpells() {
    const result = await apiRequest(`${API_BASE}/spells`);
    return result.data?.spells || [];
}
async function fetchClasses() {
    const result = await apiRequest(`${API_BASE}/classes`);
    return result.data?.classes || [];
}
async function fetchPopularMonsters() {
    const result = await searchMonsters('', {}, 50, 0);
    return result.monsters;
}
}),
"[project]/apps/web/src/utils/textFormatting.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Utility functions for processing D&D text formatting
 */ /**
 * Process D&D text with {@...} notation and markdown-style formatting
 */ __turbopack_context__.s([
    "createSafeHtml",
    ()=>createSafeHtml,
    "markdownToHtml",
    ()=>markdownToHtml,
    "processAndFormatDndText",
    ()=>processAndFormatDndText,
    "processDndText",
    ()=>processDndText
]);
function processDndText(text) {
    if (!text) return '';
    let processedText = text;
    // Handle {@dc XX} notation - convert to "DC XX"
    processedText = processedText.replace(/\{@dc\s+(\d+)\}/g, 'DC $1');
    // Handle {@variantrule Name|Source} notation - extract just the name
    processedText = processedText.replace(/\{@variantrule\s+([^|}\s]+)(\|[^}]*)?\}/g, '$1');
    // Handle {@action Name|Source} notation - extract just the name
    processedText = processedText.replace(/\{@action\s+([^|}\s]+)(\|[^}]*)?\}/g, '$1');
    // Handle {@condition Name|Source} notation - extract just the name
    processedText = processedText.replace(/\{@condition\s+([^|}\s]+)(\|[^}]*)?\}/g, '$1');
    // Handle {@spell Name|Source} notation - extract just the name
    processedText = processedText.replace(/\{@spell\s+([^|}\s]+)(\|[^}]*)?\}/g, '$1');
    // Handle {@status Name|Source} notation - extract just the name
    processedText = processedText.replace(/\{@status\s+([^|}\s]+)(\|[^}]*)?\}/g, '$1');
    // Handle {@damage XdY} notation - keep as is but remove braces
    processedText = processedText.replace(/\{@damage\s+([^}]+)\}/g, '$1');
    // Handle {@dice XdY} notation - keep as is but remove braces
    processedText = processedText.replace(/\{@dice\s+([^}]+)\}/g, '$1');
    // Handle any remaining {@...} notation by extracting the first word after @
    processedText = processedText.replace(/\{@\w+\s+([^|}\s]+)(\|[^}]*)?\}/g, '$1');
    return processedText;
}
function markdownToHtml(text) {
    if (!text) return '';
    // Convert **text** to <strong>text</strong>
    return text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}
function processAndFormatDndText(text) {
    return markdownToHtml(processDndText(text));
}
function createSafeHtml(text) {
    return {
        __html: processAndFormatDndText(text)
    };
}
}),
"[project]/apps/web/src/utils/conditionsDiseasesLoader.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getExhaustionByVariant",
    ()=>getExhaustionByVariant,
    "loadAllConditions",
    ()=>loadAllConditions,
    "loadAllDiseases",
    ()=>loadAllDiseases,
    "loadAllStatuses",
    ()=>loadAllStatuses,
    "searchConditions",
    ()=>searchConditions,
    "searchDiseases",
    ()=>searchDiseases
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$textFormatting$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/utils/textFormatting.ts [app-ssr] (ecmascript)");
;
// Cache for loaded data to avoid reprocessing
let cachedConditions = null;
let cachedDiseases = null;
let cachedStatuses = null;
/**
 * Load conditions/diseases JSON file from public directory
 */ async function loadConditionsDiseasesFile() {
    const response = await fetch('/data/conditionsdiseases.json');
    if (!response.ok) {
        throw new Error(`Failed to load conditions/diseases data: ${response.statusText}`);
    }
    return response.json();
}
/**
 * Generate a unique ID for a condition/disease/status
 */ function generateId(name, source) {
    return `${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${source.toLowerCase()}`;
}
/**
 * Parse entries that can contain both strings and complex objects
 */ function parseEntries(entries) {
    const parseEntry = (entry)=>{
        if (typeof entry === 'string') {
            return entry;
        }
        if (!entry || typeof entry !== 'object') {
            return '';
        }
        try {
            // Handle different entry types
            if (entry.type === 'list' && entry.items) {
                const processedItems = entry.items.map((item)=>{
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
                            const entriesText = Array.isArray(item.entries) ? item.entries.map(parseEntry).filter(Boolean).join(' ') : String(item.entries);
                            return `**${item.name}**: ${entriesText}`;
                        }
                        if (item.entries) {
                            return Array.isArray(item.entries) ? item.entries.map(parseEntry).filter(Boolean).join(' ') : String(item.entries);
                        }
                        return item.entry || '';
                    }
                    // Handle other complex item types recursively
                    if (item.type && item.entries) {
                        return parseEntry(item);
                    }
                    // Handle any object with a name and some content
                    if (item.name) {
                        const content = item.entry || (item.entries ? Array.isArray(item.entries) ? item.entries.map(parseEntry).join(' ') : String(item.entries) : '');
                        return content ? `**${item.name}**: ${content}` : `**${item.name}**`;
                    }
                    // Try to extract any meaningful text
                    if (item.entry) {
                        return item.entry;
                    }
                    if (item.entries) {
                        return Array.isArray(item.entries) ? item.entries.map(parseEntry).filter(Boolean).join(' ') : String(item.entries);
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
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (error) {
            // Safety fallback for any parsing errors
            return '';
        }
    };
    return entries.map(parseEntry).filter(Boolean).join('\n\n');
}
/**
 * Process raw condition data into application format
 */ function processCondition(rawCondition) {
    const id = generateId(rawCondition.name, rawCondition.source);
    const description = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$textFormatting$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["processAndFormatDndText"])(parseEntries(rawCondition.entries));
    // Determine if this is exhaustion and if it's stackable
    const isExhaustion = rawCondition.name.toLowerCase() === 'exhaustion';
    const stackable = isExhaustion; // Exhaustion is the main stackable condition
    // Determine variant for conditions that have multiple versions
    let variant;
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
 */ function processDisease(rawDisease) {
    const id = generateId(rawDisease.name, rawDisease.source);
    const description = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$textFormatting$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["processAndFormatDndText"])(rawDisease.entries.join('\n\n'));
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
 */ function processStatus(rawStatus) {
    const id = generateId(rawStatus.name, rawStatus.source);
    const description = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$textFormatting$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["processAndFormatDndText"])(parseEntries(rawStatus.entries));
    return {
        id,
        name: rawStatus.name,
        source: rawStatus.source,
        description
    };
}
async function loadAllConditions() {
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
async function loadAllDiseases() {
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
async function loadAllStatuses() {
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
async function getExhaustionByVariant(variant) {
    const conditions = await loadAllConditions();
    return conditions.find((c)=>c.isExhaustion && c.variant === variant) || null;
}
async function searchConditions(query) {
    const conditions = await loadAllConditions();
    const lowerQuery = query.toLowerCase();
    return conditions.filter((condition)=>condition.name.toLowerCase().includes(lowerQuery) || condition.description.toLowerCase().includes(lowerQuery));
}
async function searchDiseases(query) {
    const diseases = await loadAllDiseases();
    const lowerQuery = query.toLowerCase();
    return diseases.filter((disease)=>disease.name.toLowerCase().includes(lowerQuery) || disease.description.toLowerCase().includes(lowerQuery));
}
}),
"[project]/apps/web/src/utils/diceUtils.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "autoClearDice",
    ()=>autoClearDice,
    "calculateRollSummary",
    ()=>calculateRollSummary,
    "formatDiceResults",
    ()=>formatDiceResults,
    "getRollResultColor",
    ()=>getRollResultColor,
    "hasCriticalFailure",
    ()=>hasCriticalFailure,
    "hasCriticalSuccess",
    ()=>hasCriticalSuccess,
    "parseDiceNotation",
    ()=>parseDiceNotation
]);
function parseDiceNotation(notation) {
    // Remove spaces
    const clean = notation.replace(/\s/g, '');
    // Match pattern like "3d12+5" or "1d20-2"
    const match = clean.match(/^(\d+)?d(\d+)([+-]\d+)?$/i);
    if (!match) {
        throw new Error(`Invalid dice notation: ${notation}`);
    }
    const count = parseInt(match[1] || '1', 10);
    const sides = parseInt(match[2], 10);
    const modifierStr = match[3] || '+0';
    const modifier = parseInt(modifierStr, 10);
    return {
        count,
        sides,
        modifier,
        originalNotation: notation
    };
}
function calculateRollSummary(diceResults, notation) {
    const parsed = parseDiceNotation(notation);
    const individualValues = diceResults.map((die)=>die.value);
    const diceTotal = individualValues.reduce((sum, value)=>sum + value, 0);
    const finalTotal = diceTotal + parsed.modifier;
    return {
        diceResults,
        individualValues,
        total: diceTotal,
        modifier: parsed.modifier,
        finalTotal,
        notation,
        rollTime: new Date(),
        rollId: generateRollId()
    };
}
/**
 * Generate a unique roll ID
 */ function generateRollId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
function formatDiceResults(summary) {
    const { individualValues, modifier, finalTotal, notation } = summary;
    const diceStr = individualValues.join(' + ');
    if (modifier === 0) {
        return `${notation}: [${diceStr}] = ${finalTotal}`;
    } else {
        const modStr = modifier > 0 ? `+${modifier}` : `${modifier}`;
        return `${notation}: [${diceStr}] ${modStr} = ${finalTotal}`;
    }
}
function hasCriticalSuccess(results) {
    return results.some((die)=>die.value === die.sides && die.sides === 20);
}
function hasCriticalFailure(results) {
    return results.some((die)=>die.value === 1 && die.sides === 20);
}
function getRollResultColor(summary) {
    if (hasCriticalSuccess(summary.diceResults)) {
        return 'text-green-600 font-bold'; // Critical success
    } else if (hasCriticalFailure(summary.diceResults)) {
        return 'text-red-600 font-bold'; // Critical failure
    } else {
        return 'text-gray-800'; // Normal roll
    }
}
function autoClearDice(diceBox, delay = 3000, onClear) {
    setTimeout(()=>{
        try {
            if (diceBox && typeof diceBox.clear === 'function') {
                diceBox.clear();
                if (onClear) {
                    onClear();
                }
            }
        } catch (error) {
            console.warn('Error during auto-clear dice:', error);
        }
    }, delay);
}
}),
"[project]/apps/web/src/utils/referenceParser.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "extractReferences",
    ()=>extractReferences,
    "formatSpellDescriptionForEditor",
    ()=>formatSpellDescriptionForEditor,
    "getFormattedHtml",
    ()=>getFormattedHtml,
    "getPlainText",
    ()=>getPlainText,
    "hasReferences",
    ()=>hasReferences,
    "parseReferences",
    ()=>parseReferences
]);
function parseReferences(content) {
    if (!content) {
        return {
            text: content,
            references: [],
            html: content
        };
    }
    const references = [];
    let parsedHtml = content;
    // Regex to match {@type content} patterns
    const referenceRegex = /\{@(\w+)\s+([^}]+)\}/g;
    let match;
    while((match = referenceRegex.exec(content)) !== null){
        const [fullMatch, type, content] = match;
        const parts = content.split('|');
        const name = parts[0]?.trim() || '';
        const source = parts[1]?.trim();
        const extra = parts.slice(2);
        const reference = {
            type: normalizeReferenceType(type),
            name,
            source,
            displayText: formatDisplayText(type, name, source, extra),
            properties: parseExtraProperties(extra),
            isReference: true
        };
        references.push(reference);
        // Replace in HTML with styled version
        parsedHtml = parsedHtml.replace(fullMatch, formatReferenceHtml(reference));
    }
    // Clean up any remaining malformed references
    parsedHtml = parsedHtml.replace(/\{@\w+[^}]*\}/g, (match)=>{
        // If we couldn't parse it properly, just remove the {@...} wrapper
        return match.replace(/\{@\w+\s*/, '').replace(/\}$/, '');
    });
    return {
        text: content,
        references,
        html: parsedHtml
    };
}
/**
 * Normalize reference types to known categories
 */ function normalizeReferenceType(type) {
    const typeMap = {
        item: 'item',
        spell: 'spell',
        filter: 'filter',
        dice: 'dice',
        creature: 'creature',
        condition: 'condition',
        action: 'action',
        skill: 'skill',
        sense: 'sense',
        damage: 'damage',
        scaledamage: 'scaledamage',
        atk: 'atk',
        atkr: 'atkr',
        hit: 'hit',
        h: 'h',
        dc: 'dc',
        actsave: 'actSave',
        actsavefail: 'actSaveFail',
        actsavesuccess: 'actSaveSuccess',
        acttrigger: 'actTrigger',
        actresponse: 'actResponse',
        hityourspellattack: 'hitYourSpellAttack'
    };
    return typeMap[type.toLowerCase()] || 'unknown';
}
/**
 * Parse scaled damage format: {@scaledamage baseDamage|levelRange|additionalPerLevel}
 * Example: {@scaledamage 8d6|3-9|1d6} -> "8d6 (+ 1d6 per level above 3rd)"
 */ function parseScaledDamage(baseDamage, levelRange, extra) {
    if (!levelRange || !extra || extra.length === 0) {
        return baseDamage; // Fallback to base damage if parsing fails
    }
    const additionalPerLevel = extra[0];
    const levelParts = levelRange.split('-');
    const startLevel = levelParts[0];
    if (!startLevel || !additionalPerLevel) {
        return baseDamage;
    }
    // Format the level suffix (1st, 2nd, 3rd, 4th, etc.)
    const levelSuffix = getLevelSuffix(parseInt(startLevel));
    return `${baseDamage} (+ ${additionalPerLevel} per level above ${levelSuffix})`;
}
/**
 * Get the ordinal suffix for a level number
 */ function getLevelSuffix(level) {
    if (level >= 11 && level <= 13) {
        return `${level}th`;
    }
    const lastDigit = level % 10;
    switch(lastDigit){
        case 1:
            return `${level}st`;
        case 2:
            return `${level}nd`;
        case 3:
            return `${level}rd`;
        default:
            return `${level}th`;
    }
}
/**
 * Format display text based on reference type and content
 */ function formatDisplayText(type, name, source, extra) {
    switch(type.toLowerCase()){
        case 'item':
            return name;
        case 'filter':
            return name;
        case 'spell':
            return name;
        case 'dice':
            return name;
        case 'creature':
            return name;
        case 'condition':
            return name;
        case 'action':
            return name;
        case 'skill':
            return name;
        case 'sense':
            return name;
        case 'damage':
            return name;
        case 'scaledamage':
            return parseScaledDamage(name, source, extra);
        case 'atk':
            // Handle attack types like "mw" (melee weapon), "rw" (ranged weapon)
            switch(name.toLowerCase()){
                case 'm':
                case 'mw':
                    return 'Melee Weapon Attack:';
                case 'r':
                case 'rw':
                    return 'Ranged Weapon Attack:';
                case 'ms':
                    return 'Melee Spell Attack:';
                case 'rs':
                    return 'Ranged Spell Attack:';
                default:
                    return `${name} Attack:`;
            }
        case 'atkr':
            // Handle ranged attack types
            switch(name.toLowerCase()){
                case 'm':
                    return 'Melee Attack:';
                case 'r':
                    return 'Ranged Attack:';
                default:
                    return `${name} Attack:`;
            }
        case 'hit':
            return `+${name}`;
        case 'h':
            return `Hit: ${name}`;
        case 'dc':
            return `DC ${name}`;
        case 'actsave':
            return `${name.toUpperCase()} save`;
        case 'actsavefail':
            return 'On a failed save:';
        case 'actsavesuccess':
            return 'On a successful save:';
        case 'acttrigger':
            return `Trigger: ${name}`;
        case 'actresponse':
            return `Response: ${name}`;
        case 'hityourspellattack':
            return name; // This typically contains the full text like "Bonus equals your spell attack modifier"
        default:
            return name;
    }
}
/**
 * Parse extra properties from reference parts
 */ function parseExtraProperties(extra) {
    const properties = {};
    extra.forEach((prop, index)=>{
        if (prop.includes('=')) {
            const [key, value] = prop.split('=', 2);
            properties[key.trim()] = value.trim();
        } else {
            properties[`extra_${index}`] = prop.trim();
        }
    });
    return properties;
}
/**
 * Format reference as HTML with appropriate styling
 */ function formatReferenceHtml(reference) {
    const baseClasses = 'inline-flex items-center gap-1 px-2 py-1 rounded text-sm font-medium transition-colors';
    let typeClasses = '';
    let icon = '';
    switch(reference.type){
        case 'item':
            typeClasses = 'bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20';
            icon = '⚔️';
            break;
        case 'spell':
            typeClasses = 'bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20';
            icon = '✨';
            break;
        case 'filter':
            typeClasses = 'bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20';
            icon = '🔍';
            break;
        case 'dice':
            typeClasses = 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20';
            icon = '🎲';
            break;
        case 'creature':
            typeClasses = 'bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20';
            icon = '🐉';
            break;
        case 'condition':
            typeClasses = 'bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20';
            icon = '💫';
            break;
        case 'action':
            typeClasses = 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20';
            icon = '⚡';
            break;
        case 'skill':
            typeClasses = 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20';
            icon = '🎯';
            break;
        case 'sense':
            typeClasses = 'bg-pink-500/10 text-pink-400 border border-pink-500/20 hover:bg-pink-500/20';
            icon = '👁️';
            break;
        case 'damage':
            typeClasses = 'bg-red-600/10 text-red-400 border border-red-600/20 hover:bg-red-600/20';
            icon = '💥';
            break;
        case 'scaledamage':
            typeClasses = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20';
            icon = '📈';
            break;
        case 'atk':
            typeClasses = 'bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20';
            icon = '⚔️';
            break;
        case 'atkr':
            typeClasses = 'bg-violet-600/10 text-violet-400 border border-violet-600/20 hover:bg-violet-600/20';
            icon = '🏹';
            break;
        case 'hit':
            typeClasses = 'bg-emerald-600/10 text-emerald-400 border border-emerald-600/20 hover:bg-emerald-600/20';
            icon = '🎯';
            break;
        case 'h':
            typeClasses = 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20';
            icon = '💥';
            break;
        case 'dc':
            typeClasses = 'bg-blue-600/10 text-blue-400 border border-blue-600/20 hover:bg-blue-600/20';
            icon = '🔢';
            break;
        case 'actSave':
            typeClasses = 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 hover:bg-yellow-500/20';
            icon = '🛡️';
            break;
        case 'actSaveFail':
            typeClasses = 'bg-red-700/10 text-red-400 border border-red-700/20 hover:bg-red-700/20';
            icon = '❌';
            break;
        case 'actSaveSuccess':
            typeClasses = 'bg-green-600/10 text-green-400 border border-green-600/20 hover:bg-green-600/20';
            icon = '✅';
            break;
        case 'actTrigger':
            typeClasses = 'bg-orange-600/10 text-orange-400 border border-orange-600/20 hover:bg-orange-600/20';
            icon = '⚡';
            break;
        case 'actResponse':
            typeClasses = 'bg-indigo-600/10 text-indigo-400 border border-indigo-600/20 hover:bg-indigo-600/20';
            icon = '↩️';
            break;
        case 'hitYourSpellAttack':
            typeClasses = 'bg-purple-600/10 text-purple-400 border border-purple-600/20 hover:bg-purple-600/20';
            icon = '✨';
            break;
        default:
            typeClasses = 'bg-slate-500/10 text-slate-400 border border-slate-500/20 hover:bg-slate-500/20';
            icon = '❓';
    }
    const title = reference.source ? `${reference.displayText} (${reference.source})` : reference.displayText;
    return `<span class="${baseClasses} ${typeClasses}" title="${title}">${icon} ${reference.displayText}</span>`;
}
function getPlainText(content) {
    return parseReferences(content).html.replace(/<[^>]*>/g, '');
}
function extractReferences(content) {
    return parseReferences(content).references;
}
function hasReferences(content) {
    return /\{@\w+\s+[^}]+\}/.test(content);
}
function getFormattedHtml(content) {
    return parseReferences(content).html;
}
/**
 * Format reference as bold HTML for WYSIWYG editor
 * Used in spell edit modal to make important references stand out
 */ function formatReferenceForEditor(reference) {
    // For most references, just bold the display text
    return `<strong>${reference.displayText}</strong>`;
}
function formatSpellDescriptionForEditor(content) {
    if (!content) {
        return '';
    }
    let formattedHtml = content;
    // Regex to match {@type content} patterns
    const referenceRegex = /\{@(\w+)\s+([^}]+)\}/g;
    let match;
    const replacements = [];
    while((match = referenceRegex.exec(content)) !== null){
        const [fullMatch, type, content] = match;
        const parts = content.split('|');
        const name = parts[0]?.trim() || '';
        const source = parts[1]?.trim();
        const extra = parts.slice(2);
        const reference = {
            type: normalizeReferenceType(type),
            name,
            source,
            displayText: formatDisplayText(type, name, source, extra),
            properties: parseExtraProperties(extra),
            isReference: true
        };
        // Replace with bold HTML for editor
        replacements.push({
            from: fullMatch,
            to: formatReferenceForEditor(reference)
        });
    }
    // Apply all replacements
    replacements.forEach(({ from, to })=>{
        formattedHtml = formattedHtml.replace(from, to);
    });
    // Clean up any remaining malformed references
    formattedHtml = formattedHtml.replace(/\{@\w+[^}]*\}/g, (match)=>{
        // If we couldn't parse it properly, just remove the {@...} wrapper
        return match.replace(/\{@\w+\s*/, '').replace(/\}$/, '');
    });
    // Convert newlines to proper paragraph breaks for the editor
    // Split by double newlines (paragraph breaks)
    const paragraphs = formattedHtml.split('\n\n');
    // Wrap each paragraph in <p> tags if not already wrapped
    const wrappedParagraphs = paragraphs.map((para)=>{
        const trimmed = para.trim();
        if (!trimmed) return '';
        // If it already starts with an HTML tag, leave it as is
        if (trimmed.startsWith('<')) return trimmed;
        // Otherwise wrap in <p> tags
        return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
    }).filter(Boolean);
    return wrappedParagraphs.join('');
}
}),
"[project]/apps/web/src/utils/featureConversion.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Feature Conversion Utilities
 * Converts ProcessedBackgroundFeature, ProcessedFeat, and ClassFeature
 * to ExtendedFeature format for character sheet
 */ __turbopack_context__.s([
    "convertBackgroundFeatureToExtendedFeature",
    ()=>convertBackgroundFeatureToExtendedFeature,
    "convertClassFeatureToExtendedFeature",
    ()=>convertClassFeatureToExtendedFeature,
    "convertFeatToExtendedFeature",
    ()=>convertFeatToExtendedFeature,
    "partialFeatureToFormData",
    ()=>partialFeatureToFormData
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$referenceParser$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/utils/referenceParser.ts [app-ssr] (ecmascript)");
;
/**
 * Try to detect if a feature has limited uses from its description
 */ function parseUsesFromDescription(description) {
    const desc = description.toLowerCase();
    // Check for short rest recharge
    if (desc.includes('short rest') || desc.includes('short or long rest')) {
        // Try to find number of uses
        const usesMatch = desc.match(/(\d+)\s+(?:time|use)s?/i);
        if (usesMatch) {
            return {
                maxUses: parseInt(usesMatch[1]),
                restType: 'short'
            };
        }
        return {
            maxUses: 1,
            restType: 'short'
        };
    }
    // Check for long rest recharge
    if (desc.includes('long rest') || desc.includes('finish a rest')) {
        const usesMatch = desc.match(/(\d+)\s+(?:time|use)s?/i);
        if (usesMatch) {
            return {
                maxUses: parseInt(usesMatch[1]),
                restType: 'long'
            };
        }
        return {
            maxUses: 1,
            restType: 'long'
        };
    }
    // Check for once per day
    if (desc.includes('once per day') || desc.includes('once a day')) {
        return {
            maxUses: 1,
            restType: 'long'
        };
    }
    // Check for proficiency bonus times per day/rest
    if (desc.includes('proficiency bonus') && (desc.includes('per day') || desc.includes('per long rest'))) {
        return {
            maxUses: 0,
            restType: 'long'
        };
    }
    return null;
}
/**
 * Detect if feature scales with proficiency bonus
 */ function detectProficiencyScaling(description) {
    const desc = description.toLowerCase();
    if (desc.includes('proficiency bonus') && (desc.includes('equal to') || desc.includes('number of times'))) {
        // Check for multipliers like "twice your proficiency bonus"
        if (desc.includes('twice') || desc.includes('two times') || desc.includes('2 ×')) {
            return {
                scales: true,
                multiplier: 2
            };
        }
        return {
            scales: true,
            multiplier: 1
        };
    }
    return {
        scales: false,
        multiplier: 1
    };
}
function convertBackgroundFeatureToExtendedFeature(feature) {
    const formattedDescription = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$referenceParser$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["formatSpellDescriptionForEditor"])(feature.description);
    const usageInfo = parseUsesFromDescription(feature.description);
    return {
        name: feature.name,
        description: formattedDescription,
        sourceType: 'background',
        sourceDetail: feature.backgroundName,
        category: 'Background Feature',
        maxUses: usageInfo?.maxUses || 0,
        restType: usageInfo?.restType || 'long',
        isPassive: !usageInfo,
        scaleWithProficiency: false,
        proficiencyMultiplier: 1
    };
}
function convertFeatToExtendedFeature(feat) {
    const formattedDescription = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$referenceParser$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["formatSpellDescriptionForEditor"])(feat.description);
    const usageInfo = parseUsesFromDescription(feat.description);
    const scalingInfo = detectProficiencyScaling(feat.description);
    // Build source detail string
    let sourceDetail = feat.source;
    if (feat.prerequisites.length > 0) {
        sourceDetail += ` (Requires: ${feat.prerequisites.join(', ')})`;
    }
    if (feat.abilityIncreases) {
        sourceDetail += ` [${feat.abilityIncreases}]`;
    }
    return {
        name: feat.name,
        description: formattedDescription,
        sourceType: 'feat',
        sourceDetail,
        category: feat.grantsSpells ? 'Spellcasting Feat' : 'General Feat',
        maxUses: usageInfo?.maxUses || 0,
        restType: usageInfo?.restType || 'long',
        isPassive: !usageInfo,
        scaleWithProficiency: scalingInfo.scales,
        proficiencyMultiplier: scalingInfo.multiplier
    };
}
function convertClassFeatureToExtendedFeature(feature) {
    const description = feature.entries?.join('\n\n') || '';
    const formattedDescription = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$referenceParser$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["formatSpellDescriptionForEditor"])(description);
    const usageInfo = parseUsesFromDescription(description);
    const scalingInfo = detectProficiencyScaling(description);
    // Build source detail
    const sourceDetail = feature.isSubclassFeature && feature.subclassShortName ? `${feature.subclassShortName} Level ${feature.level}` : `${feature.className} Level ${feature.level}`;
    return {
        name: feature.name,
        description: formattedDescription,
        sourceType: 'class',
        sourceDetail,
        category: feature.isSubclassFeature ? 'Subclass Feature' : 'Class Feature',
        maxUses: usageInfo?.maxUses || 0,
        restType: usageInfo?.restType || 'long',
        isPassive: !usageInfo,
        scaleWithProficiency: scalingInfo.scales,
        proficiencyMultiplier: scalingInfo.multiplier
    };
}
function partialFeatureToFormData(partial) {
    return {
        name: partial.name || '',
        description: partial.description || '',
        sourceType: partial.sourceType || 'other',
        sourceDetail: partial.sourceDetail || '',
        category: partial.category || '',
        maxUses: partial.maxUses || 0,
        restType: partial.restType || 'long',
        isPassive: partial.isPassive ?? true,
        scaleWithProficiency: partial.scaleWithProficiency ?? false,
        proficiencyMultiplier: partial.proficiencyMultiplier || 1
    };
}
}),
"[project]/apps/web/src/utils/spellConversion.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Spell Conversion Utility
 * Converts ProcessedSpell (spellbook) to character Spell format
 */ __turbopack_context__.s([
    "convertFormDataToSpell",
    ()=>convertFormDataToSpell,
    "convertProcessedSpellToFormData",
    ()=>convertProcessedSpellToFormData,
    "searchSpells",
    ()=>searchSpells
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$referenceParser$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/utils/referenceParser.ts [app-ssr] (ecmascript)");
;
/**
 * Extract damage dice from description tags like {@damage 1d8} or {@dice 1d6}
 */ function extractDamageDice(description) {
    // Match {@damage XdY} or {@dice XdY} patterns
    const damagePattern = /\{@(?:damage|dice)\s+(\d+d\d+(?:\s*\+\s*\d+)?)\}/i;
    const match = description.match(damagePattern);
    if (match && match[1]) {
        return match[1].trim();
    }
    // Also try to find standalone dice notation (e.g., "takes 3d6 fire damage")
    const standaloneDicePattern = /(?:takes|deals?)\s+(\d+d\d+(?:\s*\+\s*\d+)?)\s+(?:damage|fire|cold|lightning|thunder|acid|poison|necrotic|radiant|psychic|force)/i;
    const standaloneMatch = description.match(standaloneDicePattern);
    if (standaloneMatch && standaloneMatch[1]) {
        return standaloneMatch[1].trim();
    }
    return '';
}
/**
 * Normalize casting time to match character sheet format
 */ function normalizeCastingTime(castingTime) {
    // Handle common formatting differences
    const normalized = castingTime.toLowerCase().trim();
    // Convert "1 bonus" to "1 bonus action"
    if (normalized === '1 bonus') {
        return '1 bonus action';
    }
    // Convert "1 reaction" to match (already correct, but ensure consistency)
    if (normalized.match(/^1 reaction/)) {
        return '1 reaction';
    }
    // Convert "N actions" to "1 action" (most common)
    if (normalized.match(/^\d+ action$/)) {
        return castingTime.replace(/(\d+) action$/, '$1 action');
    }
    // Return as-is if already in correct format
    return castingTime;
}
/**
 * Infer action type from spell metadata
 */ function inferActionType(spell) {
    // If spell has saving throws, it's likely a save spell
    if (spell.saves && spell.saves.length > 0) {
        return 'save';
    }
    // Check tags for attack-related indicators
    const attackTags = [
        'attack',
        'spell attack',
        'ranged spell attack',
        'melee spell attack'
    ];
    const hasAttackTag = spell.tags?.some((tag)=>attackTags.some((attackTag)=>tag.toLowerCase().includes(attackTag)));
    if (hasAttackTag) {
        return 'attack';
    }
    // Check description for attack keywords
    const descriptionLower = spell.description.toLowerCase();
    if (descriptionLower.includes('spell attack') || descriptionLower.includes('attack roll')) {
        return 'attack';
    }
    // Check description for saving throw keywords
    if (descriptionLower.includes('saving throw') || descriptionLower.includes('must succeed')) {
        return 'save';
    }
    // Default to utility if no clear indicators
    return 'utility';
}
function convertProcessedSpellToFormData(spell) {
    const actionType = inferActionType(spell);
    // Extract damage dice from description (still parse this as it's not in JSON)
    const extractedDamage = extractDamageDice(spell.description);
    // Get damage type from spell metadata (damageInflict property) - more reliable!
    const damageType = spell.damage?.[0] || '';
    // Get saving throw from spell metadata - more reliable!
    const savingThrow = spell.saves?.[0] || '';
    // Capitalize first letter of saving throw if it exists
    const formattedSavingThrow = savingThrow ? savingThrow.charAt(0).toUpperCase() + savingThrow.slice(1) : '';
    // Format descriptions for WYSIWYG editor with bold references
    const formattedDescription = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$referenceParser$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["formatSpellDescriptionForEditor"])(spell.description);
    const formattedHigherLevel = spell.higherLevelDescription ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$referenceParser$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["formatSpellDescriptionForEditor"])(spell.higherLevelDescription) : '';
    return {
        name: spell.name,
        level: spell.level,
        school: spell.schoolName,
        castingTime: normalizeCastingTime(spell.castingTime),
        range: spell.range,
        components: {
            verbal: spell.components.verbal,
            somatic: spell.components.somatic,
            material: spell.components.material,
            materialDescription: spell.components.materialComponent || ''
        },
        duration: spell.duration,
        description: formattedDescription,
        higherLevel: formattedHigherLevel,
        ritual: spell.isRitual,
        concentration: spell.concentration,
        isPrepared: false,
        isAlwaysPrepared: false,
        actionType: actionType,
        savingThrow: formattedSavingThrow,
        damage: extractedDamage,
        damageType: damageType,
        source: spell.source
    };
}
function convertFormDataToSpell(formData, existingId) {
    const now = new Date().toISOString();
    return {
        id: existingId || `spell_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: formData.name,
        level: formData.level,
        school: formData.school,
        castingTime: formData.castingTime,
        range: formData.range,
        components: {
            verbal: formData.components.verbal,
            somatic: formData.components.somatic,
            material: formData.components.material,
            materialDescription: formData.components.materialDescription || undefined
        },
        duration: formData.duration,
        description: formData.description,
        higherLevel: formData.higherLevel || undefined,
        ritual: formData.ritual || undefined,
        concentration: formData.concentration || undefined,
        isPrepared: formData.isPrepared || undefined,
        isAlwaysPrepared: formData.isAlwaysPrepared || undefined,
        actionType: formData.actionType || undefined,
        savingThrow: formData.savingThrow || undefined,
        damage: formData.damage || undefined,
        damageType: formData.damageType || undefined,
        source: formData.source || undefined,
        createdAt: now,
        updatedAt: now
    };
}
function searchSpells(spells, query) {
    if (!query.trim()) {
        return spells;
    }
    const queryLower = query.toLowerCase().trim();
    return spells.filter((spell)=>{
        const nameLower = spell.name.toLowerCase();
        const schoolLower = spell.schoolName.toLowerCase();
        const descriptionLower = spell.description.toLowerCase();
        return nameLower.includes(queryLower) || schoolLower.includes(queryLower) || descriptionLower.includes(queryLower) || spell.tags?.some((tag)=>tag.toLowerCase().includes(queryLower));
    }).sort((a, b)=>{
        // Sort by relevance: exact match first, then starts with, then contains
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        const aExact = aName === queryLower;
        const bExact = bName === queryLower;
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        const aStarts = aName.startsWith(queryLower);
        const bStarts = bName.startsWith(queryLower);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        // Then sort alphabetically
        return aName.localeCompare(bName);
    });
}
}),
];

//# sourceMappingURL=apps_web_src_utils_08492986._.js.map