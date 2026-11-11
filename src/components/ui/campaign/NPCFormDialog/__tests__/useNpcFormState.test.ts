import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { CampaignNPC } from '@/types/encounter';
import { draftFromNpc } from '../npcFormDraft';
import { buildNpcPayload } from '../npcFormPayload';
import { useNpcFormState } from '../useNpcFormState';
import { GOBLIN, KI, STAT_BLOCK_NPC } from './npcFormFixtures';

interface HookProps {
  open: boolean;
  editingNpc: CampaignNPC | null;
}

function setup(initial: Partial<HookProps> = {}) {
  const onSave = vi.fn();
  const onOpenChange = vi.fn();
  const hook = renderHook(
    (props: HookProps) =>
      useNpcFormState({
        open: props.open,
        editingNpc: props.editingNpc,
        onSave,
        onOpenChange,
      }),
    {
      initialProps: {
        open: true,
        editingNpc: STAT_BLOCK_NPC,
        ...initial,
      } as HookProps,
    }
  );
  return { ...hook, onSave, onOpenChange };
}

describe('useNpcFormState hydration', () => {
  it('hydrates from editingNpc on open and is clean', () => {
    const { result } = setup();
    expect(result.current.draft.name).toBe('Brother Oren');
    expect(result.current.isDirty).toBe(false);
  });

  it('re-hydrates when editingNpc changes identity while open', () => {
    const { result, rerender } = setup();
    act(() => result.current.update({ name: 'typed' }));
    expect(result.current.draft.name).toBe('typed');
    expect(result.current.isDirty).toBe(true);

    rerender({
      open: true,
      editingNpc: { ...STAT_BLOCK_NPC, name: 'Renamed' },
    });
    expect(result.current.draft.name).toBe('Renamed');
    expect(result.current.isDirty).toBe(false);
  });

  it('does not reset while closed', () => {
    const { result, rerender } = setup();
    act(() => result.current.update({ name: 'typed' }));
    rerender({ open: false, editingNpc: STAT_BLOCK_NPC });
    expect(result.current.draft.name).toBe('typed');
  });

  it('starts from an empty draft when there is no NPC', () => {
    const { result } = setup({ editingNpc: null });
    expect(result.current.draft.name).toBe('');
    expect(result.current.isDirty).toBe(false);
  });
});

describe('useNpcFormState editing', () => {
  it('update marks dirty and reverting cleans it', () => {
    const { result } = setup();
    act(() => result.current.update({ hp: 99 }));
    expect(result.current.isDirty).toBe(true);
    act(() => result.current.update({ hp: STAT_BLOCK_NPC.maxHp }));
    expect(result.current.isDirty).toBe(false);
  });

  it('update merges functional patches against the latest state', () => {
    const { result } = setup();
    act(() => {
      result.current.update(d => ({ hp: d.hp + 1 }));
      result.current.update(d => ({ hp: d.hp + 1 }));
    });
    expect(result.current.draft.hp).toBe(STAT_BLOCK_NPC.maxHp + 2);
  });

  it('derived follows the draft', () => {
    const { result } = setup({ editingNpc: null });
    act(() => result.current.update({ dex: 16 }));
    expect(result.current.derived.initiativeModifier).toBe(3);
  });
});

describe('useNpcFormState submit', () => {
  it('saves the payload then closes', () => {
    const { result, onSave, onOpenChange } = setup();
    act(() => result.current.submit());
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(
      buildNpcPayload(draftFromNpc(STAT_BLOCK_NPC), STAT_BLOCK_NPC)
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSave.mock.invocationCallOrder[0]).toBeLessThan(
      onOpenChange.mock.invocationCallOrder[0]
    );
  });

  it('does nothing with a blank name', () => {
    const { result, onSave, onOpenChange } = setup({ editingNpc: null });
    act(() => result.current.update({ name: '   ' }));
    act(() => result.current.submit());
    expect(onSave).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(result.current.canSubmit).toBe(false);
  });

  it('submit refuses an invalid resource draft', () => {
    const { result, onSave, onOpenChange } = setup({ editingNpc: null });
    act(() =>
      result.current.update({
        name: 'Oren',
        resources: [{ ...KI, maxUses: undefined }],
      })
    );
    act(() => result.current.submit());
    expect(onSave).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(result.current.submitBlocker).toBe('resources');
  });
});

describe('useNpcFormState actions', () => {
  it('deleteResource strips the cost from every entry list', () => {
    const cost = { resourceId: KI.id, amount: 1 };
    const { result } = setup();
    act(() =>
      result.current.update(d => ({
        traits: d.traits.map((e, i) =>
          i === 0 ? { ...e, resourceCost: cost } : e
        ),
        reactions: [
          { id: 'react-1', name: 'Deflect', text: 'x', resourceCost: cost },
        ],
      }))
    );
    expect(result.current.draft.traits[0].resourceCost).toEqual(cost);
    expect(result.current.draft.actions[0].resourceCost).toEqual(cost);
    expect(result.current.draft.reactions[0].resourceCost).toEqual(cost);

    act(() => result.current.deleteResource(KI.id));
    expect(result.current.draft.resources).toEqual([]);
    expect(result.current.draft.traits[0].resourceCost).toBeUndefined();
    expect(result.current.draft.actions[0].resourceCost).toBeUndefined();
    expect(result.current.draft.reactions[0].resourceCost).toBeUndefined();
  });

  it('importMonster keeps group, tags and inventory', () => {
    const { result } = setup();
    act(() => result.current.importMonster(GOBLIN));
    expect(result.current.draft.name).toBe(GOBLIN.name);
    expect(result.current.draft.bestiarySourceId).toBe(GOBLIN.id);
    expect(result.current.draft.group).toBe('Temple');
    expect(result.current.draft.tags).toEqual(['monk']);
    expect(result.current.draft.inventoryItems).toEqual(
      STAT_BLOCK_NPC.inventory
    );
  });

  it('clearImport drops the bestiary source', () => {
    const { result } = setup();
    act(() => result.current.importMonster(GOBLIN));
    act(() => result.current.clearImport());
    expect(result.current.draft.bestiarySourceId).toBeNull();
    expect(result.current.draft.bestiarySourceName).toBe('');
  });

  it('addTag ignores duplicates and trailing commas', () => {
    const { result } = setup();
    act(() => result.current.addTag('monk,'));
    expect(result.current.draft.tags).toEqual(['monk']);
    act(() => result.current.addTag('  scholar, '));
    act(() => result.current.addTag('   '));
    expect(result.current.draft.tags).toEqual(['monk', 'scholar']);
  });

  it('removeTag removes one tag', () => {
    const { result } = setup();
    act(() => result.current.addTag('scholar'));
    act(() => result.current.removeTag('monk'));
    expect(result.current.draft.tags).toEqual(['scholar']);
  });

  it('removeLastTag pops one', () => {
    const { result } = setup();
    act(() => result.current.addTag('scholar'));
    act(() => result.current.removeLastTag());
    expect(result.current.draft.tags).toEqual(['monk']);
  });

  it('applyInventoryEdit patches only the named item', () => {
    const { result } = setup();
    act(() =>
      result.current.applyInventoryEdit('inv-beads', {
        name: 'Silver beads',
        quantity: 2,
        category: 'misc',
        location: '',
        description: '',
        tags: [],
      })
    );
    expect(result.current.draft.inventoryItems[0].name).toBe('Silver beads');
    expect(result.current.draft.inventoryItems[0].id).toBe('inv-beads');
  });
});
