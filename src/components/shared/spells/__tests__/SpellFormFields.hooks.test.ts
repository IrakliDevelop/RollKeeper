import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSpellAoeAutofill } from '@/components/shared/spells/SpellFormFields.hooks';
import { createInitialSpellFormData } from '@/utils/spellConversion';
import type { SpellFormData } from '@/utils/spellConversion';

const FIREBALL_DESC =
  'Each creature in a 20-foot-radius sphere centered on that point must make a Dexterity saving throw.';

function setup(initial: SpellFormData) {
  let formData = initial;
  const onChange = (d: SpellFormData) => {
    formData = d;
  };
  const view = renderHook(({ fd }) => useSpellAoeAutofill(fd, onChange), {
    initialProps: { fd: initial },
  });
  return {
    get formData() {
      return formData;
    },
    result: view.result,
    sync: () => view.rerender({ fd: formData }),
  };
}

describe('useSpellAoeAutofill', () => {
  it('auto-fills aoe from description while untouched', () => {
    const h = setup(createInitialSpellFormData());
    act(() => h.result.current.setDescription(FIREBALL_DESC));
    expect(h.formData.aoe).toEqual({ shape: 'circle', sizeFeet: 20 });
    expect(h.formData.description).toBe(FIREBALL_DESC);
  });

  it('clears aoe when the description no longer matches (still untouched)', () => {
    const h = setup(createInitialSpellFormData());
    act(() => h.result.current.setDescription(FIREBALL_DESC));
    h.sync();
    act(() =>
      h.result.current.setDescription('A dart of force strikes one target.')
    );
    expect(h.formData.aoe).toBeNull();
  });

  it('locks after a manual AoE edit — description changes stop overwriting', () => {
    const h = setup(createInitialSpellFormData());
    act(() => h.result.current.setAoe({ shape: 'cone', sizeFeet: 30 }));
    h.sync();
    act(() => h.result.current.setDescription(FIREBALL_DESC));
    expect(h.formData.aoe).toEqual({ shape: 'cone', sizeFeet: 30 });
  });

  it('locks after manually clearing to None', () => {
    const h = setup(createInitialSpellFormData());
    act(() => h.result.current.setAoe(null));
    h.sync();
    act(() => h.result.current.setDescription(FIREBALL_DESC));
    expect(h.formData.aoe).toBeNull();
  });

  it('edit-clobber guard: starts locked when stored aoe differs from detection', () => {
    const edited: SpellFormData = {
      ...createInitialSpellFormData(),
      description: FIREBALL_DESC,
      aoe: { shape: 'square', sizeFeet: 10 }, // user overrode detection earlier
    };
    const h = setup(edited);
    act(() =>
      h.result.current.setDescription(
        FIREBALL_DESC + ' The fire spreads around corners.'
      )
    );
    expect(h.formData.aoe).toEqual({ shape: 'square', sizeFeet: 10 });
  });

  it('edit-clobber guard: starts unlocked when stored aoe matches detection', () => {
    const detected: SpellFormData = {
      ...createInitialSpellFormData(),
      description: FIREBALL_DESC,
      aoe: { shape: 'circle', sizeFeet: 20 },
    };
    const h = setup(detected);
    act(() =>
      h.result.current.setDescription(
        'Each creature in a 30-foot cone must save.'
      )
    );
    expect(h.formData.aoe).toEqual({ shape: 'cone', sizeFeet: 30 });
  });
});
