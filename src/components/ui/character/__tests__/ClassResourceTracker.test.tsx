import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Sun } from 'lucide-react';
import ClassResourceTracker from '../ClassResourceTracker';
import ActionsSection from '../ActionsSection';
import {
  CLASS_RESOURCE_ICONS,
  CLASS_RESOURCE_STYLE,
} from '../classResourceStyles';
import type { ActiveClassResource } from '@/utils/classResources';
import { makeCharacter } from '@/utils/__tests__/test-utils';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const resource: ActiveClassResource = {
  definition: {
    id: 'test-resource',
    className: 'Paladin',
    edition: 'XPHB',
    name: 'Test resource',
    icon: 'sparkles',
    color: 'purple',
    displayStyle: 'pips',
    minLevel: 1,
    getMaxUses: () => 3,
    getShortRestReset: () => 0,
    longRestReset: 'all',
  },
  classLevel: 1,
  maxUses: 3,
  usesExpended: 1,
  usesRemaining: 2,
  description: 'Three uses.',
};

describe('ClassResourceTracker', () => {
  it('uses the single brass resource style and the Sun icon for sparkles', () => {
    expect(CLASS_RESOURCE_ICONS.sparkles).toBe(Sun);
    expect(CLASS_RESOURCE_STYLE.pipOn).toContain('brass');
    const { container } = render(
      <ClassResourceTracker
        resource={resource}
        onUse={vi.fn()}
        onRestore={vi.fn()}
        onReset={vi.fn()}
      />
    );
    expect(container.querySelector('.bg-accent-purple-bg-strong')).toBeNull();
    expect(screen.getByText('Three uses.')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Restore all Test resource' })
    ).toBeInTheDocument();
  });

  it('spends and restores one pip, with coarse pointer targets', () => {
    const onUse = vi.fn();
    const onRestore = vi.fn();
    render(
      <ClassResourceTracker
        resource={resource}
        onUse={onUse}
        onRestore={onRestore}
        onReset={vi.fn()}
      />
    );
    const spend = screen.getAllByRole('button', {
      name: 'Spend 1 Test resource',
    });
    const restore = screen.getByRole('button', {
      name: 'Restore 1 Test resource',
    });
    expect(spend[0]).toHaveClass('pointer-coarse:min-h-11');
    fireEvent.click(spend[0]);
    fireEvent.click(restore);
    expect(onUse).toHaveBeenCalledWith('test-resource', 1);
    expect(onRestore).toHaveBeenCalledWith('test-resource', 1);
  });

  it('stores the class-resource disclosure in validated device preferences', () => {
    const character = makeCharacter({
      classes: [
        {
          className: 'Fighter',
          level: 1,
          isCustom: false,
          hitDie: 10,
          classSource: 'XPHB',
        },
      ],
      totalLevel: 1,
    });
    render(
      <ActionsSection
        character={character}
        showAttackRoll={vi.fn()}
        showSavingThrow={vi.fn()}
        showDamageRoll={vi.fn()}
        switchToTab={vi.fn()}
        onStopConcentration={vi.fn()}
        showClassResources
        onUseClassResource={vi.fn()}
        onRestoreClassResource={vi.fn()}
        onResetClassResource={vi.fn()}
      />
    );
    const disclosure = screen.getByRole('button', { name: 'Class Resources' });
    fireEvent.click(disclosure);
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    expect(
      JSON.parse(localStorage.getItem('rollkeeper-ui-prefs')!)
    ).toMatchObject({ collapsed: { 'class-resources': true } });
    expect(localStorage.getItem('subsection-class-resources')).toBeNull();
  });

  it('stores Actions disclosures in device preferences and keeps the resource block between lists', () => {
    const character = makeCharacter({
      favoriteFeatureIds: ['pinned-feature'],
      classes: [
        {
          className: 'Fighter',
          level: 1,
          isCustom: false,
          hitDie: 10,
          classSource: 'XPHB',
        },
      ],
      totalLevel: 1,
    });
    const { container } = render(
      <ActionsSection
        character={character}
        showAttackRoll={vi.fn()}
        showSavingThrow={vi.fn()}
        showDamageRoll={vi.fn()}
        switchToTab={vi.fn()}
        onStopConcentration={vi.fn()}
        showClassResources
        onUseClassResource={vi.fn()}
        onRestoreClassResource={vi.fn()}
        onResetClassResource={vi.fn()}
      />
    );

    for (const [label, key] of [
      ['Ready Weapons', 'actions-ready-weapons'],
      ['Quick Features', 'actions-quick-features'],
      ['Quick Spells', 'actions-quick-spells'],
    ]) {
      const disclosure = screen.getByRole('button', { name: label });
      fireEvent.click(disclosure);
      expect(disclosure).toHaveAttribute('aria-expanded', 'false');
      expect(
        JSON.parse(localStorage.getItem('rollkeeper-ui-prefs')!)
      ).toMatchObject({
        collapsed: { [key]: true },
      });
    }
    expect(localStorage.getItem('subsection-ready-weapons')).toBeNull();
    const headings = Array.from(container.querySelectorAll('h3')).map(
      heading => heading.textContent
    );
    expect(headings.indexOf('Class Resources')).toBeGreaterThan(
      headings.indexOf('Ready Weapons')
    );
    expect(headings.indexOf('Class Resources')).toBeLessThan(
      headings.indexOf('Quick Features')
    );
  });
});
