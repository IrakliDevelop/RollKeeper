// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { StatBlockEntryRow } from '@/components/ui/encounter/combat-screen/detail/StatBlockEntryRow';
import type {
  MonsterAbility,
  NpcResource,
  StatBlockEntry,
} from '@/types/encounter';

afterEach(cleanup);

const RESOURCE: NpcResource = {
  id: 'res-1',
  name: 'Wild Shape',
  icon: 'paw-print',
  color: 'emerald',
  displayStyle: 'pips',
  maxUses: 4,
  usesExpended: 0,
  shortRestReset: 1,
};

const TRACKED_ENTRY: StatBlockEntry = {
  id: 'entry-1',
  name: 'Smite',
  text: 'holy damage',
  uses: 3,
};

const ability = (used = 1): MonsterAbility => ({
  id: 'entry-1',
  name: 'Smite',
  description: 'holy damage',
  usageType: 'per-day',
  maxUses: 3,
  usedUses: used,
});

describe('StatBlockEntryRow', () => {
  it('names pip actions and exposes read-only pips as images', () => {
    const view = render(
      <StatBlockEntryRow
        entry={TRACKED_ENTRY}
        ability={ability(1)}
        onUseAbility={vi.fn()}
        onRestoreAbility={vi.fn()}
      />
    );
    expect(
      view.getByRole('button', { name: 'Restore Smite use 1' })
    ).toBeVisible();
    expect(
      view.getByRole('button', { name: 'Use Smite (2 of 3)' })
    ).toBeVisible();
    cleanup();
    const readOnly = render(
      <StatBlockEntryRow entry={TRACKED_ENTRY} ability={ability(1)} readOnly />
    );
    expect(
      readOnly.getByRole('img', { name: 'Smite use 1, used' })
    ).toBeVisible();
    expect(
      readOnly.getByRole('img', { name: 'Smite use 2, available' })
    ).toBeVisible();
  });

  it('description is always a separate block below the header line', () => {
    const { container } = render(
      <StatBlockEntryRow entry={TRACKED_ENTRY} ability={ability()} />
    );
    const blocks = container.firstElementChild!.children;
    expect(blocks).toHaveLength(2);
    expect(blocks[1].textContent).toContain('holy damage');
    expect(blocks[0].textContent).not.toContain('holy damage');
  });

  it('trackable: available pip uses, used pip restores', async () => {
    const onUse = vi.fn();
    const onRestore = vi.fn();
    const screen = render(
      <StatBlockEntryRow
        entry={TRACKED_ENTRY}
        ability={ability(1)}
        onUseAbility={onUse}
        onRestoreAbility={onRestore}
      />
    );
    screen.getByLabelText('Restore Smite use 1').click();
    expect(onRestore).toHaveBeenCalledWith(TRACKED_ENTRY);
    screen.getByLabelText('Use Smite (2 of 3)').click();
    expect(onUse).toHaveBeenCalledWith(TRACKED_ENTRY);
  });

  it('trackable + cost: available pips disabled when resource insufficient; restore still enabled and never refunds', () => {
    const onUse = vi.fn();
    const onRestore = vi.fn();
    const entry = {
      ...TRACKED_ENTRY,
      resourceCost: { resourceId: 'res-1', amount: 2 },
    };
    const screen = render(
      <StatBlockEntryRow
        entry={entry}
        ability={ability(1)}
        resources={[{ ...RESOURCE, usesExpended: 3 }]} // 1 remaining < 2
        onUseAbility={onUse}
        onRestoreAbility={onRestore}
      />
    );
    const availablePip = screen.getByLabelText('Use Smite (2 of 3)');
    expect((availablePip as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Needs 2 Wild Shape, 1 left')).toBeVisible();
    expect(availablePip.getAttribute('title')).toBe(
      'Needs 2 Wild Shape, 1 left'
    );
    availablePip.click();
    expect(onUse).not.toHaveBeenCalled();
    const usedPip = screen.getByLabelText('Restore Smite use 1');
    expect(usedPip.getAttribute('title')).toContain('does not refund');
    usedPip.click();
    expect(onRestore).toHaveBeenCalled();
  });

  it('uses brass available pips, neutral spent pips and coarse pointer targets', () => {
    const view = render(
      <StatBlockEntryRow
        entry={TRACKED_ENTRY}
        ability={ability(1)}
        onUseAbility={vi.fn()}
        onRestoreAbility={vi.fn()}
      />
    );
    const used = view.getByLabelText('Restore Smite use 1');
    const available = view.getByLabelText('Use Smite (2 of 3)');
    expect(used).toHaveClass('pointer-coarse:min-h-11');
    expect(available).toHaveClass('pointer-coarse:min-w-11');
    expect(used.querySelector('span')).toHaveClass('border-divider-strong');
    expect(available.querySelector('span')).toHaveClass('border-brass-border');
  });

  it('names the secondary Use action for its entry and shows the cost', () => {
    const entry = {
      ...TRACKED_ENTRY,
      resourceCost: { resourceId: 'res-1', amount: 2 },
    };
    const view = render(
      <StatBlockEntryRow
        entry={entry}
        resources={[RESOURCE]}
        onSpendCost={vi.fn()}
      />
    );
    expect(view.getByRole('button', { name: 'Use Smite' })).toHaveAttribute(
      'data-variant',
      'secondary'
    );
    expect(
      view.getByText(/Wild Shape/).closest('[data-variant]')
    ).toHaveAttribute('data-variant', 'neutral');
  });

  it('says how many items an inventory cost needs and how many are left', () => {
    const entry: StatBlockEntry = {
      id: 'entry-arrows',
      name: 'Volley',
      text: '',
      inventoryCost: { inventoryItemId: 'arrows', quantity: 3 },
    };
    const view = render(
      <StatBlockEntryRow
        entry={entry}
        inventory={[{ id: 'arrows', name: 'Arrows', quantity: 1 } as never]}
        onSpendCost={vi.fn()}
      />
    );
    expect(view.getByText('Needs 3 Arrows, 1 left')).toBeVisible();
  });

  it('names a missing inventory item instead of a generic shortage', () => {
    const entry: StatBlockEntry = {
      id: 'entry-missing',
      name: 'Quaff potion',
      text: '',
      inventoryCost: { inventoryItemId: 'item-gone', quantity: 1 },
    };
    const view = render(
      <StatBlockEntryRow entry={entry} inventory={[]} onSpendCost={vi.fn()} />
    );
    expect(view.getByText('Inventory item removed')).toBeVisible();
    expect(
      view.getByRole('button', { name: 'Use Quaff potion' })
    ).toBeDisabled();
  });

  it('trackable + cost with sufficient resource: pip title names the spend', () => {
    const entry = {
      ...TRACKED_ENTRY,
      resourceCost: { resourceId: 'res-1', amount: 2 },
    };
    const screen = render(
      <StatBlockEntryRow
        entry={entry}
        ability={ability(0)}
        resources={[RESOURCE]}
        onUseAbility={vi.fn()}
      />
    );
    expect(
      screen.getByLabelText('Use Smite (1 of 3)').getAttribute('title')
    ).toBe('Use — spends 2 Wild Shape');
  });

  it('untrackable + cost: Use button spends resource only; dangling disabled', () => {
    const onSpendCost = vi.fn();
    const entry: StatBlockEntry = {
      id: 'entry-2',
      name: 'Rally',
      text: 'inspires',
      resourceCost: { resourceId: 'res-1', amount: 1 },
    };
    const screen = render(
      <StatBlockEntryRow
        entry={entry}
        resources={[RESOURCE]}
        onSpendCost={onSpendCost}
      />
    );
    screen.getByRole('button', { name: 'Use Rally' }).click();
    expect(onSpendCost).toHaveBeenCalledWith(entry);

    cleanup();
    const dangling = render(
      <StatBlockEntryRow entry={entry} resources={[]} onSpendCost={vi.fn()} />
    );
    expect(dangling.getByText('Unknown resource')).toBeTruthy();
    expect(
      (dangling.getByRole('button', { name: 'Use Rally' }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
  });

  it('readOnly renders zero buttons', () => {
    const entry = {
      ...TRACKED_ENTRY,
      resourceCost: { resourceId: 'res-1', amount: 1 },
    };
    const { container } = render(
      <StatBlockEntryRow
        entry={entry}
        ability={ability(1)}
        resources={[RESOURCE]}
        readOnly
        onUseAbility={vi.fn()}
        onSpendCost={vi.fn()}
      />
    );
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });

  it('plain entry renders text only — no pips, no buttons', () => {
    const { container } = render(
      <StatBlockEntryRow
        entry={{ id: 'entry-3', name: 'Bite', text: 'chomp' }}
      />
    );
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });

  it('entry without an id never renders tracking controls (malformed input)', () => {
    const { container } = render(
      <StatBlockEntryRow
        entry={{ name: 'Smite', text: '', uses: 3 }}
        ability={ability()}
        onUseAbility={vi.fn()}
      />
    );
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });

  it('uses label follows the authoritative ability, not an entity-edited entry.uses', () => {
    // Entity entry says 9 (combat edit), authoritative ability says 3.
    const screen = render(
      <StatBlockEntryRow
        entry={{ ...TRACKED_ENTRY, uses: 9 }}
        ability={ability(0)}
        onUseAbility={vi.fn()}
      />
    );
    expect(screen.getByText(/3\/Day/)).toBeTruthy();
    expect(screen.queryByText(/9\/Day/)).toBeNull();
    // And exactly three pips.
    expect(screen.getAllByRole('button', { name: /Use Smite/ })).toHaveLength(
      3
    );
  });

  it('parsed usage inside an entity-edited NAME cannot contradict the authoritative label', () => {
    // Entity name carries "(9/Day)"; the authoritative ability says 3/Day.
    const screen = render(
      <StatBlockEntryRow
        entry={{
          id: 'entry-1',
          name: 'Teleport (9/Day)',
          text: 'blink',
          uses: 9,
        }}
        ability={{
          id: 'entry-1',
          name: 'Teleport',
          description: 'blink',
          usageType: 'per-day',
          maxUses: 3,
          usedUses: 0,
          source: 'npc',
        }}
        onUseAbility={vi.fn()}
      />
    );
    // Name renders cleaned, label derives from the ability config.
    expect(screen.getByText(/Teleport \(3\/Day\)/)).toBeTruthy();
    expect(screen.queryByText(/9\/Day/)).toBeNull();
    expect(
      screen.getAllByRole('button', { name: /Use Teleport/ })
    ).toHaveLength(3);
  });
});
