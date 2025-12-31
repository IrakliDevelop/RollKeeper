(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/apps/web/src/hooks/useAutoSave.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useAutoSave",
    ()=>useAutoSave
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$store$2f$characterStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/store/characterStore.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/utils/constants.ts [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
;
;
;
const useAutoSave = function() {
    let options = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
    _s();
    const { delay = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AUTOSAVE_DELAY"], enabled = true } = options;
    const saveTimeoutRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const isInitialMount = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(true);
    const { hasUnsavedChanges, saveStatus, saveCharacter, setSaveStatus, markSaved } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$store$2f$characterStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCharacterStore"])();
    // Debounced save function
    const debouncedSave = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useAutoSave.useCallback[debouncedSave]": ()=>{
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
            if (!enabled || !hasUnsavedChanges) {
                return;
            }
            setSaveStatus('saving');
            saveTimeoutRef.current = setTimeout({
                "useAutoSave.useCallback[debouncedSave]": ()=>{
                    try {
                        saveCharacter();
                        setSaveStatus('saved');
                        markSaved();
                    } catch (error) {
                        console.error('Auto-save failed:', error);
                        setSaveStatus('error');
                    }
                }
            }["useAutoSave.useCallback[debouncedSave]"], delay);
        }
    }["useAutoSave.useCallback[debouncedSave]"], [
        enabled,
        hasUnsavedChanges,
        delay,
        saveCharacter,
        setSaveStatus,
        markSaved
    ]);
    // Manual save function (for Ctrl+S, etc.)
    const manualSave = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useAutoSave.useCallback[manualSave]": ()=>{
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
            if (!hasUnsavedChanges) {
                return;
            }
            setSaveStatus('saving');
            try {
                saveCharacter();
                setSaveStatus('saved');
                markSaved();
            } catch (error) {
                console.error('Manual save failed:', error);
                setSaveStatus('error');
            }
        }
    }["useAutoSave.useCallback[manualSave]"], [
        hasUnsavedChanges,
        saveCharacter,
        setSaveStatus,
        markSaved
    ]);
    // Effect to trigger auto-save when data changes
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useAutoSave.useEffect": ()=>{
            // Skip auto-save on initial mount to avoid saving default state
            if (isInitialMount.current) {
                isInitialMount.current = false;
                return;
            }
            if (hasUnsavedChanges && enabled) {
                debouncedSave();
            }
            // Cleanup timeout on unmount
            return ({
                "useAutoSave.useEffect": ()=>{
                    if (saveTimeoutRef.current) {
                        clearTimeout(saveTimeoutRef.current);
                    }
                }
            })["useAutoSave.useEffect"];
        }
    }["useAutoSave.useEffect"], [
        hasUnsavedChanges,
        debouncedSave,
        enabled
    ]);
    // Keyboard shortcuts effect
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useAutoSave.useEffect": ()=>{
            const handleKeyDown = {
                "useAutoSave.useEffect.handleKeyDown": (event)=>{
                    // Ctrl+S (or Cmd+S on Mac)
                    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
                        event.preventDefault();
                        manualSave();
                    }
                }
            }["useAutoSave.useEffect.handleKeyDown"];
            window.addEventListener('keydown', handleKeyDown);
            return ({
                "useAutoSave.useEffect": ()=>{
                    window.removeEventListener('keydown', handleKeyDown);
                }
            })["useAutoSave.useEffect"];
        }
    }["useAutoSave.useEffect"], [
        manualSave
    ]);
    // Save on page beforeunload (browser close/refresh)
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useAutoSave.useEffect": ()=>{
            const handleBeforeUnload = {
                "useAutoSave.useEffect.handleBeforeUnload": (event)=>{
                    if (hasUnsavedChanges) {
                        // Cancel any pending auto-save
                        if (saveTimeoutRef.current) {
                            clearTimeout(saveTimeoutRef.current);
                        }
                        // Attempt immediate save
                        try {
                            saveCharacter();
                        } catch (error) {
                            console.error('Failed to save on page unload:', error);
                        }
                        // Show browser warning if there are unsaved changes
                        event.preventDefault();
                        event.returnValue = '';
                        return '';
                    }
                }
            }["useAutoSave.useEffect.handleBeforeUnload"];
            window.addEventListener('beforeunload', handleBeforeUnload);
            return ({
                "useAutoSave.useEffect": ()=>{
                    window.removeEventListener('beforeunload', handleBeforeUnload);
                }
            })["useAutoSave.useEffect"];
        }
    }["useAutoSave.useEffect"], [
        hasUnsavedChanges,
        saveCharacter
    ]);
    // Save on visibility change (tab switch, minimize)
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useAutoSave.useEffect": ()=>{
            const handleVisibilityChange = {
                "useAutoSave.useEffect.handleVisibilityChange": ()=>{
                    if (document.visibilityState === 'hidden' && hasUnsavedChanges) {
                        // Cancel pending auto-save and save immediately
                        if (saveTimeoutRef.current) {
                            clearTimeout(saveTimeoutRef.current);
                        }
                        try {
                            saveCharacter();
                            markSaved();
                        } catch (error) {
                            console.error('Failed to save on visibility change:', error);
                        }
                    }
                }
            }["useAutoSave.useEffect.handleVisibilityChange"];
            document.addEventListener('visibilitychange', handleVisibilityChange);
            return ({
                "useAutoSave.useEffect": ()=>{
                    document.removeEventListener('visibilitychange', handleVisibilityChange);
                }
            })["useAutoSave.useEffect"];
        }
    }["useAutoSave.useEffect"], [
        hasUnsavedChanges,
        saveCharacter,
        markSaved
    ]);
    return {
        saveStatus,
        hasUnsavedChanges,
        manualSave,
        isAutoSaveEnabled: enabled
    };
};
_s(useAutoSave, "inNMAXiLlYZBCujC9Uy3Xeuq9Co=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$store$2f$characterStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCharacterStore"]
    ];
});
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/apps/web/src/hooks/useDragAndDrop.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useDragAndDrop",
    ()=>useDragAndDrop
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
;
function useDragAndDrop(param) {
    let { onReorder, disabled = false } = param;
    _s();
    const [draggedIndex, setDraggedIndex] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [dragOverIndex, setDragOverIndex] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const handleDragStart = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useDragAndDrop.useCallback[handleDragStart]": (e, index)=>{
            if (disabled) return;
            setDraggedIndex(index);
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', e.currentTarget.outerHTML);
            e.currentTarget.style.opacity = '0.5';
        }
    }["useDragAndDrop.useCallback[handleDragStart]"], [
        disabled
    ]);
    const handleDragEnd = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useDragAndDrop.useCallback[handleDragEnd]": (e)=>{
            if (disabled) return;
            e.currentTarget.style.opacity = '1';
            setDraggedIndex(null);
            setDragOverIndex(null);
        }
    }["useDragAndDrop.useCallback[handleDragEnd]"], [
        disabled
    ]);
    const handleDragOver = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useDragAndDrop.useCallback[handleDragOver]": (e, index)=>{
            if (disabled) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            setDragOverIndex(index);
        }
    }["useDragAndDrop.useCallback[handleDragOver]"], [
        disabled
    ]);
    const handleDragLeave = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useDragAndDrop.useCallback[handleDragLeave]": ()=>{
            if (disabled) return;
            setDragOverIndex(null);
        }
    }["useDragAndDrop.useCallback[handleDragLeave]"], [
        disabled
    ]);
    const handleDrop = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useDragAndDrop.useCallback[handleDrop]": (e, dropIndex)=>{
            if (disabled) return;
            e.preventDefault();
            if (draggedIndex !== null && draggedIndex !== dropIndex) {
                onReorder(draggedIndex, dropIndex);
            }
            setDraggedIndex(null);
            setDragOverIndex(null);
        }
    }["useDragAndDrop.useCallback[handleDrop]"], [
        disabled,
        draggedIndex,
        onReorder
    ]);
    const getDragOverStyles = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useDragAndDrop.useCallback[getDragOverStyles]": (index)=>{
            return dragOverIndex === index ? 'border-blue-400 border-2 bg-blue-50' : '';
        }
    }["useDragAndDrop.useCallback[getDragOverStyles]"], [
        dragOverIndex
    ]);
    const getDraggedStyles = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useDragAndDrop.useCallback[getDraggedStyles]": (index)=>{
            return draggedIndex === index ? 'opacity-50' : '';
        }
    }["useDragAndDrop.useCallback[getDraggedStyles]"], [
        draggedIndex
    ]);
    return {
        draggedIndex,
        dragOverIndex,
        isDragging: draggedIndex !== null,
        handleDragStart,
        handleDragEnd,
        handleDragOver,
        handleDragLeave,
        handleDrop,
        getDragOverStyles,
        getDraggedStyles
    };
}
_s(useDragAndDrop, "BY7QOWDSf6ZhbbQrDpigwbbyjok=");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/apps/web/src/hooks/useClassData.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useClassData",
    ()=>useClassData
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$apiClient$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/utils/apiClient.ts [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
;
;
function useClassData() {
    _s();
    const [classData, setClassData] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useClassData.useEffect": ()=>{
            async function loadClasses() {
                try {
                    setLoading(true);
                    const classes = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$apiClient$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["fetchClasses"])();
                    setClassData(classes);
                    setError(null);
                } catch (err) {
                    console.error('Failed to load class data:', err);
                    setError('Failed to load class data');
                } finally{
                    setLoading(false);
                }
            }
            loadClasses();
        }
    }["useClassData.useEffect"], []);
    return {
        classData,
        loading,
        error
    };
}
_s(useClassData, "2WK3vfQSCpE8Jl5DTWFq7ENWLeY=");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/apps/web/src/hooks/useDiceRoller.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useDiceRoller",
    ()=>useDiceRoller
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
// @ts-expect-error - DiceBox is not typed
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$3d$2d$dice$2f$dice$2d$box$2f$dist$2f$dice$2d$box$2e$es$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@3d-dice/dice-box/dist/dice-box.es.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$diceUtils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/utils/diceUtils.ts [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
;
;
;
function useDiceRoller(param) {
    let { containerId, theme = 'diceOfRolling', themeColor = '#feea03', scale = 6, autoClearDelay: initialAutoClearDelay = 10000, onRollComplete, onError, onLog } = param;
    _s();
    const [diceBox, setDiceBox] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [isInitialized, setIsInitialized] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [isRolling, setIsRolling] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [rollHistory, setRollHistory] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [autoClearDelay, setAutoClearDelay] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(initialAutoClearDelay);
    const [isMounted, setIsMounted] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    // Use ref to avoid recreating log function on every render
    const onLogRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(onLog);
    const onErrorRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(onError);
    // Update refs when props change
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useDiceRoller.useEffect": ()=>{
            onLogRef.current = onLog;
            onErrorRef.current = onError;
        }
    }["useDiceRoller.useEffect"]);
    // Stable log function
    const log = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useDiceRoller.useCallback[log]": (message)=>{
            console.log("[DiceRoller] ".concat(message));
            if (onLogRef.current) {
                onLogRef.current(message);
            }
        }
    }["useDiceRoller.useCallback[log]"], []);
    // Track mounting state
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useDiceRoller.useEffect": ()=>{
            setIsMounted(true);
            return ({
                "useDiceRoller.useEffect": ()=>setIsMounted(false)
            })["useDiceRoller.useEffect"];
        }
    }["useDiceRoller.useEffect"], []);
    // Initialize dice box
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useDiceRoller.useEffect": ()=>{
            if (!isInitialized && isMounted) {
                const initializeDiceBox = {
                    "useDiceRoller.useEffect.initializeDiceBox": ()=>{
                        // Check if DOM element exists
                        const containerElement = document.querySelector("#".concat(containerId));
                        if (!containerElement) {
                            log("Container element #".concat(containerId, " not found, waiting for DOM..."));
                            return false;
                        }
                        const rect = containerElement.getBoundingClientRect();
                        log("Container element #".concat(containerId, " found at ").concat(Math.round(rect.left), ",").concat(Math.round(rect.top), " size ").concat(Math.round(rect.width), "x").concat(Math.round(rect.height), " - creating DiceBox..."));
                        const selector = "#".concat(containerId);
                        const box = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$3d$2d$dice$2f$dice$2d$box$2f$dist$2f$dice$2d$box$2e$es$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"](selector, {
                            assetPath: '/assets/',
                            scale,
                            theme,
                            themeColor,
                            offscreen: false,
                            throwForce: 5,
                            gravity: 1,
                            mass: 1,
                            spinForce: 6
                        });
                        setDiceBox(box);
                        log('DiceBox instance created');
                        box.init().then({
                            "useDiceRoller.useEffect.initializeDiceBox": ()=>{
                                log('DiceBox initialized successfully');
                                setIsInitialized(true);
                            }
                        }["useDiceRoller.useEffect.initializeDiceBox"]).catch({
                            "useDiceRoller.useEffect.initializeDiceBox": (error)=>{
                                const errorMessage = error instanceof Error ? error.message : String(error);
                                const message = "Failed to initialize DiceBox: ".concat(errorMessage);
                                log(message);
                                if (onErrorRef.current) {
                                    onErrorRef.current(message);
                                }
                            }
                        }["useDiceRoller.useEffect.initializeDiceBox"]);
                        return true;
                    }
                }["useDiceRoller.useEffect.initializeDiceBox"];
                // Try to initialize immediately
                if (!initializeDiceBox()) {
                    // If DOM not ready, wait a bit and try again (only once)
                    const timer = setTimeout({
                        "useDiceRoller.useEffect.timer": ()=>{
                            initializeDiceBox();
                        }
                    }["useDiceRoller.useEffect.timer"], 100);
                    return ({
                        "useDiceRoller.useEffect": ()=>clearTimeout(timer)
                    })["useDiceRoller.useEffect"];
                }
            }
        }
    }["useDiceRoller.useEffect"], [
        containerId,
        scale,
        theme,
        themeColor,
        isInitialized,
        isMounted,
        log
    ]);
    // Roll dice function
    const roll = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useDiceRoller.useCallback[roll]": async (notation)=>{
            if (!diceBox || !isInitialized) {
                const message = 'DiceBox not ready yet';
                log(message);
                if (onErrorRef.current) {
                    onErrorRef.current(message);
                }
                return null;
            }
            if (isRolling) {
                const message = 'Already rolling dice, please wait';
                log(message);
                if (onErrorRef.current) {
                    onErrorRef.current(message);
                }
                return null;
            }
            setIsRolling(true);
            log("Rolling: ".concat(notation));
            try {
                if (!diceBox.roll) {
                    throw new Error('DiceBox roll method not available');
                }
                const results = await diceBox.roll(notation);
                log("Roll completed: ".concat(notation));
                // Calculate summary
                const summary = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$diceUtils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["calculateRollSummary"])(results, notation);
                setRollHistory({
                    "useDiceRoller.useCallback[roll]": (prev)=>[
                            ...prev,
                            summary
                        ]
                }["useDiceRoller.useCallback[roll]"]);
                log("Total: ".concat(summary.finalTotal, " (dice: ").concat(summary.total, ", modifier: ").concat(summary.modifier, ")"));
                // Call completion callback
                if (onRollComplete) {
                    onRollComplete(summary);
                }
                // Auto-clear if enabled
                if (autoClearDelay > 0) {
                    (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$diceUtils$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["autoClearDice"])(diceBox, autoClearDelay, {
                        "useDiceRoller.useCallback[roll]": ()=>{
                            log("Dice auto-cleared after ".concat(autoClearDelay, "ms"));
                        }
                    }["useDiceRoller.useCallback[roll]"]);
                }
                setIsRolling(false);
                return summary;
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                const message = "Error rolling dice: ".concat(errorMessage);
                log(message);
                if (onErrorRef.current) {
                    onErrorRef.current(message);
                }
                setIsRolling(false);
                return null;
            }
        }
    }["useDiceRoller.useCallback[roll]"], [
        diceBox,
        isInitialized,
        isRolling,
        autoClearDelay,
        onRollComplete,
        log
    ]);
    // Clear dice function
    const clearDice = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useDiceRoller.useCallback[clearDice]": ()=>{
            if (diceBox && typeof diceBox.clear === 'function' && isInitialized) {
                log('Clearing dice from screen');
                try {
                    diceBox.clear();
                    log('Dice cleared successfully');
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    const message = "Error clearing dice: ".concat(errorMessage);
                    log(message);
                    if (onErrorRef.current) {
                        onErrorRef.current(message);
                    }
                }
            } else {
                const message = 'Cannot clear dice - not initialized or clear method unavailable';
                log(message);
                if (onErrorRef.current) {
                    onErrorRef.current(message);
                }
            }
        }
    }["useDiceRoller.useCallback[clearDice]"], [
        diceBox,
        isInitialized,
        log
    ]);
    // Clear history function
    const clearHistory = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useDiceRoller.useCallback[clearHistory]": ()=>{
            setRollHistory([]);
            log('Roll history cleared');
        }
    }["useDiceRoller.useCallback[clearHistory]"], [
        log
    ]);
    // Cleanup on unmount
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useDiceRoller.useEffect": ()=>{
            return ({
                "useDiceRoller.useEffect": ()=>{
                    if (diceBox && typeof diceBox.clear === 'function') {
                        try {
                            console.log('[DiceRoller] Cleaning up DiceBox on unmount');
                            diceBox.clear();
                        } catch (error) {
                            console.warn('Error during component unmount cleanup:', error);
                        }
                    }
                }
            })["useDiceRoller.useEffect"];
        }
    }["useDiceRoller.useEffect"], [
        diceBox
    ]);
    return {
        isInitialized,
        isRolling,
        rollHistory,
        roll,
        clearDice,
        clearHistory,
        setAutoClearDelay,
        autoClearDelay
    };
}
_s(useDiceRoller, "FeW9sD6P/5/lNKgmwbvIzP8CLAw=");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/apps/web/src/hooks/useSimpleDiceRoll.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useSimpleDiceRoll",
    ()=>useSimpleDiceRoll
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$hooks$2f$useDiceRoller$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/hooks/useDiceRoller.ts [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
;
;
function useSimpleDiceRoll() {
    let { containerId = 'main-dice-container', autoClearDelay = 1000, onRollComplete, onError } = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
    _s();
    const { isInitialized, isRolling, roll, clearDice } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$hooks$2f$useDiceRoller$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useDiceRoller"])({
        containerId,
        autoClearDelay,
        onRollComplete,
        onError
    });
    const rollDice = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useSimpleDiceRoll.useCallback[rollDice]": async (notation)=>{
            return await roll(notation);
        }
    }["useSimpleDiceRoll.useCallback[rollDice]"], [
        roll
    ]);
    return {
        isReady: isInitialized,
        isRolling,
        roll: rollDice,
        clearDice
    };
}
_s(useSimpleDiceRoll, "/Wwhn00Av0Pnxy09bzdmEME0zKU=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$hooks$2f$useDiceRoller$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useDiceRoller"]
    ];
});
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/apps/web/src/hooks/useBackgroundsData.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Hook for loading and managing background data
 * Similar to useSpellsData
 */ __turbopack_context__.s([
    "useBackgroundsData",
    ()=>useBackgroundsData
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
'use client';
;
function useBackgroundsData() {
    _s();
    const [backgrounds, setBackgrounds] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [features, setFeatures] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    // Load backgrounds on mount
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useBackgroundsData.useEffect": ()=>{
            let mounted = true;
            const loadData = {
                "useBackgroundsData.useEffect.loadData": async ()=>{
                    try {
                        setLoading(true);
                        setError(null);
                        const response = await fetch('/api/backgrounds');
                        if (!response.ok) {
                            throw new Error("Failed to fetch backgrounds: ".concat(response.statusText));
                        }
                        const data = await response.json();
                        if (mounted) {
                            setBackgrounds(data.backgrounds || []);
                            setFeatures(data.features || []);
                            setLoading(false);
                        }
                    } catch (err) {
                        console.error('Error loading backgrounds:', err);
                        if (mounted) {
                            setError(err instanceof Error ? err : new Error('Failed to load backgrounds'));
                            setLoading(false);
                        }
                    }
                }
            }["useBackgroundsData.useEffect.loadData"];
            loadData();
            return ({
                "useBackgroundsData.useEffect": ()=>{
                    mounted = false;
                }
            })["useBackgroundsData.useEffect"];
        }
    }["useBackgroundsData.useEffect"], []);
    // Get background by name
    const getBackgroundByName = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useBackgroundsData.useCallback[getBackgroundByName]": (name)=>{
            const nameLower = name.toLowerCase();
            return backgrounds.find({
                "useBackgroundsData.useCallback[getBackgroundByName]": (bg)=>bg.name.toLowerCase() === nameLower
            }["useBackgroundsData.useCallback[getBackgroundByName]"]);
        }
    }["useBackgroundsData.useCallback[getBackgroundByName]"], [
        backgrounds
    ]);
    // Search features by query
    const searchFeatures = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useBackgroundsData.useCallback[searchFeatures]": (query)=>{
            if (!query.trim()) return features;
            const queryLower = query.toLowerCase().trim();
            return features.filter({
                "useBackgroundsData.useCallback[searchFeatures]": (feature)=>feature.name.toLowerCase().includes(queryLower) || feature.backgroundName.toLowerCase().includes(queryLower) || feature.description.toLowerCase().includes(queryLower)
            }["useBackgroundsData.useCallback[searchFeatures]"]);
        }
    }["useBackgroundsData.useCallback[searchFeatures]"], [
        features
    ]);
    return {
        backgrounds,
        features,
        loading,
        error,
        getBackgroundByName,
        searchFeatures
    };
}
_s(useBackgroundsData, "qtArqELFGOG2MEDiWuAq1IUl8OQ=");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/apps/web/src/hooks/useFeatsData.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Hook for loading and managing feat data
 * Similar to useSpellsData
 */ __turbopack_context__.s([
    "useFeatsData",
    ()=>useFeatsData
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
'use client';
;
function useFeatsData() {
    _s();
    const [feats, setFeats] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    // Load feats on mount
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useFeatsData.useEffect": ()=>{
            let mounted = true;
            const loadData = {
                "useFeatsData.useEffect.loadData": async ()=>{
                    try {
                        setLoading(true);
                        setError(null);
                        const response = await fetch('/api/feats');
                        if (!response.ok) {
                            throw new Error("Failed to fetch feats: ".concat(response.statusText));
                        }
                        const data = await response.json();
                        if (mounted) {
                            setFeats(data.feats || []);
                            setLoading(false);
                        }
                    } catch (err) {
                        console.error('Error loading feats:', err);
                        if (mounted) {
                            setError(err instanceof Error ? err : new Error('Failed to load feats'));
                            setLoading(false);
                        }
                    }
                }
            }["useFeatsData.useEffect.loadData"];
            loadData();
            return ({
                "useFeatsData.useEffect": ()=>{
                    mounted = false;
                }
            })["useFeatsData.useEffect"];
        }
    }["useFeatsData.useEffect"], []);
    // Search feats by query
    const searchResults = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useFeatsData.useCallback[searchResults]": (query)=>{
            if (!query.trim()) return feats;
            const queryLower = query.toLowerCase().trim();
            return feats.filter({
                "useFeatsData.useCallback[searchResults]": (feat)=>feat.name.toLowerCase().includes(queryLower) || feat.description.toLowerCase().includes(queryLower) || feat.prerequisites.some({
                        "useFeatsData.useCallback[searchResults]": (p)=>p.toLowerCase().includes(queryLower)
                    }["useFeatsData.useCallback[searchResults]"]) || feat.tags.some({
                        "useFeatsData.useCallback[searchResults]": (t)=>t.toLowerCase().includes(queryLower)
                    }["useFeatsData.useCallback[searchResults]"])
            }["useFeatsData.useCallback[searchResults]"]);
        }
    }["useFeatsData.useCallback[searchResults]"], [
        feats
    ]);
    // Get feat by name (case-insensitive)
    const getFeatByName = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useFeatsData.useCallback[getFeatByName]": (name)=>{
            const nameLower = name.toLowerCase();
            return feats.find({
                "useFeatsData.useCallback[getFeatByName]": (feat)=>feat.name.toLowerCase() === nameLower
            }["useFeatsData.useCallback[getFeatByName]"]);
        }
    }["useFeatsData.useCallback[getFeatByName]"], [
        feats
    ]);
    return {
        feats,
        loading,
        error,
        searchResults,
        getFeatByName
    };
}
_s(useFeatsData, "mHPQY6BdsEPQXPhYG4/Z8wBens8=");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/apps/web/src/hooks/useFeatureSourcesData.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Hook for loading and managing all feature sources
 * Aggregates backgrounds, feats, and class features
 */ __turbopack_context__.s([
    "useFeatureSourcesData",
    ()=>useFeatureSourcesData
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$hooks$2f$useBackgroundsData$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/hooks/useBackgroundsData.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$hooks$2f$useFeatsData$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/hooks/useFeatsData.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$types$2f$features$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/types/features.ts [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
;
function useFeatureSourcesData(character) {
    _s();
    const { features: backgroundFeatures, loading: backgroundsLoading, error: backgroundsError } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$hooks$2f$useBackgroundsData$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useBackgroundsData"])();
    const { feats, loading: featsLoading, error: featsError } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$hooks$2f$useFeatsData$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useFeatsData"])();
    const [classes, setClasses] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [classesLoading, setClassesLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [classesError, setClassesError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    // Load class data on mount
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useFeatureSourcesData.useEffect": ()=>{
            let mounted = true;
            const loadData = {
                "useFeatureSourcesData.useEffect.loadData": async ()=>{
                    try {
                        setClassesLoading(true);
                        setClassesError(null);
                        const response = await fetch('/api/classes');
                        if (!response.ok) {
                            throw new Error("Failed to fetch classes: ".concat(response.statusText));
                        }
                        const data = await response.json();
                        if (mounted) {
                            setClasses(data.classes || []);
                            setClassesLoading(false);
                        }
                    } catch (err) {
                        console.error('Error loading classes:', err);
                        if (mounted) {
                            setClassesError(err instanceof Error ? err : new Error('Failed to load classes'));
                            setClassesLoading(false);
                        }
                    }
                }
            }["useFeatureSourcesData.useEffect.loadData"];
            loadData();
            return ({
                "useFeatureSourcesData.useEffect": ()=>{
                    mounted = false;
                }
            })["useFeatureSourcesData.useEffect"];
        }
    }["useFeatureSourcesData.useEffect"], []);
    // Combine loading and error states
    const loading = backgroundsLoading || featsLoading || classesLoading;
    const error = backgroundsError || featsError || classesError;
    // Convert all sources to unified autocomplete items
    const allFeatures = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "useFeatureSourcesData.useMemo[allFeatures]": ()=>{
            const items = [];
            // Add background features
            backgroundFeatures.forEach({
                "useFeatureSourcesData.useMemo[allFeatures]": (feature)=>{
                    items.push((0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$types$2f$features$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["backgroundFeatureToAutocompleteItem"])(feature));
                }
            }["useFeatureSourcesData.useMemo[allFeatures]"]);
            // Add feats
            feats.forEach({
                "useFeatureSourcesData.useMemo[allFeatures]": (feat)=>{
                    items.push((0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$types$2f$features$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["featToAutocompleteItem"])(feat));
                }
            }["useFeatureSourcesData.useMemo[allFeatures]"]);
            // Add class features from all classes
            // Note: We load ALL class/subclass features and let the user select via dropdown
            classes.forEach({
                "useFeatureSourcesData.useMemo[allFeatures]": (classData)=>{
                    var // Add all subclass features (user will select via dropdown)
                    _classData_subclasses;
                    // Add main class features
                    classData.features.forEach({
                        "useFeatureSourcesData.useMemo[allFeatures]": (feature)=>{
                            // If character data available, only show features up to their level
                            if (!character || feature.level <= character.level) {
                                items.push((0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$types$2f$features$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["classFeatureToAutocompleteItem"])(feature));
                            }
                        }
                    }["useFeatureSourcesData.useMemo[allFeatures]"]);
                    (_classData_subclasses = classData.subclasses) === null || _classData_subclasses === void 0 ? void 0 : _classData_subclasses.forEach({
                        "useFeatureSourcesData.useMemo[allFeatures]": (subclass)=>{
                            subclass.features.forEach({
                                "useFeatureSourcesData.useMemo[allFeatures]": (feature)=>{
                                    // If character data available, only show features up to their level
                                    if (!character || feature.level <= character.level) {
                                        items.push((0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$types$2f$features$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["classFeatureToAutocompleteItem"])(feature));
                                    }
                                }
                            }["useFeatureSourcesData.useMemo[allFeatures]"]);
                        }
                    }["useFeatureSourcesData.useMemo[allFeatures]"]);
                }
            }["useFeatureSourcesData.useMemo[allFeatures]"]);
            return items;
        }
    }["useFeatureSourcesData.useMemo[allFeatures]"], [
        backgroundFeatures,
        feats,
        classes,
        character
    ]);
    // Filter by source type
    const filterBySourceType = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useFeatureSourcesData.useCallback[filterBySourceType]": (sourceType)=>{
            if (sourceType === 'all') return allFeatures;
            return allFeatures.filter({
                "useFeatureSourcesData.useCallback[filterBySourceType]": (f)=>f.sourceType === sourceType
            }["useFeatureSourcesData.useCallback[filterBySourceType]"]);
        }
    }["useFeatureSourcesData.useCallback[filterBySourceType]"], [
        allFeatures
    ]);
    // Filter by class name
    const filterByClass = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useFeatureSourcesData.useCallback[filterByClass]": (className)=>{
            return allFeatures.filter({
                "useFeatureSourcesData.useCallback[filterByClass]": (f)=>{
                    var _f_metadata_className;
                    return f.sourceType === 'class' && ((_f_metadata_className = f.metadata.className) === null || _f_metadata_className === void 0 ? void 0 : _f_metadata_className.toLowerCase()) === className.toLowerCase() && !f.metadata.isSubclassFeature;
                }
            }["useFeatureSourcesData.useCallback[filterByClass]"]);
        }
    }["useFeatureSourcesData.useCallback[filterByClass]"], [
        allFeatures
    ]);
    // Filter by subclass (className and subclass name/short name)
    const filterBySubclass = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useFeatureSourcesData.useCallback[filterBySubclass]": (className, subclassName)=>{
            return allFeatures.filter({
                "useFeatureSourcesData.useCallback[filterBySubclass]": (f)=>{
                    var _f_metadata_className, _f_metadata_subclassShortName;
                    if (f.sourceType !== 'subclass') return false;
                    if (((_f_metadata_className = f.metadata.className) === null || _f_metadata_className === void 0 ? void 0 : _f_metadata_className.toLowerCase()) !== className.toLowerCase()) return false;
                    // If no subclass name provided, return all subclasses for this class
                    if (!subclassName) return true;
                    // Filter by specific subclass
                    return ((_f_metadata_subclassShortName = f.metadata.subclassShortName) === null || _f_metadata_subclassShortName === void 0 ? void 0 : _f_metadata_subclassShortName.toLowerCase().includes(subclassName.toLowerCase())) || f.name.toLowerCase().includes(subclassName.toLowerCase());
                }
            }["useFeatureSourcesData.useCallback[filterBySubclass]"]);
        }
    }["useFeatureSourcesData.useCallback[filterBySubclass]"], [
        allFeatures
    ]);
    // Search features with optional source type filter
    const searchFeatures = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useFeatureSourcesData.useCallback[searchFeatures]": (query, sourceType)=>{
            const features = sourceType && sourceType !== 'all' ? filterBySourceType(sourceType) : allFeatures;
            if (!query.trim()) return features;
            const queryLower = query.toLowerCase().trim();
            return features.filter({
                "useFeatureSourcesData.useCallback[searchFeatures]": (f)=>{
                    var _f_metadata_backgroundName, _f_metadata_className;
                    return f.name.toLowerCase().includes(queryLower) || f.description.toLowerCase().includes(queryLower) || f.tags.some({
                        "useFeatureSourcesData.useCallback[searchFeatures]": (t)=>t.toLowerCase().includes(queryLower)
                    }["useFeatureSourcesData.useCallback[searchFeatures]"]) || ((_f_metadata_backgroundName = f.metadata.backgroundName) === null || _f_metadata_backgroundName === void 0 ? void 0 : _f_metadata_backgroundName.toLowerCase().includes(queryLower)) || ((_f_metadata_className = f.metadata.className) === null || _f_metadata_className === void 0 ? void 0 : _f_metadata_className.toLowerCase().includes(queryLower));
                }
            }["useFeatureSourcesData.useCallback[searchFeatures]"]);
        }
    }["useFeatureSourcesData.useCallback[searchFeatures]"], [
        allFeatures,
        filterBySourceType
    ]);
    return {
        allFeatures,
        loading,
        error,
        filterBySourceType,
        filterByClass,
        filterBySubclass,
        searchFeatures
    };
}
_s(useFeatureSourcesData, "X1kpboGPTqE0LrFVhDmpmwdd8/8=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$hooks$2f$useBackgroundsData$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useBackgroundsData"],
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$hooks$2f$useFeatsData$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useFeatsData"]
    ];
});
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/apps/web/src/hooks/useHydration.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useHydration",
    ()=>useHydration
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$store$2f$characterStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/store/characterStore.ts [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
;
;
function useHydration() {
    _s();
    const hasHydrated = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$store$2f$characterStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCharacterStore"])({
        "useHydration.useCharacterStore[hasHydrated]": (state)=>state.hasHydrated
    }["useHydration.useCharacterStore[hasHydrated]"]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useHydration.useEffect": ()=>{
            // Set hasHydrated to true after initial render to prevent hydration mismatches
            // The onRehydrateStorage callback will have already run if there was stored data
            if (!hasHydrated) {
                console.log('[useHydration] Setting hasHydrated to true');
                const timer = setTimeout({
                    "useHydration.useEffect.timer": ()=>{
                        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$store$2f$characterStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCharacterStore"].setState({
                            hasHydrated: true
                        });
                    }
                }["useHydration.useEffect.timer"], 0);
                return ({
                    "useHydration.useEffect": ()=>clearTimeout(timer)
                })["useHydration.useEffect"];
            }
        }
    }["useHydration.useEffect"], [
        hasHydrated
    ]);
    return hasHydrated;
}
_s(useHydration, "S/4XOagNPgzqnUkQJWySBuuj6so=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$store$2f$characterStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCharacterStore"]
    ];
});
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/apps/web/src/hooks/useSpellsData.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Hook for loading and managing spell data from spellbook
 */ __turbopack_context__.s([
    "clearSpellCache",
    ()=>clearSpellCache,
    "useSpellsData",
    ()=>useSpellsData
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$spellConversion$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/utils/spellConversion.ts [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
'use client';
;
;
// Cache spells in memory for the session
let cachedSpells = null;
let cachePromise = null;
/**
 * Fetch spells from the API
 */ async function fetchSpells() {
    // Return cached spells if available
    if (cachedSpells) {
        return cachedSpells;
    }
    // If already fetching, return the existing promise
    if (cachePromise) {
        return cachePromise;
    }
    // Start fetching
    cachePromise = fetch('/api/spells').then((res)=>{
        if (!res.ok) {
            throw new Error("Failed to fetch spells: ".concat(res.statusText));
        }
        return res.json();
    }).then((data)=>{
        cachedSpells = data.spells;
        cachePromise = null;
        return cachedSpells;
    }).catch((error)=>{
        cachePromise = null;
        throw error;
    });
    return cachePromise;
}
function useSpellsData() {
    _s();
    const [spells, setSpells] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    // Load spells on mount
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useSpellsData.useEffect": ()=>{
            let mounted = true;
            const loadSpells = {
                "useSpellsData.useEffect.loadSpells": async ()=>{
                    try {
                        setLoading(true);
                        setError(null);
                        const data = await fetchSpells();
                        if (mounted) {
                            setSpells(data);
                            setLoading(false);
                        }
                    } catch (err) {
                        console.error('Error loading spells:', err);
                        if (mounted) {
                            setError(err instanceof Error ? err : new Error('Failed to load spells'));
                            setLoading(false);
                        }
                    }
                }
            }["useSpellsData.useEffect.loadSpells"];
            loadSpells();
            return ({
                "useSpellsData.useEffect": ()=>{
                    mounted = false;
                }
            })["useSpellsData.useEffect"];
        }
    }["useSpellsData.useEffect"], []);
    // Search spells by query
    const searchResults = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useSpellsData.useCallback[searchResults]": (query)=>{
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$spellConversion$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["searchSpells"])(spells, query);
        }
    }["useSpellsData.useCallback[searchResults]"], [
        spells
    ]);
    // Get spell by ID
    const getSpellById = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useSpellsData.useCallback[getSpellById]": (id)=>{
            return spells.find({
                "useSpellsData.useCallback[getSpellById]": (spell)=>spell.id === id
            }["useSpellsData.useCallback[getSpellById]"]);
        }
    }["useSpellsData.useCallback[getSpellById]"], [
        spells
    ]);
    // Get spell by name (case-insensitive)
    const getSpellByName = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useSpellsData.useCallback[getSpellByName]": (name)=>{
            const nameLower = name.toLowerCase();
            return spells.find({
                "useSpellsData.useCallback[getSpellByName]": (spell)=>spell.name.toLowerCase() === nameLower
            }["useSpellsData.useCallback[getSpellByName]"]);
        }
    }["useSpellsData.useCallback[getSpellByName]"], [
        spells
    ]);
    return {
        spells,
        loading,
        error,
        searchResults,
        getSpellById,
        getSpellByName
    };
}
_s(useSpellsData, "FHWNa7LkJ8bwgiv7UfDpW+E6MBs=");
function clearSpellCache() {
    cachedSpells = null;
    cachePromise = null;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/apps/web/src/types/character.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// Basic character types for D&D 5e character sheet
__turbopack_context__.s([
    "FEATURE_SOURCE_DESCRIPTIONS",
    ()=>FEATURE_SOURCE_DESCRIPTIONS,
    "FEATURE_SOURCE_LABELS",
    ()=>FEATURE_SOURCE_LABELS,
    "createDefaultExtendedFeature",
    ()=>createDefaultExtendedFeature,
    "groupFeaturesBySource",
    ()=>groupFeaturesBySource,
    "migrateTraitToExtendedFeature",
    ()=>migrateTraitToExtendedFeature
]);
const FEATURE_SOURCE_LABELS = {
    class: 'Class Features',
    race: 'Racial Features',
    feat: 'Feats',
    background: 'Background Features',
    'magic-item': 'Magic Items',
    other: 'Other/Custom'
};
const FEATURE_SOURCE_DESCRIPTIONS = {
    class: 'Abilities gained from your character class and level',
    race: "Traits and abilities from your character's race and subrace",
    feat: 'Special abilities gained from feats',
    background: "Features from your character's background",
    'magic-item': 'Abilities granted by magic items and equipment',
    other: 'Custom or miscellaneous abilities'
};
function migrateTraitToExtendedFeature(trait, index) {
    return {
        ...trait,
        sourceType: 'other',
        sourceDetail: trait.source || undefined,
        displayOrder: index,
        isPassive: trait.maxUses === 0
    };
}
function groupFeaturesBySource(features) {
    const grouped = features.reduce((acc, feature)=>{
        if (!acc[feature.sourceType]) {
            acc[feature.sourceType] = [];
        }
        acc[feature.sourceType].push(feature);
        return acc;
    }, {});
    return Object.entries(grouped).map((param)=>{
        let [sourceType, features] = param;
        return {
            sourceType: sourceType,
            label: FEATURE_SOURCE_LABELS[sourceType],
            description: FEATURE_SOURCE_DESCRIPTIONS[sourceType],
            features: features.sort((a, b)=>a.displayOrder - b.displayOrder),
            isCollapsed: false
        };
    });
}
function createDefaultExtendedFeature() {
    let sourceType = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : 'other';
    return {
        name: '',
        description: '',
        maxUses: 1,
        usedUses: 0,
        restType: 'long',
        source: '',
        sourceType,
        sourceDetail: '',
        category: '',
        displayOrder: 0,
        isPassive: false,
        scaleWithProficiency: false,
        proficiencyMultiplier: 1
    };
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/apps/web/src/types/features.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Feature Source Types
 * Unified types for all feature/trait sources (backgrounds, feats, class features)
 */ __turbopack_context__.s([
    "backgroundFeatureToAutocompleteItem",
    ()=>backgroundFeatureToAutocompleteItem,
    "classFeatureToAutocompleteItem",
    ()=>classFeatureToAutocompleteItem,
    "featToAutocompleteItem",
    ()=>featToAutocompleteItem,
    "isBackgroundFeature",
    ()=>isBackgroundFeature,
    "isClassFeature",
    ()=>isClassFeature,
    "isFeat",
    ()=>isFeat
]);
function isBackgroundFeature(feature) {
    return 'backgroundName' in feature;
}
function isFeat(feature) {
    return 'prerequisites' in feature && 'repeatable' in feature;
}
function isClassFeature(feature) {
    return 'className' in feature && 'level' in feature;
}
function backgroundFeatureToAutocompleteItem(feature) {
    return {
        id: feature.id,
        name: feature.name,
        source: feature.source,
        sourceType: 'background',
        description: feature.description,
        metadata: {
            backgroundName: feature.backgroundName,
            skills: feature.skills
        },
        tags: [
            feature.source,
            feature.backgroundName,
            'background'
        ]
    };
}
function featToAutocompleteItem(feat) {
    return {
        id: feat.id,
        name: feat.name,
        source: feat.source,
        sourceType: 'feat',
        description: feat.description,
        metadata: {
            prerequisites: feat.prerequisites,
            abilityIncreases: feat.abilityIncreases,
            repeatable: feat.repeatable
        },
        tags: feat.tags
    };
}
function classFeatureToAutocompleteItem(feature) {
    var _feature_entries;
    // Create a unique ID that includes source and subclass (if applicable) to avoid collisions
    const sourceKey = feature.source.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const subclassKey = feature.subclassShortName ? "-".concat(feature.subclassShortName.toLowerCase().replace(/[^a-z0-9]/g, '-')) : '';
    // Use a counter or index to ensure uniqueness even within same class/level/source/subclass
    const id = "".concat(feature.className, "-").concat(feature.name, "-").concat(feature.level, "-").concat(sourceKey).concat(subclassKey, "-").concat(feature.original || '');
    return {
        id,
        name: feature.name,
        source: feature.source,
        sourceType: feature.isSubclassFeature ? 'subclass' : 'class',
        description: ((_feature_entries = feature.entries) === null || _feature_entries === void 0 ? void 0 : _feature_entries.join('\n\n')) || '',
        metadata: {
            className: feature.className,
            level: feature.level,
            isSubclassFeature: feature.isSubclassFeature,
            subclassShortName: feature.subclassShortName
        },
        tags: [
            feature.source,
            feature.className || '',
            feature.isSubclassFeature ? 'subclass' : 'class',
            ...feature.subclassShortName ? [
                feature.subclassShortName
            ] : []
        ].filter(Boolean)
    };
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/apps/web/src/contexts/NavigationContext.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "NavigationContext",
    ()=>NavigationContext,
    "useNavigation",
    ()=>useNavigation
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
'use client';
;
const NavigationContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createContext"])(null);
const useNavigation = ()=>{
    _s();
    const context = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"])(NavigationContext);
    if (!context) {
        throw new Error('useNavigation must be used within NavigationContext');
    }
    return context;
};
_s(useNavigation, "b9L3QQ+jgeyIrH0NfHrJ8nn7VMU=");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=apps_web_src_18d0bd89._.js.map