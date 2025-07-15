# RollKeeper. D&D Character Sheet Web App - Project Plan

## Project Overview
A web-based D&D character sheet application built with Next.js, featuring auto-save functionality, calculated fields, and a clean, intuitive interface.

## Tech Stack
- **Framework**: Next.js 14+ (App Router)
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI
- **State Management**: Zustand
- **Form Handling**: React Hook Form
- **Validation**: Zod
- **TypeScript**: Required
- **Storage**: LocalStorage + JSON Export/Import (MVP), Database (future)

## MVP Features

### Phase 1: Core Character Sheet
1. **Basic Information**
   - Character name, race, class, background
   - Level, experience points
   - Alignment, player name
   
2. **Ability Scores & Modifiers**
   - Six core abilities (STR, DEX, CON, INT, WIS, CHA)
   - Automatic modifier calculation
   - Proficiency bonus based on level

3. **Skills**
   - All 18 skills with ability associations
   - Proficiency checkboxes
   - Automatic calculation with manual override option
   - Expertise support

4. **Combat Stats**
   - Hit Points (current/max/temp)
   - Armor Class
   - Initiative
   - Speed
   - Hit Dice

5. **Saving Throws**
   - Six saves with proficiency options
   - Auto-calculation from abilities

### Phase 2: Extended Features
1. **Tabbed Interface**
   - Main Stats (default)
   - Spells
   - Equipment/Inventory
   - Features & Traits
   - Notes

2. **Auto-Save System**
   - Debounced save on input (500ms delay)
   - Save on blur
   - Ctrl+S manual save
   - Visual save indicator
   - LocalStorage persistence

3. **Export/Import System**
   - Export character as JSON file
   - Import character from JSON file
   - Version compatibility checking
   - Data validation on import

4. **Calculated Fields**
   - Skill modifiers from abilities
   - Proficiency bonus application
   - Attack bonuses
   - Spell save DC

## Technical Implementation

### File Structure
```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── character/
│   │   ├── BasicInfo.tsx
│   │   ├── AbilityScores.tsx
│   │   ├── Skills.tsx
│   │   ├── CombatStats.tsx
│   │   └── SavingThrows.tsx
│   ├── ui/
│   │   ├── Tabs.tsx
│   │   ├── Input.tsx
│   │   ├── Checkbox.tsx
│   │   └── SaveIndicator.tsx
│   └── layout/
│       ├── Header.tsx
│       └── TabContent.tsx
├── hooks/
│   ├── useAutoSave.ts
│   ├── useCalculatedFields.ts
│   └── useLocalStorage.ts
├── store/
│   ├── characterStore.ts
│   └── uiStore.ts
├── types/
│   └── character.ts
└── utils/
    ├── calculations.ts
    └── constants.ts
```

### State Management Schema
```typescript
interface CharacterState {
  // Basic Info
  name: string
  race: string
  class: string
  level: number
  experience: number
  
  // Abilities
  abilities: {
    strength: number
    dexterity: number
    constitution: number
    intelligence: number
    wisdom: number
    charisma: number
  }
  
  // Skills
  skills: {
    [skillName: string]: {
      proficient: boolean
      expertise: boolean
      customModifier?: number
    }
  }
  
  // Combat
  hitPoints: {
    current: number
    max: number
    temporary: number
  }
  armorClass: number
  initiative: number
  speed: number
  
  // Saving Throws
  savingThrows: {
    [ability: string]: {
      proficient: boolean
      customModifier?: number
    }
  }
}
```

### Key Components Implementation

#### Auto-Save Hook
```typescript
const useAutoSave = (data: any, saveFunction: () => void) => {
  const [saveStatus, setSaveStatus] = useState('saved')
  
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      saveFunction()
      setSaveStatus('saved')
    }, 500)
    
    setSaveStatus('saving')
    
    return () => clearTimeout(timeoutId)
  }, [data])
  
  return saveStatus
}
```

#### Export/Import Functions
```typescript
// Export character as JSON
const exportCharacter = (character: CharacterState) => {
  const dataStr = JSON.stringify({
    version: '1.0.0',
    exportDate: new Date().toISOString(),
    character
  }, null, 2)
  
  const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr)
  
  const exportFileDefaultName = `${character.name || 'character'}_${Date.now()}.json`
  
  const linkElement = document.createElement('a')
  linkElement.setAttribute('href', dataUri)
  linkElement.setAttribute('download', exportFileDefaultName)
  linkElement.click()
}

// Import character from JSON
const importCharacter = async (file: File): Promise<CharacterState> => {
  const text = await file.text()
  const data = JSON.parse(text)
  
  // Validate version compatibility
  if (data.version !== '1.0.0') {
    console.warn('Version mismatch, attempting import anyway')
  }
  
  // Validate character data structure
  // Use Zod schema here
  
  return data.character
}
```

#### Calculated Fields
```typescript
const calculateModifier = (score: number) => Math.floor((score - 10) / 2)

const calculateSkillModifier = (
  abilityScore: number,
  proficiencyBonus: number,
  isProficient: boolean,
  hasExpertise: boolean
) => {
  const abilityMod = calculateModifier(abilityScore)
  const profBonus = isProficient ? proficiencyBonus : 0
  const expertiseBonus = hasExpertise ? proficiencyBonus : 0
  return abilityMod + profBonus + expertiseBonus
}
```

## UI/UX Design Principles
1. **Clean, scannable layout** - Group related information
2. **Inline editing** - Click to edit any field
3. **Visual feedback** - Highlight changed/saving fields
4. **Responsive design** - Works on tablet/mobile
5. **Keyboard navigation** - Tab through fields efficiently
6. **D&D Beyond inspiration** - Familiar layout patterns

## Development Stages

### Stage 1: Project Setup & Foundation
**Time: 2-4 hours**
- [ ] Initialize Next.js project with TypeScript
- [ ] Set up Tailwind CSS
- [ ] Install and configure Radix UI
- [ ] Set up Zustand stores
- [ ] Create base type interfaces
- [ ] Basic layout structure

### Stage 2: Core Character Data
**Time: 4-6 hours**
- [ ] Basic info form (name, race, class, level)
- [ ] Ability scores component with modifiers
- [ ] Zustand store integration
- [ ] LocalStorage persistence hook
- [ ] Basic auto-save functionality

### Stage 3: Skills & Calculations
**Time: 3-4 hours**
- [ ] Skills component with proficiency toggles
- [ ] Automatic modifier calculations
- [ ] Manual override capability
- [ ] Saving throws implementation
- [ ] Combat stats (HP, AC, Initiative)

### Stage 4: State Management & Auto-Save
**Time: 2-3 hours**
- [ ] React Hook Form integration
- [ ] Debounced auto-save refinement
- [ ] Save status indicator
- [ ] Keyboard shortcuts (Ctrl+S)
- [ ] Optimistic UI updates

### Stage 5: Export/Import System
**Time: 2-3 hours**
- [ ] Export character as JSON
- [ ] Import character from JSON
- [ ] File validation and error handling
- [ ] Version compatibility
- [ ] Import/Export UI buttons

### Stage 6: Tabbed Interface
**Time: 3-4 hours**
- [ ] Tab component using Radix UI
- [ ] Spells tab (basic structure)
- [ ] Equipment tab (basic structure)
- [ ] Features & Traits tab
- [ ] Notes tab with rich text

### Stage 7: Polish & UX
**Time: 2-3 hours**
- [ ] Responsive design improvements
- [ ] Loading states
- [ ] Error boundaries
- [ ] Accessibility improvements
- [ ] Visual polish and animations

## Future Enhancements
1. **User Authentication**
   - Multiple character sheets
   - Cloud sync
   
2. **Advanced Features**
   - Spell slots tracking
   - Inventory weight calculation
   - Rest mechanics (short/long)
   - Death saves
   - Conditions tracking
   
3. **Data Management**
   - Import/Export JSON ✓
   - PDF export (future)
   - D&D Beyond import (future)
   - Character templates
   
4. **Social Features**
   - Share character sheets
   - Party view for DMs
   - Campaign integration

## Testing Strategy
1. **Unit Tests**: Calculation functions
2. **Integration Tests**: Form submissions and state updates
3. **E2E Tests**: Critical user flows (create character, save, load)

## Performance Considerations
1. **Debounced saves** to prevent excessive writes
2. **Memoized calculations** for derived values
3. **Lazy load tabs** for better initial load
4. **Optimistic UI updates** for better perceived performance

## Accessibility
1. **ARIA labels** for all inputs
2. **Keyboard navigation** support
3. **Screen reader** friendly
4. **High contrast** mode support

---

## Getting Started
1. Clone the repository
2. Run `npm install`
3. Create `.env.local` (if needed)
4. Run `npm run dev`
5. Navigate to `http://localhost:3000`

## Commands
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run test` - Run tests
- `npm run lint` - Run ESLint

## Notes
- Start with the simplest implementation
- Focus on core functionality before aesthetics
- Test with real character sheets