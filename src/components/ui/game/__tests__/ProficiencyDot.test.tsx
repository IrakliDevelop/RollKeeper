import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  PROFICIENCY_LABELS,
  ProficiencyDot,
  ProficiencyDotButton,
  nextSkillProficiency,
  saveDotLabel,
  skillDotLabel,
  type ProficiencyLevel,
} from '../ProficiencyDot';

const LEVELS: ProficiencyLevel[] = ['none', 'half', 'proficient', 'expertise'];

afterEach(cleanup);

describe('nextSkillProficiency', () => {
  it('cycles none → proficient → expertise → none', () => {
    expect(nextSkillProficiency('none')).toBe('proficient');
    expect(nextSkillProficiency('proficient')).toBe('expertise');
    expect(nextSkillProficiency('expertise')).toBe('none');
  });

  it('treats a Jack of All Trades half dot as not proficient', () => {
    expect(nextSkillProficiency('half')).toBe('proficient');
  });
});

describe('dot labels', () => {
  it('says the skill state and what a tap does', () => {
    expect(skillDotLabel('Stealth', 'none')).toBe(
      'Stealth: not proficient. Make proficient.'
    );
    expect(skillDotLabel('Stealth', 'half')).toBe(
      'Stealth: not proficient. Make proficient.'
    );
    expect(skillDotLabel('Stealth', 'proficient')).toBe(
      'Stealth: proficient. Add expertise.'
    );
    expect(skillDotLabel('Stealth', 'expertise')).toBe(
      'Stealth: expertise. Remove proficiency.'
    );
  });

  it('names the save', () => {
    expect(saveDotLabel('Strength')).toBe('Strength save proficiency');
  });
});

describe('ProficiencyDot', () => {
  it.each(LEVELS)('names the %s state', level => {
    render(<ProficiencyDot level={level} />);
    const dot = screen.getByRole('img', { name: PROFICIENCY_LABELS[level] });
    expect(dot).toHaveAttribute('data-level', level);
  });

  it('takes a label from the row it sits in', () => {
    render(<ProficiencyDot level="expertise" label="Stealth: expertise" />);
    expect(
      screen.getByRole('img', { name: 'Stealth: expertise' })
    ).toBeInTheDocument();
  });

  it('draws an unknown saved level as not proficient', () => {
    render(<ProficiencyDot level={'master' as ProficiencyLevel} />);
    expect(screen.getByRole('img', { name: 'Not proficient' })).toHaveAttribute(
      'data-level',
      'none'
    );
  });

  it('can stay out of the accessibility tree', () => {
    const { container } = render(
      <ProficiencyDot level="proficient" decorative />
    );
    expect(screen.queryByRole('img')).toBeNull();
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('ProficiencyDotButton', () => {
  it('is a button named by its label that reports clicks', () => {
    const onClick = vi.fn();
    render(
      <ProficiencyDotButton
        level="none"
        aria-label={skillDotLabel('Stealth', 'none')}
        onClick={onClick}
      />
    );
    const button = screen.getByRole('button', {
      name: 'Stealth: not proficient. Make proficient.',
    });
    expect(button).toHaveAttribute('type', 'button');
    expect(button).not.toHaveAttribute('aria-pressed');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('reports a save dot as pressed or not', () => {
    const { rerender } = render(
      <ProficiencyDotButton
        level="none"
        pressed={false}
        aria-label={saveDotLabel('Strength')}
      />
    );
    const button = screen.getByRole('button', {
      name: 'Strength save proficiency',
    });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    rerender(
      <ProficiencyDotButton
        level="proficient"
        pressed
        aria-label={saveDotLabel('Strength')}
      />
    );
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button).toHaveAttribute('data-level', 'proficient');
  });
});
