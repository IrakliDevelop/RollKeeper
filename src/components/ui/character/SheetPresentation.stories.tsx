import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, mocked, userEvent, within } from 'storybook/test';
import { Section, SectionFramesProvider } from '@/components/ui/layout/section';
import { SpellManagement } from '@/components/SpellManagement';
import { useSpellsData } from '@/hooks/useSpellsData';
import { useCharacterStore } from '@/store/characterStore';
import { makeWizard } from '@/utils/__tests__/test-utils';
import type { Spell } from '@/types/character';
import CharacterBasicInfo from './CharacterBasicInfo';

const spell: Spell = {
  id: 'shield',
  name: 'Shield',
  level: 1,
  school: 'Abjuration',
  castingTime: '1 reaction',
  range: 'Self',
  duration: '1 round',
  components: { verbal: true, somatic: true, material: false },
  description: 'A protective barrier.',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};
const character = makeWizard({
  spells: [
    { ...spell, isPrepared: true },
    {
      ...spell,
      id: 'ward',
      name: 'Ward',
      isPrepared: false,
      isAlwaysPrepared: true,
    },
    {
      ...spell,
      id: 'veil',
      name: 'Veil',
      isPrepared: false,
      concentration: true,
    },
  ],
});
const noop = fn();

function SheetPresentation() {
  return (
    <div className="space-y-6 p-4">
      <SectionFramesProvider value={true}>
        <CharacterBasicInfo
          editing={false}
          character={character}
          race="High elf"
          characterClass={character.class}
          level={5}
          background="Sage of the Royal Astronomical Observatory"
          playerName="Sam"
          alignment="Neutral good"
          creatureType="Humanoid"
          getClassDisplayString={() => 'Wizard 5'}
          onUpdateRace={noop}
          onUpdateClass={noop}
          onUpdateLevel={noop}
          onUpdateBackground={noop}
          onUpdatePlayerName={noop}
          onUpdateAlignment={noop}
          onUpdateCreatureType={noop}
          onAddClassLevel={noop}
          onRemoveClassLevel={noop}
          onUpdateClassLevel={noop}
        />
        <Section heading="Spells">
          <SpellManagement />
        </Section>
      </SectionFramesProvider>
    </div>
  );
}

const meta: Meta<typeof SheetPresentation> = {
  title: 'Character/Sheet presentation',
  component: SheetPresentation,
  parameters: {
    layout: 'fullscreen',
    a11y: { test: 'error' },
    viewport: {
      options: {
        phone: {
          name: 'Phone',
          styles: { width: '375px', height: '844px' },
          type: 'mobile',
        },
        narrow: {
          name: 'Narrow phone',
          styles: { width: '320px', height: '800px' },
          type: 'mobile',
        },
      },
    },
  },
  beforeEach: () => {
    localStorage.removeItem('rollkeeper-ui-prefs');
    useCharacterStore.setState({ character });
    mocked(useSpellsData).mockReturnValue({
      spells: [],
      loading: false,
      error: null,
      searchResults: () => [],
      getSpellById: () => undefined,
      getSpellByName: () => undefined,
    });
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const info = canvas.getByRole('region', { name: 'Character information' });
    await expect(within(info).queryByRole('textbox')).toBeNull();
    for (const row of info.querySelectorAll('dd')) {
      await expect(getComputedStyle(row).borderTopStyle).toBe('solid');
      await expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth);
    }
    for (const detail of [false, true]) {
      if (detail)
        await userEvent.click(canvas.getByTitle('Switch to detailed view'));
      const always = canvas.getByRole('button', { name: 'Always prepared' });
      await expect(always).toBeDisabled();
      await expect(
        canvas.getByText('Ward').closest('[data-prepared]')
      ).toHaveAttribute('data-prepared', 'true');
      const unprepared = canvas.getByRole('button', { name: 'Prepare' });
      await userEvent.click(unprepared);
      await expect(
        canvas.getByText('Veil').closest('[data-prepared]')
      ).toHaveAttribute('data-prepared', 'true');
      await userEvent.click(
        canvas.getAllByRole('button', { name: 'Prepared' })[1]
      );
      await expect(
        canvas.getByText('Veil').closest('[data-prepared]')
      ).toHaveAttribute('data-prepared', 'false');
      const doc = canvasElement.ownerDocument.documentElement;
      await expect(doc.scrollWidth).toBeLessThanOrEqual(doc.clientWidth);
    }
  },
};
export default meta;
type Story = StoryObj<typeof meta>;
export const Light: Story = {};
export const Dark: Story = { globals: { theme: 'dark' } };
export const Blue: Story = { globals: { theme: 'blue' } };
export const Phone: Story = {
  globals: { viewport: { value: 'phone', isRotated: false } },
};
export const NarrowPhoneBlue: Story = {
  globals: { theme: 'blue', viewport: { value: 'narrow', isRotated: false } },
};
