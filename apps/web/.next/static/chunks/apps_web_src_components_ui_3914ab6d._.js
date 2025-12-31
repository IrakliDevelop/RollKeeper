(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/apps/web/src/components/ui/primitives/variants.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Variant Utilities - CVA-based variant definitions
 * 
 * This file contains reusable variant patterns using class-variance-authority.
 * These patterns ensure consistent styling across similar components.
 */ __turbopack_context__.s([
    "badgeVariants",
    ()=>badgeVariants,
    "buttonVariants",
    ()=>buttonVariants,
    "cardVariants",
    ()=>cardVariants,
    "helperTextVariants",
    ()=>helperTextVariants,
    "inputVariants",
    ()=>inputVariants,
    "labelVariants",
    ()=>labelVariants
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$class$2d$variance$2d$authority$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/class-variance-authority/dist/index.mjs [app-client] (ecmascript)");
;
const buttonVariants = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$class$2d$variance$2d$authority$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cva"])(// Base styles
'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50', {
    variants: {
        variant: {
            primary: 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-md hover:from-emerald-700 hover:to-emerald-800 focus-visible:ring-emerald-500 active:scale-[0.98]',
            secondary: 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md hover:from-blue-700 hover:to-blue-800 focus-visible:ring-blue-500 active:scale-[0.98]',
            success: 'bg-gradient-to-r from-green-600 to-green-700 text-white shadow-md hover:from-green-700 hover:to-green-800 focus-visible:ring-green-500 active:scale-[0.98]',
            danger: 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-md hover:from-red-700 hover:to-red-800 focus-visible:ring-red-500 active:scale-[0.98]',
            warning: 'bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-md hover:from-amber-700 hover:to-amber-800 focus-visible:ring-amber-500 active:scale-[0.98]',
            outline: 'border-2 border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400 focus-visible:ring-gray-500',
            ghost: 'text-gray-700 hover:bg-gray-100 focus-visible:ring-gray-500',
            link: 'text-emerald-600 underline-offset-4 hover:underline focus-visible:ring-emerald-500'
        },
        size: {
            xs: 'h-7 px-3 text-xs',
            sm: 'h-9 px-4 text-sm',
            md: 'h-10 px-5 text-sm',
            lg: 'h-11 px-6 text-base',
            xl: 'h-13 px-8 text-base'
        },
        fullWidth: {
            true: 'w-full'
        }
    },
    defaultVariants: {
        variant: 'primary',
        size: 'md',
        fullWidth: false
    }
});
const inputVariants = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$class$2d$variance$2d$authority$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cva"])(// Base styles
'flex w-full rounded-lg border-2 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-500 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50', {
    variants: {
        variant: {
            default: 'border-gray-300 focus-visible:border-emerald-500 focus-visible:ring-emerald-500',
            error: 'border-red-300 focus-visible:border-red-500 focus-visible:ring-red-500',
            success: 'border-green-300 focus-visible:border-green-500 focus-visible:ring-green-500'
        },
        size: {
            sm: 'h-9 text-sm',
            md: 'h-10 text-sm',
            lg: 'h-11 text-base'
        }
    },
    defaultVariants: {
        variant: 'default',
        size: 'md'
    }
});
const cardVariants = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$class$2d$variance$2d$authority$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cva"])(// Base styles
'rounded-lg bg-white transition-all duration-200', {
    variants: {
        variant: {
            default: 'border border-gray-200',
            bordered: 'border-2 border-gray-300',
            elevated: 'border border-gray-200 shadow-md',
            interactive: 'border-2 border-gray-200 hover:border-gray-300 hover:shadow-md cursor-pointer',
            ghost: 'border-0'
        },
        padding: {
            none: 'p-0',
            sm: 'p-3',
            md: 'p-4',
            lg: 'p-6',
            xl: 'p-8'
        }
    },
    defaultVariants: {
        variant: 'default',
        padding: 'md'
    }
});
const badgeVariants = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$class$2d$variance$2d$authority$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cva"])(// Base styles
'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors', {
    variants: {
        variant: {
            primary: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
            secondary: 'bg-blue-100 text-blue-800 border border-blue-200',
            success: 'bg-green-100 text-green-800 border border-green-200',
            danger: 'bg-red-100 text-red-800 border border-red-200',
            warning: 'bg-amber-100 text-amber-800 border border-amber-200',
            info: 'bg-sky-100 text-sky-800 border border-sky-200',
            neutral: 'bg-gray-100 text-gray-800 border border-gray-200',
            outline: 'bg-transparent text-gray-700 border border-gray-300'
        },
        size: {
            sm: 'text-xs px-2 py-0.5',
            md: 'text-xs px-2.5 py-0.5',
            lg: 'text-sm px-3 py-1'
        }
    },
    defaultVariants: {
        variant: 'primary',
        size: 'md'
    }
});
const labelVariants = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$class$2d$variance$2d$authority$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cva"])('block text-sm font-medium text-gray-800 transition-colors', {
    variants: {
        variant: {
            default: '',
            required: "after:content-['*'] after:text-red-500 after:ml-1",
            optional: "after:content-['(optional)'] after:text-gray-500 after:ml-1 after:font-normal"
        },
        size: {
            sm: 'text-xs',
            md: 'text-sm',
            lg: 'text-base'
        }
    },
    defaultVariants: {
        variant: 'default',
        size: 'md'
    }
});
const helperTextVariants = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$class$2d$variance$2d$authority$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cva"])('text-sm transition-colors', {
    variants: {
        variant: {
            default: 'text-gray-600',
            error: 'text-red-600',
            success: 'text-green-600',
            warning: 'text-amber-600'
        }
    },
    defaultVariants: {
        variant: 'default'
    }
});
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/apps/web/src/components/ui/primitives/Tooltip.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Tooltip",
    ()=>Tooltip,
    "TooltipArrow",
    ()=>TooltipArrow,
    "TooltipContent",
    ()=>TooltipContent,
    "TooltipProvider",
    ()=>TooltipProvider,
    "TooltipRoot",
    ()=>TooltipRoot,
    "TooltipTrigger",
    ()=>TooltipTrigger
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$tooltip$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@radix-ui/react-tooltip/dist/index.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$cn$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/utils/cn.ts [app-client] (ecmascript)");
'use client';
;
;
;
;
const TooltipProvider = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$tooltip$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Provider"];
const TooltipRoot = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$tooltip$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Root"];
const TooltipTrigger = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$tooltip$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Trigger"];
const TooltipContent = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["forwardRef"]((param, ref)=>{
    let { className, sideOffset = 4, ...props } = param;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$tooltip$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Portal"], {
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$tooltip$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Content"], {
            ref: ref,
            sideOffset: sideOffset,
            className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$cn$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])('z-50 overflow-hidden rounded-lg bg-gray-900 px-3 py-2 text-sm text-white shadow-lg', 'animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95', 'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2', className),
            ...props
        }, void 0, false, {
            fileName: "[project]/apps/web/src/components/ui/primitives/Tooltip.tsx",
            lineNumber: 18,
            columnNumber: 5
        }, ("TURBOPACK compile-time value", void 0))
    }, void 0, false, {
        fileName: "[project]/apps/web/src/components/ui/primitives/Tooltip.tsx",
        lineNumber: 17,
        columnNumber: 3
    }, ("TURBOPACK compile-time value", void 0));
});
_c = TooltipContent;
TooltipContent.displayName = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$tooltip$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Content"].displayName;
const TooltipArrow = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["forwardRef"]((param, ref)=>{
    let { className, ...props } = param;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$tooltip$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Arrow"], {
        ref: ref,
        className: (0, __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$utils$2f$cn$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["cn"])('fill-gray-900', className),
        ...props
    }, void 0, false, {
        fileName: "[project]/apps/web/src/components/ui/primitives/Tooltip.tsx",
        lineNumber: 37,
        columnNumber: 3
    }, ("TURBOPACK compile-time value", void 0));
});
_c1 = TooltipArrow;
TooltipArrow.displayName = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$radix$2d$ui$2f$react$2d$tooltip$2f$dist$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Arrow"].displayName;
const Tooltip = /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["forwardRef"](_c2 = (param, ref)=>{
    let { children, content, side = 'top', showArrow = true, className, delayDuration = 200 } = param;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(TooltipRoot, {
        delayDuration: delayDuration,
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(TooltipTrigger, {
                asChild: true,
                children: children
            }, void 0, false, {
                fileName: "[project]/apps/web/src/components/ui/primitives/Tooltip.tsx",
                lineNumber: 90,
                columnNumber: 9
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(TooltipContent, {
                ref: ref,
                side: side,
                className: className,
                children: [
                    content,
                    showArrow && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(TooltipArrow, {}, void 0, false, {
                        fileName: "[project]/apps/web/src/components/ui/primitives/Tooltip.tsx",
                        lineNumber: 93,
                        columnNumber: 25
                    }, ("TURBOPACK compile-time value", void 0))
                ]
            }, void 0, true, {
                fileName: "[project]/apps/web/src/components/ui/primitives/Tooltip.tsx",
                lineNumber: 91,
                columnNumber: 9
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true, {
        fileName: "[project]/apps/web/src/components/ui/primitives/Tooltip.tsx",
        lineNumber: 89,
        columnNumber: 7
    }, ("TURBOPACK compile-time value", void 0));
});
_c3 = Tooltip;
Tooltip.displayName = 'Tooltip';
;
var _c, _c1, _c2, _c3;
__turbopack_context__.k.register(_c, "TooltipContent");
__turbopack_context__.k.register(_c1, "TooltipArrow");
__turbopack_context__.k.register(_c2, "Tooltip$React.forwardRef");
__turbopack_context__.k.register(_c3, "Tooltip");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/apps/web/src/components/ui/utils/ClientOnly.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>ClientOnly
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
function ClientOnly(param) {
    let { children, fallback = null } = param;
    _s();
    const [hasMounted, setHasMounted] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "ClientOnly.useEffect": ()=>{
            setHasMounted(true);
        }
    }["ClientOnly.useEffect"], []);
    if (!hasMounted) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
            children: fallback
        }, void 0, false);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
        children: children
    }, void 0, false);
}
_s(ClientOnly, "aiSd/DQPOnbbLLZZL0Xv/KtPBDg=");
_c = ClientOnly;
var _c;
__turbopack_context__.k.register(_c, "ClientOnly");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/apps/web/src/components/ui/utils/RichTextRenderer.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>RichTextRenderer
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$styled$2d$jsx$2f$style$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/styled-jsx/style.js [app-client] (ecmascript)");
'use client';
;
;
function RichTextRenderer(param) {
    let { content, className = '' } = param;
    if (!content || content.trim() === '') {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "text-gray-500 italic ".concat(className),
            children: "No content available..."
        }, void 0, false, {
            fileName: "[project]/apps/web/src/components/ui/utils/RichTextRenderer.tsx",
            lineNumber: 20,
            columnNumber: 7
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "jsx-ce7c49708c3da4f5" + " " + "rich-text-renderer ".concat(className),
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                dangerouslySetInnerHTML: {
                    __html: content
                },
                className: "jsx-ce7c49708c3da4f5" + " " + "rich-text-content"
            }, void 0, false, {
                fileName: "[project]/apps/web/src/components/ui/utils/RichTextRenderer.tsx",
                lineNumber: 28,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$styled$2d$jsx$2f$style$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                id: "ce7c49708c3da4f5",
                children: ".rich-text-renderer .rich-text-content{color:#1f2937;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;line-height:1.7}.rich-text-renderer .rich-text-content h1{color:#111827!important;margin:2rem 0 1rem!important;font-size:2.25rem!important;font-weight:800!important;line-height:1.2!important;display:block!important}.rich-text-renderer .rich-text-content h2{color:#111827!important;margin:1.5rem 0 .75rem!important;font-size:1.875rem!important;font-weight:700!important;line-height:1.3!important;display:block!important}.rich-text-renderer .rich-text-content h3{color:#111827!important;margin:1.25rem 0 .5rem!important;font-size:1.5rem!important;font-weight:600!important;line-height:1.4!important;display:block!important}.rich-text-renderer .rich-text-content p{margin:.75rem 0!important;line-height:1.7!important;display:block!important}.rich-text-renderer .rich-text-content ul{margin:1rem 0!important;padding-left:1.5rem!important;list-style-type:disc!important;display:block!important}.rich-text-renderer .rich-text-content ol{margin:1rem 0!important;padding-left:1.5rem!important;list-style-type:decimal!important;display:block!important}.rich-text-renderer .rich-text-content li{margin:.25rem 0!important;line-height:1.6!important;list-style-position:outside!important;display:list-item!important}.rich-text-renderer .rich-text-content li p{margin:.25rem 0!important;display:inline!important}.rich-text-renderer .rich-text-content strong{font-weight:700!important}.rich-text-renderer .rich-text-content em{font-style:italic!important}.rich-text-renderer .rich-text-content s{text-decoration:line-through!important}.rich-text-renderer .rich-text-content code{color:#dc2626!important;background-color:#f3f4f6!important;border:1px solid #e5e7eb!important;border-radius:.25rem!important;padding:.25rem .375rem!important;font-family:SF Mono,Monaco,Inconsolata,Roboto Mono,Courier New,monospace!important;font-size:.875em!important}.rich-text-renderer .rich-text-content pre{color:#fff!important;background:#1e1e1e!important;border-radius:.5rem!important;margin:1rem 0!important;padding:1rem!important;font-family:SF Mono,Monaco,Inconsolata,Roboto Mono,Courier New,monospace!important;display:block!important;overflow-x:auto!important}.rich-text-renderer .rich-text-content pre code{color:inherit!important;font-size:inherit!important;background:0 0!important;border:none!important;padding:0!important}.rich-text-renderer .rich-text-content blockquote{color:#6b7280!important;background-color:#f8fafc!important;border-left:4px solid #3b82f6!important;border-radius:.5rem!important;margin:1rem 0!important;padding:1rem!important;font-style:italic!important;display:block!important}.rich-text-renderer .rich-text-content hr{border:none!important;border-top:2px solid #e5e7eb!important;width:100%!important;margin:2rem 0!important;display:block!important}.rich-text-renderer .rich-text-content>:first-child{margin-top:0!important}.rich-text-renderer .rich-text-content>:last-child{margin-bottom:0!important}"
            }, void 0, false, void 0, this)
        ]
    }, void 0, true, {
        fileName: "[project]/apps/web/src/components/ui/utils/RichTextRenderer.tsx",
        lineNumber: 27,
        columnNumber: 5
    }, this);
}
_c = RichTextRenderer;
var _c;
__turbopack_context__.k.register(_c, "RichTextRenderer");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/apps/web/src/components/ui/utils/index.ts [app-client] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

// Utility Components
__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$utils$2f$ClientOnly$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/utils/ClientOnly.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$utils$2f$RichTextRenderer$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/utils/RichTextRenderer.tsx [app-client] (ecmascript)");
;
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/apps/web/src/components/ui/utils/RichTextRenderer.tsx [app-client] (ecmascript) <export default as RichTextRenderer>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "RichTextRenderer",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$utils$2f$RichTextRenderer$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"]
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$utils$2f$RichTextRenderer$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/utils/RichTextRenderer.tsx [app-client] (ecmascript)");
}),
"[project]/apps/web/src/components/ui/index.ts [app-client] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

// Re-export all UI components by category
__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$character$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/character/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$feedback$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/feedback/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$forms$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/forms/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$game$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/game/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$layout$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/layout/index.ts [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$utils$2f$index$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/utils/index.ts [app-client] (ecmascript) <locals>");
;
;
;
;
;
;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=apps_web_src_components_ui_3914ab6d._.js.map