// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NPCFormDialog } from '@/components/ui/campaign/NPCFormDialog';
import { useEncounterStore } from '@/store/encounterStore';
import { DEFAULT_COMBAT_CONFIG } from '@/types/encounter';
import type { CampaignNPC, CustomCondition } from '@/types/encounter';

// The item databases are fetched on mount; they are irrelevant here.
vi.mock('@/hooks/useItemsData', () => ({
  useItemsData: () => ({
    items: [],
    loading: false,
    error: null,
    getItemById: () => undefined,
    getItemByName: () => undefined,
  }),
}));
vi.mock('@/hooks/useMagicItemsData', () => ({
  useMagicItemsData: () => ({
    items: [],
    loading: false,
    error: null,
    getItemById: () => undefined,
    getItemByName: () => undefined,
  }),
}));

const webbed: CustomCondition = {
  id: 'cc-web',
  name: 'Webbed',
  description: 'Restrained by sticky webbing.',
  icon: 'link',
  kind: 'debuff',
};

const spider: CampaignNPC = {
  id: 'npc-spider',
  campaignCode: 'CAMP01',
  name: 'Giant Spider',
  armorClass: '14',
  maxHp: 26,
  speed: '30 ft., climb 30 ft.',
  monsterStatBlock: {
    str: 14,
    dex: 16,
    con: 12,
    int: 2,
    wis: 11,
    cha: 4,
    saves: '',
    skills: 'Stealth +7',
    speed: '30 ft., climb 30 ft.',
    resistances: '',
    immunities: '',
    vulnerabilities: '',
    conditionImmunities: [],
    senses: 'Darkvision 60 ft.',
    passivePerception: 10,
    traits: [],
    actions: [],
    reactions: [],
    bonusActions: [],
    lairActions: [],
    cr: '1',
    type: 'Beast',
    size: 'Large',
    languages: '',
    alignment: 'Unaligned',
    hpFormula: '4d10+4',
    inflictableConditions: [webbed],
  },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('NPCFormDialog — Inflicts section', () => {
  beforeEach(() => {
    useEncounterStore.setState({
      combatConfig: { ...DEFAULT_COMBAT_CONFIG, customConditions: [webbed] },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('hydrates attached conditions on the Stat Block tab and saves them inside monsterStatBlock', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <NPCFormDialog
        open
        onOpenChange={vi.fn()}
        onSave={onSave}
        editingNpc={spider}
      />
    );

    await user.click(screen.getByRole('tab', { name: /Stat Block/ }));
    expect(screen.getByText('Inflicts')).toBeTruthy();
    expect(screen.getByText('Webbed')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(
      onSave.mock.calls[0][0].monsterStatBlock.inflictableConditions
    ).toEqual([webbed]);
  });

  it('omits the field entirely when nothing is attached', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const plain: CampaignNPC = {
      ...spider,
      monsterStatBlock: {
        ...spider.monsterStatBlock!,
        inflictableConditions: undefined,
      },
    };
    render(
      <NPCFormDialog
        open
        onOpenChange={vi.fn()}
        onSave={onSave}
        editingNpc={plain}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(
      'inflictableConditions' in onSave.mock.calls[0][0].monsterStatBlock
    ).toBe(false);
  });
});
