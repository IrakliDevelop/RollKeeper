import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, within } from 'storybook/test';
import { Save, Trash2, ArrowRight, Star } from 'lucide-react';
import { Button } from './button';

/**
 * Felt and Brass buttons. `primary` is the one brass action per view,
 * `danger-solid` is only for the confirm button of a destructive dialog, and
 * everything else is an outline or plain text.
 */
const meta: Meta<typeof Button> = {
  title: 'Forms/Button',
  component: Button,
  parameters: {
    layout: 'centered',
    a11y: { test: 'error' },
    docs: {
      description: {
        component:
          'Primary is a brass fill, secondary and outline are a 1px outline, ghost is text only, danger is a blood outline and danger-solid a blood fill. success and warning are deprecated aliases of secondary. Use `selected` for the on state of an outline or ghost toggle.',
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
        'outline',
        'ghost',
        'danger',
        'danger-solid',
        'link',
        'success',
        'warning',
      ],
      description: 'Visual style variant',
    },
    size: {
      control: 'select',
      options: ['xs', 'sm', 'md', 'lg', 'xl'],
      description: 'Button size',
    },
    selected: {
      control: 'boolean',
      description: 'On state of an outline or ghost toggle',
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

export const Default: Story = {
  args: {
    children: 'Button',
  },
};

function VariantRow() {
  return (
    <div className="flex flex-wrap gap-3">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="danger">Danger</Button>
      <Button variant="danger-solid">Danger solid</Button>
      <Button variant="link">Link</Button>
    </div>
  );
}

export const Variants: Story = {
  render: () => <VariantRow />,
};

export const VariantsDark: Story = {
  render: () => <VariantRow />,
  globals: { theme: 'dark' },
};

function ToggleRow() {
  return (
    <div className="flex flex-wrap gap-3">
      <Button variant="outline" selected>
        Equipped
      </Button>
      <Button variant="outline">Equip</Button>
      <Button
        variant="ghost"
        selected
        aria-label="Favorite"
        leftIcon={<Star className="h-4 w-4" />}
      />
      <Button
        variant="ghost"
        aria-label="Not favorite"
        leftIcon={<Star className="h-4 w-4" />}
      />
    </div>
  );
}

export const SelectedToggles: Story = {
  render: () => <ToggleRow />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('button', { name: 'Equipped' })
    ).toHaveAttribute('data-selected', 'true');
    await expect(
      canvas.getByRole('button', { name: 'Equip' })
    ).not.toHaveAttribute('data-selected');
  },
};

export const SelectedTogglesDark: Story = {
  render: () => <ToggleRow />,
  globals: { theme: 'dark' },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="xs">Extra small</Button>
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
      <Button size="xl">Extra large</Button>
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'On a coarse pointer every size grows to at least 44px tall and wide.',
      },
    },
  },
};

export const WithIcons: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <Button variant="primary" leftIcon={<Save className="h-4 w-4" />}>
        Save
      </Button>
      <Button rightIcon={<ArrowRight className="h-4 w-4" />}>Continue</Button>
      <Button variant="danger" leftIcon={<Trash2 className="h-4 w-4" />}>
        Delete
      </Button>
    </div>
  ),
};

export const Loading: Story = {
  args: {
    children: 'Saving',
    loading: true,
    variant: 'primary',
  },
};

export const Disabled: Story = {
  args: {
    children: 'Disabled',
    disabled: true,
  },
};

export const FullWidth: Story = {
  args: {
    children: 'Full width button',
    fullWidth: true,
  },
  decorators: [
    Story => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
};

function DestructiveConfirmRow() {
  return (
    <div className="flex gap-3">
      <Button variant="outline">Cancel</Button>
      <Button variant="danger-solid">Delete template</Button>
    </div>
  );
}

export const DestructiveConfirm: Story = {
  render: () => <DestructiveConfirmRow />,
  parameters: {
    docs: {
      description: {
        story:
          'Only the confirm button inside a destructive dialog uses danger-solid. The button that opens the dialog uses danger.',
      },
    },
  },
};

export const DestructiveConfirmDark: Story = {
  render: () => <DestructiveConfirmRow />,
  globals: { theme: 'dark' },
};
