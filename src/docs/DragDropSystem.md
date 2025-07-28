# Reusable Drag and Drop System

This system provides reusable drag and drop functionality that can be easily applied to any list component in the application.

## Components

### 1. `useDragAndDrop` Hook
**File**: `src/hooks/useDragAndDrop.ts`

A custom hook that handles all drag and drop logic.

```typescript
const {
  handleDragStart,
  handleDragEnd,
  handleDragOver,
  handleDragLeave,
  handleDrop,
  getDragOverStyles,
  getDraggedStyles,
  isDragging
} = useDragAndDrop({
  onReorder: (sourceIndex, destinationIndex) => {
    // Handle reordering logic
  },
  disabled: false // Optional
});
```

### 2. `DragHandle` Component
**File**: `src/components/ui/DragHandle.tsx`

A reusable drag handle with consistent styling.

```typescript
<DragHandle 
  isDragEnabled={true}
  className="mr-2"
  size={16}
  color="text-gray-400"
/>
```

### 3. `DragDropList` Component
**File**: `src/components/ui/DragDropList.tsx`

A generic wrapper that adds drag and drop to any list.

```typescript
<DragDropList
  items={items}
  onReorder={handleReorder}
  keyExtractor={(item) => item.id}
  disabled={false}
  className="space-y-3"
  itemClassName="border rounded-lg p-4"
  showDragHandle={true}
  dragHandlePosition="left"
  renderItem={(item, index, isDragging) => (
    <div>Your item content here</div>
  )}
/>
```

## Usage Examples

### Notes (Already Implemented)
The notes section now uses the new `DragDropList` component.

### Weapons List
```typescript
import { DraggableWeaponsList } from '@/examples/DragDropExamples';

<DraggableWeaponsList
  weapons={weapons}
  onReorder={(sourceIndex, destinationIndex) => {
    // Reorder weapons logic
    const newWeapons = [...weapons];
    const [moved] = newWeapons.splice(sourceIndex, 1);
    newWeapons.splice(destinationIndex, 0, moved);
    setWeapons(newWeapons);
  }}
  onEdit={(weapon) => setEditingWeapon(weapon)}
  onDelete={(id) => deleteWeapon(id)}
/>
```

### Inventory Items
```typescript
import { DraggableInventoryList } from '@/examples/DragDropExamples';

<DraggableInventoryList
  items={inventoryItems}
  onReorder={handleInventoryReorder}
  onEdit={editItem}
  onDelete={deleteItem}
/>
```

### Magic Items
```typescript
import { DraggableMagicItemsList } from '@/examples/DragDropExamples';

<DraggableMagicItemsList
  items={magicItems}
  onReorder={handleMagicItemReorder}
  onEdit={editMagicItem}
  onDelete={deleteMagicItem}
/>
```

## Adding Drag and Drop to Store Actions

To support reordering in your store, add reorder actions:

```typescript
// Character Store Example
interface CharacterStore {
  // ... existing properties
  reorderWeapons: (sourceIndex: number, destinationIndex: number) => void;
  reorderInventoryItems: (sourceIndex: number, destinationIndex: number) => void;
  reorderMagicItems: (sourceIndex: number, destinationIndex: number) => void;
}

const useCharacterStore = create<CharacterStore>((set) => ({
  // ... existing implementation
  
  reorderWeapons: (sourceIndex: number, destinationIndex: number) => {
    set((state) => {
      const weapons = [...state.character.weapons];
      const [removed] = weapons.splice(sourceIndex, 1);
      weapons.splice(destinationIndex, 0, removed);

      return {
        character: {
          ...state.character,
          weapons
        },
        hasUnsavedChanges: true
      };
    });
  },

  reorderInventoryItems: (sourceIndex: number, destinationIndex: number) => {
    set((state) => {
      const items = [...state.character.inventoryItems];
      const [removed] = items.splice(sourceIndex, 1);
      items.splice(destinationIndex, 0, removed);

      return {
        character: {
          ...state.character,
          inventoryItems: items
        },
        hasUnsavedChanges: true
      };
    });
  },

  reorderMagicItems: (sourceIndex: number, destinationIndex: number) => {
    set((state) => {
      const items = [...state.character.magicItems];
      const [removed] = items.splice(sourceIndex, 1);
      items.splice(destinationIndex, 0, removed);

      return {
        character: {
          ...state.character,
          magicItems: items
        },
        hasUnsavedChanges: true
      };
    });
  }
}));
```

## Customization Options

### Styling
- **`className`**: Overall container styling
- **`itemClassName`**: Individual item styling
- **`dragHandlePosition`**: `'left'` or `'right'`
- **`showDragHandle`**: Whether to show the drag handle

### Behavior
- **`disabled`**: Disable drag and drop functionality
- **`keyExtractor`**: Function to extract unique keys from items
- **`renderItem`**: Custom render function for each item

## Benefits

1. **Reusable**: Write once, use everywhere
2. **Consistent**: Uniform drag and drop behavior across the app
3. **Accessible**: Proper keyboard navigation and ARIA attributes
4. **Performant**: Uses `useCallback` for optimized re-renders
5. **Flexible**: Highly customizable styling and behavior
6. **Type-safe**: Full TypeScript support

## Implementation Checklist

To add drag and drop to a new component:

1. ✅ Import `DragDropList` component
2. ✅ Add reorder action to your store
3. ✅ Create a `renderItem` function
4. ✅ Define `keyExtractor` function
5. ✅ Handle the `onReorder` callback
6. ✅ Optionally customize styling and position

Example implementation time: **5-10 minutes** per component! 