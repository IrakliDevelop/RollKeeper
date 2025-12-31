module.exports = [
"[project]/apps/web/.next-internal/server/app/api/backgrounds/route/actions.js [app-rsc] (server actions loader, ecmascript)", ((__turbopack_context__, module, exports) => {

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
"[project]/apps/web/src/utils/backgroundDataLoader.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Background Data Loader
 * Loads and processes background data from JSON files
 * Similar structure to spellDataLoader.ts
 */ __turbopack_context__.s([
    "clearBackgroundCache",
    ()=>clearBackgroundCache,
    "getBackgroundByName",
    ()=>getBackgroundByName,
    "loadAllBackgroundFeatures",
    ()=>loadAllBackgroundFeatures,
    "loadAllBackgrounds",
    ()=>loadAllBackgrounds
]);
(()=>{
    const e = new Error("Cannot find module '../../json/backgrounds.json'");
    e.code = 'MODULE_NOT_FOUND';
    throw e;
})();
;
// Cache for processed backgrounds
let cachedBackgrounds = null;
let cachedFeatures = null;
/**
 * Generate unique ID for background
 */ function generateBackgroundId(name, source) {
    return `${name.toLowerCase().replace(/\s+/g, '-')}-${source.toLowerCase()}`;
}
/**
 * Generate unique ID for background feature
 */ function generateFeatureId(featureName, backgroundName, source) {
    return `${featureName.toLowerCase().replace(/\s+/g, '-')}-${backgroundName.toLowerCase().replace(/\s+/g, '-')}-${source.toLowerCase()}`;
}
/**
 * Format source for display
 */ function formatSourceForDisplay(source) {
    const sourceMap = {
        PHB: "Player's Handbook",
        XPHB: "Player's Handbook (2024)",
        DMG: "Dungeon Master's Guide",
        SCAG: "Sword Coast Adventurer's Guide",
        XGTE: "Xanathar's Guide to Everything",
        TCE: "Tasha's Cauldron of Everything",
        VRGTR: "Van Richten's Guide to Ravenloft",
        MPMM: 'Mordenkainen Presents: Monsters of the Multiverse',
        ERLW: 'Eberron: Rising from the Last War',
        GGTR: "Guildmasters' Guide to Ravnica",
        MOT: 'Mythic Odysseys of Theros',
        AI: 'Acquisitions Incorporated'
    };
    return sourceMap[source] || source;
}
/**
 * Parse background entries to extract feature descriptions
 */ function parseFeatureEntries(entries) {
    return entries.map((entry)=>{
        if (typeof entry === 'string') {
            return entry;
        }
        // Handle nested entry objects
        if (entry && typeof entry === 'object') {
            const obj = entry;
            // Handle nested entries
            if (obj.type === 'entries' && Array.isArray(obj.entries)) {
                return parseFeatureEntries(obj.entries);
            }
            // Handle lists
            if (obj.type === 'list' && Array.isArray(obj.items)) {
                return obj.items.map((item)=>{
                    if (typeof item === 'string') return item;
                    if (item && typeof item === 'object') {
                        const itemObj = item;
                        if (itemObj.type === 'item' && itemObj.entry) {
                            return `• ${itemObj.entry}`;
                        }
                    }
                    return '';
                }).filter(Boolean).join('\n');
            }
            // Handle tables - provide simplified text representation
            if (obj.type === 'table') {
                return '_(See table in source material)_';
            }
        }
        return '';
    }).filter(Boolean).join('\n\n');
}
/**
 * Extract skills from skill proficiencies
 */ function extractSkills(skillProficiencies) {
    if (!skillProficiencies || skillProficiencies.length === 0) return [];
    const skills = [];
    skillProficiencies.forEach((prof)=>{
        Object.keys(prof).forEach((key)=>{
            if (prof[key] === true) {
                // Convert to proper case
                const skill = key.replace(/([A-Z])/g, ' $1').trim();
                skills.push(skill.charAt(0).toUpperCase() + skill.slice(1));
            }
        });
    });
    return skills;
}
/**
 * Extract number of language proficiencies
 */ function extractLanguages(languageProficiencies) {
    if (!languageProficiencies || languageProficiencies.length === 0) return 0;
    let count = 0;
    languageProficiencies.forEach((prof)=>{
        if (prof.anyStandard) {
            count += prof.anyStandard;
        }
        if (prof.any) {
            count += prof.any;
        }
    });
    return count;
}
/**
 * Process raw background data into our application format
 */ function processBackground(rawBackground) {
    const id = generateBackgroundId(rawBackground.name, rawBackground.source);
    const skills = extractSkills(rawBackground.skillProficiencies);
    const languages = extractLanguages(rawBackground.languageProficiencies);
    // Extract features from entries (entries marked with data.isFeature: true)
    const features = [];
    // Check if entries exist before processing
    if (rawBackground.entries && Array.isArray(rawBackground.entries)) {
        rawBackground.entries.forEach((entry)=>{
            if (entry && typeof entry === 'object') {
                const entryObj = entry;
                // Check if this is a feature entry
                if (entryObj.data?.isFeature && entryObj.name && entryObj.entries) {
                    // Remove "Feature: " prefix if present
                    const featureName = entryObj.name.replace(/^Feature:\s*/i, '');
                    const featureDescription = parseFeatureEntries(entryObj.entries);
                    const feature = {
                        id: generateFeatureId(featureName, rawBackground.name, rawBackground.source),
                        name: featureName,
                        backgroundName: rawBackground.name,
                        source: formatSourceForDisplay(rawBackground.source),
                        page: rawBackground.page,
                        description: featureDescription,
                        skills: skills,
                        languages: languages > 0 ? languages : undefined,
                        isSrd: rawBackground.srd || false
                    };
                    features.push(feature);
                }
            }
        });
    }
    return {
        id,
        name: rawBackground.name,
        source: formatSourceForDisplay(rawBackground.source),
        page: rawBackground.page,
        features,
        skills,
        languages,
        isSrd: rawBackground.srd || false,
        tags: [
            rawBackground.source,
            ...skills.map((s)=>s.toLowerCase())
        ]
    };
}
async function loadAllBackgrounds() {
    // Return cached backgrounds if available
    if (cachedBackgrounds) {
        return cachedBackgrounds;
    }
    try {
        const rawBackgrounds = backgroundsData.background;
        const processedBackgrounds = rawBackgrounds.map((bg)=>processBackground(bg));
        // Cache the processed backgrounds
        cachedBackgrounds = processedBackgrounds;
        console.log(`Loaded ${processedBackgrounds.length} backgrounds`);
        return processedBackgrounds;
    } catch (error) {
        console.error('Error loading backgrounds:', error);
        throw error;
    }
}
async function loadAllBackgroundFeatures() {
    // Return cached features if available
    if (cachedFeatures) {
        return cachedFeatures;
    }
    try {
        const backgrounds = await loadAllBackgrounds();
        // Flatten all features from all backgrounds
        const allFeatures = backgrounds.flatMap((bg)=>bg.features);
        // Cache the features
        cachedFeatures = allFeatures;
        console.log(`Loaded ${allFeatures.length} background features from ${backgrounds.length} backgrounds`);
        return allFeatures;
    } catch (error) {
        console.error('Error loading background features:', error);
        throw error;
    }
}
function clearBackgroundCache() {
    cachedBackgrounds = null;
    cachedFeatures = null;
}
async function getBackgroundByName(name) {
    const backgrounds = await loadAllBackgrounds();
    return backgrounds.find((bg)=>bg.name.toLowerCase() === name.toLowerCase());
}
}),
"[project]/apps/web/src/app/api/backgrounds/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>GET
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$backgroundDataLoader$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/utils/backgroundDataLoader.ts [app-route] (ecmascript)");
;
;
async function GET() {
    try {
        const [backgrounds, features] = await Promise.all([
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$backgroundDataLoader$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["loadAllBackgrounds"])(),
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$backgroundDataLoader$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["loadAllBackgroundFeatures"])()
        ]);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            backgrounds,
            features,
            total: backgrounds.length
        });
    } catch (error) {
        console.error('Error loading backgrounds:', error);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: 'Failed to load background data'
        }, {
            status: 500
        });
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__3281e638._.js.map