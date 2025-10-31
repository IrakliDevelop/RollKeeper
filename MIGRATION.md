# Design System Migration Tracker

This document tracks the migration from the old inconsistent component implementations to the new unified design system.

## Migration Status Overview

- **Phase 1: Foundation** ✅ **COMPLETE**
  - Design tokens created
  - Variant utilities created  
  - Animation utilities created

- **Phase 2: Core Form Components** ✅ **COMPLETE**
  - Button component created
  - Input component refactored
  - Textarea component created
  - Select component refactored
  - Checkbox component refactored
  - Switch component created
  - RadioGroup component created

- **Phase 3: Layout & Feedback Components** ✅ **COMPLETE**
  - Card component created
  - Badge component refactored
  - Dialog component created (dialog-new.tsx)

- **Phase 4: Character Sheet Migration (HIGH PRIORITY)** 🚧 **IN PROGRESS**
  - Focus on player character sheet components
  - Main use case of the application

- **Phase 5: DM Tools Migration** 📋 **LOW PRIORITY**
  - DM toolset is prototype UI
  - Can be migrated last

- **Phase 6: Cleanup & Documentation** 📋 **PENDING**

---

## 🎯 Priority: Character Sheet Components

The main player character sheet (`/app/player/characters/[characterId]/page.tsx`) uses these components:

**Character Sheet Components (Priority Order):**
- [x] CharacterHeaderSection ✅ (already migrated)
- [x] RestManager - Short/long rest buttons ✅
- [x] HitDiceTracker - Hit dice management buttons (Long Rest, Use, Restore) ✅
- [x] SpellSlotTracker - Spell slot reset buttons (Reset Slots, Reset Pact) ✅
- [x] TraitTracker - Trait management buttons (Short Rest, Long Rest, Use, View, Delete) ✅
- [x] Skills - Skill proficiency checkboxes and Jack of All Trades toggle ✅
- [x] SavingThrows - Saving throw proficiency checkboxes and roll buttons ✅
- [x] AbilityScores - Ability score inputs and modifier buttons ✅
- [x] CharacterBasicInfo - Character info inputs, multiclass button, and dropdowns (Class & Alignment) ✅
- [x] CombatStats - Initiative/Speed inputs, Reaction switch and reset button ✅
- [x] ActionsSection - Manage spells button ✅
- [ ] CharacterSheetHeader - Action buttons (save, export, etc.)
- [ ] LanguagesAndProficiencies - Text inputs
- [ ] ExtendedFeaturesSection - Feature cards and buttons
- [ ] ArmorClassManager - AC calculation inputs
- [ ] QuickStats - Quick stats display
- [ ] WeaponProficiencies - Weapon selection
- [ ] XPTracker - XP inputs
- [ ] HeroicInspirationTracker - Inspiration tracking

---

## Component Migration Checklist

### Buttons

**Old Implementation:**
- Inline `<button>` elements with class names
- Inconsistent gradient buttons
- Various color schemes (blue, green, red, purple, amber)

**New Component:** `<Button>` from `@/components/ui/forms/button`

**Files to Migrate:**

**High Priority (Highly Visible):**
- [x] `/src/components/ui/character/CharacterHeaderSection.tsx` - Save, Export, Import, Reset buttons ✅
- [ ] `/src/components/ui/character/CharacterSheetHeader.tsx` - Action buttons
- [ ] `/src/app/player/page.tsx` - Dashboard buttons
- [ ] `/src/app/dm/page.tsx` - DM dashboard buttons

**Medium Priority (Forms & Modals):**
- [x] `/src/components/ui/game/NoteModal.tsx` - Modal action buttons, input ✅
- [ ] `/src/components/ui/game/EquipmentModal.tsx` - Form buttons
- [ ] `/src/components/ui/character/ExtendedFeatures/FeatureModal.tsx` - Modal buttons
- [ ] `/src/components/ui/character/ExtendedFeatures/AddFeatureModal.tsx` - Form buttons
- [ ] `/src/components/ui/game/ConditionDetailsModal.tsx` - Modal buttons

**Combat & DM Tools:**
- [x] `/src/components/dm/CombatTracker/CombatCanvas.tsx` - Action buttons (Add, Log, Pause/Resume, End) ✅
- [ ] `/src/components/dm/CombatTracker/CombatLog.tsx` - Log action buttons
- [ ] `/src/components/dm/CombatTracker/AddParticipantModal.tsx` - Form buttons

**Test Pages:**
- [ ] `/src/app/dice-test/page.tsx` - Dice roll buttons
- [ ] `/src/app/dice-components-demo/page.tsx` - Demo buttons

---

### Inputs & Textareas

**Old Implementation:**
- Mix of styled inputs from `src/styles/inputs.ts`
- Inline `<input>` and `<textarea>` elements
- Inconsistent styling and focus states

**New Components:**
- `<Input>` from `@/components/ui/forms/input`
- `<Textarea>` from `@/components/ui/forms/textarea`

**Files to Migrate:**

**Forms & Modals:**
- [ ] `/src/components/ui/game/NoteModal.tsx` - Title input, content textarea
- [ ] `/src/components/ui/game/ConditionDetailsModal.tsx` - Notes textarea, onset time input
- [ ] `/src/components/ui/character/ExtendedFeatures/FeatureModal.tsx` - Form inputs & textarea
- [ ] `/src/components/EnhancedSpellManagement.tsx` - Custom spell form inputs & textareas
- [ ] `/src/components/shared/character/InventoryManager.tsx` - Item form inputs & textarea
- [ ] `/src/components/ui/game/FeaturesTraitsManager.tsx` - Feature/trait inputs
- [ ] `/src/components/ui/character/CharacterBasicInfo.tsx` - Character info inputs

**Search & Filters:**
- [ ] `/src/components/spellbook/SpellFiltersPanel.tsx` - Search inputs
- [ ] `/src/components/classes/ClassFiltersPanel.tsx` - Search inputs
- [ ] `/src/components/dm/CombatTracker/VirtualizedMonsterGrid.tsx` - Search inputs

---

### Selects & Dropdowns

**Old Implementation:**
- `CustomDropdown` component
- `FancySelect` component
- `CustomSwitcher` component (toggle select)
- Inline `<select>` elements

**New Component:** `<SelectField>` and `<Select>` from `@/components/ui/forms/select`

**Files to Migrate:**

**Replace CustomDropdown:**
- [ ] Find all imports of `CustomDropdown` and replace with `SelectField`
- [ ] Update props to match new API

**Replace FancySelect:**
- [ ] Find all imports of `FancySelect` and replace with `SelectField`
- [ ] Update props to match new API (color prop → variant)

**Replace CustomSwitcher:**
- [ ] Evaluate if should be `<Switch>` or `<RadioGroup>` based on use case
- [ ] Migrate accordingly

**Forms with Selects:**
- [ ] `/src/components/EnhancedSpellManagement.tsx` - Spell level, school, etc.
- [ ] `/src/components/ui/character/ClassSelector.tsx` - Class selection
- [ ] `/src/components/ui/character/MulticlassManager.tsx` - Multiclass selects
- [ ] `/src/components/ui/character/CharacterBasicInfo.tsx` - Background, alignment, etc.

---

### Checkboxes

**Old Implementation:**
- `CustomCheckbox` component (will be deprecated)
- Inline `<input type="checkbox">` elements

**New Component:** `<Checkbox>` from `@/components/ui/forms/checkbox`

**Files to Migrate:**

**Replace CustomCheckbox:**
- [ ] Find all imports of `CustomCheckbox` and replace with `Checkbox`
- [ ] Update props (variant names may differ)

**Forms with Checkboxes:**
- [ ] `/src/components/spellbook/SpellFiltersPanel.tsx` - Filter checkboxes
- [ ] `/src/components/ui/character/Skills.tsx` - Proficiency checkboxes
- [ ] `/src/components/ui/character/SavingThrows.tsx` - Proficiency checkboxes
- [ ] `/src/components/EnhancedSpellManagement.tsx` - Spell filters

---

### Cards

**Old Implementation:**
- Various card styles across different components
- Inconsistent borders, padding, shadows
- Custom card implementations in:
  - `FeatureCard`
  - `MonsterCard`
  - `ClassCard`
  - `ArmorCard`
  - Item cards in inventory

**New Component:** `<Card>` from `@/components/ui/layout/card`

**Files to Migrate:**

**Character Features:**
- [ ] `/src/components/ui/character/ExtendedFeatures/FeatureCard.tsx` - Refactor to use new Card
- [ ] `/src/components/shared/character/InventoryManager.tsx` - Item cards

**Bestiary & Classes:**
- [ ] `/src/components/bestiary/MonsterCard.tsx` - Refactor to use new Card
- [ ] `/src/components/classes/ClassCard.tsx` - Refactor to use new Card

**Combat Tracker:**
- [ ] `/src/components/dm/CombatTracker/CombatParticipantCard.tsx` - Refactor to use new Card

**Equipment & Armor:**
- [ ] `/src/components/ArmorDefenseManager.tsx` - ArmorCard component
- [ ] `/src/components/WeaponInventory.tsx` - Weapon cards

---

### Badges

**Old Implementation:**
- Current Badge component uses CVA but needs design token integration

**New Component:** `<Badge>` from `@/components/ui/layout/badge` (refactored)

**Files Using Badges:**
- [ ] Review all Badge usages and update variant names if needed
- [ ] Add icons to badges where appropriate (leftIcon/rightIcon props)
- [ ] Ensure consistent sizing

---

### Modals/Dialogs

**Old Implementation:**
- `Modal.tsx` - Custom modal with portal
- `dialog.tsx` - Radix Dialog with minimal styling
- `ConfirmationModal.tsx` - Custom confirmation modal

**New Component:** `<Dialog>` from `@/components/ui/feedback/dialog-new`

**Files to Migrate:**

**Note:** Keep old Modal.tsx temporarily for backward compatibility

**High Priority Modals:**
- [ ] `/src/components/ui/game/NoteModal.tsx`
- [ ] `/src/components/ui/game/EquipmentModal.tsx`
- [ ] `/src/components/ui/game/ConditionDetailsModal.tsx`
- [ ] `/src/components/ui/character/ExtendedFeatures/FeatureModal.tsx`
- [ ] `/src/components/ui/character/ExtendedFeatures/AddFeatureModal.tsx`

**DM Modals:**
- [ ] `/src/components/dm/CombatTracker/AddParticipantModal.tsx`
- [ ] Any campaign management modals

**Bestiary:**
- [ ] `/src/components/bestiary/MonsterModal.tsx`

---

## Migration Process

### Step 1: Import New Component
```typescript
// Old
import { CustomCheckbox } from '@/components/ui/forms';

// New
import { Checkbox } from '@/components/ui/forms';
```

### Step 2: Update Props
```typescript
// Old CustomCheckbox
<CustomCheckbox
  checked={value}
  onChange={setValue}
  label="My Label"
  variant="emerald"
/>

// New Checkbox
<Checkbox
  checked={value}
  onCheckedChange={setValue}
  label="My Label"
  variant="primary"  // emerald → primary
/>
```

### Step 3: Replace Inline Buttons
```typescript
// Old
<button
  onClick={handleSave}
  className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-700 px-4 py-2 text-sm text-white shadow-md transition-all hover:from-emerald-700 hover:to-emerald-800"
>
  <Save size={16} />
  Save
</button>

// New
<Button
  onClick={handleSave}
  leftIcon={<Save className="h-4 w-4" />}
>
  Save
</Button>
```

### Step 4: Replace Input Styles
```typescript
// Old
import { inputStyles } from '@/styles/inputs';

<input
  type="text"
  className={inputStyles.base}
  placeholder="Enter text"
/>

// New
<Input
  placeholder="Enter text"
/>
```

---

## Testing Strategy

1. **Visual Testing:**
   - Compare before/after screenshots
   - Check responsive behavior
   - Verify hover/focus states

2. **Functional Testing:**
   - Test all interactive states
   - Verify keyboard navigation
   - Check screen reader accessibility

3. **Integration Testing:**
   - Test in context of actual features
   - Verify form submissions
   - Check modal open/close behaviors

---

## Rollback Plan

If issues are discovered:

1. Old components remain available with import paths
2. Revert specific file changes via git
3. Keep both old and new components until migration is 100% complete
4. Document any breaking changes or prop differences

---

## Deprecated Components (To Be Removed After Migration)

- [ ] `CustomCheckbox.tsx`
- [ ] `CustomDropdown.tsx`
- [ ] `FancySelect.tsx`
- [ ] `CustomSwitcher.tsx`
- [ ] `src/styles/inputs.ts`
- [ ] `Modal.tsx` (after consolidating with dialog-new.tsx)
- [ ] Old `badge.tsx` (already replaced)

---

## Documentation Tasks

- [ ] Create `docs/DESIGN_SYSTEM.md` - Design principles and guidelines
- [ ] Create `docs/COMPONENT_GUIDE.md` - Usage examples for each component
- [ ] Update README with design system information
- [ ] Add JSDoc comments to all component props
- [ ] Create Storybook or component playground (optional)

---

## Success Metrics

- [ ] Zero imports of deprecated components
- [ ] All buttons use `<Button>` component
- [ ] All inputs use `<Input>` or `<Textarea>` components
- [ ] All dropdowns use `<SelectField>` component
- [ ] All checkboxes use `<Checkbox>` component
- [ ] All cards use consistent `<Card>` component
- [ ] No inline styling for form elements
- [ ] Consistent spacing and colors throughout app
- [ ] Reduced bundle size (fewer duplicate styles)
- [ ] Improved accessibility scores

---

## Timeline Estimate

- **Week 1:** High-priority buttons and inputs (character sheets, main navigation)
- **Week 2:** Forms and modals
- **Week 3:** Cards and list items
- **Week 4:** Combat tracker and DM tools
- **Week 5:** Testing, bug fixes, and polish
- **Week 6:** Cleanup deprecated components, finalize documentation

---

## Notes

- Always test in both light and dark modes (future consideration)
- Maintain backward compatibility during transition
- Document any custom variants or extensions needed
- Keep design tokens synchronized with Tailwind config
- Consider performance implications of animations

---

**Last Updated:** October 31, 2025

