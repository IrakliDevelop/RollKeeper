# Component Design & Refactoring Guide

## 🧩 Component Architecture Philosophy

The DM Toolset follows a component design philosophy focused on reusability, composability, and non-breaking integration with existing functionality. This guide outlines how to extract and design components for both player and DM use.

## 🎯 Design Principles

### 1. **Shared Components First**
- Extract common functionality into shared components
- Maintain existing component APIs for backward compatibility
- Design for both read-only and interactive modes
- Support different display contexts (compact, full, summary)

### 2. **Composition Over Inheritance**
- Build complex UIs from simple, focused components
- Use composition patterns for flexible layouts
- Support different component combinations
- Enable feature toggles and conditional rendering

### 3. **Data Agnostic Design**
- Components receive data via props, not direct store access
- Support both character and monster data where applicable
- Abstract data transformations into utility functions
- Enable testing with mock data

### 4. **Progressive Enhancement**
- Basic functionality works without DM features
- Enhanced features layer on top of existing functionality
- Graceful degradation when features are disabled
- Support for different user permission levels

## 🔄 Component Refactoring Strategy

### Phase 1: Non-Breaking Extraction

The goal is to extract reusable components without changing any existing functionality.

#### Before (Current Structure)
```typescript
// src/components/ui/HitPointManager.tsx
export default function HitPointManager() {
  const { character, updateHitPoints, applyDamage } = useCharacterStore();
  
  return (
    <div className="hit-point-manager">
      <div className="current-hp">
        <input 
          value={character.hitPoints.current}
          onChange={(e) => updateHitPoints({ current: parseInt(e.target.value) })}
        />
        <span>/ {character.hitPoints.max}</span>
      </div>
      <button onClick={() => applyDamage(1)}>Take Damage</button>
      {/* More complex implementation */}
    </div>
  );
}
```

#### After (Extracted Structure)
```typescript
// src/components/shared/combat/HitPointTracker.tsx
interface HitPointTrackerProps {
  hitPoints: HitPoints;
  onUpdate?: (updates: Partial<HitPoints>) => void;
  onDamage?: (amount: number) => void;
  onHeal?: (amount: number) => void;
  readonly?: boolean;
  compact?: boolean;
  showControls?: boolean;
  className?: string;
}

export function HitPointTracker({
  hitPoints,
  onUpdate,
  onDamage,
  onHeal,
  readonly = false,
  compact = false,
  showControls = true,
  className
}: HitPointTrackerProps) {
  // Pure component implementation
  return (
    <div className={cn("hit-point-tracker", className, { compact })}>
      <div className="hp-display">
        {readonly ? (
          <span>{hitPoints.current} / {hitPoints.max}</span>
        ) : (
          <input 
            value={hitPoints.current}
            onChange={(e) => onUpdate?.({ current: parseInt(e.target.value) })}
          />
        )}
      </div>
      {showControls && !readonly && (
        <div className="hp-controls">
          <button onClick={() => onDamage?.(1)}>Damage</button>
          <button onClick={() => onHeal?.(1)}>Heal</button>
        </div>
      )}
    </div>
  );
}

// src/components/ui/HitPointManager.tsx (Updated, Non-Breaking)
export default function HitPointManager() {
  const { character, updateHitPoints, applyDamageToCharacter, applyHealingToCharacter } = useCharacterStore();
  
  return (
    <HitPointTracker
      hitPoints={character.hitPoints}
      onUpdate={updateHitPoints}
      onDamage={applyDamageToCharacter}
      onHeal={applyHealingToCharacter}
      readonly={false}
      showControls={true}
    />
  );
}
```

### Phase 2: Enhanced DM Components

Build DM-specific components that use the shared components as building blocks.

```typescript
// src/components/dm/CombatTracker/CombatParticipantCard.tsx
interface CombatParticipantCardProps {
  participant: CombatParticipant;
  isCurrentTurn?: boolean;
  onUpdateStats?: (stats: Partial<CombatStats>) => void;
  onAddCondition?: (condition: ActiveCondition) => void;
  compact?: boolean;
}

export function CombatParticipantCard({
  participant,
  isCurrentTurn = false,
  onUpdateStats,
  onAddCondition,
  compact = false
}: CombatParticipantCardProps) {
  const hitPoints = {
    current: participant.combatStats.currentHP,
    max: participant.combatStats.maxHP,
    temporary: participant.combatStats.tempHP
  };

  return (
    <div className={cn("combat-participant-card", { 
      "current-turn": isCurrentTurn,
      compact 
    })}>
      <CharacterHeader 
        name={participant.name}
        level={participant.characterReference?.level}
        className={participant.type}
        compact={compact}
      />
      
      <HitPointTracker
        hitPoints={hitPoints}
        onUpdate={(updates) => onUpdateStats?.({
          currentHP: updates.current,
          maxHP: updates.max,
          tempHP: updates.temporary
        })}
        compact={compact}
        readonly={false}
      />
      
      <InitiativeDisplay
        initiative={participant.initiative}
        hasActed={participant.hasActed}
        compact={compact}
      />
      
      {!compact && (
        <>
          <ConditionList
            conditions={participant.conditions}
            onAdd={onAddCondition}
            editable={true}
          />
          
          <SpellSlotDisplay
            spellSlots={participant.combatStats.spellSlots}
            compact={true}
            readonly={false}
          />
        </>
      )}
    </div>
  );
}
```

## 📚 Shared Component Library

### Character Display Components

#### CharacterHeader
```typescript
interface CharacterHeaderProps {
  name: string;
  level?: number;
  className?: string;
  race?: string;
  playerName?: string;
  avatar?: string;
  compact?: boolean;
  showPlayerName?: boolean;
}

export function CharacterHeader({
  name,
  level,
  className,
  race,
  playerName,
  avatar,
  compact = false,
  showPlayerName = false
}: CharacterHeaderProps) {
  return (
    <div className={cn("character-header", { compact })}>
      {avatar && (
        <img src={avatar} alt={name} className="character-avatar" />
      )}
      <div className="character-info">
        <h3 className="character-name">{name}</h3>
        {!compact && (
          <div className="character-details">
            {level && className && (
              <span className="level-class">Level {level} {className}</span>
            )}
            {race && <span className="race">{race}</span>}
            {showPlayerName && playerName && (
              <span className="player-name">({playerName})</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

#### AbilityScoreDisplay
```typescript
interface AbilityScoreDisplayProps {
  abilities: CharacterAbilities;
  showModifiers?: boolean;
  compact?: boolean;
  highlightAbilities?: string[];
  onClick?: (ability: string) => void;
}

export function AbilityScoreDisplay({
  abilities,
  showModifiers = true,
  compact = false,
  highlightAbilities = [],
  onClick
}: AbilityScoreDisplayProps) {
  const abilityEntries = Object.entries(abilities);
  
  return (
    <div className={cn("ability-scores", { compact })}>
      {abilityEntries.map(([ability, score]) => (
        <div 
          key={ability}
          className={cn("ability-score", {
            highlighted: highlightAbilities.includes(ability),
            clickable: !!onClick
          })}
          onClick={() => onClick?.(ability)}
        >
          <div className="ability-name">
            {compact ? ABILITY_ABBREVIATIONS[ability] : ABILITY_NAMES[ability]}
          </div>
          <div className="ability-value">{score}</div>
          {showModifiers && (
            <div className="ability-modifier">
              {formatModifier(calculateModifier(score))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

### Combat Components

#### InitiativeDisplay
```typescript
interface InitiativeDisplayProps {
  initiative: number;
  hasActed?: boolean;
  isCurrentTurn?: boolean;
  compact?: boolean;
  showStatus?: boolean;
}

export function InitiativeDisplay({
  initiative,
  hasActed = false,
  isCurrentTurn = false,
  compact = false,
  showStatus = true
}: InitiativeDisplayProps) {
  return (
    <div className={cn("initiative-display", {
      "has-acted": hasActed,
      "current-turn": isCurrentTurn,
      compact
    })}>
      <div className="initiative-value">{initiative}</div>
      {showStatus && !compact && (
        <div className="initiative-status">
          {isCurrentTurn && <Badge variant="primary">Current</Badge>}
          {hasActed && <Badge variant="secondary">Acted</Badge>}
        </div>
      )}
    </div>
  );
}
```

#### ConditionTracker
```typescript
interface ConditionTrackerProps {
  conditions: ActiveCondition[];
  onAdd?: (condition: ActiveCondition) => void;
  onRemove?: (conditionId: string) => void;
  onUpdate?: (conditionId: string, updates: Partial<ActiveCondition>) => void;
  readonly?: boolean;
  compact?: boolean;
  maxDisplay?: number;
}

export function ConditionTracker({
  conditions,
  onAdd,
  onRemove,
  onUpdate,
  readonly = false,
  compact = false,
  maxDisplay
}: ConditionTrackerProps) {
  const displayedConditions = maxDisplay 
    ? conditions.slice(0, maxDisplay)
    : conditions;
  const hiddenCount = maxDisplay && conditions.length > maxDisplay 
    ? conditions.length - maxDisplay 
    : 0;

  return (
    <div className={cn("condition-tracker", { compact, readonly })}>
      <div className="conditions-list">
        {displayedConditions.map(condition => (
          <ConditionBadge
            key={condition.id}
            condition={condition}
            onRemove={readonly ? undefined : () => onRemove?.(condition.id)}
            onUpdate={readonly ? undefined : (updates) => onUpdate?.(condition.id, updates)}
            compact={compact}
          />
        ))}
        {hiddenCount > 0 && (
          <Badge variant="outline" className="hidden-count">
            +{hiddenCount}
          </Badge>
        )}
      </div>
      
      {!readonly && (
        <AddConditionButton
          onAdd={onAdd}
          compact={compact}
        />
      )}
    </div>
  );
}
```

### Resource Management Components

#### SpellSlotTracker
```typescript
interface SpellSlotTrackerProps {
  spellSlots: SpellSlots;
  pactMagic?: PactMagic;
  onUseSlot?: (level: number) => void;
  onRecoverSlot?: (level: number) => void;
  onReset?: () => void;
  readonly?: boolean;
  compact?: boolean;
  showPactMagic?: boolean;
}

export function SpellSlotTracker({
  spellSlots,
  pactMagic,
  onUseSlot,
  onRecoverSlot,
  onReset,
  readonly = false,
  compact = false,
  showPactMagic = true
}: SpellSlotTrackerProps) {
  return (
    <div className={cn("spell-slot-tracker", { compact, readonly })}>
      {Object.entries(spellSlots).map(([level, slots]) => {
        const levelNum = parseInt(level);
        if (slots.max === 0) return null;
        
        return (
          <SpellSlotLevel
            key={level}
            level={levelNum}
            current={slots.current}
            max={slots.max}
            onUse={readonly ? undefined : () => onUseSlot?.(levelNum)}
            onRecover={readonly ? undefined : () => onRecoverSlot?.(levelNum)}
            compact={compact}
          />
        );
      })}
      
      {showPactMagic && pactMagic && (
        <PactMagicSlots
          pactMagic={pactMagic}
          readonly={readonly}
          compact={compact}
        />
      )}
      
      {!readonly && !compact && (
        <Button
          variant="outline"
          size="sm"
          onClick={onReset}
          className="reset-slots"
        >
          Long Rest
        </Button>
      )}
    </div>
  );
}
```

## 🎨 Style System & Theming

### Component Variants
```typescript
// Consistent variant system across components
type ComponentVariant = 'default' | 'compact' | 'summary' | 'detailed';
type ComponentSize = 'sm' | 'md' | 'lg';
type ComponentContext = 'player' | 'dm' | 'combat' | 'summary';

interface BaseComponentProps {
  variant?: ComponentVariant;
  size?: ComponentSize;
  context?: ComponentContext;
  className?: string;
}
```

### Theme Integration
```typescript
// Context-aware styling
const getContextStyles = (context: ComponentContext) => {
  switch (context) {
    case 'player':
      return 'border-blue-200 bg-blue-50';
    case 'dm':
      return 'border-purple-200 bg-purple-50';
    case 'combat':
      return 'border-red-200 bg-red-50';
    case 'summary':
      return 'border-gray-200 bg-gray-50';
    default:
      return 'border-gray-200 bg-white';
  }
};
```

## 🧪 Component Testing Strategy

### Unit Testing
```typescript
// Example test for shared component
describe('HitPointTracker', () => {
  const mockHitPoints: HitPoints = {
    current: 45,
    max: 60,
    temporary: 5
  };

  it('displays hit points correctly', () => {
    render(
      <HitPointTracker 
        hitPoints={mockHitPoints}
        readonly={true}
      />
    );
    
    expect(screen.getByText('45 / 60')).toBeInTheDocument();
  });

  it('calls onUpdate when value changes', () => {
    const mockOnUpdate = jest.fn();
    render(
      <HitPointTracker 
        hitPoints={mockHitPoints}
        onUpdate={mockOnUpdate}
      />
    );
    
    fireEvent.change(screen.getByRole('spinbutton'), {
      target: { value: '50' }
    });
    
    expect(mockOnUpdate).toHaveBeenCalledWith({ current: 50 });
  });

  it('hides controls when readonly', () => {
    render(
      <HitPointTracker 
        hitPoints={mockHitPoints}
        readonly={true}
      />
    );
    
    expect(screen.queryByText('Damage')).not.toBeInTheDocument();
  });
});
```

### Integration Testing
```typescript
// Test component composition
describe('CombatParticipantCard', () => {
  it('integrates shared components correctly', () => {
    const mockParticipant: CombatParticipant = createMockParticipant();
    
    render(
      <CombatParticipantCard
        participant={mockParticipant}
        isCurrentTurn={true}
      />
    );
    
    // Verify all sub-components render
    expect(screen.getByRole('img')).toBeInTheDocument(); // CharacterHeader avatar
    expect(screen.getByText('45 / 60')).toBeInTheDocument(); // HitPointTracker
    expect(screen.getByText('18')).toBeInTheDocument(); // InitiativeDisplay
  });
});
```

## 📋 Migration Checklist

### Component Extraction Process
1. **[ ] Identify Target Component**
   - Choose component with clear boundaries
   - Verify it has reuse potential
   - Check for external dependencies

2. **[ ] Design New Interface**
   - Define props interface
   - Plan for different use cases
   - Consider backward compatibility

3. **[ ] Extract Pure Component**
   - Remove store dependencies
   - Convert to prop-based data
   - Add proper TypeScript types

4. **[ ] Update Original Usage**
   - Wrap new component with store logic
   - Maintain exact same API
   - Test for breaking changes

5. **[ ] Create DM Usage**
   - Build DM-specific wrapper
   - Add DM-only features
   - Test in DM context

6. **[ ] Verify Integration**
   - Test original functionality
   - Test new DM functionality
   - Performance testing
   - Visual regression testing

---

This component design ensures smooth extraction of reusable components while maintaining the existing character sheet functionality and enabling powerful DM tools.
