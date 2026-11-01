import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CHARACTER_STATE } from '@/utils/constants';
import ConfirmationStep from './ConfirmationStep';

afterEach(cleanup);

describe('ConfirmationStep', () => {
  it('renders repeated cantrip upgrade names without duplicate React keys', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ConfirmationStep
        className="Wizard"
        oldClassLevel={4}
        newClassLevel={5}
        oldTotalLevel={4}
        newTotalLevel={5}
        features={[]}
        subclassFeatures={[]}
        subclassSpellGrants={[]}
        abilities={DEFAULT_CHARACTER_STATE.abilities}
        hitDie={6}
        conModifier={1}
        isCustomClass={false}
        spellsKnownDelta={0}
        cantripsKnownDelta={0}
        cantripUpgrades={[
          { name: 'Fire Bolt', from: '1d10', to: '2d10' },
          { name: 'Fire Bolt', from: '1d10', to: '2d10' },
        ]}
      />
    );
    expect(errors.mock.calls.map(call => call.join(' ')).join(' ')).not.toMatch(
      /same key/
    );
    errors.mockRestore();
  });
  it('shows adopted earlier subclass features and spells before applying', () => {
    const props = {
      className: 'Fighter',
      oldClassLevel: 3,
      newClassLevel: 4,
      oldTotalLevel: 3,
      newTotalLevel: 4,
      features: [],
      subclassFeatures: [],
      subclassSpellGrants: [],
      abilities: DEFAULT_CHARACTER_STATE.abilities,
      hitDie: 10,
      conModifier: 1,
      isCustomClass: false,
      spellsKnownDelta: 0,
      cantripsKnownDelta: 0,
      cantripUpgrades: [],
      migrationFeatures: [
        {
          name: 'Battle Sage',
          level: 3,
          source: 'PHB',
          isSubclassFeature: true,
          original: '',
        },
      ],
      migrationSpellGrants: [
        {
          spellName: 'Shield',
          grantType: 'prepared' as const,
          isAlwaysPrepared: true,
        },
      ],
    };
    render(<ConfirmationStep {...props} />);
    expect(screen.getByText('Battle Sage')).toBeInTheDocument();
    expect(screen.getByText(/Shield.*always prepared/)).toBeInTheDocument();
  });
});
