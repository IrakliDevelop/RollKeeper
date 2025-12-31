module.exports = [
"[project]/apps/web/.next-internal/server/app/api/classes/route/actions.js [app-rsc] (server actions loader, ecmascript)", ((__turbopack_context__, module, exports) => {

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
"[project]/apps/web/src/utils/referenceParser.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
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
"[project]/apps/web/src/utils/classDataLoader.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "loadAllClasses",
    ()=>loadAllClasses
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$fs__$5b$external$5d$__$28$fs$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/fs [external] (fs, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$path__$5b$external$5d$__$28$path$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/path [external] (path, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$referenceParser$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/utils/referenceParser.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$sourceUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/utils/sourceUtils.ts [app-route] (ecmascript)");
;
;
;
;
// Cache for loaded classes to avoid reprocessing
let cachedClasses = null;
/**
 * Load all class JSON files from the json/class directory
 */ async function loadClassFiles() {
    const classDir = __TURBOPACK__imported__module__$5b$externals$5d2f$path__$5b$external$5d$__$28$path$2c$__cjs$29$__["default"].join(process.cwd(), 'json', 'class');
    const files = await __TURBOPACK__imported__module__$5b$externals$5d2f$fs__$5b$external$5d$__$28$fs$2c$__cjs$29$__["promises"].readdir(classDir);
    const classFiles = files.filter((file)=>file.endsWith('.json'));
    const allClassData = [];
    for (const file of classFiles){
        try {
            const filePath = __TURBOPACK__imported__module__$5b$externals$5d2f$path__$5b$external$5d$__$28$path$2c$__cjs$29$__["default"].join(classDir, file);
            const fileContent = await __TURBOPACK__imported__module__$5b$externals$5d2f$fs__$5b$external$5d$__$28$fs$2c$__cjs$29$__["promises"].readFile(filePath, 'utf-8');
            const data = JSON.parse(fileContent);
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
 */ function generateClassId(name, source) {
    return `${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${source.toLowerCase()}`;
}
/**
 * Generate a unique ID for a subclass
 */ function generateSubclassId(name, className, source) {
    return `${className.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${source.toLowerCase()}`;
}
/**
 * Convert hit die data to readable string
 */ function formatHitDie(hd) {
    if (!hd || !hd.faces) {
        return 'd8'; // Default hit die if not specified
    }
    return `d${hd.faces}`;
}
/**
 * Determine spellcasting type from class data
 */ function determineSpellcastingType(classData) {
    if (classData.casterProgression) {
        return classData.casterProgression;
    }
    // Fallback logic based on class name
    const className = classData.name.toLowerCase();
    if (className.includes('warlock')) return 'warlock';
    if ([
        'wizard',
        'sorcerer',
        'bard',
        'cleric',
        'druid'
    ].some((c)=>className.includes(c))) {
        return 'full';
    }
    if ([
        'paladin',
        'ranger'
    ].some((c)=>className.includes(c))) {
        return 'half';
    }
    if ([
        'eldritch knight',
        'arcane trickster'
    ].some((c)=>className.includes(c))) {
        return 'third';
    }
    return 'none';
}
/**
 * Extract skill choices from starting proficiencies
 */ function extractSkillChoices(skills) {
    if (!skills || skills.length === 0) return undefined;
    for (const skill of skills){
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
 */ function processMulticlassingRequirements(requirements) {
    if (!requirements) return {};
    // Handle OR requirements (e.g., Fighter needs STR 13 OR DEX 13)
    if (requirements.or && Array.isArray(requirements.or)) {
        // For now, take the first option in OR requirements
        const firstOption = requirements.or[0];
        if (firstOption && typeof firstOption === 'object') {
            return firstOption;
        }
    }
    // Handle direct requirements (e.g., Paladin needs STR 13 AND CHA 13)
    const result = {};
    for (const [key, value] of Object.entries(requirements)){
        if (key !== 'or' && typeof value === 'number') {
            result[key] = value;
        }
    }
    return result;
}
/**
 * Clean and format equipment strings
 */ function formatEquipment(equipment) {
    if (!equipment) return [];
    return equipment.map((item)=>{
        // Ensure item is a string before processing
        const itemStr = typeof item === 'string' ? item : String(item);
        // Parse references and return the HTML with proper styling
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$referenceParser$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["parseReferences"])(itemStr).html;
    });
}
/**
 * Process class features and extract descriptions
 */ function processClassFeatures(classFeatures, classFeatureDescriptions, className, source) {
    if (!classFeatures || !Array.isArray(classFeatures)) return [];
    const features = classFeatures.map((feature)=>{
        let featureName;
        let level = 1;
        let isSubclassFeature = false;
        let original;
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
        const featureDesc = classFeatureDescriptions?.find((desc)=>desc.name === featureName && desc.className === className && desc.level === level);
        let entries = [];
        if (featureDesc?.entries && Array.isArray(featureDesc.entries)) {
            entries = processFeatureEntries(featureDesc.entries);
        }
        return {
            name: featureName,
            level,
            source: featureDesc?.source || source,
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
 */ function processSubclassFeatures(subclassFeatures, subclassFeatureDescriptions, className, source, subclassShortName) {
    if (!subclassFeatureDescriptions || !Array.isArray(subclassFeatureDescriptions)) return [];
    // Instead of processing subclassFeatures references, directly process all individual subclass features
    // that belong to this specific subclass
    const relevantFeatures = subclassFeatureDescriptions.filter((desc)=>{
        const feature = desc;
        return feature.className === className && feature.subclassShortName === subclassShortName && feature.name && feature.level;
    });
    const features = relevantFeatures.map((featureDesc)=>{
        const feature = featureDesc;
        let entries = [];
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
 */ function processFeatureEntries(entries) {
    const result = [];
    for (const entry of entries){
        if (typeof entry === 'string') {
            result.push((0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$referenceParser$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["parseReferences"])(entry).html);
        } else if (entry && typeof entry === 'object') {
            const entryObj = entry;
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
                for (const item of entryObj.items){
                    if (typeof item === 'string') {
                        result.push(`<li>${(0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$referenceParser$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["parseReferences"])(item).html}</li>`);
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
 */ function extractSpellSlotProgression(classData) {
    if (!classData.classTableGroups) return undefined;
    for (const group of classData.classTableGroups){
        if (group.title?.includes('Spell Slots') && group.rowsSpellProgression) {
            const progression = {};
            group.rowsSpellProgression.forEach((row, levelIndex)=>{
                const level = levelIndex + 1;
                progression[level] = {};
                row.forEach((slots, spellLevelIndex)=>{
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
 */ function processClass(rawClass, subclasses, fileData) {
    const id = generateClassId(rawClass.name, rawClass.source);
    const spellcastingType = determineSpellcastingType(rawClass);
    // Process subclasses for this class
    // Match subclasses by className and classSource to ensure correct version pairing
    const processedSubclasses = subclasses.filter((sub)=>sub.className === rawClass.name && sub.classSource === rawClass.source).map((sub)=>processSubclass(sub, fileData)).sort((a, b)=>{
        // First sort by source priority (PHB2024 > SRD > PHB > others)
        const sourcePriority = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$sourceUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["compareSourcePriority"])(a.source, b.source);
        if (sourcePriority !== 0) return sourcePriority;
        // Then sort alphabetically by name
        return a.name.localeCompare(b.name);
    });
    return {
        id,
        name: rawClass.name,
        source: (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$sourceUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["formatSourceForDisplay"])(rawClass.source),
        page: rawClass.page,
        hitDie: formatHitDie(rawClass.hd),
        primaryAbilities: rawClass.proficiency || [],
        spellcasting: {
            type: spellcastingType,
            ability: rawClass.spellcastingAbility,
            preparedSpellsFormula: rawClass.preparedSpells,
            cantripProgression: rawClass.cantripProgression,
            spellsKnownProgression: rawClass.spellsKnownProgressionFixed
        },
        proficiencies: {
            armor: formatEquipment(rawClass.startingProficiencies?.armor),
            weapons: formatEquipment(rawClass.startingProficiencies?.weapons),
            tools: formatEquipment(rawClass.startingProficiencies?.tools),
            savingThrows: rawClass.proficiency || [],
            skillChoices: extractSkillChoices(rawClass.startingProficiencies?.skills)
        },
        startingEquipment: formatEquipment(rawClass.startingEquipment?.default),
        multiclassing: rawClass.multiclassing ? {
            requirements: processMulticlassingRequirements(rawClass.multiclassing.requirements),
            proficienciesGained: {
                armor: formatEquipment(rawClass.multiclassing.proficienciesGained?.armor),
                weapons: formatEquipment(rawClass.multiclassing.proficienciesGained?.weapons),
                tools: formatEquipment(rawClass.multiclassing.proficienciesGained?.tools)
            }
        } : undefined,
        features: processClassFeatures(rawClass.classFeatures || [], fileData.classFeature || [], rawClass.name, rawClass.source),
        spellSlotProgression: extractSpellSlotProgression(rawClass),
        subclasses: processedSubclasses,
        isSrd: rawClass.srd || false,
        tags: [
            rawClass.source || 'unknown',
            spellcastingType,
            rawClass.spellcastingAbility || 'none',
            formatHitDie(rawClass.hd),
            ...rawClass.edition ? [
                rawClass.edition
            ] : []
        ]
    };
}
/**
 * Prioritize 2024 features over 2014 features when both exist for the same level and name
 */ function prioritize2024Features(features) {
    const featureMap = new Map();
    // Group features by level and name
    for (const feature of features){
        const key = `${feature.level}-${feature.name}`;
        if (!featureMap.has(key)) {
            featureMap.set(key, []);
        }
        featureMap.get(key).push(feature);
    }
    const prioritizedFeatures = [];
    // For each group, prioritize 2024 version if available
    for (const [, featureGroup] of featureMap.entries()){
        if (featureGroup.length === 1) {
            // Only one version, use it
            prioritizedFeatures.push(featureGroup[0]);
        } else {
            // Multiple versions - find 2024 version
            const rules2024Feature = featureGroup.find((f)=>f.is2024Rules);
            if (rules2024Feature) {
                prioritizedFeatures.push(rules2024Feature);
            } else {
                // No 2024 version found, use the first one (should be prioritized by source already)
                prioritizedFeatures.push(featureGroup[0]);
            }
        }
    }
    return prioritizedFeatures.sort((a, b)=>a.level - b.level);
}
/**
 * Clean spell name by removing source suffix (e.g., "fireball|xphb" -> "fireball")
 */ function cleanSpellName(spellName) {
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
            const spellObj = spellName;
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
 */ function processSubclassSpells(additionalSpells) {
    if (!additionalSpells || additionalSpells.length === 0) return [];
    const spellList = [];
    additionalSpells.forEach((spellGroup)=>{
        // Process prepared spells (most common for Domain, Oath, etc.)
        if (spellGroup.prepared) {
            Object.entries(spellGroup.prepared).forEach(([level, spells])=>{
                // Handle various spell list formats
                let cleanedSpells = [];
                try {
                    if (Array.isArray(spells) && typeof spells.map === 'function') {
                        cleanedSpells = spells.map(cleanSpellName).filter((name)=>typeof name === 'string' && name.trim().length > 0);
                    } else if (typeof spells === 'string') {
                        const cleaned = cleanSpellName(spells);
                        if (cleaned && cleaned.trim().length > 0) {
                            cleanedSpells = [
                                cleaned
                            ];
                        }
                    } else if (spells && typeof spells === 'object') {
                        // Handle object format - might be a single spell object
                        const cleaned = cleanSpellName(spells);
                        if (cleaned && cleaned.trim().length > 0) {
                            cleanedSpells = [
                                cleaned
                            ];
                        }
                    }
                    // Additional validation - ensure all entries are valid strings
                    cleanedSpells = cleanedSpells.filter((spell)=>typeof spell === 'string' && spell.trim().length > 0 && !spell.includes('[object Object]'));
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
            Object.entries(spellGroup.known).forEach(([level, spells])=>{
                // Handle various spell list formats
                let cleanedSpells = [];
                try {
                    if (Array.isArray(spells) && typeof spells.map === 'function') {
                        cleanedSpells = spells.map(cleanSpellName).filter((name)=>typeof name === 'string' && name.trim().length > 0);
                    } else if (typeof spells === 'string') {
                        const cleaned = cleanSpellName(spells);
                        if (cleaned && cleaned.trim().length > 0) {
                            cleanedSpells = [
                                cleaned
                            ];
                        }
                    } else if (spells && typeof spells === 'object') {
                        // Handle object format - might be a single spell object
                        const cleaned = cleanSpellName(spells);
                        if (cleaned && cleaned.trim().length > 0) {
                            cleanedSpells = [
                                cleaned
                            ];
                        }
                    }
                    // Additional validation - ensure all entries are valid strings
                    cleanedSpells = cleanedSpells.filter((spell)=>typeof spell === 'string' && spell.trim().length > 0 && !spell.includes('[object Object]'));
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
            Object.entries(spellGroup.expanded).forEach(([level, spells])=>{
                // Handle various spell list formats
                let cleanedSpells = [];
                try {
                    if (Array.isArray(spells) && typeof spells.map === 'function') {
                        cleanedSpells = spells.map(cleanSpellName).filter((name)=>typeof name === 'string' && name.trim().length > 0);
                    } else if (typeof spells === 'string') {
                        const cleaned = cleanSpellName(spells);
                        if (cleaned && cleaned.trim().length > 0) {
                            cleanedSpells = [
                                cleaned
                            ];
                        }
                    } else if (spells && typeof spells === 'object') {
                        // Handle object format - might be a single spell object
                        const cleaned = cleanSpellName(spells);
                        if (cleaned && cleaned.trim().length > 0) {
                            cleanedSpells = [
                                cleaned
                            ];
                        }
                    }
                    // Additional validation - ensure all entries are valid strings
                    cleanedSpells = cleanedSpells.filter((spell)=>typeof spell === 'string' && spell.trim().length > 0 && !spell.includes('[object Object]'));
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
    return spellList.sort((a, b)=>a.level - b.level);
}
/**
 * Process raw subclass data into our application format
 */ function processSubclass(rawSubclass, fileData) {
    const id = generateSubclassId(rawSubclass.name, rawSubclass.className, rawSubclass.source);
    return {
        id,
        name: rawSubclass.name,
        shortName: rawSubclass.shortName,
        source: (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$sourceUtils$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["formatSourceForDisplay"])(rawSubclass.source),
        page: rawSubclass.page,
        parentClassName: rawSubclass.className,
        parentClassSource: rawSubclass.classSource,
        features: processSubclassFeatures(rawSubclass.subclassFeatures || [], fileData.subclassFeature || [], rawSubclass.className, rawSubclass.source, rawSubclass.shortName || rawSubclass.name),
        spellList: (()=>{
            try {
                // Only process spell lists for classes that should have them
                const classesWithSubclassSpells = [
                    'Cleric',
                    'Paladin',
                    'Warlock',
                    'Sorcerer',
                    'Ranger'
                ];
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
            ...rawSubclass.edition ? [
                rawSubclass.edition
            ] : []
        ]
    };
}
async function loadAllClasses() {
    // Return cached classes if available
    if (cachedClasses) {
        return cachedClasses;
    }
    try {
        const classDataFiles = await loadClassFiles();
        const processedClasses = [];
        for (const classFile of classDataFiles){
            // Process each class in the file
            for (const rawClass of classFile.class || []){
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
        // Sort classes: 2024 versions first, then 2014 versions, then alphabetically by name
        processedClasses.sort((a, b)=>{
            // First, prioritize 2024 versions
            const aIs2024 = a.source === 'PHB2024';
            const bIs2024 = b.source === 'PHB2024';
            if (aIs2024 && !bIs2024) return -1;
            if (!aIs2024 && bIs2024) return 1;
            // Then sort alphabetically by name
            return a.name.localeCompare(b.name);
        });
        cachedClasses = processedClasses;
        console.log(`Loaded ${cachedClasses.length} classes (including both 2014 and 2024 versions)`);
        return cachedClasses;
    } catch (error) {
        console.error('Error loading classes:', error);
        return [];
    }
}
}),
"[project]/apps/web/src/app/api/classes/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>GET
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$classDataLoader$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/utils/classDataLoader.ts [app-route] (ecmascript)");
;
;
async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = searchParams.get('limit');
        const offset = searchParams.get('offset');
        // Load all class data
        const classes = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$classDataLoader$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["loadAllClasses"])();
        // Apply pagination if requested
        if (limit && offset) {
            const limitNum = parseInt(limit, 10);
            const offsetNum = parseInt(offset, 10);
            const paginatedClasses = classes.slice(offsetNum, offsetNum + limitNum);
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                classes: paginatedClasses,
                total: classes.length,
                hasMore: offsetNum + limitNum < classes.length
            });
        }
        // Return all classes
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            classes,
            total: classes.length,
            hasMore: false
        });
    } catch (error) {
        console.error('Error loading classes:', error);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: 'Failed to load class data'
        }, {
            status: 500
        });
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__cc0a98f6._.js.map