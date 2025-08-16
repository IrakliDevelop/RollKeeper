import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Simple note interface for prototype
export interface ProtoNote {
  id: string;
  title: string;
  content: string;
  excerpt: string;
  category: string;
  tags: string[];
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  // Canvas properties
  position?: { x: number; y: number };
  size?: { width: number; height: number };
}

export interface NoteConnection {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string;
  type: 'reference' | 'related' | 'conflict' | 'child' | 'parent';
  createdAt: string;
}

export interface ProtoNotesStore {
  // Data
  notes: ProtoNote[];
  connections: NoteConnection[];
  hasInitialized: boolean; // Track if we've initialized with data
  hasHydrated: boolean; // Track if store has been rehydrated from localStorage
  
  // Actions
  createNote: (note: Omit<ProtoNote, 'id' | 'createdAt' | 'updatedAt' | 'excerpt'>) => string;
  updateNote: (id: string, updates: Partial<ProtoNote>) => void;
  deleteNote: (id: string) => void;
  getNoteById: (id: string) => ProtoNote | undefined;
  
  // Connection actions
  createConnection: (sourceId: string, targetId: string, type?: NoteConnection['type'], label?: string) => string;
  deleteConnection: (connectionId: string) => void;
  getConnectionsForNote: (noteId: string) => NoteConnection[];
  getConnectedNotes: (noteId: string) => ProtoNote[];
  
  // Canvas actions
  updateNotePosition: (id: string, position: { x: number; y: number }) => void;
  updateNoteSize: (id: string, size: { width: number; height: number }) => void;
  
  // Tag utilities
  getAllTags: () => string[];
  getPopularTags: () => string[];
  
  // Utility
  clearAllNotes: () => void;
  initializeStore: () => void;
}

// Helper to generate excerpt from HTML content
const generateExcerpt = (htmlContent: string, maxLength: number = 150): string => {
  // Remove HTML tags and get plain text
  const textContent = htmlContent.replace(/<[^>]*>/g, '');
  if (textContent.length <= maxLength) {
    return textContent;
  }
  return textContent.substring(0, maxLength).trim() + '...';
};

// Helper to generate ID
const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

export const useProtoNotesStore = create<ProtoNotesStore>()(
  persist(
    (set, get) => ({
      notes: [],
      connections: [],
      hasInitialized: false,
      hasHydrated: false,

      createNote: (noteData) => {
        const id = generateId();
        const now = new Date().toISOString();
        const excerpt = generateExcerpt(noteData.content);
        
        const newNote: ProtoNote = {
          ...noteData,
          id,
          excerpt,
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          notes: [...state.notes, newNote],
        }));

        return id;
      },

      updateNote: (id, updates) => {
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === id
              ? {
                  ...note,
                  ...updates,
                  excerpt: updates.content ? generateExcerpt(updates.content) : note.excerpt,
                  updatedAt: new Date().toISOString(),
                }
              : note
          ),
        }));
      },

      deleteNote: (id) => {
        set((state) => ({
          notes: state.notes.filter((note) => note.id !== id),
        }));
      },

      getNoteById: (id) => {
        return get().notes.find((note) => note.id === id);
      },

      updateNotePosition: (id, position) => {
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === id ? { ...note, position } : note
          ),
        }));
      },

      updateNoteSize: (id, size) => {
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === id ? { ...note, size } : note
          ),
        }));
      },

      // Connection actions
      createConnection: (sourceId, targetId, type = 'related', label) => {
        const connectionId = generateId();
        const now = new Date().toISOString();
        
        set((state) => ({
          connections: [...state.connections, {
            id: connectionId,
            sourceId,
            targetId,
            type,
            label,
            createdAt: now,
          }],
        }));
        
        return connectionId;
      },

      deleteConnection: (connectionId) => {
        set((state) => ({
          connections: state.connections.filter(conn => conn.id !== connectionId),
        }));
      },

      getConnectionsForNote: (noteId) => {
        const { connections } = get();
        return connections.filter(conn => 
          conn.sourceId === noteId || conn.targetId === noteId
        );
      },

      getConnectedNotes: (noteId) => {
        const { connections, notes } = get();
        const connectedIds = new Set<string>();
        
        connections.forEach(conn => {
          if (conn.sourceId === noteId) {
            connectedIds.add(conn.targetId);
          } else if (conn.targetId === noteId) {
            connectedIds.add(conn.sourceId);
          }
        });
        
        return notes.filter(note => connectedIds.has(note.id));
      },

      getAllTags: () => {
        const allTags = get().notes.flatMap(note => note.tags);
        return Array.from(new Set(allTags)).sort();
      },

      getPopularTags: () => {
        const tagCounts = get().notes
          .flatMap(note => note.tags)
          .reduce((counts, tag) => {
            counts[tag] = (counts[tag] || 0) + 1;
            return counts;
          }, {} as Record<string, number>);

        return Object.entries(tagCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 12)
          .map(([tag]) => tag);
      },

      clearAllNotes: () => {
        set({ notes: [], connections: [] });
      },

      initializeStore: () => {
        set({ hasInitialized: true });
      },
    }),
    {
      name: 'proto-notes-storage',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // Handle rehydration
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.hasHydrated = true;
          // Initialize with sample data only if no notes exist after rehydration
          if (state.notes.length === 0 && !state.hasInitialized) {
            // This will be handled by the component after hydration
            state.hasInitialized = false;
          } else {
            state.hasInitialized = true;
          }
        }
      }
    }
  )
);

// Initialize sample notes only if empty (for first-time users)
export const initializeSampleNotesIfEmpty = () => {
  const store = useProtoNotesStore.getState();
  
  // Only create samples if no notes exist
  if (store.notes.length === 0) {
    createSampleNotes();
  }
};

// Sample data for testing
export const createSampleNotes = () => {
  const store = useProtoNotesStore.getState();
  
  // Clear existing notes
  store.clearAllNotes();
  
  // Mark store as initialized
  store.initializeStore();
  
  // Create sample notes
  const sampleNotes = [
    {
      title: "Session 1 - The Goblin Cave",
      content: "<h1>The Adventure Begins</h1><p>Our party discovered a mysterious cave entrance while traveling through the <strong>Whispering Woods</strong>. Strange sounds echoed from within.</p><ul><li>Found goblin tracks leading inside</li><li>Ysara detected magical aura</li><li>Decision to investigate tomorrow</li></ul>",
      category: "session",
      tags: ["goblins", "whispering-woods", "cave"],
      isPinned: true,
    },
    {
      title: "NPC: Thorin Ironbeard",
      content: "<h2>Thorin Ironbeard</h2><p><em>Dwarf Blacksmith, Age 142</em></p><p>A gruff but kind-hearted blacksmith in the village of <strong>Millbrook</strong>. He's been crafting weapons for 80 years and knows every adventurer who's passed through.</p><h3>Key Info:</h3><ul><li>Lost his son to orc raiders 20 years ago</li><li>Offers 20% discount to those who help villagers</li><li>Knows secret passages in the old mine</li></ul>",
      category: "npc",
      tags: ["dwarf", "blacksmith", "millbrook", "ally"],
      isPinned: false,
    },
    {
      title: "Magic Item: Ring of Minor Telepathy",
      content: "<h2>Ring of Minor Telepathy</h2><p><strong>Wondrous item, uncommon (requires attunement)</strong></p><p>While wearing this ring, you can communicate telepathically with any creature within 30 feet of you that shares a language with you.</p><h3>Properties:</h3><ul><li>Range: 30 feet</li><li>Duration: Concentration, up to 10 minutes</li><li>Uses: 3 times per long rest</li></ul><p><em>Found in the goblin shaman's treasure chest.</em></p>",
      category: "item",
      tags: ["magic-item", "ring", "telepathy", "treasure"],
      isPinned: false,
    },
    {
      title: "Campaign Notes: The Shadow Cult",
      content: "<h1>The Shadow Cult Investigation</h1><p>Growing evidence suggests a cult is operating in the region:</p><h2>Evidence Found:</h2><ul><li>Strange symbols carved in trees near Millbrook</li><li>Villagers report nightmares of hooded figures</li><li>Animals found drained of blood with no wounds</li><li>Merchant caravans going missing on the North Road</li></ul><h2>Leads to Follow:</h2><ol><li>Investigate the old temple ruins north of town</li><li>Question the hermit who lives by Crystalfall Lake</li><li>Research shadow magic in the town library</li></ol>",
      category: "plot",
      tags: ["shadow-cult", "investigation", "plot-hook", "mystery"],
      isPinned: true,
    },
  ];

  sampleNotes.forEach((note, index) => {
    const id = store.createNote(note);
    // Add canvas positions for some notes
    if (index < 3) {
      store.updateNotePosition(id, {
        x: 100 + (index * 220),
        y: 100 + (index % 2) * 150,
      });
    }
  });
};
