import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SpellFormFields } from '@/components/shared/spells/SpellFormFields';
import SpellDetailsModal from '@/components/ui/game/SpellDetailsModal';
import type { SpellFormData } from '@/utils/spellConversion';
import type { Spell } from '@/types/character';

vi.mock('@/components/ui/forms/RichTextEditor', () => ({
  default: ({
    content,
    onChange,
  }: {
    content?: string;
    onChange?: (v: string) => void;
  }) => (
    <textarea
      data-testid="rich-text-editor"
      value={content ?? ''}
      onChange={e => onChange?.(e.target.value)}
    />
  ),
}));

const mockFormData: SpellFormData = {
  name: 'Fireball',
  level: 3,
  school: 'Evocation',
  castingTime: '1 action',
  range: '150 feet',
  components: {
    verbal: true,
    somatic: true,
    material: true,
    materialDescription: 'a tiny ball of bat guano',
  },
  duration: 'Instantaneous',
  description: 'A bright streak flashes from your finger.',
  higherLevel: '',
  ritual: false,
  concentration: false,
  isPrepared: false,
  isAlwaysPrepared: false,
  actionType: '',
  savingThrow: '',
  damage: '',
  damageType: '',
  source: 'PHB',
  castingSource: '',
  freeCastMode: 'normal',
  freeCastMax: 1,
  aoe: null,
};

const mockSpell: Spell = {
  id: 'fireball',
  name: 'Fireball',
  level: 3,
  school: 'Evocation',
  castingTime: '1 action',
  range: '150 feet',
  components: {
    verbal: true,
    somatic: true,
    material: true,
    materialDescription: 'a tiny ball of bat guano',
  },
  duration: 'Instantaneous',
  description: 'A bright streak flashes from your finger.',
  concentration: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('SpellFormFields', () => {
  it('renders without crashing', () => {
    const onChange = vi.fn();
    render(<SpellFormFields formData={mockFormData} onChange={onChange} />);
    expect(screen.getByDisplayValue('Fireball')).toBeInTheDocument();
  });

  it('displays section headings', () => {
    const onChange = vi.fn();
    render(<SpellFormFields formData={mockFormData} onChange={onChange} />);
    expect(
      screen.getAllByText('Basic Information').length
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText('Casting Details').length
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Components').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Description').length).toBeGreaterThanOrEqual(1);
  });

  it('shows component checkboxes', () => {
    const onChange = vi.fn();
    render(<SpellFormFields formData={mockFormData} onChange={onChange} />);
    expect(screen.getAllByText('Verbal (V)').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Somatic (S)').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Material (M)').length).toBeGreaterThanOrEqual(
      1
    );
  });

  it('shows material description when material is true', () => {
    const onChange = vi.fn();
    render(<SpellFormFields formData={mockFormData} onChange={onChange} />);
    expect(
      screen.getAllByDisplayValue('a tiny ball of bat guano').length
    ).toBeGreaterThanOrEqual(1);
  });
});

describe('SpellDetailsModal', () => {
  it('renders spell name and level when open', () => {
    const onClose = vi.fn();
    render(
      <SpellDetailsModal spell={mockSpell} isOpen={true} onClose={onClose} />
    );
    expect(screen.getAllByText('Fireball').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Level 3').length).toBeGreaterThanOrEqual(1);
  });

  it('shows spell school', () => {
    const onClose = vi.fn();
    render(
      <SpellDetailsModal spell={mockSpell} isOpen={true} onClose={onClose} />
    );
    expect(screen.getAllByText('Evocation').length).toBeGreaterThanOrEqual(1);
  });

  it('shows casting time, range, and duration', () => {
    const onClose = vi.fn();
    render(
      <SpellDetailsModal spell={mockSpell} isOpen={true} onClose={onClose} />
    );
    expect(screen.getAllByText('1 action').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('150 feet').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Instantaneous').length).toBeGreaterThanOrEqual(
      1
    );
  });

  it('shows close button when open', () => {
    const onClose = vi.fn();
    render(
      <SpellDetailsModal spell={mockSpell} isOpen={true} onClose={onClose} />
    );
    expect(
      screen.getAllByRole('button', { name: /close/i }).length
    ).toBeGreaterThanOrEqual(1);
  });
});
