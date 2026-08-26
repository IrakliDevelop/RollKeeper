import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { fn } from 'storybook/test';
import { TraitTracker } from './TraitTracker';
import type { TrackableTrait } from '@/types/character';

const sampleTraits: TrackableTrait[] = [
  {
    id: '1',
    name: 'Second Wind',
    description: 'Regain 1d10 + fighter level hit points.',
    maxUses: 1,
    usedUses: 1,
    restType: 'short',
    source: 'Class Feature',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    name: 'Action Surge',
    description: 'Take one additional action on your turn.',
    maxUses: 1,
    usedUses: 0,
    restType: 'short',
    source: 'Class Feature',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '3',
    name: 'Relentless Endurance',
    description:
      'When reduced to 0 HP but not killed outright, drop to 1 HP instead.',
    maxUses: 1,
    usedUses: 0,
    restType: 'long',
    source: 'Racial',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '4',
    name: 'Darkvision',
    description: 'See in dim light within 60 feet as if it were bright light.',
    maxUses: 0,
    usedUses: 0,
    restType: 'long',
    source: 'Racial',
    isPassive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

const meta: Meta<typeof TraitTracker> = {
  component: TraitTracker,
  tags: ['autodocs'],
  args: {
    traits: sampleTraits,
    characterLevel: 5,
    onUpdateTrait: fn(),
    onDeleteTrait: fn(),
    onUseTrait: fn(),
    onResetTraits: fn(),
    onTraitClick: fn(),
  },
  decorators: [
    Story => (
      <div style={{ maxWidth: 500 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const WithTraits: Story = {};

export const WithTraitsDark: Story = {
  globals: { theme: 'dark' },
};

export const Empty: Story = {
  args: { traits: [] },
};

export const EmptyDark: Story = {
  ...Empty,
  globals: { theme: 'dark' },
};

export const Readonly: Story = {
  args: { readonly: true },
};

export const ReadonlyDark: Story = {
  ...Readonly,
  globals: { theme: 'dark' },
};

export const Compact: Story = {
  args: { compact: true },
};

export const CompactDark: Story = {
  ...Compact,
  globals: { theme: 'dark' },
};
