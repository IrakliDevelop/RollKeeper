# Combat Tracker Design & Implementation

## 🎯 Overview

The Combat Tracker is a card-based combat management system for DMs, designed to provide quick access to essential combat information without the complexity of a full virtual tabletop. The system focuses on initiative tracking, health management, and combat flow rather than tactical positioning.

## 🃏 Card-Based Architecture

### Combat Participant Cards
Each participant (player or monster) is represented by an interactive card containing their most critical combat information:

```typescript
interface CombatParticipantCard {
  id: string;
  type: 'player' | 'monster';
  name: string;
  
  // Core Combat Stats
  armorClass: number;
  tempArmorClass?: number;
  hitPoints: {
    current: number;
    max: number;
    temporary: number;
  };
  
  // Action Economy
  hasReaction: boolean;
  hasBonusAction: boolean;
  hasLegendaryActions?: number; // For monsters
  
  // Character Info
  class?: string; // For players
  level?: number; // For players
  challengeRating?: string; // For monsters
  
  // Initiative
  initiative: number;
  dexterityModifier: number;
  
  // Visual State
  position: { x: number; y: number }; // For card arrangement
  isCurrentTurn: boolean;
  isDead: boolean;
  conditions: ActiveCondition[];
}
```

### Card Layout Design

#### Player Character Card
```typescript
// Player card layout with essential combat info
<PlayerCombatCard>
  <CardHeader>
    <CharacterName>{name}</CharacterName>
    <ClassLevel>{class} {level}</ClassLevel>
    <InitiativeBadge>{initiative}</InitiativeBadge>
  </CardHeader>
  
  <CombatStats>
    <ArmorClassDisplay>
      <BaseAC>{armorClass}</BaseAC>
      {tempArmorClass && <TempAC>+{tempArmorClass}</TempAC>}
    </ArmorClassDisplay>
    
    <HitPointsDisplay>
      <CurrentHP editable>{hitPoints.current}</CurrentHP>
      <MaxHP>/{hitPoints.max}</MaxHP>
      {hitPoints.temporary > 0 && <TempHP>+{hitPoints.temporary}</TempHP>}
      <HPBar percentage={(hitPoints.current / hitPoints.max) * 100} />
    </HitPointsDisplay>
  </CombatStats>
  
  <ActionEconomy>
    <ReactionIndicator used={!hasReaction} />
    <BonusActionIndicator used={!hasBonusAction} />
  </ActionEconomy>
  
  <QuickStats>
    <AbilityModifiers />
    <SavingThrows />
  </QuickStats>
  
  {spellSlots && <SpellSlotIndicators slots={spellSlots} />}
  
  <ConditionIndicators conditions={conditions} />
</PlayerCombatCard>
```

#### Monster Combat Card
```typescript
// Monster card with condensed stats
<MonsterCombatCard>
  <CardHeader>
    <MonsterName>{name}</MonsterName>
    <ChallengeRating>CR {challengeRating}</ChallengeRating>
    <InitiativeBadge>{initiative}</InitiativeBadge>
  </CardHeader>
  
  <CombatStats>
    <ArmorClassDisplay>{armorClass}</ArmorClassDisplay>
    <HitPointsDisplay>
      <CurrentHP editable>{hitPoints.current}</CurrentHP>
      <MaxHP>/{hitPoints.max}</MaxHP>
      <HPBar percentage={(hitPoints.current / hitPoints.max) * 100} />
    </HitPointsDisplay>
  </CombatStats>
  
  <MonsterAbilities>
    <AbilityScores />
    <LegendaryActions count={hasLegendaryActions} />
  </MonsterAbilities>
  
  <ConditionIndicators conditions={conditions} />
</MonsterCombatCard>
```

## 🎲 Initiative & Turn Management

### Initiative Tracker Component
```typescript
interface InitiativeTrackerProps {
  participants: CombatParticipant[];
  currentTurn: number;
  currentRound: number;
  onAdvanceTurn: () => void;
  onRollInitiative: (participantId?: string) => void;
  onReorderInitiative: (newOrder: string[]) => void;
}

export function InitiativeTracker({
  participants,
  currentTurn,
  currentRound,
  onAdvanceTurn,
  onRollInitiative,
  onReorderInitiative
}: InitiativeTrackerProps) {
  const sortedParticipants = [...participants].sort(
    (a, b) => b.initiative - a.initiative
  );

  return (
    <div className="initiative-tracker">
      <div className="round-counter">
        <h3>Round {currentRound}</h3>
        <Button onClick={onAdvanceTurn} size="lg">
          Next Turn
        </Button>
      </div>
      
      <div className="initiative-order">
        {sortedParticipants.map((participant, index) => (
          <InitiativeItem
            key={participant.id}
            participant={participant}
            isCurrentTurn={index === currentTurn}
            position={index + 1}
            onRollInitiative={() => onRollInitiative(participant.id)}
          />
        ))}
      </div>
      
      <div className="initiative-controls">
        <Button onClick={() => onRollInitiative()} variant="outline">
          Reroll All Initiative
        </Button>
      </div>
    </div>
  );
}
```

### Turn Management System
```typescript
// src/utils/dm/turnManager.ts
export class TurnManager {
  static advanceTurn(
    participants: CombatParticipant[], 
    currentTurn: number, 
    currentRound: number
  ): { newTurn: number; newRound: number; updatedParticipants: CombatParticipant[] } {
    
    let nextTurn = currentTurn + 1;
    let nextRound = currentRound;
    
    // Reset current participant's turn-based resources
    const updatedParticipants = participants.map((p, index) => {
      if (index === currentTurn) {
        return {
          ...p,
          hasReaction: false,
          hasBonusAction: false
        };
      }
      return p;
    });
    
    // Check if we've completed the round
    if (nextTurn >= participants.length) {
      nextTurn = 0;
      nextRound++;
      
      // Reset all participants for new round
      updatedParticipants.forEach(p => {
        p.hasReaction = true;
        p.hasBonusAction = true;
        // Process ongoing effects, concentration checks, etc.
        p.conditions = p.conditions.map(condition => ({
          ...condition,
          duration: condition.duration ? condition.duration - 1 : condition.duration
        })).filter(condition => !condition.duration || condition.duration > 0);
      });
    }
    
    return {
      newTurn: nextTurn,
      newRound: nextRound,
      updatedParticipants
    };
  }
  
  static rollInitiative(participant: CombatParticipant): number {
    const roll = Math.floor(Math.random() * 20) + 1;
    return roll + participant.dexterityModifier;
  }
}
```

## 🃏 Combat Canvas Layout

### Card Grid System
```typescript
// src/components/dm/CombatTracker/CombatCanvas.tsx
export function CombatCanvas({
  encounter,
  onUpdateParticipant,
  onAddParticipant,
  onRemoveParticipant
}: CombatCanvasProps) {
  const [cardLayout, setCardLayout] = useState<'grid' | 'initiative'>('initiative');
  
  return (
    <div className="combat-canvas">
      <div className="canvas-toolbar">
        <div className="layout-controls">
          <Button 
            variant={cardLayout === 'initiative' ? 'default' : 'outline'}
            onClick={() => setCardLayout('initiative')}
          >
            Initiative Order
          </Button>
          <Button 
            variant={cardLayout === 'grid' ? 'default' : 'outline'}
            onClick={() => setCardLayout('grid')}
          >
            Free Arrangement
          </Button>
        </div>
        
        <div className="combat-controls">
          <AddParticipantDropdown 
            onAddPlayer={onAddParticipant}
            onAddMonster={onAddParticipant}
          />
          <Button onClick={endCombat} variant="destructive">
            End Combat
          </Button>
        </div>
      </div>
      
      <div className={`participant-cards ${cardLayout}`}>
        {encounter.participants.map((participant, index) => (
          <DraggableCard
            key={participant.id}
            participant={participant}
            isCurrentTurn={index === encounter.currentTurn}
            layout={cardLayout}
            onUpdate={(updates) => onUpdateParticipant(participant.id, updates)}
            onRemove={() => onRemoveParticipant(participant.id)}
          />
        ))}
      </div>
    </div>
  );
}
```

## 🐉 Monster Integration

### Bestiary Integration
```typescript
// src/components/dm/CombatTracker/MonsterSelector.tsx
export function MonsterSelector({
  onAddMonster,
  isOpen,
  onClose
}: MonsterSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredMonsters, setFilteredMonsters] = useState<Monster[]>([]);
  
  // Load monsters from JSON files or bestiary
  const { monsters, loading } = useMonsterDatabase();
  
  useEffect(() => {
    if (!searchTerm) {
      setFilteredMonsters(monsters.slice(0, 20)); // Show first 20
      return;
    }
    
    const filtered = monsters.filter(monster =>
      monster.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      monster.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      monster.challenge_rating.toString().includes(searchTerm)
    );
    
    setFilteredMonsters(filtered.slice(0, 20));
  }, [searchTerm, monsters]);
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Add Monster to Combat</DialogTitle>
        </DialogHeader>
        
        <div className="monster-search">
          <Input
            placeholder="Search monsters by name, type, or CR..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="monster-grid">
          {filteredMonsters.map(monster => (
            <MonsterCard
              key={monster.slug}
              monster={monster}
              onAdd={() => {
                onAddMonster(monster);
                onClose();
              }}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### Monster Card Preview
```typescript
// Quick monster info for selection
function MonsterCard({ monster, onAdd }: { monster: Monster; onAdd: () => void }) {
  return (
    <div className="monster-preview-card">
      <div className="monster-header">
        <h4>{monster.name}</h4>
        <span className="cr-badge">CR {monster.challenge_rating}</span>
      </div>
      
      <div className="monster-stats">
        <div>AC: {monster.armor_class}</div>
        <div>HP: {monster.hit_points}</div>
        <div>Speed: {monster.speed.walk || 30}ft</div>
      </div>
      
      <div className="monster-type">
        {monster.type} • {monster.size}
      </div>
      
      <Button onClick={onAdd} className="add-monster-btn">
        Add to Combat
      </Button>
    </div>
  );
}
```

## 📝 Combat Log System

### Combat Log Component
```typescript
interface CombatLogEntry {
  id: string;
  timestamp: Date;
  round: number;
  type: 'damage' | 'healing' | 'condition' | 'death' | 'action' | 'initiative';
  actor: string; // participant name
  target?: string; // target name if applicable
  amount?: number; // damage/healing amount
  description: string;
}

export function CombatLog({
  entries,
  isCollapsed,
  onToggle
}: CombatLogProps) {
  const groupedEntries = groupBy(entries, 'round');
  
  return (
    <div className={`combat-log ${isCollapsed ? 'collapsed' : 'expanded'}`}>
      <div className="log-header" onClick={onToggle}>
        <h3>Combat Log</h3>
        <span className="toggle-icon">
          {isCollapsed ? '▲' : '▼'}
        </span>
      </div>
      
      {!isCollapsed && (
        <div className="log-entries">
          {Object.entries(groupedEntries).reverse().map(([round, roundEntries]) => (
            <div key={round} className="round-group">
              <div className="round-header">Round {round}</div>
              {roundEntries.map(entry => (
                <CombatLogEntry key={entry.id} entry={entry} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CombatLogEntry({ entry }: { entry: CombatLogEntry }) {
  const getEntryIcon = (type: string) => {
    switch (type) {
      case 'damage': return '⚔️';
      case 'healing': return '💚';
      case 'death': return '💀';
      case 'condition': return '🎭';
      case 'initiative': return '🎲';
      default: return '📝';
    }
  };
  
  return (
    <div className={`log-entry ${entry.type}`}>
      <span className="entry-icon">{getEntryIcon(entry.type)}</span>
      <span className="entry-time">
        {entry.timestamp.toLocaleTimeString()}
      </span>
      <span className="entry-description">{entry.description}</span>
    </div>
  );
}
```

### Combat Action Logging
```typescript
// src/utils/dm/combatLogger.ts
export class CombatLogger {
  static logDamage(
    attacker: string,
    target: string,
    amount: number,
    damageType: string,
    round: number
  ): CombatLogEntry {
    return {
      id: generateId(),
      timestamp: new Date(),
      round,
      type: 'damage',
      actor: attacker,
      target,
      amount,
      description: `${attacker} deals ${amount} ${damageType} damage to ${target}`
    };
  }
  
  static logHealing(
    healer: string,
    target: string,
    amount: number,
    round: number
  ): CombatLogEntry {
    return {
      id: generateId(),
      timestamp: new Date(),
      round,
      type: 'healing',
      actor: healer,
      target,
      amount,
      description: `${healer} heals ${target} for ${amount} hit points`
    };
  }
  
  static logDeath(
    participant: string,
    round: number
  ): CombatLogEntry {
    return {
      id: generateId(),
      timestamp: new Date(),
      round,
      type: 'death',
      actor: participant,
      description: `${participant} has fallen unconscious`
    };
  }
  
  static logCondition(
    participant: string,
    condition: string,
    added: boolean,
    round: number
  ): CombatLogEntry {
    return {
      id: generateId(),
      timestamp: new Date(),
      round,
      type: 'condition',
      actor: participant,
      description: `${participant} is ${added ? 'now' : 'no longer'} ${condition}`
    };
  }
}
```

## 💾 Combat State Management

### Enhanced Combat Store
```typescript
// src/store/combatStore.ts
interface CombatState {
  activeEncounter: Encounter | null;
  combatLog: CombatLogEntry[];
  encounterHistory: Encounter[];
  
  // Actions
  startEncounter: (participants: CombatParticipant[]) => void;
  endEncounter: () => void;
  updateParticipant: (participantId: string, updates: Partial<CombatParticipant>) => void;
  addParticipant: (participant: CombatParticipant) => void;
  removeParticipant: (participantId: string) => void;
  advanceTurn: () => void;
  logAction: (entry: CombatLogEntry) => void;
  
  // Character sync
  syncCharacterChanges: (characterId: string, characterData: CharacterState) => void;
}

export const useCombatStore = create<CombatState>()(
  persist(
    (set, get) => ({
      activeEncounter: null,
      combatLog: [],
      encounterHistory: [],
      
      startEncounter: (participants) => {
        const encounter: Encounter = {
          id: generateId(),
          participants: participants.map(p => ({
            ...p,
            initiative: TurnManager.rollInitiative(p)
          })).sort((a, b) => b.initiative - a.initiative),
          currentTurn: 0,
          currentRound: 1,
          startedAt: new Date(),
          isActive: true
        };
        
        set({ 
          activeEncounter: encounter,
          combatLog: [{
            id: generateId(),
            timestamp: new Date(),
            round: 1,
            type: 'initiative',
            actor: 'DM',
            description: 'Combat has begun! Initiative order set.'
          }]
        });
      },
      
      endEncounter: () => {
        const state = get();
        if (!state.activeEncounter) return;
        
        // Sync final HP values back to character store
        state.activeEncounter.participants
          .filter(p => p.type === 'player')
          .forEach(participant => {
            // Update character HP in DM store
            state.syncCharacterChanges(participant.id, {
              hitPoints: participant.hitPoints
            });
          });
        
        set({
          encounterHistory: [...state.encounterHistory, {
            ...state.activeEncounter,
            endedAt: new Date(),
            isActive: false,
            finalLog: state.combatLog
          }],
          activeEncounter: null,
          combatLog: []
        });
      },
      
      updateParticipant: (participantId, updates) => {
        const state = get();
        if (!state.activeEncounter) return;
        
        const oldParticipant = state.activeEncounter.participants.find(p => p.id === participantId);
        if (!oldParticipant) return;
        
        const updatedParticipants = state.activeEncounter.participants.map(p =>
          p.id === participantId ? { ...p, ...updates } : p
        );
        
        // Log changes
        const newLog = [...state.combatLog];
        if (updates.hitPoints && oldParticipant.hitPoints.current !== updates.hitPoints.current) {
          const hpChange = updates.hitPoints.current - oldParticipant.hitPoints.current;
          if (hpChange < 0) {
            newLog.push(CombatLogger.logDamage(
              'Unknown', 
              oldParticipant.name, 
              Math.abs(hpChange), 
              'untyped',
              state.activeEncounter.currentRound
            ));
          } else if (hpChange > 0) {
            newLog.push(CombatLogger.logHealing(
              'Unknown',
              oldParticipant.name,
              hpChange,
              state.activeEncounter.currentRound
            ));
          }
          
          // Check for death
          if (updates.hitPoints.current <= 0 && oldParticipant.hitPoints.current > 0) {
            newLog.push(CombatLogger.logDeath(
              oldParticipant.name,
              state.activeEncounter.currentRound
            ));
          }
        }
        
        set({
          activeEncounter: {
            ...state.activeEncounter,
            participants: updatedParticipants
          },
          combatLog: newLog
        });
      },
      
      advanceTurn: () => {
        const state = get();
        if (!state.activeEncounter) return;
        
        const { newTurn, newRound, updatedParticipants } = TurnManager.advanceTurn(
          state.activeEncounter.participants,
          state.activeEncounter.currentTurn,
          state.activeEncounter.currentRound
        );
        
        set({
          activeEncounter: {
            ...state.activeEncounter,
            participants: updatedParticipants,
            currentTurn: newTurn,
            currentRound: newRound
          }
        });
      },
      
      syncCharacterChanges: (characterId, characterData) => {
        // This will be called by websockets in the future
        // For now, update local character data
        const { updatePlayerCharacter } = useDMStore.getState();
        updatePlayerCharacter(characterId, { characterData });
      }
    }),
    {
      name: 'combat-store',
      partialize: (state) => ({
        encounterHistory: state.encounterHistory
      })
    }
  )
);
```

## 🎨 Visual Design Patterns

### Card Styling System
```css
/* Combat participant cards */
.combat-participant-card {
  @apply bg-white rounded-xl shadow-lg border-2 border-gray-200;
  @apply p-4 min-w-[280px] max-w-[320px];
  @apply transition-all duration-200;
}

.combat-participant-card.current-turn {
  @apply border-blue-500 shadow-blue-200 shadow-xl;
  @apply ring-2 ring-blue-300;
}

.combat-participant-card.player {
  @apply border-l-4 border-l-blue-500;
}

.combat-participant-card.monster {
  @apply border-l-4 border-l-red-500;
}

.combat-participant-card.unconscious {
  @apply opacity-60 border-red-300;
}

/* HP Bar styling */
.hp-bar {
  @apply w-full h-2 bg-gray-200 rounded-full overflow-hidden;
}

.hp-bar-fill {
  @apply h-full transition-all duration-300;
}

.hp-bar-fill.healthy { @apply bg-green-500; }
.hp-bar-fill.wounded { @apply bg-yellow-500; }
.hp-bar-fill.critical { @apply bg-red-500; }

/* Initiative badges */
.initiative-badge {
  @apply absolute -top-2 -right-2 w-8 h-8;
  @apply bg-purple-600 text-white rounded-full;
  @apply flex items-center justify-center text-sm font-bold;
  @apply shadow-lg;
}
```

## 🚀 Implementation Progress

### ✅ Phase 1: Core Combat System (COMPLETED)
- ✅ Combat store with persistence (Zustand)
- ✅ Combat participant cards with HP/AC editing
- ✅ Initiative tracking and turn management  
- ✅ Start/End combat functionality
- ✅ Basic layout modes (Initiative Order, Grid)
- ✅ Death saves integration (reusing HitPointTracker)
- ✅ Action economy tracking (reaction/bonus action)

### ✅ Phase 2: Enhanced Combat Features (COMPLETED)
- ✅ Combat log system with round grouping and filtering
- ✅ Add participant modal (players and monsters)
- ✅ Basic monster integration (sample monsters)
- ✅ Combat history preservation
- ✅ Character HP sync on combat end
- ✅ Turn indicators and current turn highlighting

### ⏳ Phase 3: UI & UX Improvements (IN PROGRESS)
- ❌ **Replace basic layout with React Flow canvas** - Current grid layout is functional but limited
- ❌ **Optimize card sizing** - Cards currently take too much vertical space
- ❌ **Full bestiary integration** - Currently using only 3 sample monsters (Goblin, Orc, Owlbear)
- ❌ **Advanced monster search and filtering** - Need proper search through full monster database
- ⏳ Condition tracking system
- ⏳ Spell slot management
- ⏳ Drag & drop positioning for free layout mode

### ⏳ Phase 4: Advanced Features (PLANNED)
- ⏳ Combat settings and configuration options
- ⏳ Encounter templates and presets
- ⏳ Export encounter summaries
- ⏳ Combat statistics and analytics
- ⏳ Advanced turn management (delay actions, ready actions)
- ⏳ Environmental effects tracking

### 🔮 Phase 5: Future Backend Integration (PLANNED)
- ⏳ Websocket integration for real-time updates
- ⏳ Player connection for live HP sync
- ⏳ Advanced combat automation
- ⏳ Integration with virtual dice roller
- ⏳ Multi-DM campaign support

---

## 🎯 Current Status & Next Steps

### ✅ What's Working Now
The combat tracker is **fully functional** for basic D&D combat management:
- **Start Combat**: Creates new encounters with empty participant list
- **Add Participants**: Both campaign players and sample monsters
- **Combat Flow**: Full initiative order, turn advancement, round tracking
- **HP Management**: Direct editing with death save integration
- **Combat Log**: Comprehensive action tracking with filtering
- **End Combat**: Syncs final HP back to character sheets

### 🚧 Key Limitations to Address
1. **Card Layout**: Cards are too large vertically, need more compact design
2. **Monster Database**: Only 3 sample monsters vs. full bestiary (1000+ monsters)
3. **Canvas System**: Basic CSS layout instead of React Flow for proper positioning
4. **Search & Filtering**: Limited monster search capabilities
5. **Mobile Responsiveness**: Cards may not work well on smaller screens

### 🎯 Immediate Next Steps
1. **Implement React Flow Canvas** - Replace basic layout with proper drag/drop positioning
2. **Integrate Full Bestiary** - Connect to existing JSON monster files with search
3. **Optimize Card Sizing** - More compact, efficient card design
4. **Add Condition Tracking** - Status effects and conditions on participant cards
5. **Enhance Monster Search** - Advanced filtering by CR, type, environment, etc.

---

This card-based combat tracker focuses on streamlined combat management while maintaining the flexibility needed for complex D&D encounters. The system prioritizes quick access to essential information over tactical positioning, making it perfect for theater-of-mind combat or hybrid approaches.