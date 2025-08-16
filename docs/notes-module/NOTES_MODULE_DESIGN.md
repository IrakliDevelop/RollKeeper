# Advanced Note-Taking Module - Design Document

## 📋 Project Overview

### Current State Analysis
- **Current System**: Basic notes with simple TipTap editor stored in character state
- **Issues Identified**:
  - WYSIWYG editor functionality problems (lists, headers not working properly)
  - Character state becoming too large and complex
  - Limited note organization and categorization
  - No linking between notes
  - No advanced features for meticulous note-keepers

### Vision
Create a comprehensive, dedicated note-taking module that rivals modern note-taking applications while being tailored for D&D sessions and campaign management.

## 🎯 Core Features & Requirements

### 1. Enhanced Note Organization
- **Categories**: Story, NPCs, Locations, Lore, Session Logs, Rules, Combat, Character Development
- **Tags**: Custom tagging system for cross-category organization
- **Favorites/Pinning**: Quick access to important notes
- **Search**: Full-text search across all notes
- **Filters**: Filter by category, tags, date, importance level

### 2. Advanced WYSIWYG Editor
- **Rich Text Features**:
  - Headers (H1-H6)
  - Bold, italic, underline, strikethrough
  - Lists (ordered, unordered, checklist)
  - Tables
  - Code blocks
  - Blockquotes
  - Links (internal and external)
  - Images/attachments
  - Text colors and highlights
- **D&D Specific Features**:
  - Dice roll notation (`1d20+5`)
  - Character/NPC mentions with linking
  - Spell references
  - Location references
  - Quick stat blocks

### 3. Note Linking & Relationships
- **Bidirectional Links**: Link notes to each other with backlink tracking
- **Mention System**: @-mention other notes, NPCs, locations
- **Relationship Types**: Parent/child, related, references, contradicts
- **Link Visualization**: Graph view of note connections

### 4. Canvas/Freeform Layout
- **Infinite Canvas**: Drag and drop notes in 2D space
- **Visual Connections**: Draw lines between related notes
- **Grouping**: Create visual clusters of related notes
- **Zoom & Pan**: Navigate large collections of notes
- **Layouts**: Save different canvas arrangements

### 5. Import/Export & Data Management
- **Separate State Store**: Independent from character data
- **Local Storage**: Automatic persistence
- **Export Options**: JSON, Markdown, PDF
- **Import Sources**: Markdown files, JSON backups
- **Backup & Restore**: Full note database backup/restore

### 6. Session Integration
- **Session Notes**: Special category for session-specific notes
- **Quick Capture**: Rapid note creation during sessions
- **Session Timeline**: Chronological view of session notes
- **Character Integration**: Link notes to specific characters

## 🏗️ Technical Architecture

### State Management
```typescript
// Separate Zustand store for notes
interface NotesStore {
  // Core Data
  notes: Map<string, Note>;
  categories: Category[];
  tags: Tag[];
  
  // View State
  currentView: 'list' | 'canvas' | 'editor';
  selectedNote: string | null;
  searchQuery: string;
  activeFilters: Filter[];
  
  // Canvas State
  canvasLayout: CanvasLayout;
  canvasViewport: Viewport;
  
  // Actions
  createNote: (note: Partial<Note>) => string;
  updateNote: (id: string, updates: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  linkNotes: (fromId: string, toId: string, type: LinkType) => void;
  // ... more actions
}
```

### Enhanced Data Model
```typescript
interface Note {
  id: string;
  title: string;
  content: string; // Rich HTML content
  excerpt: string; // Auto-generated or manual
  
  // Organization
  category: CategoryId;
  tags: TagId[];
  isPinned: boolean;
  importance: 1 | 2 | 3 | 4 | 5;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  lastViewedAt: string;
  wordCount: number;
  
  // Relationships
  linkedNotes: NoteLink[];
  backlinks: NoteLink[];
  mentions: Mention[];
  
  // Canvas Properties
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  color?: string;
  
  // Session Integration
  sessionId?: string;
  characterReferences?: string[];
}

interface NoteLink {
  targetId: string;
  type: 'references' | 'related' | 'parent' | 'child' | 'contradicts';
  label?: string;
  createdAt: string;
}

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  description?: string;
  isDefault: boolean;
}
```

### Technology Stack Recommendations

#### WYSIWYG Editor Options
1. **TipTap v2** (Current + Upgrade)
   - ✅ Already familiar
   - ✅ Excellent TypeScript support
   - ✅ Highly extensible
   - ❌ Need to upgrade and fix current issues

2. **Lexical** (Meta/Facebook)
   - ✅ Modern, performant
   - ✅ Excellent for complex use cases
   - ✅ Great plugin system
   - ❌ Newer, smaller community

3. **Slate.js**
   - ✅ Very flexible
   - ✅ Good for custom features
   - ❌ More complex to implement
   - ❌ Steeper learning curve

**Recommendation**: Upgrade TipTap to v2 with proper configuration and add custom D&D extensions.

#### Canvas/Freeform Layout Options
1. **React Flow**
   - ✅ Purpose-built for node-based UIs
   - ✅ Excellent performance
   - ✅ Good TypeScript support
   - ✅ Built-in zoom, pan, selection

2. **Konva.js + React-Konva**
   - ✅ High performance 2D canvas
   - ✅ Great for complex graphics
   - ❌ More complex for simple layouts

3. **Fabric.js**
   - ✅ Rich canvas library
   - ✅ Good for freeform layouts
   - ❌ React integration requires work

**Recommendation**: React Flow for the canvas view - it's perfect for note cards with connections.

## 🎨 User Interface Design

### Layout Structure
```
┌─────────────────────────────────────────────────────────────┐
│ Header: Notes Module | Search | View Toggle | Settings     │
├─────────────────────────────────────────────────────────────┤
│ Sidebar          │ Main Content Area                        │
│ ├── Categories   │ ┌─────────────────────────────────────┐   │
│ ├── Tags         │ │ List View / Canvas View / Editor   │   │
│ ├── Recent       │ │                                     │   │
│ ├── Favorites    │ │                                     │   │
│ └── Sessions     │ │                                     │   │
│                  │ │                                     │   │
│                  │ └─────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### View Modes

#### 1. List View
- Card-based layout with note previews
- Filtering and sorting options
- Quick actions (pin, tag, delete)
- Search highlighting

#### 2. Canvas View
- Infinite 2D canvas
- Draggable note cards
- Visual connections between notes
- Minimap for navigation
- Grouping and clustering tools

#### 3. Editor View
- Full-screen editing experience
- Split-screen with preview
- Sidebar with note properties
- Quick link insertion
- Auto-save with conflict resolution

### Key UI Components
- `NotesLayout` - Main layout component
- `NotesList` - List view with filtering
- `NotesCanvas` - Canvas view with React Flow
- `NoteEditor` - Enhanced TipTap editor
- `NoteSidebar` - Categories, tags, navigation
- `NoteCard` - Individual note display
- `LinkingPanel` - Note relationship management
- `SearchInterface` - Advanced search UI

## 📱 User Experience Flow

### Primary Workflows

#### 1. Quick Note Creation
1. User clicks "New Note" or uses keyboard shortcut
2. Quick creation modal appears
3. User types title and selects category
4. Note opens in editor for content addition

#### 2. Session Note-Taking
1. User selects "Session Notes" mode
2. Quick capture interface appears
3. Rapid note creation with timestamps
4. Automatic session linking and organization

#### 3. Note Discovery
1. User searches or browses categories
2. List/canvas view shows relevant notes
3. User can see relationships and connections
4. Quick preview without full editor opening

#### 4. Canvas Organization
1. User switches to canvas view
2. Drags notes to organize spatially
3. Creates visual groups and connections
4. Saves canvas layout for future reference

## 🔄 Migration Strategy

### Phase 1: Data Migration
- Create migration script for existing notes
- Convert current `RichTextContent` to new `Note` format
- Preserve all existing content and metadata
- Add default categories and organize existing notes

### Phase 2: Parallel Implementation
- Build new notes module alongside existing system
- Allow users to opt-in to new system
- Provide easy switching between old and new
- Extensive testing with migrated data

### Phase 3: Full Transition
- Make new system default
- Deprecate old notes system
- Remove old code after verification
- User training and documentation

## 📊 Success Metrics

### User Engagement
- Number of notes created per session
- Time spent in notes module
- Use of advanced features (linking, canvas)
- User feedback and satisfaction

### Performance
- Load time for large note collections
- Search response time
- Canvas rendering performance
- Memory usage optimization

### Feature Adoption
- Canvas view usage
- Note linking frequency
- Category and tag utilization
- Export/import usage

## 🚀 Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Set up separate notes store
- [ ] Design and implement new data models
- [ ] Create basic UI layout structure
- [ ] Implement note CRUD operations

### Phase 2: Enhanced Editor (Week 3-4)
- [ ] Upgrade/replace TipTap editor
- [ ] Add D&D-specific extensions
- [ ] Implement auto-save and conflict resolution
- [ ] Add rich text features and formatting

### Phase 3: Organization Features (Week 5-6)
- [ ] Categories and tags system
- [ ] Search and filtering
- [ ] Note relationships and linking
- [ ] Favorites and pinning

### Phase 4: Canvas View (Week 7-8)
- [ ] Implement React Flow canvas
- [ ] Note positioning and layouts
- [ ] Visual connections between notes
- [ ] Canvas navigation and controls

### Phase 5: Advanced Features (Week 9-10)
- [ ] Import/export functionality
- [ ] Session integration
- [ ] Performance optimization
- [ ] Mobile responsiveness

### Phase 6: Migration & Polish (Week 11-12)
- [ ] Data migration tools
- [ ] User testing and feedback
- [ ] Bug fixes and polish
- [ ] Documentation and help system

## 💡 Future Enhancements

### Advanced Features
- **AI-Powered**: Note summarization, content suggestions
- **Collaboration**: Shared notes for party members
- **Templates**: Pre-made note templates for common D&D scenarios
- **Voice Notes**: Audio recording and transcription
- **OCR**: Image-to-text for handwritten notes
- **API Integration**: D&D Beyond, Roll20 integration
- **Advanced Search**: Semantic search, date ranges, complex queries
- **Automation**: Auto-categorization, smart linking suggestions

### Integration Possibilities
- Link to character stats and abilities
- Integration with combat tracker
- Session planning and preparation
- Campaign timeline integration
- NPC relationship mapping

## 🔧 Technical Considerations

### Performance
- Virtualization for large note lists
- Lazy loading of note content
- Efficient search indexing
- Canvas rendering optimization

### Accessibility
- Keyboard navigation
- Screen reader support
- High contrast modes
- Font size customization

### Data Safety
- Automatic backups
- Conflict resolution
- Version history
- Offline support

This design document provides a comprehensive foundation for building a world-class note-taking module that will serve meticulous D&D note-keepers while maintaining the simplicity needed for casual users.
