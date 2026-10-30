import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, within } from 'storybook/test';
import { makeCharacter } from '@/utils/__tests__/test-utils';
import { useCharacterStore } from '@/store/characterStore';
import { remountOnTheme } from '@/components/ui/foundations/remountOnTheme';
import ConditionsDiseasesManager from './ConditionsDiseasesManager';
import TemporaryBuffsManager from './TemporaryBuffsManager';
import DefensesAndSenses from './DefensesAndSenses';
import { SummonsSubTab } from '@/components/ui/character/summons/SummonsSubTab';

const meta: Meta = {
  title: 'Game/Combat effects',
  parameters: { layout: 'fullscreen', a11y: { test: 'error' } },
  decorators: [remountOnTheme],
};
export default meta;
type Story = StoryObj<typeof meta>;

function EffectsFixture({
  populated,
  editing,
}: {
  populated: boolean;
  editing: boolean;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const character = makeCharacter();
    if (populated) {
      character.conditionsAndDiseases.activeConditions = [
        {
          id: 'poison',
          name: 'Poisoned',
          kind: 'debuff',
          count: 1,
          stackable: false,
          source: 'XPHB',
          description: 'Poisoned rules',
          appliedAt: '2026-10-30',
        },
        {
          id: 'exhaustion',
          name: 'Exhaustion',
          kind: 'debuff',
          count: 2,
          stackable: true,
          source: 'XPHB',
          description: 'Exhaustion rules',
          appliedAt: '2026-10-30',
        },
      ];
      character.conditionsAndDiseases.activeDiseases = [
        {
          id: 'fever',
          name: 'Cackle Fever',
          source: 'DMG',
          description: 'Fever rules',
          appliedAt: '2026-10-30',
        },
      ];
      character.temporaryBuffs = [
        {
          id: 'buff',
          name: 'Wild Shape temporary hit points',
          source: 'Class feature',
          isActive: true,
          createdAt: '2026-10-30',
          updatedAt: '2026-10-30',
          effects: [
            { id: 'temp', targetStat: 'tempHp', mode: 'grant', value: 10 },
          ],
        },
      ];
      character.damageResistances = ['Fire', 'Cold'];
      character.senses = [
        {
          id: 'darkvision',
          name: 'Darkvision',
          range: 60,
          source: 'Ancestry',
          createdAt: '2026-10-30',
          updatedAt: '2026-10-30',
        },
      ];
      character.summons = [
        {
          id: 'summon',
          type: 'summon',
          sourceSpellName: 'Conjure Animals',
          requiresConcentration: true,
          createdAt: '2026-10-30',
          entity: {
            id: 'summon-entity',
            type: 'monster',
            name: 'Very long summoned creature name',
            initiative: null,
            initiativeModifier: 0,
            currentHp: 20,
            maxHp: 20,
            tempHp: 0,
            armorClass: 13,
            conditions: [{ id: 'prone', name: 'Prone' }],
          },
        },
      ];
    }
    useCharacterStore.setState({ character });
    setReady(true);
  }, [populated]);
  if (!ready) return null;
  return (
    <main className="bg-background text-body mx-auto max-w-6xl space-y-8 p-4">
      <ConditionsDiseasesManager />
      <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <TemporaryBuffsManager />
        <DefensesAndSenses editing={editing} />
      </div>
      <SummonsSubTab />
    </main>
  );
}

export const PopulatedPlay: Story = {
  render: () => <EffectsFixture populated editing={false} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText('Very long summoned creature name')
    ).toBeInTheDocument();
    await expect(
      canvas.getByText('Wild Shape temporary hit points')
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole('heading', { name: /Defenses and senses/ })
    ).toBeInTheDocument();
    await expect(
      canvas.queryByRole('button', { name: 'Remove Fire' })
    ).toBeNull();
  },
};
export const PopulatedEdit: Story = {
  render: () => <EffectsFixture populated editing />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole('button', { name: 'Remove Fire' })
    ).toBeInTheDocument();
  },
};
export const Empty: Story = {
  render: () => <EffectsFixture populated={false} editing={false} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText('No summons')).toBeInTheDocument();
  },
};
