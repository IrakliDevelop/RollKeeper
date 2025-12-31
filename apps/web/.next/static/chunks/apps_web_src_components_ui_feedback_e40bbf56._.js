(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/apps/web/src/components/ui/feedback/Modal.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ConfirmationModal",
    ()=>ConfirmationModal,
    "LoadingModal",
    ()=>LoadingModal,
    "Modal",
    ()=>Modal
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2d$dom$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react-dom/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/x.js [app-client] (ecmascript) <export default as X>");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
    full: 'max-w-[95vw]'
};
function Modal(param) {
    let { isOpen, onClose, title, children, size = 'lg', showCloseButton = true, closeOnBackdropClick = true, className = '' } = param;
    _s();
    const modalRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(null);
    const [mounted, setMounted] = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].useState(false);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Modal.useEffect": ()=>{
            setMounted(true);
            return ({
                "Modal.useEffect": ()=>setMounted(false)
            })["Modal.useEffect"];
        }
    }["Modal.useEffect"], []);
    // Handle escape key press
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Modal.useEffect": ()=>{
            const handleEscape = {
                "Modal.useEffect.handleEscape": (event)=>{
                    if (event.key === 'Escape' && isOpen) {
                        onClose();
                    }
                }
            }["Modal.useEffect.handleEscape"];
            if (isOpen) {
                document.addEventListener('keydown', handleEscape);
                // Prevent body scroll when modal is open
                document.body.style.overflow = 'hidden';
            }
            return ({
                "Modal.useEffect": ()=>{
                    document.removeEventListener('keydown', handleEscape);
                    document.body.style.overflow = 'unset';
                }
            })["Modal.useEffect"];
        }
    }["Modal.useEffect"], [
        isOpen,
        onClose
    ]);
    // Handle backdrop click
    const handleBackdropClick = (event)=>{
        if (closeOnBackdropClick && event.target === event.currentTarget) {
            onClose();
        }
    };
    // Don't render if not open or not mounted
    if (!isOpen || !mounted) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2d$dom$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createPortal"])(/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "fixed inset-0 z-50 overflow-y-auto",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300",
                onClick: handleBackdropClick,
                "aria-hidden": "true"
            }, void 0, false, {
                fileName: "[project]/apps/web/src/components/ui/feedback/Modal.tsx",
                lineNumber: 77,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex min-h-full items-center justify-center p-4",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    ref: modalRef,
                    className: "relative w-full ".concat(sizeClasses[size], " max-h-[90vh] flex flex-col transform rounded-xl bg-white shadow-2xl transition-all duration-300 ").concat(className, " "),
                    onClick: (e)=>e.stopPropagation(),
                    children: [
                        (title || showCloseButton) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex items-center justify-between border-b border-gray-200 p-6 flex-shrink-0",
                            children: [
                                title && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                                    className: "text-xl font-semibold text-gray-900",
                                    children: title
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/src/components/ui/feedback/Modal.tsx",
                                    lineNumber: 94,
                                    columnNumber: 17
                                }, this),
                                showCloseButton && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                    onClick: onClose,
                                    className: "rounded-lg p-2 transition-colors hover:bg-gray-100",
                                    "aria-label": "Close modal",
                                    children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__["X"], {
                                        size: 20,
                                        className: "text-gray-500"
                                    }, void 0, false, {
                                        fileName: "[project]/apps/web/src/components/ui/feedback/Modal.tsx",
                                        lineNumber: 102,
                                        columnNumber: 19
                                    }, this)
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/src/components/ui/feedback/Modal.tsx",
                                    lineNumber: 97,
                                    columnNumber: 17
                                }, this)
                            ]
                        }, void 0, true, {
                            fileName: "[project]/apps/web/src/components/ui/feedback/Modal.tsx",
                            lineNumber: 92,
                            columnNumber: 13
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex-1 overflow-y-auto min-h-0 p-6",
                            children: children
                        }, void 0, false, {
                            fileName: "[project]/apps/web/src/components/ui/feedback/Modal.tsx",
                            lineNumber: 109,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/apps/web/src/components/ui/feedback/Modal.tsx",
                    lineNumber: 85,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/apps/web/src/components/ui/feedback/Modal.tsx",
                lineNumber: 84,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/apps/web/src/components/ui/feedback/Modal.tsx",
        lineNumber: 75,
        columnNumber: 5
    }, this), document.body);
}
_s(Modal, "mN9JLzRrKMz47b0h/8oBbEkhGG8=");
_c = Modal;
function ConfirmationModal(param) {
    let { isOpen, onClose, onConfirm, title = 'Confirm Action', message, confirmText = 'Confirm', cancelText = 'Cancel', variant = 'default' } = param;
    const buttonClasses = variant === 'danger' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white';
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Modal, {
        isOpen: isOpen,
        onClose: onClose,
        title: title,
        size: "sm",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "p-6",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "mb-6 text-gray-700",
                    children: message
                }, void 0, false, {
                    fileName: "[project]/apps/web/src/components/ui/feedback/Modal.tsx",
                    lineNumber: 145,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex justify-end gap-3",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            onClick: onClose,
                            className: "rounded-lg bg-gray-100 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-200",
                            children: cancelText
                        }, void 0, false, {
                            fileName: "[project]/apps/web/src/components/ui/feedback/Modal.tsx",
                            lineNumber: 147,
                            columnNumber: 11
                        }, this),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            onClick: ()=>{
                                onConfirm();
                                onClose();
                            },
                            className: "rounded-lg px-4 py-2 transition-colors ".concat(buttonClasses),
                            children: confirmText
                        }, void 0, false, {
                            fileName: "[project]/apps/web/src/components/ui/feedback/Modal.tsx",
                            lineNumber: 153,
                            columnNumber: 11
                        }, this)
                    ]
                }, void 0, true, {
                    fileName: "[project]/apps/web/src/components/ui/feedback/Modal.tsx",
                    lineNumber: 146,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/apps/web/src/components/ui/feedback/Modal.tsx",
            lineNumber: 144,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/apps/web/src/components/ui/feedback/Modal.tsx",
        lineNumber: 143,
        columnNumber: 5
    }, this);
}
_c1 = ConfirmationModal;
function LoadingModal(param) {
    let { isOpen, title = 'Loading...', message = 'Please wait while we process your request.' } = param;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Modal, {
        isOpen: isOpen,
        onClose: ()=>{},
        title: title,
        size: "sm",
        showCloseButton: false,
        closeOnBackdropClick: false,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "p-6 text-center",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"
                }, void 0, false, {
                    fileName: "[project]/apps/web/src/components/ui/feedback/Modal.tsx",
                    lineNumber: 188,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                    className: "text-gray-700",
                    children: message
                }, void 0, false, {
                    fileName: "[project]/apps/web/src/components/ui/feedback/Modal.tsx",
                    lineNumber: 189,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/apps/web/src/components/ui/feedback/Modal.tsx",
            lineNumber: 187,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/apps/web/src/components/ui/feedback/Modal.tsx",
        lineNumber: 179,
        columnNumber: 5
    }, this);
}
_c2 = LoadingModal;
var _c, _c1, _c2;
__turbopack_context__.k.register(_c, "Modal");
__turbopack_context__.k.register(_c1, "ConfirmationModal");
__turbopack_context__.k.register(_c2, "LoadingModal");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/apps/web/src/components/ui/feedback/ModalPortal.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ModalPortal",
    ()=>ModalPortal
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2d$dom$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react-dom/index.js [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
'use client';
;
;
const ModalPortal = (param)=>{
    let { children, isOpen } = param;
    _s();
    const [mounted, setMounted] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "ModalPortal.useEffect": ()=>{
            setMounted(true);
            return ({
                "ModalPortal.useEffect": ()=>setMounted(false)
            })["ModalPortal.useEffect"];
        }
    }["ModalPortal.useEffect"], []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "ModalPortal.useEffect": ()=>{
            if (isOpen) {
                // Prevent body scroll when modal is open
                document.body.style.overflow = 'hidden';
            } else {
                // Restore body scroll when modal is closed
                document.body.style.overflow = 'unset';
            }
            // Cleanup on unmount
            return ({
                "ModalPortal.useEffect": ()=>{
                    document.body.style.overflow = 'unset';
                }
            })["ModalPortal.useEffect"];
        }
    }["ModalPortal.useEffect"], [
        isOpen
    ]);
    if (!mounted || !isOpen) {
        return null;
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2d$dom$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createPortal"])(children, document.body);
};
_s(ModalPortal, "BShlRgxf1Xjno/mi6QXyq9ZqIDE=");
_c = ModalPortal;
var _c;
__turbopack_context__.k.register(_c, "ModalPortal");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/apps/web/src/components/ui/feedback/ConfirmationModal.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ConfirmationModal",
    ()=>ConfirmationModal
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$triangle$2d$alert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertTriangle$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/triangle-alert.js [app-client] (ecmascript) <export default as AlertTriangle>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/x.js [app-client] (ecmascript) <export default as X>");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$feedback$2f$ModalPortal$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/feedback/ModalPortal.tsx [app-client] (ecmascript)");
'use client';
;
;
;
const ConfirmationModal = (param)=>{
    let { isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', cancelText = 'Cancel', type = 'danger' } = param;
    const handleConfirm = ()=>{
        onConfirm();
        onClose();
    };
    const getTypeStyles = ()=>{
        switch(type){
            case 'danger':
                return {
                    icon: 'text-red-600',
                    iconBg: 'bg-red-100',
                    confirmBtn: 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800',
                    border: 'border-red-200'
                };
            case 'warning':
                return {
                    icon: 'text-amber-600',
                    iconBg: 'bg-amber-100',
                    confirmBtn: 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800',
                    border: 'border-amber-200'
                };
            case 'info':
                return {
                    icon: 'text-blue-600',
                    iconBg: 'bg-blue-100',
                    confirmBtn: 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800',
                    border: 'border-blue-200'
                };
        }
    };
    const styles = getTypeStyles();
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$feedback$2f$ModalPortal$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ModalPortal"], {
        isOpen: isOpen,
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm",
            onClick: (e)=>e.target === e.currentTarget && onClose(),
            style: {
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                margin: 0
            },
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "w-full max-w-md rounded-xl border-2 bg-white shadow-2xl ".concat(styles.border, " animate-in zoom-in-95 transform duration-200"),
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center justify-between border-b border-gray-200 p-6",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center gap-3",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "rounded-lg p-2 ".concat(styles.iconBg),
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$triangle$2d$alert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertTriangle$3e$__["AlertTriangle"], {
                                            size: 20,
                                            className: styles.icon
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/src/components/ui/feedback/ConfirmationModal.tsx",
                                            lineNumber: 85,
                                            columnNumber: 17
                                        }, ("TURBOPACK compile-time value", void 0))
                                    }, void 0, false, {
                                        fileName: "[project]/apps/web/src/components/ui/feedback/ConfirmationModal.tsx",
                                        lineNumber: 84,
                                        columnNumber: 15
                                    }, ("TURBOPACK compile-time value", void 0)),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                        className: "text-lg font-bold text-gray-800",
                                        children: title
                                    }, void 0, false, {
                                        fileName: "[project]/apps/web/src/components/ui/feedback/ConfirmationModal.tsx",
                                        lineNumber: 87,
                                        columnNumber: 15
                                    }, ("TURBOPACK compile-time value", void 0))
                                ]
                            }, void 0, true, {
                                fileName: "[project]/apps/web/src/components/ui/feedback/ConfirmationModal.tsx",
                                lineNumber: 83,
                                columnNumber: 13
                            }, ("TURBOPACK compile-time value", void 0)),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: onClose,
                                className: "p-1 text-gray-400 transition-colors hover:text-gray-600",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__["X"], {
                                    size: 20
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/src/components/ui/feedback/ConfirmationModal.tsx",
                                    lineNumber: 93,
                                    columnNumber: 15
                                }, ("TURBOPACK compile-time value", void 0))
                            }, void 0, false, {
                                fileName: "[project]/apps/web/src/components/ui/feedback/ConfirmationModal.tsx",
                                lineNumber: 89,
                                columnNumber: 13
                            }, ("TURBOPACK compile-time value", void 0))
                        ]
                    }, void 0, true, {
                        fileName: "[project]/apps/web/src/components/ui/feedback/ConfirmationModal.tsx",
                        lineNumber: 82,
                        columnNumber: 11
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "p-6",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                            className: "leading-relaxed text-gray-700",
                            children: message
                        }, void 0, false, {
                            fileName: "[project]/apps/web/src/components/ui/feedback/ConfirmationModal.tsx",
                            lineNumber: 99,
                            columnNumber: 13
                        }, ("TURBOPACK compile-time value", void 0))
                    }, void 0, false, {
                        fileName: "[project]/apps/web/src/components/ui/feedback/ConfirmationModal.tsx",
                        lineNumber: 98,
                        columnNumber: 11
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex gap-3 p-6 pt-0",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: onClose,
                                className: "flex-1 rounded-lg border border-gray-300 bg-gradient-to-r from-gray-100 to-gray-200 px-4 py-2 text-sm font-medium text-gray-800 shadow-sm transition-all duration-200 hover:from-gray-200 hover:to-gray-300 hover:shadow-md",
                                children: cancelText
                            }, void 0, false, {
                                fileName: "[project]/apps/web/src/components/ui/feedback/ConfirmationModal.tsx",
                                lineNumber: 104,
                                columnNumber: 13
                            }, ("TURBOPACK compile-time value", void 0)),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: handleConfirm,
                                className: "flex-1 px-4 py-2 text-sm font-medium ".concat(styles.confirmBtn, " rounded-lg text-white shadow-md transition-all duration-200 hover:shadow-lg"),
                                children: confirmText
                            }, void 0, false, {
                                fileName: "[project]/apps/web/src/components/ui/feedback/ConfirmationModal.tsx",
                                lineNumber: 110,
                                columnNumber: 13
                            }, ("TURBOPACK compile-time value", void 0))
                        ]
                    }, void 0, true, {
                        fileName: "[project]/apps/web/src/components/ui/feedback/ConfirmationModal.tsx",
                        lineNumber: 103,
                        columnNumber: 11
                    }, ("TURBOPACK compile-time value", void 0))
                ]
            }, void 0, true, {
                fileName: "[project]/apps/web/src/components/ui/feedback/ConfirmationModal.tsx",
                lineNumber: 78,
                columnNumber: 9
            }, ("TURBOPACK compile-time value", void 0))
        }, void 0, false, {
            fileName: "[project]/apps/web/src/components/ui/feedback/ConfirmationModal.tsx",
            lineNumber: 66,
            columnNumber: 7
        }, ("TURBOPACK compile-time value", void 0))
    }, void 0, false, {
        fileName: "[project]/apps/web/src/components/ui/feedback/ConfirmationModal.tsx",
        lineNumber: 65,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
};
_c = ConfirmationModal;
var _c;
__turbopack_context__.k.register(_c, "ConfirmationModal");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/apps/web/src/components/ui/feedback/NotHydrated.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

// this component is used to display a loading screen when the page is not hydrated
// the text should be in the middle of the screen
// the text should be "Loading..." and a 3 dot animation
__turbopack_context__.s([
    "default",
    ()=>NotHydrated
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
;
function NotHydrated() {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex h-screen flex-col items-center justify-center",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "text-2xl font-bold text-slate-800",
                children: "Loading..."
            }, void 0, false, {
                fileName: "[project]/apps/web/src/components/ui/feedback/NotHydrated.tsx",
                lineNumber: 8,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "text-sm text-slate-600",
                children: "This may take a few seconds..."
            }, void 0, false, {
                fileName: "[project]/apps/web/src/components/ui/feedback/NotHydrated.tsx",
                lineNumber: 9,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "text-sm text-slate-600",
                children: "Please wait..."
            }, void 0, false, {
                fileName: "[project]/apps/web/src/components/ui/feedback/NotHydrated.tsx",
                lineNumber: 12,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "text-sm text-slate-600",
                children: "If this takes too long, please refresh the page."
            }, void 0, false, {
                fileName: "[project]/apps/web/src/components/ui/feedback/NotHydrated.tsx",
                lineNumber: 13,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "text-sm text-slate-600",
                children: "If you are seeing this, please contact the developer. You know him, right?"
            }, void 0, false, {
                fileName: "[project]/apps/web/src/components/ui/feedback/NotHydrated.tsx",
                lineNumber: 16,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "text-sm text-slate-600",
                children: "Thank you for your patience."
            }, void 0, false, {
                fileName: "[project]/apps/web/src/components/ui/feedback/NotHydrated.tsx",
                lineNumber: 20,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/apps/web/src/components/ui/feedback/NotHydrated.tsx",
        lineNumber: 7,
        columnNumber: 5
    }, this);
}
_c = NotHydrated;
var _c;
__turbopack_context__.k.register(_c, "NotHydrated");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/apps/web/src/components/ui/feedback/SaveIndicator.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SaveIndicator",
    ()=>SaveIndicator
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$save$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Save$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/save.js [app-client] (ecmascript) <export default as Save>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Check$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/check.js [app-client] (ecmascript) <export default as Check>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$alert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertCircle$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/circle-alert.js [app-client] (ecmascript) <export default as AlertCircle>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Loader2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/loader-circle.js [app-client] (ecmascript) <export default as Loader2>");
;
;
const SaveIndicator = (param)=>{
    let { status, lastSaved, hasUnsavedChanges = false, className = '' } = param;
    const getStatusConfig = ()=>{
        switch(status){
            case 'saving':
                return {
                    icon: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$loader$2d$circle$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Loader2$3e$__["Loader2"], {
                        size: 12,
                        className: "animate-spin"
                    }, void 0, false, {
                        fileName: "[project]/apps/web/src/components/ui/feedback/SaveIndicator.tsx",
                        lineNumber: 21,
                        columnNumber: 17
                    }, ("TURBOPACK compile-time value", void 0)),
                    text: 'Saving...',
                    dotColor: 'bg-yellow-500',
                    textColor: 'text-yellow-700'
                };
            case 'saved':
                return {
                    icon: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Check$3e$__["Check"], {
                        size: 12
                    }, void 0, false, {
                        fileName: "[project]/apps/web/src/components/ui/feedback/SaveIndicator.tsx",
                        lineNumber: 28,
                        columnNumber: 17
                    }, ("TURBOPACK compile-time value", void 0)),
                    text: hasUnsavedChanges ? 'Changes pending' : 'All changes saved',
                    dotColor: hasUnsavedChanges ? 'bg-yellow-500' : 'bg-green-500',
                    textColor: hasUnsavedChanges ? 'text-yellow-700' : 'text-green-700'
                };
            case 'error':
                return {
                    icon: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$alert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__AlertCircle$3e$__["AlertCircle"], {
                        size: 12
                    }, void 0, false, {
                        fileName: "[project]/apps/web/src/components/ui/feedback/SaveIndicator.tsx",
                        lineNumber: 35,
                        columnNumber: 17
                    }, ("TURBOPACK compile-time value", void 0)),
                    text: 'Save failed',
                    dotColor: 'bg-red-500',
                    textColor: 'text-red-700'
                };
            default:
                return {
                    icon: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$save$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Save$3e$__["Save"], {
                        size: 12
                    }, void 0, false, {
                        fileName: "[project]/apps/web/src/components/ui/feedback/SaveIndicator.tsx",
                        lineNumber: 42,
                        columnNumber: 17
                    }, ("TURBOPACK compile-time value", void 0)),
                    text: 'Not saved',
                    dotColor: 'bg-gray-400',
                    textColor: 'text-gray-600'
                };
        }
    };
    const config = getStatusConfig();
    const formatLastSaved = (date)=>{
        const now = new Date();
        const dateObj = typeof date === 'string' ? new Date(date) : date;
        const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);
        if (diffInSeconds < 30) {
            return 'just now';
        } else if (diffInSeconds < 60) {
            return "".concat(diffInSeconds, "s ago");
        } else if (diffInSeconds < 3600) {
            const minutes = Math.floor(diffInSeconds / 60);
            return "".concat(minutes, "m ago");
        } else {
            return dateObj.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex items-center gap-2 text-sm ".concat(className),
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "h-2 w-2 rounded-full ".concat(config.dotColor)
            }, void 0, false, {
                fileName: "[project]/apps/web/src/components/ui/feedback/SaveIndicator.tsx",
                lineNumber: 76,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-center gap-1",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: config.textColor,
                        children: config.icon
                    }, void 0, false, {
                        fileName: "[project]/apps/web/src/components/ui/feedback/SaveIndicator.tsx",
                        lineNumber: 78,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: config.textColor,
                        children: config.text
                    }, void 0, false, {
                        fileName: "[project]/apps/web/src/components/ui/feedback/SaveIndicator.tsx",
                        lineNumber: 79,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0))
                ]
            }, void 0, true, {
                fileName: "[project]/apps/web/src/components/ui/feedback/SaveIndicator.tsx",
                lineNumber: 77,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            lastSaved && status === 'saved' && !hasUnsavedChanges && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "text-xs text-gray-500",
                children: [
                    "• ",
                    formatLastSaved(lastSaved)
                ]
            }, void 0, true, {
                fileName: "[project]/apps/web/src/components/ui/feedback/SaveIndicator.tsx",
                lineNumber: 82,
                columnNumber: 9
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true, {
        fileName: "[project]/apps/web/src/components/ui/feedback/SaveIndicator.tsx",
        lineNumber: 75,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
};
_c = SaveIndicator;
var _c;
__turbopack_context__.k.register(_c, "SaveIndicator");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/apps/web/src/components/ui/feedback/Toast.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ToastContainer",
    ()=>ToastContainer,
    "useToast",
    ()=>useToast
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/x.js [app-client] (ecmascript) <export default as X>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$dice$2d$6$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Dice6$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/dice-6.js [app-client] (ecmascript) <export default as Dice6>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$shield$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Shield$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/shield.js [app-client] (ecmascript) <export default as Shield>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$zap$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Zap$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/zap.js [app-client] (ecmascript) <export default as Zap>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__CheckCircle2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/circle-check.js [app-client] (ecmascript) <export default as CheckCircle2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__XCircle$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/circle-x.js [app-client] (ecmascript) <export default as XCircle>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$info$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Info$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/info.js [app-client] (ecmascript) <export default as Info>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$moon$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Moon$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/moon.js [app-client] (ecmascript) <export default as Moon>");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
'use client';
;
;
const Toast = (param)=>{
    let { toast, onDismiss } = param;
    _s();
    const [isVisible, setIsVisible] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [isExiting, setIsExiting] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const handleDismiss = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "Toast.useCallback[handleDismiss]": ()=>{
            setIsExiting(true);
            setTimeout({
                "Toast.useCallback[handleDismiss]": ()=>{
                    onDismiss(toast.id);
                }
            }["Toast.useCallback[handleDismiss]"], 300);
        }
    }["Toast.useCallback[handleDismiss]"], [
        toast.id,
        onDismiss
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "Toast.useEffect": ()=>{
            // Animate in
            setTimeout({
                "Toast.useEffect": ()=>setIsVisible(true)
            }["Toast.useEffect"], 50);
            // Auto dismiss
            const timer = setTimeout({
                "Toast.useEffect.timer": ()=>{
                    handleDismiss();
                }
            }["Toast.useEffect.timer"], toast.duration || 5000);
            return ({
                "Toast.useEffect": ()=>clearTimeout(timer)
            })["Toast.useEffect"];
        }
    }["Toast.useEffect"], [
        toast.duration,
        handleDismiss
    ]);
    const getToastStyles = ()=>{
        switch(toast.type){
            case 'attack':
                return 'bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 text-white border-slate-600 shadow-slate-900/50';
            case 'save':
                return 'bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 text-white border-blue-500 shadow-blue-900/50';
            case 'damage':
                return 'bg-gradient-to-br from-amber-600 via-orange-600 to-orange-700 text-white border-amber-500 shadow-orange-900/50';
            case 'success':
                return 'bg-gradient-to-br from-emerald-500 via-emerald-600 to-green-700 text-white border-emerald-400 shadow-emerald-900/50';
            case 'error':
                return 'bg-gradient-to-br from-red-600 via-red-700 to-red-800 text-white border-red-500 shadow-red-900/50';
            case 'rest':
                return 'bg-gradient-to-br from-indigo-600 via-purple-600 to-violet-700 text-white border-indigo-500 shadow-purple-900/50';
            default:
                return 'bg-gradient-to-br from-gray-600 via-gray-700 to-gray-800 text-white border-gray-500 shadow-gray-900/50';
        }
    };
    const getIcon = ()=>{
        switch(toast.type){
            case 'attack':
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$dice$2d$6$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Dice6$3e$__["Dice6"], {
                    size: 22,
                    className: "text-white drop-shadow-lg"
                }, void 0, false, {
                    fileName: "[project]/apps/web/src/components/ui/feedback/Toast.tsx",
                    lineNumber: 65,
                    columnNumber: 16
                }, ("TURBOPACK compile-time value", void 0));
            case 'save':
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$shield$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Shield$3e$__["Shield"], {
                    size: 22,
                    className: "text-white drop-shadow-lg"
                }, void 0, false, {
                    fileName: "[project]/apps/web/src/components/ui/feedback/Toast.tsx",
                    lineNumber: 67,
                    columnNumber: 16
                }, ("TURBOPACK compile-time value", void 0));
            case 'damage':
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$zap$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Zap$3e$__["Zap"], {
                    size: 22,
                    className: "text-white drop-shadow-lg"
                }, void 0, false, {
                    fileName: "[project]/apps/web/src/components/ui/feedback/Toast.tsx",
                    lineNumber: 69,
                    columnNumber: 16
                }, ("TURBOPACK compile-time value", void 0));
            case 'success':
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__CheckCircle2$3e$__["CheckCircle2"], {
                    size: 22,
                    className: "text-white drop-shadow-lg"
                }, void 0, false, {
                    fileName: "[project]/apps/web/src/components/ui/feedback/Toast.tsx",
                    lineNumber: 71,
                    columnNumber: 16
                }, ("TURBOPACK compile-time value", void 0));
            case 'error':
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__XCircle$3e$__["XCircle"], {
                    size: 22,
                    className: "text-white drop-shadow-lg"
                }, void 0, false, {
                    fileName: "[project]/apps/web/src/components/ui/feedback/Toast.tsx",
                    lineNumber: 73,
                    columnNumber: 16
                }, ("TURBOPACK compile-time value", void 0));
            case 'rest':
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$moon$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Moon$3e$__["Moon"], {
                    size: 22,
                    className: "text-white drop-shadow-lg"
                }, void 0, false, {
                    fileName: "[project]/apps/web/src/components/ui/feedback/Toast.tsx",
                    lineNumber: 75,
                    columnNumber: 16
                }, ("TURBOPACK compile-time value", void 0));
            case 'info':
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$info$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Info$3e$__["Info"], {
                    size: 22,
                    className: "text-white drop-shadow-lg"
                }, void 0, false, {
                    fileName: "[project]/apps/web/src/components/ui/feedback/Toast.tsx",
                    lineNumber: 77,
                    columnNumber: 16
                }, ("TURBOPACK compile-time value", void 0));
            default:
                return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$dice$2d$6$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Dice6$3e$__["Dice6"], {
                    size: 22,
                    className: "text-white drop-shadow-lg"
                }, void 0, false, {
                    fileName: "[project]/apps/web/src/components/ui/feedback/Toast.tsx",
                    lineNumber: 79,
                    columnNumber: 16
                }, ("TURBOPACK compile-time value", void 0));
        }
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "relative overflow-hidden rounded-xl border-2 shadow-2xl backdrop-blur-sm transition-all duration-300 ease-out ".concat(getToastStyles(), " ").concat(isVisible && !isExiting ? 'translate-x-0 transform opacity-100 scale-100' : 'translate-x-full transform opacity-0 scale-95', " ").concat(isExiting ? 'translate-x-full transform opacity-0 scale-95' : '', " max-w-[420px] min-w-[320px]"),
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "absolute inset-0 opacity-20",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.3),transparent)]"
                    }, void 0, false, {
                        fileName: "[project]/apps/web/src/components/ui/feedback/Toast.tsx",
                        lineNumber: 89,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0)),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.2),transparent)]"
                    }, void 0, false, {
                        fileName: "[project]/apps/web/src/components/ui/feedback/Toast.tsx",
                        lineNumber: 90,
                        columnNumber: 9
                    }, ("TURBOPACK compile-time value", void 0))
                ]
            }, void 0, true, {
                fileName: "[project]/apps/web/src/components/ui/feedback/Toast.tsx",
                lineNumber: 88,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "absolute inset-0 opacity-30",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent",
                    style: {
                        animation: 'shimmer 2s ease-in-out infinite',
                        transform: 'translateX(-100%)'
                    }
                }, void 0, false, {
                    fileName: "[project]/apps/web/src/components/ui/feedback/Toast.tsx",
                    lineNumber: 95,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0))
            }, void 0, false, {
                fileName: "[project]/apps/web/src/components/ui/feedback/Toast.tsx",
                lineNumber: 94,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "relative px-5 py-4",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "flex items-start gap-3",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "flex-shrink-0 rounded-lg bg-white/20 p-2 backdrop-blur-sm ring-1 ring-white/30",
                            children: getIcon()
                        }, void 0, false, {
                            fileName: "[project]/apps/web/src/components/ui/feedback/Toast.tsx",
                            lineNumber: 107,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0)),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                            className: "min-w-0 flex-1",
                            children: [
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "mb-1 flex items-center justify-between gap-2",
                                    children: [
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h4", {
                                            className: "truncate text-lg font-bold tracking-tight text-white drop-shadow-md",
                                            children: toast.title
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/src/components/ui/feedback/Toast.tsx",
                                            lineNumber: 113,
                                            columnNumber: 15
                                        }, ("TURBOPACK compile-time value", void 0)),
                                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                            onClick: handleDismiss,
                                            className: "flex-shrink-0 rounded-lg p-1.5 text-white/70 ring-1 ring-white/20 transition-all hover:bg-white/20 hover:text-white hover:ring-white/40 active:scale-95",
                                            "aria-label": "Dismiss notification",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$x$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__X$3e$__["X"], {
                                                size: 16
                                            }, void 0, false, {
                                                fileName: "[project]/apps/web/src/components/ui/feedback/Toast.tsx",
                                                lineNumber: 121,
                                                columnNumber: 17
                                            }, ("TURBOPACK compile-time value", void 0))
                                        }, void 0, false, {
                                            fileName: "[project]/apps/web/src/components/ui/feedback/Toast.tsx",
                                            lineNumber: 116,
                                            columnNumber: 15
                                        }, ("TURBOPACK compile-time value", void 0))
                                    ]
                                }, void 0, true, {
                                    fileName: "[project]/apps/web/src/components/ui/feedback/Toast.tsx",
                                    lineNumber: 112,
                                    columnNumber: 13
                                }, ("TURBOPACK compile-time value", void 0)),
                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                    className: "mb-2 text-sm font-medium leading-relaxed text-white/95 drop-shadow-sm",
                                    children: toast.message
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/src/components/ui/feedback/Toast.tsx",
                                    lineNumber: 125,
                                    columnNumber: 13
                                }, ("TURBOPACK compile-time value", void 0)),
                                toast.details && toast.details.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                    className: "mt-3 space-y-1.5 rounded-lg bg-black/20 px-3 py-2 backdrop-blur-sm",
                                    children: toast.details.map((detail, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "flex items-start gap-2 text-xs font-medium text-white/90",
                                            children: [
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    className: "mt-0.5 text-white/60",
                                                    children: "•"
                                                }, void 0, false, {
                                                    fileName: "[project]/apps/web/src/components/ui/feedback/Toast.tsx",
                                                    lineNumber: 136,
                                                    columnNumber: 21
                                                }, ("TURBOPACK compile-time value", void 0)),
                                                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                    children: detail
                                                }, void 0, false, {
                                                    fileName: "[project]/apps/web/src/components/ui/feedback/Toast.tsx",
                                                    lineNumber: 137,
                                                    columnNumber: 21
                                                }, ("TURBOPACK compile-time value", void 0))
                                            ]
                                        }, index, true, {
                                            fileName: "[project]/apps/web/src/components/ui/feedback/Toast.tsx",
                                            lineNumber: 132,
                                            columnNumber: 19
                                        }, ("TURBOPACK compile-time value", void 0)))
                                }, void 0, false, {
                                    fileName: "[project]/apps/web/src/components/ui/feedback/Toast.tsx",
                                    lineNumber: 130,
                                    columnNumber: 15
                                }, ("TURBOPACK compile-time value", void 0))
                            ]
                        }, void 0, true, {
                            fileName: "[project]/apps/web/src/components/ui/feedback/Toast.tsx",
                            lineNumber: 111,
                            columnNumber: 11
                        }, ("TURBOPACK compile-time value", void 0))
                    ]
                }, void 0, true, {
                    fileName: "[project]/apps/web/src/components/ui/feedback/Toast.tsx",
                    lineNumber: 105,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0))
            }, void 0, false, {
                fileName: "[project]/apps/web/src/components/ui/feedback/Toast.tsx",
                lineNumber: 104,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "absolute right-0 bottom-0 left-0 h-1.5 overflow-hidden bg-black/30",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                    className: "h-full bg-gradient-to-r from-white/80 via-white/60 to-white/80 shadow-lg transition-all ease-linear",
                    style: {
                        width: '100%',
                        animation: "toast-progress ".concat(toast.duration || 5000, "ms linear forwards")
                    }
                }, void 0, false, {
                    fileName: "[project]/apps/web/src/components/ui/feedback/Toast.tsx",
                    lineNumber: 147,
                    columnNumber: 9
                }, ("TURBOPACK compile-time value", void 0))
            }, void 0, false, {
                fileName: "[project]/apps/web/src/components/ui/feedback/Toast.tsx",
                lineNumber: 146,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0)),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("style", {
                children: "\n        @keyframes toast-progress {\n          from { width: 100%; }\n          to { width: 0%; }\n        }\n        @keyframes shimmer {\n          0%, 100% { transform: translateX(-100%); }\n          50% { transform: translateX(100%); }\n        }\n      "
            }, void 0, false, {
                fileName: "[project]/apps/web/src/components/ui/feedback/Toast.tsx",
                lineNumber: 156,
                columnNumber: 7
            }, ("TURBOPACK compile-time value", void 0))
        ]
    }, void 0, true, {
        fileName: "[project]/apps/web/src/components/ui/feedback/Toast.tsx",
        lineNumber: 84,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
};
_s(Toast, "XYQY6VNzq+6E6HtGA2aZFl5DUgw=");
_c = Toast;
const ToastContainer = (param)=>{
    let { toasts, onDismiss } = param;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "pointer-events-none fixed right-4 bottom-4 z-50 space-y-2",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "pointer-events-auto space-y-2",
            children: toasts.map((toast)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Toast, {
                    toast: toast,
                    onDismiss: onDismiss
                }, toast.id, false, {
                    fileName: "[project]/apps/web/src/components/ui/feedback/Toast.tsx",
                    lineNumber: 183,
                    columnNumber: 11
                }, ("TURBOPACK compile-time value", void 0)))
        }, void 0, false, {
            fileName: "[project]/apps/web/src/components/ui/feedback/Toast.tsx",
            lineNumber: 181,
            columnNumber: 7
        }, ("TURBOPACK compile-time value", void 0))
    }, void 0, false, {
        fileName: "[project]/apps/web/src/components/ui/feedback/Toast.tsx",
        lineNumber: 180,
        columnNumber: 5
    }, ("TURBOPACK compile-time value", void 0));
};
_c1 = ToastContainer;
const useToast = ()=>{
    _s1();
    const [toasts, setToasts] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const addToast = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useToast.useCallback[addToast]": (toast)=>{
            const id = "toast_".concat(Date.now(), "_").concat(Math.random().toString(36).substr(2, 9));
            setToasts({
                "useToast.useCallback[addToast]": (prev)=>[
                        ...prev,
                        {
                            ...toast,
                            id
                        }
                    ]
            }["useToast.useCallback[addToast]"]);
        }
    }["useToast.useCallback[addToast]"], []);
    const dismissToast = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useToast.useCallback[dismissToast]": (id)=>{
            setToasts({
                "useToast.useCallback[dismissToast]": (prev)=>prev.filter({
                        "useToast.useCallback[dismissToast]": (toast)=>toast.id !== id
                    }["useToast.useCallback[dismissToast]"])
            }["useToast.useCallback[dismissToast]"]);
        }
    }["useToast.useCallback[dismissToast]"], []);
    const showAttackRoll = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useToast.useCallback[showAttackRoll]": (weaponName, roll, bonus, isCrit, damage, damageType)=>{
            const total = roll + bonus;
            let title = "🎲 ".concat(weaponName);
            let message = "".concat(roll, " + ").concat(bonus, " = ").concat(total);
            const details = [];
            if (isCrit) {
                title += ' ✨ CRITICAL!';
                message = "".concat(roll, " (CRIT!) + ").concat(bonus, " = ").concat(total);
            } else if (roll === 1) {
                title += ' 💥 FUMBLE!';
                message = "".concat(roll, " (FUMBLE!) + ").concat(bonus, " = ").concat(total);
            }
            if (damage) {
                details.push("💥 Damage: ".concat(damage).concat(damageType ? " (".concat(damageType, ")") : ''));
                if (isCrit) {
                    details.push("🔥 Don't forget to double the damage dice!");
                }
            }
            addToast({
                type: 'attack',
                title,
                message,
                details,
                duration: isCrit ? 7000 : 5000
            });
        }
    }["useToast.useCallback[showAttackRoll]"], [
        addToast
    ]);
    const showSavingThrow = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useToast.useCallback[showSavingThrow]": (spellName, saveDC, saveType, damage, damageType)=>{
            const details = [];
            if (damage) {
                details.push("💥 Damage: ".concat(damage).concat(damageType ? " (".concat(damageType, ")") : ''));
                details.push('✅ Success: Half damage');
                details.push('❌ Failure: Full damage');
            }
            addToast({
                type: 'save',
                title: "🛡️ ".concat(spellName),
                message: "DC ".concat(saveDC).concat(saveType ? " ".concat(saveType, " Save") : ' Save'),
                details,
                duration: 6000
            });
        }
    }["useToast.useCallback[showSavingThrow]"], [
        addToast
    ]);
    const showDamageRoll = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useToast.useCallback[showDamageRoll]": function(weaponName, damageRoll, damageType) {
            let versatile = arguments.length > 3 && arguments[3] !== void 0 ? arguments[3] : false;
            addToast({
                type: 'damage',
                title: "💥 ".concat(weaponName).concat(versatile ? ' (Versatile)' : ''),
                message: "Damage: ".concat(damageRoll),
                details: damageType ? [
                    "🗡️ ".concat(damageType.charAt(0).toUpperCase() + damageType.slice(1), " damage")
                ] : [],
                duration: 4000
            });
        }
    }["useToast.useCallback[showDamageRoll]"], [
        addToast
    ]);
    const showShortRest = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useToast.useCallback[showShortRest]": ()=>{
            addToast({
                type: 'rest',
                title: '☀️ Short Rest Complete',
                message: 'Your character has taken a short rest',
                details: [
                    'Short rest abilities restored',
                    'Pact Magic slots restored',
                    'Reaction reset',
                    'Ready to continue your adventure!'
                ],
                duration: 5000
            });
        }
    }["useToast.useCallback[showShortRest]"], [
        addToast
    ]);
    const showLongRest = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useToast.useCallback[showLongRest]": ()=>{
            addToast({
                type: 'rest',
                title: '🌙 Long Rest Complete',
                message: 'Your character has taken a long rest',
                details: [
                    'All abilities restored',
                    'All spell slots restored',
                    'Hit points fully restored',
                    'Hit dice partially restored',
                    'Ready for new challenges!'
                ],
                duration: 6000
            });
        }
    }["useToast.useCallback[showLongRest]"], [
        addToast
    ]);
    return {
        toasts,
        addToast,
        dismissToast,
        showAttackRoll,
        showSavingThrow,
        showDamageRoll,
        showShortRest,
        showLongRest
    };
};
_s1(useToast, "C08VfyuY5QOWJZjMQRPnSPhlM5k=");
var _c, _c1;
__turbopack_context__.k.register(_c, "Toast");
__turbopack_context__.k.register(_c1, "ToastContainer");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/apps/web/src/components/ui/feedback/YouDiedOverlay.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "YouDiedOverlay",
    ()=>YouDiedOverlay,
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$styled$2d$jsx$2f$style$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/styled-jsx/style.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2d$dom$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react-dom/index.js [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
function YouDiedOverlay(param) {
    let { isVisible, onDismiss, characterName, autoDismissAfter = 6000 } = param;
    _s();
    const [shouldRender, setShouldRender] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [animationPhase, setAnimationPhase] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('hidden');
    const isExitingRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(false);
    const onDismissRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(onDismiss);
    // Keep onDismiss ref updated
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "YouDiedOverlay.useEffect": ()=>{
            onDismissRef.current = onDismiss;
        }
    }["YouDiedOverlay.useEffect"], [
        onDismiss
    ]);
    const handleDismiss = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "YouDiedOverlay.useCallback[handleDismiss]": ()=>{
            // Prevent multiple dismiss calls
            if (isExitingRef.current) return;
            isExitingRef.current = true;
            setAnimationPhase('exiting');
            setTimeout({
                "YouDiedOverlay.useCallback[handleDismiss]": ()=>{
                    var _onDismissRef_current;
                    setShouldRender(false);
                    setAnimationPhase('hidden');
                    isExitingRef.current = false;
                    (_onDismissRef_current = onDismissRef.current) === null || _onDismissRef_current === void 0 ? void 0 : _onDismissRef_current.call(onDismissRef);
                }
            }["YouDiedOverlay.useCallback[handleDismiss]"], 1000); // Exit animation duration
        }
    }["YouDiedOverlay.useCallback[handleDismiss]"], []);
    // Handle visibility changes
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "YouDiedOverlay.useEffect": ()=>{
            if (isVisible && animationPhase === 'hidden' && !isExitingRef.current) {
                setShouldRender(true);
                setAnimationPhase('entering');
                // Transition to visible after entrance animation
                const visibleTimer = setTimeout({
                    "YouDiedOverlay.useEffect.visibleTimer": ()=>{
                        setAnimationPhase('visible');
                    }
                }["YouDiedOverlay.useEffect.visibleTimer"], 2500); // Entrance animation duration
                return ({
                    "YouDiedOverlay.useEffect": ()=>clearTimeout(visibleTimer)
                })["YouDiedOverlay.useEffect"];
            }
        }
    }["YouDiedOverlay.useEffect"], [
        isVisible,
        animationPhase
    ]);
    // Auto-dismiss after delay (starts counting from when fully visible)
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "YouDiedOverlay.useEffect": ()=>{
            if (animationPhase === 'visible' && autoDismissAfter > 0) {
                const dismissTimer = setTimeout({
                    "YouDiedOverlay.useEffect.dismissTimer": ()=>{
                        handleDismiss();
                    }
                }["YouDiedOverlay.useEffect.dismissTimer"], autoDismissAfter);
                return ({
                    "YouDiedOverlay.useEffect": ()=>clearTimeout(dismissTimer)
                })["YouDiedOverlay.useEffect"];
            }
        }
    }["YouDiedOverlay.useEffect"], [
        animationPhase,
        autoDismissAfter,
        handleDismiss
    ]);
    // Handle escape key and click - allow during entering phase too
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "YouDiedOverlay.useEffect": ()=>{
            const handleKeyDown = {
                "YouDiedOverlay.useEffect.handleKeyDown": (e)=>{
                    if (e.key === 'Escape' && (animationPhase === 'visible' || animationPhase === 'entering')) {
                        handleDismiss();
                    }
                }
            }["YouDiedOverlay.useEffect.handleKeyDown"];
            if (shouldRender) {
                window.addEventListener('keydown', handleKeyDown);
                return ({
                    "YouDiedOverlay.useEffect": ()=>window.removeEventListener('keydown', handleKeyDown)
                })["YouDiedOverlay.useEffect"];
            }
        }
    }["YouDiedOverlay.useEffect"], [
        shouldRender,
        animationPhase,
        handleDismiss
    ]);
    const handleClick = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "YouDiedOverlay.useCallback[handleClick]": ()=>{
            if (animationPhase === 'visible' || animationPhase === 'entering') {
                handleDismiss();
            }
        }
    }["YouDiedOverlay.useCallback[handleClick]"], [
        animationPhase,
        handleDismiss
    ]);
    if (!shouldRender) return null;
    const overlay = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        onClick: handleClick,
        style: {
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: animationPhase === 'visible' || animationPhase === 'entering' ? 'pointer' : 'default',
            overflow: 'hidden'
        },
        className: "jsx-7024fc0dbe0f0942" + " " + "you-died-overlay",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                style: {
                    position: 'absolute',
                    inset: 0,
                    background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.95) 50%, rgba(0,0,0,0.98) 100%)',
                    animation: animationPhase === 'entering' ? 'youDiedFadeIn 2s ease-out forwards' : animationPhase === 'exiting' ? 'youDiedFadeOut 1s ease-in forwards' : undefined,
                    opacity: animationPhase === 'visible' ? 1 : undefined
                },
                className: "jsx-7024fc0dbe0f0942"
            }, void 0, false, {
                fileName: "[project]/apps/web/src/components/ui/feedback/YouDiedOverlay.tsx",
                lineNumber: 116,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                style: {
                    position: 'absolute',
                    width: '100%',
                    height: '300px',
                    background: 'radial-gradient(ellipse at center, rgba(139,0,0,0.3) 0%, transparent 70%)',
                    animation: animationPhase === 'entering' ? 'youDiedGlow 2.5s ease-out forwards' : animationPhase === 'exiting' ? 'youDiedFadeOut 1s ease-in forwards' : undefined,
                    opacity: animationPhase === 'visible' ? 1 : undefined
                },
                className: "jsx-7024fc0dbe0f0942"
            }, void 0, false, {
                fileName: "[project]/apps/web/src/components/ui/feedback/YouDiedOverlay.tsx",
                lineNumber: 133,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                style: {
                    fontFamily: 'var(--font-cinzel-decorative), serif',
                    fontSize: 'clamp(3rem, 12vw, 8rem)',
                    fontWeight: 400,
                    color: '#8B0000',
                    textShadow: "\n            0 0 10px rgba(139, 0, 0, 0.8),\n            0 0 20px rgba(139, 0, 0, 0.6),\n            0 0 40px rgba(139, 0, 0, 0.4),\n            0 0 80px rgba(139, 0, 0, 0.2)\n          ",
                    letterSpacing: '0.15em',
                    textTransform: 'uppercase',
                    margin: 0,
                    padding: '0 1rem',
                    textAlign: 'center',
                    position: 'relative',
                    zIndex: 1,
                    animation: animationPhase === 'entering' ? 'youDiedTextReveal 2.5s ease-out forwards' : animationPhase === 'exiting' ? 'youDiedTextExit 1s ease-in forwards' : undefined,
                    opacity: animationPhase === 'visible' ? 1 : undefined,
                    transform: animationPhase === 'visible' ? 'scale(1)' : undefined
                },
                className: "jsx-7024fc0dbe0f0942",
                children: "You Died"
            }, void 0, false, {
                fileName: "[project]/apps/web/src/components/ui/feedback/YouDiedOverlay.tsx",
                lineNumber: 151,
                columnNumber: 7
            }, this),
            characterName && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                style: {
                    fontFamily: 'var(--font-cinzel-decorative), serif',
                    fontSize: 'clamp(0.875rem, 3vw, 1.5rem)',
                    fontWeight: 400,
                    color: '#666',
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    margin: '2rem 0 0 0',
                    position: 'relative',
                    zIndex: 1,
                    animation: animationPhase === 'entering' ? 'youDiedSubtitleReveal 2.5s ease-out forwards' : animationPhase === 'exiting' ? 'youDiedFadeOut 0.8s ease-in forwards' : undefined,
                    opacity: animationPhase === 'visible' ? 1 : undefined
                },
                className: "jsx-7024fc0dbe0f0942",
                children: characterName
            }, void 0, false, {
                fileName: "[project]/apps/web/src/components/ui/feedback/YouDiedOverlay.tsx",
                lineNumber: 185,
                columnNumber: 9
            }, this),
            (animationPhase === 'visible' || animationPhase === 'entering') && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                style: {
                    position: 'absolute',
                    bottom: '3rem',
                    fontFamily: 'var(--font-cinzel-decorative), serif',
                    fontSize: '0.875rem',
                    color: '#444',
                    letterSpacing: '0.1em',
                    animation: 'youDiedHintPulse 2s ease-in-out infinite'
                },
                className: "jsx-7024fc0dbe0f0942",
                children: "Click anywhere to continue"
            }, void 0, false, {
                fileName: "[project]/apps/web/src/components/ui/feedback/YouDiedOverlay.tsx",
                lineNumber: 211,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$styled$2d$jsx$2f$style$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                id: "7024fc0dbe0f0942",
                children: "@keyframes youDiedFadeIn{0%{opacity:0}to{opacity:1}}@keyframes youDiedFadeOut{0%{opacity:1}to{opacity:0}}@keyframes youDiedGlow{0%{opacity:0;transform:scale(.8)}50%{opacity:0}to{opacity:1;transform:scale(1)}}@keyframes youDiedTextReveal{0%{opacity:0;filter:blur(10px);transform:scale(1.1)}30%{opacity:0;filter:blur(10px);transform:scale(1.1)}to{opacity:1;filter:blur();transform:scale(1)}}@keyframes youDiedTextExit{0%{opacity:1;transform:scale(1)}to{opacity:0;transform:scale(.95)}}@keyframes youDiedSubtitleReveal{0%{opacity:0}60%{opacity:0}to{opacity:1}}@keyframes youDiedHintPulse{0%,to{opacity:.4}50%{opacity:.7}}"
            }, void 0, false, void 0, this)
        ]
    }, void 0, true, {
        fileName: "[project]/apps/web/src/components/ui/feedback/YouDiedOverlay.tsx",
        lineNumber: 97,
        columnNumber: 5
    }, this);
    // Use portal to render at document root
    if ("TURBOPACK compile-time truthy", 1) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2d$dom$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createPortal"])(overlay, document.body);
    }
    //TURBOPACK unreachable
    ;
}
_s(YouDiedOverlay, "lHfKvBEPa3xOmOoV0x9au0FnvFc=");
_c = YouDiedOverlay;
const __TURBOPACK__default__export__ = YouDiedOverlay;
var _c;
__turbopack_context__.k.register(_c, "YouDiedOverlay");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/apps/web/src/components/ui/feedback/LevelUpOverlay.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "LevelUpOverlay",
    ()=>LevelUpOverlay,
    "default",
    ()=>__TURBOPACK__default__export__
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$styled$2d$jsx$2f$style$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/styled-jsx/style.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2d$dom$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react-dom/index.js [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
;
;
function LevelUpOverlay(param) {
    let { isVisible, onDismiss, newLevel, characterName, autoDismissAfter = 4000 } = param;
    _s();
    console.log('LevelUpOverlay rendered', isVisible, newLevel, characterName);
    const [shouldRender, setShouldRender] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    const [animationPhase, setAnimationPhase] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])('hidden');
    const isExitingRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(false);
    const onDismissRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(onDismiss);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "LevelUpOverlay.useEffect": ()=>{
            onDismissRef.current = onDismiss;
        }
    }["LevelUpOverlay.useEffect"], [
        onDismiss
    ]);
    const handleDismiss = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "LevelUpOverlay.useCallback[handleDismiss]": ()=>{
            if (isExitingRef.current) return;
            isExitingRef.current = true;
            setAnimationPhase('exiting');
            setTimeout({
                "LevelUpOverlay.useCallback[handleDismiss]": ()=>{
                    var _onDismissRef_current;
                    setShouldRender(false);
                    setAnimationPhase('hidden');
                    isExitingRef.current = false;
                    (_onDismissRef_current = onDismissRef.current) === null || _onDismissRef_current === void 0 ? void 0 : _onDismissRef_current.call(onDismissRef);
                }
            }["LevelUpOverlay.useCallback[handleDismiss]"], 800);
        }
    }["LevelUpOverlay.useCallback[handleDismiss]"], []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "LevelUpOverlay.useEffect": ()=>{
            if (isVisible && animationPhase === 'hidden' && !isExitingRef.current) {
                setShouldRender(true);
                setAnimationPhase('entering');
                const visibleTimer = setTimeout({
                    "LevelUpOverlay.useEffect.visibleTimer": ()=>{
                        setAnimationPhase('visible');
                    }
                }["LevelUpOverlay.useEffect.visibleTimer"], 1500);
                return ({
                    "LevelUpOverlay.useEffect": ()=>clearTimeout(visibleTimer)
                })["LevelUpOverlay.useEffect"];
            }
        }
    }["LevelUpOverlay.useEffect"], [
        isVisible,
        animationPhase
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "LevelUpOverlay.useEffect": ()=>{
            if (animationPhase === 'visible' && autoDismissAfter > 0) {
                const dismissTimer = setTimeout({
                    "LevelUpOverlay.useEffect.dismissTimer": ()=>{
                        handleDismiss();
                    }
                }["LevelUpOverlay.useEffect.dismissTimer"], autoDismissAfter);
                return ({
                    "LevelUpOverlay.useEffect": ()=>clearTimeout(dismissTimer)
                })["LevelUpOverlay.useEffect"];
            }
        }
    }["LevelUpOverlay.useEffect"], [
        animationPhase,
        autoDismissAfter,
        handleDismiss
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "LevelUpOverlay.useEffect": ()=>{
            const handleKeyDown = {
                "LevelUpOverlay.useEffect.handleKeyDown": (e)=>{
                    if (e.key === 'Escape' && (animationPhase === 'visible' || animationPhase === 'entering')) {
                        handleDismiss();
                    }
                }
            }["LevelUpOverlay.useEffect.handleKeyDown"];
            if (shouldRender) {
                window.addEventListener('keydown', handleKeyDown);
                return ({
                    "LevelUpOverlay.useEffect": ()=>window.removeEventListener('keydown', handleKeyDown)
                })["LevelUpOverlay.useEffect"];
            }
        }
    }["LevelUpOverlay.useEffect"], [
        shouldRender,
        animationPhase,
        handleDismiss
    ]);
    const handleClick = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "LevelUpOverlay.useCallback[handleClick]": ()=>{
            if (animationPhase === 'visible' || animationPhase === 'entering') {
                handleDismiss();
            }
        }
    }["LevelUpOverlay.useCallback[handleClick]"], [
        animationPhase,
        handleDismiss
    ]);
    if (!shouldRender) return null;
    const overlay = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        onClick: handleClick,
        style: {
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: animationPhase === 'visible' || animationPhase === 'entering' ? 'pointer' : 'default',
            overflow: 'hidden'
        },
        className: "jsx-e8bf1fcc8cd0e7f9" + " " + "level-up-overlay",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                style: {
                    position: 'absolute',
                    inset: 0,
                    background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.9) 70%, rgba(0,0,0,0.95) 100%)',
                    animation: animationPhase === 'entering' ? 'levelUpBgFadeIn 1s ease-out forwards' : animationPhase === 'exiting' ? 'levelUpBgFadeOut 0.8s ease-in forwards' : undefined,
                    opacity: animationPhase === 'visible' ? 1 : undefined
                },
                className: "jsx-e8bf1fcc8cd0e7f9"
            }, void 0, false, {
                fileName: "[project]/apps/web/src/components/ui/feedback/LevelUpOverlay.tsx",
                lineNumber: 113,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                style: {
                    position: 'absolute',
                    width: '200%',
                    height: '200%',
                    background: "\n            conic-gradient(\n              from 0deg at 50% 50%,\n              transparent 0deg,\n              rgba(255, 215, 0, 0.03) 10deg,\n              transparent 20deg,\n              rgba(255, 215, 0, 0.05) 30deg,\n              transparent 40deg,\n              rgba(255, 215, 0, 0.03) 50deg,\n              transparent 60deg,\n              rgba(255, 215, 0, 0.04) 70deg,\n              transparent 80deg,\n              rgba(255, 215, 0, 0.03) 90deg,\n              transparent 100deg,\n              rgba(255, 215, 0, 0.05) 110deg,\n              transparent 120deg,\n              rgba(255, 215, 0, 0.03) 130deg,\n              transparent 140deg,\n              rgba(255, 215, 0, 0.04) 150deg,\n              transparent 160deg,\n              rgba(255, 215, 0, 0.03) 170deg,\n              transparent 180deg,\n              rgba(255, 215, 0, 0.05) 190deg,\n              transparent 200deg,\n              rgba(255, 215, 0, 0.03) 210deg,\n              transparent 220deg,\n              rgba(255, 215, 0, 0.04) 230deg,\n              transparent 240deg,\n              rgba(255, 215, 0, 0.03) 250deg,\n              transparent 260deg,\n              rgba(255, 215, 0, 0.05) 270deg,\n              transparent 280deg,\n              rgba(255, 215, 0, 0.03) 290deg,\n              transparent 300deg,\n              rgba(255, 215, 0, 0.04) 310deg,\n              transparent 320deg,\n              rgba(255, 215, 0, 0.03) 330deg,\n              transparent 340deg,\n              rgba(255, 215, 0, 0.05) 350deg,\n              transparent 360deg\n            )\n          ",
                    animation: animationPhase === 'entering' || animationPhase === 'visible' ? 'levelUpRaysRotate 20s linear infinite, levelUpRaysFadeIn 1.5s ease-out forwards' : animationPhase === 'exiting' ? 'levelUpBgFadeOut 0.8s ease-in forwards' : undefined
                },
                className: "jsx-e8bf1fcc8cd0e7f9"
            }, void 0, false, {
                fileName: "[project]/apps/web/src/components/ui/feedback/LevelUpOverlay.tsx",
                lineNumber: 130,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                style: {
                    position: 'absolute',
                    width: '600px',
                    height: '300px',
                    background: 'radial-gradient(ellipse at center, rgba(255, 215, 0, 0.15) 0%, transparent 60%)',
                    animation: animationPhase === 'entering' ? 'levelUpGlowPulse 2s ease-out forwards' : animationPhase === 'exiting' ? 'levelUpBgFadeOut 0.8s ease-in forwards' : 'levelUpGlowBreath 3s ease-in-out infinite',
                    opacity: animationPhase === 'visible' ? 1 : undefined
                },
                className: "jsx-e8bf1fcc8cd0e7f9"
            }, void 0, false, {
                fileName: "[project]/apps/web/src/components/ui/feedback/LevelUpOverlay.tsx",
                lineNumber: 187,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                style: {
                    position: 'relative',
                    zIndex: 1,
                    textAlign: 'center',
                    animation: animationPhase === 'entering' ? 'levelUpContentReveal 1.5s ease-out forwards' : animationPhase === 'exiting' ? 'levelUpContentExit 0.8s ease-in forwards' : undefined,
                    opacity: animationPhase === 'visible' ? 1 : undefined
                },
                className: "jsx-e8bf1fcc8cd0e7f9",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        style: {
                            width: '300px',
                            height: '2px',
                            background: 'linear-gradient(90deg, transparent, rgba(255, 215, 0, 0.8), transparent)',
                            margin: '0 auto 1.5rem',
                            animation: animationPhase === 'entering' ? 'levelUpLineExpand 1s ease-out forwards' : undefined
                        },
                        className: "jsx-e8bf1fcc8cd0e7f9"
                    }, void 0, false, {
                        fileName: "[project]/apps/web/src/components/ui/feedback/LevelUpOverlay.tsx",
                        lineNumber: 220,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        style: {
                            fontFamily: 'var(--font-cinzel-decorative), Georgia, serif',
                            fontSize: 'clamp(0.875rem, 2vw, 1rem)',
                            fontWeight: 400,
                            color: 'rgba(255, 215, 0, 0.7)',
                            letterSpacing: '0.4em',
                            textTransform: 'uppercase',
                            margin: '0 0 0.5rem 0'
                        },
                        className: "jsx-e8bf1fcc8cd0e7f9",
                        children: "Level Up"
                    }, void 0, false, {
                        fileName: "[project]/apps/web/src/components/ui/feedback/LevelUpOverlay.tsx",
                        lineNumber: 235,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                        style: {
                            fontFamily: 'var(--font-cinzel-decorative), Georgia, serif',
                            fontSize: 'clamp(4rem, 15vw, 8rem)',
                            fontWeight: 700,
                            color: '#FFD700',
                            textShadow: "\n              0 0 20px rgba(255, 215, 0, 0.5),\n              0 0 40px rgba(255, 215, 0, 0.3),\n              0 0 60px rgba(255, 215, 0, 0.2),\n              0 2px 4px rgba(0, 0, 0, 0.5)\n            ",
                            letterSpacing: '0.05em',
                            margin: 0,
                            lineHeight: 1
                        },
                        className: "jsx-e8bf1fcc8cd0e7f9",
                        children: newLevel
                    }, void 0, false, {
                        fileName: "[project]/apps/web/src/components/ui/feedback/LevelUpOverlay.tsx",
                        lineNumber: 250,
                        columnNumber: 9
                    }, this),
                    characterName && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        style: {
                            fontFamily: 'var(--font-cinzel-decorative), Georgia, serif',
                            fontSize: 'clamp(0.875rem, 2.5vw, 1.25rem)',
                            fontWeight: 400,
                            color: 'rgba(255, 255, 255, 0.6)',
                            letterSpacing: '0.15em',
                            textTransform: 'uppercase',
                            margin: '1rem 0 0 0'
                        },
                        className: "jsx-e8bf1fcc8cd0e7f9",
                        children: characterName
                    }, void 0, false, {
                        fileName: "[project]/apps/web/src/components/ui/feedback/LevelUpOverlay.tsx",
                        lineNumber: 272,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        style: {
                            width: '300px',
                            height: '2px',
                            background: 'linear-gradient(90deg, transparent, rgba(255, 215, 0, 0.8), transparent)',
                            margin: '1.5rem auto 0',
                            animation: animationPhase === 'entering' ? 'levelUpLineExpand 1s ease-out forwards' : undefined
                        },
                        className: "jsx-e8bf1fcc8cd0e7f9"
                    }, void 0, false, {
                        fileName: "[project]/apps/web/src/components/ui/feedback/LevelUpOverlay.tsx",
                        lineNumber: 288,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/apps/web/src/components/ui/feedback/LevelUpOverlay.tsx",
                lineNumber: 205,
                columnNumber: 7
            }, this),
            (animationPhase === 'visible' || animationPhase === 'entering') && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                style: {
                    position: 'absolute',
                    bottom: '2rem',
                    fontFamily: 'var(--font-cinzel-decorative), Georgia, serif',
                    fontSize: '0.75rem',
                    color: 'rgba(255, 215, 0, 0.4)',
                    letterSpacing: '0.1em',
                    animation: 'levelUpHintPulse 2s ease-in-out infinite'
                },
                className: "jsx-e8bf1fcc8cd0e7f9",
                children: "Click anywhere to continue"
            }, void 0, false, {
                fileName: "[project]/apps/web/src/components/ui/feedback/LevelUpOverlay.tsx",
                lineNumber: 305,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$styled$2d$jsx$2f$style$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                id: "e8bf1fcc8cd0e7f9",
                children: "@keyframes levelUpBgFadeIn{0%{opacity:0}to{opacity:1}}@keyframes levelUpBgFadeOut{0%{opacity:1}to{opacity:0}}@keyframes levelUpRaysRotate{0%{transform:rotate(0)}to{transform:rotate(360deg)}}@keyframes levelUpRaysFadeIn{0%{opacity:0}50%{opacity:0}to{opacity:1}}@keyframes levelUpGlowPulse{0%{opacity:0;transform:scale(.8)}50%{opacity:0}to{opacity:1;transform:scale(1)}}@keyframes levelUpGlowBreath{0%,to{opacity:.8;transform:scale(1)}50%{opacity:1;transform:scale(1.05)}}@keyframes levelUpContentReveal{0%{opacity:0;transform:scale(.9)translateY(20px)}40%{opacity:0}to{opacity:1;transform:scale(1)translateY(0)}}@keyframes levelUpContentExit{0%{opacity:1;transform:scale(1)}to{opacity:0;transform:scale(1.05)}}@keyframes levelUpLineExpand{0%{opacity:0;width:0}50%{opacity:0}to{opacity:1;width:300px}}@keyframes levelUpHintPulse{0%,to{opacity:.3}50%{opacity:.6}}"
            }, void 0, false, void 0, this)
        ]
    }, void 0, true, {
        fileName: "[project]/apps/web/src/components/ui/feedback/LevelUpOverlay.tsx",
        lineNumber: 94,
        columnNumber: 5
    }, this);
    if ("TURBOPACK compile-time truthy", 1) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2d$dom$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createPortal"])(overlay, document.body);
    }
    //TURBOPACK unreachable
    ;
}
_s(LevelUpOverlay, "lHfKvBEPa3xOmOoV0x9au0FnvFc=");
_c = LevelUpOverlay;
const __TURBOPACK__default__export__ = LevelUpOverlay;
var _c;
__turbopack_context__.k.register(_c, "LevelUpOverlay");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/apps/web/src/components/ui/feedback/index.ts [app-client] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

// Feedback & Modal Components
__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$feedback$2f$ConfirmationModal$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/feedback/ConfirmationModal.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$feedback$2f$ErrorBoundary$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/feedback/ErrorBoundary.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$feedback$2f$ErrorPage$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/feedback/ErrorPage.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$feedback$2f$Modal$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/feedback/Modal.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$feedback$2f$ModalPortal$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/feedback/ModalPortal.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$feedback$2f$NotHydrated$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/feedback/NotHydrated.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$feedback$2f$SaveIndicator$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/feedback/SaveIndicator.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$feedback$2f$Toast$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/feedback/Toast.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$feedback$2f$YouDiedOverlay$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/feedback/YouDiedOverlay.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$apps$2f$web$2f$src$2f$components$2f$ui$2f$feedback$2f$LevelUpOverlay$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/apps/web/src/components/ui/feedback/LevelUpOverlay.tsx [app-client] (ecmascript)");
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
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=apps_web_src_components_ui_feedback_e40bbf56._.js.map