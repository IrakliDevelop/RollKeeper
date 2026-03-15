'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Editor,
  Tldraw,
  getSnapshot,
  TLEditorSnapshot,
  type TLAssetStore,
} from 'tldraw';
import 'tldraw/tldraw.css';
import { NoteCardShapeUtil, NOTE_CARD_SHAPE_TYPE } from './NoteCardShape';
import {
  useProtoNotesStore,
  initializeSampleNotesIfEmpty,
  type ProtoNote,
} from './notesStore';
import NoteModal from './NoteModal';
import {
  Plus,
  FileText,
  Users,
  Package,
  Map,
  ChevronLeft,
  ChevronRight,
  Pin,
} from 'lucide-react';

const customShapeUtils = [NoteCardShapeUtil];

const STORAGE_KEY = 'tldraw-notes-canvas';

const s3AssetStore: TLAssetStore = {
  async upload(asset, file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('assetId', asset.id);

    const res = await fetch('/api/assets/upload', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Upload failed' }));
      console.error('[tldraw-notes] Asset upload failed:', err);
      throw new Error(err.error || 'Upload failed');
    }

    const { url } = await res.json();
    console.log('[tldraw-notes] Asset uploaded to S3:', url);
    return { src: url };
  },

  resolve(asset) {
    return asset.props.src;
  },
};

function loadSavedSnapshot(): TLEditorSnapshot | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return null;
}

function saveSnapshot(editor: Editor) {
  try {
    const snapshot = getSnapshot(editor.store);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // ignore
  }
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  session: <FileText size={14} className="text-blue-600" />,
  npc: <Users size={14} className="text-green-600" />,
  item: <Package size={14} className="text-purple-600" />,
  plot: <Map size={14} className="text-orange-600" />,
};

export default function TldrawCanvas() {
  const editorRef = useRef<Editor | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [snapshot] = useState<TLEditorSnapshot | null>(() =>
    loadSavedSnapshot()
  );

  const {
    notes,
    hasHydrated,
    hasInitialized,
    initializeStore,
    createNote,
    updateNote,
  } = useProtoNotesStore();

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    noteId: string | null;
    isNewNote: boolean;
  }>({
    isOpen: false,
    noteId: null,
    isNewNote: false,
  });

  useEffect(() => {
    if (hasHydrated && !hasInitialized) {
      initializeStore();
      if (notes.length === 0) {
        initializeSampleNotesIfEmpty();
      }
    }
  }, [hasHydrated, hasInitialized, notes.length, initializeStore]);

  const throttledSave = useCallback((editor: Editor) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveSnapshot(editor);
    }, 500);
  }, []);

  const handleMount = useCallback(
    (editor: Editor) => {
      editorRef.current = editor;
      console.log(
        '[tldraw-notes] Editor mounted, shapes on page:',
        editor.getCurrentPageShapes().length
      );

      editor.store.listen(() => throttledSave(editor), {
        source: 'user',
        scope: 'document',
      });
    },
    [throttledSave]
  );

  const addNoteToCanvas = useCallback((note: ProtoNote) => {
    const editor = editorRef.current;
    if (!editor) return;

    const { x, y } = editor.getViewportScreenCenter();
    const pagePoint = editor.screenToPage({ x, y });

    editor.createShape({
      type: NOTE_CARD_SHAPE_TYPE,
      x: pagePoint.x - 140,
      y: pagePoint.y - 100,
      props: {
        w: 280,
        h: 200,
        noteId: note.id,
        title: note.title,
        excerpt: note.excerpt,
        category: note.category,
        tags: note.tags,
        isPinned: note.isPinned,
      },
    });
  }, []);

  const handleCreateNoteOnCanvas = useCallback(() => {
    const id = createNote({
      title: '',
      content: '',
      category: 'session',
      tags: [],
      isPinned: false,
    });

    setModalState({ isOpen: true, noteId: id, isNewNote: true });
  }, [createNote]);

  const handleModalClose = useCallback(() => {
    const { noteId, isNewNote } = modalState;

    if (isNewNote && noteId) {
      const note = useProtoNotesStore.getState().getNoteById(noteId);
      if (note && note.title) {
        addNoteToCanvas(note);
      }
    } else if (noteId) {
      syncNoteToCanvas(noteId);
    }

    setModalState({ isOpen: false, noteId: null, isNewNote: false });
  }, [modalState, addNoteToCanvas]);

  const syncNoteToCanvas = useCallback((noteId: string) => {
    const editor = editorRef.current;
    if (!editor) return;

    const note = useProtoNotesStore.getState().getNoteById(noteId);
    if (!note) return;

    const allShapes = editor.getCurrentPageShapes();
    const noteShape = allShapes.find(
      s =>
        s.type === NOTE_CARD_SHAPE_TYPE &&
        (s.props as Record<string, unknown>).noteId === noteId
    );

    if (noteShape) {
      editor.updateShape({
        id: noteShape.id,
        type: NOTE_CARD_SHAPE_TYPE,
        props: {
          title: note.title,
          excerpt: note.excerpt,
          category: note.category,
          tags: note.tags,
          isPinned: note.isPinned,
        },
      });
    }
  }, []);

  const handleEditNote = useCallback((noteId: string) => {
    setModalState({ isOpen: true, noteId, isNewNote: false });
  }, []);

  // Track which note is being placed via click-to-place
  const [placingNoteId, setPlacingNoteId] = useState<string | null>(null);

  const handleSidebarNoteClick = useCallback(
    (note: ProtoNote) => {
      if (placingNoteId === note.id) {
        // Clicking same note again cancels placement
        setPlacingNoteId(null);
        return;
      }
      setPlacingNoteId(note.id);
    },
    [placingNoteId]
  );

  const handleSidebarNoteDblClick = useCallback(
    (noteId: string) => {
      setPlacingNoteId(null);
      handleEditNote(noteId);
    },
    [handleEditNote]
  );

  // When a note is in "placing" mode, listen for clicks on the tldraw canvas
  useEffect(() => {
    if (!placingNoteId) return;

    const editor = editorRef.current;
    if (!editor) return;

    const note = useProtoNotesStore.getState().getNoteById(placingNoteId);
    if (!note) {
      setPlacingNoteId(null);
      return;
    }

    const container = document.querySelector('.tl-container');
    if (!container) return;

    const handlePointerDown = (ev: Event) => {
      const e = ev as PointerEvent;
      // Only handle left-click
      if (e.button !== 0) return;

      e.preventDefault();
      e.stopPropagation();

      const pagePoint = editor.screenToPage({ x: e.clientX, y: e.clientY });

      console.log('[tldraw-notes] Placing note at page coords:', pagePoint);

      editor.createShape({
        type: NOTE_CARD_SHAPE_TYPE,
        x: pagePoint.x - 140,
        y: pagePoint.y - 100,
        props: {
          w: 280,
          h: 200,
          noteId: note.id,
          title: note.title,
          excerpt: note.excerpt,
          category: note.category,
          tags: note.tags,
          isPinned: note.isPinned,
        },
      });

      console.log('[tldraw-notes] Shape created for note:', note.title);
      setPlacingNoteId(null);
    };

    container.addEventListener('pointerdown', handlePointerDown, {
      capture: true,
    });

    return () => {
      container.removeEventListener('pointerdown', handlePointerDown, {
        capture: true,
      });
    };
  }, [placingNoteId]);

  return (
    <div className="flex h-full w-full">
      {/* Notes Sidebar */}
      <div
        className={`relative flex flex-col border-r border-gray-200 bg-white transition-all duration-300 ${
          sidebarOpen ? 'w-80' : 'w-0'
        }`}
      >
        {sidebarOpen && (
          <>
            {/* Sidebar Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <h2 className="text-sm font-semibold text-gray-800">
                Notes ({notes.length})
              </h2>
              <button
                onClick={handleCreateNoteOnCanvas}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
              >
                <Plus size={12} />
                New
              </button>
            </div>

            {/* Sidebar Notes List */}
            <div className="flex-1 overflow-y-auto p-3">
              <p className="mb-3 text-xs text-gray-500">
                Click a note, then click on the canvas to place it. Double-click
                to edit.
              </p>
              {placingNoteId && (
                <div className="mb-3 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs text-blue-700">
                  Click on the canvas to place the note. Click the note again to
                  cancel.
                </div>
              )}
              <div className="space-y-2">
                {notes.map(note => (
                  <div
                    key={note.id}
                    onClick={() => handleSidebarNoteClick(note)}
                    onDoubleClick={() => handleSidebarNoteDblClick(note.id)}
                    className={`cursor-pointer rounded-lg border p-3 shadow-sm transition-all hover:shadow-md ${
                      placingNoteId === note.id
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-300'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="mb-1 flex items-center gap-2">
                      {CATEGORY_ICONS[note.category] ?? CATEGORY_ICONS.session}
                      <span className="flex-1 truncate text-sm font-medium text-gray-900">
                        {note.title || 'Untitled'}
                      </span>
                      {note.isPinned && (
                        <Pin size={10} className="text-yellow-600" />
                      )}
                    </div>
                    <p className="line-clamp-2 text-xs text-gray-500">
                      {note.excerpt || 'Empty note...'}
                    </p>
                    {note.tags.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {note.tags.slice(0, 2).map(tag => (
                          <span
                            key={tag}
                            className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700"
                          >
                            {tag}
                          </span>
                        ))}
                        {note.tags.length > 2 && (
                          <span className="text-[10px] text-gray-400">
                            +{note.tags.length - 2}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Sidebar Toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute top-3 -right-8 z-20 flex h-8 w-8 items-center justify-center rounded-r-lg border border-l-0 border-gray-200 bg-white text-gray-500 shadow-sm hover:bg-gray-50"
        >
          {sidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>

      {/* tldraw Canvas */}
      <div
        className={`relative flex-1 ${placingNoteId ? 'cursor-crosshair' : ''}`}
      >
        <Tldraw
          licenseKey={process.env.TLDRAW_LICENSE_KEY}
          shapeUtils={customShapeUtils}
          snapshot={snapshot ?? undefined}
          onMount={handleMount}
          assets={s3AssetStore}
          options={{
            maxPages: 1,
          }}
        />
      </div>

      {/* Note Edit Modal */}
      <NoteModal
        isOpen={modalState.isOpen}
        noteId={modalState.noteId}
        onClose={handleModalClose}
        isNewNote={modalState.isNewNote}
      />
    </div>
  );
}
