'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
} from '@excalidraw/excalidraw/element/types';
import type { AppState, BinaryFiles } from '@excalidraw/excalidraw/types';
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

const STORAGE_KEY = 'excalidraw-notes-canvas';

const CATEGORY_COLORS: Record<string, { bg: string; stroke: string }> = {
  session: { bg: '#dbeafe', stroke: '#2563eb' },
  npc: { bg: '#dcfce7', stroke: '#16a34a' },
  item: { bg: '#f3e8ff', stroke: '#9333ea' },
  plot: { bg: '#ffedd5', stroke: '#ea580c' },
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  session: <FileText size={14} className="text-blue-600" />,
  npc: <Users size={14} className="text-green-600" />,
  item: <Package size={14} className="text-purple-600" />,
  plot: <Map size={14} className="text-orange-600" />,
};

interface SavedCanvasData {
  elements: readonly ExcalidrawElement[];
  appState: Partial<AppState>;
  files: BinaryFiles;
}

function loadSavedData(): SavedCanvasData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return null;
}

function saveData(
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  files: BinaryFiles
) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { collaborators: _collaborators, ...restAppState } = appState;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        elements,
        appState: restAppState,
        files,
      })
    );
  } catch {
    // ignore
  }
}

function generateElementId(): string {
  return Math.random().toString(36).substring(2, 15);
}

export default function ExcalidrawCanvas() {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [initialData] = useState<SavedCanvasData | null>(() => loadSavedData());

  const { notes, hasHydrated, hasInitialized, initializeStore, createNote } =
    useProtoNotesStore();

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

  const throttledSave = useCallback(
    (
      elements: readonly ExcalidrawElement[],
      appState: AppState,
      files: BinaryFiles
    ) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(() => {
        saveData(elements, appState, files);
      }, 500);
    },
    []
  );

  const handleChange = useCallback(
    (
      elements: readonly ExcalidrawElement[],
      appState: AppState,
      files: BinaryFiles
    ) => {
      throttledSave(elements, appState, files);
    },
    [throttledSave]
  );

  const addNoteToCanvas = useCallback(
    (note: ProtoNote, x?: number, y?: number) => {
      const api = apiRef.current;
      if (!api) return;

      const colors = CATEGORY_COLORS[note.category] ?? CATEGORY_COLORS.session;
      const currentElements = api.getSceneElements();

      const posX = x ?? 200;
      const posY = y ?? 200;

      const cardWidth = 280;
      const cardHeight = 160;
      const padding = 16;

      const groupId = generateElementId();
      const rectId = generateElementId();
      const titleId = generateElementId();
      const excerptId = generateElementId();

      const titleText = note.title || 'Untitled';
      const excerptText =
        note.excerpt ||
        note.content?.replace(/<[^>]*>/g, '').slice(0, 100) ||
        '';

      const rect: ExcalidrawElement = {
        id: rectId,
        type: 'rectangle',
        x: posX,
        y: posY,
        width: cardWidth,
        height: cardHeight,
        angle: 0,
        strokeColor: colors.stroke,
        backgroundColor: colors.bg,
        fillStyle: 'solid',
        strokeWidth: 2,
        strokeStyle: 'solid',
        roughness: 1,
        opacity: 100,
        groupIds: [groupId],
        frameId: null,
        index: null as unknown as ExcalidrawElement['index'],
        roundness: { type: 3 },
        seed: Math.floor(Math.random() * 100000),
        version: 1,
        versionNonce: Math.floor(Math.random() * 100000),
        isDeleted: false,
        boundElements: [
          { id: titleId, type: 'text' },
          { id: excerptId, type: 'text' },
        ],
        updated: Date.now(),
        link: null,
        locked: false,
        customData: { noteId: note.id, type: 'note-card' },
      } as unknown as ExcalidrawElement;

      const title: ExcalidrawTextElement = {
        id: titleId,
        type: 'text',
        x: posX + padding,
        y: posY + padding,
        width: cardWidth - padding * 2,
        height: 24,
        angle: 0,
        strokeColor: colors.stroke,
        backgroundColor: 'transparent',
        fillStyle: 'solid',
        strokeWidth: 1,
        strokeStyle: 'solid',
        roughness: 0,
        opacity: 100,
        groupIds: [groupId],
        frameId: null,
        index: null as unknown as ExcalidrawElement['index'],
        roundness: null,
        seed: Math.floor(Math.random() * 100000),
        version: 1,
        versionNonce: Math.floor(Math.random() * 100000),
        isDeleted: false,
        boundElements: null,
        updated: Date.now(),
        link: null,
        locked: false,
        text: titleText,
        fontSize: 18,
        fontFamily: 5,
        textAlign: 'left',
        verticalAlign: 'top',
        containerId: null,
        originalText: titleText,
        autoResize: true,
        lineHeight: 1.25,
        customData: { noteId: note.id, type: 'note-title' },
      } as unknown as ExcalidrawTextElement;

      const excerpt: ExcalidrawTextElement = {
        id: excerptId,
        type: 'text',
        x: posX + padding,
        y: posY + padding + 32,
        width: cardWidth - padding * 2,
        height: cardHeight - padding * 2 - 32,
        angle: 0,
        strokeColor: '#374151',
        backgroundColor: 'transparent',
        fillStyle: 'solid',
        strokeWidth: 1,
        strokeStyle: 'solid',
        roughness: 0,
        opacity: 100,
        groupIds: [groupId],
        frameId: null,
        index: null as unknown as ExcalidrawElement['index'],
        roundness: null,
        seed: Math.floor(Math.random() * 100000),
        version: 1,
        versionNonce: Math.floor(Math.random() * 100000),
        isDeleted: false,
        boundElements: null,
        updated: Date.now(),
        link: null,
        locked: false,
        text: excerptText,
        fontSize: 14,
        fontFamily: 5,
        textAlign: 'left',
        verticalAlign: 'top',
        containerId: null,
        originalText: excerptText,
        autoResize: true,
        lineHeight: 1.25,
        customData: { noteId: note.id, type: 'note-excerpt' },
      } as unknown as ExcalidrawTextElement;

      api.updateScene({
        elements: [...currentElements, rect, title, excerpt],
      });
    },
    []
  );

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

  const syncNoteToCanvas = useCallback((noteId: string) => {
    const api = apiRef.current;
    if (!api) return;

    const note = useProtoNotesStore.getState().getNoteById(noteId);
    if (!note) return;

    const elements = api.getSceneElements();
    const updatedElements = elements.map(el => {
      const custom = (
        el as ExcalidrawElement & { customData?: Record<string, unknown> }
      ).customData;
      if (!custom || custom.noteId !== noteId) return el;

      if (custom.type === 'note-title') {
        return {
          ...el,
          text: note.title || 'Untitled',
          originalText: note.title || 'Untitled',
          version: el.version + 1,
        };
      }
      if (custom.type === 'note-excerpt') {
        const text =
          note.excerpt ||
          note.content?.replace(/<[^>]*>/g, '').slice(0, 100) ||
          '';
        return {
          ...el,
          text,
          originalText: text,
          version: el.version + 1,
        };
      }
      if (custom.type === 'note-card') {
        const categoryColors =
          CATEGORY_COLORS[note.category] ?? CATEGORY_COLORS.session;
        return {
          ...el,
          strokeColor: categoryColors.stroke,
          backgroundColor: categoryColors.bg,
          version: el.version + 1,
        };
      }
      return el;
    });

    api.updateScene({ elements: updatedElements });
  }, []);

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
  }, [modalState, addNoteToCanvas, syncNoteToCanvas]);

  const handleEditNote = useCallback((noteId: string) => {
    setModalState({ isOpen: true, noteId, isNewNote: false });
  }, []);

  const [placingNoteId, setPlacingNoteId] = useState<string | null>(null);

  const handleSidebarNoteClick = useCallback(
    (note: ProtoNote) => {
      if (placingNoteId === note.id) {
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

  useEffect(() => {
    if (!placingNoteId) return;

    const note = useProtoNotesStore.getState().getNoteById(placingNoteId);
    if (!note) {
      setPlacingNoteId(null);
      return;
    }

    const container = document.querySelector('.excalidraw');
    if (!container) return;

    const handlePointerDown = (ev: Event) => {
      const e = ev as PointerEvent;
      if (e.button !== 0) return;

      const target = e.target as HTMLElement;
      if (target.closest('.excalidraw-tooltip') || target.closest('.Island')) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      addNoteToCanvas(note, e.clientX - 140, e.clientY - 100);
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
  }, [placingNoteId, addNoteToCanvas]);

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

        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute top-3 -right-8 z-20 flex h-8 w-8 items-center justify-center rounded-r-lg border border-l-0 border-gray-200 bg-white text-gray-500 shadow-sm hover:bg-gray-50"
        >
          {sidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>

      {/* Excalidraw Canvas */}
      <div
        className={`relative flex-1 ${placingNoteId ? 'cursor-crosshair' : ''}`}
      >
        <Excalidraw
          excalidrawAPI={api => {
            apiRef.current = api;
          }}
          initialData={
            initialData
              ? {
                  elements: initialData.elements as ExcalidrawElement[],
                  appState: initialData.appState,
                  files: initialData.files,
                }
              : undefined
          }
          onChange={handleChange}
          autoFocus
          name="RollKeeper Notes"
        />
      </div>

      <NoteModal
        isOpen={modalState.isOpen}
        noteId={modalState.noteId}
        onClose={handleModalClose}
        isNewNote={modalState.isNewNote}
      />
    </div>
  );
}
