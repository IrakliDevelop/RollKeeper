# DM Toolset Module - Comprehensive Guide

## 📋 Overview

The DM (Dungeon Master) Toolset is a comprehensive module for RollKeeper that provides campaign management, combat tracking, and player character management tools specifically designed for D&D Dungeon Masters.

### 🎯 Core Objectives
- **Campaign Management**: Create and manage D&D campaigns with persistent data
- **Combat Tracking**: Visual combat tracker with initiative, resources, and positioning
- **Character Import**: Import and manage player characters across campaigns
- **Resource Management**: Track HP, spell slots, abilities, and conditions for all participants
- **Bestiary Integration**: Quick access to monsters for encounters
- **Non-Breaking**: Maintain full compatibility with existing character sheet functionality

## 📁 Documentation Structure

This documentation is organized into the following sections:

### 🏗️ Architecture & Design
- **[Architecture Overview](./ARCHITECTURE.md)** - System design and component relationships
- **[Data Structures](./DATA_STRUCTURES.md)** - TypeScript interfaces and data models
- **[Component Design](./COMPONENT_DESIGN.md)** - Reusable component architecture
- **[Routing Structure](./ROUTING.md)** - URL structure and navigation

### 🔧 Implementation Guides
- **[Component Refactoring](./COMPONENT_REFACTORING.md)** - Extracting reusable components
- **[Combat Tracker](./COMBAT_TRACKER.md)** - Canvas-based combat management
- **[Character Import System](./CHARACTER_IMPORT.md)** - Player character management
- **[Initiative System](./INITIATIVE_SYSTEM.md)** - Turn order and round management

### 🚀 Development Process
- **[Implementation Phases](./IMPLEMENTATION_PHASES.md)** - Step-by-step development plan
- **[Testing Strategy](./TESTING.md)** - Quality assurance approach
- **[Migration Guide](./MIGRATION.md)** - Safely introducing DM features

### 📚 Reference
- **[API Reference](./API_REFERENCE.md)** - Store methods and component props
- **[User Stories](./USER_STORIES.md)** - DM workflows and use cases
- **[Technical Decisions](./TECHNICAL_DECISIONS.md)** - Architecture choices and rationale

## 🎲 Key Features

### Campaign Management
- Create and organize multiple campaigns
- Persistent session data across DM screens
- Campaign notes and world-building tools
- Player character roster management

### Combat Tracker Canvas
- Drag-and-drop combat positioning
- Real-time initiative tracking
- Visual health and status indicators
- Integration with bestiary for quick enemy addition

### Resource Management
- HP/Temp HP tracking for all participants
- Spell slot usage monitoring
- Special ability cooldown tracking
- Condition and effect management

### Character Import & Sharing
- Import player characters from JSON exports
- Sync with local storage character data
- Cross-campaign character availability
- Conflict resolution for character updates

## 🔄 Integration with Existing Systems

### Character Sheet Compatibility
- Zero breaking changes to existing character functionality
- Shared components between player and DM views
- Consistent data models and state management
- Seamless character data synchronization

### Canvas System Reuse
- Builds on existing React Flow notes canvas
- Familiar interaction patterns for users
- Extended functionality for combat scenarios
- Maintained performance and responsiveness

### Bestiary Integration
- Direct integration with existing monster database
- Quick-add functionality for encounters
- Stat block reference during combat
- Search and filter capabilities

## 🛠️ Technology Stack

### Framework & Libraries
- **Next.js 15**: App Router for DM module routing
- **React Flow**: Combat tracker canvas (existing)
- **Zustand**: State management for DM data
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Consistent styling

### Data Persistence
- **LocalStorage**: Campaign and encounter data
- **JSON Export/Import**: Character sharing
- **Zustand Persist**: Automatic state persistence
- **Data Migration**: Backward compatibility

## 🎯 User Experience Goals

### For Dungeon Masters
- **Intuitive Interface**: Familiar patterns from existing character sheet
- **Efficient Workflow**: Quick access to common DM tasks
- **Visual Clarity**: Clear status indicators and combat state
- **Minimal Setup**: Easy campaign creation and character import

### For Players (Continued)
- **Unchanged Experience**: No disruption to character sheet usage
- **Enhanced Sharing**: Easy character export for DM use
- **Cross-Session Continuity**: Character state preservation
- **Collaborative Features**: Future multiplayer enhancements

## 📈 Development Approach

### Phase-Based Implementation
1. **Foundation**: Routing, basic components, campaign structure
2. **Character Management**: Import system, shared character pool
3. **Combat Tracker**: Canvas adaptation, initiative system
4. **Advanced Features**: Resource tracking, automation
5. **Polish & Integration**: Performance, UX refinements

### Quality Assurance
- **Non-Breaking Commitment**: Comprehensive testing of existing features
- **Progressive Enhancement**: New features don't affect old functionality
- **Performance Monitoring**: Canvas and state management optimization
- **User Testing**: DM workflow validation

## 🚀 Getting Started

To begin implementation, follow the [Implementation Phases](./IMPLEMENTATION_PHASES.md) guide, starting with:

1. **[Routing Structure Setup](./ROUTING.md)**
2. **[Component Refactoring](./COMPONENT_REFACTORING.md)**
3. **[Basic Campaign Management](./DATA_STRUCTURES.md)**

---

*This documentation serves as the definitive guide for developing the DM Toolset module. Keep it updated as implementation progresses.*
