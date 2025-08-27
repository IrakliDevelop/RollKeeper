# Extended Character Features System - Requirements Document

## 📋 Overview

This document outlines the requirements for implementing an extended character features system that builds upon the existing "Special Traits" functionality while providing a more robust, categorized, and user-friendly interface for managing character abilities, features, and traits.

## 🎯 Core Concept

Create an expanded, categorized features system that extends beyond the current "Special Traits" section while keeping the existing functionality intact. The new system will provide better organization, enhanced UI/UX, and more detailed feature management capabilities.

## 📊 Current System Analysis

### Existing Special Traits System

**Current Data Structure (TrackableTrait):**
```typescript
interface TrackableTrait {
  id: string;
  name: string;
  description?: string;
  maxUses: number;
  usedUses: number;
  restType: 'short' | 'long';
  source?: string; // Basic string field
  scaleWithProficiency?: boolean;
  proficiencyMultiplier?: number;
  createdAt: string;
  updatedAt: string;
}
```

**Current Features:**
- Add/edit/delete traits
- Track usage (uses remaining)
- Reset on short/long rest
- Basic source field (free text)
- Proficiency scaling support
- Auto-save functionality

**Available Components for Reuse:**
- `TraitTracker` (shared component with full functionality)
- `Modal` (reusable modal system)
- `DragDropList` (existing drag & drop system)
- Rich text editing capabilities
- Auto-save hooks

## 🚀 New Requirements

### 1. Enhanced Data Structure

**New Feature Source Types:**
- `class` - Class features (e.g., Action Surge, Sneak Attack, Rage)
- `race` - Racial features (e.g., Darkvision, Breath Weapon, Stone Cunning)
- `feat` - Feat abilities (e.g., Great Weapon Master, Lucky, Alert)
- `background` - Background features (e.g., Criminal Contact, Guild Membership)
- `magic-item` - Magic item abilities (e.g., Staff of Power, Ring of Protection)
- `other` - Custom/miscellaneous features

**Extended Feature Interface:**
```typescript
interface ExtendedFeature extends TrackableTrait {
  sourceType: 'class' | 'race' | 'feat' | 'background' | 'magic-item' | 'other';
  sourceDetail?: string; // e.g., "Fighter Level 2", "Hill Dwarf", "Winged Boots"
  category?: string; // Custom categorization within source type
  displayOrder: number; // For drag & drop ordering within categories
  isPassive?: boolean; // True for passive abilities (no usage tracking)
}
```

### 2. UI/UX Requirements

#### Layout and Positioning
- **Location**: Between main character stats/skills section and inventory/equipment section
- **Structure**: Collapsible main section with category subsections
- **Visibility**: Prominent but not overwhelming the character sheet

#### Category Organization
The features will be organized into the following categories:

1. **Class Features**
   - Organized by class and level
   - Examples: Action Surge, Sneak Attack, Rage, Spellcasting

2. **Racial Features**
   - Grouped by race/subrace
   - Examples: Darkvision, Breath Weapon, Stone Cunning

3. **Feats**
   - Individual feat abilities
   - Examples: Great Weapon Master, Lucky, Alert

4. **Background Features**
   - Background-specific abilities
   - Examples: Criminal Contact, Guild Membership, Shelter of Faith

5. **Magic Items**
   - Abilities granted by magic items
   - Examples: Staff of Power (spell storage), Ring of Protection (+1 AC/saves)

6. **Other/Custom**
   - Miscellaneous or custom features
   - User-defined abilities

#### Interactive Features

**Drag & Drop Functionality:**
- Reorder features within the same category
- Move features between different categories
- Visual feedback during drag operations
- Smooth animations and transitions

**Feature Cards:**
- Compact display showing:
  - Feature name
  - Source type and detail
  - Usage information (if applicable)
  - Quick action buttons
- Visual indicators for:
  - Used vs. available uses
  - Passive vs. active abilities
  - Rest type for recharge

**Collapsible Interface:**
- Main section can be collapsed/expanded
- Individual categories can be collapsed/expanded
- Remember state across sessions
- Visual indicators for collapsed sections with content

### 3. Modal System

#### Feature Detail Modal
**View Mode:**
- Full feature description (rich text)
- Source information and details
- Usage tracking and limits
- Rest type and recharge information
- Creation and modification timestamps

**Edit Mode:**
- Modify all feature properties
- Source type dropdown with appropriate options
- Rich text description editor
- Usage configuration (max uses, rest type, scaling)
- Source detail specification
- Category assignment

**Interaction Features:**
- Quick use buttons for trackable abilities
- Reset usage functionality
- Delete confirmation dialog
- Save/cancel operations

### 4. Enhanced Functionality

#### Usage Tracking
- Support for passive abilities (no usage limits)
- Flexible rest types (short rest, long rest, custom)
- Proficiency bonus scaling
- Custom recharge mechanics

#### Search and Filtering
- Filter by source type
- Search by feature name or description
- Show only used/unused features
- Quick access to specific categories

#### Import/Export Support
- Export character features for sharing
- Import features from templates or other characters
- Backup and restore functionality

### 5. Migration Strategy

#### Backward Compatibility
- Existing `trackableTraits` automatically convert to `extendedFeatures`
- Default `sourceType` set to `'other'` for existing traits
- No breaking changes to current functionality
- Preserve all existing data and relationships

#### Migration Process
```typescript
// Migration function example
function migrateTraitsToExtendedFeatures(traits: TrackableTrait[]): ExtendedFeature[] {
  return traits.map((trait, index) => ({
    ...trait,
    sourceType: 'other' as const,
    sourceDetail: trait.source || undefined,
    displayOrder: index,
    isPassive: trait.maxUses === 0,
  }));
}
```

#### Dual System Support
- Keep existing "Special Traits" section as compact view
- New extended section as primary feature management
- Gradual migration path for users
- Option to hide legacy section once migrated

### 6. Technical Implementation

#### Component Architecture
```
ExtendedFeaturesSection/
├── ExtendedFeaturesContainer.tsx    // Main container component
├── FeatureCategory.tsx              // Category grouping component
├── FeatureCard.tsx                  // Individual feature display
├── FeatureModal.tsx                 // Detail/edit modal
├── AddFeatureModal.tsx              // Add new feature modal
└── hooks/
    ├── useExtendedFeatures.ts       // Feature management logic
    └── useFeatureCategories.ts      // Category organization logic
```

#### State Management
- Extend existing character store with extended features
- Add actions for feature CRUD operations
- Category management and reordering
- Auto-save integration

#### Type Safety
- Full TypeScript support with strict typing
- Proper interface extensions
- Type guards for source type validation
- Generic components where appropriate

### 7. Integration Points

#### Character Sheet Integration
- Seamless integration into existing character sheet layout
- Responsive design for various screen sizes
- Consistent styling with existing components
- Accessibility compliance

#### Store Integration
- Extend `useCharacterStore` with extended features
- Auto-save functionality for all changes
- Undo/redo support for feature modifications
- Conflict resolution for concurrent edits

#### Export/Import Compatibility
- JSON export includes extended features
- Character sharing includes feature data
- Template system for common feature sets
- Validation for imported feature data

## 🎨 Design Considerations

### Visual Design
- Consistent with existing RollKeeper design system
- Clear visual hierarchy for categories and features
- Intuitive icons for different source types
- Responsive layout for mobile and desktop

### Performance
- Lazy loading for large feature lists
- Efficient rendering with React optimization
- Minimal re-renders during drag operations
- Optimized state updates

### Accessibility
- Keyboard navigation support
- Screen reader compatibility
- High contrast mode support
- Focus management in modals

## 📈 Future Enhancements

### Phase 2 Features
- Feature templates and presets
- Community sharing of feature sets
- Integration with D&D Beyond or other sources
- Advanced search and filtering options

### Phase 3 Features
- Feature dependencies and prerequisites
- Automated feature suggestions based on character build
- Integration with combat tracker for feature usage
- Analytics and usage statistics

## ✅ Success Criteria

1. **Functionality**: All existing trait functionality preserved and enhanced
2. **Usability**: Intuitive interface that improves character management workflow
3. **Performance**: No degradation in character sheet loading or interaction speed
4. **Compatibility**: Seamless migration from existing system without data loss
5. **Extensibility**: Architecture supports future enhancements and feature additions

## 🔄 Implementation Phases

### Phase 1: Core Implementation
1. Create extended data types and interfaces
2. Build core components (FeatureCard, FeatureCategory)
3. Implement basic CRUD operations
4. Add drag & drop functionality

### Phase 2: Advanced Features
1. Enhanced modal system with rich editing
2. Search and filtering capabilities
3. Category management and customization
4. Import/export functionality

### Phase 3: Polish and Enhancement
1. Performance optimizations
2. Advanced accessibility features
3. Mobile responsiveness improvements
4. User experience refinements

---

**Document Version**: 1.0  
**Created**: December 2024  
**Last Updated**: December 2024  
**Status**: Draft - Ready for Implementation
