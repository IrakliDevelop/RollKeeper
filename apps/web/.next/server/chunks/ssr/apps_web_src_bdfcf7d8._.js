module.exports = [
"[project]/apps/web/src/hooks/useAutoSave.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useAutoSave",
    ()=>useAutoSave
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$store$2f$characterStore$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/store/characterStore.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/utils/constants.ts [app-ssr] (ecmascript)");
;
;
;
const useAutoSave = (options = {})=>{
    const { delay = __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$constants$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["AUTOSAVE_DELAY"], enabled = true } = options;
    const saveTimeoutRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const isInitialMount = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(true);
    const { hasUnsavedChanges, saveStatus, saveCharacter, setSaveStatus, markSaved } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$store$2f$characterStore$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCharacterStore"])();
    // Debounced save function
    const debouncedSave = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(()=>{
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
        if (!enabled || !hasUnsavedChanges) {
            return;
        }
        setSaveStatus('saving');
        saveTimeoutRef.current = setTimeout(()=>{
            try {
                saveCharacter();
                setSaveStatus('saved');
                markSaved();
            } catch (error) {
                console.error('Auto-save failed:', error);
                setSaveStatus('error');
            }
        }, delay);
    }, [
        enabled,
        hasUnsavedChanges,
        delay,
        saveCharacter,
        setSaveStatus,
        markSaved
    ]);
    // Manual save function (for Ctrl+S, etc.)
    const manualSave = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(()=>{
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
    }, [
        hasUnsavedChanges,
        saveCharacter,
        setSaveStatus,
        markSaved
    ]);
    // Effect to trigger auto-save when data changes
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        // Skip auto-save on initial mount to avoid saving default state
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }
        if (hasUnsavedChanges && enabled) {
            debouncedSave();
        }
        // Cleanup timeout on unmount
        return ()=>{
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [
        hasUnsavedChanges,
        debouncedSave,
        enabled
    ]);
    // Keyboard shortcuts effect
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const handleKeyDown = (event)=>{
            // Ctrl+S (or Cmd+S on Mac)
            if ((event.ctrlKey || event.metaKey) && event.key === 's') {
                event.preventDefault();
                manualSave();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return ()=>{
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [
        manualSave
    ]);
    // Save on page beforeunload (browser close/refresh)
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const handleBeforeUnload = (event)=>{
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
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return ()=>{
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [
        hasUnsavedChanges,
        saveCharacter
    ]);
    // Save on visibility change (tab switch, minimize)
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        const handleVisibilityChange = ()=>{
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
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return ()=>{
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [
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
}),
"[project]/apps/web/src/hooks/useDragAndDrop.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useDragAndDrop",
    ()=>useDragAndDrop
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
;
function useDragAndDrop({ onReorder, disabled = false }) {
    const [draggedIndex, setDraggedIndex] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [dragOverIndex, setDragOverIndex] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const handleDragStart = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((e, index)=>{
        if (disabled) return;
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.currentTarget.outerHTML);
        e.currentTarget.style.opacity = '0.5';
    }, [
        disabled
    ]);
    const handleDragEnd = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((e)=>{
        if (disabled) return;
        e.currentTarget.style.opacity = '1';
        setDraggedIndex(null);
        setDragOverIndex(null);
    }, [
        disabled
    ]);
    const handleDragOver = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((e, index)=>{
        if (disabled) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverIndex(index);
    }, [
        disabled
    ]);
    const handleDragLeave = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(()=>{
        if (disabled) return;
        setDragOverIndex(null);
    }, [
        disabled
    ]);
    const handleDrop = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((e, dropIndex)=>{
        if (disabled) return;
        e.preventDefault();
        if (draggedIndex !== null && draggedIndex !== dropIndex) {
            onReorder(draggedIndex, dropIndex);
        }
        setDraggedIndex(null);
        setDragOverIndex(null);
    }, [
        disabled,
        draggedIndex,
        onReorder
    ]);
    const getDragOverStyles = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((index)=>{
        return dragOverIndex === index ? 'border-blue-400 border-2 bg-blue-50' : '';
    }, [
        dragOverIndex
    ]);
    const getDraggedStyles = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((index)=>{
        return draggedIndex === index ? 'opacity-50' : '';
    }, [
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
}),
"[project]/apps/web/src/hooks/useClassData.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useClassData",
    ()=>useClassData
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$apiClient$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/utils/apiClient.ts [app-ssr] (ecmascript)");
;
;
function useClassData() {
    const [classData, setClassData] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])([]);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(true);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        async function loadClasses() {
            try {
                setLoading(true);
                const classes = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$apiClient$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchClasses"])();
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
    }, []);
    return {
        classData,
        loading,
        error
    };
}
}),
"[project]/apps/web/src/hooks/useDiceRoller.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useDiceRoller",
    ()=>useDiceRoller
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
// @ts-expect-error - DiceBox is not typed
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$3d$2d$dice$2f$dice$2d$box$2f$dist$2f$dice$2d$box$2e$es$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@3d-dice/dice-box/dist/dice-box.es.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$diceUtils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/utils/diceUtils.ts [app-ssr] (ecmascript)");
;
;
;
function useDiceRoller({ containerId, theme = 'diceOfRolling', themeColor = '#feea03', scale = 6, autoClearDelay: initialAutoClearDelay = 10000, onRollComplete, onError, onLog }) {
    const [diceBox, setDiceBox] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [isInitialized, setIsInitialized] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [isRolling, setIsRolling] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [rollHistory, setRollHistory] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])([]);
    const [autoClearDelay, setAutoClearDelay] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(initialAutoClearDelay);
    const [isMounted, setIsMounted] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    // Use ref to avoid recreating log function on every render
    const onLogRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(onLog);
    const onErrorRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(onError);
    // Update refs when props change
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        onLogRef.current = onLog;
        onErrorRef.current = onError;
    });
    // Stable log function
    const log = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((message)=>{
        console.log(`[DiceRoller] ${message}`);
        if (onLogRef.current) {
            onLogRef.current(message);
        }
    }, []);
    // Track mounting state
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        setIsMounted(true);
        return ()=>setIsMounted(false);
    }, []);
    // Initialize dice box
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (!isInitialized && isMounted) {
            const initializeDiceBox = ()=>{
                // Check if DOM element exists
                const containerElement = document.querySelector(`#${containerId}`);
                if (!containerElement) {
                    log(`Container element #${containerId} not found, waiting for DOM...`);
                    return false;
                }
                const rect = containerElement.getBoundingClientRect();
                log(`Container element #${containerId} found at ${Math.round(rect.left)},${Math.round(rect.top)} size ${Math.round(rect.width)}x${Math.round(rect.height)} - creating DiceBox...`);
                const selector = `#${containerId}`;
                const box = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$3d$2d$dice$2f$dice$2d$box$2f$dist$2f$dice$2d$box$2e$es$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"](selector, {
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
                box.init().then(()=>{
                    log('DiceBox initialized successfully');
                    setIsInitialized(true);
                }).catch((error)=>{
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    const message = `Failed to initialize DiceBox: ${errorMessage}`;
                    log(message);
                    if (onErrorRef.current) {
                        onErrorRef.current(message);
                    }
                });
                return true;
            };
            // Try to initialize immediately
            if (!initializeDiceBox()) {
                // If DOM not ready, wait a bit and try again (only once)
                const timer = setTimeout(()=>{
                    initializeDiceBox();
                }, 100);
                return ()=>clearTimeout(timer);
            }
        }
    }, [
        containerId,
        scale,
        theme,
        themeColor,
        isInitialized,
        isMounted,
        log
    ]);
    // Roll dice function
    const roll = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(async (notation)=>{
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
        log(`Rolling: ${notation}`);
        try {
            if (!diceBox.roll) {
                throw new Error('DiceBox roll method not available');
            }
            const results = await diceBox.roll(notation);
            log(`Roll completed: ${notation}`);
            // Calculate summary
            const summary = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$diceUtils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["calculateRollSummary"])(results, notation);
            setRollHistory((prev)=>[
                    ...prev,
                    summary
                ]);
            log(`Total: ${summary.finalTotal} (dice: ${summary.total}, modifier: ${summary.modifier})`);
            // Call completion callback
            if (onRollComplete) {
                onRollComplete(summary);
            }
            // Auto-clear if enabled
            if (autoClearDelay > 0) {
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$diceUtils$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["autoClearDice"])(diceBox, autoClearDelay, ()=>{
                    log(`Dice auto-cleared after ${autoClearDelay}ms`);
                });
            }
            setIsRolling(false);
            return summary;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const message = `Error rolling dice: ${errorMessage}`;
            log(message);
            if (onErrorRef.current) {
                onErrorRef.current(message);
            }
            setIsRolling(false);
            return null;
        }
    }, [
        diceBox,
        isInitialized,
        isRolling,
        autoClearDelay,
        onRollComplete,
        log
    ]);
    // Clear dice function
    const clearDice = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(()=>{
        if (diceBox && typeof diceBox.clear === 'function' && isInitialized) {
            log('Clearing dice from screen');
            try {
                diceBox.clear();
                log('Dice cleared successfully');
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                const message = `Error clearing dice: ${errorMessage}`;
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
    }, [
        diceBox,
        isInitialized,
        log
    ]);
    // Clear history function
    const clearHistory = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(()=>{
        setRollHistory([]);
        log('Roll history cleared');
    }, [
        log
    ]);
    // Cleanup on unmount
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        return ()=>{
            if (diceBox && typeof diceBox.clear === 'function') {
                try {
                    console.log('[DiceRoller] Cleaning up DiceBox on unmount');
                    diceBox.clear();
                } catch (error) {
                    console.warn('Error during component unmount cleanup:', error);
                }
            }
        };
    }, [
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
}),
"[project]/apps/web/src/hooks/useSimpleDiceRoll.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useSimpleDiceRoll",
    ()=>useSimpleDiceRoll
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$hooks$2f$useDiceRoller$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/hooks/useDiceRoller.ts [app-ssr] (ecmascript)");
;
;
function useSimpleDiceRoll({ containerId = 'main-dice-container', autoClearDelay = 1000, onRollComplete, onError } = {}) {
    const { isInitialized, isRolling, roll, clearDice } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$hooks$2f$useDiceRoller$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useDiceRoller"])({
        containerId,
        autoClearDelay,
        onRollComplete,
        onError
    });
    const rollDice = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])(async (notation)=>{
        return await roll(notation);
    }, [
        roll
    ]);
    return {
        isReady: isInitialized,
        isRolling,
        roll: rollDice,
        clearDice
    };
}
}),
"[project]/apps/web/src/hooks/useBackgroundsData.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Hook for loading and managing background data
 * Similar to useSpellsData
 */ __turbopack_context__.s([
    "useBackgroundsData",
    ()=>useBackgroundsData
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
'use client';
;
function useBackgroundsData() {
    const [backgrounds, setBackgrounds] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])([]);
    const [features, setFeatures] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])([]);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(true);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    // Load backgrounds on mount
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        let mounted = true;
        const loadData = async ()=>{
            try {
                setLoading(true);
                setError(null);
                const response = await fetch('/api/backgrounds');
                if (!response.ok) {
                    throw new Error(`Failed to fetch backgrounds: ${response.statusText}`);
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
        };
        loadData();
        return ()=>{
            mounted = false;
        };
    }, []);
    // Get background by name
    const getBackgroundByName = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((name)=>{
        const nameLower = name.toLowerCase();
        return backgrounds.find((bg)=>bg.name.toLowerCase() === nameLower);
    }, [
        backgrounds
    ]);
    // Search features by query
    const searchFeatures = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((query)=>{
        if (!query.trim()) return features;
        const queryLower = query.toLowerCase().trim();
        return features.filter((feature)=>feature.name.toLowerCase().includes(queryLower) || feature.backgroundName.toLowerCase().includes(queryLower) || feature.description.toLowerCase().includes(queryLower));
    }, [
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
}),
"[project]/apps/web/src/hooks/useFeatsData.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Hook for loading and managing feat data
 * Similar to useSpellsData
 */ __turbopack_context__.s([
    "useFeatsData",
    ()=>useFeatsData
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
'use client';
;
function useFeatsData() {
    const [feats, setFeats] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])([]);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(true);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    // Load feats on mount
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        let mounted = true;
        const loadData = async ()=>{
            try {
                setLoading(true);
                setError(null);
                const response = await fetch('/api/feats');
                if (!response.ok) {
                    throw new Error(`Failed to fetch feats: ${response.statusText}`);
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
        };
        loadData();
        return ()=>{
            mounted = false;
        };
    }, []);
    // Search feats by query
    const searchResults = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((query)=>{
        if (!query.trim()) return feats;
        const queryLower = query.toLowerCase().trim();
        return feats.filter((feat)=>feat.name.toLowerCase().includes(queryLower) || feat.description.toLowerCase().includes(queryLower) || feat.prerequisites.some((p)=>p.toLowerCase().includes(queryLower)) || feat.tags.some((t)=>t.toLowerCase().includes(queryLower)));
    }, [
        feats
    ]);
    // Get feat by name (case-insensitive)
    const getFeatByName = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((name)=>{
        const nameLower = name.toLowerCase();
        return feats.find((feat)=>feat.name.toLowerCase() === nameLower);
    }, [
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
}),
"[project]/apps/web/src/hooks/useFeatureSourcesData.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Hook for loading and managing all feature sources
 * Aggregates backgrounds, feats, and class features
 */ __turbopack_context__.s([
    "useFeatureSourcesData",
    ()=>useFeatureSourcesData
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$hooks$2f$useBackgroundsData$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/hooks/useBackgroundsData.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$hooks$2f$useFeatsData$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/hooks/useFeatsData.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$types$2f$features$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/types/features.ts [app-ssr] (ecmascript)");
'use client';
;
;
;
;
function useFeatureSourcesData(character) {
    const { features: backgroundFeatures, loading: backgroundsLoading, error: backgroundsError } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$hooks$2f$useBackgroundsData$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useBackgroundsData"])();
    const { feats, loading: featsLoading, error: featsError } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$hooks$2f$useFeatsData$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useFeatsData"])();
    const [classes, setClasses] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])([]);
    const [classesLoading, setClassesLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(true);
    const [classesError, setClassesError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    // Load class data on mount
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        let mounted = true;
        const loadData = async ()=>{
            try {
                setClassesLoading(true);
                setClassesError(null);
                const response = await fetch('/api/classes');
                if (!response.ok) {
                    throw new Error(`Failed to fetch classes: ${response.statusText}`);
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
        };
        loadData();
        return ()=>{
            mounted = false;
        };
    }, []);
    // Combine loading and error states
    const loading = backgroundsLoading || featsLoading || classesLoading;
    const error = backgroundsError || featsError || classesError;
    // Convert all sources to unified autocomplete items
    const allFeatures = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMemo"])(()=>{
        const items = [];
        // Add background features
        backgroundFeatures.forEach((feature)=>{
            items.push((0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$types$2f$features$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["backgroundFeatureToAutocompleteItem"])(feature));
        });
        // Add feats
        feats.forEach((feat)=>{
            items.push((0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$types$2f$features$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["featToAutocompleteItem"])(feat));
        });
        // Add class features from all classes
        // Note: We load ALL class/subclass features and let the user select via dropdown
        classes.forEach((classData)=>{
            // Add main class features
            classData.features.forEach((feature)=>{
                // If character data available, only show features up to their level
                if (!character || feature.level <= character.level) {
                    items.push((0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$types$2f$features$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["classFeatureToAutocompleteItem"])(feature));
                }
            });
            // Add all subclass features (user will select via dropdown)
            classData.subclasses?.forEach((subclass)=>{
                subclass.features.forEach((feature)=>{
                    // If character data available, only show features up to their level
                    if (!character || feature.level <= character.level) {
                        items.push((0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$types$2f$features$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["classFeatureToAutocompleteItem"])(feature));
                    }
                });
            });
        });
        return items;
    }, [
        backgroundFeatures,
        feats,
        classes,
        character
    ]);
    // Filter by source type
    const filterBySourceType = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((sourceType)=>{
        if (sourceType === 'all') return allFeatures;
        return allFeatures.filter((f)=>f.sourceType === sourceType);
    }, [
        allFeatures
    ]);
    // Filter by class name
    const filterByClass = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((className)=>{
        return allFeatures.filter((f)=>f.sourceType === 'class' && f.metadata.className?.toLowerCase() === className.toLowerCase() && !f.metadata.isSubclassFeature);
    }, [
        allFeatures
    ]);
    // Filter by subclass (className and subclass name/short name)
    const filterBySubclass = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((className, subclassName)=>{
        return allFeatures.filter((f)=>{
            if (f.sourceType !== 'subclass') return false;
            if (f.metadata.className?.toLowerCase() !== className.toLowerCase()) return false;
            // If no subclass name provided, return all subclasses for this class
            if (!subclassName) return true;
            // Filter by specific subclass
            return f.metadata.subclassShortName?.toLowerCase().includes(subclassName.toLowerCase()) || f.name.toLowerCase().includes(subclassName.toLowerCase());
        });
    }, [
        allFeatures
    ]);
    // Search features with optional source type filter
    const searchFeatures = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((query, sourceType)=>{
        const features = sourceType && sourceType !== 'all' ? filterBySourceType(sourceType) : allFeatures;
        if (!query.trim()) return features;
        const queryLower = query.toLowerCase().trim();
        return features.filter((f)=>f.name.toLowerCase().includes(queryLower) || f.description.toLowerCase().includes(queryLower) || f.tags.some((t)=>t.toLowerCase().includes(queryLower)) || f.metadata.backgroundName?.toLowerCase().includes(queryLower) || f.metadata.className?.toLowerCase().includes(queryLower));
    }, [
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
}),
"[project]/apps/web/src/hooks/useHydration.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useHydration",
    ()=>useHydration
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$store$2f$characterStore$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/store/characterStore.ts [app-ssr] (ecmascript)");
;
;
function useHydration() {
    const hasHydrated = (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$store$2f$characterStore$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCharacterStore"])((state)=>state.hasHydrated);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        // Set hasHydrated to true after initial render to prevent hydration mismatches
        // The onRehydrateStorage callback will have already run if there was stored data
        if (!hasHydrated) {
            console.log('[useHydration] Setting hasHydrated to true');
            const timer = setTimeout(()=>{
                __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$store$2f$characterStore$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCharacterStore"].setState({
                    hasHydrated: true
                });
            }, 0);
            return ()=>clearTimeout(timer);
        }
    }, [
        hasHydrated
    ]);
    return hasHydrated;
}
}),
"[project]/apps/web/src/hooks/useSpellsData.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Hook for loading and managing spell data from spellbook
 */ __turbopack_context__.s([
    "clearSpellCache",
    ()=>clearSpellCache,
    "useSpellsData",
    ()=>useSpellsData
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$spellConversion$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/utils/spellConversion.ts [app-ssr] (ecmascript)");
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
            throw new Error(`Failed to fetch spells: ${res.statusText}`);
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
    const [spells, setSpells] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])([]);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(true);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    // Load spells on mount
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        let mounted = true;
        const loadSpells = async ()=>{
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
        };
        loadSpells();
        return ()=>{
            mounted = false;
        };
    }, []);
    // Search spells by query
    const searchResults = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((query)=>{
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$spellConversion$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["searchSpells"])(spells, query);
    }, [
        spells
    ]);
    // Get spell by ID
    const getSpellById = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((id)=>{
        return spells.find((spell)=>spell.id === id);
    }, [
        spells
    ]);
    // Get spell by name (case-insensitive)
    const getSpellByName = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((name)=>{
        const nameLower = name.toLowerCase();
        return spells.find((spell)=>spell.name.toLowerCase() === nameLower);
    }, [
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
function clearSpellCache() {
    cachedSpells = null;
    cachePromise = null;
}
}),
"[project]/apps/web/src/types/character.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
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
    return Object.entries(grouped).map(([sourceType, features])=>({
            sourceType: sourceType,
            label: FEATURE_SOURCE_LABELS[sourceType],
            description: FEATURE_SOURCE_DESCRIPTIONS[sourceType],
            features: features.sort((a, b)=>a.displayOrder - b.displayOrder),
            isCollapsed: false
        }));
}
function createDefaultExtendedFeature(sourceType = 'other') {
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
}),
"[project]/apps/web/src/types/features.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
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
    // Create a unique ID that includes source and subclass (if applicable) to avoid collisions
    const sourceKey = feature.source.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const subclassKey = feature.subclassShortName ? `-${feature.subclassShortName.toLowerCase().replace(/[^a-z0-9]/g, '-')}` : '';
    // Use a counter or index to ensure uniqueness even within same class/level/source/subclass
    const id = `${feature.className}-${feature.name}-${feature.level}-${sourceKey}${subclassKey}-${feature.original || ''}`;
    return {
        id,
        name: feature.name,
        source: feature.source,
        sourceType: feature.isSubclassFeature ? 'subclass' : 'class',
        description: feature.entries?.join('\n\n') || '',
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
}),
"[project]/apps/web/src/contexts/NavigationContext.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "NavigationContext",
    ()=>NavigationContext,
    "useNavigation",
    ()=>useNavigation
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
'use client';
;
const NavigationContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["createContext"])(null);
const useNavigation = ()=>{
    const context = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useContext"])(NavigationContext);
    if (!context) {
        throw new Error('useNavigation must be used within NavigationContext');
    }
    return context;
};
}),
];

//# sourceMappingURL=apps_web_src_bdfcf7d8._.js.map