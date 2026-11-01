import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { makeCharacter } from '@/utils/__tests__/test-utils';
import {
  createTabbedSheetConfig,
  setInventorySubTab,
  setCharacterSubTab,
  setCombatSubTab,
  type TabbedSheetConfigParams,
} from '../tabbedSheetConfig';
vi.mock('@/components/ui/game/equipment/WeaponsTab', () => ({
  WeaponsTab: () => <p>Weapon panel</p>,
}));
vi.mock('@/hooks/useClassData', () => ({
  useClassData: () => ({ classData: [], loading: false, error: null }),
}));
beforeEach(() =>
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: true,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
  )
);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function config(overrides: Partial<TabbedSheetConfigParams> = {}) {
  const known = {
    character: makeCharacter(),
    hasHydrated: true,
    totalLevel: 1,
    proficiencyBonus: 2,
    characterHasSpells: false,
    editing: false,
    getInitiativeModifier: () => 2,
    getSkillModifier: () => 2,
    getSavingThrowModifier: () => 1,
    getClassDisplayString: () => 'Fighter 1',
    ...overrides,
  };
  return createTabbedSheetConfig(
    new Proxy(known, {
      get: (target, key) =>
        key in target ? target[key as keyof typeof target] : vi.fn(),
    }) as unknown as TabbedSheetConfigParams
  );
}
for (const [id, labels] of [
  ['inventory', ['Weapons', 'Magic items', 'Armor', 'Items', 'Currency']],
  ['character', ['Session notes', 'Features and background', 'Dice']],
  ['combat', ['Player', 'Defenses and buffs', 'Summons']],
  ['features', ['Abilities', 'Inspiration', 'Proficiencies']],
] as const) {
  it(`${id} uses accessible subtabs and keyboard navigation`, async () => {
    const tab = config().find(t => t.id === id)!;
    render(<>{tab.content}</>);
    for (const label of labels)
      expect(screen.getByRole('tab', { name: label })).toBeVisible();
    const first = screen.getByRole('tab', { name: labels[0] });
    first.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: labels[1] })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });
}
it('keeps external inventory and character setters and adds Combat navigation', () => {
  for (const [id, setter, target, name] of [
    ['inventory', setInventorySubTab, 'items', 'Items'],
    ['character', setCharacterSubTab, 'dice', 'Dice'],
    ['combat', setCombatSubTab, 'defenses', 'Defenses and buffs'],
  ] as const) {
    const { unmount } = render(<>{config().find(t => t.id === id)!.content}</>);
    act(() => (setter as (value: string) => void)(target));
    expect(screen.getByRole('tab', { name })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    if (id === 'combat') {
      fireEvent.mouseDown(screen.getByRole('tab', { name: 'Summons' }), {
        button: 0,
        ctrlKey: false,
      });
      act(() => setCombatSubTab('player'));
      expect(screen.getByRole('tab', { name: 'Player' })).toHaveAttribute(
        'aria-selected',
        'true'
      );
    }
    unmount();
  }
});

it('consumes the latest HUD request made before Combat mounts', () => {
  setCombatSubTab('summons');
  setCombatSubTab('defenses');
  render(<>{config().find(t => t.id === 'combat')!.content}</>);
  expect(
    screen.getByRole('tab', { name: 'Defenses and buffs' })
  ).toHaveAttribute('aria-selected', 'true');
});

it('consumes first-visit Inventory and Character notification requests', () => {
  setInventorySubTab('items');
  const a = render(<>{config().find(t => t.id === 'inventory')!.content}</>);
  expect(screen.getByRole('tab', { name: 'Items' })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  a.unmount();
  setCharacterSubTab('dice');
  render(<>{config().find(t => t.id === 'character')!.content}</>);
  expect(screen.getByRole('tab', { name: 'Dice' })).toHaveAttribute(
    'aria-selected',
    'true'
  );
});

it('scrolls the committed Player conditions on first and repeated requests, and cancels superseded requests', () => {
  const scroll = vi
    .spyOn(Element.prototype, 'scrollIntoView')
    .mockImplementation(() => {});
  setCombatSubTab('player', { scrollToConditions: true });
  setCombatSubTab('defenses');
  const view = render(<>{config().find(t => t.id === 'combat')!.content}</>);
  expect(scroll).not.toHaveBeenCalled();
  for (const initial of ['summons', 'defenses', 'player'] as const) {
    act(() => setCombatSubTab(initial));
    act(() => setCombatSubTab('player', { scrollToConditions: true }));
    expect(scroll).toHaveBeenLastCalledWith({
      behavior: 'auto',
      block: 'start',
    });
    expect(scroll.mock.instances.at(-1)).toHaveAttribute(
      'id',
      'conditions-section'
    );
  }
  expect(scroll).toHaveBeenCalledTimes(3);
  view.unmount();
  scroll.mockRestore();
});

it('keeps the conditions aligned while they load, until the player takes over', () => {
  let resize: (
    entries: { contentRect: { height: number } }[]
  ) => void = () => {};
  const disconnect = vi.fn(() => {
    resize = () => {};
  });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: typeof resize) {
        resize = callback;
      }
      observe = vi.fn();
      disconnect = disconnect;
    }
  );
  const scroll = vi
    .spyOn(Element.prototype, 'scrollIntoView')
    .mockImplementation(() => {});
  const view = render(<>{config().find(t => t.id === 'combat')!.content}</>);
  act(() => setCombatSubTab('player', { scrollToConditions: true }));
  expect(scroll).toHaveBeenCalledTimes(1);
  act(() => resize([{ contentRect: { height: 0 } }]));
  expect(scroll).toHaveBeenCalledTimes(1);
  act(() => resize([{ contentRect: { height: 320 } }]));
  expect(scroll).toHaveBeenCalledTimes(2);
  fireEvent.pointerDown(window);
  expect(disconnect).toHaveBeenCalled();
  act(() => resize([{ contentRect: { height: 640 } }]));
  expect(scroll).toHaveBeenCalledTimes(2);
  view.unmount();
  scroll.mockRestore();
});

it('pairs the Player panel sections in rows and moves weapon proficiencies to Features', () => {
  render(<>{config().find(t => t.id === 'combat')!.content}</>);
  const wanted = [
    'Hit points',
    'Armor class',
    'Hit dice',
    'Initiative and speed',
  ];
  const headings = screen.getAllByRole('heading');
  const seen = headings
    .map(h => h.textContent?.trim() ?? '')
    .filter(text => wanted.includes(text));
  expect(seen).toEqual(wanted);
  const heading = (name: string) =>
    headings.find(h => h.textContent?.trim() === name)!;
  const grid = heading('Hit points').closest('.lg\\:grid-cols-2')!;
  expect(grid.className).toContain('grid-cols-1');
  expect(grid.className).toContain('items-start');
  expect(grid.className).toContain('gap-x-10');
  expect(grid.className).toContain('gap-y-8');
  const itemOf = (name: string) => {
    let node: Element = heading(name);
    while (node.parentElement !== grid) node = node.parentElement!;
    return node;
  };
  for (const name of wanted)
    expect(itemOf(name).className).not.toContain('col-span-2');
  expect(
    screen.queryByRole('heading', { name: 'Weapon proficiencies' })
  ).not.toBeInTheDocument();
  expect(screen.getByRole('switch', { name: 'Shield' })).toBeInTheDocument();
  expect(screen.getByRole('switch', { name: 'Temp AC' })).toBeInTheDocument();
  expect(screen.queryByText('Armor and Dexterity')).not.toBeInTheDocument();
});

it('places Tools and Languages side by side with Weapon proficiencies below', async () => {
  render(<>{config().find(t => t.id === 'features')!.content}</>);
  await userEvent.click(screen.getByRole('tab', { name: 'Proficiencies' }));
  const tools = screen.getByRole('heading', { name: 'Tools' });
  const languages = screen.getByRole('heading', { name: 'Languages' });
  const grid = tools.closest('.md\\:grid-cols-2')!;
  expect(grid).toContainElement(languages);
  expect(
    screen.getByRole('heading', { name: 'Weapon proficiencies' })
  ).toBeInTheDocument();
  expect(grid).not.toContainElement(
    screen.getByRole('heading', { name: 'Weapon proficiencies' })
  );
});

it('pairs a positive DM counter with Inspiration and omits a zero counter', async () => {
  const positive = render(
    <>
      {
        config({ customCounter: { label: 'DM boon', value: 2 } }).find(
          t => t.id === 'features'
        )!.content
      }
    </>
  );
  await userEvent.click(screen.getByRole('tab', { name: 'Inspiration' }));
  const dmHeading = screen.getByRole('heading', { name: 'DM boon' });
  expect(dmHeading.closest('.md\\:grid-cols-2')).toContainElement(
    screen.getByRole('heading', { name: 'Heroic Inspiration' })
  );
  expect(dmHeading.closest('section')).toHaveTextContent('Set by your DM.');
  expect(
    within(dmHeading.closest('section') as HTMLElement).getByText('2')
  ).toHaveClass('type-num-lg');

  positive.unmount();
  render(
    <>
      {
        config({ customCounter: { label: 'DM boon', value: 0 } }).find(
          t => t.id === 'features'
        )!.content
      }
    </>
  );
  await userEvent.click(screen.getByRole('tab', { name: 'Inspiration' }));
  expect(screen.queryByRole('heading', { name: 'DM boon' })).toBeNull();
});
