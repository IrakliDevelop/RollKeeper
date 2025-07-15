# RollKeeper - D&D Character Sheet Web App

A modern, web-based D&D character sheet application built with Next.js, featuring auto-save functionality, calculated fields, and an intuitive interface.

## 🎲 Project Overview

RollKeeper is designed to provide D&D players with a seamless character sheet experience that automatically calculates modifiers, saves progress, and provides a clean, D&D Beyond-inspired interface.

## 🚀 Tech Stack

- **Framework**: Next.js 15.4.1 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **UI Components**: Radix UI
- **State Management**: Zustand (ready to implement)
- **Form Handling**: React Hook Form (ready to implement)
- **Validation**: Zod (ready to implement)
- **Icons**: Lucide React

## 📁 Project Structure

```
src/
├── app/                 # Next.js 14+ App Router
│   ├── layout.tsx       # Root layout
│   ├── page.tsx         # Home page
│   └── globals.css      # Global styles
├── components/          # React components (to be created)
│   ├── character/       # Character-specific components
│   ├── ui/             # Reusable UI components
│   └── layout/         # Layout components
├── hooks/              # Custom React hooks (to be created)
├── store/              # Zustand stores (to be created)
├── types/              # TypeScript type definitions
│   └── character.ts    # ✅ Core character interfaces
├── utils/              # Utility functions
│   ├── calculations.ts # ✅ D&D calculation functions
│   └── constants.ts    # ✅ D&D game constants
```

## ✅ Completed Setup (Stage 1)

- [x] Next.js 15 project initialized with TypeScript
- [x] Tailwind CSS configured
- [x] Essential dependencies installed:
  - Zustand for state management
  - React Hook Form for form handling
  - Zod for validation
  - Radix UI components for accessible UI
  - Lucide React for icons
- [x] Project structure created
- [x] TypeScript interfaces defined for character data
- [x] D&D calculation functions implemented
- [x] Game constants and mappings defined
- [x] Enhanced .gitignore with project-specific entries

## 🔧 Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # TypeScript type checking
```

## 🎯 Next Steps (Stage 2)

The foundation is set! Next development stages include:

1. **Basic Character Info Component** - Name, race, class, level input form
2. **Ability Scores Component** - Six core abilities with auto-calculated modifiers
3. **Zustand Store Implementation** - Character state management
4. **LocalStorage Integration** - Data persistence
5. **Auto-save Functionality** - Debounced saving with visual feedback

## 🧠 Key Features Planned

- **Auto-calculated Modifiers**: Automatic calculation of skill modifiers, saving throws, and other derived values
- **Real-time Auto-save**: Changes saved automatically with visual feedback
- **Export/Import**: JSON-based character data portability
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile
- **Accessibility**: Full keyboard navigation and screen reader support

## 🚀 Getting Started

1. The project is already set up and running!
2. Access the development server at: `http://localhost:3000`
3. Begin implementing components as outlined in the TODO.md plan

## 📊 Current Status

**Stage 1 Complete** ✅ - Project foundation established
- Development environment ready
- TypeScript types defined
- Calculation utilities implemented  
- Project structure organized

**Ready for Stage 2** 🚧 - Core character data implementation

---

## 📝 Notes

- All D&D 5e calculations are implemented following official rules
- 18 skills with proper ability associations defined
- Proficiency bonus progression (levels 1-20) included
- Character export format designed for future compatibility

For detailed development plans and feature specifications, see `TODO.md`.

## 🔧 Recent Improvements

### Modal Portal System
- **Fixed modal rendering issues**: Implemented React Portal system for all modals (weapon management, spell management, confirmation dialogs)
- **Full-page backdrop blur**: Modals now properly blur the entire page instead of just their parent containers
- **No more clipping**: Modals are rendered at the document body level, preventing parent container CSS from causing clipping issues
- **Improved accessibility**: Added proper body scroll management when modals are open

### Enhanced Quick Spells Action System
- **Added damage roll functionality**: Spells with damage dice now have dedicated damage roll buttons
- **Expanded spell filtering**: QuickSpells now includes utility spells with damage, not just attack/save spells
- **Consistent UI patterns**: Damage roll buttons match the styling of weapon damage rolls for consistency
- **Automatic damage calculation**: Uses the same `rollDamage` utility as weapons for accurate dice rolling

### Notes Section & Rich Text Editor Improvements
- **Added Notes section**: New dedicated notes area using the same interface as Features and Traits
- **Fixed rich text editor**: Lists (bullet/numbered) and headers (H1/H2) now work properly
- **Improved text rendering**: Consistent styling for rich text content across all editors
- **Better extension configuration**: Explicit TipTap extension setup resolves formatting conflicts
