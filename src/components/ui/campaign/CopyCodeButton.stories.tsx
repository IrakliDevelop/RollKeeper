import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { CopyCodeButton } from './CopyCodeButton';

const meta: Meta<typeof CopyCodeButton> = {
  title: 'Campaign/CopyCodeButton',
  component: CopyCodeButton,
  tags: ['autodocs'],
  args: {
    code: 'K7QX2M',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Large: Story = {
  args: { className: 'type-num-lg' },
};
