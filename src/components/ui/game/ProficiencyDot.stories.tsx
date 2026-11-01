import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { expect, userEvent, within } from 'storybook/test';
import { emulateCoarsePointer } from '@/test/storybook/emulateCoarsePointer';
import { remountOnTheme } from '@/components/ui/foundations/remountOnTheme';
import {
  PROFICIENCY_LABELS,
  ProficiencyDot,
  ProficiencyDotButton,
  nextSkillProficiency,
  saveDotLabel,
  skillDotLabel,
  type ProficiencyLevel,
} from './ProficiencyDot';

/**
 * Proficiency dots for skills, tools and saves: hollow when not proficient,
 * half brass for Jack of All Trades, brass when proficient, and brass with
 * an outer ring for expertise. In edit mode the dot is a button that keeps
 * its size and gets a 24px hit area (44px on touch).
 */
const meta: Meta = {
  title: 'Game/Proficiency dot',
  parameters: {
    layout: 'padded',
    a11y: { test: 'error' },
  },
  decorators: [remountOnTheme],
};

export default meta;
type Story = StoryObj<typeof meta>;

const LEVELS: ProficiencyLevel[] = ['none', 'half', 'proficient', 'expertise'];

const THEMES = [
  { theme: 'light', label: 'Paper (light)' },
  { theme: 'dark', label: 'Felt (dark)' },
] as const;

function StatesPage() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {THEMES.map(({ theme, label }) => (
        <section
          key={theme}
          data-theme={theme}
          className="bg-background border-divider space-y-4 rounded-md border p-4"
        >
          <h2 className="type-heading text-heading">{label}</h2>
          <ul className="space-y-2">
            {LEVELS.map(level => (
              <li key={level} className="flex items-center gap-2">
                <ProficiencyDot level={level} />
                <span className="type-ui text-body">
                  {PROFICIENCY_LABELS[level]}
                </span>
              </li>
            ))}
          </ul>
          {/* Reference swatches the play test compares against. */}
          <span
            hidden
            data-probe="brass"
            style={{ color: 'var(--brass-fill)' }}
          />
          <span hidden data-probe="muted" style={{ color: 'var(--muted)' }} />
        </section>
      ))}
    </div>
  );
}

const probe = (panel: Element, name: string) =>
  getComputedStyle(panel.querySelector(`[data-probe="${name}"]`)!).color;

export const States: Story = {
  render: () => <StatesPage />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const { label } of THEMES) {
      const panel = canvas
        .getByRole('heading', { name: label })
        .closest<HTMLElement>('[data-theme]')!;
      const brass = probe(panel, 'brass');
      const muted = probe(panel, 'muted');
      const dot = (level: ProficiencyLevel) =>
        within(panel).getByRole('img', { name: PROFICIENCY_LABELS[level] });
      const circles = (level: ProficiencyLevel) =>
        Array.from(dot(level).querySelectorAll('circle'));

      // None: a hollow muted outline.
      const [hollow] = circles('none');
      await expect(getComputedStyle(hollow).stroke).toBe(muted);
      await expect(getComputedStyle(hollow).fill).toBe('none');
      // Half: a brass outline with the left half filled.
      const half = dot('half');
      await expect(getComputedStyle(half.querySelector('path')!).fill).toBe(
        brass
      );
      // Proficient: one brass disc. Expertise: the disc plus a brass ring.
      await expect(circles('proficient')).toHaveLength(1);
      await expect(getComputedStyle(circles('proficient')[0]).fill).toBe(brass);
      const [disc, ring] = circles('expertise');
      await expect(getComputedStyle(disc).fill).toBe(brass);
      await expect(getComputedStyle(ring).stroke).toBe(brass);
      // The dot is 8px; every state sits in the same 14px box.
      for (const level of LEVELS) {
        await expect(dot(level).getBoundingClientRect().width).toBe(14);
      }
    }
  },
};

const SKILLS = [
  { skill: 'Stealth', bonus: '+5', level: 'proficient' },
  { skill: 'Sleight of Hand', bonus: '+7', level: 'expertise' },
  { skill: 'Acrobatics', bonus: '+3', level: 'half' },
] as const;

function EditRows() {
  const [levels, setLevels] = useState<ProficiencyLevel[]>(
    SKILLS.map(s => s.level)
  );
  const [saveProficient, setSaveProficient] = useState(false);
  return (
    <div className="max-w-xs space-y-2">
      <div className="flex items-center gap-2 pointer-coarse:min-h-11">
        <ProficiencyDotButton
          level={saveProficient ? 'proficient' : 'none'}
          pressed={saveProficient}
          aria-label={saveDotLabel('Dexterity')}
          onClick={() => setSaveProficient(p => !p)}
        />
        <span className="type-ui text-body">Save +3</span>
      </div>
      <ul className="divide-divider divide-y">
        {SKILLS.map(({ skill, bonus }, i) => (
          <li
            key={skill}
            className="flex items-center gap-2 py-1 pointer-coarse:min-h-11"
          >
            <ProficiencyDotButton
              level={levels[i]}
              aria-label={skillDotLabel(skill, levels[i])}
              onClick={() =>
                setLevels(prev =>
                  prev.map((l, j) => (j === i ? nextSkillProficiency(l) : l))
                )
              }
            />
            <span className="type-ui text-body flex-1">{skill}</span>
            <span className="type-ui text-heading tabular-nums">{bonus}</span>
          </li>
        ))}
      </ul>
      {/* Reference swatch the play test compares the focus ring against. */}
      <span hidden data-probe="ring" style={{ color: 'var(--ring)' }} />
    </div>
  );
}

/** Edit mode: the save dot toggles, a skill dot cycles. */
export const EditMode: Story = {
  render: () => <EditRows />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const save = canvas.getByRole('button', {
      name: 'Dexterity save proficiency',
    });
    await expect(save).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(save);
    await expect(save).toHaveAttribute('aria-pressed', 'true');
    await expect(save).toHaveAttribute('data-level', 'proficient');

    // Tap through the whole cycle; the label always says what's next.
    await userEvent.click(
      canvas.getByRole('button', {
        name: 'Stealth: proficient. Add expertise.',
      })
    );
    const stealth = canvas.getByRole('button', {
      name: 'Stealth: expertise. Remove proficiency.',
    });
    await userEvent.click(stealth);
    await expect(stealth).toHaveAccessibleName(
      'Stealth: not proficient. Make proficient.'
    );
    // Keyboard works too, and focus is visible.
    stealth.focus();
    await userEvent.keyboard('{Enter}');
    await expect(stealth).toHaveAttribute('data-level', 'proficient');
    await expect(getComputedStyle(stealth).outlineStyle).toBe('solid');
    await expect(getComputedStyle(stealth).outlineColor).toBe(
      getComputedStyle(canvasElement.querySelector('[data-probe="ring"]')!)
        .color
    );

    // A half dot (Jack of All Trades) says so, and becomes proficient.
    await userEvent.click(
      canvas.getByRole('button', {
        name: 'Acrobatics: Jack of All Trades. Make proficient.',
      })
    );
    await expect(
      canvas.getByRole('button', {
        name: 'Acrobatics: proficient. Add expertise.',
      })
    ).toHaveAttribute('data-level', 'proficient');

    // With a mouse the hit area is 24px; the dot stays 14px.
    const after = getComputedStyle(save, '::after');
    await expect(after.width).toBe('24px');
    await expect(after.height).toBe('24px');
    await expect(save.getBoundingClientRect().width).toBe(14);
  },
};

export const EditModeDark: Story = {
  render: () => <EditRows />,
  globals: { theme: 'dark' },
};

/** On touch the hit area grows to 44px inside a 44px row. */
export const EditModeOnTouch: Story = {
  render: () => <EditRows />,
  beforeEach: () => emulateCoarsePointer(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const button of canvas.getAllByRole('button')) {
      const after = getComputedStyle(button, '::after');
      await expect(after.width).toBe('44px');
      await expect(after.height).toBe('44px');
      await expect(button.getBoundingClientRect().width).toBe(14);
      const row = button.parentElement!.getBoundingClientRect();
      await expect(row.height).toBeGreaterThanOrEqual(44);
    }
  },
};
