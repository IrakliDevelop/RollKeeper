import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { useState } from 'react';
import { User, Search, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { Input } from './input';

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
      options: ['default', 'error', 'success'],
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

// Success state
export const SuccessState: Story = {
  args: {
    label: 'Username',
    placeholder: 'Enter username',
    value: 'available_user',
    variant: 'success',
    helperText: 'Username is available!',
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
