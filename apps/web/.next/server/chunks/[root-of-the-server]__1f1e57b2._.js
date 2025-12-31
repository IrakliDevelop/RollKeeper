module.exports = [
"[project]/apps/web/.next-internal/server/app/api/feats/route/actions.js [app-rsc] (server actions loader, ecmascript)", ((__turbopack_context__, module, exports) => {

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
"[project]/apps/web/src/utils/featDataLoader.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Feat Data Loader
 * Loads and processes feat data from JSON files
 * Similar structure to backgroundDataLoader.ts
 */ __turbopack_context__.s([
    "clearFeatCache",
    ()=>clearFeatCache,
    "getFeatByName",
    ()=>getFeatByName,
    "loadAllFeats",
    ()=>loadAllFeats,
    "searchFeats",
    ()=>searchFeats
]);
(()=>{
    const e = new Error("Cannot find module '../../json/feats.json'");
    e.code = 'MODULE_NOT_FOUND';
    throw e;
})();
;
// Cache for processed feats
let cachedFeats = null;
/**
 * Generate unique ID for feat
 */ function generateFeatId(name, source) {
    return `${name.toLowerCase().replace(/\s+/g, '-')}-${source.toLowerCase()}`;
}
/**
 * Format source for display
 */ function formatSourceForDisplay(source) {
    const sourceMap = {
        PHB: "Player's Handbook",
        XPHB: "Player's Handbook (2024)",
        DMG: "Dungeon Master's Guide",
        XDMG: "Dungeon Master's Guide (2024)",
        SCAG: "Sword Coast Adventurer's Guide",
        XGTE: "Xanathar's Guide to Everything",
        TCE: "Tasha's Cauldron of Everything",
        VRGTR: "Van Richten's Guide to Ravenloft",
        MPMM: 'Mordenkainen Presents: Monsters of the Multiverse',
        ERLW: 'Eberron: Rising from the Last War',
        GGTR: "Guildmasters' Guide to Ravnica",
        MOT: 'Mythic Odysseys of Theros',
        AI: 'Acquisitions Incorporated',
        FTD: "Fizban's Treasury of Dragons"
    };
    return sourceMap[source] || source;
}
/**
 * Parse feat entries to extract descriptions
 */ function parseFeatEntries(entries) {
    return entries.map((entry)=>{
        if (typeof entry === 'string') {
            return entry;
        }
        // Handle nested entry objects
        if (entry && typeof entry === 'object') {
            const obj = entry;
            // Handle nested entries
            if (obj.type === 'entries' && Array.isArray(obj.entries)) {
                let result = '';
                if (obj.name) {
                    result += `**${obj.name}**\n\n`;
                }
                result += parseFeatEntries(obj.entries);
                return result;
            }
            // Handle lists
            if (obj.type === 'list' && Array.isArray(obj.items)) {
                return obj.items.map((item)=>{
                    if (typeof item === 'string') return `• ${item}`;
                    if (item && typeof item === 'object') {
                        const itemObj = item;
                        if (itemObj.type === 'item') {
                            const itemText = itemObj.entry || itemObj.name || '';
                            return `• ${itemText}`;
                        }
                    }
                    return '';
                }).filter(Boolean).join('\n');
            }
            // Handle tables
            if (obj.type === 'table') {
                return '_(See table in source material)_';
            }
            // Handle sections
            if (obj.type === 'section' && Array.isArray(obj.entries)) {
                return parseFeatEntries(obj.entries);
            }
        }
        return '';
    }).filter(Boolean).join('\n\n');
}
/**
 * Parse prerequisites into human-readable format
 */ function parsePrerequisites(prerequisite) {
    if (!prerequisite || prerequisite.length === 0) return [];
    const prereqs = [];
    prerequisite.forEach((prereq)=>{
        if (prereq.level) {
            prereqs.push(`Level ${prereq.level}+`);
        }
        if (prereq.ability) {
            prereq.ability.forEach((abilityReq)=>{
                Object.entries(abilityReq).forEach(([ability, value])=>{
                    const abilityName = ability.toUpperCase();
                    prereqs.push(`${abilityName} ${value}+`);
                });
            });
        }
        if (prereq.spellcasting) {
            prereqs.push('Spellcasting or Pact Magic feature');
        }
        if (prereq.proficiency) {
            prereq.proficiency.forEach((prof)=>{
                if (prof.armor) {
                    prereqs.push(`Proficiency with ${prof.armor} armor`);
                }
                if (prof.weapon) {
                    prereqs.push(`Proficiency with ${prof.weapon}`);
                }
            });
        }
        if (prereq.other) {
            prereqs.push(prereq.other);
        }
    });
    return prereqs;
}
/**
 * Parse ability score increases
 */ function parseAbilityIncreases(ability) {
    if (!ability || ability.length === 0) return '';
    const increases = [];
    ability.forEach((abilityObj)=>{
        Object.entries(abilityObj).forEach(([key, value])=>{
            if (key === 'choose' && typeof value === 'object' && value !== null) {
                const choice = value;
                if (choice.from && choice.amount) {
                    const abilities = choice.from.map((a)=>a.toUpperCase()).join(', ');
                    increases.push(`Increase ${choice.amount} ability score${choice.amount > 1 ? 's' : ''} from: ${abilities}`);
                }
            } else if (typeof value === 'number') {
                increases.push(`+${value} ${key.toUpperCase()}`);
            } else if (key === 'hidden') {
            // Skip hidden entries
            }
        });
    });
    return increases.join('; ') || '';
}
/**
 * Check if feat grants spells
 */ function grantsSpells(feat) {
    return !!(feat.additionalSpells && feat.additionalSpells.length > 0);
}
/**
 * Process raw feat data into our application format
 */ function processFeat(rawFeat) {
    const id = generateFeatId(rawFeat.name, rawFeat.source);
    const description = parseFeatEntries(rawFeat.entries);
    const prerequisites = parsePrerequisites(rawFeat.prerequisite);
    const abilityIncreases = parseAbilityIncreases(rawFeat.ability);
    return {
        id,
        name: rawFeat.name,
        source: formatSourceForDisplay(rawFeat.source),
        page: rawFeat.page,
        description,
        prerequisites,
        abilityIncreases,
        category: rawFeat.category,
        repeatable: rawFeat.repeatable || false,
        grantsSpells: grantsSpells(rawFeat),
        isSrd: rawFeat.srd || rawFeat.srd52 || rawFeat.basicRules || rawFeat.basicRules2024 || false,
        tags: [
            rawFeat.source,
            ...rawFeat.category ? [
                rawFeat.category
            ] : [],
            ...prerequisites.length > 0 ? [
                'has-prerequisites'
            ] : [],
            ...abilityIncreases ? [
                'ability-increase'
            ] : [],
            ...grantsSpells(rawFeat) ? [
                'grants-spells'
            ] : []
        ]
    };
}
async function loadAllFeats() {
    // Return cached feats if available
    if (cachedFeats) {
        return cachedFeats;
    }
    try {
        const rawFeats = featsData.feat;
        const processedFeats = rawFeats.map((feat)=>processFeat(feat));
        // Cache the processed feats
        cachedFeats = processedFeats;
        console.log(`Loaded ${processedFeats.length} feats`);
        return processedFeats;
    } catch (error) {
        console.error('Error loading feats:', error);
        throw error;
    }
}
function clearFeatCache() {
    cachedFeats = null;
}
async function getFeatByName(name) {
    const feats = await loadAllFeats();
    return feats.find((feat)=>feat.name.toLowerCase() === name.toLowerCase());
}
async function searchFeats(query) {
    if (!query.trim()) {
        return loadAllFeats();
    }
    const feats = await loadAllFeats();
    const queryLower = query.toLowerCase().trim();
    return feats.filter((feat)=>feat.name.toLowerCase().includes(queryLower) || feat.description.toLowerCase().includes(queryLower) || feat.prerequisites.some((p)=>p.toLowerCase().includes(queryLower)) || feat.tags.some((t)=>t.toLowerCase().includes(queryLower)));
}
}),
"[project]/apps/web/src/app/api/feats/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>GET
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$featDataLoader$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/utils/featDataLoader.ts [app-route] (ecmascript)");
;
;
async function GET() {
    try {
        const feats = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$featDataLoader$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["loadAllFeats"])();
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            feats,
            total: feats.length
        });
    } catch (error) {
        console.error('Error loading feats:', error);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: 'Failed to load feat data'
        }, {
            status: 500
        });
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__1f1e57b2._.js.map