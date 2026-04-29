import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import CharacterHUD from './CharacterHUD';
import { makeCharacter } from '@/utils/__tests__/test-utils';

const healthyCharacter = makeCharacter({
  hitPoints: { current: 44, max: 44, temporary: 0, calculationMode: 'auto' },
});

const lowHPCharacter = makeCharacter({
  hitPoints: { current: 8, max: 44, temporary: 0, calculationMode: 'auto' },
});

const tempHPCharacter = makeCharacter({
  hitPoints: { current: 30, max: 44, temporary: 10, calculationMode: 'auto' },
});

const meta: Meta<typeof CharacterHUD> = {
  component: CharacterHUD,
  tags: ['autodocs'],
  args: {
    character: healthyCharacter,
    onShortRest: fn(),
    onLongRest: fn(),
    onIncrementDays: fn(),
    onDecrementDays: fn(),
    onToggleInspiration: fn(),
    onToggleReaction: fn(),
    onUseBardicInspiration: fn(),
    onRestoreBardicInspiration: fn(),
    onStopConcentration: fn(),
    onNavigateToConditions: fn(),
    onNavigateToBuffs: fn(),
    onNavigateToCombat: fn(),
    onNavigateToSpells: fn(),
    onToggleBuff: fn(),
    onUpdateCharacter: fn(),
  },
  decorators: [
    Story => (
      <div style={{ maxWidth: 700 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Healthy: Story = {};

export const HealthyDark: Story = {
  globals: { theme: 'dark' },
};

export const LowHP: Story = {
  args: { character: lowHPCharacter },
};

export const LowHPDark: Story = {
  ...LowHP,
  globals: { theme: 'dark' },
};

export const WithTempHP: Story = {
  args: { character: tempHPCharacter },
};

export const WithTempHPDark: Story = {
  ...WithTempHP,
  globals: { theme: 'dark' },
};
