import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SheetDrawer } from '..';
import { useCharacterStore } from '@/store/characterStore';
import type { CharacterState } from '@/types/character';
import type { PartyMemberHP } from '@/app/api/campaign/[code]/party-hp/route';

const PARTY_MEMBER: PartyMemberHP = {
  characterId: 'ally-1',
  characterName: 'Brindle',
  playerName: 'Sam',
  className: 'Cleric',
  level: 4,
  armorClass: 17,
  hitPoints: { current: 25, max: 32, temporary: 0 },
  lastSynced: '2025-01-01T00:00:00.000Z',
  publicSheet: {
    subtitle: 'Cleric 4',
    hpState: 'Healthy',
    speed: 30,
    passivePerception: 14,
    conditions: [],
    concentration: null,
    equippedGear: ['Mace'],
  },
};

const props = () => ({
  open: true,
  onClose: vi.fn(),
  addToast: vi.fn(),
  showAttackRoll: vi.fn(),
  onRested: vi.fn(),
  spellCasting: {
    onCastPlacement: vi.fn(),
    connectionLive: true,
    hasPendingPlacement: false,
    onCancelPlacement: vi.fn(),
  },
});
beforeEach(() => {
  window.localStorage.clear();
  const base = useCharacterStore.getState().character;
  useCharacterStore
    .getState()
    .loadCharacterState({ ...base, name: 'Kaelen Voss' } as CharacterState);
});
afterEach(() => cleanup());

describe('SheetDrawer', () => {
  it('opens as a dialog named after the character, locked', () => {
    render(<SheetDrawer {...props()} />);
    expect(
      screen.getByRole('dialog', { name: /kaelen voss/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /locked/i })).toBeInTheDocument();
  });

  it('shows and dismisses the editing banner', () => {
    render(<SheetDrawer {...props()} />);
    fireEvent.click(screen.getByRole('button', { name: /locked/i }));
    expect(screen.getByText(/editing unlocked/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^done$/i }));
    expect(screen.queryByText(/editing unlocked/i)).toBeNull();
  });

  it('confirms a long rest through RestDialog and reports it', () => {
    const p = props();
    render(<SheetDrawer {...p} />);
    fireEvent.click(screen.getByRole('button', { name: /long rest/i }));
    // RestDialog confirm button label — check REST_CONFIG in RestDialog.tsx and match it here.
    fireEvent.click(screen.getByRole('button', { name: /take long rest/i }));
    expect(p.onRested).toHaveBeenCalledWith('long');
  });

  it('resets to locked when reopened', () => {
    const p = props();
    const { rerender } = render(<SheetDrawer {...p} />);
    fireEvent.click(screen.getByRole('button', { name: /locked/i }));
    rerender(<SheetDrawer {...p} open={false} />);
    rerender(<SheetDrawer {...p} open />);
    expect(screen.getByRole('button', { name: /locked/i })).toBeInTheDocument();
  });

  it('closes via the close button', () => {
    const p = props();
    render(<SheetDrawer {...p} />);
    fireEvent.click(screen.getByRole('button', { name: /close sheet/i }));
    expect(p.onClose).toHaveBeenCalled();
  });

  it('hides in-app dice rolling while it is behind the flag', () => {
    render(<SheetDrawer {...props()} />);
    expect(
      screen.queryByRole('button', { name: /roll initiative/i })
    ).toBeNull();
  });

  it('renders the Overview body as a tabpanel labelled by its tab', () => {
    render(<SheetDrawer {...props()} />);
    const tab = screen.getByRole('tab', { name: /overview/i });
    const panel = screen.getByRole('tabpanel', { name: /overview/i });
    expect(tab).toHaveAttribute('aria-controls', panel.id);
  });

  it('falls back to overview when the stored tab is unknown', () => {
    window.localStorage.setItem('rollkeeper-map-sheet-tab', 'bogus');
    render(<SheetDrawer {...props()} />);
    expect(screen.getByRole('tab', { name: /overview/i })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('restores a stored known tab', () => {
    window.localStorage.setItem('rollkeeper-map-sheet-tab', 'effects');
    render(<SheetDrawer {...props()} />);
    expect(screen.getByRole('tab', { name: /effects/i })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('falls back to overview when the stored tab is not offered to this character', () => {
    // Default seeded character is a non-caster (class.spellcaster: 'none',
    // spells: []) — the Spells tab isn't in its tab list, so a stored
    // 'spells' tab must fall back to Overview.
    window.localStorage.setItem('rollkeeper-map-sheet-tab', 'spells');
    render(<SheetDrawer {...props()} />);
    expect(screen.getByRole('tab', { name: /overview/i })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  it('keeps a stored Spells preference while viewing a non-caster', () => {
    window.localStorage.setItem('rollkeeper-map-sheet-tab', 'spells');
    render(<SheetDrawer {...props()} />);
    expect(screen.getByRole('tab', { name: /overview/i })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(window.localStorage.getItem('rollkeeper-map-sheet-tab')).toBe(
      'spells'
    );
  });

  it('persists a tab the user selects', () => {
    render(<SheetDrawer {...props()} />);
    fireEvent.mouseDown(screen.getByRole('tab', { name: /features/i }));
    expect(window.localStorage.getItem('rollkeeper-map-sheet-tab')).toBe(
      'features'
    );
  });

  it('renders every tab panel', () => {
    render(<SheetDrawer {...props()} />);
    for (const name of [/abilities/i, /features/i, /effects/i, /inventory/i]) {
      fireEvent.mouseDown(screen.getByRole('tab', { name }));
      expect(screen.getByRole('tabpanel', { name })).not.toBeEmptyDOMElement();
    }
  });

  it('shows the Inventory tab and restores it from storage', () => {
    window.localStorage.setItem('rollkeeper-map-sheet-tab', 'inventory');
    render(<SheetDrawer {...props()} />);
    expect(screen.getByRole('tab', { name: /inventory/i })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(
      screen.getByRole('tabpanel', { name: /inventory/i })
    ).not.toBeEmptyDOMElement();
  });

  it('hides the Spells tab for non-casters', () => {
    // Default seeded character (Fighter-shaped, class.spellcaster: 'none',
    // spells: []) is not a caster.
    render(<SheetDrawer {...props()} />);
    expect(screen.queryByRole('tab', { name: /spells/i })).toBeNull();
  });

  it('renders OwnSheet for the own target (default)', () => {
    render(<SheetDrawer {...props()} openTarget={{ kind: 'own' }} />);
    expect(
      screen.getByRole('dialog', { name: /kaelen voss character sheet/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /locked/i })).toBeInTheDocument();
  });

  it('renders PartySheet for a party target, resolved from partyMembers', () => {
    render(
      <SheetDrawer
        {...props()}
        openTarget={{ kind: 'party', characterId: 'ally-1' }}
        partyMembers={[PARTY_MEMBER]}
      />
    );
    expect(
      screen.getByRole('dialog', { name: /brindle limited view/i })
    ).toBeInTheDocument();
    expect(screen.getByText('Brindle')).toBeInTheDocument();
    expect(
      screen.getByText(/limited view.*played by sam/i)
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /locked/i })).toBeNull();
  });

  it('falls back to a generic party title and missing-member state when the id has no match', () => {
    render(
      <SheetDrawer
        {...props()}
        openTarget={{ kind: 'party', characterId: 'nope' }}
        partyMembers={[PARTY_MEMBER]}
      />
    );
    expect(
      screen.getByRole('dialog', { name: /party member limited view/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/isn't in the party list yet/i)
    ).toBeInTheDocument();
  });

  it('switches between own and party views while staying open', () => {
    const p = props();
    const { rerender } = render(
      <SheetDrawer
        {...p}
        openTarget={{ kind: 'own' }}
        partyMembers={[PARTY_MEMBER]}
      />
    );
    expect(
      screen.getByRole('dialog', { name: /kaelen voss character sheet/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /locked/i })).toBeInTheDocument();

    rerender(
      <SheetDrawer
        {...p}
        openTarget={{ kind: 'party', characterId: 'ally-1' }}
        partyMembers={[PARTY_MEMBER]}
      />
    );
    expect(
      screen.getByRole('dialog', { name: /brindle limited view/i })
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: /kaelen voss/i })).toBeNull();
    expect(
      screen.getByText(/limited view.*played by sam/i)
    ).toBeInTheDocument();
    expect(screen.getByText('Mace')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /locked/i })).toBeNull();
    expect(p.onClose).not.toHaveBeenCalled();

    rerender(
      <SheetDrawer
        {...p}
        openTarget={{ kind: 'own' }}
        partyMembers={[PARTY_MEMBER]}
      />
    );
    expect(
      screen.getByRole('dialog', { name: /kaelen voss character sheet/i })
    ).toBeInTheDocument();
    expect(screen.queryByText(/played by sam/i)).toBeNull();
    expect(screen.getByRole('button', { name: /locked/i })).toBeInTheDocument();
    expect(p.onClose).not.toHaveBeenCalled();
  });
});
