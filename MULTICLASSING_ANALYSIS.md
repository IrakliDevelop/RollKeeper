# Multiclassing Analysis & Implementation Plan

## Current System Analysis

### Character Data Structure
The current character system is built around a **single-class model**:

```typescript
// Current CharacterState interface
interface CharacterState {
  // Single class information
  class: ClassInfo;
  level: number;
  
  // Class-dependent calculations
  spellSlots: SpellSlots;
  pactMagic?: PactMagic; // Only for warlocks
  hitPoints: HitPoints;
  hitDice: string; // e.g., "1d8"
}

// Current ClassInfo interface
interface ClassInfo {
  name: string;
  isCustom: boolean;
  spellcaster?: 'full' | 'half' | 'third' | 'warlock' | 'none';
  hitDie: number; // d6, d8, d10, d12
}
```

### Key Limitations for Multiclassing

1. **Single Class Storage**: Only one `ClassInfo` object per character
2. **Single Level**: One `level` field for the entire character
3. **Single Hit Die**: One `hitDice` string (e.g., "1d8")
4. **Spell Slot Calculation**: Based on single class progression
5. **Proficiency Calculations**: Assumes single class proficiencies

### Current Spell Slot Calculation
```typescript
// From src/utils/calculations.ts
export function calculateSpellSlots(classInfo: ClassInfo, level: number): SpellSlots {
  // Uses single class progression tables
  switch (classInfo.spellcaster) {
    case 'full': slotsTable = FULL_CASTER_SPELL_SLOTS; break;
    case 'half': slotsTable = HALF_CASTER_SPELL_SLOTS; break;
    case 'third': slotsTable = THIRD_CASTER_SPELL_SLOTS; break;
  }
}
```

### Existing Multiclassing Data
The system already has multiclassing data in class definitions:
```typescript
// From ProcessedClass interface
multiclassing?: {
  requirements: Record<string, number>; // e.g., { str: 13, cha: 13 }
  proficienciesGained: {
    armor?: string[];
    weapons?: string[];
    tools?: string[];
  };
};
```

## D&D 5e Multiclassing Rules

### Core Requirements
1. **Ability Score Prerequisites**: Must meet requirements for BOTH current and new class
2. **Proficiency Bonus**: Based on total character level
3. **Hit Points**: Roll/take average for each class level gained
4. **Hit Dice**: Separate pools for each class
5. **Proficiencies**: Only gain multiclassing proficiencies (limited set)

### Spellcasting Rules
1. **Spell Slots**: Combined caster level calculation
   - Full casters: All levels count
   - Half casters: Levels ÷ 2 (rounded down)
   - Third casters: Levels ÷ 3 (rounded down)
   - Warlocks: Separate pact magic system

2. **Spells Known/Prepared**: Calculated per class individually
3. **Spellcasting Ability**: Each class uses its own ability

### Example Multiclass Spell Slot Calculation
- Fighter 2 / Wizard 3
- Caster Level = 0 (Fighter) + 3 (Wizard) = 3
- Spell Slots = 3rd level full caster progression

## Proposed Implementation Plan

### Phase 1: Data Structure Changes

#### New Multiclass Character Structure
```typescript
interface MulticlassInfo {
  className: string;
  level: number;
  isCustom: boolean;
  spellcaster?: 'full' | 'half' | 'third' | 'warlock' | 'none';
  hitDie: number;
  subclass?: string;
}

interface CharacterState {
  // Replace single class with multiclass array
  classes: MulticlassInfo[]; // New multiclass structure
  totalLevel: number; // Sum of all class levels
  
  // Backwards compatibility (deprecated but maintained)
  class?: ClassInfo; // Keep for migration
  level?: number; // Keep for migration
  
  // Updated calculations
  hitDice: Record<string, number>; // e.g., { "d8": 3, "d10": 2 }
  spellSlots: SpellSlots;
  pactMagic?: PactMagic;
}
```

#### Migration Strategy
```typescript
function migrateToMulticlass(character: CharacterState): CharacterState {
  // If already multiclass, return as-is
  if (character.classes && character.classes.length > 0) {
    return character;
  }
  
  // Convert single class to multiclass format
  const singleClass: MulticlassInfo = {
    className: character.class?.name || '',
    level: character.level || 1,
    isCustom: character.class?.isCustom || false,
    spellcaster: character.class?.spellcaster,
    hitDie: character.class?.hitDie || 8,
  };
  
  return {
    ...character,
    classes: [singleClass],
    totalLevel: character.level || 1,
    // Keep old fields for compatibility
    class: character.class,
    level: character.level,
  };
}
```

### Phase 2: Calculation Updates

#### Multiclass Spell Slot Calculation
```typescript
export function calculateMulticlassSpellSlots(classes: MulticlassInfo[]): SpellSlots {
  let casterLevel = 0;
  let hasWarlock = false;
  
  for (const classInfo of classes) {
    switch (classInfo.spellcaster) {
      case 'full':
        casterLevel += classInfo.level;
        break;
      case 'half':
        casterLevel += Math.floor(classInfo.level / 2);
        break;
      case 'third':
        casterLevel += Math.floor(classInfo.level / 3);
        break;
      case 'warlock':
        hasWarlock = true;
        break;
    }
  }
  
  // Use combined caster level for spell slot calculation
  return calculateSpellSlotsFromCasterLevel(casterLevel);
}
```

#### Hit Dice Calculation
```typescript
export function calculateHitDice(classes: MulticlassInfo[]): Record<string, number> {
  const hitDice: Record<string, number> = {};
  
  for (const classInfo of classes) {
    const dieType = `d${classInfo.hitDie}`;
    hitDice[dieType] = (hitDice[dieType] || 0) + classInfo.level;
  }
  
  return hitDice;
}
```

### Phase 3: UI Updates

#### Class Selection Component
- Update `CharacterBasicInfo` to show multiple classes
- Add "Add Class" button for multiclassing
- Show individual class levels and total level
- Validate multiclassing requirements

#### Class Display Format
```
Fighter 5 / Wizard 3 (Level 8)
```

#### Multiclass Requirements Validation
```typescript
function validateMulticlassRequirements(
  currentClasses: MulticlassInfo[],
  newClassName: string,
  abilities: CharacterAbilities
): { valid: boolean; errors: string[] } {
  // Check requirements for new class
  // Check requirements for existing classes
  // Return validation result
}
```

### Phase 4: Backwards Compatibility

#### Migration on Load
```typescript
// In characterStore.ts
loadCharacterState: (characterState: CharacterState) => {
  const migratedCharacter = migrateCharacterData(characterState);
  const multiclassCharacter = migrateToMulticlass(migratedCharacter);
  
  set({
    character: multiclassCharacter,
    // ... rest of state
  });
}
```

#### Fallback Support
- Keep old `class` and `level` fields populated for compatibility
- Update them when multiclass data changes
- Ensure old character sheets still display correctly

## Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Update TypeScript interfaces
- [ ] Implement migration functions
- [ ] Update spell slot calculations
- [ ] Add multiclass validation logic

### Phase 2: Core Features (Week 2)
- [ ] Update character store methods
- [ ] Implement multiclass UI components
- [ ] Update character sheet display
- [ ] Add class management interface

### Phase 3: Advanced Features (Week 3)
- [ ] Implement hit dice management
- [ ] Add proficiency calculations
- [ ] Update spellcasting statistics
- [ ] Implement class feature tracking

### Phase 4: Polish & Testing (Week 4)
- [ ] Comprehensive testing
- [ ] Performance optimization
- [ ] Documentation updates
- [ ] Migration testing with existing characters

## Risk Mitigation

### Data Safety
1. **Gradual Migration**: Keep old fields during transition
2. **Validation**: Extensive validation before saving
3. **Rollback**: Ability to revert to single-class if needed
4. **Backup**: Character export before migration

### Performance Considerations
1. **Lazy Loading**: Only calculate when needed
2. **Memoization**: Cache expensive calculations
3. **Incremental Updates**: Update only changed values

### User Experience
1. **Progressive Enhancement**: Single-class users see no changes
2. **Clear Indicators**: Show when character is multiclassed
3. **Helpful Validation**: Clear error messages for requirements
4. **Undo Support**: Allow reverting multiclass changes

## Testing Strategy

### Unit Tests
- Migration functions
- Spell slot calculations
- Hit dice calculations
- Validation logic

### Integration Tests
- Character creation flow
- Class addition/removal
- Level up process
- Save/load functionality

### Compatibility Tests
- Existing single-class characters
- Import/export functionality
- DM view compatibility
- Mobile responsiveness

## Conclusion

This implementation plan provides a comprehensive approach to adding multiclassing support while maintaining backwards compatibility. The phased approach allows for incremental development and testing, reducing the risk of breaking existing functionality.

The key insight is to treat multiclassing as an extension of the current system rather than a replacement, ensuring that existing single-class characters continue to work seamlessly while providing powerful new multiclassing capabilities for advanced users.
