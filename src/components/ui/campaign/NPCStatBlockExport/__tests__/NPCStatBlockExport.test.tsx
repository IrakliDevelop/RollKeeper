// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NPCStatBlockExport } from '..';

import type { CampaignNPC, MonsterStatBlock } from '@/types/encounter';

const toPng = vi.hoisted(() => vi.fn());
vi.mock('html-to-image', () => ({ toPng }));

const statBlock: MonsterStatBlock = {
  str: 10,
  dex: 14,
  con: 12,
  int: 10,
  wis: 10,
  cha: 8,
  saves: '',
  skills: '',
  speed: '30 ft.',
  resistances: '',
  immunities: '',
  vulnerabilities: '',
  conditionImmunities: ['charmed'],
  senses: '',
  passivePerception: 10,
  traits: [{ id: 't1', name: 'Keen Eyes', text: 'Sharp.' }],
  actions: [{ id: 'a1', name: 'Slash', text: 'Hits.' }],
  reactions: [],
  bonusActions: [{ id: 'b1', name: 'Dash', text: 'Runs.' }],
  lairActions: [{ id: 'l1', name: 'Tremor', text: 'Shakes.' }],
  cr: '2',
  type: 'humanoid',
  size: 'Medium',
  languages: 'Common',
  alignment: 'neutral good',
  hpFormula: '4d8 + 4',
};

const makeNpc = (overrides: Partial<CampaignNPC> = {}): CampaignNPC => ({
  id: 'npc-1',
  campaignCode: 'ABC123',
  name: 'Brenn Tallow',
  armorClass: '15',
  tempAc: '+2',
  maxHp: 22,
  speed: '30 ft.',
  monsterStatBlock: statBlock,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const COPY_FAILED = "Couldn't copy the image. Download it instead.";
const SAVE_FAILED = "The image wasn't saved. Try again.";

const stubClipboard = (
  write: (
    items: Array<{ items: Record<string, Blob | Promise<Blob>> }>
  ) => Promise<void>
) => {
  vi.stubGlobal(
    'ClipboardItem',
    class {
      constructor(public items: Record<string, Blob | Promise<Blob>>) {}
    }
  );
  // Like a real clipboard, the write settles only once every item's blob
  // promise has, and rejects when one of them rejects.
  Object.defineProperty(navigator, 'clipboard', {
    value: {
      write: (
        items: Array<{ items: Record<string, Blob | Promise<Blob>> }>
      ) => {
        const result = write(items);
        const blobs = items.flatMap(item => Object.values(item.items));
        return Promise.all([...blobs, result]).then(() => undefined);
      },
    },
    configurable: true,
  });
};

const hiddenImage = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[aria-hidden="true"]')!;

const valueOf = (hidden: HTMLElement, label: string) =>
  within(hidden).getByText(label).nextElementSibling as HTMLElement;

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  toPng.mockReset();
  toPng.mockResolvedValue('data:image/png;base64,AAAA');
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    blob: () => Promise.resolve(new Blob(['png'], { type: 'image/png' })),
  }) as unknown as typeof fetch;
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, 'clipboard');
});

describe('NPCStatBlockExport buttons', () => {
  it('hides Copy image without clipboard image support', () => {
    render(<NPCStatBlockExport npc={makeNpc()} />);
    expect(screen.queryByRole('button', { name: 'Copy image' })).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Download image' })
    ).toBeInTheDocument();
  });

  it('shows Copy image once clipboard image support exists', async () => {
    stubClipboard(() => Promise.resolve());
    render(<NPCStatBlockExport npc={makeNpc()} />);
    expect(
      await screen.findByRole('button', { name: 'Copy image' })
    ).toBeInTheDocument();
  });

  it('renders nothing without a stat block', () => {
    const { container } = render(
      <NPCStatBlockExport npc={makeNpc({ monsterStatBlock: undefined })} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('says the copy failed when the image cannot be captured', async () => {
    stubClipboard(() => Promise.resolve());
    toPng.mockRejectedValue(new Error('capture'));
    render(<NPCStatBlockExport npc={makeNpc()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Copy image' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(COPY_FAILED);
  });

  it('says the copy failed when the clipboard write is refused', async () => {
    stubClipboard(() => Promise.reject(new Error('denied')));
    render(<NPCStatBlockExport npc={makeNpc()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Copy image' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(COPY_FAILED);
  });

  it('starts the clipboard write inside the click, before the capture resolves', async () => {
    let resolveCapture: (url: string) => void = () => {};
    toPng.mockReturnValue(
      new Promise<string>(resolve => {
        resolveCapture = resolve;
      })
    );
    const write = vi.fn<
      (
        items: Array<{ items: Record<string, Blob | Promise<Blob>> }>
      ) => Promise<void>
    >(() => Promise.resolve());
    stubClipboard(write);
    render(<NPCStatBlockExport npc={makeNpc()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Copy image' }));

    expect(write).toHaveBeenCalledTimes(1);
    const png = write.mock.calls[0][0][0].items['image/png'];
    expect(png).toBeInstanceOf(Promise);
    expect(
      screen.queryByRole('button', { name: 'Image copied' })
    ).not.toBeInTheDocument();

    resolveCapture('data:image/png;base64,AAAA');
    expect(
      await screen.findByRole('button', { name: 'Image copied' })
    ).toBeInTheDocument();
  });

  it('says the image was not saved when a download capture fails', async () => {
    toPng.mockRejectedValue(new Error('capture'));
    render(<NPCStatBlockExport npc={makeNpc()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Download image' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(SAVE_FAILED);
  });

  it('clears the failure message when the next attempt starts', async () => {
    toPng.mockRejectedValueOnce(new Error('capture'));
    render(<NPCStatBlockExport npc={makeNpc()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Download image' }));
    await screen.findByRole('alert');

    toPng.mockReturnValueOnce(new Promise(() => {}));
    fireEvent.click(screen.getByRole('button', { name: 'Download image' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  it('downloads without a message and revokes the object URL', async () => {
    const createObjectURL = vi.fn(() => 'blob:png');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
    render(<NPCStatBlockExport npc={makeNpc()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Download image' }));
    await waitFor(() =>
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:png')
    );
    expect(click).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('disables both buttons while one is busy', async () => {
    stubClipboard(() => Promise.resolve());
    toPng.mockReturnValue(new Promise(() => {}));
    render(<NPCStatBlockExport npc={makeNpc()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Copy image' }));
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Download image' })
      ).toBeDisabled()
    );
    expect(screen.getByRole('button', { name: /Copy image/ })).toBeDisabled();
  });

  it('disables Copy while a download is pending', async () => {
    stubClipboard(() => Promise.resolve());
    toPng.mockReturnValue(new Promise(() => {}));
    render(<NPCStatBlockExport npc={makeNpc()} />);
    const copy = await screen.findByRole('button', { name: 'Copy image' });
    fireEvent.click(screen.getByRole('button', { name: 'Download image' }));
    await waitFor(() => expect(copy).toBeDisabled());
    expect(
      screen.getByRole('button', { name: /Download image/ })
    ).toBeDisabled();
  });

  it('shows Image copied for two seconds, then Copy image again', async () => {
    vi.useFakeTimers();
    stubClipboard(() => Promise.resolve());
    render(<NPCStatBlockExport npc={makeNpc()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy image' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(
      screen.getByRole('button', { name: 'Image copied' })
    ).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(
      screen.getByRole('button', { name: 'Copy image' })
    ).toBeInTheDocument();
  });

  it('clears the reset timer when unmounted before it fires', async () => {
    vi.useFakeTimers();
    stubClipboard(() => Promise.resolve());
    const { unmount } = render(<NPCStatBlockExport npc={makeNpc()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy image' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(console.error).not.toHaveBeenCalled();
  });
});

describe('exported image contents', () => {
  it('prints armor class without the temporary bonus', () => {
    const { container } = render(<NPCStatBlockExport npc={makeNpc()} />);
    const ac = valueOf(hiddenImage(container), 'Armor class');
    expect(ac).toHaveTextContent('15');
    expect(ac.textContent).toBe('15');
  });

  it('prints hit points with the formula', () => {
    const { container } = render(<NPCStatBlockExport npc={makeNpc()} />);
    expect(valueOf(hiddenImage(container), 'Hit points').textContent).toBe(
      '22 (4d8 + 4)'
    );
  });

  it('prints hit points alone when there is no formula', () => {
    const { container } = render(
      <NPCStatBlockExport
        npc={makeNpc({ monsterStatBlock: { ...statBlock, hpFormula: '' } })}
      />
    );
    expect(valueOf(hiddenImage(container), 'Hit points').textContent).toBe(
      '22'
    );
  });

  it('prints initiative from Dexterity, or the override', () => {
    const { container, rerender } = render(
      <NPCStatBlockExport npc={makeNpc()} />
    );
    expect(valueOf(hiddenImage(container), 'Initiative').textContent).toBe(
      '+2'
    );
    rerender(<NPCStatBlockExport npc={makeNpc({ initiativeModifier: 5 })} />);
    expect(valueOf(hiddenImage(container), 'Initiative').textContent).toBe(
      '+5'
    );
  });

  it('prints the meta line with the alignment', () => {
    const { container } = render(<NPCStatBlockExport npc={makeNpc()} />);
    expect(
      within(hiddenImage(container)).getByText(
        'Medium humanoid · CR 2 · neutral good'
      )
    ).toBeInTheDocument();
  });

  it('uses sentence-case titles and no formula row', () => {
    const { container } = render(<NPCStatBlockExport npc={makeNpc()} />);
    const hidden = within(hiddenImage(container));
    for (const title of [
      'Traits',
      'Actions',
      'Bonus actions',
      'Lair actions',
      'Condition immunities',
    ]) {
      expect(hidden.getByText(title)).toBeInTheDocument();
    }
    expect(hidden.queryByText('HP Formula')).toBeNull();
    expect(hidden.queryByText('Bonus Actions')).toBeNull();
  });

  it('renders a migrated block that lacks condition immunities', () => {
    const legacy = {
      ...statBlock,
      conditionImmunities: undefined,
    } as unknown as MonsterStatBlock;
    const { container } = render(
      <NPCStatBlockExport npc={makeNpc({ monsterStatBlock: legacy })} />
    );
    const hidden = within(hiddenImage(container));
    expect(hidden.getByText('Armor class')).toBeInTheDocument();
    expect(hidden.queryByText('Condition immunities')).toBeNull();
  });

  it('spells the ability labels and transforms no text', () => {
    const { container } = render(<NPCStatBlockExport npc={makeNpc()} />);
    const hidden = hiddenImage(container);
    for (const label of ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']) {
      expect(within(hidden).getByText(label)).toBeInTheDocument();
    }
    const everyElement = [...hidden.querySelectorAll('*')] as HTMLElement[];
    expect(
      everyElement.every(el => el.style.textTransform !== 'uppercase')
    ).toBe(true);
  });
});
