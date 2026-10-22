import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { ReactNode } from 'react';
import { expect, waitFor } from 'storybook/test';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { Card } from '@/components/ui/layout/card';
import { Section } from '@/components/ui/layout/section';
import { OVERLAY_SURFACE } from '@/components/ui/primitives/variants';
import { Measured, measured } from './measure';
import { remountOnTheme } from './remountOnTheme';
import { useComputedValue } from './useComputedValue';

/**
 * Radius, elevation and spacing, measured from the real components: a
 * section is a heading and a rule, controls have 4px corners, objects 6px,
 * and only floating layers cast the one overlay shadow.
 */
const meta: Meta = {
  title: 'Foundations/Shape and elevation',
  parameters: {
    layout: 'padded',
    a11y: { test: 'error' },
  },
  decorators: [remountOnTheme],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Tailwind's shadow utilities put empty ring layers in front of the shadow
// (transparent, all 0px); drop them so the printed value is the real one.
// Layers are split before each rgb()/rgba() colour, which is how Chrome
// writes the current --overlay-shadow; another colour space would fail the
// equality check below loudly, not pass it.
const EMPTY_LAYER = 'rgba(0, 0, 0, 0) 0px 0px 0px 0px';
function visibleShadow(value: string) {
  return value
    .split(/,\s*(?=rgba?\()/)
    .filter(layer => layer !== EMPTY_LAYER)
    .join(', ');
}

const headingRow = (section: HTMLElement) => section.firstElementChild;
const sectionContent = (section: HTMLElement) => section.lastElementChild;
const inputField = (wrapper: HTMLElement) => wrapper.querySelector('input');

function Row({
  name,
  rule,
  measure,
  value,
  children,
}: {
  name: string;
  rule: string;
  /** What is measured; also names the value for the play function. */
  measure: string;
  value: string;
  children: ReactNode;
}) {
  return (
    <li className="border-divider grid gap-3 border-b py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-center">
      <div>{children}</div>
      <div>
        <p className="type-ui text-heading">{name}</p>
        <p className="type-small text-body">{rule}</p>
        <p className="type-caption text-muted">
          {measure}: <Measured id={`${name}: ${measure}`} value={value} />
        </p>
      </div>
    </li>
  );
}

function RadiusRows() {
  const section = useComputedValue<HTMLElement>('border-top-left-radius');
  const button = useComputedValue<HTMLButtonElement>('border-top-left-radius');
  const input = useComputedValue<HTMLDivElement>('border-top-left-radius', {
    pick: inputField,
  });
  const card = useComputedValue<HTMLDivElement>('border-top-left-radius');
  const layer = useComputedValue<HTMLDivElement>('border-top-left-radius');
  return (
    <ul>
      <Row
        name="Section"
        rule="No box: a heading on a rule, then the content."
        measure="radius"
        value={section.value}
      >
        <Section ref={section.ref} heading="Hit dice" level={3}>
          <p className="type-small text-body">3 of 5 left</p>
        </Section>
      </Row>
      <Row
        name="Button"
        rule="Controls share the control radius. No pill buttons."
        measure="radius"
        value={button.value}
      >
        <Button ref={button.ref}>Add condition</Button>
      </Row>
      <Row
        name="Input"
        rule="Inputs, selects and chips share the control radius."
        measure="radius"
        value={input.value}
      >
        <div ref={input.ref}>
          <Input aria-label="Character name" placeholder="Thalia Vane" />
        </div>
      </Row>
      <Row
        name="Card"
        rule="Cards and other objects share the object radius. Cards hold one thing and never nest."
        measure="radius"
        value={card.value}
      >
        <Card ref={card.ref} padding="sm">
          <p className="type-ui text-heading">Goblin 2</p>
          <p className="type-small text-body">AC 15 · 7 HP</p>
        </Card>
      </Row>
      <Row
        name="Floating layer"
        rule="Popovers, menus, dialogs and drawers share the object radius."
        measure="radius"
        value={layer.value}
      >
        <div ref={layer.ref} className={`${OVERLAY_SURFACE} p-3`}>
          <p className="type-small text-body">Popover, menu or dialog</p>
        </div>
      </Row>
    </ul>
  );
}

function ElevationRows() {
  const card = useComputedValue<HTMLDivElement>('box-shadow');
  const layer = useComputedValue<HTMLDivElement>('box-shadow');
  // The token itself, applied to a hidden probe, to compare against.
  const token = useComputedValue<HTMLSpanElement>('box-shadow');
  return (
    <>
      <span
        ref={token.ref}
        hidden
        data-overlay-shadow={token.value}
        style={{ boxShadow: 'var(--overlay-shadow)' }}
      />
      <ul>
        <Row
          name="Card"
          rule="Nothing in the page flow has a shadow."
          measure="shadow"
          value={visibleShadow(card.value)}
        >
          <Card ref={card.ref} padding="sm">
            <p className="type-ui text-heading">Thalia Vane</p>
          </Card>
        </Row>
        <Row
          name="Floating layer"
          rule="Only floating layers, on surface-elevated, get shadow-overlay. No backdrop blur."
          measure="shadow"
          value={visibleShadow(layer.value)}
        >
          <div ref={layer.ref} className={`${OVERLAY_SURFACE} p-3`}>
            <p className="type-small text-body">Popover, menu or dialog</p>
          </div>
        </Row>
      </ul>
    </>
  );
}

function SpaceRows() {
  const above = useComputedValue<HTMLElement>('padding-bottom', {
    pick: headingRow,
  });
  const below = useComputedValue<HTMLElement>('padding-top', {
    pick: sectionContent,
  });
  return (
    <div className="space-y-3">
      <p className="type-small text-body">
        Tailwind&apos;s 4px grid: 8px within rows, 16px between blocks, 24 to
        32px between sections.
      </p>
      <div className="space-y-6">
        <Section ref={above.ref} heading="Saving throws" level={3}>
          <p className="type-small text-body">Strength +2 · Dexterity +5</p>
        </Section>
        <Section ref={below.ref} heading="Senses" level={3}>
          <p className="type-small text-body">Darkvision 60 ft</p>
        </Section>
      </div>
      <p className="type-caption text-muted">
        Heading to rule:{' '}
        <Measured id="Section heading gap" value={above.value} />. Rule to
        content: <Measured id="Section content gap" value={below.value} />.
      </p>
    </div>
  );
}

function ShapePage() {
  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h2 className="type-heading text-heading">Radius</h2>
        <p className="type-small text-body">
          Full circles only for dots, pips and medallions.
        </p>
        <RadiusRows />
      </div>
      <div>
        <h2 className="type-heading text-heading">Elevation</h2>
        <ElevationRows />
      </div>
      <div className="space-y-3">
        <h2 className="type-heading text-heading">Space</h2>
        <SpaceRows />
      </div>
    </div>
  );
}

async function checkShape(canvasElement: HTMLElement) {
  const expected: Record<string, string> = {
    'Section: radius': '0px',
    'Button: radius': '4px',
    'Input: radius': '4px',
    'Card: radius': '6px',
    'Floating layer: radius': '6px',
    'Card: shadow': 'none',
    'Section heading gap': '8px',
    'Section content gap': '16px',
  };
  for (const [name, value] of Object.entries(expected)) {
    await waitFor(() =>
      expect(measured(canvasElement, name), name).toBe(value)
    );
  }
  // The floating layer casts exactly --overlay-shadow.
  const token = canvasElement.querySelector<HTMLElement>(
    '[data-overlay-shadow]'
  )!;
  await waitFor(() => expect(token.dataset.overlayShadow).toMatch(/px/));
  await expect(measured(canvasElement, 'Floating layer: shadow')).toBe(
    token.dataset.overlayShadow
  );
}

export const ShapeAndElevation: Story = {
  render: () => <ShapePage />,
  play: async ({ canvasElement }) => checkShape(canvasElement),
};

export const ShapeAndElevationDark: Story = {
  render: () => <ShapePage />,
  globals: { theme: 'dark' },
  play: async ({ canvasElement }) => checkShape(canvasElement),
};
