'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  HandTool,
  SelectTool,
  PencilTool,
  EraserTool,
  ArrowTool,
  NoteTool,
  ImageTool,
  TextTool,
  ShapeTool,
  AutoSave,
  type Tool,
  type ToolName,
  type ShapeKind,
  type Layer,
  type Viewport,
} from '@fieldnotes/core';
import {
  FieldNotesCanvas as Canvas,
  CanvasElement,
  type FieldNotesCanvasRef,
} from '@fieldnotes/react';
import {
  Hand,
  MousePointer2,
  Pencil,
  Eraser,
  ArrowUpRight,
  StickyNote,
  Image as ImageIcon,
  Type,
  Shapes,
  Grid3X3,
  Undo2,
  Redo2,
  Download,
  Upload,
  Trash2,
  ZoomIn,
  ZoomOut,
  PanelLeftClose,
  PanelLeftOpen,
  BookOpen,
  GripVertical,
  FileText,
  Users,
  Package,
  Map,
  Pin,
  X,
  Edit3,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Layers,
  Plus,
  ChevronUp,
  ChevronDown,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';
import {
  useProtoNotesStore,
  initializeSampleNotesIfEmpty,
  type ProtoNote,
} from './notesStore';

// ─── Constants ───────────────────────────────────────────────

const TOOL_DEFS: { name: ToolName; icon: typeof Hand; label: string }[] = [
  { name: 'hand', icon: Hand, label: 'Pan' },
  { name: 'select', icon: MousePointer2, label: 'Select' },
  { name: 'pencil', icon: Pencil, label: 'Draw' },
  { name: 'eraser', icon: Eraser, label: 'Eraser' },
  { name: 'arrow', icon: ArrowUpRight, label: 'Arrow' },
  { name: 'note', icon: StickyNote, label: 'Sticky Note' },
  { name: 'text', icon: Type, label: 'Text' },
  { name: 'shape', icon: Shapes, label: 'Shape' },
  { name: 'image', icon: ImageIcon, label: 'Image' },
];

const CATEGORY_COLORS: Record<
  string,
  { bg: string; border: string; icon: string }
> = {
  session: { bg: '#eff6ff', border: '#93c5fd', icon: '#2563eb' },
  npc: { bg: '#f0fdf4', border: '#86efac', icon: '#16a34a' },
  item: { bg: '#faf5ff', border: '#c4b5fd', icon: '#7c3aed' },
  plot: { bg: '#fff7ed', border: '#fdba74', icon: '#ea580c' },
};

function CategoryIcon({
  category,
  size = 14,
}: {
  category: string;
  size?: number;
}) {
  const color = CATEGORY_COLORS[category]?.icon ?? '#6b7280';
  switch (category) {
    case 'session':
      return <FileText size={size} style={{ color }} />;
    case 'npc':
      return <Users size={size} style={{ color }} />;
    case 'item':
      return <Package size={size} style={{ color }} />;
    case 'plot':
      return <Map size={size} style={{ color }} />;
    default:
      return <FileText size={size} style={{ color }} />;
  }
}

// ─── Note Card (React component rendered ON the canvas) ─────

interface NoteCardOnCanvasProps {
  note: ProtoNote;
  onView: (note: ProtoNote) => void;
  onEdit: (note: ProtoNote) => void;
}

function NoteCardOnCanvas({ note, onView, onEdit }: NoteCardOnCanvasProps) {
  const colors = CATEGORY_COLORS[note.category] ?? CATEGORY_COLORS.session;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#ffffff',
        border: `2px solid ${colors.border}`,
        borderRadius: 12,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <CategoryIcon category={note.category} />
        <span
          style={{
            fontWeight: 600,
            fontSize: 13,
            color: '#111827',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {note.title || 'Untitled Note'}
        </span>
        {note.isPinned && (
          <Pin size={12} style={{ color: '#ca8a04', flexShrink: 0 }} />
        )}
      </div>

      {/* Category badge */}
      <div>
        <span
          style={{
            display: 'inline-block',
            backgroundColor: colors.bg,
            color: colors.icon,
            fontSize: 10,
            fontWeight: 600,
            padding: '2px 8px',
            borderRadius: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {note.category}
        </span>
      </div>

      {/* Excerpt */}
      <div
        style={{
          fontSize: 12,
          lineHeight: 1.5,
          color: '#4b5563',
          flex: 1,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 4,
          WebkitBoxOrient: 'vertical',
        }}
      >
        {note.excerpt || 'Empty note...'}
      </div>

      {/* Tags */}
      {note.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {note.tags.slice(0, 3).map(tag => (
            <span
              key={tag}
              style={{
                fontSize: 10,
                backgroundColor: '#dbeafe',
                color: '#1e40af',
                padding: '2px 6px',
                borderRadius: 8,
              }}
            >
              {tag}
            </span>
          ))}
          {note.tags.length > 3 && (
            <span
              style={{
                fontSize: 10,
                backgroundColor: '#f3f4f6',
                color: '#6b7280',
                padding: '2px 6px',
                borderRadius: 8,
              }}
            >
              +{note.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div
        style={{
          display: 'flex',
          gap: 6,
          marginTop: 4,
          borderTop: '1px solid #f3f4f6',
          paddingTop: 8,
        }}
      >
        <button
          onClick={e => {
            e.stopPropagation();
            onView(note);
          }}
          style={{
            flex: 1,
            fontSize: 11,
            fontWeight: 600,
            padding: '5px 0',
            backgroundColor: colors.bg,
            color: colors.icon,
            border: `1px solid ${colors.border}`,
            borderRadius: 6,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
          }}
        >
          <Eye size={11} />
          View
        </button>
        <button
          onClick={e => {
            e.stopPropagation();
            onEdit(note);
          }}
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: '5px 10px',
            backgroundColor: '#f3f4f6',
            color: '#374151',
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Edit3 size={11} />
          Edit
        </button>
      </div>
    </div>
  );
}

// ─── Placed note (tracked so CanvasElement can render it) ───

interface PlacedNote {
  id: string;
  noteId: string;
  position: { x: number; y: number };
}

// ─── Main Component ─────────────────────────────────────────

interface FieldNotesCanvasProps {
  className?: string;
}

export default function FieldNotesCanvasPage({
  className = '',
}: FieldNotesCanvasProps) {
  const canvasRef = useRef<FieldNotesCanvasRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [elementCount, setElementCount] = useState(0);
  const [activeTool, setActiveTool] = useState('hand');
  const [zoom, setZoom] = useState(1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [viewingNote, setViewingNote] = useState<ProtoNote | null>(null);
  const [editingNote, setEditingNote] = useState<ProtoNote | null>(null);
  const [placedNotes, setPlacedNotes] = useState<PlacedNote[]>([]);
  const [pencilColor, setPencilColor] = useState('#334155');
  const [pencilWidth, setPencilWidth] = useState(2);
  const [arrowColor, setArrowColor] = useState('#334155');
  const [noteColor, setNoteColor] = useState('#fef08a');
  const [noteTextColor, setNoteTextColor] = useState('#334155');
  const [textColor, setTextColor] = useState('#334155');
  const [textFontSize, setTextFontSize] = useState(16);
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>(
    'left'
  );
  const [shapeKind, setShapeKind] = useState<ShapeKind>('rectangle');
  const [shapeStrokeColor, setShapeStrokeColor] = useState('#334155');
  const [shapeStrokeWidth, setShapeStrokeWidth] = useState(2);
  const [shapeFillColor, setShapeFillColor] = useState('transparent');
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [layersPanelOpen, setLayersPanelOpen] = useState(false);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [activeLayerId, setActiveLayerId] = useState('');
  const [renamingLayerId, setRenamingLayerId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const autoSaveRef = useRef<AutoSave | null>(null);

  const {
    notes,
    hasHydrated,
    hasInitialized,
    initializeStore,
    updateNote,
    getNoteById,
  } = useProtoNotesStore();

  // Initialize sample data
  useEffect(() => {
    if (hasHydrated && !hasInitialized) {
      initializeStore();
      if (notes.length === 0) {
        initializeSampleNotesIfEmpty();
      }
    }
  }, [hasHydrated, hasInitialized, notes.length, initializeStore]);

  // Build tools once
  const tools = useMemo<Tool[]>(
    () => [
      new HandTool(),
      new SelectTool(),
      new PencilTool({ color: '#334155', width: 2 }),
      new EraserTool({ radius: 12 }),
      new ArrowTool({ color: '#334155', width: 2 }),
      new NoteTool({ backgroundColor: '#fef08a', textColor: '#334155' }),
      new TextTool({ fontSize: 16, color: '#334155', textAlign: 'left' }),
      new ShapeTool({
        shape: 'rectangle',
        strokeColor: '#334155',
        strokeWidth: 2,
        fillColor: 'transparent',
      }),
      new ImageTool(),
    ],
    []
  );

  const handleReady = useCallback((vp: Viewport) => {
    vp.store.on('add', () => setElementCount(vp.store.count));
    vp.store.on('remove', () => setElementCount(vp.store.count));
    vp.store.on('clear', () => setElementCount(0));

    vp.toolManager.onChange(name => setActiveTool(name));
    vp.camera.onChange(() => setZoom(vp.camera.zoom));
    vp.history.onChange(() => {
      setCanUndo(vp.history.canUndo);
      setCanRedo(vp.history.canRedo);
    });

    // Sync layer state
    const syncLayers = () => {
      setLayers([...vp.layerManager.getLayers()]);
      setActiveLayerId(vp.layerManager.activeLayerId);
    };
    vp.layerManager.on('change', syncLayers);
    syncLayers();

    // AutoSave — persist canvas + layers to localStorage
    const autoSave = new AutoSave(vp.store, vp.camera, {
      key: 'fieldnotes-canvas-autosave',
      debounceMs: 1000,
      layerManager: vp.layerManager,
    });
    const saved = autoSave.load();
    if (saved) {
      vp.loadState(saved);
      setElementCount(vp.store.count);
    }
    autoSave.start();
    autoSaveRef.current = autoSave;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      autoSaveRef.current?.stop();
    };
  }, []);

  // Sync pencil options when color/width change
  useEffect(() => {
    const vp = canvasRef.current?.viewport;
    if (!vp) return;
    const pencil = vp.toolManager.getTool<PencilTool>('pencil');
    pencil?.setOptions({ color: pencilColor, width: pencilWidth });
    vp.requestRender();
  }, [pencilColor, pencilWidth]);

  // Sync arrow color
  useEffect(() => {
    const vp = canvasRef.current?.viewport;
    if (!vp) return;
    const arrow = vp.toolManager.getTool<ArrowTool>('arrow');
    arrow?.setOptions({ color: arrowColor });
  }, [arrowColor]);

  // Sync note options
  useEffect(() => {
    const vp = canvasRef.current?.viewport;
    if (!vp) return;
    const note = vp.toolManager.getTool<NoteTool>('note');
    note?.setOptions({ backgroundColor: noteColor, textColor: noteTextColor });
  }, [noteColor, noteTextColor]);

  // Sync text tool options
  useEffect(() => {
    const vp = canvasRef.current?.viewport;
    if (!vp) return;
    const text = vp.toolManager.getTool<TextTool>('text');
    text?.setOptions({ color: textColor, fontSize: textFontSize, textAlign });
  }, [textColor, textFontSize, textAlign]);

  // Sync shape tool options
  useEffect(() => {
    const vp = canvasRef.current?.viewport;
    if (!vp) return;
    const shape = vp.toolManager.getTool<ShapeTool>('shape');
    shape?.setOptions({
      shape: shapeKind,
      strokeColor: shapeStrokeColor,
      strokeWidth: shapeStrokeWidth,
      fillColor: shapeFillColor,
    });
  }, [shapeKind, shapeStrokeColor, shapeStrokeWidth, shapeFillColor]);

  // ─── Viewport helpers (imperatively via ref) ──────────

  const getVp = () => canvasRef.current?.viewport ?? null;

  const switchTool = useCallback((name: string) => {
    const vp = getVp();
    if (!vp) return;
    if (name === 'image') {
      fileInputRef.current?.click();
      return;
    }
    vp.toolManager.setTool(name, vp.toolContext);
  }, []);

  const handlePlaceNote = useCallback((note: ProtoNote) => {
    const vp = getVp();
    if (!vp) return;

    const center = vp.camera.screenToWorld({
      x: vp.domLayer.clientWidth / 2,
      y: vp.domLayer.clientHeight / 2,
    });

    setPlacedNotes(prev => [
      ...prev,
      {
        id: `placed-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        noteId: note.id,
        position: { x: center.x - 140, y: center.y - 110 },
      },
    ]);
  }, []);

  const handleImageFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      const vp = getVp();
      if (!file || !vp) return;

      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== 'string') return;
        const img = new window.Image();
        img.onload = () => {
          const maxDim = 400;
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);
          const center = vp.camera.screenToWorld({
            x: vp.domLayer.clientWidth / 2,
            y: vp.domLayer.clientHeight / 2,
          });
          vp.addImage(
            reader.result as string,
            { x: center.x - w / 2, y: center.y - h / 2 },
            { w, h }
          );
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    },
    []
  );

  const handleExport = useCallback(() => {
    const vp = getVp();
    if (!vp) return;
    const json = vp.exportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fieldnotes-canvas-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const vp = getVp();
        if (!vp || typeof reader.result !== 'string') return;
        try {
          vp.loadJSON(reader.result);
          setElementCount(vp.store.count);
        } catch {
          alert('Invalid canvas file');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, []);

  const handleClear = useCallback(() => {
    const vp = getVp();
    if (!vp || vp.store.count === 0) return;
    if (!confirm('Clear all elements from the canvas?')) return;
    vp.store.clear();
    setPlacedNotes([]);
    autoSaveRef.current?.clear();
    vp.requestRender();
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editingNote) return;
    updateNote(editingNote.id, {
      title: editingNote.title,
      content: editingNote.content,
      category: editingNote.category,
      tags: editingNote.tags,
      isPinned: editingNote.isPinned,
    });
    setEditingNote(null);
  }, [editingNote, updateNote]);

  return (
    <div className={`flex h-full flex-col ${className}`}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageFileSelect}
      />

      {/* View Note Modal */}
      {viewingNote && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
          onClick={() => setViewingNote(null)}
        >
          <div
            className="relative mx-4 max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setViewingNote(null)}
              className="absolute top-4 right-4 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X size={18} />
            </button>
            <div className="mb-3 flex items-center gap-2">
              <CategoryIcon category={viewingNote.category} />
              <h2 className="text-lg font-bold text-slate-900">
                {viewingNote.title}
              </h2>
              {viewingNote.isPinned && (
                <Pin size={14} className="text-yellow-600" />
              )}
            </div>
            <span
              className="mb-4 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase"
              style={{
                backgroundColor:
                  CATEGORY_COLORS[viewingNote.category]?.bg ?? '#f3f4f6',
                color: CATEGORY_COLORS[viewingNote.category]?.icon ?? '#6b7280',
              }}
            >
              {viewingNote.category}
            </span>
            <div
              className="prose prose-sm mb-4 max-w-none text-slate-700"
              dangerouslySetInnerHTML={{ __html: viewingNote.content }}
            />
            {viewingNote.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {viewingNote.tags.map(tag => (
                  <span
                    key={tag}
                    className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <div className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-400">
              Created {new Date(viewingNote.createdAt).toLocaleDateString()} ·
              Updated {new Date(viewingNote.updatedAt).toLocaleDateString()}
            </div>
          </div>
        </div>
      )}

      {/* Edit Note Modal */}
      {editingNote && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
          onClick={() => setEditingNote(null)}
        >
          <div
            className="relative mx-4 w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setEditingNote(null)}
              className="absolute top-4 right-4 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X size={18} />
            </button>
            <h2 className="mb-4 text-lg font-bold text-slate-900">Edit Note</h2>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Title
                </label>
                <input
                  type="text"
                  value={editingNote.title}
                  onChange={e =>
                    setEditingNote({ ...editingNote, title: e.target.value })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Content
                </label>
                <textarea
                  value={editingNote.content}
                  onChange={e =>
                    setEditingNote({
                      ...editingNote,
                      content: e.target.value,
                    })
                  }
                  rows={6}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={editingNote.category}
                  onChange={e =>
                    setEditingNote({
                      ...editingNote,
                      category: e.target.value,
                    })
                  }
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="session">Session</option>
                  <option value="npc">NPC</option>
                  <option value="item">Item</option>
                  <option value="plot">Plot</option>
                </select>
                <button
                  onClick={() =>
                    setEditingNote({
                      ...editingNote,
                      isPinned: !editingNote.isPinned,
                    })
                  }
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    editingNote.isPinned
                      ? 'border-yellow-300 bg-yellow-50 text-yellow-700'
                      : 'border-slate-300 text-slate-500'
                  }`}
                >
                  {editingNote.isPinned ? 'Pinned' : 'Pin'}
                </button>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setEditingNote(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 py-1.5">
        {/* Left: Sidebar toggle + Tools */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => setSidebarOpen(prev => !prev)}
            className={`rounded-md p-2 transition-colors ${
              sidebarOpen
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
            }`}
            title={sidebarOpen ? 'Hide Notes' : 'Show Notes'}
          >
            {sidebarOpen ? (
              <PanelLeftClose size={18} />
            ) : (
              <PanelLeftOpen size={18} />
            )}
          </button>

          <div className="mx-2 h-6 w-px bg-slate-200" />

          {TOOL_DEFS.map(({ name, icon: Icon, label }) => (
            <button
              key={name}
              onClick={() => switchTool(name)}
              className={`rounded-md p-2 transition-colors ${
                activeTool === name
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
              }`}
              title={label}
            >
              <Icon size={18} />
            </button>
          ))}
        </div>

        {/* Center: Undo/Redo */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => getVp()?.undo()}
            disabled={!canUndo}
            className="rounded-md p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
            title="Undo"
          >
            <Undo2 size={18} />
          </button>
          <button
            onClick={() => getVp()?.redo()}
            disabled={!canRedo}
            className="rounded-md p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
            title="Redo"
          >
            <Redo2 size={18} />
          </button>
        </div>

        {/* Right: Zoom + Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              const vp = getVp();
              if (!vp) return;
              vp.camera.setZoom(Math.max(0.1, vp.camera.zoom / 1.25));
              vp.requestRender();
            }}
            className="rounded-md p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            title="Zoom Out"
          >
            <ZoomOut size={16} />
          </button>
          <button
            onClick={() => {
              const vp = getVp();
              if (!vp) return;
              vp.camera.moveTo(0, 0);
              vp.camera.setZoom(1);
              vp.requestRender();
            }}
            className="min-w-[52px] rounded-md px-2 py-1 text-center text-xs font-medium text-slate-600 hover:bg-slate-100"
            title="Reset View"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={() => {
              const vp = getVp();
              if (!vp) return;
              vp.camera.setZoom(Math.min(5, vp.camera.zoom * 1.25));
              vp.requestRender();
            }}
            className="rounded-md p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            title="Zoom In"
          >
            <ZoomIn size={16} />
          </button>

          <div className="mx-2 h-6 w-px bg-slate-200" />

          <span className="text-xs text-slate-400">
            {elementCount} elements
          </span>

          <div className="mx-2 h-6 w-px bg-slate-200" />

          <button
            onClick={() => {
              const vp = getVp();
              if (!vp) return;
              const next = !snapToGrid;
              vp.setSnapToGrid(next);
              setSnapToGrid(next);
              vp.requestRender();
            }}
            className={`rounded-md p-2 transition-colors ${
              snapToGrid
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
            }`}
            title={snapToGrid ? 'Snap to Grid: On' : 'Snap to Grid: Off'}
          >
            <Grid3X3 size={16} />
          </button>

          <div className="mx-2 h-6 w-px bg-slate-200" />

          <button
            onClick={() => setLayersPanelOpen(prev => !prev)}
            className={`rounded-md p-2 transition-colors ${
              layersPanelOpen
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
            }`}
            title={layersPanelOpen ? 'Hide Layers' : 'Show Layers'}
          >
            <Layers size={16} />
          </button>

          <div className="mx-2 h-6 w-px bg-slate-200" />

          <button
            onClick={handleExport}
            className="rounded-md p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            title="Export JSON"
          >
            <Download size={16} />
          </button>
          <button
            onClick={handleImport}
            className="rounded-md p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            title="Import JSON"
          >
            <Upload size={16} />
          </button>
          <button
            onClick={handleClear}
            className="rounded-md p-2 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
            title="Clear Canvas"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Tool Options Bar (contextual) */}
      {(activeTool === 'pencil' ||
        activeTool === 'arrow' ||
        activeTool === 'note' ||
        activeTool === 'text' ||
        activeTool === 'shape') && (
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-1.5">
          {/* Shape kind toggle (shape only) */}
          {activeTool === 'shape' && (
            <>
              <span className="text-xs font-medium text-slate-500">Shape</span>
              <div className="flex items-center gap-0.5 rounded-md border border-slate-200 bg-white p-0.5">
                {(
                  [
                    { value: 'rectangle', label: 'Rectangle' },
                    { value: 'ellipse', label: 'Ellipse' },
                  ] as const
                ).map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setShapeKind(value)}
                    className={`rounded px-2 py-1 text-xs transition-colors ${
                      shapeKind === value
                        ? 'bg-indigo-100 font-semibold text-indigo-700'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="mx-1 h-6 w-px bg-slate-200" />
            </>
          )}

          {/* Color swatches — stroke color for shapes, bg for notes, color for others */}
          <span className="text-xs font-medium text-slate-500">
            {activeTool === 'shape'
              ? 'Stroke'
              : activeTool === 'note'
                ? 'Background'
                : 'Color'}
          </span>
          <div className="flex items-center gap-1">
            {[
              '#334155',
              '#ef4444',
              '#f97316',
              '#eab308',
              '#22c55e',
              '#3b82f6',
              '#8b5cf6',
              '#ec4899',
              '#ffffff',
            ].map(color => {
              const activeColor =
                activeTool === 'shape'
                  ? shapeStrokeColor
                  : activeTool === 'text'
                    ? textColor
                    : activeTool === 'note'
                      ? noteColor
                      : activeTool === 'arrow'
                        ? arrowColor
                        : pencilColor;
              const isActive = activeColor === color;
              return (
                <button
                  key={color}
                  onClick={() => {
                    if (activeTool === 'shape') setShapeStrokeColor(color);
                    else if (activeTool === 'text') setTextColor(color);
                    else if (activeTool === 'pencil') setPencilColor(color);
                    else if (activeTool === 'arrow') setArrowColor(color);
                    else if (activeTool === 'note') setNoteColor(color);
                  }}
                  className={`h-6 w-6 rounded-full border-2 transition-transform ${
                    isActive
                      ? 'scale-110 border-indigo-500'
                      : 'border-slate-300 hover:scale-105'
                  }`}
                  style={{
                    backgroundColor: color,
                    boxShadow:
                      color === '#ffffff' ? 'inset 0 0 0 1px #e2e8f0' : 'none',
                  }}
                  title={color}
                />
              );
            })}
            <label className="relative h-6 w-6 cursor-pointer">
              <input
                type="color"
                value={
                  activeTool === 'shape'
                    ? shapeStrokeColor
                    : activeTool === 'text'
                      ? textColor
                      : activeTool === 'note'
                        ? noteColor
                        : activeTool === 'arrow'
                          ? arrowColor
                          : pencilColor
                }
                onChange={e => {
                  if (activeTool === 'shape')
                    setShapeStrokeColor(e.target.value);
                  else if (activeTool === 'text') setTextColor(e.target.value);
                  else if (activeTool === 'pencil')
                    setPencilColor(e.target.value);
                  else if (activeTool === 'arrow')
                    setArrowColor(e.target.value);
                  else if (activeTool === 'note') setNoteColor(e.target.value);
                }}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
              <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-dashed border-slate-300 text-xs text-slate-400 hover:border-slate-400">
                +
              </div>
            </label>
          </div>

          {/* Note text color */}
          {activeTool === 'note' && (
            <>
              <div className="mx-1 h-6 w-px bg-slate-200" />
              <span className="text-xs font-medium text-slate-500">Text</span>
              <div className="flex items-center gap-1">
                {[
                  '#334155',
                  '#1e293b',
                  '#ef4444',
                  '#16a34a',
                  '#2563eb',
                  '#7c3aed',
                  '#ffffff',
                ].map(color => (
                  <button
                    key={color}
                    onClick={() => setNoteTextColor(color)}
                    className={`h-6 w-6 rounded-full border-2 transition-transform ${
                      noteTextColor === color
                        ? 'scale-110 border-indigo-500'
                        : 'border-slate-300 hover:scale-105'
                    }`}
                    style={{
                      backgroundColor: color,
                      boxShadow:
                        color === '#ffffff'
                          ? 'inset 0 0 0 1px #e2e8f0'
                          : 'none',
                    }}
                    title={color}
                  />
                ))}
                <label className="relative h-6 w-6 cursor-pointer">
                  <input
                    type="color"
                    value={noteTextColor}
                    onChange={e => setNoteTextColor(e.target.value)}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                  <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-dashed border-slate-300 text-xs text-slate-400 hover:border-slate-400">
                    +
                  </div>
                </label>
              </div>
            </>
          )}

          {/* Shape fill color */}
          {activeTool === 'shape' && (
            <>
              <div className="mx-1 h-6 w-px bg-slate-200" />
              <span className="text-xs font-medium text-slate-500">Fill</span>
              <div className="flex items-center gap-1">
                {/* No fill option */}
                <button
                  onClick={() => setShapeFillColor('transparent')}
                  className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-transform ${
                    shapeFillColor === 'transparent'
                      ? 'scale-110 border-indigo-500'
                      : 'border-slate-300 hover:scale-105'
                  }`}
                  title="No fill"
                >
                  <X size={10} className="text-slate-400" />
                </button>
                {[
                  '#334155',
                  '#fecaca',
                  '#fed7aa',
                  '#fef08a',
                  '#bbf7d0',
                  '#bfdbfe',
                  '#ddd6fe',
                  '#fbcfe8',
                  '#ffffff',
                ].map(color => (
                  <button
                    key={color}
                    onClick={() => setShapeFillColor(color)}
                    className={`h-6 w-6 rounded-full border-2 transition-transform ${
                      shapeFillColor === color
                        ? 'scale-110 border-indigo-500'
                        : 'border-slate-300 hover:scale-105'
                    }`}
                    style={{
                      backgroundColor: color,
                      boxShadow:
                        color === '#ffffff'
                          ? 'inset 0 0 0 1px #e2e8f0'
                          : 'none',
                    }}
                    title={color}
                  />
                ))}
                <label className="relative h-6 w-6 cursor-pointer">
                  <input
                    type="color"
                    value={
                      shapeFillColor === 'transparent'
                        ? '#ffffff'
                        : shapeFillColor
                    }
                    onChange={e => setShapeFillColor(e.target.value)}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  />
                  <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-dashed border-slate-300 text-xs text-slate-400 hover:border-slate-400">
                    +
                  </div>
                </label>
              </div>

              <div className="mx-1 h-6 w-px bg-slate-200" />
              <span className="text-xs font-medium text-slate-500">Width</span>
              <input
                type="range"
                min={1}
                max={12}
                value={shapeStrokeWidth}
                onChange={e => setShapeStrokeWidth(Number(e.target.value))}
                className="h-1.5 w-20 cursor-pointer accent-indigo-600"
              />
              <span className="min-w-[28px] text-xs text-slate-500 tabular-nums">
                {shapeStrokeWidth}px
              </span>
            </>
          )}

          {/* Brush size slider (pencil only) */}
          {activeTool === 'pencil' && (
            <>
              <div className="mx-1 h-6 w-px bg-slate-200" />
              <span className="text-xs font-medium text-slate-500">Size</span>
              <input
                type="range"
                min={1}
                max={20}
                value={pencilWidth}
                onChange={e => setPencilWidth(Number(e.target.value))}
                className="h-1.5 w-28 cursor-pointer accent-indigo-600"
              />
              <span className="min-w-[28px] text-xs text-slate-500 tabular-nums">
                {pencilWidth}px
              </span>
              <div className="flex items-center gap-1">
                {[1, 3, 6, 12].map(size => (
                  <button
                    key={size}
                    onClick={() => setPencilWidth(size)}
                    className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
                      pencilWidth === size
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                    }`}
                    title={`${size}px`}
                  >
                    <div
                      className="rounded-full bg-current"
                      style={{
                        width: Math.min(size + 2, 14),
                        height: Math.min(size + 2, 14),
                      }}
                    />
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Text tool options: font size + alignment */}
          {activeTool === 'text' && (
            <>
              <div className="mx-1 h-6 w-px bg-slate-200" />
              <span className="text-xs font-medium text-slate-500">Size</span>
              <input
                type="range"
                min={10}
                max={72}
                value={textFontSize}
                onChange={e => setTextFontSize(Number(e.target.value))}
                className="h-1.5 w-24 cursor-pointer accent-indigo-600"
              />
              <span className="min-w-[32px] text-xs text-slate-500 tabular-nums">
                {textFontSize}px
              </span>
              <div className="flex items-center gap-0.5">
                {[12, 16, 24, 36, 48].map(size => (
                  <button
                    key={size}
                    onClick={() => setTextFontSize(size)}
                    className={`rounded-md px-1.5 py-0.5 text-xs transition-colors ${
                      textFontSize === size
                        ? 'bg-indigo-100 font-semibold text-indigo-700'
                        : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>

              <div className="mx-1 h-6 w-px bg-slate-200" />
              <span className="text-xs font-medium text-slate-500">Align</span>
              <div className="flex items-center gap-0.5 rounded-md border border-slate-200 bg-white p-0.5">
                {(
                  [
                    { value: 'left', label: 'Left' },
                    { value: 'center', label: 'Center' },
                    { value: 'right', label: 'Right' },
                  ] as const
                ).map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setTextAlign(value)}
                    className={`rounded px-2 py-1 text-xs transition-colors ${
                      textAlign === value
                        ? 'bg-indigo-100 font-semibold text-indigo-700'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                    }`}
                    title={label}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Main area: Sidebar + Canvas */}
      <div className="flex flex-1 overflow-hidden">
        {/* Notes Sidebar */}
        {sidebarOpen && (
          <div className="flex w-72 shrink-0 flex-col border-r border-slate-200 bg-white">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
              <BookOpen size={16} className="text-indigo-600" />
              <h2 className="text-sm font-semibold text-slate-800">
                Session Notes
              </h2>
              <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                {notes.length}
              </span>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {notes.map(note => {
                const colors =
                  CATEGORY_COLORS[note.category] ?? CATEGORY_COLORS.session;
                return (
                  <button
                    key={note.id}
                    onClick={() => handlePlaceNote(note)}
                    className="group w-full cursor-pointer rounded-lg border border-slate-200 p-3 text-left transition-all hover:border-indigo-200 hover:shadow-md"
                    style={{ backgroundColor: colors.bg + '66' }}
                  >
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <CategoryIcon category={note.category} />
                        <h3 className="text-xs font-semibold text-slate-800">
                          {note.title}
                        </h3>
                      </div>
                      <GripVertical
                        size={14}
                        className="mt-0.5 shrink-0 text-slate-300 group-hover:text-indigo-400"
                      />
                    </div>
                    {note.tags.length > 0 && (
                      <div className="mb-1.5 flex flex-wrap gap-1">
                        {note.tags.slice(0, 2).map(tag => (
                          <span
                            key={tag}
                            className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700"
                          >
                            {tag}
                          </span>
                        ))}
                        {note.tags.length > 2 && (
                          <span className="text-[10px] text-slate-400">
                            +{note.tags.length - 2}
                          </span>
                        )}
                      </div>
                    )}
                    <p className="line-clamp-2 text-[11px] leading-relaxed text-slate-500">
                      {note.excerpt}
                    </p>
                    <span className="mt-2 inline-block text-[10px] font-medium text-indigo-500 opacity-0 transition-opacity group-hover:opacity-100">
                      Click to place on canvas
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Canvas */}
        <Canvas
          ref={canvasRef}
          tools={tools}
          defaultTool="hand"
          options={{
            background: {
              pattern: 'dots',
              color: '#cbd5e1',
              spacing: 24,
              dotRadius: 1,
            },
            camera: { minZoom: 0.1, maxZoom: 5 },
          }}
          onReady={handleReady}
          className="flex-1"
          style={{ minHeight: 0 }}
        >
          {/* React note cards placed on the canvas */}
          {placedNotes.map(placed => {
            const note = getNoteById(placed.noteId);
            if (!note) return null;
            return (
              <CanvasElement
                key={placed.id}
                position={placed.position}
                size={{ w: 280, h: 240 }}
              >
                <NoteCardOnCanvas
                  note={note}
                  onView={setViewingNote}
                  onEdit={n => setEditingNote({ ...n })}
                />
              </CanvasElement>
            );
          })}
        </Canvas>

        {/* Layers Panel */}
        {layersPanelOpen && (
          <div className="flex w-56 shrink-0 flex-col border-l border-slate-200 bg-white">
            <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-3">
              <Layers size={16} className="text-indigo-600" />
              <h2 className="text-sm font-semibold text-slate-800">Layers</h2>
              <button
                onClick={() => {
                  const vp = getVp();
                  if (!vp) return;
                  vp.layerManager.createLayer();
                  vp.requestRender();
                }}
                className="ml-auto rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-indigo-600"
                title="Add Layer"
              >
                <Plus size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {[...layers]
                .sort((a, b) => b.order - a.order)
                .map(layer => {
                  const isActive = layer.id === activeLayerId;
                  return (
                    <div
                      key={layer.id}
                      onClick={() => {
                        const vp = getVp();
                        if (!vp) return;
                        vp.layerManager.setActiveLayer(layer.id);
                      }}
                      className={`group flex items-center gap-1.5 border-b border-slate-50 px-3 py-2 text-sm transition-colors ${
                        isActive
                          ? 'bg-indigo-50 text-indigo-900'
                          : 'cursor-pointer text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {/* Visibility toggle */}
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          const vp = getVp();
                          if (!vp) return;
                          vp.layerManager.setLayerVisible(
                            layer.id,
                            !layer.visible
                          );
                          vp.requestRender();
                        }}
                        className={`rounded p-0.5 ${
                          layer.visible
                            ? 'text-slate-400 hover:text-slate-600'
                            : 'text-slate-300 hover:text-slate-500'
                        }`}
                        title={layer.visible ? 'Hide' : 'Show'}
                      >
                        {layer.visible ? (
                          <Eye size={13} />
                        ) : (
                          <EyeOff size={13} />
                        )}
                      </button>

                      {/* Lock toggle */}
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          const vp = getVp();
                          if (!vp) return;
                          vp.layerManager.setLayerLocked(
                            layer.id,
                            !layer.locked
                          );
                          vp.requestRender();
                        }}
                        className={`rounded p-0.5 ${
                          layer.locked
                            ? 'text-amber-500 hover:text-amber-600'
                            : 'text-slate-300 hover:text-slate-500'
                        }`}
                        title={layer.locked ? 'Unlock' : 'Lock'}
                      >
                        {layer.locked ? (
                          <Lock size={13} />
                        ) : (
                          <Unlock size={13} />
                        )}
                      </button>

                      {/* Layer name (inline rename) */}
                      {renamingLayerId === layer.id ? (
                        <input
                          type="text"
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          onBlur={() => {
                            const vp = getVp();
                            if (vp && renameValue.trim()) {
                              vp.layerManager.renameLayer(
                                layer.id,
                                renameValue.trim()
                              );
                            }
                            setRenamingLayerId(null);
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              (e.target as HTMLInputElement).blur();
                            } else if (e.key === 'Escape') {
                              setRenamingLayerId(null);
                            }
                          }}
                          autoFocus
                          className="min-w-0 flex-1 rounded border border-indigo-300 px-1 py-0.5 text-xs focus:outline-none"
                          onClick={e => e.stopPropagation()}
                        />
                      ) : (
                        <span
                          onDoubleClick={e => {
                            e.stopPropagation();
                            setRenamingLayerId(layer.id);
                            setRenameValue(layer.name);
                          }}
                          className={`min-w-0 flex-1 truncate text-xs ${
                            isActive ? 'font-semibold' : ''
                          } ${!layer.visible ? 'italic opacity-50' : ''}`}
                          title={`${layer.name} (double-click to rename)`}
                        >
                          {layer.name}
                        </span>
                      )}

                      {/* Reorder buttons */}
                      <div className="ml-auto flex opacity-0 group-hover:opacity-100">
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            const vp = getVp();
                            if (!vp) return;
                            vp.layerManager.reorderLayer(
                              layer.id,
                              layer.order + 1
                            );
                            vp.requestRender();
                          }}
                          className="rounded p-0.5 text-slate-400 hover:text-slate-600"
                          title="Move Up"
                        >
                          <ChevronUp size={12} />
                        </button>
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            const vp = getVp();
                            if (!vp) return;
                            vp.layerManager.reorderLayer(
                              layer.id,
                              layer.order - 1
                            );
                            vp.requestRender();
                          }}
                          className="rounded p-0.5 text-slate-400 hover:text-slate-600"
                          title="Move Down"
                        >
                          <ChevronDown size={12} />
                        </button>
                      </div>

                      {/* Delete button (only if more than 1 layer) */}
                      {layers.length > 1 && (
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            const vp = getVp();
                            if (!vp) return;
                            vp.layerManager.removeLayer(layer.id);
                            vp.requestRender();
                          }}
                          className="rounded p-0.5 text-slate-300 opacity-0 group-hover:opacity-100 hover:text-red-500"
                          title="Delete Layer"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
