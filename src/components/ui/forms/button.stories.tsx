import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { Save, Download, Upload, Trash2, Plus, ArrowRight } from 'lucide-react';
import { Button } from './button';

/**
 * The Button component is a versatile action trigger supporting multiple variants,
 * sizes, icons, and loading states. Built with Radix UI Slot for composition.
 */
const meta: Meta<typeof Button> = {
  title: 'Forms/Button',
  component: Button,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A flexible button component with gradient variants, icon support, and loading states.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'primary',
        'secondary',
        'success',
        'danger',
        'warning',
        'outline',
        'ghost',
        'link',
      ],
      description: 'Visual style variant',
    },
    size: {
      control: 'select',
      options: ['xs', 'sm', 'md', 'lg', 'xl'],
      description: 'Button size',
    },
    fullWidth: {
      control: 'boolean',
      description: 'Whether button should take full width',
    },
    loading: {
      control: 'boolean',
      description: 'Shows loading spinner and disables button',
    },
    disabled: {
      control: 'boolean',
      description: 'Disables button interaction',
    },
  },
  args: {
    onClick: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Default story
export const Default: Story = {
  args: {
    children: 'Button',
    variant: 'primary',
    size: 'md',
  },
};

// All variants
export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="success">Success</Button>
      <Button variant="danger">Danger</Button>
      <Button variant="warning">Warning</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'All available button variants. Primary buttons have gradient backgrounds for emphasis.',
      },
    },
  },
};

// All sizes
export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="xs">Extra Small</Button>
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
      <Button size="xl">Extra Large</Button>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Buttons come in five sizes from extra small to extra large.',
      },
    },
  },
};

// With left icon
export const WithLeftIcon: Story = {
  args: {
    children: 'Save Changes',
    leftIcon: <Save className="h-4 w-4" />,
    variant: 'primary',
  },
};

// With right icon
export const WithRightIcon: Story = {
  args: {
    children: 'Continue',
    rightIcon: <ArrowRight className="h-4 w-4" />,
    variant: 'primary',
  },
};

// Icon examples
export const IconExamples: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Button leftIcon={<Save className="h-4 w-4" />}>Save</Button>
      <Button leftIcon={<Download className="h-4 w-4" />} variant="secondary">
        Download
      </Button>
      <Button leftIcon={<Upload className="h-4 w-4" />} variant="outline">
        Upload
      </Button>
      <Button leftIcon={<Trash2 className="h-4 w-4" />} variant="danger">
        Delete
      </Button>
      <Button leftIcon={<Plus className="h-4 w-4" />} variant="success">
        Add New
      </Button>
      <Button rightIcon={<ArrowRight className="h-4 w-4" />}>Continue</Button>
    </div>
  ),
};

// Loading state
export const Loading: Story = {
  args: {
    children: 'Saving...',
    loading: true,
    variant: 'primary',
  },
};

// Disabled state
export const Disabled: Story = {
  args: {
    children: 'Disabled',
    disabled: true,
    variant: 'primary',
  },
};

// Full width
export const FullWidth: Story = {
  args: {
    children: 'Full Width Button',
    fullWidth: true,
    variant: 'primary',
  },
  decorators: [
    Story => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
};

// Interactive states demo
export const InteractiveStates: Story = {
  render: () => (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Button variant="primary">Normal</Button>
        <Button variant="primary" disabled>
          Disabled
        </Button>
        <Button variant="primary" loading>
          Loading
        </Button>
      </div>
      <p className="text-sm text-gray-600">
        Hover and focus on buttons to see interactive states. Try tabbing
        through with keyboard.
      </p>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Demonstrates normal, disabled, and loading states side by side.',
      },
    },
  },
};

// Danger actions
export const DangerActions: Story = {
  render: () => (
    <div className="flex gap-3">
      <Button variant="danger">Delete</Button>
      <Button variant="outline">Cancel</Button>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Use danger variant for destructive actions. Pair with outline for cancel option.',
      },
    },
  },
};
