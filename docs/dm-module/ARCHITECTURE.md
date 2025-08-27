# DM Toolset Architecture

## 🏗️ System Architecture Overview

The DM Toolset is designed as a modular extension to RollKeeper that reuses existing infrastructure while providing DM-specific functionality. The architecture prioritizes non-breaking integration and component reusability.

```mermaid
graph TB
    subgraph "Existing System"
        CS[Character Sheet]
        CHR[Character Store]
        BST[Bestiary]
        CNV[Notes Canvas]
    end
    
    subgraph "DM Module"
        DM[DM Dashboard]
        CAM[Campaign Manager]
        CT[Combat Tracker]
        CI[Character Import]
        IT[Initiative Tracker]
        RT[Resource Tracker]
    end
    
    subgraph "Shared Components"
        SCC[Character Components]
        SCS[Stats Components]
        SCA[Ability Components]
        SCR[Resource Components]
    end
    
    subgraph "Data Layer"
        DMS[DM Store]
        CAMS[Campaign Store]
        COMS[Combat Store]
        LS[LocalStorage]
    end
    
    CS --> SCC
    DM --> SCC
    CT --> CNV
    CI --> CHR
    CT --> BST
    
    DM --> DMS
    CAM --> CAMS
    CT --> COMS
    
    DMS --> LS
    CAMS --> LS
    COMS --> LS
```

## 🎯 Core Design Principles

### 1. Non-Breaking Integration
- **Zero Impact**: Existing character sheet functionality remains unchanged
- **Additive Architecture**: New features extend rather than modify existing code
- **Shared Components**: Reuse existing UI components through extraction
- **Data Compatibility**: Maintain existing data formats and storage patterns

### 2. Modular Design
- **Separation of Concerns**: DM functionality isolated in dedicated modules
- **Composable Components**: Small, focused components that can be combined
- **State Isolation**: DM state management separate from character state
- **Feature Toggles**: Ability to enable/disable DM features independently

### 3. Reusability
- **Component Extraction**: Convert existing components to reusable shared components
- **Data Model Consistency**: Use same character data structures in both contexts
- **Style Inheritance**: Maintain visual consistency across player and DM views
- **Interaction Patterns**: Familiar UI patterns from existing character sheet

## 📁 Directory Structure

```
src/
├── app/
│   ├── dm/                          # DM Module Routes
│   │   ├── page.tsx                 # ✅ DM Dashboard
│   │   ├── layout.tsx               # ✅ DM Layout with Navigation
│   │   ├── campaigns/
│   │   │   ├── page.tsx             # ✅ Campaign List
│   │   │   ├── new/
│   │   │   │   └── page.tsx         # ✅ Create Campaign
│   │   │   └── [campaignId]/
│   │   │       ├── page.tsx         # ✅ Campaign Dashboard
│   │   │       ├── characters/
│   │   │       │   ├── page.tsx     # ⏳ Character Management (planned)
│   │   │       │   └── import/
│   │   │       │       └── page.tsx # ⏳ Character Import (planned)
│   │   │       ├── combat/
│   │   │       │   ├── page.tsx     # ⏳ Combat Tracker (planned)
│   │   │       │   └── [encounterId]/
│   │   │       │       └── page.tsx # ⏳ Specific Encounter (planned)
│   │   │       ├── notes/
│   │   │       │   └── page.tsx     # ⏳ Campaign Notes (planned)
│   │   │       └── encounters/
│   │   │           ├── page.tsx     # ⏳ Encounter List (planned)
│   │   │           └── new/
│   │   │               └── page.tsx # ⏳ Create Encounter (planned)
│   │   └── settings/
│   │       ├── page.tsx             # ✅ DM Settings
│   │       ├── automation/          # ✅ Settings subdirectories (structure exists)
│   │       └── export/              # ✅ Settings subdirectories (structure exists)
│   └── [existing routes...]
├── components/
│   ├── dm/                          # ⏳ DM-Specific Components (planned)
│   │   ├── CombatTracker/           # ⏳ Combat components (planned)
│   │   │   ├── CombatCanvas.tsx
│   │   │   ├── CombatParticipant.tsx
│   │   │   ├── TurnTracker.tsx
│   │   │   └── index.ts
│   │   ├── CampaignManager/         # ⏳ Campaign components (planned)
│   │   │   ├── CampaignCard.tsx
│   │   │   ├── CampaignForm.tsx
│   │   │   ├── CampaignDashboard.tsx
│   │   │   └── index.ts
│   │   ├── CharacterManager/        # ⏳ Character management (planned)
│   │   │   ├── CharacterPool.tsx
│   │   │   ├── CharacterImport.tsx
│   │   │   ├── CharacterSync.tsx
│   │   │   └── index.ts
│   │   ├── InitiativeTracker/       # ⏳ Initiative components (planned)
│   │   │   ├── InitiativeList.tsx
│   │   │   ├── InitiativeRoller.tsx
│   │   │   ├── TurnIndicator.tsx
│   │   │   └── index.ts
│   │   ├── ResourceTracker/         # ⏳ Resource tracking (planned)
│   │   │   ├── HPTracker.tsx
│   │   │   ├── SpellSlotTracker.tsx
│   │   │   ├── ConditionTracker.tsx
│   │   │   └── index.ts
│   │   └── Navigation/              # ⏳ DM navigation (planned)
│   │       ├── DMSidebar.tsx
│   │       ├── CampaignNav.tsx
│   │       └── index.ts
│   ├── shared/                      # ✅ Extracted Reusable Components
│   │   ├── character/               # ✅ Character components
│   │   │   ├── CharacterHeader.tsx  # ✅ Implemented
│   │   │   ├── CurrencyManager.tsx  # ✅ Implemented
│   │   │   ├── TraitTracker.tsx     # ✅ Implemented
│   │   │   ├── XPTracker.tsx        # ✅ Implemented
│   │   │   ├── InventoryManager.tsx # ✅ Implemented
│   │   │   ├── HeroicInspirationTracker.tsx # ✅ Implemented
│   │   │   └── index.ts             # ✅ Implemented
│   │   ├── stats/                   # ⏳ Stats components (planned)
│   │   │   ├── AbilityScoreDisplay.tsx
│   │   │   ├── SkillDisplay.tsx
│   │   │   ├── SavingThrowDisplay.tsx
│   │   │   └── index.ts
│   │   ├── combat/                  # ✅ Combat directory exists
│   │   │   └── index.ts             # ⏳ Combat components (planned)
│   │   ├── spells/                  # ✅ Spells directory exists
│   │   │   └── index.ts             # ⏳ Spell components (planned)
│   │   └── conditions/              # ✅ Conditions directory exists
│   │       └── index.ts             # ⏳ Condition components (planned)
│   └── [existing components...]
├── store/
│   ├── dmStore.ts                   # ✅ Complete DM Module State Implementation
│   └── [existing stores...]        # ⏳ Separate stores not yet needed
├── types/
│   ├── dm.ts                        # ✅ Complete DM-specific types
│   └── [existing types...]         # ✅ Integration with existing types
└── utils/
    ├── dm/                          # ⏳ DM utilities (planned)
    │   ├── campaignUtils.ts
    │   ├── combatUtils.ts
    │   ├── characterImport.ts
    │   └── initiativeUtils.ts
    └── [existing utils...]
```

## 🔄 Component Interaction Flow

### Character Sheet to DM Module
```mermaid
sequenceDiagram
    participant CS as Character Sheet
    participant SC as Shared Components
    participant DM as DM Module
    participant DS as DM Store
    
    CS->>SC: Renders character stats
    DM->>SC: Reuses same components
    SC->>DS: Provides character data
    DS->>DM: Updates DM interface
```

### Combat Tracker Workflow
```mermaid
sequenceDiagram
    participant DM as DM
    participant CT as Combat Tracker
    participant CS as Combat Store
    participant BST as Bestiary
    participant CI as Character Import
    
    DM->>CT: Start encounter
    DM->>CI: Import player characters
    DM->>BST: Add monsters
    CT->>CS: Initialize combat state
    CS->>CT: Update participant data
    CT->>DM: Display combat interface
```

## 🏪 State Management Architecture

### Store Hierarchy
```typescript
// Global State Structure
interface RootState {
  // Existing stores (unchanged)
  character: CharacterStore;
  
  // New DM stores
  dm: DMStore;
  campaigns: CampaignStore;
  combat: CombatStore;
}
```

### Data Flow Patterns

#### 1. Character Data Synchronization
- **Source of Truth**: Player character sheet remains authoritative
- **DM Copy**: DM module maintains cached copies with sync timestamps
- **Conflict Resolution**: Clear precedence rules for data conflicts
- **Real-time Updates**: Optional sync between player and DM views

#### 2. Campaign Persistence
- **LocalStorage**: Campaign data persisted locally
- **Import/Export**: JSON-based campaign sharing
- **Versioning**: Data migration for schema changes
- **Backup**: Automatic backup of campaign data

#### 3. Combat State Management
- **Session-based**: Combat state cleared between encounters
- **Undo/Redo**: Action history for combat decisions
- **Auto-save**: Continuous save of combat progress
- **Recovery**: Restore interrupted combat sessions

## 🔌 Integration Points

### 1. Existing Character Sheet
```typescript
// Extract reusable components without breaking existing usage
// Before: Direct component usage in character sheet
<HitPointManager character={character} />

// After: Shared component used in both contexts
<HitPointTracker 
  hitPoints={character.hitPoints}
  onUpdate={updateHitPoints}
  readonly={false}
/>
```

### 2. Canvas System Reuse
```typescript
// Extend existing notes canvas for combat tracking
interface CombatCanvasProps extends NotesCanvasProps {
  participants: CombatParticipant[];
  onParticipantMove: (id: string, position: Position) => void;
  showGrid?: boolean;
  turnOrder: string[];
}
```

### 3. Bestiary Integration
```typescript
// Direct integration with existing monster data
const addMonsterToCombat = (monster: ProcessedMonster) => {
  const participant: CombatParticipant = {
    id: generateId(),
    type: 'enemy',
    name: monster.name,
    monsterData: monster,
    combatStats: initializeCombatStats(monster),
    // ... other properties
  };
  combatStore.addParticipant(participant);
};
```

## 🎯 Performance Considerations

### 1. Component Optimization
- **Memo Optimization**: Prevent unnecessary re-renders
- **Lazy Loading**: Load DM components only when needed
- **Virtual Scrolling**: Handle large participant lists efficiently
- **Canvas Performance**: Optimize React Flow rendering

### 2. State Management
- **Selective Updates**: Update only changed combat participants
- **Computed Values**: Cache expensive calculations
- **Debounced Saves**: Batch state persistence operations
- **Memory Management**: Clean up unused combat data

### 3. Data Loading
- **Progressive Loading**: Load campaign data incrementally
- **Background Sync**: Sync character data in background
- **Caching Strategy**: Cache frequently accessed data
- **Lazy Imports**: Load character data only when needed

## 🛡️ Error Handling & Recovery

### 1. Data Integrity
- **Validation**: Validate imported character data
- **Schema Migration**: Handle data format changes
- **Fallback Values**: Provide defaults for missing data
- **Corruption Recovery**: Detect and recover from corrupt data

### 2. Combat State Recovery
- **Auto-save**: Continuous backup of combat state
- **Session Recovery**: Restore interrupted sessions
- **Undo System**: Allow reverting combat actions
- **State Validation**: Verify combat state consistency

### 3. Character Sync Issues
- **Conflict Detection**: Identify character data conflicts
- **Resolution UI**: Present conflict resolution options
- **Sync Status**: Show character synchronization state
- **Manual Override**: Allow manual conflict resolution

## 📊 Current Implementation Status

### ✅ Completed Infrastructure
- **Routing System**: Complete Next.js App Router structure with all planned routes
- **State Management**: Full Zustand store with persistence, type-safe operations
- **Type System**: Comprehensive TypeScript interfaces for all DM entities
- **UI Foundation**: Layout, navigation, responsive design patterns
- **Data Models**: Complete data structures for campaigns, characters, combat, sessions

### ✅ Working Features
- **Campaign CRUD**: Create, list, view, and manage campaigns
- **Settings Management**: DM preferences, automation settings
- **Component Extraction**: Several shared components extracted for reuse
- **Data Persistence**: LocalStorage integration with automatic state saving

### ⏳ Architecture Ready (Implementation Needed)
- **Character Import**: All data structures and store methods exist, UI components needed
- **Combat System**: Complete data models and state management, canvas UI needed
- **Resource Tracking**: Store methods implemented, tracking components needed
- **Session Management**: Data structures ready, UI implementation needed

### 🎯 Next Development Priority
1. **Character Import UI** - Leverage existing store methods and data structures
2. **Combat Tracker Canvas** - Build on React Flow integration patterns
3. **Resource Management Components** - Implement HP, spell slot, condition tracking

### 🔧 Technical Debt & TODOs
- Type errors in dmStore.ts (marked with @ts-expect-error)
- Complete component implementations for planned features
- Add comprehensive error handling and validation
- Implement missing utility functions

---

This architecture ensures the DM Toolset integrates seamlessly with RollKeeper while providing powerful campaign management capabilities. **Foundation is complete - ready for feature implementation.**
