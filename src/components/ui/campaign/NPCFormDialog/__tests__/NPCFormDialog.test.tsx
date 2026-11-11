// @vitest-environment jsdom
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NPCFormDialog } from '@/components/ui/campaign/NPCFormDialog';
import { cancelAllDialogs } from '@/components/ui/feedback/confirm-dialog';
import { useEncounterStore } from '@/store/encounterStore';
import { DEFAULT_COMBAT_CONFIG } from '@/types/encounter';
import type { CampaignCreatureKind, CampaignNPC } from '@/types/encounter';
import { renderConfirmDialogHost } from '@/test/confirmDialog';
import { KI, STAT_BLOCK_NPC, withoutMeta } from './npcFormFixtures';

const emptyData = {
  items: [],
  loading: false,
  error: null,
  getItemById: () => undefined,
  getItemByName: () => undefined,
};
vi.mock('@/hooks/useItemsData', () => ({ useItemsData: () => emptyData }));
vi.mock('@/hooks/useMagicItemsData', () => ({
  useMagicItemsData: () => emptyData,
}));
vi.mock('@/hooks/useSpellsData', () => ({
  useSpellsData: () => ({
    spells: [],
    loading: false,
    error: null,
    searchResults: () => [],
    getSpellById: () => undefined,
    getSpellByName: () => undefined,
  }),
}));
vi.mock('@/hooks/useOfficialConditions', () => ({
  useOfficialConditions: () => ({ conditions: [], loading: false }),
}));
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const rest = { ...props };
    delete rest.fill;
    delete rest.priority;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...rest} />;
  },
}));

const S3 = 'https://rollkeeper-images.s3.amazonaws.com/npc';

beforeEach(() => {
  useEncounterStore.setState({ combatConfig: { ...DEFAULT_COMBAT_CONFIG } });
  renderConfirmDialogHost();
});

afterEach(() => {
  cancelAllDialogs();
  cleanup();
  vi.restoreAllMocks();
});

interface RenderOptions {
  editingNpc?: CampaignNPC | null;
  kind?: CampaignCreatureKind;
}

function renderForm({ editingNpc, kind }: RenderOptions = {}) {
  const onSave = vi.fn();
  const onOpenChange = vi.fn();
  const utils = render(
    <NPCFormDialog
      open
      onOpenChange={onOpenChange}
      onSave={onSave}
      editingNpc={editingNpc}
      kind={kind}
    />
  );
  return { onSave, onOpenChange, ...utils };
}

/** Lets a queued confirm (if any) reach the host. */
async function settle() {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

function formDialog(): HTMLElement {
  return screen.getByRole('dialog');
}

function editWith(changes: Partial<CampaignNPC>): CampaignNPC {
  return { ...STAT_BLOCK_NPC, ...changes };
}

function withStatBlock(
  changes: Partial<NonNullable<CampaignNPC['monsterStatBlock']>>
): CampaignNPC {
  return editWith({
    monsterStatBlock: { ...STAT_BLOCK_NPC.monsterStatBlock!, ...changes },
  });
}

const BLOCKER_TEXT = [
  'Add a name to save.',
  'Fix the class resources on the Stat block tab to save.',
  'Fix the resource costs on the Stat block tab to save.',
];

describe('frame', () => {
  it('names the tabs in order inside the NPC form tablist', () => {
    renderForm({ editingNpc: STAT_BLOCK_NPC });
    const tablist = screen.getByRole('tablist', { name: 'NPC form' });
    expect(
      within(tablist)
        .getAllByRole('tab')
        .map(tab => tab.textContent)
    ).toEqual(['Details', 'Stat block', 'Spells', 'Inventory', 'Lore']);
  });

  it('names the tablist for custom monsters', () => {
    renderForm({ kind: 'monster' });
    expect(
      screen.getByRole('tablist', { name: 'Custom monster form' })
    ).toBeTruthy();
  });

  it('opens on Details', () => {
    renderForm({ editingNpc: STAT_BLOCK_NPC });
    expect(
      screen.getByRole('tab', { name: 'Details' }).getAttribute('aria-selected')
    ).toBe('true');
    expect(screen.getByRole('textbox', { name: 'Description' })).toBeTruthy();
  });

  it('shows no icon in any tab', () => {
    renderForm({ editingNpc: STAT_BLOCK_NPC });
    for (const tab of screen.getAllByRole('tab')) {
      expect(tab.querySelector('svg')).toBeNull();
    }
  });

  it('mounts the Lore editor on the Lore tab', async () => {
    const user = userEvent.setup();
    renderForm({ editingNpc: STAT_BLOCK_NPC });
    await user.click(screen.getByRole('tab', { name: 'Lore' }));
    // The panel is labelled by its tab, so look inside it.
    expect(
      within(screen.getByRole('tabpanel')).getByLabelText('Lore')
    ).toBeTruthy();
  });
});

describe('titles', () => {
  it('reads "Create NPC" when creating an NPC', () => {
    renderForm();
    expect(screen.getByRole('heading', { name: 'Create NPC' })).toBeTruthy();
  });

  it('reads "Create custom monster" when creating a custom monster', () => {
    renderForm({ kind: 'monster' });
    expect(
      screen.getByRole('heading', { name: 'Create custom monster' })
    ).toBeTruthy();
  });

  it('names the creature when editing', () => {
    renderForm({ editingNpc: STAT_BLOCK_NPC });
    expect(
      screen.getByRole('heading', { name: 'Edit Brother Oren' })
    ).toBeTruthy();
  });

  it('reads "Edit NPC" when the saved name is blank', () => {
    renderForm({ editingNpc: editWith({ name: '' }) });
    expect(screen.getByRole('heading', { name: 'Edit NPC' })).toBeTruthy();
  });
});

describe('footer', () => {
  it('shows Save changes and Cancel when editing', () => {
    renderForm({ editingNpc: STAT_BLOCK_NPC });
    const save = screen.getByRole('button', { name: 'Save changes' });
    expect(save.getAttribute('data-variant')).toBe('primary');
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
  });

  it('shows the create label when creating', () => {
    renderForm({ kind: 'monster' });
    const create = screen.getByRole('button', {
      name: 'Create custom monster',
    });
    expect(create.getAttribute('data-variant')).toBe('primary');
  });

  it('has exactly one primary button outside the Stat block tab', () => {
    renderForm({ editingNpc: STAT_BLOCK_NPC });
    expect(
      formDialog().querySelectorAll('[data-variant="primary"]')
    ).toHaveLength(1);
  });
});

describe('V198: why Save is disabled', () => {
  it('asks for a name and describes Save with it', () => {
    renderForm();
    const save = screen.getByRole('button', { name: 'Create NPC' });
    expect(save).toBeDisabled();
    const reason = screen.getByText('Add a name to save.');
    expect(reason.id).not.toBe('');
    expect(save.getAttribute('aria-describedby')).toBe(reason.id);
  });

  it('points at the class resources', () => {
    renderForm({ editingNpc: editWith({ resources: [{ ...KI, name: '' }] }) });
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    expect(
      screen.getByText('Fix the class resources on the Stat block tab to save.')
    ).toBeTruthy();
  });

  it('points at the resource costs', async () => {
    // Stored costs are sanitised on load, so the bad amount is typed in.
    const user = userEvent.setup();
    renderForm({ editingNpc: STAT_BLOCK_NPC });
    await user.click(screen.getByRole('tab', { name: 'Stat block' }));
    const amount = screen.getByRole('textbox', {
      name: 'Actions entry resource cost amount',
    });
    await user.tripleClick(amount);
    await user.keyboard('0');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    expect(
      screen.getByText('Fix the resource costs on the Stat block tab to save.')
    ).toBeTruthy();
  });

  it('shows no reason when Save is enabled', () => {
    renderForm({ editingNpc: STAT_BLOCK_NPC });
    const save = screen.getByRole('button', { name: 'Save changes' });
    expect(save).toBeEnabled();
    expect(save.hasAttribute('aria-describedby')).toBe(false);
    for (const text of BLOCKER_TEXT) {
      expect(screen.queryByText(text)).toBeNull();
    }
  });
});

describe('V199: discard confirm', () => {
  it('closes an unchanged edit on Escape without asking', async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderForm({ editingNpc: STAT_BLOCK_NPC });
    await user.keyboard('{Escape}');
    await settle();
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('asks before discarding a changed edit', async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderForm({ editingNpc: STAT_BLOCK_NPC });
    await user.type(
      screen.getByRole('textbox', { name: 'Description' }),
      'Quiet'
    );
    await user.keyboard('{Escape}');
    const alert = await screen.findByRole('alertdialog', {
      name: 'Discard changes to Brother Oren?',
    });
    expect(alert).toHaveTextContent("What you changed here won't be saved.");
    expect(
      within(alert).getByRole('button', { name: 'Discard changes' })
    ).toBeTruthy();
    expect(
      within(alert).getByRole('button', { name: 'Keep editing' })
    ).toBeTruthy();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('Keep editing keeps the form, the draft and focus in the form', async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderForm({ editingNpc: STAT_BLOCK_NPC });
    await user.type(
      screen.getByRole('textbox', { name: 'Description' }),
      'Quiet'
    );
    await user.keyboard('{Escape}');
    const alert = await screen.findByRole('alertdialog');
    await user.click(
      within(alert).getByRole('button', { name: 'Keep editing' })
    );
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox', { name: 'Description' })).toHaveValue(
      'Quiet'
    );
    await waitFor(() =>
      expect(formDialog().contains(document.activeElement)).toBe(true)
    );
  });

  it('Discard changes closes the form once', async () => {
    const user = userEvent.setup();
    const { onOpenChange, onSave } = renderForm({
      editingNpc: STAT_BLOCK_NPC,
    });
    await user.type(
      screen.getByRole('textbox', { name: 'Description' }),
      'Quiet'
    );
    await user.keyboard('{Escape}');
    const alert = await screen.findByRole('alertdialog');
    await user.click(
      within(alert).getByRole('button', { name: 'Discard changes' })
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledTimes(1));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('asks "Discard this NPC?" for a changed create on Cancel', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByPlaceholderText('Brenn Ironhand'), 'Brenn');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(
      await screen.findByRole('alertdialog', { name: 'Discard this NPC?' })
    ).toBeTruthy();
  });

  it('asks "Discard this custom monster?" for a changed monster create', async () => {
    const user = userEvent.setup();
    renderForm({ kind: 'monster' });
    await user.type(screen.getByPlaceholderText('Dire wolf'), 'Dire wolf');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(
      await screen.findByRole('alertdialog', {
        name: 'Discard this custom monster?',
      })
    ).toBeTruthy();
  });

  it('asks "Discard changes?" when the saved name is blank', async () => {
    const user = userEvent.setup();
    renderForm({ editingNpc: editWith({ name: '' }) });
    await user.type(
      screen.getByRole('textbox', { name: 'Description' }),
      'Quiet'
    );
    await user.keyboard('{Escape}');
    expect(
      await screen.findByRole('alertdialog', { name: 'Discard changes?' })
    ).toBeTruthy();
  });

  it('a typed-but-unadded tag does not make the form dirty', async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderForm({ editingNpc: STAT_BLOCK_NPC });
    await user.type(screen.getByPlaceholderText('merchant'), 'ally');
    await user.keyboard('{Escape}');
    await settle();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('a bestiary query alone does not make the form dirty', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () => new Response(JSON.stringify({ monsters: [] }))
    );
    const user = userEvent.setup();
    const { onOpenChange } = renderForm();
    await user.type(
      screen.getByRole('textbox', { name: 'Search the bestiary' }),
      'gob'
    );
    await user.keyboard('{Escape}');
    await settle();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('Q-c3b-2 item 6: saving a changed draft', () => {
  it('saves and closes once without asking', async () => {
    const user = userEvent.setup();
    const { onSave, onOpenChange } = renderForm({
      editingNpc: STAT_BLOCK_NPC,
    });
    await user.type(
      screen.getByRole('textbox', { name: 'Description' }),
      'Quiet'
    );
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await settle();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});

describe('portrait wiring', () => {
  let deletes: string[];

  beforeEach(() => {
    deletes = [];
    let uploads = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.startsWith('/api/npc/upload')) {
        uploads += 1;
        return new Response(
          JSON.stringify({ url: `${S3}/upload-${uploads}.png` })
        );
      }
      if (init?.method === 'DELETE') {
        deletes.push(new URL(url, 'http://localhost').searchParams.get('url')!);
        return new Response('{}');
      }
      return new Response(JSON.stringify({ monsters: [] }));
    });
  });

  async function uploadPortrait(user: ReturnType<typeof userEvent.setup>) {
    const input =
      document.querySelector<HTMLInputElement>('input[type="file"]');
    const file = new File(['x'], 'portrait.png', { type: 'image/png' });
    await user.upload(input!, file);
    await screen.findByRole('button', { name: 'Change portrait' });
  }

  it('discarding after an upload deletes the session upload', async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderForm({ editingNpc: STAT_BLOCK_NPC });
    await uploadPortrait(user);
    await user.keyboard('{Escape}');
    const alert = await screen.findByRole('alertdialog');
    await user.click(
      within(alert).getByRole('button', { name: 'Discard changes' })
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(deletes).toEqual([`${S3}/upload-1.png`]);
  });

  it('saving after Change deletes the earlier upload, never the original', async () => {
    const original = `${S3}/original.png`;
    const user = userEvent.setup();
    const { onSave } = renderForm({
      editingNpc: editWith({ avatarUrl: original }),
    });
    await uploadPortrait(user);
    await waitFor(() =>
      expect(document.querySelector('img')?.getAttribute('src')).toBe(
        `${S3}/upload-1.png`
      )
    );
    await uploadPortrait(user);
    await waitFor(() =>
      expect(document.querySelector('img')?.getAttribute('src')).toBe(
        `${S3}/upload-2.png`
      )
    );
    expect(deletes).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].avatarUrl).toBe(`${S3}/upload-2.png`);
    expect(deletes).toEqual([`${S3}/upload-1.png`]);
  });
});

describe('Q-c3b-1 item 5: stored sizes and types', () => {
  it('shows and saves a size that is not on the list', async () => {
    const user = userEvent.setup();
    const record = withStatBlock({ size: 'Colossal' });
    const { onSave } = renderForm({ editingNpc: record });
    expect(screen.getByRole('combobox', { name: 'Size' })).toHaveTextContent(
      'Colossal'
    );
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onSave.mock.calls[0][0].monsterStatBlock.size).toBe('Colossal');
  });

  it('opens a short-form record clean and saves it in full form', async () => {
    const user = userEvent.setup();
    const record = withStatBlock({ size: 'S', type: 'humanoid' });
    const onSave = vi.fn();
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <NPCFormDialog
        open
        onOpenChange={onOpenChange}
        onSave={onSave}
        editingNpc={record}
      />
    );
    await user.keyboard('{Escape}');
    await settle();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);

    rerender(
      <NPCFormDialog
        open={false}
        onOpenChange={onOpenChange}
        onSave={onSave}
        editingNpc={record}
      />
    );
    rerender(
      <NPCFormDialog
        open
        onOpenChange={onOpenChange}
        onSave={onSave}
        editingNpc={record}
      />
    );
    await user.click(
      await screen.findByRole('button', { name: 'Save changes' })
    );
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toEqual({
      ...withoutMeta(record),
      monsterStatBlock: {
        ...record.monsterStatBlock,
        size: 'Small',
        type: 'Humanoid',
      },
    });
  });
});

describe('ItemForm', () => {
  it('Escape inside ItemForm closes only ItemForm', async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderForm({ editingNpc: STAT_BLOCK_NPC });
    await user.click(screen.getByRole('tab', { name: 'Inventory' }));
    await user.click(screen.getByRole('button', { name: 'Edit Prayer beads' }));
    await screen.findByRole('dialog', { name: 'Edit item' });
    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Edit item' })).toBeNull()
    );
    await settle();
    expect(
      screen.getByRole('dialog', { name: 'Edit Brother Oren' })
    ).toBeTruthy();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
