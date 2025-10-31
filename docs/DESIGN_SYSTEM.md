# RollKeeper Design System

A modern, accessible, and consistent design system built on Radix UI primitives, Tailwind CSS, and Framer Motion.

## Table of Contents

1. [Overview](#overview)
2. [Design Principles](#design-principles)
3. [Design Tokens](#design-tokens)
4. [Getting Started](#getting-started)
5. [Component Library](#component-library)
6. [Accessibility](#accessibility)
7. [Best Practices](#best-practices)

---

## Overview

The RollKeeper Design System provides a unified set of reusable components that ensure consistency, accessibility, and maintainability across the application.

### Key Features

- **Built on Radix UI** - Accessible primitives with full keyboard navigation
- **Type-Safe** - Complete TypeScript support with exported prop types
- **Consistent** - Centralized design tokens for colors, spacing, typography
- **Performant** - Lightweight animations with CSS and selective Framer Motion
- **Flexible** - Multiple variants and sizes for each component
- **Modern** - Clean, polished UI with subtle micro-interactions

### Technology Stack

- **React 19** - Latest React features
- **Radix UI** - Accessible component primitives
- **Tailwind CSS** - Utility-first styling
- **class-variance-authority** - Type-safe variant management
- **Framer Motion** - Smooth animations
- **TypeScript** - Type safety

---

## Design Principles

### 1. Clarity & Readability

- High contrast text (WCAG AA compliant)
- Clear typography hierarchy
- Readable font sizes (minimum 14px for body text)
- Adequate spacing between elements

### 2. Consistency

- Predictable component behavior
- Uniform spacing scale (4px base)
- Consistent color palette
- Standardized animations

### 3. Accessibility

- Keyboard navigation support
- Screen reader friendly
- ARIA labels and descriptions
- Focus indicators on all interactive elements
- Proper heading hierarchy

### 4. Responsiveness

- Mobile-first approach
- Touch-friendly tap targets (minimum 44x44px)
- Fluid typography
- Responsive spacing

### 5. Performance

- Lightweight components
- Lazy-loaded animations
- Minimal re-renders
- Optimized bundle size

### 6. Polish

- Subtle shadows for depth
- Smooth transitions (200ms default)
- Delightful micro-interactions
- Professional gradients on primary actions

---

## Design Tokens

Design tokens are centralized in `/src/components/ui/primitives/design-tokens.ts`.

### Colors

#### Primary (Emerald/Green)
```typescript
colors.primary[500]  // #10b981 - Main primary color
colors.primary[600]  // #059669 - Hover state
colors.primary[700]  // #047857 - Active state
```

#### Secondary (Blue)
```typescript
colors.secondary[500]  // #3b82f6
colors.secondary[600]  // #2563eb
```

#### Success (Green)
```typescript
colors.success[500]  // #22c55e
```

#### Danger (Red)
```typescript
colors.danger[500]  // #ef4444
```

#### Warning (Amber)
```typescript
colors.warning[500]  // #f59e0b
```

#### Neutral (Gray/Slate)
```typescript
colors.neutral[50]   // Very light gray
colors.neutral[500]  // Medium gray
colors.neutral[900]  // Very dark gray
```

### Spacing

Based on a 4px scale:

```typescript
spacing.xs   // 4px
spacing.sm   // 8px
spacing.md   // 12px
spacing.lg   // 16px
spacing.xl   // 24px
spacing.2xl  // 32px
```

### Typography

```typescript
fontSize.xs      // 12px
fontSize.sm      // 14px
fontSize.base    // 16px
fontSize.lg      // 18px
fontSize.xl      // 20px
fontSize.2xl     // 24px

fontWeight.normal    // 400
fontWeight.medium    // 500
fontWeight.semibold  // 600
fontWeight.bold      // 700
```

### Shadows

```typescript
shadows.sm   // Subtle shadow
shadows.md   // Medium shadow (default)
shadows.lg   // Prominent shadow
shadows.xl   // Large shadow for modals
```

### Border Radius

```typescript
borderRadius.sm   // 6px
borderRadius.md   // 8px
borderRadius.lg   // 12px
borderRadius.xl   // 16px
```

### Transitions

```typescript
transitions.fast    // 150ms
transitions.normal  // 200ms (default)
transitions.slow    // 300ms
```

---

## Getting Started

### Installation

Components are already integrated into the project. Import from `@/components/ui/`:

```typescript
import { Button } from '@/components/ui/forms';
import { Card } from '@/components/ui/layout';
```

### Basic Usage

```typescript
import { Button, Input } from '@/components/ui/forms';

function MyForm() {
  const [value, setValue] = useState('');

  return (
    <form>
      <Input
        label="Email"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Enter your email"
      />
      <Button type="submit">Submit</Button>
    </form>
  );
}
```

### Design Tokens Usage

```typescript
import { colors, spacing } from '@/components/ui/primitives';

// Use in custom components
const customStyles = {
  color: colors.primary[600],
  padding: spacing.md,
};
```

---

## Component Library

### Form Components

- **Button** - Primary action buttons with variants
- **Input** - Text input fields with labels and validation
- **Textarea** - Multi-line text input with auto-resize
- **Select** - Dropdown selection with search
- **Checkbox** - Toggle options with labels
- **Switch** - On/off toggle switches
- **RadioGroup** - Single selection from multiple options

### Layout Components

- **Card** - Container component with variants
- **Badge** - Labels for status and categories
- **CollapsibleSection** - Expandable content sections
- **Tabs** - Tabbed navigation
- **DragDropList** - Sortable lists

### Feedback Components

- **Dialog** - Modal dialogs and overlays
- **Toast** - Notification messages
- **Modal** - Legacy modal (being deprecated)

### Utility Components

- **RichTextEditor** - WYSIWYG text editor
- **VirtualizedList** - Performance-optimized lists

See [COMPONENT_GUIDE.md](./COMPONENT_GUIDE.md) for detailed usage examples.

---

## Accessibility

### Keyboard Navigation

All interactive components support keyboard navigation:

- **Tab** - Move between interactive elements
- **Enter/Space** - Activate buttons, checkboxes, radio buttons
- **Escape** - Close modals, dropdowns
- **Arrow keys** - Navigate select options, radio groups

### Screen Readers

- All form inputs have associated labels
- Icon-only buttons include `aria-label`
- Error messages are announced
- Loading states are communicated

### Focus Management

- Visible focus indicators on all interactive elements
- Focus trap in modals
- Logical tab order

### Color Contrast

- All text meets WCAG AA standards (4.5:1 for normal text, 3:1 for large text)
- Interactive elements have clear hover/active states

---

## Best Practices

### Component Selection

**Use buttons for actions:**
```typescript
// ✅ Good
<Button onClick={handleSave}>Save</Button>

// ❌ Avoid
<div onClick={handleSave}>Save</div>
```

**Use proper form elements:**
```typescript
// ✅ Good
<Input label="Name" />

// ❌ Avoid
<input placeholder="Name" />
```

### Variant Usage

**Primary buttons for main actions:**
```typescript
<Button variant="primary">Save Changes</Button>
<Button variant="outline">Cancel</Button>
```

**Danger buttons for destructive actions:**
```typescript
<Button variant="danger">Delete Account</Button>
```

**Ghost/link buttons for tertiary actions:**
```typescript
<Button variant="ghost">Learn More</Button>
```

### Sizing

**Use consistent sizes:**
```typescript
// Form inputs
<Input size="md" />  // Default, most common
<Input size="sm" />  // Compact spaces
<Input size="lg" />  // Emphasis

// Buttons
<Button size="md" />  // Default
<Button size="sm" />  // Inline actions
<Button size="lg" />  // Primary CTAs
```

### Loading States

```typescript
<Button loading disabled>
  Saving...
</Button>
```

### Error Handling

```typescript
<Input
  label="Email"
  error="Please enter a valid email"
  variant="error"
/>
```

### Composition

**Build complex UIs with simple components:**
```typescript
<Card>
  <CardHeader>
    <CardTitle>User Profile</CardTitle>
    <CardDescription>Manage your account settings</CardDescription>
  </CardHeader>
  <CardContent>
    <Input label="Name" />
    <Input label="Email" type="email" />
  </CardContent>
  <CardFooter>
    <Button variant="outline">Cancel</Button>
    <Button>Save</Button>
  </CardFooter>
</Card>
```

### Performance

**Use React.memo for frequently rendered components:**
```typescript
const MyButton = React.memo(({ onClick, children }) => (
  <Button onClick={onClick}>{children}</Button>
));
```

**Lazy load heavy components:**
```typescript
const RichTextEditor = lazy(() => import('@/components/ui/forms/RichTextEditor'));
```

---

## Examples

### Login Form

```typescript
import { Button, Input } from '@/components/ui/forms';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/layout';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Sign In</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={error}
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </CardContent>
      <CardFooter>
        <Button fullWidth>Sign In</Button>
      </CardFooter>
    </Card>
  );
}
```

### Settings Panel

```typescript
import { Switch, SelectField, SelectItem } from '@/components/ui/forms';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/layout';

function Settings() {
  const [notifications, setNotifications] = useState(true);
  const [theme, setTheme] = useState('light');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preferences</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Switch
          checked={notifications}
          onCheckedChange={setNotifications}
          label="Enable notifications"
          description="Receive updates about your account"
        />
        
        <SelectField
          label="Theme"
          value={theme}
          onValueChange={setTheme}
        >
          <SelectItem value="light">Light</SelectItem>
          <SelectItem value="dark">Dark</SelectItem>
          <SelectItem value="system">System</SelectItem>
        </SelectField>
      </CardContent>
    </Card>
  );
}
```

---

## Contributing

When adding new components:

1. Use Radix UI primitives when available
2. Follow existing variant patterns
3. Use design tokens for colors, spacing, typography
4. Include accessibility features
5. Write TypeScript with proper prop types
6. Export prop types for consumers
7. Add JSDoc comments
8. Test keyboard navigation
9. Verify screen reader support

---

## Resources

- [Radix UI Documentation](https://www.radix-ui.com/)
- [Tailwind CSS Documentation](https://tailwindcss.com/)
- [Class Variance Authority](https://cva.style/)
- [Framer Motion](https://www.framer.com/motion/)
- [WCAG Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

---

**Version:** 1.0.0  
**Last Updated:** October 31, 2025

