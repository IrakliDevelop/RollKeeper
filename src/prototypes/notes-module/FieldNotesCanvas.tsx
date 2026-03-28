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
  type Viewport,
} from '@fieldnotes/core';
import {
  FieldNotesCanvas as Canvas,
  CanvasElement,
  ViewportContext,
  type FieldNotesCanvasRef,
} from '@fieldnotes/react';
import {
  BookOpen,
  GripVertical,
  FileText,
  Users,
  Package,
  Map,
  Pin,
  X,
  Edit3,
  Loader2,
  Eye,
} from 'lucide-react';
import {
  FieldNotesDemoGridControls,
  FieldNotesDemoLayersPanel,
  FieldNotesDemoToolbar,
  FieldNotesDemoToolOptions,
} from './FieldNotesDemoPanels';
import {
  useProtoNotesStore,
  initializeSampleNotesIfEmpty,
  type ProtoNote,
} from './notesStore';

// ─── Constants ───────────────────────────────────────────────

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
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [viewingNote, setViewingNote] = useState<ProtoNote | null>(null);
  const [editingNote, setEditingNote] = useState<ProtoNote | null>(null);
  const [placedNotes, setPlacedNotes] = useState<PlacedNote[]>([]);
  const [layersPanelOpen, setLayersPanelOpen] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
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
    setViewport(vp);

    const autoSave = new AutoSave(vp.store, vp.camera, {
      key: 'fieldnotes-canvas-autosave',
      debounceMs: 1000,
      layerManager: vp.layerManager,
    });
    const saved = autoSave.load();
    if (saved) {
      vp.loadState(saved);
    }
    autoSave.start();
    autoSaveRef.current = autoSave;
  }, []);

  useEffect(() => {
    return () => {
      autoSaveRef.current?.stop();
    };
  }, []);

  const handlePlaceNote = useCallback((note: ProtoNote) => {
    const vp = canvasRef.current?.viewport;
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
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      const vp = canvasRef.current?.viewport;
      if (!file || !vp) return;
      e.target.value = '';

      setImageUploading(true);

      // Upload to S3 first so we store a URL, not base64
      let src: string;
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('assetId', `canvas-${Date.now()}`);
        const res = await fetch('/api/assets/upload', {
          method: 'POST',
          body: formData,
        });
        if (!res.ok) throw new Error('Upload failed');
        const data = await res.json();
        src = data.url;
      } catch {
        // S3 not configured — fall back to base64
        src = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      const img = new window.Image();
      img.crossOrigin = 'anonymous';
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
          src,
          { x: center.x - w / 2, y: center.y - h / 2 },
          { w, h }
        );
        setImageUploading(false);
      };
      img.onerror = () => setImageUploading(false);
      img.src = src;
    },
    []
  );

  const handleClearExtras = useCallback(() => {
    setPlacedNotes([]);
    autoSaveRef.current?.clear();
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
    <ViewportContext.Provider value={viewport}>
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
                  color:
                    CATEGORY_COLORS[viewingNote.category]?.icon ?? '#6b7280',
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
              <h2 className="mb-4 text-lg font-bold text-slate-900">
                Edit Note
              </h2>
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
        {viewport && (
          <>
            <FieldNotesDemoToolbar
              sidebarOpen={sidebarOpen}
              setSidebarOpen={setSidebarOpen}
              layersPanelOpen={layersPanelOpen}
              setLayersPanelOpen={setLayersPanelOpen}
              onPickImageTool={() => fileInputRef.current?.click()}
              onClearExtras={handleClearExtras}
            />
            <FieldNotesDemoToolOptions />
            <FieldNotesDemoGridControls />
          </>
        )}
        {/* Main area: Sidebar + Canvas */} {/* Main area: Sidebar + Canvas */}
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

          {/* Image upload overlay */}
          {imageUploading && (
            <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center">
              <div className="pointer-events-auto flex items-center gap-2 rounded-lg bg-slate-800/80 px-4 py-2.5 text-sm text-white shadow-lg">
                <Loader2 size={16} className="animate-spin" />
                Uploading image…
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

          {layersPanelOpen && viewport && <FieldNotesDemoLayersPanel />}
        </div>
      </div>
    </ViewportContext.Provider>
  );
}
