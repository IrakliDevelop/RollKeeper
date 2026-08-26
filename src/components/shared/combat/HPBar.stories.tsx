import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { HPBar } from './HPBar';

const meta: Meta<typeof HPBar> = {
  component: HPBar,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  decorators: [
    Story => (
      <div style={{ width: 300 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Full: Story = {
  args: { current: 40, max: 40, showLabel: true },
};

export const FullDark: Story = {
  ...Full,
  globals: { theme: 'dark' },
};

export const Half: Story = {
  args: { current: 20, max: 40, showLabel: true },
};

export const HalfDark: Story = {
  ...Half,
  globals: { theme: 'dark' },
};

export const Critical: Story = {
  args: { current: 8, max: 40, showLabel: true },
};

export const CriticalDark: Story = {
  ...Critical,
  globals: { theme: 'dark' },
};

export const WithTempHP: Story = {
  args: { current: 30, max: 40, temp: 10, showLabel: true },
};

export const WithTempHPDark: Story = {
  ...WithTempHP,
  globals: { theme: 'dark' },
};
