# Editor Technology Research

## Current Situation Analysis

### Current Setup
- **Editor**: TipTap v3.0.3 (Latest version)
- **Extensions Used**:
  - `@tiptap/starter-kit`: Basic functionality
  - `@tiptap/extension-bullet-list`: Bullet lists
  - `@tiptap/extension-ordered-list`: Numbered lists  
  - `@tiptap/extension-list-item`: List items
  - `@tiptap/extension-text-style`: Text styling
  - `@tiptap/extension-color`: Text colors

### Current Issues (from README)
- Lists (bullet/numbered) not working properly
- Headers (H1/H2) functionality problems
- Extension configuration conflicts
- Need for D&D-specific features

## 🎯 Recommendation: Fix TipTap v3 Configuration

### Why TipTap v3 is the Right Choice

#### ✅ Advantages
- **Already Latest Version**: Using TipTap v3.0.3 (newest release)
- **No Migration Risk**: Fix configuration instead of rewriting
- **Team Familiarity**: Already integrated and understood
- **Rich Ecosystem**: 100+ official extensions
- **Excellent TypeScript**: Native support with great types
- **D&D Extensions**: Easy to create custom dice/mention features
- **Performance**: Optimized for React applications
- **Active Community**: Large user base and documentation

#### 🔧 Current Issues & Solutions

**Problem 1: Extension Conflicts in StarterKit**
```typescript
// Current problematic config
StarterKit.configure({
  bulletList: false,    // But then including BulletList separately
  orderedList: false,   // Causing conflicts
  listItem: false,
})
```

**Solution**: Clean extension separation
```typescript
StarterKit.configure({
  // Keep essential extensions
  heading: { levels: [1, 2, 3, 4, 5, 6] },
  // Explicitly disable conflicting ones
  bulletList: false,
  orderedList: false,
  listItem: false,
}),
// Add list extensions separately with proper config
BulletList.configure({
  HTMLAttributes: { class: 'prose-bullet-list' },
  keepMarks: true,
}),
OrderedList.configure({
  HTMLAttributes: { class: 'prose-ordered-list' },
  keepMarks: true,
}),
ListItem.configure({
  HTMLAttributes: { class: 'prose-list-item' },
}),
```

**Problem 2: Header Issues**
- Headers are actually included in StarterKit
- Issue likely in CSS styling or hydration

**Problem 3: Missing Advanced Features**
- No tables, links, images
- No D&D-specific extensions

## 🚀 Implementation Plan

### Phase 1: Fix Current Configuration (1-2 days)
1. **Debug and fix extension conflicts**
2. **Ensure all basic formatting works**
3. **Fix hydration/SSR issues**
4. **Add proper CSS styling**

### Phase 2: Add Missing Features (2-3 days)
1. **Tables**: `@tiptap/extension-table`
2. **Links**: `@tiptap/extension-link`
3. **Images**: `@tiptap/extension-image`
4. **Code blocks**: Better syntax highlighting

### Phase 3: D&D Custom Extensions (3-5 days)
1. **Dice Notation**: Highlight `1d20+5`, `2d6+3`
2. **Entity Mentions**: @NPC, @Location, @Character
3. **Stat Blocks**: Formatted creature stats
4. **Quick Commands**: Slash commands for rapid insertion

### Phase 4: Advanced Integration (1 week)
1. **Note Linking**: Bidirectional links between notes
2. **Canvas Integration**: Inline editing in canvas view
3. **Search Integration**: Content indexing for search

## 📋 Required Dependencies

### Add to package.json
```json
{
  "@tiptap/extension-table": "^3.0.3",
  "@tiptap/extension-table-row": "^3.0.3", 
  "@tiptap/extension-table-cell": "^3.0.3",
  "@tiptap/extension-table-header": "^3.0.3",
  "@tiptap/extension-link": "^3.0.3",
  "@tiptap/extension-image": "^3.0.3",
  "@tiptap/extension-mention": "^3.0.3",
  "@tiptap/extension-placeholder": "^3.0.3"
}
```

## 🎨 Enhanced Editor Features

### Rich Text Capabilities
- **Formatting**: Bold, italic, underline, strikethrough
- **Headers**: H1-H6 with proper styling
- **Lists**: Bullet, numbered, task lists
- **Tables**: Full table support with editing
- **Links**: Internal note links + external URLs
- **Images**: Drag-drop image insertion
- **Code**: Inline code and code blocks
- **Quotes**: Blockquotes for important text

### D&D-Specific Features
- **Dice Rolls**: Auto-detect and highlight dice notation
- **Character Mentions**: Link to character sheets
- **NPC Database**: Quick NPC reference insertion
- **Spell References**: Link to spell database
- **Location Tags**: Geographic reference system
- **Session Timestamps**: Auto-timestamp session notes

## 🔧 Technical Implementation

### Fixed Editor Configuration
```typescript
export const createNotesEditor = (content: string, onChange: (html: string) => void) => {
  return useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4, 5, 6] },
        bulletList: false,
        orderedList: false,
        listItem: false,
      }),
      BulletList.configure({
        HTMLAttributes: { class: 'notes-bullet-list' },
        keepMarks: true,
        keepAttributes: false,
      }),
      OrderedList.configure({
        HTMLAttributes: { class: 'notes-ordered-list' },
        keepMarks: true,
        keepAttributes: false,
      }),
      ListItem,
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'notes-link',
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'notes-image',
        },
      }),
      // Custom D&D extensions
      DiceNotation,
      EntityMention,
      StatBlock,
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-lg max-w-none focus:outline-none',
      },
    },
  });
};
```

### Custom D&D Extensions Examples
```typescript
// Dice notation highlighting
const DiceNotation = Extension.create({
  name: 'diceNotation',
  
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('diceNotation'),
        props: {
          decorations: (state) => {
            const decorations = [];
            const diceRegex = /\d+d\d+(?:[+-]\d+)?/g;
            
            state.doc.descendants((node, pos) => {
              if (node.isText) {
                let match;
                while ((match = diceRegex.exec(node.text)) !== null) {
                  decorations.push(
                    Decoration.inline(
                      pos + match.index,
                      pos + match.index + match[0].length,
                      { class: 'dice-notation' }
                    )
                  );
                }
              }
            });
            
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});

// Entity mentions (@NPC, @Location)
const EntityMention = Extension.create({
  name: 'entityMention',
  
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('entityMention'),
        props: {
          handleTextInput: (view, from, to, text) => {
            if (text === '@') {
              // Trigger mention dropdown
              showMentionSuggestions(view, from);
              return false;
            }
          },
        },
      }),
    ];
  },
});
```

## ✅ Success Criteria

### Technical Goals
- [ ] All formatting features work correctly
- [ ] No extension conflicts or console errors
- [ ] Smooth editing experience without lag
- [ ] Proper SSR/hydration handling
- [ ] D&D-specific features functional

### User Experience Goals
- [ ] Intuitive toolbar with all features
- [ ] Quick access to D&D-specific tools
- [ ] Mobile-friendly editing
- [ ] Auto-save without interruption
- [ ] Fast note creation workflow

## 📊 Timeline

**Week 1**: Fix current issues + basic enhancements
**Week 2**: D&D extensions + advanced features  
**Week 3**: Integration with notes module + testing

This approach gives us a powerful, D&D-optimized editor while leveraging our existing technology investment.