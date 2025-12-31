(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/apps/web/src/store/playerStore.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>__TURBOPACK__default__export__,
    "usePlayerStore",
    ()=>usePlayerStore
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/zustand/esm/react.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zustand$2f$esm$2f$middleware$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/zustand/esm/middleware.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/utils/constants.ts [app-client] (ecmascript)");
;
;
;
// Storage configuration
const PLAYER_STORAGE_KEY = 'rollkeeper-player-data';
const DEFAULT_PLAYER_SETTINGS = {
    enableDeathAnimation: false,
    enableLevelUpAnimation: false
};
// Utility functions
const generateId = ()=>{
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
};
const createPlayerCharacter = (name, characterData)=>{
    var _characterData_class;
    const now = new Date();
    const playerId = generateId();
    // Ensure characterData has the same ID as the PlayerCharacter
    const characterDataWithId = {
        ...characterData,
        id: playerId
    };
    return {
        id: playerId,
        name,
        race: characterData.race || 'Human',
        class: ((_characterData_class = characterData.class) === null || _characterData_class === void 0 ? void 0 : _characterData_class.name) || 'Fighter',
        level: characterData.level || 1,
        createdAt: now,
        updatedAt: now,
        lastPlayed: now,
        characterData: characterDataWithId,
        avatar: characterData.avatar,
        tags: [],
        isArchived: false
    };
};
// Migration function
const migrateOldCharacterData = ()=>{
    try {
        // Check for old character data
        const oldCharacterData = localStorage.getItem(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORAGE_KEY"]);
        console.log('Checking for old character data with key:', __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORAGE_KEY"]);
        console.log('Found old character data:', oldCharacterData ? 'YES' : 'NO');
        if (!oldCharacterData) {
            // Also check for any other rollkeeper keys
            const allKeys = Object.keys(localStorage);
            const rollkeeperKeys = allKeys.filter((key)=>key.includes('rollkeeper'));
            console.log('All rollkeeper keys in localStorage:', rollkeeperKeys);
            return null;
        }
        const parsedData = JSON.parse(oldCharacterData);
        console.log('Parsed old character data structure:', Object.keys(parsedData));
        // Handle different data structures
        let characterState;
        if (parsedData.state) {
            // Zustand persist format
            characterState = parsedData.state;
            console.log('Using Zustand persist format');
        } else if (parsedData.character) {
            // Direct character format
            characterState = parsedData.character;
            console.log('Using direct character format');
        } else if (parsedData.characterName || parsedData.race || parsedData.classInfo) {
            // Direct character state
            characterState = parsedData;
            console.log('Using direct character state format');
        } else {
            console.log('Unrecognized old character data format');
            return null;
        }
        // Create new character from old data
        const characterName = characterState.name || 'Migrated Character';
        const playerCharacter = createPlayerCharacter(characterName, characterState);
        // Mark as migrated
        playerCharacter.tags = [
            'migrated'
        ];
        console.log('Successfully migrated character:', characterName);
        return playerCharacter;
    } catch (error) {
        console.error('Failed to migrate old character data:', error);
        console.error('Error details:', error);
        return null;
    }
};
const usePlayerStore = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["create"])()((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zustand$2f$esm$2f$middleware$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["persist"])((set, get)=>({
        // Initial state
        characters: [],
        activeCharacterId: null,
        settings: {
            ...DEFAULT_PLAYER_SETTINGS
        },
        lastSelectedCharacterId: null,
        // Computed getters
        getActiveCharacter: ()=>{
            const { characters, activeCharacterId } = get();
            return activeCharacterId ? characters.find((c)=>c.id === activeCharacterId) || null : null;
        },
        getCharacterById: (id)=>{
            const character = get().characters.find((c)=>c.id === id) || null;
            // Ensure characterData has the correct ID (migration for existing characters)
            if (character && !character.characterData.id) {
                character.characterData.id = character.id;
            }
            return character;
        },
        getActiveCharacters: ()=>{
            return get().characters.filter((c)=>!c.isArchived);
        },
        getArchivedCharacters: ()=>{
            return get().characters.filter((c)=>c.isArchived);
        },
        // Character management
        createCharacter: function(name) {
            let partialCharacterData = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
            const characterData = {
                ...__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_CHARACTER_STATE"],
                ...partialCharacterData,
                name: name,
                id: generateId()
            };
            const playerCharacter = createPlayerCharacter(name, characterData);
            set((state)=>({
                    characters: [
                        ...state.characters,
                        playerCharacter
                    ],
                    activeCharacterId: playerCharacter.id,
                    lastSelectedCharacterId: playerCharacter.id
                }));
            return playerCharacter.id;
        },
        updateCharacter: (characterId, updates)=>{
            set((state)=>({
                    characters: state.characters.map((char)=>char.id === characterId ? {
                            ...char,
                            ...updates,
                            updatedAt: new Date(),
                            lastPlayed: char.id === state.activeCharacterId ? new Date() : char.lastPlayed
                        } : char)
                }));
        },
        updateCharacterData: (characterId, characterData)=>{
            set((state)=>({
                    characters: state.characters.map((char)=>{
                        var _characterData_class;
                        return char.id === characterId ? {
                            ...char,
                            characterData,
                            name: characterData.name || char.name,
                            race: characterData.race || char.race,
                            class: ((_characterData_class = characterData.class) === null || _characterData_class === void 0 ? void 0 : _characterData_class.name) || char.class,
                            level: characterData.totalLevel || characterData.level || char.level,
                            avatar: characterData.avatar,
                            updatedAt: new Date(),
                            lastPlayed: new Date()
                        } : char;
                    })
                }));
        },
        deleteCharacter: (characterId)=>{
            set((state)=>({
                    characters: state.characters.filter((c)=>c.id !== characterId),
                    activeCharacterId: state.activeCharacterId === characterId ? null : state.activeCharacterId,
                    lastSelectedCharacterId: state.lastSelectedCharacterId === characterId ? null : state.lastSelectedCharacterId
                }));
        },
        archiveCharacter: (characterId)=>{
            set((state)=>({
                    characters: state.characters.map((char)=>char.id === characterId ? {
                            ...char,
                            isArchived: true,
                            updatedAt: new Date()
                        } : char),
                    activeCharacterId: state.activeCharacterId === characterId ? null : state.activeCharacterId
                }));
        },
        restoreCharacter: (characterId)=>{
            set((state)=>({
                    characters: state.characters.map((char)=>char.id === characterId ? {
                            ...char,
                            isArchived: false,
                            updatedAt: new Date()
                        } : char)
                }));
        },
        duplicateCharacter: (characterId, newName)=>{
            const originalCharacter = get().getCharacterById(characterId);
            if (!originalCharacter) return '';
            const duplicatedCharacterData = {
                ...originalCharacter.characterData,
                id: generateId(),
                name: newName
            };
            const newPlayerCharacter = createPlayerCharacter(newName, duplicatedCharacterData);
            newPlayerCharacter.tags = [
                ...originalCharacter.tags,
                'duplicate'
            ];
            set((state)=>({
                    characters: [
                        ...state.characters,
                        newPlayerCharacter
                    ]
                }));
            return newPlayerCharacter.id;
        },
        // Character selection
        setActiveCharacter: (characterId)=>{
            // Update last played time when setting active
            if (characterId) {
                get().updateCharacter(characterId, {
                    lastPlayed: new Date()
                });
            }
            set({
                activeCharacterId: characterId,
                lastSelectedCharacterId: characterId || get().lastSelectedCharacterId
            });
        },
        // Migration and utility
        migrateFromOldStorage: ()=>{
            const migratedCharacter = migrateOldCharacterData();
            if (!migratedCharacter) return false;
            set((state)=>({
                    characters: [
                        ...state.characters,
                        migratedCharacter
                    ],
                    activeCharacterId: migratedCharacter.id,
                    lastSelectedCharacterId: migratedCharacter.id
                }));
            // Clean up old storage after successful migration
            try {
                localStorage.removeItem(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORAGE_KEY"]);
                console.log('Cleaned up old character storage');
            } catch (error) {
                console.warn('Failed to clean up old storage:', error);
            }
            return true;
        },
        exportCharacter: (characterId)=>{
            return get().getCharacterById(characterId);
        },
        importCharacter: (data, name)=>{
            let characterState;
            let playerCharacter;
            // Determine if it's CharacterExport or CharacterState
            if ('character' in data && 'version' in data) {
                // It's a CharacterExport
                characterState = data.character;
            } else if ('characterData' in data) {
                // It's already a PlayerCharacter - extract characterData and rebuild
                const existingPC = data;
                const characterName = name || existingPC.name || 'Imported Character';
                playerCharacter = createPlayerCharacter(characterName, existingPC.characterData);
                playerCharacter.tags = existingPC.tags || [
                    'imported'
                ];
                playerCharacter.isArchived = existingPC.isArchived || false;
            } else {
                // It's raw CharacterState
                characterState = data;
            }
            // Create PlayerCharacter from CharacterState if needed
            if (!playerCharacter) {
                const characterName = name || characterState.name || 'Imported Character';
                playerCharacter = createPlayerCharacter(characterName, characterState);
                playerCharacter.tags = [
                    'imported'
                ];
            }
            set((state)=>({
                    characters: [
                        ...state.characters,
                        playerCharacter
                    ]
                }));
            return playerCharacter.id;
        },
        // Settings management
        updateSettings: (updates)=>{
            set((state)=>({
                    settings: {
                        ...state.settings,
                        ...updates
                    }
                }));
        },
        resetSettings: ()=>{
            set({
                settings: {
                    ...DEFAULT_PLAYER_SETTINGS
                }
            });
        },
        resetStore: ()=>{
            set({
                characters: [],
                activeCharacterId: null,
                settings: {
                    ...DEFAULT_PLAYER_SETTINGS
                },
                lastSelectedCharacterId: null
            });
        }
    }), {
    name: PLAYER_STORAGE_KEY,
    storage: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zustand$2f$esm$2f$middleware$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createJSONStorage"])(()=>localStorage),
    version: 1,
    // Migration function for future versions
    migrate: (persistedState)=>{
        // Handle data migrations here when we update the schema
        return persistedState;
    },
    onRehydrateStorage: ()=>{
        return (state)=>{
            // Auto-migrate on store initialization if needed
            if (state && state.characters.length === 0) {
                const migrated = state.migrateFromOldStorage();
                if (migrated) {
                    console.log('Auto-migrated character from old storage on initialization');
                }
            }
        };
    }
}));
const __TURBOPACK__default__export__ = usePlayerStore;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/apps/web/src/store/characterStore.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useCharacterStore",
    ()=>useCharacterStore
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/zustand/esm/react.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zustand$2f$esm$2f$middleware$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/zustand/esm/middleware.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/utils/constants.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$calculations$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/utils/calculations.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$multiclass$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/utils/multiclass.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$hpCalculations$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/utils/hpCalculations.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$store$2f$playerStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/store/playerStore.ts [app-client] (ecmascript)");
;
;
;
;
;
;
;
// Function to migrate weapon damage from old format to new array format
function migrateWeaponDamage(weapon) {
    // If the weapon already has the new damage array format, return as-is
    if (Array.isArray(weapon.damage)) {
        return weapon;
    }
    // If the weapon has the old damage object format, convert it
    const damage = weapon.damage;
    if (damage && typeof damage === 'object' && typeof damage.dice === 'string' && typeof damage.type === 'string') {
        const newDamage = {
            dice: damage.dice,
            type: damage.type,
            versatiledice: damage.versatiledice,
            label: 'Weapon Damage'
        };
        return {
            ...weapon,
            damage: [
                newDamage
            ],
            legacyDamage: damage
        };
    }
    // If no damage is defined, create a default empty array
    return {
        ...weapon,
        damage: []
    };
}
// Migration function to handle old character data
function migrateCharacterData(character) {
    // Type guard to check if character is an object
    if (!character || typeof character !== 'object') {
        return {
            ...__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_CHARACTER_STATE"],
            id: generateId()
        };
    }
    const characterObj = character;
    // If it's already a new character with class object, return as-is
    if (characterObj.class && typeof characterObj.class === 'object') {
        const result = character;
        // Ensure spellSlots exist
        if (!result.spellSlots) {
            result.spellSlots = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_CHARACTER_STATE"].spellSlots;
        }
        // Ensure features and traits are arrays
        if (!Array.isArray(result.features)) {
            result.features = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_CHARACTER_STATE"].features;
        }
        if (!Array.isArray(result.traits)) {
            result.traits = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_CHARACTER_STATE"].traits;
        }
        if (!Array.isArray(result.notes)) {
            result.notes = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_CHARACTER_STATE"].notes;
        }
        // Ensure characterBackground exists
        if (!result.characterBackground || typeof result.characterBackground !== 'object' || !('backstory' in result.characterBackground)) {
            result.characterBackground = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_CHARACTER_STATE"].characterBackground;
        }
        // Ensure weapons array exists
        if (!Array.isArray(result.weapons)) {
            result.weapons = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_CHARACTER_STATE"].weapons;
        }
        // Ensure weapon proficiencies exist
        if (!result.weaponProficiencies || typeof result.weaponProficiencies !== 'object') {
            result.weaponProficiencies = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_CHARACTER_STATE"].weaponProficiencies;
        }
        // Ensure spells array exists
        if (!Array.isArray(result.spells)) {
            result.spells = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_CHARACTER_STATE"].spells;
        }
        // Ensure spellcasting stats exist
        if (!result.spellcastingStats || typeof result.spellcastingStats !== 'object') {
            result.spellcastingStats = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_CHARACTER_STATE"].spellcastingStats;
        }
        // Ensure class has hitDie
        if (result.class && typeof result.class === 'object' && !('hitDie' in result.class)) {
            result.class.hitDie = 8; // Default to d8
        }
        // Ensure hitPoints has new properties
        if (result.hitPoints && typeof result.hitPoints === 'object') {
            if (!('calculationMode' in result.hitPoints)) {
                result.hitPoints.calculationMode = 'auto';
            }
        }
        // Ensure reaction tracking exists
        if (!result.reaction || typeof result.reaction !== 'object') {
            result.reaction = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_CHARACTER_STATE"].reaction;
        }
        // Ensure heroic inspiration exists
        if (!result.heroicInspiration || typeof result.heroicInspiration !== 'object') {
            result.heroicInspiration = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_CHARACTER_STATE"].heroicInspiration;
        }
        // Ensure temporary AC field exists
        if (typeof result.tempArmorClass !== 'number') {
            result.tempArmorClass = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_CHARACTER_STATE"].tempArmorClass;
        }
        // Ensure shield status exists
        if (typeof result.isWearingShield !== 'boolean') {
            result.isWearingShield = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_CHARACTER_STATE"].isWearingShield;
        }
        // Ensure shield bonus exists
        if (typeof result.shieldBonus !== 'number') {
            result.shieldBonus = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_CHARACTER_STATE"].shieldBonus;
        }
        // Ensure magic items exist
        if (!Array.isArray(result.magicItems)) {
            result.magicItems = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_CHARACTER_STATE"].magicItems;
        }
        // Ensure attunement slots exist
        if (!result.attunementSlots || typeof result.attunementSlots !== 'object') {
            result.attunementSlots = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_CHARACTER_STATE"].attunementSlots;
        }
        // Ensure armor items exist
        if (!Array.isArray(result.armorItems)) {
            result.armorItems = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_CHARACTER_STATE"].armorItems;
        }
        // Ensure inventory items exist
        if (!Array.isArray(result.inventoryItems)) {
            result.inventoryItems = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_CHARACTER_STATE"].inventoryItems;
        }
        // Ensure currency exists
        if (!result.currency || typeof result.currency !== 'object') {
            result.currency = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_CHARACTER_STATE"].currency;
        }
        // Ensure spellbook exists
        if (!result.spellbook || typeof result.spellbook !== 'object') {
            result.spellbook = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_CHARACTER_STATE"].spellbook;
        }
        // Ensure concentration tracking exists
        if (!result.concentration || typeof result.concentration !== 'object') {
            result.concentration = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_CHARACTER_STATE"].concentration;
        }
        // Ensure conditions and diseases tracking exists
        if (!result.conditionsAndDiseases || typeof result.conditionsAndDiseases !== 'object') {
            result.conditionsAndDiseases = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_CHARACTER_STATE"].conditionsAndDiseases;
        }
        // Ensure daysSpent tracking exists
        if (typeof result.daysSpent !== 'number') {
            result.daysSpent = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_CHARACTER_STATE"].daysSpent;
        }
        return result;
    }
    // Migrate old character with string class to new format
    const migratedCharacter = {
        id: generateId(),
        ...__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_CHARACTER_STATE"],
        ...characterObj,
        class: {
            name: characterObj.class && typeof characterObj.class === 'string' ? characterObj.class : '',
            isCustom: false,
            spellcaster: 'none',
            hitDie: 8
        },
        spellSlots: __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_CHARACTER_STATE"].spellSlots,
        pactMagic: undefined,
        features: Array.isArray(characterObj.features) ? characterObj.features : __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_CHARACTER_STATE"].features,
        traits: Array.isArray(characterObj.traits) ? characterObj.traits : __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_CHARACTER_STATE"].traits,
        characterBackground: characterObj.characterBackground && typeof characterObj.characterBackground === 'object' && 'backstory' in characterObj.characterBackground ? characterObj.characterBackground : __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_CHARACTER_STATE"].characterBackground,
        weapons: Array.isArray(characterObj.weapons) ? characterObj.weapons.map(migrateWeaponDamage) : __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_CHARACTER_STATE"].weapons,
        weaponProficiencies: characterObj.weaponProficiencies && typeof characterObj.weaponProficiencies === 'object' ? characterObj.weaponProficiencies : __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_CHARACTER_STATE"].weaponProficiencies,
        jackOfAllTrades: characterObj.jackOfAllTrades && typeof characterObj.jackOfAllTrades === 'boolean' ? characterObj.jackOfAllTrades : __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_CHARACTER_STATE"].jackOfAllTrades
    };
    // Try to detect spellcaster type from class name
    if (characterObj.class && typeof characterObj.class === 'string') {
        const className = characterObj.class;
        const matchingClass = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["COMMON_CLASSES"].find((c)=>c.name.toLowerCase() === className.toLowerCase());
        if (matchingClass) {
            migratedCharacter.class = {
                name: matchingClass.name,
                isCustom: false,
                spellcaster: matchingClass.spellcaster,
                hitDie: matchingClass.hitDie
            };
            // Calculate initial spell slots
            const level = characterObj.level && typeof characterObj.level === 'number' ? characterObj.level : 1;
            migratedCharacter.spellSlots = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$calculations$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["calculateSpellSlots"])(migratedCharacter.class, level);
            // Add pact magic for warlocks
            if (matchingClass.spellcaster === 'warlock') {
                migratedCharacter.pactMagic = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$calculations$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["calculatePactMagic"])(level);
            }
        } else {
            // Unknown class, mark as custom
            migratedCharacter.class = {
                name: typeof characterObj.class === 'string' ? characterObj.class : '',
                isCustom: true,
                spellcaster: 'none',
                hitDie: 8
            };
        }
    }
    return migratedCharacter;
}
// Utility function to generate unique IDs
const generateId = ()=>Date.now().toString(36) + Math.random().toString(36).substr(2);
const useCharacterStore = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zustand$2f$esm$2f$react$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["create"])()((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zustand$2f$esm$2f$middleware$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["persist"])((set, get)=>({
        // Initial state
        character: {
            ...__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_CHARACTER_STATE"],
            id: generateId()
        },
        saveStatus: 'saved',
        lastSaved: null,
        hasUnsavedChanges: false,
        hasHydrated: false,
        showDeathAnimation: false,
        showLevelUpAnimation: false,
        levelUpAnimationLevel: 1,
        // Character update actions
        updateCharacter: (updates)=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        ...updates
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        loadCharacterState: (characterState)=>{
            const migratedCharacter = migrateCharacterData(characterState);
            const multiclassCharacter = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$multiclass$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["migrateToMulticlass"])(migratedCharacter);
            set({
                character: multiclassCharacter,
                hasUnsavedChanges: false,
                saveStatus: 'saved',
                lastSaved: new Date()
            });
        },
        updateAbilityScore: (ability, value)=>{
            set((state)=>{
                const newAbilities = {
                    ...state.character.abilities,
                    [ability]: Math.max(1, Math.min(30, value))
                };
                // Auto-update initiative if it's not overridden and dexterity changed
                let initiative = state.character.initiative;
                if (ability === 'dexterity' && !initiative.isOverridden) {
                    initiative = {
                        ...initiative,
                        value: (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$calculations$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["calculateModifier"])(newAbilities.dexterity)
                    };
                }
                return {
                    character: {
                        ...state.character,
                        abilities: newAbilities,
                        initiative
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                };
            });
        },
        updateSkillProficiency: (skill, proficient)=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        skills: {
                            ...state.character.skills,
                            [skill]: {
                                ...state.character.skills[skill],
                                proficient
                            }
                        }
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        updateSkillExpertise: (skill, expertise)=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        skills: {
                            ...state.character.skills,
                            [skill]: {
                                ...state.character.skills[skill],
                                expertise
                            }
                        }
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        updateSavingThrowProficiency: (ability, proficient)=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        savingThrows: {
                            ...state.character.savingThrows,
                            [ability]: {
                                ...state.character.savingThrows[ability],
                                proficient
                            }
                        }
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        updateHitPoints: (updates)=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        hitPoints: {
                            ...state.character.hitPoints,
                            ...updates
                        }
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        updateInitiative: (value, isOverride)=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        initiative: {
                            value,
                            isOverridden: isOverride
                        }
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        resetInitiativeToDefault: ()=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        initiative: {
                            value: (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$calculations$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["calculateModifier"])(state.character.abilities.dexterity),
                            isOverridden: false
                        }
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        // Reaction management actions
        toggleReaction: ()=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        reaction: {
                            hasUsedReaction: !state.character.reaction.hasUsedReaction
                        }
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        resetReaction: ()=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        reaction: {
                            hasUsedReaction: false
                        }
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        // Class Features actions
        toggleJackOfAllTrades: ()=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        jackOfAllTrades: !state.character.jackOfAllTrades
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        // Heroic inspiration management actions
        updateHeroicInspiration: (updates)=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        heroicInspiration: {
                            ...state.character.heroicInspiration,
                            ...updates
                        }
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        addHeroicInspiration: function() {
            let amount = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : 1;
            set((state)=>{
                const current = state.character.heroicInspiration.count;
                const max = state.character.heroicInspiration.maxCount;
                const newCount = max ? Math.min(current + amount, max) : current + amount;
                return {
                    character: {
                        ...state.character,
                        heroicInspiration: {
                            ...state.character.heroicInspiration,
                            count: Math.max(0, newCount)
                        }
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                };
            });
        },
        useHeroicInspiration: ()=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        heroicInspiration: {
                            ...state.character.heroicInspiration,
                            count: Math.max(0, state.character.heroicInspiration.count - 1)
                        }
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        resetHeroicInspiration: ()=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        heroicInspiration: {
                            ...state.character.heroicInspiration,
                            count: 0
                        }
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        // Armor Class management
        updateTempArmorClass: (tempAC)=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        tempArmorClass: tempAC
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        toggleShield: ()=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        isWearingShield: !state.character.isWearingShield
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        resetTempArmorClass: ()=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        tempArmorClass: 0
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        updateShieldBonus: (bonus)=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        shieldBonus: bonus
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        // HP management actions
        applyDamageToCharacter: (damage)=>{
            const state = get();
            const wasDeadBefore = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$hpCalculations$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isDead"])(state.character.hitPoints);
            const newHitPoints = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$hpCalculations$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["applyDamage"])(state.character.hitPoints, damage);
            const isDeadAfter = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$hpCalculations$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isDead"])(newHitPoints);
            // Check if death animation is enabled in player settings
            const playerSettings = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$store$2f$playerStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usePlayerStore"].getState().settings;
            const shouldShowDeathAnimation = playerSettings.enableDeathAnimation && !wasDeadBefore && isDeadAfter;
            set({
                character: {
                    ...state.character,
                    hitPoints: newHitPoints
                },
                hasUnsavedChanges: true,
                saveStatus: 'saving',
                showDeathAnimation: shouldShowDeathAnimation ? true : state.showDeathAnimation
            });
            // Auto-clear the death animation after 8.5 seconds
            if (shouldShowDeathAnimation) {
                setTimeout(()=>{
                    set({
                        showDeathAnimation: false
                    });
                }, 8500);
            }
        },
        applyHealingToCharacter: (healing)=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        hitPoints: (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$hpCalculations$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["applyHealing"])(state.character.hitPoints, healing)
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        addTemporaryHPToCharacter: (tempHP)=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        hitPoints: (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$hpCalculations$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["addTemporaryHP"])(state.character.hitPoints, tempHP)
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        makeDeathSavingThrow: function(isSuccess) {
            let isCritical = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : false;
            const state = get();
            const wasDeadBefore = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$hpCalculations$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isDead"])(state.character.hitPoints);
            const newHitPoints = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$hpCalculations$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["makeDeathSave"])(state.character.hitPoints, isSuccess, isCritical);
            const isDeadAfter = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$hpCalculations$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isDead"])(newHitPoints);
            // Check if death animation is enabled in player settings
            const playerSettings = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$store$2f$playerStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usePlayerStore"].getState().settings;
            const shouldShowDeathAnimation = playerSettings.enableDeathAnimation && !wasDeadBefore && isDeadAfter;
            set({
                character: {
                    ...state.character,
                    hitPoints: newHitPoints
                },
                hasUnsavedChanges: true,
                saveStatus: 'saving',
                showDeathAnimation: shouldShowDeathAnimation ? true : state.showDeathAnimation
            });
            if (shouldShowDeathAnimation) {
                setTimeout(()=>{
                    set({
                        showDeathAnimation: false
                    });
                }, 8500);
            }
        },
        resetDeathSavingThrows: ()=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        hitPoints: (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$hpCalculations$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["resetDeathSaves"])(state.character.hitPoints)
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        clearDeathAnimation: ()=>{
            set({
                showDeathAnimation: false
            });
        },
        clearLevelUpAnimation: ()=>{
            set({
                showLevelUpAnimation: false
            });
        },
        toggleHPCalculationMode: ()=>{
            set((state)=>{
                const newMode = state.character.hitPoints.calculationMode === 'auto' ? 'manual' : 'auto';
                let newMaxHP = state.character.hitPoints.max;
                // If switching to auto mode, recalculate max HP
                if (newMode === 'auto') {
                    const hitDie = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$hpCalculations$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getClassHitDie"])(state.character.class.name, state.character.class.hitDie);
                    newMaxHP = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$hpCalculations$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["calculateMaxHP"])({
                        ...state.character.class,
                        hitDie
                    }, state.character.level, state.character.abilities.constitution);
                }
                return {
                    character: {
                        ...state.character,
                        hitPoints: {
                            ...state.character.hitPoints,
                            calculationMode: newMode,
                            max: newMaxHP,
                            manualMaxOverride: newMode === 'manual' ? state.character.hitPoints.max : undefined
                        }
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                };
            });
        },
        recalculateMaxHP: ()=>{
            set((state)=>{
                if (state.character.hitPoints.calculationMode === 'manual') {
                    return state; // Don't recalculate in manual mode
                }
                const hitDie = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$hpCalculations$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getClassHitDie"])(state.character.class.name, state.character.class.hitDie);
                const newMaxHP = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$hpCalculations$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["calculateMaxHP"])({
                    ...state.character.class,
                    hitDie
                }, state.character.level, state.character.abilities.constitution);
                return {
                    character: {
                        ...state.character,
                        hitPoints: {
                            ...state.character.hitPoints,
                            max: newMaxHP
                        }
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                };
            });
        },
        // Class and spell management
        updateClass: (classInfo)=>{
            set((state)=>{
                // Ensure character has multiclass structure
                const migratedCharacter = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$multiclass$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["migrateToMulticlass"])(state.character);
                // Update the primary class (first class or create new one)
                const updatedClasses = [
                    ...migratedCharacter.classes || []
                ];
                if (updatedClasses.length === 0) {
                    updatedClasses.push({
                        className: classInfo.name,
                        level: migratedCharacter.level || 1,
                        isCustom: classInfo.isCustom,
                        spellcaster: classInfo.spellcaster,
                        hitDie: classInfo.hitDie
                    });
                } else {
                    // Update the first (primary) class
                    updatedClasses[0] = {
                        ...updatedClasses[0],
                        className: classInfo.name,
                        isCustom: classInfo.isCustom,
                        spellcaster: classInfo.spellcaster,
                        hitDie: classInfo.hitDie
                    };
                }
                const updatedCharacter = {
                    ...migratedCharacter,
                    classes: updatedClasses,
                    class: classInfo
                };
                // Recalculate spell slots and pact magic using multiclass-aware functions
                const newSpellSlots = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$calculations$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["calculateCharacterSpellSlots"])(updatedCharacter);
                const preservedSpellSlots = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$calculations$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["updateSpellSlotsPreservingUsed"])(newSpellSlots, state.character.spellSlots);
                const pactMagic = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$calculations$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["calculateCharacterPactMagic"])(updatedCharacter);
                // Preserve existing pact magic used slots if possible
                if (state.character.pactMagic && pactMagic) {
                    pactMagic.slots.used = Math.min(state.character.pactMagic.slots.used, pactMagic.slots.max);
                }
                return {
                    character: {
                        ...updatedCharacter,
                        spellSlots: preservedSpellSlots,
                        pactMagic
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                };
            });
        },
        updateLevel: (level)=>{
            const currentState = get();
            const oldLevel = currentState.character.totalLevel || currentState.character.level;
            const clampedLevel = Math.max(1, Math.min(20, level));
            // Check if this is a level UP (not down or same)
            const isLevelUp = clampedLevel > oldLevel;
            set((state)=>{
                // Ensure character has multiclass structure
                const migratedCharacter = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$multiclass$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["migrateToMulticlass"])(state.character);
                // For single class characters, update the primary class level
                // For multiclass characters, this updates the total level by adjusting the primary class
                const updatedClasses = [
                    ...migratedCharacter.classes || []
                ];
                if (updatedClasses.length === 1) {
                    // Single class: update the class level directly
                    updatedClasses[0] = {
                        ...updatedClasses[0],
                        level: clampedLevel
                    };
                } else if (updatedClasses.length > 1) {
                    // Multiclass: adjust the primary (highest level) class to reach the target total level
                    const currentTotal = updatedClasses.reduce((sum, cls)=>sum + cls.level, 0);
                    const levelDifference = clampedLevel - currentTotal;
                    if (levelDifference !== 0) {
                        // Find the primary class (highest level)
                        const primaryIndex = updatedClasses.reduce((maxIndex, cls, index)=>cls.level > updatedClasses[maxIndex].level ? index : maxIndex, 0);
                        const newPrimaryLevel = Math.max(1, updatedClasses[primaryIndex].level + levelDifference);
                        updatedClasses[primaryIndex] = {
                            ...updatedClasses[primaryIndex],
                            level: newPrimaryLevel
                        };
                    }
                }
                // Recalculate hit dice pools
                const hitDicePools = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$multiclass$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["calculateHitDicePools"])(updatedClasses, migratedCharacter.hitDicePools);
                const updatedCharacter = {
                    ...migratedCharacter,
                    classes: updatedClasses,
                    totalLevel: clampedLevel,
                    level: clampedLevel,
                    hitDicePools
                };
                // Recalculate spell slots and pact magic using multiclass-aware functions
                const newSpellSlots = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$calculations$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["calculateCharacterSpellSlots"])(updatedCharacter);
                const preservedSpellSlots = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$calculations$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["updateSpellSlotsPreservingUsed"])(newSpellSlots, state.character.spellSlots);
                const pactMagic = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$calculations$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["calculateCharacterPactMagic"])(updatedCharacter);
                // Preserve existing pact magic used slots if possible
                if (state.character.pactMagic && pactMagic) {
                    pactMagic.slots.used = Math.min(state.character.pactMagic.slots.used, pactMagic.slots.max);
                }
                // Check if level up animation should be shown
                const playerSettings = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$store$2f$playerStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usePlayerStore"].getState().settings;
                const enableLevelUp = playerSettings === null || playerSettings === void 0 ? void 0 : playerSettings.enableLevelUpAnimation;
                const shouldShowLevelUp = isLevelUp && enableLevelUp;
                // Update XP to minimum for the new level (only if current XP is less than required)
                const minXPForLevel = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$calculations$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getXPForLevel"])(clampedLevel);
                const currentXP = state.character.experience || 0;
                const newXP = currentXP < minXPForLevel ? minXPForLevel : currentXP;
                return {
                    character: {
                        ...updatedCharacter,
                        experience: newXP,
                        spellSlots: preservedSpellSlots,
                        pactMagic
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving',
                    showLevelUpAnimation: shouldShowLevelUp ? true : state.showLevelUpAnimation,
                    levelUpAnimationLevel: shouldShowLevelUp ? clampedLevel : state.levelUpAnimationLevel
                };
            });
            // Auto-clear the level up animation after 6 seconds
            if (isLevelUp) {
                const playerSettings = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$store$2f$playerStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usePlayerStore"].getState().settings;
                const enableLevelUpAnim = playerSettings === null || playerSettings === void 0 ? void 0 : playerSettings.enableLevelUpAnimation;
                if (enableLevelUpAnim) {
                    setTimeout(()=>{
                        set({
                            showLevelUpAnimation: false
                        });
                    }, 6000);
                }
            }
        },
        updateSpellSlot: (level, used)=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        spellSlots: {
                            ...state.character.spellSlots,
                            [level]: {
                                ...state.character.spellSlots[level],
                                used: Math.max(0, Math.min(used, state.character.spellSlots[level].max))
                            }
                        }
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        updatePactMagicSlot: (used)=>{
            set((state)=>{
                if (!state.character.pactMagic) return state;
                return {
                    character: {
                        ...state.character,
                        pactMagic: {
                            ...state.character.pactMagic,
                            slots: {
                                ...state.character.pactMagic.slots,
                                used: Math.max(0, Math.min(used, state.character.pactMagic.slots.max))
                            }
                        }
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                };
            });
        },
        resetSpellSlots: ()=>{
            set((state)=>{
                const resetSlots = {
                    1: {
                        ...state.character.spellSlots[1],
                        used: 0
                    },
                    2: {
                        ...state.character.spellSlots[2],
                        used: 0
                    },
                    3: {
                        ...state.character.spellSlots[3],
                        used: 0
                    },
                    4: {
                        ...state.character.spellSlots[4],
                        used: 0
                    },
                    5: {
                        ...state.character.spellSlots[5],
                        used: 0
                    },
                    6: {
                        ...state.character.spellSlots[6],
                        used: 0
                    },
                    7: {
                        ...state.character.spellSlots[7],
                        used: 0
                    },
                    8: {
                        ...state.character.spellSlots[8],
                        used: 0
                    },
                    9: {
                        ...state.character.spellSlots[9],
                        used: 0
                    }
                };
                return {
                    character: {
                        ...state.character,
                        spellSlots: resetSlots
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                };
            });
        },
        resetPactMagicSlots: ()=>{
            set((state)=>{
                if (!state.character.pactMagic) return state;
                return {
                    character: {
                        ...state.character,
                        pactMagic: {
                            ...state.character.pactMagic,
                            slots: {
                                ...state.character.pactMagic.slots,
                                used: 0
                            }
                        }
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                };
            });
        },
        // Multiclass management
        addClassLevel: function(className) {
            let isCustom = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : false, spellcaster = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : 'none', hitDie = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : 8, subclass = arguments.length > 4 ? arguments[4] : void 0;
            set((state)=>{
                // Ensure character has multiclass structure
                const migratedCharacter = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$multiclass$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["migrateToMulticlass"])(state.character);
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
                // Update backwards compatibility fields
                const primaryClass = classes.reduce((primary, current)=>current.level > primary.level ? current : primary);
                const compatibilityClass = {
                    name: primaryClass.className,
                    isCustom: primaryClass.isCustom,
                    spellcaster: primaryClass.spellcaster,
                    hitDie: primaryClass.hitDie
                };
                // Recalculate hit dice pools
                const hitDicePools = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$multiclass$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["calculateHitDicePools"])(classes, migratedCharacter.hitDicePools);
                const updatedCharacter = {
                    ...migratedCharacter,
                    classes,
                    totalLevel,
                    hitDicePools,
                    class: compatibilityClass,
                    level: totalLevel
                };
                // Recalculate spell slots and pact magic
                const newSpellSlots = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$calculations$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["calculateCharacterSpellSlots"])(updatedCharacter);
                const preservedSpellSlots = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$calculations$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["updateSpellSlotsPreservingUsed"])(newSpellSlots, state.character.spellSlots);
                const pactMagic = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$calculations$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["calculateCharacterPactMagic"])(updatedCharacter);
                if (state.character.pactMagic && pactMagic) {
                    pactMagic.slots.used = Math.min(state.character.pactMagic.slots.used, pactMagic.slots.max);
                }
                return {
                    character: {
                        ...updatedCharacter,
                        spellSlots: preservedSpellSlots,
                        pactMagic
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                };
            });
        },
        removeClassLevel: (className)=>{
            set((state)=>{
                const migratedCharacter = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$multiclass$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["migrateToMulticlass"])(state.character);
                const classes = [
                    ...migratedCharacter.classes || []
                ];
                const classIndex = classes.findIndex((cls)=>cls.className === className);
                if (classIndex === -1) {
                    return state; // Class not found
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
                    return state;
                }
                const totalLevel = classes.reduce((sum, cls)=>sum + cls.level, 0);
                // Update backwards compatibility fields
                const primaryClass = classes.reduce((primary, current)=>current.level > primary.level ? current : primary);
                const compatibilityClass = {
                    name: primaryClass.className,
                    isCustom: primaryClass.isCustom,
                    spellcaster: primaryClass.spellcaster,
                    hitDie: primaryClass.hitDie
                };
                // Recalculate hit dice pools
                const hitDicePools = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$multiclass$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["calculateHitDicePools"])(classes, migratedCharacter.hitDicePools);
                const updatedCharacter = {
                    ...migratedCharacter,
                    classes,
                    totalLevel,
                    hitDicePools,
                    class: compatibilityClass,
                    level: totalLevel
                };
                // Recalculate spell slots and pact magic
                const newSpellSlots = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$calculations$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["calculateCharacterSpellSlots"])(updatedCharacter);
                const preservedSpellSlots = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$calculations$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["updateSpellSlotsPreservingUsed"])(newSpellSlots, state.character.spellSlots);
                const pactMagic = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$calculations$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["calculateCharacterPactMagic"])(updatedCharacter);
                return {
                    character: {
                        ...updatedCharacter,
                        spellSlots: preservedSpellSlots,
                        pactMagic
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                };
            });
        },
        updateClassLevel: (className, newLevel)=>{
            set((state)=>{
                const migratedCharacter = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$multiclass$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["migrateToMulticlass"])(state.character);
                const classes = [
                    ...migratedCharacter.classes || []
                ];
                const classIndex = classes.findIndex((cls)=>cls.className === className);
                if (classIndex === -1) {
                    return state; // Class not found
                }
                const clampedLevel = Math.max(1, Math.min(20, newLevel));
                classes[classIndex] = {
                    ...classes[classIndex],
                    level: clampedLevel
                };
                const totalLevel = classes.reduce((sum, cls)=>sum + cls.level, 0);
                // Update backwards compatibility fields
                const primaryClass = classes.reduce((primary, current)=>current.level > primary.level ? current : primary);
                const compatibilityClass = {
                    name: primaryClass.className,
                    isCustom: primaryClass.isCustom,
                    spellcaster: primaryClass.spellcaster,
                    hitDie: primaryClass.hitDie
                };
                // Recalculate hit dice pools
                const hitDicePools = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$multiclass$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["calculateHitDicePools"])(classes, migratedCharacter.hitDicePools);
                const updatedCharacter = {
                    ...migratedCharacter,
                    classes,
                    totalLevel,
                    hitDicePools,
                    class: compatibilityClass,
                    level: totalLevel
                };
                // Recalculate spell slots and pact magic
                const newSpellSlots = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$calculations$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["calculateCharacterSpellSlots"])(updatedCharacter);
                const preservedSpellSlots = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$calculations$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["updateSpellSlotsPreservingUsed"])(newSpellSlots, state.character.spellSlots);
                const pactMagic = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$calculations$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["calculateCharacterPactMagic"])(updatedCharacter);
                if (state.character.pactMagic && pactMagic) {
                    pactMagic.slots.used = Math.min(state.character.pactMagic.slots.used, pactMagic.slots.max);
                }
                return {
                    character: {
                        ...updatedCharacter,
                        spellSlots: preservedSpellSlots,
                        pactMagic
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                };
            });
        },
        isMulticlassed: ()=>{
            var _character_classes;
            const { character } = get();
            return (((_character_classes = character.classes) === null || _character_classes === void 0 ? void 0 : _character_classes.length) || 0) > 1;
        },
        getClassDisplayString: ()=>{
            const { character } = get();
            if (!character.classes || character.classes.length === 0) {
                var _character_class;
                // Fallback to single class format
                return "".concat(((_character_class = character.class) === null || _character_class === void 0 ? void 0 : _character_class.name) || 'Unknown', " ").concat(character.level || 1);
            }
            if (character.classes.length === 1) {
                const cls = character.classes[0];
                return "".concat(cls.className, " ").concat(cls.level);
            }
            // Sort classes by level (descending) for display
            const sortedClasses = [
                ...character.classes
            ].sort((a, b)=>b.level - a.level);
            const classStrings = sortedClasses.map((cls)=>"".concat(cls.className, " ").concat(cls.level));
            const totalLevel = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$calculations$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getCharacterTotalLevel"])(character);
            return "".concat(classStrings.join(' / '), " (Level ").concat(totalLevel, ")");
        },
        // Hit dice management
        useHitDie: function(dieType) {
            let count = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 1;
            set((state)=>{
                const hitDicePools = {
                    ...state.character.hitDicePools
                };
                if (hitDicePools[dieType]) {
                    const pool = hitDicePools[dieType];
                    const actualCount = Math.min(count, pool.max - pool.used);
                    if (actualCount > 0) {
                        hitDicePools[dieType] = {
                            ...pool,
                            used: pool.used + actualCount
                        };
                    }
                }
                return {
                    character: {
                        ...state.character,
                        hitDicePools
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                };
            });
        },
        restoreHitDice: function(dieType) {
            let count = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : 1;
            set((state)=>{
                const hitDicePools = {
                    ...state.character.hitDicePools
                };
                if (hitDicePools[dieType]) {
                    const pool = hitDicePools[dieType];
                    const actualCount = Math.min(count, pool.used);
                    if (actualCount > 0) {
                        hitDicePools[dieType] = {
                            ...pool,
                            used: pool.used - actualCount
                        };
                    }
                }
                return {
                    character: {
                        ...state.character,
                        hitDicePools
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                };
            });
        },
        resetAllHitDice: ()=>{
            set((state)=>{
                const hitDicePools = {
                    ...state.character.hitDicePools
                };
                // Reset all hit dice pools to 0 used
                Object.keys(hitDicePools).forEach((dieType)=>{
                    hitDicePools[dieType] = {
                        ...hitDicePools[dieType],
                        used: 0
                    };
                });
                return {
                    character: {
                        ...state.character,
                        hitDicePools
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                };
            });
        },
        resetHalfHitDice: ()=>{
            set((state)=>{
                const hitDicePools = {
                    ...state.character.hitDicePools
                };
                // Restore half of used hit dice (rounded down)
                Object.keys(hitDicePools).forEach((dieType)=>{
                    const pool = hitDicePools[dieType];
                    const restoreCount = Math.floor(pool.used / 2);
                    hitDicePools[dieType] = {
                        ...pool,
                        used: pool.used - restoreCount
                    };
                });
                return {
                    character: {
                        ...state.character,
                        hitDicePools
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                };
            });
        },
        // Concentration management
        startConcentration: (spellName, spellId, castAt)=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        concentration: {
                            isConcentrating: true,
                            spellName,
                            spellId,
                            castAt,
                            startedAt: new Date().toISOString()
                        }
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        stopConcentration: ()=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        concentration: {
                            isConcentrating: false,
                            spellName: undefined,
                            spellId: undefined,
                            castAt: undefined,
                            startedAt: undefined
                        }
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        isConcentratingOn: (spellName)=>{
            const state = get();
            return state.character.concentration.isConcentrating && state.character.concentration.spellName === spellName;
        },
        // Conditions and diseases management
        addCondition: function(conditionName, source, description) {
            let count = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : 1, notes = arguments.length > 4 ? arguments[4] : void 0;
            set((state)=>{
                const newCondition = {
                    id: "".concat(conditionName.toLowerCase().replace(/[^a-z0-9]/g, '-'), "-").concat(Date.now()),
                    name: conditionName,
                    source,
                    description,
                    stackable: conditionName.toLowerCase() === 'exhaustion',
                    count,
                    appliedAt: new Date().toISOString(),
                    notes
                };
                return {
                    character: {
                        ...state.character,
                        conditionsAndDiseases: {
                            ...state.character.conditionsAndDiseases,
                            activeConditions: [
                                ...state.character.conditionsAndDiseases.activeConditions,
                                newCondition
                            ]
                        }
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                };
            });
        },
        updateCondition: (conditionId, updates)=>{
            set((state)=>{
                const updatedConditions = state.character.conditionsAndDiseases.activeConditions.map((condition)=>condition.id === conditionId ? {
                        ...condition,
                        ...updates
                    } : condition);
                return {
                    character: {
                        ...state.character,
                        conditionsAndDiseases: {
                            ...state.character.conditionsAndDiseases,
                            activeConditions: updatedConditions
                        }
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                };
            });
        },
        removeCondition: (conditionId)=>{
            set((state)=>{
                const filteredConditions = state.character.conditionsAndDiseases.activeConditions.filter((condition)=>condition.id !== conditionId);
                return {
                    character: {
                        ...state.character,
                        conditionsAndDiseases: {
                            ...state.character.conditionsAndDiseases,
                            activeConditions: filteredConditions
                        }
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                };
            });
        },
        addDisease: (diseaseName, source, description, onsetTime, notes)=>{
            set((state)=>{
                const newDisease = {
                    id: "".concat(diseaseName.toLowerCase().replace(/[^a-z0-9]/g, '-'), "-").concat(Date.now()),
                    name: diseaseName,
                    source,
                    description,
                    onsetTime,
                    appliedAt: new Date().toISOString(),
                    notes
                };
                return {
                    character: {
                        ...state.character,
                        conditionsAndDiseases: {
                            ...state.character.conditionsAndDiseases,
                            activeDiseases: [
                                ...state.character.conditionsAndDiseases.activeDiseases,
                                newDisease
                            ]
                        }
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                };
            });
        },
        updateDisease: (diseaseId, updates)=>{
            set((state)=>{
                const updatedDiseases = state.character.conditionsAndDiseases.activeDiseases.map((disease)=>disease.id === diseaseId ? {
                        ...disease,
                        ...updates
                    } : disease);
                return {
                    character: {
                        ...state.character,
                        conditionsAndDiseases: {
                            ...state.character.conditionsAndDiseases,
                            activeDiseases: updatedDiseases
                        }
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                };
            });
        },
        removeDisease: (diseaseId)=>{
            set((state)=>{
                const filteredDiseases = state.character.conditionsAndDiseases.activeDiseases.filter((disease)=>disease.id !== diseaseId);
                return {
                    character: {
                        ...state.character,
                        conditionsAndDiseases: {
                            ...state.character.conditionsAndDiseases,
                            activeDiseases: filteredDiseases
                        }
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                };
            });
        },
        setExhaustionVariant: (variant)=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        conditionsAndDiseases: {
                            ...state.character.conditionsAndDiseases,
                            exhaustionVariant: variant
                        }
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        clearAllConditions: ()=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        conditionsAndDiseases: {
                            ...state.character.conditionsAndDiseases,
                            activeConditions: []
                        }
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        clearAllDiseases: ()=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        conditionsAndDiseases: {
                            ...state.character.conditionsAndDiseases,
                            activeDiseases: []
                        }
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        // XP management
        addExperience: (xpToAdd)=>{
            const currentState = get();
            const oldLevel = currentState.character.totalLevel || currentState.character.level;
            const newXP = currentState.character.experience + xpToAdd;
            const newLevel = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$calculations$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["calculateLevelFromXP"])(newXP);
            // Check if this is a level UP
            const isLevelUp = newLevel > oldLevel;
            // Debug logging
            console.log('addExperience called:', {
                xpToAdd,
                oldXP: currentState.character.experience,
                newXP,
                oldLevel,
                newLevel,
                isLevelUp
            });
            set((state)=>{
                // Ensure character has multiclass structure
                const migratedCharacter = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$multiclass$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["migrateToMulticlass"])(state.character);
                // Update class levels based on new total level
                const updatedClasses = [
                    ...migratedCharacter.classes || []
                ];
                if (updatedClasses.length === 1) {
                    updatedClasses[0] = {
                        ...updatedClasses[0],
                        level: newLevel
                    };
                } else if (updatedClasses.length > 1) {
                    // Adjust the primary class to reach the target total level
                    const currentTotal = updatedClasses.reduce((sum, cls)=>sum + cls.level, 0);
                    const levelDifference = newLevel - currentTotal;
                    if (levelDifference !== 0) {
                        const primaryIndex = updatedClasses.reduce((maxIndex, cls, index)=>cls.level > updatedClasses[maxIndex].level ? index : maxIndex, 0);
                        updatedClasses[primaryIndex] = {
                            ...updatedClasses[primaryIndex],
                            level: Math.max(1, updatedClasses[primaryIndex].level + levelDifference)
                        };
                    }
                }
                // Recalculate hit dice pools
                const hitDicePools = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$multiclass$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["calculateHitDicePools"])(updatedClasses, migratedCharacter.hitDicePools);
                const updatedCharacter = {
                    ...migratedCharacter,
                    classes: updatedClasses,
                    totalLevel: newLevel,
                    level: newLevel,
                    hitDicePools
                };
                // Recalculate spell slots using multiclass-aware functions
                const newSpellSlots = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$calculations$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["calculateCharacterSpellSlots"])(updatedCharacter);
                const preservedSpellSlots = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$calculations$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["updateSpellSlotsPreservingUsed"])(newSpellSlots, state.character.spellSlots);
                const pactMagic = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$calculations$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["calculateCharacterPactMagic"])(updatedCharacter);
                // Preserve existing pact magic used slots if possible
                if (state.character.pactMagic && pactMagic) {
                    pactMagic.slots.used = Math.min(state.character.pactMagic.slots.used, pactMagic.slots.max);
                }
                // Check if level up animation should be shown
                const playerSettings = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$store$2f$playerStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usePlayerStore"].getState().settings;
                const enableLevelUp = playerSettings === null || playerSettings === void 0 ? void 0 : playerSettings.enableLevelUpAnimation; // Default to true
                const shouldShowLevelUp = isLevelUp && enableLevelUp;
                console.log('addExperience animation check:', {
                    isLevelUp,
                    enableLevelUpAnimation: enableLevelUp,
                    shouldShowLevelUp,
                    newLevel
                });
                return {
                    character: {
                        ...updatedCharacter,
                        experience: newXP,
                        spellSlots: preservedSpellSlots,
                        pactMagic
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving',
                    showLevelUpAnimation: shouldShowLevelUp ? true : state.showLevelUpAnimation,
                    levelUpAnimationLevel: shouldShowLevelUp ? newLevel : state.levelUpAnimationLevel
                };
            });
            // Auto-clear the level up animation after 6 seconds
            const playerSettings = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$store$2f$playerStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usePlayerStore"].getState().settings;
            const enableLevelUpAnim = playerSettings === null || playerSettings === void 0 ? void 0 : playerSettings.enableLevelUpAnimation;
            if (isLevelUp && enableLevelUpAnim) {
                console.log('Setting up auto-clear timeout for level up animation');
                setTimeout(()=>{
                    set({
                        showLevelUpAnimation: false
                    });
                }, 6000);
            }
        },
        setExperience: (newXP)=>{
            const currentState = get();
            const oldLevel = currentState.character.totalLevel || currentState.character.level;
            const newLevel = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$calculations$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["calculateLevelFromXP"])(newXP);
            // Check if this is a level UP
            const isLevelUp = newLevel > oldLevel;
            set((state)=>{
                // Ensure character has multiclass structure
                const migratedCharacter = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$multiclass$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["migrateToMulticlass"])(state.character);
                // Update class levels based on new total level
                const updatedClasses = [
                    ...migratedCharacter.classes || []
                ];
                if (updatedClasses.length === 1) {
                    updatedClasses[0] = {
                        ...updatedClasses[0],
                        level: newLevel
                    };
                } else if (updatedClasses.length > 1) {
                    // Adjust the primary class to reach the target total level
                    const currentTotal = updatedClasses.reduce((sum, cls)=>sum + cls.level, 0);
                    const levelDifference = newLevel - currentTotal;
                    if (levelDifference !== 0) {
                        const primaryIndex = updatedClasses.reduce((maxIndex, cls, index)=>cls.level > updatedClasses[maxIndex].level ? index : maxIndex, 0);
                        updatedClasses[primaryIndex] = {
                            ...updatedClasses[primaryIndex],
                            level: Math.max(1, updatedClasses[primaryIndex].level + levelDifference)
                        };
                    }
                }
                // Recalculate hit dice pools
                const hitDicePools = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$multiclass$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["calculateHitDicePools"])(updatedClasses, migratedCharacter.hitDicePools);
                const updatedCharacter = {
                    ...migratedCharacter,
                    classes: updatedClasses,
                    totalLevel: newLevel,
                    level: newLevel,
                    hitDicePools
                };
                // Recalculate spell slots using multiclass-aware functions
                const newSpellSlots = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$calculations$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["calculateCharacterSpellSlots"])(updatedCharacter);
                const preservedSpellSlots = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$calculations$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["updateSpellSlotsPreservingUsed"])(newSpellSlots, state.character.spellSlots);
                const pactMagic = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$calculations$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["calculateCharacterPactMagic"])(updatedCharacter);
                // Preserve existing pact magic used slots if possible
                if (state.character.pactMagic && pactMagic) {
                    pactMagic.slots.used = Math.min(state.character.pactMagic.slots.used, pactMagic.slots.max);
                }
                // Check if level up animation should be shown
                const playerSettings = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$store$2f$playerStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usePlayerStore"].getState().settings;
                const enableLevelUp = playerSettings === null || playerSettings === void 0 ? void 0 : playerSettings.enableLevelUpAnimation;
                const shouldShowLevelUp = isLevelUp && enableLevelUp;
                return {
                    character: {
                        ...updatedCharacter,
                        experience: newXP,
                        spellSlots: preservedSpellSlots,
                        pactMagic
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving',
                    showLevelUpAnimation: shouldShowLevelUp ? true : state.showLevelUpAnimation,
                    levelUpAnimationLevel: shouldShowLevelUp ? newLevel : state.levelUpAnimationLevel
                };
            });
            // Auto-clear the level up animation after 6 seconds
            const playerSettings = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$store$2f$playerStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usePlayerStore"].getState().settings;
            const enableLevelUpAnim = playerSettings === null || playerSettings === void 0 ? void 0 : playerSettings.enableLevelUpAnimation;
            if (isLevelUp && enableLevelUpAnim) {
                setTimeout(()=>{
                    set({
                        showLevelUpAnimation: false
                    });
                }, 6000);
            }
        },
        // Rich text content management
        addFeature: (feature)=>{
            set((state)=>{
                const newFeature = {
                    ...feature,
                    id: generateId(),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                return {
                    character: {
                        ...state.character,
                        features: [
                            ...state.character.features,
                            newFeature
                        ]
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                };
            });
        },
        updateFeature: (id, updates)=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        features: state.character.features.map((feature)=>feature.id === id ? {
                                ...feature,
                                ...updates,
                                updatedAt: new Date().toISOString()
                            } : feature)
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        deleteFeature: (id)=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        features: state.character.features.filter((feature)=>feature.id !== id)
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        addTrait: (trait)=>{
            set((state)=>{
                const newTrait = {
                    ...trait,
                    id: generateId(),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                return {
                    character: {
                        ...state.character,
                        traits: [
                            ...state.character.traits,
                            newTrait
                        ]
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                };
            });
        },
        updateTrait: (id, updates)=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        traits: state.character.traits.map((trait)=>trait.id === id ? {
                                ...trait,
                                ...updates,
                                updatedAt: new Date().toISOString()
                            } : trait)
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        deleteTrait: (id)=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        traits: state.character.traits.filter((trait)=>trait.id !== id)
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        addNote: (note)=>{
            set((state)=>{
                const newNote = {
                    ...note,
                    id: generateId(),
                    order: state.character.notes.length,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                return {
                    character: {
                        ...state.character,
                        notes: [
                            ...state.character.notes,
                            newNote
                        ]
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                };
            });
        },
        updateNote: (id, updates)=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        notes: state.character.notes.map((note)=>note.id === id ? {
                                ...note,
                                ...updates,
                                updatedAt: new Date().toISOString()
                            } : note)
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        deleteNote: (id)=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        notes: state.character.notes.filter((note)=>note.id !== id)
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        reorderNotes: (sourceIndex, destinationIndex)=>{
            set((state)=>{
                const notes = [
                    ...state.character.notes
                ];
                const [removed] = notes.splice(sourceIndex, 1);
                notes.splice(destinationIndex, 0, removed);
                // Update order property
                const updatedNotes = notes.map((note, index)=>({
                        ...note,
                        order: index,
                        updatedAt: new Date().toISOString()
                    }));
                return {
                    character: {
                        ...state.character,
                        notes: updatedNotes
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                };
            });
        },
        // Trackable trait management
        addTrackableTrait: (trait)=>{
            set((state)=>{
                const newTrait = {
                    ...trait,
                    id: generateId(),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                // Also add as extended feature
                const newExtendedFeature = {
                    ...newTrait,
                    sourceType: 'other',
                    sourceDetail: newTrait.source || undefined,
                    displayOrder: (state.character.extendedFeatures || []).length,
                    isPassive: newTrait.maxUses === 0
                };
                return {
                    character: {
                        ...state.character,
                        trackableTraits: [
                            ...state.character.trackableTraits || [],
                            newTrait
                        ],
                        extendedFeatures: [
                            ...state.character.extendedFeatures || [],
                            newExtendedFeature
                        ]
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                };
            });
        },
        updateTrackableTrait: (id, updates)=>{
            set((state)=>{
                const updatedTraits = (state.character.trackableTraits || []).map((trait)=>trait.id === id ? {
                        ...trait,
                        ...updates,
                        updatedAt: new Date().toISOString()
                    } : trait);
                // Also update corresponding extended feature
                const updatedExtendedFeatures = (state.character.extendedFeatures || []).map((feature)=>feature.id === id ? {
                        ...feature,
                        ...updates,
                        sourceDetail: updates.source || feature.sourceDetail,
                        isPassive: (updates.maxUses !== undefined ? updates.maxUses : feature.maxUses) === 0,
                        updatedAt: new Date().toISOString()
                    } : feature);
                return {
                    character: {
                        ...state.character,
                        trackableTraits: updatedTraits,
                        extendedFeatures: updatedExtendedFeatures
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                };
            });
        },
        deleteTrackableTrait: (id)=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        trackableTraits: (state.character.trackableTraits || []).filter((trait)=>trait.id !== id),
                        extendedFeatures: (state.character.extendedFeatures || []).filter((feature)=>feature.id !== id)
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        useTrackableTrait: (id)=>{
            set((state)=>{
                const updatedTraits = (state.character.trackableTraits || []).map((trait)=>trait.id === id ? {
                        ...trait,
                        usedUses: Math.min(trait.usedUses + 1, (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$calculations$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["calculateTraitMaxUses"])(trait, state.character.level)),
                        updatedAt: new Date().toISOString()
                    } : trait);
                // Also update corresponding extended feature
                const updatedExtendedFeatures = (state.character.extendedFeatures || []).map((feature)=>feature.id === id ? {
                        ...feature,
                        usedUses: Math.min(feature.usedUses + 1, (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$calculations$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["calculateTraitMaxUses"])(feature, state.character.level)),
                        updatedAt: new Date().toISOString()
                    } : feature);
                return {
                    character: {
                        ...state.character,
                        trackableTraits: updatedTraits,
                        extendedFeatures: updatedExtendedFeatures
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                };
            });
        },
        resetTrackableTraits: (restType)=>{
            set((state)=>{
                const updatedTraits = (state.character.trackableTraits || []).map((trait)=>trait.restType === restType || restType === 'long' ? {
                        ...trait,
                        usedUses: 0,
                        updatedAt: new Date().toISOString()
                    } : trait);
                // Also update corresponding extended features
                const updatedExtendedFeatures = (state.character.extendedFeatures || []).map((feature)=>feature.restType === restType || restType === 'long' ? {
                        ...feature,
                        usedUses: 0,
                        updatedAt: new Date().toISOString()
                    } : feature);
                return {
                    character: {
                        ...state.character,
                        trackableTraits: updatedTraits,
                        extendedFeatures: updatedExtendedFeatures
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                };
            });
        },
        // Extended feature management actions
        addExtendedFeature: (feature)=>{
            set((state)=>{
                const newFeature = {
                    ...feature,
                    id: generateId(),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                // Also add as trackable trait
                const newTrackableTrait = {
                    id: newFeature.id,
                    name: newFeature.name,
                    description: newFeature.description,
                    maxUses: newFeature.maxUses,
                    usedUses: newFeature.usedUses,
                    restType: newFeature.restType,
                    source: newFeature.sourceDetail || newFeature.source,
                    scaleWithProficiency: newFeature.scaleWithProficiency,
                    proficiencyMultiplier: newFeature.proficiencyMultiplier,
                    createdAt: newFeature.createdAt,
                    updatedAt: newFeature.updatedAt
                };
                return {
                    character: {
                        ...state.character,
                        extendedFeatures: [
                            ...state.character.extendedFeatures || [],
                            newFeature
                        ],
                        trackableTraits: [
                            ...state.character.trackableTraits || [],
                            newTrackableTrait
                        ]
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                };
            });
        },
        updateExtendedFeature: (id, updates)=>{
            set((state)=>{
                const updatedFeatures = (state.character.extendedFeatures || []).map((feature)=>feature.id === id ? {
                        ...feature,
                        ...updates,
                        updatedAt: new Date().toISOString()
                    } : feature);
                // Also update corresponding trackable trait
                const updatedTraits = (state.character.trackableTraits || []).map((trait)=>trait.id === id ? {
                        ...trait,
                        ...updates,
                        source: updates.sourceDetail || updates.source || trait.source,
                        updatedAt: new Date().toISOString()
                    } : trait);
                return {
                    character: {
                        ...state.character,
                        extendedFeatures: updatedFeatures,
                        trackableTraits: updatedTraits
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                };
            });
        },
        deleteExtendedFeature: (id)=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        extendedFeatures: (state.character.extendedFeatures || []).filter((feature)=>feature.id !== id),
                        trackableTraits: (state.character.trackableTraits || []).filter((trait)=>trait.id !== id)
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        useExtendedFeature: (id)=>{
            set((state)=>{
                const updatedFeatures = (state.character.extendedFeatures || []).map((feature)=>feature.id === id ? {
                        ...feature,
                        usedUses: Math.min(feature.usedUses + 1, (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$calculations$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["calculateTraitMaxUses"])(feature, state.character.level)),
                        updatedAt: new Date().toISOString()
                    } : feature);
                // Also update corresponding trackable trait
                const updatedTraits = (state.character.trackableTraits || []).map((trait)=>trait.id === id ? {
                        ...trait,
                        usedUses: Math.min(trait.usedUses + 1, (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$calculations$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["calculateTraitMaxUses"])(trait, state.character.level)),
                        updatedAt: new Date().toISOString()
                    } : trait);
                return {
                    character: {
                        ...state.character,
                        extendedFeatures: updatedFeatures,
                        trackableTraits: updatedTraits
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                };
            });
        },
        resetExtendedFeatures: (restType)=>{
            set((state)=>{
                const updatedFeatures = (state.character.extendedFeatures || []).map((feature)=>feature.restType === restType || restType === 'long' ? {
                        ...feature,
                        usedUses: 0,
                        updatedAt: new Date().toISOString()
                    } : feature);
                // Also update corresponding trackable traits
                const updatedTraits = (state.character.trackableTraits || []).map((trait)=>trait.restType === restType || restType === 'long' ? {
                        ...trait,
                        usedUses: 0,
                        updatedAt: new Date().toISOString()
                    } : trait);
                return {
                    character: {
                        ...state.character,
                        extendedFeatures: updatedFeatures,
                        trackableTraits: updatedTraits
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                };
            });
        },
        reorderExtendedFeatures: (sourceIndex, destinationIndex, sourceType)=>{
            set((state)=>{
                const features = [
                    ...state.character.extendedFeatures || []
                ];
                if (sourceType) {
                    // Reorder within a specific source type
                    const filteredFeatures = features.filter((f)=>f.sourceType === sourceType);
                    const otherFeatures = features.filter((f)=>f.sourceType !== sourceType);
                    if (sourceIndex >= filteredFeatures.length || destinationIndex >= filteredFeatures.length) {
                        return state;
                    }
                    const [movedFeature] = filteredFeatures.splice(sourceIndex, 1);
                    filteredFeatures.splice(destinationIndex, 0, movedFeature);
                    // Update display orders
                    filteredFeatures.forEach((feature, index)=>{
                        feature.displayOrder = index;
                        feature.updatedAt = new Date().toISOString();
                    });
                    return {
                        character: {
                            ...state.character,
                            extendedFeatures: [
                                ...otherFeatures,
                                ...filteredFeatures
                            ]
                        },
                        hasUnsavedChanges: true,
                        saveStatus: 'saving'
                    };
                } else {
                    // Reorder all features
                    if (sourceIndex >= features.length || destinationIndex >= features.length) {
                        return state;
                    }
                    const [movedFeature] = features.splice(sourceIndex, 1);
                    features.splice(destinationIndex, 0, movedFeature);
                    // Update display orders
                    features.forEach((feature, index)=>{
                        feature.displayOrder = index;
                        feature.updatedAt = new Date().toISOString();
                    });
                    return {
                        character: {
                            ...state.character,
                            extendedFeatures: features
                        },
                        hasUnsavedChanges: true,
                        saveStatus: 'saving'
                    };
                }
            });
        },
        migrateTraitsToExtendedFeatures: ()=>{
            set((state)=>{
                const existingTraits = state.character.trackableTraits || [];
                const existingExtended = state.character.extendedFeatures || [];
                // Only migrate if there are traits and no extended features yet
                if (existingTraits.length === 0 || existingExtended.length > 0) {
                    return state;
                }
                const migratedFeatures = existingTraits.map((trait, index)=>({
                        ...trait,
                        sourceType: 'other',
                        sourceDetail: trait.source || undefined,
                        displayOrder: index,
                        isPassive: trait.maxUses === 0
                    }));
                return {
                    character: {
                        ...state.character,
                        extendedFeatures: migratedFeatures
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                };
            });
        },
        // Language management
        addLanguage: (language)=>{
            set((state)=>{
                const newLanguage = {
                    ...language,
                    id: generateId(),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                return {
                    character: {
                        ...state.character,
                        languages: [
                            ...state.character.languages || [],
                            newLanguage
                        ]
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                };
            });
        },
        deleteLanguage: (id)=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        languages: (state.character.languages || []).filter((lang)=>lang.id !== id)
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        // Tool proficiency management
        addToolProficiency: (tool)=>{
            set((state)=>{
                const newTool = {
                    ...tool,
                    id: generateId(),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                return {
                    character: {
                        ...state.character,
                        toolProficiencies: [
                            ...state.character.toolProficiencies || [],
                            newTool
                        ]
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                };
            });
        },
        updateToolProficiency: (id, updates)=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        toolProficiencies: (state.character.toolProficiencies || []).map((tool)=>tool.id === id ? {
                                ...tool,
                                ...updates,
                                updatedAt: new Date().toISOString()
                            } : tool)
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        deleteToolProficiency: (id)=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        toolProficiencies: (state.character.toolProficiencies || []).filter((tool)=>tool.id !== id)
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        // Rest management (centralized)
        takeShortRest: ()=>{
            set((state)=>{
                const { character } = state;
                // Reset short rest abilities (trackableTraits and extendedFeatures)
                const resetTrackableTraits = character.trackableTraits.map((trait)=>trait.restType === 'short' ? {
                        ...trait,
                        usedUses: 0
                    } : trait);
                const resetExtendedFeatures = character.extendedFeatures.map((feature)=>feature.restType === 'short' && !feature.isPassive ? {
                        ...feature,
                        usedUses: 0
                    } : feature);
                // Reset Pact Magic slots (if Warlock)
                let resetPactMagic = character.pactMagic;
                if (resetPactMagic) {
                    resetPactMagic = {
                        ...resetPactMagic,
                        slots: {
                            ...resetPactMagic.slots,
                            used: 0
                        }
                    };
                }
                // Reset reaction
                const resetReaction = {
                    hasUsedReaction: false
                };
                return {
                    character: {
                        ...character,
                        trackableTraits: resetTrackableTraits,
                        extendedFeatures: resetExtendedFeatures,
                        pactMagic: resetPactMagic,
                        reaction: resetReaction
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                };
            });
        },
        takeLongRest: ()=>{
            set((state)=>{
                const { character } = state;
                // Reset ALL abilities (both short and long rest)
                const resetTrackableTraits = character.trackableTraits.map((trait)=>({
                        ...trait,
                        usedUses: 0
                    }));
                const resetExtendedFeatures = character.extendedFeatures.map((feature)=>feature.isPassive ? feature : {
                        ...feature,
                        usedUses: 0
                    });
                // Reset ALL spell slots
                const resetSpellSlots = {
                    ...character.spellSlots
                };
                for(let level = 1; level <= 9; level++){
                    const slot = character.spellSlots[level];
                    if (slot) {
                        resetSpellSlots[level] = {
                            ...slot,
                            used: 0
                        };
                    }
                }
                // Reset Pact Magic slots (if Warlock)
                let resetPactMagic = character.pactMagic;
                if (resetPactMagic) {
                    resetPactMagic = {
                        ...resetPactMagic,
                        slots: {
                            ...resetPactMagic.slots,
                            used: 0
                        }
                    };
                }
                // Reset ALL hit dice
                const resetHitDicePools = {
                    ...character.hitDicePools
                };
                Object.keys(resetHitDicePools).forEach((dieType)=>{
                    resetHitDicePools[dieType] = {
                        ...resetHitDicePools[dieType],
                        used: 0
                    };
                });
                // Reset HP to max (remove temp HP, heal to full)
                const resetHitPoints = {
                    ...character.hitPoints,
                    current: character.hitPoints.max,
                    temporary: 0,
                    deathSaves: undefined
                };
                // Reset reaction
                const resetReaction = {
                    hasUsedReaction: false
                };
                // Reset temp AC
                const resetTempArmorClass = 0;
                return {
                    character: {
                        ...character,
                        trackableTraits: resetTrackableTraits,
                        extendedFeatures: resetExtendedFeatures,
                        spellSlots: resetSpellSlots,
                        pactMagic: resetPactMagic,
                        hitDicePools: resetHitDicePools,
                        hitPoints: resetHitPoints,
                        reaction: resetReaction,
                        tempArmorClass: resetTempArmorClass,
                        daysSpent: (character.daysSpent || 0) + 1
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                };
            });
        },
        // Campaign tracking
        updateDaysSpent: (days)=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        daysSpent: Math.max(0, days)
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        incrementDaysSpent: function() {
            let amount = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : 1;
            set((state)=>({
                    character: {
                        ...state.character,
                        daysSpent: Math.max(0, (state.character.daysSpent || 0) + amount)
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        updateCharacterBackground: (updates)=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        characterBackground: {
                            ...state.character.characterBackground,
                            ...updates
                        }
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        // Weapon management actions
        addWeapon: (weapon)=>{
            set((state)=>{
                const newWeapon = {
                    ...weapon,
                    id: generateId(),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                return {
                    character: {
                        ...state.character,
                        weapons: [
                            ...state.character.weapons,
                            newWeapon
                        ]
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                };
            });
        },
        updateWeapon: (id, updates)=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        weapons: state.character.weapons.map((weapon)=>weapon.id === id ? {
                                ...weapon,
                                ...updates,
                                updatedAt: new Date().toISOString()
                            } : weapon)
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        deleteWeapon: (id)=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        weapons: state.character.weapons.filter((weapon)=>weapon.id !== id)
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        equipWeapon: (id, equipped)=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        weapons: state.character.weapons.map((weapon)=>weapon.id === id ? {
                                ...weapon,
                                isEquipped: equipped,
                                updatedAt: new Date().toISOString()
                            } : weapon)
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        reorderWeapons: (sourceIndex, destinationIndex)=>{
            set((state)=>{
                const weapons = [
                    ...state.character.weapons
                ];
                const [removed] = weapons.splice(sourceIndex, 1);
                weapons.splice(destinationIndex, 0, removed);
                // Update all weapons with new timestamps
                const updatedWeapons = weapons.map((weapon)=>({
                        ...weapon,
                        updatedAt: new Date().toISOString()
                    }));
                return {
                    character: {
                        ...state.character,
                        weapons: updatedWeapons
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                };
            });
        },
        // Magic item management actions
        addMagicItem: (item)=>{
            set((state)=>{
                const newItem = {
                    ...item,
                    id: generateId(),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                return {
                    character: {
                        ...state.character,
                        magicItems: [
                            ...state.character.magicItems || [],
                            newItem
                        ]
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                };
            });
        },
        updateMagicItem: (id, updates)=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        magicItems: (state.character.magicItems || []).map((item)=>item.id === id ? {
                                ...item,
                                ...updates,
                                updatedAt: new Date().toISOString()
                            } : item)
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        deleteMagicItem: (id)=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        magicItems: (state.character.magicItems || []).filter((item)=>item.id !== id)
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        attuneMagicItem: (id, attuned)=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        magicItems: (state.character.magicItems || []).map((item)=>item.id === id ? {
                                ...item,
                                isAttuned: attuned,
                                updatedAt: new Date().toISOString()
                            } : item)
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        updateAttunementSlots: (max)=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        attunementSlots: {
                            ...state.character.attunementSlots,
                            max
                        }
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        reorderMagicItems: (sourceIndex, destinationIndex)=>{
            set((state)=>{
                const magicItems = [
                    ...state.character.magicItems || []
                ];
                const [removed] = magicItems.splice(sourceIndex, 1);
                magicItems.splice(destinationIndex, 0, removed);
                // Update all magic items with new timestamps
                const updatedMagicItems = magicItems.map((item)=>({
                        ...item,
                        updatedAt: new Date().toISOString()
                    }));
                return {
                    character: {
                        ...state.character,
                        magicItems: updatedMagicItems
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                };
            });
        },
        // Armor management
        addArmorItem: (item)=>{
            set((state)=>{
                const newItem = {
                    ...item,
                    id: generateId(),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                return {
                    character: {
                        ...state.character,
                        armorItems: [
                            ...state.character.armorItems || [],
                            newItem
                        ]
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                };
            });
        },
        updateArmorItem: (id, updates)=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        armorItems: state.character.armorItems.map((item)=>item.id === id ? {
                                ...item,
                                ...updates,
                                updatedAt: new Date().toISOString()
                            } : item)
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        deleteArmorItem: (id)=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        armorItems: state.character.armorItems.filter((item)=>item.id !== id)
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        equipArmorItem: (id, equipped)=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        armorItems: state.character.armorItems.map((item)=>item.id === id ? {
                                ...item,
                                isEquipped: equipped,
                                updatedAt: new Date().toISOString()
                            } : item)
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        reorderArmorItems: (sourceIndex, destinationIndex)=>{
            set((state)=>{
                const armorItems = [
                    ...state.character.armorItems
                ];
                const [removed] = armorItems.splice(sourceIndex, 1);
                armorItems.splice(destinationIndex, 0, removed);
                // Update all armor items with new timestamps
                const updatedArmorItems = armorItems.map((item)=>({
                        ...item,
                        updatedAt: new Date().toISOString()
                    }));
                return {
                    character: {
                        ...state.character,
                        armorItems: updatedArmorItems
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                };
            });
        },
        // Inventory management
        addInventoryItem: (item)=>{
            set((state)=>{
                const newItem = {
                    ...item,
                    id: generateId(),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                return {
                    character: {
                        ...state.character,
                        inventoryItems: [
                            ...state.character.inventoryItems || [],
                            newItem
                        ]
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                };
            });
        },
        updateInventoryItem: (id, updates)=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        inventoryItems: state.character.inventoryItems.map((item)=>item.id === id ? {
                                ...item,
                                ...updates,
                                updatedAt: new Date().toISOString()
                            } : item)
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        deleteInventoryItem: (id)=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        inventoryItems: state.character.inventoryItems.filter((item)=>item.id !== id)
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        updateItemQuantity: (id, quantity)=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        inventoryItems: state.character.inventoryItems.map((item)=>item.id === id ? {
                                ...item,
                                quantity
                            } : item)
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        reorderInventoryItems: (sourceIndex, destinationIndex)=>{
            set((state)=>{
                const inventoryItems = [
                    ...state.character.inventoryItems
                ];
                const [removed] = inventoryItems.splice(sourceIndex, 1);
                inventoryItems.splice(destinationIndex, 0, removed);
                // Update all inventory items with new timestamps
                const updatedInventoryItems = inventoryItems.map((item)=>({
                        ...item,
                        updatedAt: new Date().toISOString()
                    }));
                return {
                    character: {
                        ...state.character,
                        inventoryItems: updatedInventoryItems
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                };
            });
        },
        // Currency management
        updateCurrency: (updates)=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        currency: {
                            ...state.character.currency,
                            ...updates
                        }
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        addCurrency: (type, amount)=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        currency: {
                            ...state.character.currency,
                            [type]: (state.character.currency[type] || 0) + amount
                        }
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        subtractCurrency: (type, amount)=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        currency: {
                            ...state.character.currency,
                            [type]: Math.max(0, (state.character.currency[type] || 0) - amount)
                        }
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        // Spellbook management
        addSpellToSpellbook: (spellId)=>{
            set((state)=>{
                const isAlreadyKnown = state.character.spellbook.knownSpells.includes(spellId);
                if (!isAlreadyKnown) {
                    return {
                        character: {
                            ...state.character,
                            spellbook: {
                                ...state.character.spellbook,
                                knownSpells: [
                                    ...state.character.spellbook.knownSpells,
                                    spellId
                                ]
                            }
                        },
                        hasUnsavedChanges: true,
                        saveStatus: 'saving'
                    };
                }
                return state;
            });
        },
        removeSpellFromSpellbook: (spellId)=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        spellbook: {
                            ...state.character.spellbook,
                            knownSpells: state.character.spellbook.knownSpells.filter((id)=>id !== spellId),
                            preparedSpells: state.character.spellbook.preparedSpells.filter((id)=>id !== spellId),
                            favoriteSpells: state.character.spellbook.favoriteSpells.filter((id)=>id !== spellId)
                        }
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        toggleSpellFavorite: (spellId)=>{
            set((state)=>{
                const isFavorite = state.character.spellbook.favoriteSpells.includes(spellId);
                return {
                    character: {
                        ...state.character,
                        spellbook: {
                            ...state.character.spellbook,
                            favoriteSpells: isFavorite ? state.character.spellbook.favoriteSpells.filter((id)=>id !== spellId) : [
                                ...state.character.spellbook.favoriteSpells,
                                spellId
                            ]
                        }
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                };
            });
        },
        prepareSpell: (spellId)=>{
            set((state)=>{
                const isAlreadyPrepared = state.character.spellbook.preparedSpells.includes(spellId);
                if (!isAlreadyPrepared) {
                    return {
                        character: {
                            ...state.character,
                            spellbook: {
                                ...state.character.spellbook,
                                preparedSpells: [
                                    ...state.character.spellbook.preparedSpells,
                                    spellId
                                ]
                            }
                        },
                        hasUnsavedChanges: true,
                        saveStatus: 'saving'
                    };
                }
                return state;
            });
        },
        unprepareSpell: (spellId)=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        spellbook: {
                            ...state.character.spellbook,
                            preparedSpells: state.character.spellbook.preparedSpells.filter((id)=>id !== spellId)
                        }
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        updateSpellbookSettings: (settings)=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        spellbook: {
                            ...state.character.spellbook,
                            spellbookSettings: {
                                ...state.character.spellbook.spellbookSettings,
                                ...settings
                            }
                        }
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        addCustomSpell: (spell)=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        spellbook: {
                            ...state.character.spellbook,
                            customSpells: [
                                ...state.character.spellbook.customSpells || [],
                                spell
                            ]
                        }
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        removeCustomSpell: (spellId)=>{
            set((state)=>({
                    character: {
                        ...state.character,
                        spellbook: {
                            ...state.character.spellbook,
                            customSpells: (state.character.spellbook.customSpells || []).filter((s)=>s.id !== spellId)
                        }
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                }));
        },
        reorderPreparedSpells: (sourceIndex, destinationIndex)=>{
            set((state)=>{
                const preparedSpells = [
                    ...state.character.spellbook.preparedSpells
                ];
                const [removed] = preparedSpells.splice(sourceIndex, 1);
                preparedSpells.splice(destinationIndex, 0, removed);
                return {
                    character: {
                        ...state.character,
                        spellbook: {
                            ...state.character.spellbook,
                            preparedSpells
                        }
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                };
            });
        },
        reorderSpells: (sourceIndex, destinationIndex)=>{
            set((state)=>{
                const spells = [
                    ...state.character.spells
                ];
                const [removed] = spells.splice(sourceIndex, 1);
                spells.splice(destinationIndex, 0, removed);
                return {
                    character: {
                        ...state.character,
                        spells
                    },
                    hasUnsavedChanges: true,
                    saveStatus: 'saving'
                };
            });
        },
        // Persistence actions
        saveCharacter: ()=>{
            try {
                // Save to localStorage (handled by persist middleware)
                set({
                    saveStatus: 'saved',
                    lastSaved: new Date(),
                    hasUnsavedChanges: false
                });
            } catch (error) {
                console.error('Failed to save character:', error);
                set({
                    saveStatus: 'error'
                });
            }
        },
        loadCharacter: (character)=>{
            set({
                character,
                saveStatus: 'saved',
                lastSaved: new Date(),
                hasUnsavedChanges: false
            });
        },
        resetCharacter: ()=>{
            set({
                character: {
                    ...__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEFAULT_CHARACTER_STATE"],
                    id: generateId()
                },
                saveStatus: 'saved',
                lastSaved: new Date(),
                hasUnsavedChanges: false
            });
        },
        exportCharacter: ()=>{
            const state = get();
            return {
                version: __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["APP_VERSION"],
                exportDate: new Date().toISOString(),
                character: state.character
            };
        },
        importCharacter: (exportData)=>{
            try {
                // Basic validation
                if (!exportData.character || typeof exportData.character !== 'object') {
                    throw new Error('Invalid character data');
                }
                // Version compatibility check (for future use)
                if (exportData.version && exportData.version !== __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["APP_VERSION"]) {
                    console.warn("Version mismatch: expected ".concat(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["APP_VERSION"], ", got ").concat(exportData.version));
                }
                set({
                    character: exportData.character,
                    saveStatus: 'saved',
                    lastSaved: new Date(),
                    hasUnsavedChanges: false
                });
                return true;
            } catch (error) {
                console.error('Failed to import character:', error);
                set({
                    saveStatus: 'error'
                });
                return false;
            }
        },
        // Auto-save control
        setSaveStatus: (status)=>{
            set({
                saveStatus: status
            });
        },
        markSaved: ()=>{
            set({
                saveStatus: 'saved',
                lastSaved: new Date(),
                hasUnsavedChanges: false
            });
        },
        markUnsaved: ()=>{
            set({
                hasUnsavedChanges: true,
                saveStatus: 'saving'
            });
        }
    }), {
    name: __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["STORAGE_KEY"],
    storage: (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$zustand$2f$esm$2f$middleware$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createJSONStorage"])(()=>localStorage),
    // Only persist the character data and save metadata
    partialize: (state)=>({
            character: state.character,
            lastSaved: state.lastSaved
        }),
    // Handle rehydration and migration
    onRehydrateStorage: ()=>(state)=>{
            if (state) {
                // Migrate character data if needed
                state.character = migrateCharacterData(state.character);
                state.saveStatus = 'saved';
                state.hasUnsavedChanges = false;
                state.hasHydrated = true;
            }
        }
}));
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=apps_web_src_store_a19950ea._.js.map