import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, within } from 'storybook/test';
import { useState } from 'react';
import { User, Search, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { emulateCoarsePointer } from '@/test/storybook/emulateCoarsePointer';
import { Input } from './input';
import { NumberField } from './NumberInput';

/**
 * The Input component is a flexible text input with support for labels,
 * helper text, error states, and prefix/suffix icons.
 */
const meta: Meta<typeof Input> = {
  title: 'Forms/Input',
  component: Input,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A versatile input field with labels, icons, validation states, and clearable functionality.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'error'],
      description: 'Visual variant for validation states',
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
      description: 'Input size',
    },
    label: {
      control: 'text',
      description: 'Label text displayed above the input',
    },
    helperText: {
      control: 'text',
      description: 'Helper text displayed below the input',
    },
    error: {
      control: 'text',
      description: 'Error message (overrides helperText)',
    },
    clearable: {
      control: 'boolean',
      description: 'Shows clear button when input has value',
    },
    disabled: {
      control: 'boolean',
      description: 'Disables the input',
    },
    required: {
      control: 'boolean',
      description: 'Marks the input as required',
    },
  },
  args: {
    onChange: fn(),
    onClear: fn(),
  },
  decorators: [
    Story => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Default story
export const Default: Story = {
  args: {
    placeholder: 'Enter text...',
  },
};

// With label
export const WithLabel: Story = {
  args: {
    label: 'Email Address',
    placeholder: 'you@example.com',
    type: 'email',
  },
};

// Required field
export const Required: Story = {
  args: {
    label: 'Username',
    placeholder: 'Enter username',
    required: true,
  },
};

// With helper text
export const WithHelperText: Story = {
  args: {
    label: 'Password',
    type: 'password',
    placeholder: 'Enter password',
    helperText: 'Must be at least 8 characters',
  },
};

// Error state
export const ErrorState: Story = {
  args: {
    label: 'Email',
    placeholder: 'Enter email',
    value: 'invalid-email',
    error: 'Please enter a valid email address',
  },
};

// With left icon
export const WithLeftIcon: Story = {
  args: {
    label: 'Username',
    placeholder: 'Enter username',
    leftIcon: <User className="h-4 w-4" />,
  },
};

// Search input
export const SearchInput: Story = {
  args: {
    placeholder: 'Search...',
    leftIcon: <Search className="h-4 w-4" />,
  },
};

// Clearable input (interactive)
export const Clearable: Story = {
  render: function ClearableStory() {
    const [value, setValue] = useState('Some text to clear');
    return (
      <Input
        label="Search"
        placeholder="Type to search..."
        leftIcon={<Search className="h-4 w-4" />}
        value={value}
        onChange={e => setValue(e.target.value)}
        clearable
        onClear={() => setValue('')}
      />
    );
  },
  parameters: {
    docs: {
      description: {
        story:
          'Input with a clear button that appears when the field has a value.',
      },
    },
  },
};

// All sizes
export const Sizes: Story = {
  render: () => (
    <div className="space-y-4">
      <Input size="sm" placeholder="Small input" label="Small" />
      <Input size="md" placeholder="Medium input" label="Medium" />
      <Input size="lg" placeholder="Large input" label="Large" />
    </div>
  ),
};

// Disabled state
export const Disabled: Story = {
  args: {
    label: 'Disabled Input',
    placeholder: 'Cannot edit',
    value: 'Disabled value',
    disabled: true,
  },
};

// Password input with toggle (interactive)
export const PasswordWithToggle: Story = {
  render: function PasswordStory() {
    const [showPassword, setShowPassword] = useState(false);
    return (
      <Input
        label="Password"
        type={showPassword ? 'text' : 'password'}
        placeholder="Enter password"
        leftIcon={<Lock className="h-4 w-4" />}
        rightIcon={
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="focus:outline-none"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        }
      />
    );
  },
};

// Form example
export const FormExample: Story = {
  render: () => (
    <div className="space-y-4">
      <Input
        label="Full Name"
        placeholder="John Doe"
        leftIcon={<User className="h-4 w-4" />}
        required
      />
      <Input
        label="Email"
        type="email"
        placeholder="john@example.com"
        leftIcon={<Mail className="h-4 w-4" />}
        required
      />
      <Input
        label="Password"
        type="password"
        placeholder="••••••••"
        leftIcon={<Lock className="h-4 w-4" />}
        helperText="Must be at least 8 characters"
        required
      />
    </div>
  ),
  decorators: [
    Story => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        story: 'Example of inputs used together in a form context.',
      },
    },
  },
};

function FieldStates() {
  return (
    <div className="w-80 space-y-4">
      <Input label="Character name" placeholder="Thorin" />
      <Input
        label="Level"
        defaultValue="3"
        helperText="Sets your proficiency bonus"
      />
      <Input label="Speed" defaultValue="-5" error="Speed can't be negative" />
      <Input label="Class" defaultValue="Fighter" disabled />
    </div>
  );
}

export const States: Story = {
  render: () => <FieldStates />,
  parameters: { a11y: { test: 'error' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const speed = canvas.getByLabelText('Speed');
    await expect(speed).toHaveAttribute('aria-invalid', 'true');
    await expect(speed).toHaveAccessibleDescription("Speed can't be negative");

    const name = canvas.getByLabelText('Character name');
    name.focus();
    const focused = getComputedStyle(name);
    await expect(focused.outlineStyle).toBe('solid');
    await expect(focused.outlineWidth).toBe('2px');
    await expect(focused.outlineOffset).toBe('2px');
    await expect(focused.borderTopLeftRadius).toBe('4px');
  },
};

export const StatesDark: Story = {
  render: () => <FieldStates />,
  parameters: { a11y: { test: 'error' } },
  globals: { theme: 'dark' },
};

/**
 * Fields as a touch device sees them: small text grows to 16px so iOS
 * Safari doesn't zoom on focus, large numbers keep their size, and inputs
 * reach 44px. The play function copies the coarse-pointer rules in, since
 * the test browser has a fine pointer.
 */
function TouchFields() {
  return (
    <div className="w-80 space-y-4">
      <Input aria-label="Small field" />
      <Input aria-label="Large field" size="lg" />
      <NumberField
        aria-label="Bonus"
        className="text-xs"
        value={2}
        onChange={() => {}}
      />
      <input aria-label="Ability score" className="text-2xl" />
      <div className="text-xs">
        <input aria-label="Inherits small" />
      </div>
      <div className="text-2xl">
        <input aria-label="Inherits large" />
      </div>
    </div>
  );
}

export const CoarsePointer: Story = {
  render: () => <TouchFields />,
  parameters: { a11y: { test: 'error' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const size = (name: string) =>
      getComputedStyle(canvas.getByLabelText(name)).fontSize;

    await expect(size('Small field')).toBe('14px');
    const restore = emulateCoarsePointer();
    try {
      await expect(size('Small field')).toBe('16px');
      await expect(size('Large field')).toBe('16px');
      await expect(size('Bonus')).toBe('16px');
      await expect(size('Ability score')).toBe('24px');
      await expect(size('Inherits small')).toBe('16px');
      await expect(size('Inherits large')).toBe('24px');
      await expect(
        getComputedStyle(canvas.getByLabelText('Small field')).minHeight
      ).toBe('44px');
    } finally {
      restore();
    }
    await expect(size('Small field')).toBe('14px');
  },
};
