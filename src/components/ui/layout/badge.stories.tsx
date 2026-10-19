import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, within } from 'storybook/test';
import { Badge } from './badge';

/**
 * Felt and Brass badges: a 1px outline in the role colour with no fill.
 * success is verdigris, warning ember, danger blood and primary brass.
 * info, secondary and outline render as neutral.
 */
const meta: Meta<typeof Badge> = {
  title: 'Layout/Badge',
  component: Badge,
  parameters: {
    layout: 'centered',
    a11y: { test: 'error' },
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'neutral',
        'primary',
        'success',
        'warning',
        'danger',
        'info',
        'secondary',
        'outline',
      ],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'Level 3',
  },
};

function RoleRow() {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge>Neutral</Badge>
      <Badge variant="primary">Inspired</Badge>
      <Badge variant="success">Healed</Badge>
      <Badge variant="warning">Poisoned</Badge>
      <Badge variant="danger">Dying</Badge>
    </div>
  );
}

export const Roles: Story = {
  render: () => <RoleRow />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('Neutral')).toHaveAttribute(
      'data-variant',
      'neutral'
    );
    await expect(canvas.getByText('Dying')).toHaveAttribute(
      'data-variant',
      'danger'
    );
  },
};

export const RolesDark: Story = {
  render: () => <RoleRow />,
  globals: { theme: 'dark' },
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge size="sm">Small</Badge>
      <Badge size="md">Medium</Badge>
      <Badge size="lg">Large</Badge>
    </div>
  ),
};
