import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { StatBlockTraits } from '../StatBlockTraits';
import type { MonsterStatBlock } from '@/types/encounter';

afterEach(() => cleanup());

function makeLegacyStatBlock(): MonsterStatBlock {
  // Simulates a persisted stat block predating bonusActions/lairActions —
  // both keys are absent entirely, not just empty arrays. traits/actions are
  // also empty so the hasSections check can't short-circuit past the
  // unguarded bonusActions/lairActions reads before reaching them.
  const legacy = {
    str: 10,
    dex: 10,
    con: 10,
    int: 10,
    wis: 10,
    cha: 10,
    saves: '',
    skills: '',
    speed: '30 ft.',
    resistances: '',
    immunities: '',
    vulnerabilities: '',
    conditionImmunities: [],
    senses: '',
    passivePerception: 10,
    traits: [],
    actions: [],
    reactions: [{ name: 'Keen Smell', text: 'Advantage on smell checks.' }],
    cr: '1',
    type: 'beast',
    size: 'Medium',
    languages: '',
    alignment: 'Unaligned',
    hpFormula: '2d8',
  };
  return legacy as unknown as MonsterStatBlock;
}

describe('StatBlockTraits legacy stat-block guard', () => {
  it('renders without throwing when bonusActions/lairActions are absent', () => {
    expect(() =>
      render(<StatBlockTraits statBlock={makeLegacyStatBlock()} />)
    ).not.toThrow();
    expect(screen.getByText('Keen Smell')).toBeInTheDocument();
  });
});
