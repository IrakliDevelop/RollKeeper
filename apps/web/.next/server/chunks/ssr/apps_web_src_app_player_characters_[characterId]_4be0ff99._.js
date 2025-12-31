module.exports = [
"[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "createCharacterSheetTabsConfig",
    ()=>createCharacterSheetTabsConfig
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$layout$2f$GroupedTabs$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/layout/GroupedTabs.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$feedback$2f$ErrorBoundary$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/feedback/ErrorBoundary.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$game$2f$ConditionsDiseasesManager$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/game/ConditionsDiseasesManager.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$character$2f$CharacterBackgroundEditor$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/character/CharacterBackgroundEditor.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$game$2f$FeaturesTraitsManager$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/game/FeaturesTraitsManager.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$game$2f$NotesManager$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/game/NotesManager.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$game$2f$InventoryManager$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/game/InventoryManager.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$game$2f$CurrencyManager$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/game/CurrencyManager.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$SpellcastingStats$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/SpellcastingStats.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$EnhancedSpellManagement$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/EnhancedSpellManagement.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$character$2f$EquipmentSection$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/character/EquipmentSection.tsx [app-ssr] (ecmascript)");
;
;
;
;
;
;
;
;
;
;
;
;
const createCharacterSheetTabsConfig = ({ character, hasHydrated, addFeature, updateFeature, deleteFeature, addTrait, updateTrait, deleteTrait, updateCharacterBackground, addNote, updateNote, deleteNote, reorderNotes, addToast })=>[
        {
            id: 'combat-magic',
            label: 'Combat & Magic',
            icon: '⚔️',
            defaultOpen: true,
            tabs: [
                {
                    id: 'spellcasting',
                    label: 'Spellcasting',
                    icon: '✨',
                    content: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$layout$2f$GroupedTabs$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["TabContent"], {
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "space-y-6",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$feedback$2f$ErrorBoundary$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                    fallback: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "rounded-lg border border-purple-200 bg-white p-4 shadow",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                className: "mb-4 text-lg font-bold text-purple-800",
                                                children: "Spellcasting Stats"
                                            }, void 0, false, {
                                                fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                                                lineNumber: 76,
                                                columnNumber: 21
                                            }, void 0),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-gray-500",
                                                children: "Unable to load spellcasting statistics"
                                            }, void 0, false, {
                                                fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                                                lineNumber: 79,
                                                columnNumber: 21
                                            }, void 0)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                                        lineNumber: 75,
                                        columnNumber: 19
                                    }, void 0),
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$SpellcastingStats$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SpellcastingStats"], {}, void 0, false, {
                                        fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                                        lineNumber: 85,
                                        columnNumber: 17
                                    }, ("TURBOPACK compile-time value", void 0))
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                                    lineNumber: 73,
                                    columnNumber: 15
                                }, ("TURBOPACK compile-time value", void 0)),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$feedback$2f$ErrorBoundary$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                    fallback: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "rounded-lg border border-purple-200 bg-white p-4 shadow",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                className: "mb-4 text-lg font-bold text-purple-800",
                                                children: "Spells & Cantrips"
                                            }, void 0, false, {
                                                fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                                                lineNumber: 92,
                                                columnNumber: 21
                                            }, void 0),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-gray-500",
                                                children: "Unable to load spell management"
                                            }, void 0, false, {
                                                fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                                                lineNumber: 95,
                                                columnNumber: 21
                                            }, void 0)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                                        lineNumber: 91,
                                        columnNumber: 19
                                    }, void 0),
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$EnhancedSpellManagement$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["EnhancedSpellManagement"], {}, void 0, false, {
                                        fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                                        lineNumber: 101,
                                        columnNumber: 17
                                    }, ("TURBOPACK compile-time value", void 0))
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                                    lineNumber: 89,
                                    columnNumber: 15
                                }, ("TURBOPACK compile-time value", void 0))
                            ]
                        }, void 0, true, {
                            fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                            lineNumber: 71,
                            columnNumber: 13
                        }, ("TURBOPACK compile-time value", void 0))
                    }, void 0, false, {
                        fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                        lineNumber: 70,
                        columnNumber: 11
                    }, ("TURBOPACK compile-time value", void 0))
                },
                {
                    id: 'equipment',
                    label: 'Equipment',
                    icon: '🛡️',
                    content: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$layout$2f$GroupedTabs$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["TabContent"], {
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$character$2f$EquipmentSection$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                            character: character
                        }, void 0, false, {
                            fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                            lineNumber: 113,
                            columnNumber: 13
                        }, ("TURBOPACK compile-time value", void 0))
                    }, void 0, false, {
                        fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                        lineNumber: 112,
                        columnNumber: 11
                    }, ("TURBOPACK compile-time value", void 0))
                },
                {
                    id: 'conditions',
                    label: 'Conditions & Diseases',
                    icon: '🤒',
                    content: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$layout$2f$GroupedTabs$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["TabContent"], {
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$feedback$2f$ErrorBoundary$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                            fallback: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "rounded-lg border border-red-200 bg-white p-6 shadow-lg",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                        className: "mb-4 text-lg font-bold text-red-800",
                                        children: "Conditions & Diseases"
                                    }, void 0, false, {
                                        fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                                        lineNumber: 126,
                                        columnNumber: 19
                                    }, void 0),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-gray-500",
                                        children: "Unable to load conditions and diseases manager"
                                    }, void 0, false, {
                                        fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                                        lineNumber: 129,
                                        columnNumber: 19
                                    }, void 0)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                                lineNumber: 125,
                                columnNumber: 17
                            }, void 0),
                            children: hasHydrated ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$game$2f$ConditionsDiseasesManager$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
                                fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                                lineNumber: 136,
                                columnNumber: 17
                            }, ("TURBOPACK compile-time value", void 0)) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "rounded-lg border border-gray-200 bg-white p-6 shadow-lg",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "py-4 text-center",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                                            lineNumber: 140,
                                            columnNumber: 21
                                        }, ("TURBOPACK compile-time value", void 0)),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "mt-2 text-gray-600",
                                            children: "Loading conditions and diseases..."
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                                            lineNumber: 141,
                                            columnNumber: 21
                                        }, ("TURBOPACK compile-time value", void 0))
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                                    lineNumber: 139,
                                    columnNumber: 19
                                }, ("TURBOPACK compile-time value", void 0))
                            }, void 0, false, {
                                fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                                lineNumber: 138,
                                columnNumber: 17
                            }, ("TURBOPACK compile-time value", void 0))
                        }, void 0, false, {
                            fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                            lineNumber: 123,
                            columnNumber: 13
                        }, ("TURBOPACK compile-time value", void 0))
                    }, void 0, false, {
                        fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                        lineNumber: 122,
                        columnNumber: 11
                    }, ("TURBOPACK compile-time value", void 0))
                }
            ]
        },
        {
            id: 'items-wealth',
            label: 'Items & Wealth',
            icon: '💰',
            defaultOpen: false,
            tabs: [
                {
                    id: 'inventory',
                    label: 'Inventory',
                    icon: '🎒',
                    content: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$layout$2f$GroupedTabs$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["TabContent"], {
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "max-w-none",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$feedback$2f$ErrorBoundary$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                fallback: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "rounded-lg border border-purple-200 bg-white p-6 shadow-lg",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                            className: "mb-4 text-lg font-bold text-purple-800",
                                            children: "Inventory"
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                                            lineNumber: 169,
                                            columnNumber: 21
                                        }, void 0),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-gray-500",
                                            children: "Unable to load inventory management"
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                                            lineNumber: 172,
                                            columnNumber: 21
                                        }, void 0)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                                    lineNumber: 168,
                                    columnNumber: 19
                                }, void 0),
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$game$2f$InventoryManager$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
                                    fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                                    lineNumber: 178,
                                    columnNumber: 17
                                }, ("TURBOPACK compile-time value", void 0))
                            }, void 0, false, {
                                fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                                lineNumber: 166,
                                columnNumber: 15
                            }, ("TURBOPACK compile-time value", void 0))
                        }, void 0, false, {
                            fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                            lineNumber: 165,
                            columnNumber: 13
                        }, ("TURBOPACK compile-time value", void 0))
                    }, void 0, false, {
                        fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                        lineNumber: 164,
                        columnNumber: 11
                    }, ("TURBOPACK compile-time value", void 0))
                },
                {
                    id: 'currency',
                    label: 'Currency',
                    icon: '💰',
                    content: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$layout$2f$GroupedTabs$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["TabContent"], {
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "mx-auto max-w-4xl",
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$feedback$2f$ErrorBoundary$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                fallback: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "rounded-lg border border-yellow-200 bg-white p-6 shadow-lg",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                            className: "mb-4 text-lg font-bold text-amber-800",
                                            children: "Currency"
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                                            lineNumber: 194,
                                            columnNumber: 21
                                        }, void 0),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                            className: "text-gray-500",
                                            children: "Unable to load currency management"
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                                            lineNumber: 197,
                                            columnNumber: 21
                                        }, void 0)
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                                    lineNumber: 193,
                                    columnNumber: 19
                                }, void 0),
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$game$2f$CurrencyManager$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
                                    fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                                    lineNumber: 203,
                                    columnNumber: 17
                                }, ("TURBOPACK compile-time value", void 0))
                            }, void 0, false, {
                                fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                                lineNumber: 191,
                                columnNumber: 15
                            }, ("TURBOPACK compile-time value", void 0))
                        }, void 0, false, {
                            fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                            lineNumber: 190,
                            columnNumber: 13
                        }, ("TURBOPACK compile-time value", void 0))
                    }, void 0, false, {
                        fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                        lineNumber: 189,
                        columnNumber: 11
                    }, ("TURBOPACK compile-time value", void 0))
                }
            ]
        },
        {
            id: 'character-story',
            label: 'Character & Story',
            icon: '📖',
            defaultOpen: false,
            tabs: [
                {
                    id: 'character-details',
                    label: 'Character Details',
                    icon: '📜',
                    content: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$layout$2f$GroupedTabs$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["TabContent"], {
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-2",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$feedback$2f$ErrorBoundary$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                    fallback: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "rounded-lg border border-amber-200 bg-white p-6 shadow-lg",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                className: "mb-4 text-lg font-bold text-amber-800",
                                                children: "Features"
                                            }, void 0, false, {
                                                fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                                                lineNumber: 228,
                                                columnNumber: 21
                                            }, void 0),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-gray-500",
                                                children: "Unable to load features editor"
                                            }, void 0, false, {
                                                fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                                                lineNumber: 231,
                                                columnNumber: 21
                                            }, void 0)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                                        lineNumber: 227,
                                        columnNumber: 19
                                    }, void 0),
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$game$2f$FeaturesTraitsManager$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                        items: character.features,
                                        category: "feature",
                                        onAdd: addFeature,
                                        onUpdate: updateFeature,
                                        onDelete: deleteFeature
                                    }, void 0, false, {
                                        fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                                        lineNumber: 237,
                                        columnNumber: 17
                                    }, ("TURBOPACK compile-time value", void 0))
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                                    lineNumber: 225,
                                    columnNumber: 15
                                }, ("TURBOPACK compile-time value", void 0)),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$feedback$2f$ErrorBoundary$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                    fallback: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "rounded-lg border border-emerald-200 bg-white p-6 shadow-lg",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                className: "mb-4 text-lg font-bold text-emerald-800",
                                                children: "Traits"
                                            }, void 0, false, {
                                                fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                                                lineNumber: 250,
                                                columnNumber: 21
                                            }, void 0),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-gray-500",
                                                children: "Unable to load traits editor"
                                            }, void 0, false, {
                                                fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                                                lineNumber: 253,
                                                columnNumber: 21
                                            }, void 0)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                                        lineNumber: 249,
                                        columnNumber: 19
                                    }, void 0),
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$game$2f$FeaturesTraitsManager$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                        items: character.traits,
                                        category: "trait",
                                        onAdd: addTrait,
                                        onUpdate: updateTrait,
                                        onDelete: deleteTrait
                                    }, void 0, false, {
                                        fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                                        lineNumber: 259,
                                        columnNumber: 17
                                    }, ("TURBOPACK compile-time value", void 0))
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                                    lineNumber: 247,
                                    columnNumber: 15
                                }, ("TURBOPACK compile-time value", void 0)),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "lg:col-span-2",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$feedback$2f$ErrorBoundary$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                        fallback: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "rounded-lg border border-emerald-200 bg-white p-6 shadow-lg",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                    className: "mb-4 text-lg font-bold text-emerald-800",
                                                    children: "Character Background"
                                                }, void 0, false, {
                                                    fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                                                    lineNumber: 273,
                                                    columnNumber: 23
                                                }, void 0),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "text-gray-500",
                                                    children: "Unable to load background editor"
                                                }, void 0, false, {
                                                    fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                                                    lineNumber: 276,
                                                    columnNumber: 23
                                                }, void 0)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                                            lineNumber: 272,
                                            columnNumber: 21
                                        }, void 0),
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$character$2f$CharacterBackgroundEditor$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                            background: character.characterBackground,
                                            onChange: updateCharacterBackground
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                                            lineNumber: 282,
                                            columnNumber: 19
                                        }, ("TURBOPACK compile-time value", void 0))
                                    }, void 0, false, {
                                        fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                                        lineNumber: 270,
                                        columnNumber: 17
                                    }, ("TURBOPACK compile-time value", void 0))
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                                    lineNumber: 269,
                                    columnNumber: 15
                                }, ("TURBOPACK compile-time value", void 0))
                            ]
                        }, void 0, true, {
                            fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                            lineNumber: 223,
                            columnNumber: 13
                        }, ("TURBOPACK compile-time value", void 0))
                    }, void 0, false, {
                        fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                        lineNumber: 222,
                        columnNumber: 11
                    }, ("TURBOPACK compile-time value", void 0))
                },
                {
                    id: 'notes',
                    label: 'Session Notes',
                    icon: '📝',
                    content: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$layout$2f$GroupedTabs$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["TabContent"], {
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "max-w-none space-y-4",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "flex items-center gap-2 text-sm text-gray-600",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-3 py-1 font-medium text-amber-800 shadow-sm",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "text-base",
                                                    children: "📅"
                                                }, void 0, false, {
                                                    fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                                                    lineNumber: 301,
                                                    columnNumber: 19
                                                }, ("TURBOPACK compile-time value", void 0)),
                                                "Campaign Day ",
                                                character.daysSpent || 0
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                                            lineNumber: 300,
                                            columnNumber: 17
                                        }, ("TURBOPACK compile-time value", void 0)),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-gray-400",
                                            children: "•"
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                                            lineNumber: 304,
                                            columnNumber: 17
                                        }, ("TURBOPACK compile-time value", void 0)),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "text-gray-500",
                                            children: Math.floor((character.daysSpent || 0) / 7) > 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
                                                children: [
                                                    "Week ",
                                                    Math.floor((character.daysSpent || 0) / 7) + 1,
                                                    ", Day",
                                                    ' ',
                                                    (character.daysSpent || 0) % 7 + 1
                                                ]
                                            }, void 0, true) : `Day ${(character.daysSpent || 0) + 1} of the adventure`
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                                            lineNumber: 305,
                                            columnNumber: 17
                                        }, ("TURBOPACK compile-time value", void 0))
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                                    lineNumber: 299,
                                    columnNumber: 15
                                }, ("TURBOPACK compile-time value", void 0)),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$feedback$2f$ErrorBoundary$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                    fallback: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "rounded-lg border border-blue-200 bg-white p-6 shadow-lg",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                className: "mb-4 text-lg font-bold text-blue-800",
                                                children: "Notes"
                                            }, void 0, false, {
                                                fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                                                lineNumber: 320,
                                                columnNumber: 21
                                            }, void 0),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-gray-500",
                                                children: "Unable to load notes editor"
                                            }, void 0, false, {
                                                fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                                                lineNumber: 323,
                                                columnNumber: 21
                                            }, void 0)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                                        lineNumber: 319,
                                        columnNumber: 19
                                    }, void 0),
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$game$2f$NotesManager$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                        items: character.notes,
                                        onAdd: addNote,
                                        onUpdate: updateNote,
                                        onDelete: deleteNote,
                                        onReorder: reorderNotes,
                                        onAddToast: addToast
                                    }, void 0, false, {
                                        fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                                        lineNumber: 327,
                                        columnNumber: 17
                                    }, ("TURBOPACK compile-time value", void 0))
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                                    lineNumber: 317,
                                    columnNumber: 15
                                }, ("TURBOPACK compile-time value", void 0))
                            ]
                        }, void 0, true, {
                            fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                            lineNumber: 298,
                            columnNumber: 13
                        }, ("TURBOPACK compile-time value", void 0))
                    }, void 0, false, {
                        fileName: "[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx",
                        lineNumber: 297,
                        columnNumber: 11
                    }, ("TURBOPACK compile-time value", void 0))
                }
            ]
        }
    ];
}),
"[project]/apps/web/src/app/player/characters/[characterId]/page.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>CharacterSheet
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$styled$2d$jsx$2f$style$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/styled-jsx/style.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$text$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__FileText$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/file-text.js [app-ssr] (ecmascript) <export default as FileText>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$arrow$2d$left$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__ArrowLeft$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/arrow-left.js [app-ssr] (ecmascript) <export default as ArrowLeft>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$triangle$2d$alert$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertTriangle$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/triangle-alert.js [app-ssr] (ecmascript) <export default as AlertTriangle>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$store$2f$playerStore$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/store/playerStore.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$store$2f$characterStore$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/store/characterStore.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$hooks$2f$useAutoSave$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/hooks/useAutoSave.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$forms$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/forms/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$forms$2f$button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/forms/button.tsx [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$layout$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/layout/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$layout$2f$badge$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/layout/badge.tsx [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$character$2f$SpellSlotTracker$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/character/SpellSlotTracker.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$character$2f$TraitTracker$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/character/TraitTracker.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$character$2f$HeroicInspirationTracker$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/character/HeroicInspirationTracker.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$character$2f$XPTracker$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/character/XPTracker.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$character$2f$HitPointManager$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/character/HitPointManager.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$layout$2f$ExperimentalFeaturesSection$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/layout/ExperimentalFeaturesSection.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$feedback$2f$ErrorBoundary$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/feedback/ErrorBoundary.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$WeaponProficiencies$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/WeaponProficiencies.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$feedback$2f$Toast$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/feedback/Toast.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$feedback$2f$ConfirmationModal$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/feedback/ConfirmationModal.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$feedback$2f$YouDiedOverlay$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/feedback/YouDiedOverlay.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$feedback$2f$LevelUpOverlay$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/feedback/LevelUpOverlay.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$character$2f$CharacterSheetHeader$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/character/CharacterSheetHeader.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$character$2f$CharacterBasicInfo$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/character/CharacterBasicInfo.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$character$2f$HitDiceTracker$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/character/HitDiceTracker.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$character$2f$RestManager$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/character/RestManager.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$character$2f$DaysSpentTracker$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/character/DaysSpentTracker.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$character$2f$AbilityScores$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/character/AbilityScores.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$character$2f$ArmorClassManager$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/character/ArmorClassManager.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$character$2f$SavingThrows$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/character/SavingThrows.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$character$2f$Skills$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/character/Skills.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$character$2f$CombatStats$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/character/CombatStats.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$character$2f$ActionsSection$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/character/ActionsSection.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$layout$2f$CollapsibleSection$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/layout/CollapsibleSection.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$character$2f$QuickStats$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/character/QuickStats.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$character$2f$LanguagesAndProficiencies$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/character/LanguagesAndProficiencies.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$character$2f$ExtendedFeatures$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/character/ExtendedFeatures/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$character$2f$ExtendedFeatures$2f$ExtendedFeaturesSection$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__ExtendedFeaturesSection$3e$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/character/ExtendedFeatures/ExtendedFeaturesSection.tsx [app-ssr] (ecmascript) <export default as ExtendedFeaturesSection>");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$hooks$2f$useHydration$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/hooks/useHydration.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/utils/constants.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$calculations$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/utils/calculations.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$fileOperations$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/utils/fileOperations.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$layout$2f$GroupedTabs$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/layout/GroupedTabs.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$contexts$2f$NavigationContext$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/contexts/NavigationContext.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$app$2f$player$2f$characters$2f5b$characterId$5d2f$characterSheetTabs$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/app/player/characters/[characterId]/characterSheetTabs.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$hooks$2f$useSimpleDiceRoll$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/hooks/useSimpleDiceRoll.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$feedback$2f$NotHydrated$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/feedback/NotHydrated.tsx [app-ssr] (ecmascript)");
'use client';
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
function CharacterSheet() {
    const params = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useParams"])();
    const characterId = params.characterId;
    const { getCharacterById, updateCharacterData } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$store$2f$playerStore$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["usePlayerStore"])();
    const playerCharacter = getCharacterById(characterId);
    const hasHydrated = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$hooks$2f$useHydration$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useHydration"])();
    const { isReady: diceBoxInitialized, roll: rollDice } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$hooks$2f$useSimpleDiceRoll$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useSimpleDiceRoll"])({
        containerId: 'main-dice-container',
        onRollComplete: (summary)=>{
            console.log('Dice roll completed:', summary);
        },
        onError: (error)=>{
            console.error('Dice roll error:', error);
        }
    });
    const { toasts, dismissToast, showAttackRoll, showSavingThrow, showDamageRoll, showShortRest, showLongRest, addToast } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$feedback$2f$Toast$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useToast"])();
    const { character, saveStatus, lastSaved, hasUnsavedChanges, updateCharacter, updateAbilityScore, updateSkillProficiency, updateSkillExpertise, updateSavingThrowProficiency, updateHitPoints, updateInitiative, resetInitiativeToDefault, applyDamageToCharacter, applyHealingToCharacter, addTemporaryHPToCharacter, makeDeathSavingThrow, resetDeathSavingThrows, toggleHPCalculationMode, recalculateMaxHP, updateClass, updateLevel, updateSpellSlot, updatePactMagicSlot, resetSpellSlots, resetPactMagicSlots, addExperience, setExperience, addFeature, updateFeature, deleteFeature, addTrait, updateTrait, deleteTrait, addNote, updateNote, deleteNote, reorderNotes, addExtendedFeature, updateExtendedFeature, deleteExtendedFeature, useExtendedFeature, resetExtendedFeatures, reorderExtendedFeatures, migrateTraitsToExtendedFeatures, updateCharacterBackground, exportCharacter, resetCharacter, addHeroicInspiration, updateHeroicInspiration, useHeroicInspiration, resetHeroicInspiration, toggleReaction, resetReaction, updateTempArmorClass, toggleJackOfAllTrades, toggleShield, updateShieldBonus, stopConcentration, loadCharacterState, // Multiclass methods
    addClassLevel, removeClassLevel, updateClassLevel, getClassDisplayString, // Hit dice methods
    useHitDie, restoreHitDice, resetAllHitDice, // Rest management (centralized)
    takeShortRest, takeLongRest, // Language and tool proficiency methods
    addLanguage, deleteLanguage, addToolProficiency, updateToolProficiency, deleteToolProficiency, // Campaign tracking
    updateDaysSpent, incrementDaysSpent, // Easter egg animations
    showDeathAnimation, clearDeathAnimation, showLevelUpAnimation, levelUpAnimationLevel, clearLevelUpAnimation } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$store$2f$characterStore$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCharacterStore"])();
    const [showResetModal, setShowResetModal] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const { manualSave } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$hooks$2f$useAutoSave$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useAutoSave"])();
    const lastLoadedCharacterRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const lastSyncedCharacterRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const [isInitialLoad, setIsInitialLoad] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(true);
    // Load character data into store when component mounts or character changes
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (playerCharacter && hasHydrated) {
            const currentCharacterId = playerCharacter.characterData.id;
            // Only load if we haven't loaded this character yet or if it's a different character
            if (lastLoadedCharacterRef.current !== currentCharacterId) {
                setIsInitialLoad(true);
                loadCharacterState(playerCharacter.characterData);
                lastLoadedCharacterRef.current = currentCharacterId;
                lastSyncedCharacterRef.current = playerCharacter.characterData;
                // Auto-migrate existing traits to extended features if needed
                const hasTraits = (playerCharacter.characterData.trackableTraits || []).length > 0;
                const hasExtended = (playerCharacter.characterData.extendedFeatures || []).length > 0;
                if (hasTraits && !hasExtended) {
                    // Small delay to ensure character state is loaded first
                    setTimeout(()=>{
                        migrateTraitsToExtendedFeatures();
                    }, 100);
                }
                // Mark initial load as complete after state has been set
                const timer = setTimeout(()=>{
                    setIsInitialLoad(false);
                }, 50);
                return ()=>clearTimeout(timer);
            }
        }
    }, [
        playerCharacter,
        hasHydrated,
        loadCharacterState,
        migrateTraitsToExtendedFeatures
    ]);
    // Sync character data back to player store when it changes (skip during initial load)
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (!isInitialLoad && hasHydrated && character.id === characterId) {
            // Deep comparison to prevent unnecessary updates and infinite loops
            const hasActualChanges = !lastSyncedCharacterRef.current || JSON.stringify(lastSyncedCharacterRef.current) !== JSON.stringify(character);
            if (hasActualChanges) {
                // Create a deep copy to avoid reference issues
                const characterCopy = JSON.parse(JSON.stringify(character));
                updateCharacterData(characterId, characterCopy);
                lastSyncedCharacterRef.current = characterCopy;
            }
        }
    }, [
        character,
        characterId,
        updateCharacterData,
        hasHydrated,
        isInitialLoad
    ]);
    // Calculate derived values (needs to be before early returns due to hooks)
    const totalLevel = character.totalLevel || character.level;
    const proficiencyBonus = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$calculations$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getProficiencyBonus"])(totalLevel);
    // Helper function to get ability modifier
    const getAbilityModifier = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((ability)=>{
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$calculations$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["calculateModifier"])(character.abilities[ability]);
    }, [
        character.abilities
    ]);
    // All other hooks and refs that were after early returns
    const tabsRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    // Navigation helper
    const switchToTab = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((tabId)=>{
        tabsRef.current?.switchToTab(tabId);
    }, []);
    // Auto-update initiative when dexterity changes (if not overridden)
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (!character.initiative.isOverridden) {
            const dexModifier = getAbilityModifier('dexterity');
            if (character.initiative.value !== dexModifier) {
                updateInitiative(dexModifier, false);
            }
        }
    }, [
        character.abilities.dexterity,
        character.initiative.isOverridden,
        character.initiative.value,
        getAbilityModifier,
        updateInitiative
    ]);
    // Auto-recalculate max HP when level or constitution changes (if in auto mode)
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (character.hitPoints.calculationMode === 'auto') {
            recalculateMaxHP();
        }
    }, [
        character.level,
        character.abilities.constitution,
        character.class.name,
        character.hitPoints.calculationMode,
        recalculateMaxHP
    ]);
    if (!hasHydrated) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$feedback$2f$NotHydrated$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
            fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
            lineNumber: 302,
            columnNumber: 12
        }, this);
    }
    if (!playerCharacter) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "flex min-h-screen items-center justify-center bg-gray-50",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "text-center",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$text$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__FileText$3e$__["FileText"], {
                        size: 64,
                        className: "mx-auto mb-6 text-gray-400"
                    }, void 0, false, {
                        fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                        lineNumber: 309,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                        className: "mb-2 text-2xl font-bold text-slate-800",
                        children: "Character Not Found"
                    }, void 0, false, {
                        fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                        lineNumber: 310,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "mb-6 text-slate-600",
                        children: "The character you're looking for doesn't exist or has been deleted."
                    }, void 0, false, {
                        fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                        lineNumber: 313,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                        href: "/player",
                        className: "inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$arrow$2d$left$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__ArrowLeft$3e$__["ArrowLeft"], {
                                size: 16
                            }, void 0, false, {
                                fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                lineNumber: 321,
                                columnNumber: 13
                            }, this),
                            "Back to Characters"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                        lineNumber: 317,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                lineNumber: 308,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
            lineNumber: 307,
            columnNumber: 7
        }, this);
    }
    // Helper function to get skill modifier
    const getSkillModifier = (skillName)=>{
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$calculations$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["calculateSkillModifier"])(character, skillName);
    };
    // Helper function to get saving throw modifier
    const getSavingThrowModifier = (ability)=>{
        const savingThrow = character.savingThrows[ability];
        let modifier = getAbilityModifier(ability);
        if (savingThrow.proficient) modifier += proficiencyBonus;
        if (savingThrow.customModifier) modifier += savingThrow.customModifier;
        return modifier;
    };
    // Get initiative modifier - either calculated or overridden
    const getInitiativeModifier = ()=>{
        if (character.initiative.isOverridden) {
            return character.initiative.value;
        }
        return getAbilityModifier('dexterity');
    };
    // Roll saving throw
    const rollSavingThrow = async (ability)=>{
        const saveModifier = getSavingThrowModifier(ability);
        // Roll 3D dice and use actual result
        if (diceBoxInitialized) {
            try {
                const rollResult = await rollDice(`1d20${saveModifier > 0 ? `+${saveModifier}` : saveModifier}`);
                if (rollResult && typeof rollResult === 'object' && 'individualValues' in rollResult) {
                    const summary = rollResult;
                    const roll = summary.individualValues[0] || 1; // Get the d20 result
                    const isCrit = roll === 20;
                    // Use showAttackRoll since it's more appropriate for displaying dice rolls
                    showAttackRoll(`${__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ABILITY_NAMES"][ability]} Save`, roll, saveModifier, isCrit);
                    return;
                }
            } catch (error) {
                console.warn('Dice animation failed, falling back to random roll:', error);
            }
        }
        // Fallback to random roll if animation fails or isn't available
        const roll = Math.floor(Math.random() * 20) + 1;
        const isCrit = roll === 20;
        // Use showAttackRoll since it's more appropriate for displaying dice rolls
        showAttackRoll(`${__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ABILITY_NAMES"][ability]} Save`, roll, saveModifier, isCrit);
    };
    // Roll skill check
    const rollSkillCheck = async (skillName)=>{
        const skillModifier = getSkillModifier(skillName);
        // Roll 3D dice and use actual result
        if (diceBoxInitialized) {
            try {
                const rollResult = await rollDice(`1d20${skillModifier > 0 ? `+${skillModifier}` : skillModifier}`);
                if (rollResult && typeof rollResult === 'object' && 'individualValues' in rollResult) {
                    const summary = rollResult;
                    const roll = summary.individualValues[0] || 1; // Get the d20 result
                    const isCrit = roll === 20;
                    showAttackRoll(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SKILL_NAMES"][skillName], roll, skillModifier, isCrit);
                    return;
                }
            } catch (error) {
                console.warn('Dice animation failed, falling back to random roll:', error);
            }
        }
        // Fallback to random roll if animation fails or isn't available
        const roll = Math.floor(Math.random() * 20) + 1;
        const isCrit = roll === 20;
        showAttackRoll(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SKILL_NAMES"][skillName], roll, skillModifier, isCrit);
    };
    // Roll ability check
    const rollAbilityCheck = async (ability)=>{
        const abilityModifier = getAbilityModifier(ability);
        // Roll 3D dice and use actual result
        if (diceBoxInitialized) {
            try {
                const rollResult = await rollDice(`1d20${abilityModifier > 0 ? `+${abilityModifier}` : abilityModifier}`);
                if (rollResult && typeof rollResult === 'object' && 'individualValues' in rollResult) {
                    const summary = rollResult;
                    const roll = summary.individualValues[0] || 1; // Get the d20 result
                    const isCrit = roll === 20;
                    showAttackRoll(`${__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ABILITY_NAMES"][ability]} Check`, roll, abilityModifier, isCrit);
                    return;
                }
            } catch (error) {
                console.warn('Dice animation failed, falling back to random roll:', error);
            }
        }
        // Fallback to random roll if animation fails or isn't available
        const roll = Math.floor(Math.random() * 20) + 1;
        const isCrit = roll === 20;
        showAttackRoll(`${__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ABILITY_NAMES"][ability]} Check`, roll, abilityModifier, isCrit);
    };
    // Roll initiative
    const rollInitiative = async ()=>{
        const initiativeModifier = getInitiativeModifier();
        // Roll 3D dice and use actual result
        if (diceBoxInitialized) {
            try {
                const rollResult = await rollDice(`1d20${initiativeModifier > 0 ? `+${initiativeModifier}` : initiativeModifier}`);
                if (rollResult && typeof rollResult === 'object' && 'individualValues' in rollResult) {
                    const summary = rollResult;
                    const roll = summary.individualValues[0] || 1; // Get the d20 result
                    const isCrit = roll === 20;
                    showAttackRoll('Initiative', roll, initiativeModifier, isCrit);
                    return;
                }
            } catch (error) {
                console.warn('Dice animation failed, falling back to random roll:', error);
            }
        }
        // Fallback to random roll if animation fails or isn't available
        const roll = Math.floor(Math.random() * 20) + 1;
        const isCrit = roll === 20;
        showAttackRoll('Initiative', roll, initiativeModifier, isCrit);
    };
    // Check if character has spell capabilities
    const characterHasSpells = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$calculations$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["hasSpellSlots"])(character.spellSlots, character.pactMagic);
    // Export functionality
    const handleExport = ()=>{
        try {
            const exportData = exportCharacter();
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$fileOperations$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["exportCharacterToFile"])(exportData);
        } catch (error) {
            console.error('Export failed:', error);
            alert('Failed to export character. Please try again.');
        }
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$feedback$2f$ErrorBoundary$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$contexts$2f$NavigationContext$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["NavigationContext"].Provider, {
            value: {
                switchToTab
            },
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "relative min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$character$2f$CharacterSheetHeader$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                        characterId: characterId,
                        characterName: character.name,
                        characterRace: character.race,
                        characterClass: character.class?.name || 'Unknown Class',
                        characterLevel: character.level,
                        saveStatus: saveStatus,
                        lastSaved: lastSaved,
                        hasUnsavedChanges: hasUnsavedChanges,
                        onManualSave: manualSave,
                        onExport: handleExport,
                        onShowResetModal: ()=>setShowResetModal(true),
                        onUpdateName: (name)=>updateCharacter({
                                name
                            }),
                        onAddToast: addToast
                    }, void 0, false, {
                        fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                        lineNumber: 545,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "jsx-79f8e55cab9dba98" + " " + "p-4",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                id: "main-dice-container",
                                style: {
                                    width: '100vw',
                                    height: '100vh',
                                    top: 0,
                                    left: 0
                                },
                                className: "jsx-79f8e55cab9dba98" + " " + "pointer-events-none fixed inset-0 z-[9999]"
                            }, void 0, false, {
                                fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                lineNumber: 563,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$styled$2d$jsx$2f$style$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                id: "79f8e55cab9dba98",
                                children: "#main-dice-container{width:100vw;height:100vh;position:fixed;inset:0}#main-dice-container canvas,#main-dice-container>div,#main-dice-container>canvas{width:100%!important;max-width:100%!important;height:100%!important;max-height:100%!important;display:block!important;position:absolute!important;top:0!important;left:0!important}"
                            }, void 0, false, void 0, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$layout$2f$ExperimentalFeaturesSection$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
                                fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                lineNumber: 594,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
                                className: "jsx-79f8e55cab9dba98" + " " + "relative z-10 mx-auto max-w-7xl space-y-8",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$layout$2f$CollapsibleSection$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                        title: "Actions & Combat",
                                        icon: "⚔️",
                                        defaultExpanded: true,
                                        persistKey: "actions-combat",
                                        className: "rounded-xl border-2 border-slate-300 bg-gradient-to-r from-slate-50 to-slate-100 shadow-lg backdrop-blur-sm",
                                        headerClassName: "rounded-t-xl",
                                        contentClassName: "px-6 pb-6",
                                        badge: character.concentration.isConcentrating && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: "jsx-79f8e55cab9dba98" + " " + "rounded-full bg-orange-100 px-3 py-1 text-sm font-medium text-orange-800",
                                            children: "Concentrating"
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                            lineNumber: 609,
                                            columnNumber: 21
                                        }, void 0),
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$character$2f$ActionsSection$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                            character: character,
                                            showAttackRoll: showAttackRoll,
                                            showSavingThrow: showSavingThrow,
                                            showDamageRoll: showDamageRoll,
                                            animateRoll: diceBoxInitialized ? rollDice : undefined,
                                            switchToTab: switchToTab,
                                            onStopConcentration: stopConcentration
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                            lineNumber: 615,
                                            columnNumber: 17
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                        lineNumber: 599,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$layout$2f$CollapsibleSection$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                        title: "Rest & Recovery",
                                        icon: "🛌",
                                        defaultExpanded: false,
                                        persistKey: "rest-recovery",
                                        className: "rounded-lg border border-gray-200 bg-white shadow-lg",
                                        contentClassName: "px-6 pb-6",
                                        badge: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "jsx-79f8e55cab9dba98" + " " + "flex items-center gap-2",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "jsx-79f8e55cab9dba98" + " " + "rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700",
                                                    children: [
                                                        "Day ",
                                                        character.daysSpent || 0
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                    lineNumber: 636,
                                                    columnNumber: 21
                                                }, void 0),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "jsx-79f8e55cab9dba98" + " " + "rounded-md bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700",
                                                    children: "Short Rest"
                                                }, void 0, false, {
                                                    fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                    lineNumber: 639,
                                                    columnNumber: 21
                                                }, void 0),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "jsx-79f8e55cab9dba98" + " " + "rounded-md bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700",
                                                    children: "Long Rest"
                                                }, void 0, false, {
                                                    fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                    lineNumber: 642,
                                                    columnNumber: 21
                                                }, void 0)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                            lineNumber: 635,
                                            columnNumber: 19
                                        }, void 0),
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "jsx-79f8e55cab9dba98" + " " + "space-y-6",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$character$2f$RestManager$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                                    onShortRest: takeShortRest,
                                                    onLongRest: takeLongRest,
                                                    onShowShortRestToast: showShortRest,
                                                    onShowLongRestToast: showLongRest
                                                }, void 0, false, {
                                                    fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                    lineNumber: 650,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$character$2f$DaysSpentTracker$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                                    daysSpent: character.daysSpent || 0,
                                                    onUpdateDays: updateDaysSpent,
                                                    onIncrementDays: incrementDaysSpent
                                                }, void 0, false, {
                                                    fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                    lineNumber: 658,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                            lineNumber: 648,
                                            columnNumber: 17
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                        lineNumber: 627,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "jsx-79f8e55cab9dba98" + " " + "flex items-center justify-center",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "jsx-79f8e55cab9dba98" + " " + "h-px w-full max-w-md bg-gradient-to-r from-transparent via-gray-300 to-transparent"
                                            }, void 0, false, {
                                                fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                lineNumber: 668,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                className: "jsx-79f8e55cab9dba98" + " " + "px-4 font-medium text-gray-500",
                                                children: "Core Stats"
                                            }, void 0, false, {
                                                fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                lineNumber: 669,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "jsx-79f8e55cab9dba98" + " " + "h-px w-full max-w-md bg-gradient-to-r from-transparent via-gray-300 to-transparent"
                                            }, void 0, false, {
                                                fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                lineNumber: 672,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                        lineNumber: 667,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$layout$2f$CollapsibleSection$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                        title: "Character Statistics",
                                        icon: "📊",
                                        defaultExpanded: true,
                                        persistKey: "character-statistics",
                                        className: "rounded-xl border-2 border-blue-300 bg-gradient-to-r from-blue-50 to-indigo-50 shadow-lg backdrop-blur-sm",
                                        headerClassName: "rounded-t-xl",
                                        contentClassName: "px-6 pb-6",
                                        badge: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "jsx-79f8e55cab9dba98" + " " + "flex items-center gap-2",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "jsx-79f8e55cab9dba98" + " " + "rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800",
                                                    children: [
                                                        "Level ",
                                                        totalLevel
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                    lineNumber: 686,
                                                    columnNumber: 21
                                                }, void 0),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "jsx-79f8e55cab9dba98" + " " + "rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800",
                                                    children: [
                                                        "HP: ",
                                                        character.hitPoints.current,
                                                        "/",
                                                        character.hitPoints.max
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                    lineNumber: 689,
                                                    columnNumber: 21
                                                }, void 0)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                            lineNumber: 685,
                                            columnNumber: 19
                                        }, void 0),
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "jsx-79f8e55cab9dba98" + " " + "grid grid-cols-1 gap-6 lg:grid-cols-12",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "jsx-79f8e55cab9dba98" + " " + "space-y-6 lg:col-span-4",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$character$2f$CharacterBasicInfo$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                                            character: character,
                                                            race: character.race,
                                                            characterClass: character.class,
                                                            level: character.level,
                                                            background: character.background,
                                                            playerName: character.playerName,
                                                            alignment: character.alignment,
                                                            onUpdateRace: (race)=>updateCharacter({
                                                                    race
                                                                }),
                                                            onUpdateClass: updateClass,
                                                            onUpdateLevel: updateLevel,
                                                            onUpdateBackground: (background)=>updateCharacter({
                                                                    background
                                                                }),
                                                            onUpdatePlayerName: (playerName)=>updateCharacter({
                                                                    playerName
                                                                }),
                                                            onUpdateAlignment: (alignment)=>updateCharacter({
                                                                    alignment
                                                                }),
                                                            onAddClassLevel: addClassLevel,
                                                            onRemoveClassLevel: removeClassLevel,
                                                            onUpdateClassLevel: updateClassLevel,
                                                            getClassDisplayString: getClassDisplayString
                                                        }, void 0, false, {
                                                            fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                            lineNumber: 700,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$character$2f$AbilityScores$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                                            abilities: character.abilities,
                                                            characterLevel: totalLevel,
                                                            onUpdateAbilityScore: updateAbilityScore,
                                                            onRollAbilityCheck: rollAbilityCheck
                                                        }, void 0, false, {
                                                            fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                            lineNumber: 727,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$feedback$2f$ErrorBoundary$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                                            fallback: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                className: "jsx-79f8e55cab9dba98" + " " + "rounded-lg border border-amber-200 bg-white p-4 shadow",
                                                                children: [
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                                        className: "jsx-79f8e55cab9dba98" + " " + "mb-2 text-sm font-medium text-gray-700",
                                                                        children: "Weapon Proficiencies"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                                        lineNumber: 738,
                                                                        columnNumber: 27
                                                                    }, void 0),
                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                        className: "jsx-79f8e55cab9dba98" + " " + "text-gray-500",
                                                                        children: "Unable to load weapon proficiencies"
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                                        lineNumber: 741,
                                                                        columnNumber: 27
                                                                    }, void 0)
                                                                ]
                                                            }, void 0, true, {
                                                                fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                                lineNumber: 737,
                                                                columnNumber: 25
                                                            }, void 0),
                                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$WeaponProficiencies$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["WeaponProficiencies"], {}, void 0, false, {
                                                                fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                                lineNumber: 747,
                                                                columnNumber: 23
                                                            }, this)
                                                        }, void 0, false, {
                                                            fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                            lineNumber: 735,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$character$2f$HeroicInspirationTracker$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                                            inspiration: character.heroicInspiration,
                                                            onAddInspiration: addHeroicInspiration,
                                                            onUpdateInspiration: updateHeroicInspiration,
                                                            onUseInspiration: useHeroicInspiration,
                                                            onResetInspiration: resetHeroicInspiration
                                                        }, void 0, false, {
                                                            fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                            lineNumber: 751,
                                                            columnNumber: 21
                                                        }, this),
                                                        hasHydrated && (character.conditionsAndDiseases?.activeConditions?.length > 0 || character.conditionsAndDiseases?.activeDiseases?.length > 0) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "jsx-79f8e55cab9dba98" + " " + "rounded-lg border-2 border-red-200 bg-gradient-to-br from-red-50 to-pink-50 p-4 shadow-sm",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "jsx-79f8e55cab9dba98" + " " + "mb-3 flex items-center justify-between",
                                                                    children: [
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                                            className: "jsx-79f8e55cab9dba98" + " " + "flex items-center gap-2 text-base font-semibold text-red-800",
                                                                            children: [
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$triangle$2d$alert$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertTriangle$3e$__["AlertTriangle"], {
                                                                                    className: "h-5 w-5"
                                                                                }, void 0, false, {
                                                                                    fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                                                    lineNumber: 768,
                                                                                    columnNumber: 31
                                                                                }, this),
                                                                                "Active Conditions & Diseases"
                                                                            ]
                                                                        }, void 0, true, {
                                                                            fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                                            lineNumber: 767,
                                                                            columnNumber: 29
                                                                        }, this),
                                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$forms$2f$button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["Button"], {
                                                                            onClick: ()=>tabsRef.current?.switchToTab('conditions'),
                                                                            variant: "ghost",
                                                                            size: "xs",
                                                                            className: "text-red-600 hover:bg-red-100",
                                                                            children: "Manage →"
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                                            lineNumber: 771,
                                                                            columnNumber: 29
                                                                        }, this)
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                                    lineNumber: 766,
                                                                    columnNumber: 27
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "jsx-79f8e55cab9dba98" + " " + "space-y-2",
                                                                    children: [
                                                                        character.conditionsAndDiseases?.activeConditions?.map?.((condition)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                className: "jsx-79f8e55cab9dba98" + " " + "flex items-center justify-between gap-2 rounded-lg border-2 border-red-200 bg-white p-2",
                                                                                children: [
                                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                        className: "jsx-79f8e55cab9dba98" + " " + "flex items-center gap-2",
                                                                                        children: [
                                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$layout$2f$badge$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["Badge"], {
                                                                                                variant: "danger",
                                                                                                size: "sm",
                                                                                                children: condition.name
                                                                                            }, void 0, false, {
                                                                                                fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                                                                lineNumber: 790,
                                                                                                columnNumber: 37
                                                                                            }, this),
                                                                                            condition.stackable && condition.count > 1 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$layout$2f$badge$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["Badge"], {
                                                                                                variant: "warning",
                                                                                                size: "sm",
                                                                                                children: [
                                                                                                    "Level ",
                                                                                                    condition.count
                                                                                                ]
                                                                                            }, void 0, true, {
                                                                                                fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                                                                lineNumber: 795,
                                                                                                columnNumber: 41
                                                                                            }, this)
                                                                                        ]
                                                                                    }, void 0, true, {
                                                                                        fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                                                        lineNumber: 789,
                                                                                        columnNumber: 35
                                                                                    }, this),
                                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$layout$2f$badge$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["Badge"], {
                                                                                        variant: "neutral",
                                                                                        size: "sm",
                                                                                        children: condition.source
                                                                                    }, void 0, false, {
                                                                                        fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                                                        lineNumber: 800,
                                                                                        columnNumber: 35
                                                                                    }, this)
                                                                                ]
                                                                            }, condition.id, true, {
                                                                                fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                                                lineNumber: 785,
                                                                                columnNumber: 33
                                                                            }, this)),
                                                                        character.conditionsAndDiseases?.activeDiseases?.map?.((disease)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                                className: "jsx-79f8e55cab9dba98" + " " + "flex items-center justify-between gap-2 rounded-lg border-2 border-purple-200 bg-white p-2",
                                                                                children: [
                                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$layout$2f$badge$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["Badge"], {
                                                                                        variant: "info",
                                                                                        size: "sm",
                                                                                        children: disease.name
                                                                                    }, void 0, false, {
                                                                                        fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                                                        lineNumber: 812,
                                                                                        columnNumber: 35
                                                                                    }, this),
                                                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$layout$2f$badge$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__["Badge"], {
                                                                                        variant: "neutral",
                                                                                        size: "sm",
                                                                                        children: disease.source
                                                                                    }, void 0, false, {
                                                                                        fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                                                        lineNumber: 815,
                                                                                        columnNumber: 35
                                                                                    }, this)
                                                                                ]
                                                                            }, disease.id, true, {
                                                                                fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                                                lineNumber: 808,
                                                                                columnNumber: 33
                                                                            }, this))
                                                                    ]
                                                                }, void 0, true, {
                                                                    fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                                    lineNumber: 782,
                                                                    columnNumber: 27
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                            lineNumber: 765,
                                                            columnNumber: 25
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$character$2f$QuickStats$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                                            passivePerception: 10 + getSkillModifier('perception'),
                                                            proficiencyBonus: proficiencyBonus
                                                        }, void 0, false, {
                                                            fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                            lineNumber: 826,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$character$2f$TraitTracker$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                                            traits: (character.extendedFeatures || []).filter((trait)=>!trait.isPassive),
                                                            characterLevel: totalLevel,
                                                            onUpdateTrait: updateExtendedFeature,
                                                            onDeleteTrait: deleteExtendedFeature,
                                                            onUseTrait: useExtendedFeature,
                                                            onResetTraits: resetExtendedFeatures,
                                                            readonly: false,
                                                            hideControls: true,
                                                            enableViewModal: true
                                                        }, void 0, false, {
                                                            fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                            lineNumber: 832,
                                                            columnNumber: 21
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                    lineNumber: 698,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "jsx-79f8e55cab9dba98" + " " + "space-y-6 lg:col-span-4",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$character$2f$SavingThrows$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                                            savingThrows: character.savingThrows,
                                                            getSavingThrowModifier: getSavingThrowModifier,
                                                            onUpdateSavingThrowProficiency: updateSavingThrowProficiency,
                                                            onRollSavingThrow: rollSavingThrow
                                                        }, void 0, false, {
                                                            fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                            lineNumber: 850,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$character$2f$Skills$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                                            skills: character.skills,
                                                            jackOfAllTrades: character.jackOfAllTrades ?? false,
                                                            proficiencyBonus: proficiencyBonus,
                                                            getSkillModifier: getSkillModifier,
                                                            onUpdateSkillProficiency: updateSkillProficiency,
                                                            onUpdateSkillExpertise: updateSkillExpertise,
                                                            onToggleJackOfAllTrades: toggleJackOfAllTrades,
                                                            onRollSkillCheck: rollSkillCheck
                                                        }, void 0, false, {
                                                            fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                            lineNumber: 860,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "jsx-79f8e55cab9dba98" + " " + "rounded-lg border border-amber-200 bg-white p-6 shadow-lg",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                                                    className: "jsx-79f8e55cab9dba98" + " " + "mb-4 border-b border-gray-200 pb-2 text-lg font-bold text-gray-800",
                                                                    children: "Experience Points"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                                    lineNumber: 873,
                                                                    columnNumber: 23
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$character$2f$XPTracker$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                                                    currentXP: character.experience,
                                                                    currentLevel: totalLevel,
                                                                    onAddXP: addExperience,
                                                                    onSetXP: setExperience
                                                                }, void 0, false, {
                                                                    fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                                    lineNumber: 876,
                                                                    columnNumber: 23
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                            lineNumber: 872,
                                                            columnNumber: 21
                                                        }, this),
                                                        characterHasSpells && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$character$2f$SpellSlotTracker$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                                            spellSlots: character.spellSlots,
                                                            pactMagic: character.pactMagic,
                                                            onSpellSlotChange: updateSpellSlot,
                                                            onPactMagicChange: character.pactMagic ? updatePactMagicSlot : undefined,
                                                            onResetSpellSlots: resetSpellSlots,
                                                            onResetPactMagic: character.pactMagic ? resetPactMagicSlots : undefined
                                                        }, void 0, false, {
                                                            fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                            lineNumber: 886,
                                                            columnNumber: 23
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                    lineNumber: 848,
                                                    columnNumber: 19
                                                }, this),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                    className: "jsx-79f8e55cab9dba98" + " " + "space-y-6 lg:col-span-4",
                                                    children: [
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                            className: "jsx-79f8e55cab9dba98" + " " + "rounded-lg border border-amber-200 bg-white p-6 shadow-lg",
                                                            children: [
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                                                    className: "jsx-79f8e55cab9dba98" + " " + "mb-4 border-b border-gray-200 pb-2 text-lg font-bold text-gray-800",
                                                                    children: "Combat Stats"
                                                                }, void 0, false, {
                                                                    fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                                    lineNumber: 905,
                                                                    columnNumber: 23
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$character$2f$ArmorClassManager$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                                                    character: character,
                                                                    onUpdateArmorClass: (ac)=>updateCharacter({
                                                                            armorClass: ac
                                                                        }),
                                                                    onUpdateTempArmorClass: updateTempArmorClass,
                                                                    onToggleShield: toggleShield,
                                                                    onUpdateShieldBonus: updateShieldBonus
                                                                }, void 0, false, {
                                                                    fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                                    lineNumber: 910,
                                                                    columnNumber: 23
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$character$2f$CombatStats$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                                                    character: character,
                                                                    getInitiativeModifier: getInitiativeModifier,
                                                                    onUpdateInitiative: updateInitiative,
                                                                    onResetInitiativeToDefault: resetInitiativeToDefault,
                                                                    onUpdateSpeed: (speed)=>updateCharacter({
                                                                            speed
                                                                        }),
                                                                    onToggleReaction: toggleReaction,
                                                                    onResetReaction: resetReaction,
                                                                    onRollInitiative: rollInitiative
                                                                }, void 0, false, {
                                                                    fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                                    lineNumber: 921,
                                                                    columnNumber: 23
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                    className: "jsx-79f8e55cab9dba98" + " " + "mb-6",
                                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$feedback$2f$ErrorBoundary$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                                                        fallback: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                            className: "jsx-79f8e55cab9dba98" + " " + "rounded-lg border border-red-200 bg-white p-6 shadow-lg",
                                                                            children: [
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                                                    className: "jsx-79f8e55cab9dba98" + " " + "mb-4 text-lg font-bold text-red-800",
                                                                                    children: "Hit Points"
                                                                                }, void 0, false, {
                                                                                    fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                                                    lineNumber: 937,
                                                                                    columnNumber: 31
                                                                                }, void 0),
                                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                                    className: "jsx-79f8e55cab9dba98" + " " + "text-gray-500",
                                                                                    children: "Unable to load HP manager"
                                                                                }, void 0, false, {
                                                                                    fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                                                    lineNumber: 940,
                                                                                    columnNumber: 31
                                                                                }, void 0)
                                                                            ]
                                                                        }, void 0, true, {
                                                                            fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                                            lineNumber: 936,
                                                                            columnNumber: 29
                                                                        }, void 0),
                                                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$character$2f$HitPointManager$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                                                            hitPoints: character.hitPoints,
                                                                            classInfo: character.class,
                                                                            level: totalLevel,
                                                                            constitutionScore: character.abilities.constitution,
                                                                            onApplyDamage: applyDamageToCharacter,
                                                                            onApplyHealing: applyHealingToCharacter,
                                                                            onAddTemporaryHP: addTemporaryHPToCharacter,
                                                                            onMakeDeathSave: makeDeathSavingThrow,
                                                                            onResetDeathSaves: resetDeathSavingThrows,
                                                                            onToggleCalculationMode: toggleHPCalculationMode,
                                                                            onRecalculateMaxHP: recalculateMaxHP,
                                                                            onUpdateHitPoints: updateHitPoints
                                                                        }, void 0, false, {
                                                                            fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                                            lineNumber: 946,
                                                                            columnNumber: 27
                                                                        }, this)
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                                        lineNumber: 934,
                                                                        columnNumber: 25
                                                                    }, this)
                                                                }, void 0, false, {
                                                                    fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                                    lineNumber: 933,
                                                                    columnNumber: 23
                                                                }, this),
                                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$feedback$2f$ErrorBoundary$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                                                    fallback: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                                        className: "jsx-79f8e55cab9dba98" + " " + "rounded-lg border border-purple-200 bg-white p-4 shadow",
                                                                        children: [
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                                                                className: "jsx-79f8e55cab9dba98" + " " + "mb-2 text-sm font-medium text-gray-700",
                                                                                children: "Hit Dice"
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                                                lineNumber: 967,
                                                                                columnNumber: 29
                                                                            }, void 0),
                                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                                                className: "jsx-79f8e55cab9dba98" + " " + "text-gray-500",
                                                                                children: "Unable to load hit dice tracker"
                                                                            }, void 0, false, {
                                                                                fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                                                lineNumber: 970,
                                                                                columnNumber: 29
                                                                            }, void 0)
                                                                        ]
                                                                    }, void 0, true, {
                                                                        fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                                        lineNumber: 966,
                                                                        columnNumber: 27
                                                                    }, void 0),
                                                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$character$2f$HitDiceTracker$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                                                        hitDicePools: character.hitDicePools || {},
                                                                        onUseHitDie: useHitDie,
                                                                        onRestoreHitDice: restoreHitDice,
                                                                        onResetAllHitDice: resetAllHitDice
                                                                    }, void 0, false, {
                                                                        fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                                        lineNumber: 976,
                                                                        columnNumber: 25
                                                                    }, this)
                                                                }, void 0, false, {
                                                                    fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                                    lineNumber: 964,
                                                                    columnNumber: 23
                                                                }, this)
                                                            ]
                                                        }, void 0, true, {
                                                            fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                            lineNumber: 904,
                                                            columnNumber: 21
                                                        }, this),
                                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$character$2f$LanguagesAndProficiencies$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                                            languages: character.languages || [],
                                                            toolProficiencies: character.toolProficiencies || [],
                                                            proficiencyBonus: proficiencyBonus,
                                                            onAddLanguage: addLanguage,
                                                            onDeleteLanguage: deleteLanguage,
                                                            onAddToolProficiency: addToolProficiency,
                                                            onUpdateToolProficiency: updateToolProficiency,
                                                            onDeleteToolProficiency: deleteToolProficiency
                                                        }, void 0, false, {
                                                            fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                            lineNumber: 985,
                                                            columnNumber: 21
                                                        }, this)
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                    lineNumber: 902,
                                                    columnNumber: 19
                                                }, this)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                            lineNumber: 696,
                                            columnNumber: 17
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                        lineNumber: 676,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$layout$2f$CollapsibleSection$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                        title: "Active Abilities & Features",
                                        icon: "⚡",
                                        defaultExpanded: false,
                                        persistKey: "active-features",
                                        className: "rounded-xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-yellow-50 shadow-lg backdrop-blur-sm",
                                        headerClassName: "rounded-t-xl",
                                        contentClassName: "px-6 pb-6",
                                        badge: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "jsx-79f8e55cab9dba98" + " " + "flex items-center gap-2",
                                            children: [
                                                (character.extendedFeatures?.length || 0) > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "jsx-79f8e55cab9dba98" + " " + "rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800",
                                                    children: [
                                                        character.extendedFeatures?.length || 0,
                                                        " abilities"
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                    lineNumber: 1011,
                                                    columnNumber: 23
                                                }, void 0),
                                                character.extendedFeatures?.some((f)=>f.usedUses > 0) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "jsx-79f8e55cab9dba98" + " " + "rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-800",
                                                    children: [
                                                        character.extendedFeatures?.filter((f)=>f.usedUses > 0).length,
                                                        ' ',
                                                        "used"
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                    lineNumber: 1016,
                                                    columnNumber: 23
                                                }, void 0)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                            lineNumber: 1009,
                                            columnNumber: 19
                                        }, void 0),
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$character$2f$ExtendedFeatures$2f$ExtendedFeaturesSection$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$export__default__as__ExtendedFeaturesSection$3e$__["ExtendedFeaturesSection"], {
                                            features: character.extendedFeatures || [],
                                            character: character,
                                            onAddFeature: addExtendedFeature,
                                            onUpdateFeature: updateExtendedFeature,
                                            onDeleteFeature: deleteExtendedFeature,
                                            onUseFeature: useExtendedFeature,
                                            onResetFeatures: resetExtendedFeatures,
                                            onReorderFeatures: reorderExtendedFeatures
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                            lineNumber: 1028,
                                            columnNumber: 17
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                        lineNumber: 1000,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$layout$2f$CollapsibleSection$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                        title: "Character Details & Management",
                                        icon: "📋",
                                        defaultExpanded: true,
                                        persistKey: "character-details",
                                        className: "rounded-xl border-2 border-green-300 bg-gradient-to-r from-green-50 to-emerald-50 shadow-lg backdrop-blur-sm",
                                        headerClassName: "rounded-t-xl",
                                        contentClassName: "px-6 pb-6",
                                        badge: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "jsx-79f8e55cab9dba98" + " " + "flex items-center gap-2",
                                            children: [
                                                character.spells.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "jsx-79f8e55cab9dba98" + " " + "rounded-full bg-purple-100 px-3 py-1 text-sm font-medium text-purple-800",
                                                    children: [
                                                        character.spells.length,
                                                        " spells"
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                    lineNumber: 1052,
                                                    columnNumber: 23
                                                }, void 0),
                                                (character.features?.length || 0) > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "jsx-79f8e55cab9dba98" + " " + "rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800",
                                                    children: [
                                                        character.features?.length || 0,
                                                        " features"
                                                    ]
                                                }, void 0, true, {
                                                    fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                                    lineNumber: 1057,
                                                    columnNumber: 23
                                                }, void 0)
                                            ]
                                        }, void 0, true, {
                                            fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                            lineNumber: 1050,
                                            columnNumber: 19
                                        }, void 0),
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$layout$2f$GroupedTabs$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"], {
                                            defaultTab: "spellcasting",
                                            className: "w-full",
                                            groups: (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$app$2f$player$2f$characters$2f5b$characterId$5d2f$characterSheetTabs$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["createCharacterSheetTabsConfig"])({
                                                character,
                                                hasHydrated,
                                                addFeature,
                                                updateFeature,
                                                deleteFeature,
                                                addTrait,
                                                updateTrait,
                                                deleteTrait,
                                                updateCharacterBackground,
                                                addNote,
                                                updateNote,
                                                deleteNote,
                                                reorderNotes,
                                                addToast
                                            }),
                                            ref: tabsRef
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                            lineNumber: 1064,
                                            columnNumber: 17
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                        lineNumber: 1041,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                lineNumber: 597,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$feedback$2f$Toast$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ToastContainer"], {
                                toasts: toasts,
                                onDismiss: dismissToast
                            }, void 0, false, {
                                fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                lineNumber: 1088,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$feedback$2f$YouDiedOverlay$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["YouDiedOverlay"], {
                                isVisible: showDeathAnimation,
                                onDismiss: clearDeathAnimation,
                                characterName: character.name
                            }, void 0, false, {
                                fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                lineNumber: 1090,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$feedback$2f$LevelUpOverlay$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["LevelUpOverlay"], {
                                isVisible: showLevelUpAnimation,
                                onDismiss: clearLevelUpAnimation,
                                newLevel: levelUpAnimationLevel,
                                characterName: character.name
                            }, void 0, false, {
                                fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                lineNumber: 1096,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$feedback$2f$ConfirmationModal$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ConfirmationModal"], {
                                isOpen: showResetModal,
                                onClose: ()=>setShowResetModal(false),
                                onConfirm: resetCharacter,
                                title: "Reset Character",
                                message: "Are you sure you want to reset this character? This will permanently delete all character data, including abilities, equipment, spells, and progress. This action cannot be undone.",
                                confirmText: "Reset Character",
                                cancelText: "Keep Character",
                                type: "danger"
                            }, void 0, false, {
                                fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                                lineNumber: 1104,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                        lineNumber: 561,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
                lineNumber: 543,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
            lineNumber: 542,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/apps/web/src/app/player/characters/[characterId]/page.tsx",
        lineNumber: 541,
        columnNumber: 5
    }, this);
}
}),
];

//# sourceMappingURL=apps_web_src_app_player_characters_%5BcharacterId%5D_4be0ff99._.js.map