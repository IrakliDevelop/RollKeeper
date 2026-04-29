import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { TraitTracker } from '../TraitTracker';
import { TrackableTrait } from '@/types/character';

afterEach(() => {
  cleanup();
});

const mockTraits: TrackableTrait[] = [
  {
    id: 't1',
    name: 'Action Surge',
    description: 'Take one additional action.',
    maxUses: 1,
    usedUses: 0,
    restType: 'short',
    source: 'Fighter',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 't2',
    name: 'Second Wind',
    description: 'Regain hit points equal to 1d10 + fighter level.',
    maxUses: 1,
    usedUses: 1,
    restType: 'short',
    source: 'Fighter',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 't3',
    name: 'Indomitable',
    description: 'Reroll a failed saving throw.',
    maxUses: 1,
    usedUses: 0,
    restType: 'long',
    source: 'Fighter',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const defaultProps = {
  traits: mockTraits,
  onUseTrait: vi.fn(),
  onDeleteTrait: vi.fn(),
  onTraitClick: vi.fn(),
  onResetTraits: vi.fn(),
};

describe('TraitTracker', () => {
  it('renders trait names', () => {
    render(<TraitTracker {...defaultProps} />);
    expect(screen.getAllByText('Action Surge').length).toBeGreaterThanOrEqual(
      1
    );
    expect(screen.getAllByText('Second Wind').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Indomitable').length).toBeGreaterThanOrEqual(1);
  });

  it('shows usage badges with remaining/max counts', () => {
    render(<TraitTracker {...defaultProps} />);
    expect(screen.getAllByText('1/1 Uses').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('0/1 Uses').length).toBeGreaterThanOrEqual(1);
  });

  it('calls onUseTrait with trait id when use button clicked', () => {
    const onUseTrait = vi.fn();
    render(<TraitTracker {...defaultProps} onUseTrait={onUseTrait} />);
    const useButtons = screen.getAllByTitle('Use ability');
    fireEvent.click(useButtons[0]);
    expect(onUseTrait).toHaveBeenCalledWith('t1');
  });

  it('calls onDeleteTrait with trait id when delete button clicked', () => {
    const onDeleteTrait = vi.fn();
    render(<TraitTracker {...defaultProps} onDeleteTrait={onDeleteTrait} />);
    const deleteButtons = screen.getAllByTitle('Delete ability');
    fireEvent.click(deleteButtons[0]);
    expect(onDeleteTrait).toHaveBeenCalledWith('t1');
  });

  it('calls onTraitClick with trait when view button clicked', () => {
    const onTraitClick = vi.fn();
    render(<TraitTracker {...defaultProps} onTraitClick={onTraitClick} />);
    const viewButtons = screen.getAllByTitle('View ability details');
    fireEvent.click(viewButtons[0]);
    expect(onTraitClick).toHaveBeenCalledWith(mockTraits[0]);
  });

  it('calls onResetTraits with short when Short Rest clicked', () => {
    const onResetTraits = vi.fn();
    render(<TraitTracker {...defaultProps} onResetTraits={onResetTraits} />);
    const shortRestButtons = screen.getAllByTitle('Reset short rest abilities');
    fireEvent.click(shortRestButtons[0]);
    expect(onResetTraits).toHaveBeenCalledWith('short');
  });

  it('calls onResetTraits with long when Long Rest clicked', () => {
    const onResetTraits = vi.fn();
    render(<TraitTracker {...defaultProps} onResetTraits={onResetTraits} />);
    const longRestButtons = screen.getAllByTitle('Reset all abilities');
    fireEvent.click(longRestButtons[0]);
    expect(onResetTraits).toHaveBeenCalledWith('long');
  });

  it('filters traits when search input is used', () => {
    render(<TraitTracker {...defaultProps} />);
    const searchInputs = screen.getAllByPlaceholderText('Search abilities...');
    fireEvent.change(searchInputs[0], { target: { value: 'Action' } });
    expect(screen.getAllByText('Action Surge').length).toBeGreaterThanOrEqual(
      1
    );
    expect(screen.queryAllByText('Second Wind').length).toBe(0);
    expect(screen.queryAllByText('Indomitable').length).toBe(0);
  });

  it('hides use and delete buttons when readonly is true', () => {
    render(<TraitTracker {...defaultProps} readonly />);
    expect(screen.queryAllByTitle('Use ability').length).toBe(0);
    expect(screen.queryAllByTitle('Delete ability').length).toBe(0);
  });

  it('shows empty state message when traits array is empty', () => {
    render(<TraitTracker {...defaultProps} traits={[]} />);
    expect(screen.getByText('No special abilities yet')).toBeInTheDocument();
  });

  it('shows only traits with usedUses > 0 when showOnlyUsed is true', () => {
    render(<TraitTracker {...defaultProps} showOnlyUsed />);
    expect(screen.getAllByText('Second Wind').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryAllByText('Action Surge').length).toBe(0);
    expect(screen.queryAllByText('Indomitable').length).toBe(0);
  });

  it('limits displayed traits when maxTraitsToShow is set', () => {
    render(<TraitTracker {...defaultProps} maxTraitsToShow={1} />);
    expect(screen.getAllByText('Action Surge').length).toBeGreaterThanOrEqual(
      1
    );
    expect(screen.queryAllByText('Second Wind').length).toBe(0);
    expect(screen.queryAllByText('Indomitable').length).toBe(0);
  });

  it('disables use button when trait has no remaining uses', () => {
    const onUseTrait = vi.fn();
    render(<TraitTracker {...defaultProps} onUseTrait={onUseTrait} />);
    const useButtons = screen.getAllByTitle('Use ability');
    const disabledButtons = useButtons.filter(
      btn => (btn as HTMLButtonElement).disabled
    );
    expect(disabledButtons.length).toBeGreaterThanOrEqual(1);
  });
});
