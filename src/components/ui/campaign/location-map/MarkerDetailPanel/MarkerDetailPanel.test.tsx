import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  render,
  screen,
  cleanup,
  waitFor,
  fireEvent,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createHtmlElement, createNote } from '@fieldnotes/core';
import type { CanvasElement } from '@fieldnotes/core';

import MarkerDetailPanel from './index';
import {
  resolveMarkerPanelState,
  MARKER_PANEL_CONTAINMENT_CLASS,
} from './MarkerDetailPanel.utils';
import type {
  MarkerPanelMode,
  MarkerPanelState,
  ResolvedPortalState,
} from './MarkerDetailPanel.types';

import {
  MARKER_HTML_TYPE,
  MARKER_KINDS,
  buildMarkerData,
  type MarkerKind,
} from '../markerData';

import { useMagicItemLibraryStore } from '@/store/magicItemLibraryStore';
import type {
  MarkerDetail,
  MarkerLootEntry,
  PublicMarkerDetail,
} from '@/types/battlemap';
import type { CustomMagicItem } from '@/types/magicItemLibrary';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('@/components/ui/forms/CompactRichTextEditor', () => ({
  CompactRichTextEditor: ({
    content,
    onChange,
    ariaLabel,
  }: {
    content: string;
    onChange: (value: string) => void;
    ariaLabel?: string;
  }) => (
    <textarea
      aria-label={ariaLabel}
      value={content.replace(/^<p>|<\/p>$/g, '')}
      onChange={event =>
        onChange(event.target.value ? `<p>${event.target.value}</p>` : '')
      }
    />
  ),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Raw Tailwind colour classes banned everywhere except the shared Dialog
 * overlay scrim, which is intentionally outside this component's authored
 * markup (see the note on the "no raw Tailwind colours" test below). */
const RAW_TAILWIND_COLOR_RE =
  /\b(?:bg|text|border)-(?:gray|slate|zinc|neutral|stone|white|black)\b/;

/** Builds a valid marker `html` canvas element. Pass `data` to override the
 * payload with an arbitrary (possibly malformed) raw value. */
function markerElement(
  overrides: {
    kind?: MarkerKind;
    ref?: string;
    label?: string;
    htmlType?: string;
    data?: Record<string, unknown>;
  } = {}
): CanvasElement {
  const { htmlType = MARKER_HTML_TYPE, data } = overrides;
  return createHtmlElement({
    position: { x: 0, y: 0 },
    size: { w: 40, h: 40 },
    htmlType,
    data: data ?? {
      ...buildMarkerData({
        kind: overrides.kind ?? 'door',
        ref: overrides.ref ?? 'ref-1',
        label: overrides.label,
      }),
    },
  });
}

function detail(overrides: Partial<MarkerDetail> = {}): MarkerDetail {
  return {
    id: 'ref-1',
    title: 'A title',
    body: 'A body',
    dmNotes: 'Secret DM notes',
    ...overrides,
  };
}

/** Throws instead of using a non-null assertion (banned by CONSTRAINTS-B) so
 * the narrowed value can be used directly afterwards. */
function required<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) {
    throw new Error(`expected ${what} to be present`);
  }
  return value;
}

/** The four non-`ready` states, shared by the distinctness test and the
 * touch-target test below — one case table so both stay in sync as states
 * are added. */
function nonReadyStateCases(
  data: ReturnType<typeof buildMarkerData>
): { mode: MarkerPanelMode; state: MarkerPanelState }[] {
  return [
    { mode: 'dm', state: { kind: 'missing-detail', data } },
    { mode: 'player', state: { kind: 'unpublished', data } },
    {
      mode: 'player',
      state: { kind: 'invalid-data', reason: 'bad payload' },
    },
    { mode: 'player', state: { kind: 'unsupported-version', version: 7 } },
  ];
}

describe('resolveMarkerPanelState', () => {
  it.each(MARKER_KINDS)(
    'resolves "ready" for a %s marker with a matching, live detail',
    kind => {
      const element = markerElement({ kind, ref: 'ref-1' });
      const result = resolveMarkerPanelState(
        element,
        [detail({ id: 'ref-1' })],
        'dm'
      );
      expect(result.kind).toBe('ready');
      if (result.kind !== 'ready') return;
      expect(result.data.kind).toBe(kind);
      expect(result.detail.id).toBe('ref-1');
    }
  );

  it('resolves "missing-detail" in dm mode and "unpublished" in player mode when no detail matches', () => {
    const element = markerElement({ ref: 'ref-1' });
    // A live, non-deleted detail whose id is NOT the element's ref: the ref
    // comparison in the resolver's `find` is the sole reason neither call
    // resolves `ready`. Passing `[]` here would leave that comparison
    // unpinned (`markers.find(m => !m.deletedAt)` would still be green).
    const otherMarkers = [detail({ id: 'some-other-ref' })];
    expect(resolveMarkerPanelState(element, otherMarkers, 'dm').kind).toBe(
      'missing-detail'
    );
    expect(resolveMarkerPanelState(element, otherMarkers, 'player').kind).toBe(
      'unpublished'
    );
  });

  it('resolves "invalid-data" for a null element and "unsupported-version" for an unsupported v', () => {
    expect(resolveMarkerPanelState(null, [], 'dm').kind).toBe('invalid-data');

    const futureElement = markerElement({
      data: { v: 2, kind: 'door', ref: 'ref-1' },
    });
    const result = resolveMarkerPanelState(futureElement, [], 'dm');
    expect(result.kind).toBe('unsupported-version');
    if (result.kind === 'unsupported-version') {
      expect(result.version).toBe(2);
    }
  });

  it('the mode branch is pinned: the SAME valid element with a missing detail resolves differently per mode', () => {
    const element = markerElement({ ref: 'shared-ref' });
    const dmResult = resolveMarkerPanelState(element, [], 'dm');
    const playerResult = resolveMarkerPanelState(element, [], 'player');
    expect(dmResult.kind).toBe('missing-detail');
    expect(playerResult.kind).toBe('unpublished');
  });

  it('treats a soft-deleted detail as missing; the same fixture without deletedAt resolves ready (positive control)', () => {
    const element = markerElement({ ref: 'ref-1' });
    const deletedResult = resolveMarkerPanelState(
      element,
      [detail({ id: 'ref-1', deletedAt: '2026-01-01T00:00:00.000Z' })],
      'dm'
    );
    expect(deletedResult.kind).toBe('missing-detail');

    const liveResult = resolveMarkerPanelState(
      element,
      [detail({ id: 'ref-1' })],
      'dm'
    );
    expect(liveResult.kind).toBe('ready');
  });

  it('resolves "invalid-data" for a non-marker html element and for a note element', () => {
    const nonMarkerHtml = markerElement({ htmlType: 'some-other-embed' });
    const noteElement = createNote({
      position: { x: 0, y: 0 },
      text: 'a sticky note, not a marker',
    });

    expect(resolveMarkerPanelState(nonMarkerHtml, [], 'dm').kind).toBe(
      'invalid-data'
    );
    expect(resolveMarkerPanelState(noteElement, [], 'dm').kind).toBe(
      'invalid-data'
    );
  });
});

describe('MarkerDetailPanel', () => {
  it('opens a loot editor before campaign item and NPC collections exist', () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ players: [] }) });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MarkerDetailPanel
        open
        mode="dm"
        campaignCode="NEW-CAMPAIGN"
        state={{
          kind: 'ready',
          data: buildMarkerData({ kind: 'loot', ref: 'ref-1' }),
          detail: detail({ loot: [] }),
        }}
        onClose={() => {}}
        onSave={() => {}}
      />
    );

    expect(
      screen.getByRole('heading', { name: 'Loot contents' })
    ).toBeVisible();
    expect(screen.getByText('No loot added yet.')).toBeVisible();
  });

  it('DM edit saves title, body and dmNotes with exactly the typed values', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const state: MarkerPanelState = {
      kind: 'missing-detail',
      data: buildMarkerData({ kind: 'door', ref: 'ref-1' }),
    };

    render(
      <MarkerDetailPanel
        open
        mode="dm"
        state={state}
        onClose={() => {}}
        onSave={onSave}
        onDelete={() => {}}
      />
    );

    await user.type(screen.getByLabelText('Title'), 'Cellar Door');
    await user.type(screen.getByLabelText('Body'), 'Locked, needs a key.');
    await user.type(
      screen.getByLabelText('DM notes — never shown to players'),
      'Key is under the mat.'
    );
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith({
      title: '<p>Cellar Door</p>',
      body: '<p>Locked, needs a key.</p>',
      dmNotes: '<p>Key is under the mat.</p>',
      status: 'closed',
    });
  });

  it.each([
    ['door', 'Locked', 'locked'],
    ['trap', 'Disarmed', 'disarmed'],
    ['loot', 'Claimed', 'claimed'],
    ['npc', 'Defeated / gone', 'defeated'],
    ['secret', 'Revealed', 'revealed'],
    ['note', 'Resolved', 'resolved'],
  ] as const)(
    'gives a %s marker useful kind-specific state',
    async (kind, label, status) => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      render(
        <MarkerDetailPanel
          open
          mode="dm"
          state={{
            kind: 'ready',
            data: buildMarkerData({ kind, ref: 'ref-1' }),
            detail: detail(),
          }}
          onClose={() => {}}
          onSave={onSave}
        />
      );

      await user.click(screen.getByLabelText('Status'));
      await user.click(screen.getByRole('option', { name: label }));
      await user.click(screen.getByRole('button', { name: 'Save' }));
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ status }));
      cleanup();
    }
  );

  it('shows a shared marker status to a player without edit controls', () => {
    render(
      <MarkerDetailPanel
        open
        mode="player"
        state={{
          kind: 'ready',
          data: buildMarkerData({ kind: 'trap', ref: 'ref-1' }),
          detail: detail({ status: 'triggered' }),
        }}
        onClose={() => {}}
      />
    );
    expect(screen.getByText('Status: Triggered')).toBeTruthy();
    expect(screen.queryByLabelText('Status')).toBeNull();
  });

  it('lets a player claim available loot and disables depleted entries', async () => {
    const user = userEvent.setup();
    const onClaimLoot = vi.fn().mockResolvedValue(1);
    render(
      <MarkerDetailPanel
        open
        mode="player"
        state={{
          kind: 'ready',
          data: buildMarkerData({ kind: 'loot', ref: 'ref-1' }),
          detail: {
            id: 'ref-1',
            title: 'Chest',
            body: 'Choose one.',
            loot: [
              {
                id: 'potion',
                name: 'Potion',
                itemKind: 'inventory',
                quantity: 1,
                remainingQuantity: 1,
              },
              {
                id: 'sword',
                name: 'Sword',
                itemKind: 'inventory',
                quantity: 1,
                remainingQuantity: 0,
              },
            ],
          },
        }}
        onClose={() => {}}
        onClaimLoot={onClaimLoot}
      />
    );

    const claimPotion = screen.getByRole('button', { name: 'Claim 1' });
    const claimSword = screen.getByRole('button', { name: 'Taken' });
    expect(claimPotion).toBeEnabled();
    expect(claimSword).toBeDisabled();
    await user.click(claimPotion);
    expect(onClaimLoot).toHaveBeenCalledWith('potion', 1);
    expect(screen.getByRole('status')).toHaveTextContent('Claimed');
  });

  it('saves private discovery and disarm mechanics for a trap', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <MarkerDetailPanel
        open
        mode="dm"
        state={{
          kind: 'ready',
          data: buildMarkerData({ kind: 'trap', ref: 'ref-1' }),
          detail: detail(),
        }}
        onClose={() => {}}
        onSave={onSave}
      />
    );

    await user.type(screen.getByLabelText('Discovery DC'), '15');
    await user.click(screen.getByLabelText('Discovery skill'));
    await user.click(screen.getByRole('option', { name: 'Investigation' }));
    await user.type(screen.getByLabelText('Disarm DC'), '17');
    await user.click(screen.getByLabelText('Disarm method'));
    await user.click(screen.getByRole('option', { name: 'Arcana' }));
    await user.type(screen.getByLabelText('Trigger'), 'Touching the idol');
    await user.type(screen.getByLabelText('Damage'), '4d6 fire');
    await user.type(screen.getByLabelText('Trap effect'), 'The room ignites.');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        discovery: { dc: 15, skill: 'investigation' },
        trap: {
          disarmDc: 17,
          disarmMethod: 'arcana',
          trigger: 'Touching the idol',
          damage: '4d6 fire',
          effect: 'The room ignites.',
        },
      })
    );
  });

  it('keeps discovery and trap mechanics out of the player panel', () => {
    render(
      <MarkerDetailPanel
        open
        mode="player"
        state={{
          kind: 'ready',
          data: buildMarkerData({ kind: 'trap', ref: 'ref-1' }),
          detail: detail({
            discovery: { dc: 19, skill: 'perception' },
            trap: {
              disarmDc: 21,
              disarmMethod: 'thieves-tools',
              trigger: 'Secret trigger',
              effect: 'Secret effect',
              damage: '10d10',
            },
          }),
        }}
        onClose={() => {}}
      />
    );

    expect(screen.queryByLabelText('Discovery DC')).toBeNull();
    expect(screen.queryByText('Secret trigger')).toBeNull();
    expect(screen.queryByText('10d10')).toBeNull();
  });

  it.each(['trap', 'secret'] as const)(
    'reveals and hides a %s through the marker audience control',
    async kind => {
      const user = userEvent.setup();
      const onAudienceChange = vi.fn();
      const state: MarkerPanelState = {
        kind: 'ready',
        data: buildMarkerData({ kind, ref: 'ref-1' }),
        detail: detail(),
      };
      const { rerender } = render(
        <MarkerDetailPanel
          open
          mode="dm"
          state={state}
          isDmOnly
          onAudienceChange={onAudienceChange}
          onClose={() => {}}
        />
      );

      expect(screen.getByText('Hidden from players')).toBeTruthy();
      await user.click(
        screen.getByRole('button', { name: 'Reveal to players' })
      );
      expect(onAudienceChange).toHaveBeenLastCalledWith(false);

      rerender(
        <MarkerDetailPanel
          open
          mode="dm"
          state={state}
          isDmOnly={false}
          onAudienceChange={onAudienceChange}
          onClose={() => {}}
        />
      );
      expect(screen.getByText('Discovered')).toBeTruthy();
      await user.click(
        screen.getByRole('button', { name: 'Hide from players' })
      );
      expect(onAudienceChange).toHaveBeenLastCalledWith(true);
    }
  );

  it('does not show discovery audience actions for an ordinary note', () => {
    render(
      <MarkerDetailPanel
        open
        mode="dm"
        state={{
          kind: 'ready',
          data: buildMarkerData({ kind: 'note', ref: 'ref-1' }),
          detail: detail(),
        }}
        isDmOnly
        onAudienceChange={() => {}}
        onClose={() => {}}
      />
    );
    expect(
      screen.queryByRole('button', { name: 'Reveal to players' })
    ).toBeNull();
  });

  it('surfaces a refused mixed-audience transition in the panel', () => {
    render(
      <MarkerDetailPanel
        open
        mode="dm"
        state={{
          kind: 'ready',
          data: buildMarkerData({ kind: 'trap', ref: 'ref-1' }),
          detail: detail(),
        }}
        isDmOnly
        audienceNotice="The linked pins do not agree."
        onClose={() => {}}
      />
    );
    expect(screen.getByRole('alert').textContent).toContain(
      'linked pins do not agree'
    );
  });

  it('prefills each DM edit field from its own source field (guards against a body/dmNotes field swap)', () => {
    const state: MarkerPanelState = {
      kind: 'ready',
      data: buildMarkerData({ kind: 'npc', ref: 'ref-1' }),
      detail: detail({
        title: 'Distinct Title Value',
        body: 'Distinct Body Value',
        dmNotes: 'Distinct DM Notes Value',
      }),
    };

    render(
      <MarkerDetailPanel
        open
        mode="dm"
        state={state}
        onClose={() => {}}
        onSave={() => {}}
        onDelete={() => {}}
      />
    );

    expect(screen.getByLabelText('Title')).toHaveValue('Distinct Title Value');
    expect(screen.getByLabelText('Body')).toHaveValue('Distinct Body Value');
    expect(
      screen.getByLabelText('DM notes — never shown to players')
    ).toHaveValue('Distinct DM Notes Value');
  });

  it('renders player title and body as text nodes, never parsed as markup', () => {
    const dangerousTitle = '<script>window.__pwned = true</script>';
    const dangerousBody = '<img src=x onerror="alert(1)">';
    const state: MarkerPanelState = {
      kind: 'ready',
      data: buildMarkerData({ kind: 'trap', ref: 'ref-1' }),
      detail: detail({ title: dangerousTitle, body: dangerousBody }),
    };

    const { baseElement } = render(
      <MarkerDetailPanel open mode="player" state={state} onClose={() => {}} />
    );

    expect(screen.getByText(dangerousTitle)).toBeInTheDocument();
    expect(screen.getByText(dangerousBody)).toBeInTheDocument();
    // Which node holds which: the two assertions above are satisfied by a
    // title/body prop swap, since both values are still on the page. `body`
    // is the field that publishes to players, so pin it to its own node.
    expect(screen.getByTestId('marker-panel-body')).toHaveTextContent(
      dangerousBody
    );
    expect(baseElement.querySelector('img')).toBeNull();
    expect(baseElement.querySelector('script')).toBeNull();
  });

  it('never renders dmNotes in player mode; the identical fixture surfaces it in dm mode (positive control)', () => {
    const dmNotesValue = 'Only the DM should ever see this exact string';
    const readyState: MarkerPanelState = {
      kind: 'ready',
      data: buildMarkerData({ kind: 'npc', ref: 'ref-1' }),
      detail: detail({ dmNotes: dmNotesValue }),
    };

    const player = render(
      <MarkerDetailPanel
        open
        mode="player"
        state={readyState}
        onClose={() => {}}
      />
    );
    expect(player.queryByText(dmNotesValue)).toBeNull();
    expect(player.baseElement.innerHTML).not.toContain(dmNotesValue);
    player.unmount();

    const dm = render(
      <MarkerDetailPanel
        open
        mode="dm"
        state={readyState}
        onClose={() => {}}
        onSave={() => {}}
        onDelete={() => {}}
      />
    );
    // Positive control: same fixture, dm mode, proves the query would have
    // found the string had player mode also rendered it. Symmetric with the
    // negative assertion above (`getByDisplayValue` + `innerHTML`, matching
    // `queryByText` + `innerHTML`).
    expect(dm.getByLabelText('DM notes — never shown to players')).toHaveValue(
      dmNotesValue
    );
    expect(dm.baseElement.innerHTML).toContain(dmNotesValue);
  });

  it('names an unlabelled npc marker by its kind label in player missing-detail', () => {
    const data = buildMarkerData({ kind: 'npc', ref: 'ref-1' });
    render(
      <MarkerDetailPanel
        open
        mode="player"
        state={{ kind: 'missing-detail', data }}
        onClose={() => {}}
      />
    );
    expect(
      screen.getByTestId('marker-panel-state-missing-detail')
    ).toHaveTextContent('for this "NPC" marker.');
  });

  it('gates the missing-detail edit form on dm mode; player mode gets the read-only treatment (positive control: dm mode renders the form)', () => {
    const data = buildMarkerData({ kind: 'door', ref: 'ref-1' });
    const state: MarkerPanelState = { kind: 'missing-detail', data };

    const player = render(
      <MarkerDetailPanel
        open
        mode="player"
        state={state}
        onClose={() => {}}
        onSave={() => {}}
        onDelete={() => {}}
      />
    );
    expect(player.baseElement.querySelector('textarea')).toBeNull();
    expect(player.queryByRole('button', { name: 'Save' })).toBeNull();
    expect(player.queryByRole('button', { name: 'Delete' })).toBeNull();
    expect(player.baseElement.innerHTML).not.toContain('DM notes');
    player.unmount();

    // Positive control: the identical fixture in dm mode does render the
    // edit form, proving the assertions above would have caught it had
    // player mode also rendered it.
    const dm = render(
      <MarkerDetailPanel
        open
        mode="dm"
        state={state}
        onClose={() => {}}
        onSave={() => {}}
        onDelete={() => {}}
      />
    );
    expect(dm.baseElement.querySelectorAll('textarea').length).toBe(3);
    expect(dm.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(dm.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(dm.baseElement.innerHTML).toContain('DM notes');
  });

  it('renders four distinct non-ready states with pairwise-distinct testids and messages', () => {
    const data = buildMarkerData({ kind: 'secret', ref: 'ref-1' });
    const cases = nonReadyStateCases(data);

    const testids = new Set<string>();
    const messages = new Set<string>();

    for (const { mode, state } of cases) {
      const result = render(
        <MarkerDetailPanel
          open
          mode={mode}
          state={state}
          onClose={() => {}}
          onSave={() => {}}
          onDelete={() => {}}
        />
      );
      const node = required(
        result.baseElement.querySelector(
          '[data-testid^="marker-panel-state-"]'
        ),
        `a marker-panel-state-* node for ${state.kind}`
      );
      testids.add(required(node.getAttribute('data-testid'), 'data-testid'));
      messages.add(node.textContent ?? '');
      result.unmount();
    }

    expect(testids.size).toBe(4);
    expect(messages.size).toBe(4);
  });

  it('contains a long body value inside the exported containment class', () => {
    const longBody = 'x'.repeat(5000);
    const state: MarkerPanelState = {
      kind: 'ready',
      data: buildMarkerData({ kind: 'loot', ref: 'ref-1' }),
      detail: detail({ body: longBody }),
    };

    const { baseElement } = render(
      <MarkerDetailPanel open mode="player" state={state} onClose={() => {}} />
    );

    const bodyNode = required(
      baseElement.querySelector('[data-testid="marker-panel-body"]'),
      'the marker-panel-body node'
    );
    expect(bodyNode.className).toContain(MARKER_PANEL_CONTAINMENT_CLASS);
  });

  it('renders every control as a Button primitive', () => {
    const data = buildMarkerData({ kind: 'note', ref: 'ref-1' });
    const trapData = buildMarkerData({ kind: 'trap', ref: 'ref-1' });
    const cases: {
      mode: MarkerPanelMode;
      state: MarkerPanelState;
      portalState?: ResolvedPortalState;
    }[] = [
      ...nonReadyStateCases(data),
      // The panel's own footer ghost Close is the only interactive control
      // in the player read-only view (and in all three message states
      // above); without this case it is never covered by this test.
      { mode: 'player', state: { kind: 'ready', data, detail: detail() } },
      // The full DM form: audience toggle, trap fields, destination link,
      // Delete and Save.
      {
        mode: 'dm',
        state: { kind: 'ready', data: trapData, detail: detail() },
        portalState: {
          target: { v: 1, kind: 'battlemap', id: 'map-b' },
          resolved: {
            status: 'ready',
            name: 'Crypt',
            href: '/dm/campaign/ABC/battlemaps/map-b',
          },
          battleMapChoices: [{ id: 'map-b', name: 'Crypt' }],
          locationChoices: [],
        },
      },
    ];

    for (const { mode, state, portalState } of cases) {
      const { unmount } = render(
        <MarkerDetailPanel
          open
          mode={mode}
          state={state}
          isDmOnly
          onAudienceChange={() => {}}
          portalState={portalState}
          onClose={() => {}}
          onSave={() => {}}
          onDelete={() => {}}
        />
      );

      // Role queries skip the Radix select triggers (role="combobox").
      const buttons = within(screen.getByRole('dialog')).getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
      buttons.forEach(button => {
        expect(button).toHaveAttribute('data-variant');
      });
      unmount();
    }
  });

  it('the audience toggle is an outline action', () => {
    render(
      <MarkerDetailPanel
        open
        mode="dm"
        state={{
          kind: 'ready',
          data: buildMarkerData({ kind: 'secret', ref: 'ref-1' }),
          detail: detail(),
        }}
        isDmOnly
        onAudienceChange={() => {}}
        onClose={() => {}}
      />
    );
    const toggle = screen.getByRole('button', { name: 'Reveal to players' });
    expect(toggle).toHaveAttribute('data-variant', 'secondary');
    expect(toggle).not.toHaveAttribute('aria-pressed');
  });

  it('labels the Status select and saves the chosen status', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <MarkerDetailPanel
        open
        mode="dm"
        state={{
          kind: 'ready',
          data: buildMarkerData({ kind: 'door', ref: 'ref-1' }),
          detail: detail(),
        }}
        onClose={() => {}}
        onSave={onSave}
      />
    );

    await user.click(screen.getByRole('combobox', { name: 'Status' }));
    await user.click(screen.getByRole('option', { name: 'Locked' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'locked' })
    );
  });

  it('saves an empty discovery DC as undefined and clamps 45 to 40', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <MarkerDetailPanel
        open
        mode="dm"
        state={{
          kind: 'ready',
          data: buildMarkerData({ kind: 'trap', ref: 'ref-1' }),
          detail: detail({
            discovery: { dc: 12, skill: 'perception' },
            trap: {
              disarmDc: 10,
              disarmMethod: 'thieves-tools',
              trigger: '',
              effect: '',
              damage: '',
            },
          }),
        }}
        onClose={() => {}}
        onSave={onSave}
      />
    );

    await user.clear(screen.getByLabelText('Discovery DC'));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenLastCalledWith(
      expect.objectContaining({
        discovery: { dc: undefined, skill: 'perception' },
      })
    );

    await user.clear(screen.getByLabelText('Disarm DC'));
    await user.type(screen.getByLabelText('Disarm DC'), '45');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenLastCalledWith(
      expect.objectContaining({
        trap: expect.objectContaining({ disarmDc: 40 }),
      })
    );
  });

  it('groups trap fields under Discovery and Trap mechanics headings', () => {
    render(
      <MarkerDetailPanel
        open
        mode="dm"
        state={{
          kind: 'ready',
          data: buildMarkerData({ kind: 'trap', ref: 'ref-1' }),
          detail: detail(),
        }}
        onClose={() => {}}
        onSave={() => {}}
      />
    );

    expect(
      screen.getByRole('heading', { name: 'Discovery', level: 4 })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Trap mechanics', level: 4 })
    ).toBeInTheDocument();
  });

  it('puts Title, Body and DM notes before the kind sections on a trap form', () => {
    render(
      <MarkerDetailPanel
        open
        mode="dm"
        state={{
          kind: 'ready',
          data: buildMarkerData({ kind: 'trap', ref: 'ref-1' }),
          detail: detail(),
        }}
        onClose={() => {}}
        onSave={() => {}}
      />
    );

    const status = screen.getByRole('combobox', { name: 'Status' });
    const title = screen.getByLabelText('Title');
    const dmNotes = screen.getByLabelText('DM notes — never shown to players');
    const discovery = screen.getByRole('heading', {
      name: 'Discovery',
      level: 4,
    });
    const follows = (a: Element, b: Element) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(follows(status, title)).toBe(true);
    expect(follows(title, dmNotes)).toBe(true);
    expect(follows(dmNotes, discovery)).toBe(true);
  });

  it('shows the DM label as typed and NPC for an unlabelled npc', () => {
    const labelled = render(
      <MarkerDetailPanel
        open
        mode="dm"
        state={{
          kind: 'ready',
          data: buildMarkerData({
            kind: 'loot',
            ref: 'ref-1',
            label: 'goblin chest',
          }),
          detail: detail(),
        }}
        onClose={() => {}}
        onSave={() => {}}
      />
    );
    expect(
      within(screen.getByRole('dialog')).getByRole('heading', { level: 2 })
    ).toHaveTextContent('goblin chest');
    labelled.unmount();

    const unlabelled = render(
      <MarkerDetailPanel
        open
        mode="player"
        state={{
          kind: 'unpublished',
          data: buildMarkerData({ kind: 'npc', ref: 'ref-1' }),
        }}
        onClose={() => {}}
      />
    );
    expect(
      within(screen.getByRole('dialog')).getByRole('heading', { level: 2 })
    ).toHaveTextContent('NPC');
    expect(
      screen.getByTestId('marker-panel-state-unpublished')
    ).toHaveTextContent('this "NPC" marker.');
    unlabelled.unmount();
  });

  it('resets the form when the panel opens on a different marker', async () => {
    const user = userEvent.setup();
    const stateA: MarkerPanelState = {
      kind: 'ready',
      data: buildMarkerData({ kind: 'door', ref: 'ref-1' }),
      detail: detail({ id: 'ref-1', title: 'Original A' }),
    };
    const stateB: MarkerPanelState = {
      kind: 'ready',
      data: buildMarkerData({ kind: 'door', ref: 'ref-2' }),
      detail: detail({ id: 'ref-2', title: 'Original B' }),
    };

    const { rerender, getByLabelText } = render(
      <MarkerDetailPanel
        open
        mode="dm"
        state={stateA}
        onClose={() => {}}
        onSave={() => {}}
        onDelete={() => {}}
      />
    );

    await user.clear(getByLabelText('Title'));
    await user.type(getByLabelText('Title'), 'typed but never saved');
    expect(getByLabelText('Title')).toHaveValue('typed but never saved');

    rerender(
      <MarkerDetailPanel
        open
        mode="dm"
        state={stateB}
        onClose={() => {}}
        onSave={() => {}}
        onDelete={() => {}}
      />
    );

    expect(getByLabelText('Title')).toHaveValue('Original B');
  });

  /**
   * Scans a dialog subtree's raw HTML for banned Tailwind colour classes.
   * Uses `outerHTML`, not `innerHTML`, so the dialog node's own class
   * attribute is in scope too. Nothing is stripped, so the filled `Button`
   * variants this panel uses (`primary` Save, `danger` Delete) are scanned
   * with their real classes, as is any raw colour the component passes down
   * to a `Button`'s `className` (e.g. `bg-gray-800`).
   *
   * `[role="dialog"]` already excludes the shared `DialogOverlay` scrim
   * (`bg-surface-overlay`), a sibling node outside this component's authored
   * markup.
   */
  function dialogHtmlForColorScan(dialog: Element): string {
    return dialog.outerHTML;
  }

  it('never emits raw Tailwind colour classes, in dm or player mode', () => {
    const data = buildMarkerData({ kind: 'door', ref: 'ref-1' });
    const readyState: MarkerPanelState = {
      kind: 'ready',
      data,
      detail: detail(),
    };

    const dm = render(
      <MarkerDetailPanel
        open
        mode="dm"
        state={readyState}
        onClose={() => {}}
        onSave={() => {}}
        onDelete={() => {}}
      />
    );
    const dmDialog = required(
      dm.baseElement.querySelector('[role="dialog"]'),
      'the dm dialog node'
    );
    expect(RAW_TAILWIND_COLOR_RE.test(dialogHtmlForColorScan(dmDialog))).toBe(
      false
    );
    dm.unmount();

    const player = render(
      <MarkerDetailPanel
        open
        mode="player"
        state={readyState}
        onClose={() => {}}
      />
    );
    const playerDialog = required(
      player.baseElement.querySelector('[role="dialog"]'),
      'the player dialog node'
    );
    expect(
      RAW_TAILWIND_COLOR_RE.test(dialogHtmlForColorScan(playerDialog))
    ).toBe(false);
  });
});

describe('MarkerDetailPanel player loot: locked container and quantity stepper', () => {
  /** Builds a "ready" player state around a `PublicMarkerDetail` — the
   * player surface never sees a `MarkerDetail`, so `lootLocked` (present
   * only on the public projection) has to be set on a literal like this
   * rather than through the DM-shaped `detail()` helper above. */
  function lootReadyState(
    overrides: Partial<PublicMarkerDetail> = {}
  ): MarkerPanelState {
    return {
      kind: 'ready',
      data: buildMarkerData({ kind: 'loot', ref: 'ref-1' }),
      detail: { id: 'ref-1', title: 'Chest', body: '', ...overrides },
    };
  }

  const arrowsLoot = (remainingQuantity: number) => [
    {
      id: 'loot-1',
      name: 'Arrows',
      itemKind: 'inventory' as const,
      quantity: 8,
      remainingQuantity,
    },
  ];

  it('shows a locked notice and no item list when the container is locked', () => {
    render(
      <MarkerDetailPanel
        open
        mode="player"
        state={lootReadyState({
          title: 'Chest',
          body: 'Iron-banded.',
          lootLocked: true,
        })}
        onClose={() => {}}
        onClaimLoot={vi.fn()}
      />
    );
    expect(screen.getByText('Locked')).toBeInTheDocument();
    expect(
      screen.getByText(/you'd need to get it open first/i)
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /claim/i })).toBeNull();
  });

  it('defaults the stepper to every remaining unit and shows it in the button', () => {
    render(
      <MarkerDetailPanel
        open
        mode="player"
        state={lootReadyState({ loot: arrowsLoot(8) })}
        onClose={() => {}}
        onClaimLoot={vi.fn()}
      />
    );
    expect(screen.getByText('8 available')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Claim 8' })).toBeEnabled();
  });

  // Visual design spec, artboard 1c ("Player, open"): a `Loot` section
  // heading with an emerald `Open` badge on the right, shown only while the
  // container is open — never while locked.
  it('shows a "Loot" heading with an emerald Open badge only when open', () => {
    const { rerender } = render(
      <MarkerDetailPanel
        open
        mode="player"
        state={lootReadyState({ loot: arrowsLoot(8) })}
        onClose={() => {}}
        onClaimLoot={vi.fn()}
      />
    );
    // The unlabelled marker's dialog title is also "Loot" (an h2); the
    // section heading is the h4.
    const lootHeading = { name: 'Loot', level: 4 } as const;
    expect(screen.getByRole('heading', lootHeading)).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();

    rerender(
      <MarkerDetailPanel
        open
        mode="player"
        state={lootReadyState({
          title: 'Chest',
          body: 'Iron-banded.',
          lootLocked: true,
        })}
        onClose={() => {}}
        onClaimLoot={vi.fn()}
      />
    );
    expect(screen.queryByRole('heading', lootHeading)).toBeNull();
    expect(screen.queryByText('Open')).toBeNull();
  });

  it('lists loot under a Loot heading with one list item per entry', () => {
    render(
      <MarkerDetailPanel
        open
        mode="player"
        state={lootReadyState({
          loot: [
            ...arrowsLoot(8),
            {
              id: 'loot-2',
              name: 'Rope',
              itemKind: 'inventory' as const,
              quantity: 1,
              remainingQuantity: 1,
            },
          ],
        })}
        onClose={() => {}}
        onClaimLoot={vi.fn()}
      />
    );
    const heading = screen.getByRole('heading', { name: 'Loot', level: 4 });
    expect(heading).toBeInTheDocument();
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText('Arrows')).toBeInTheDocument();
    expect(within(items[1]).getByText('Rope')).toBeInTheDocument();
  });

  it('claim is an outline action, not brass', () => {
    render(
      <MarkerDetailPanel
        open
        mode="player"
        state={lootReadyState({ loot: arrowsLoot(8) })}
        onClose={() => {}}
        onClaimLoot={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: 'Claim 8' })).toHaveAttribute(
      'data-variant',
      'secondary'
    );
    expect(
      screen.getByRole('button', { name: 'Take fewer Arrows' })
    ).toHaveAttribute('data-variant', 'secondary');
    expect(
      screen.getByRole('button', { name: 'Take more Arrows' })
    ).toHaveAttribute('data-variant', 'secondary');
  });

  it('shows the locked state as text with no claim controls', () => {
    render(
      <MarkerDetailPanel
        open
        mode="player"
        state={lootReadyState({ lootLocked: true })}
        onClose={() => {}}
        onClaimLoot={vi.fn()}
      />
    );
    expect(screen.getByText('Locked')).toBeInTheDocument();
    expect(screen.getByText("You'd need to get it open first.")).toBeVisible();
    expect(screen.queryByRole('button', { name: /claim/i })).toBeNull();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('claims the quantity the player stepped down to', async () => {
    const user = userEvent.setup();
    const onClaimLoot = vi.fn().mockResolvedValue(6);
    render(
      <MarkerDetailPanel
        open
        mode="player"
        state={lootReadyState({ loot: arrowsLoot(8) })}
        onClose={() => {}}
        onClaimLoot={onClaimLoot}
      />
    );
    const decrease = screen.getByRole('button', { name: /take fewer arrows/i });
    await user.click(decrease);
    await user.click(decrease);
    expect(screen.getByRole('button', { name: 'Claim 6' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Claim 6' }));
    expect(onClaimLoot).toHaveBeenCalledWith('loot-1', 6);
  });

  it('clamps the stepper to the remaining count', () => {
    render(
      <MarkerDetailPanel
        open
        mode="player"
        state={lootReadyState({ loot: arrowsLoot(2) })}
        onClose={() => {}}
        onClaimLoot={vi.fn()}
      />
    );
    expect(
      screen.getByRole('button', { name: /take more arrows/i })
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Claim 2' })).toBeInTheDocument();
  });

  it('keeps the stepper visible but inert for a single remaining unit', () => {
    render(
      <MarkerDetailPanel
        open
        mode="player"
        state={lootReadyState({ loot: arrowsLoot(1) })}
        onClose={() => {}}
        onClaimLoot={vi.fn()}
      />
    );
    expect(
      screen.getByRole('button', { name: /take fewer arrows/i })
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: /take more arrows/i })
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Claim 1' })).toBeEnabled();
  });

  // Controller ruling R2: the route returns `claim.grantedQuantity`, which
  // can be less than what the player asked for (another player claimed some
  // first). `onClaimLoot` resolves with that granted count, and the panel's
  // existing `claimMessage` status line must say so instead of a flat
  // "Claimed." — never silently accept fewer than requested without saying so.
  it('reports a partial grant instead of a flat "Claimed." when fewer units were available than requested', async () => {
    const user = userEvent.setup();
    const onClaimLoot = vi.fn().mockResolvedValue(4);
    render(
      <MarkerDetailPanel
        open
        mode="player"
        state={lootReadyState({ loot: arrowsLoot(8) })}
        onClose={() => {}}
        onClaimLoot={onClaimLoot}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Claim 8' }));

    expect(onClaimLoot).toHaveBeenCalledWith('loot-1', 8);
    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent(/claimed 4 of 8/i);
  });
});

function makePortalState(
  overrides?: Partial<ResolvedPortalState>
): ResolvedPortalState {
  return {
    battleMapChoices: [
      { id: 'map-2', name: 'Cave Map' },
      { id: 'map-3', name: 'Forest Map' },
    ],
    locationChoices: [
      { id: 'loc-1', name: 'Town Square' },
      { id: 'loc-2', name: 'Castle' },
    ],
    ...overrides,
  };
}

describe('MarkerDetailPanel portal destination', () => {
  it('renders destination kind selector in DM mode with portalState', () => {
    render(
      <MarkerDetailPanel
        open
        mode="dm"
        state={{
          kind: 'ready',
          data: buildMarkerData({ kind: 'door', ref: 'ref-1' }),
          detail: detail(),
        }}
        portalState={makePortalState()}
        onClose={() => {}}
        onSave={() => {}}
      />
    );

    expect(
      screen.getByTestId('portal-destination-section')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: 'Destination type' })
    ).toBeInTheDocument();
  });

  it('shows target picker when a destination kind is selected', async () => {
    render(
      <MarkerDetailPanel
        open
        mode="dm"
        state={{
          kind: 'ready',
          data: buildMarkerData({ kind: 'door', ref: 'ref-1' }),
          detail: detail(),
        }}
        portalState={makePortalState({
          target: { v: 1, kind: 'battlemap', id: 'map-2' },
        })}
        onClose={() => {}}
        onSave={() => {}}
      />
    );

    // The target picker should be visible because portalState has a battlemap target
    expect(
      screen.getByRole('combobox', { name: 'Target battle map' })
    ).toBeInTheDocument();
  });

  it('omits portal from patch when destination is untouched', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(
      <MarkerDetailPanel
        open
        mode="dm"
        state={{
          kind: 'ready',
          data: buildMarkerData({ kind: 'door', ref: 'ref-1' }),
          detail: detail(),
        }}
        portalState={makePortalState()}
        onClose={() => {}}
        onSave={onSave}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const patch = onSave.mock.calls[0][0];
    expect('portal' in patch).toBe(false);
  });

  it('submits portal: null when "No destination" is explicitly chosen', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(
      <MarkerDetailPanel
        open
        mode="dm"
        state={{
          kind: 'ready',
          data: buildMarkerData({ kind: 'door', ref: 'ref-1' }),
          detail: detail(),
        }}
        portalState={makePortalState({
          target: { v: 1, kind: 'battlemap', id: 'map-2' },
        })}
        onClose={() => {}}
        onSave={onSave}
      />
    );

    // Open the destination kind dropdown and select "No destination"
    const kindTrigger = screen.getByRole('combobox', {
      name: 'Destination type',
    });
    await user.click(kindTrigger);

    await waitFor(() => {
      const option = screen.getByRole('option', { name: 'No destination' });
      expect(option).toBeInTheDocument();
      fireEvent.click(option);
    });

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].portal).toBeNull();
  });

  it('submits a complete target when kind and id are both selected', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(
      <MarkerDetailPanel
        open
        mode="dm"
        state={{
          kind: 'ready',
          data: buildMarkerData({ kind: 'door', ref: 'ref-1' }),
          detail: detail(),
        }}
        portalState={makePortalState()}
        onClose={() => {}}
        onSave={onSave}
      />
    );

    // Select "Battle map" kind
    const kindTrigger = screen.getByRole('combobox', {
      name: 'Destination type',
    });
    await user.click(kindTrigger);

    await waitFor(() => {
      const option = screen.getByRole('option', { name: 'Battle map' });
      expect(option).toBeInTheDocument();
      fireEvent.click(option);
    });

    // Now select a target
    await waitFor(() => {
      expect(
        screen.getByRole('combobox', { name: 'Target battle map' })
      ).toBeInTheDocument();
    });

    const targetTrigger = screen.getByRole('combobox', {
      name: 'Target battle map',
    });
    await user.click(targetTrigger);

    await waitFor(() => {
      const option = screen.getByRole('option', { name: 'Cave Map' });
      expect(option).toBeInTheDocument();
      fireEvent.click(option);
    });

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].portal).toEqual({
      v: 1,
      kind: 'battlemap',
      id: 'map-2',
    });
  });

  it('omits portal from patch when kind is selected but no target (half-target)', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(
      <MarkerDetailPanel
        open
        mode="dm"
        state={{
          kind: 'ready',
          data: buildMarkerData({ kind: 'door', ref: 'ref-1' }),
          detail: detail(),
        }}
        portalState={makePortalState()}
        onClose={() => {}}
        onSave={onSave}
      />
    );

    // Select "Battle map" kind but do NOT select a target
    const kindTrigger = screen.getByRole('combobox', {
      name: 'Destination type',
    });
    await user.click(kindTrigger);

    await waitFor(() => {
      const option = screen.getByRole('option', { name: 'Battle map' });
      expect(option).toBeInTheDocument();
      fireEvent.click(option);
    });

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const patch = onSave.mock.calls[0][0];
    expect('portal' in patch).toBe(false);
  });

  it('renders a link for a valid saved destination', () => {
    render(
      <MarkerDetailPanel
        open
        mode="dm"
        state={{
          kind: 'ready',
          data: buildMarkerData({ kind: 'door', ref: 'ref-1' }),
          detail: detail(),
        }}
        portalState={makePortalState({
          target: { v: 1, kind: 'battlemap', id: 'map-2' },
          resolved: {
            status: 'ready',
            href: '/dm/campaign/abc/battlemaps/map-2',
            name: 'Cave Map',
          },
        })}
        onClose={() => {}}
        onSave={() => {}}
      />
    );

    const link = screen.getByRole('link', { name: /Open destination/ });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/dm/campaign/abc/battlemaps/map-2');
    // The resolved name appears in the destination display (and also in the
    // select trigger as the current value); verify the name is visible.
    expect(screen.getAllByText('Cave Map').length).toBeGreaterThanOrEqual(1);
  });

  it('renders "Destination unavailable" for a missing target', () => {
    render(
      <MarkerDetailPanel
        open
        mode="dm"
        state={{
          kind: 'ready',
          data: buildMarkerData({ kind: 'door', ref: 'ref-1' }),
          detail: detail(),
        }}
        portalState={makePortalState({
          target: { v: 1, kind: 'battlemap', id: 'gone-map' },
          resolved: { status: 'missing' },
        })}
        onClose={() => {}}
        onSave={() => {}}
      />
    );

    expect(screen.getByText('Destination unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Open destination/ })).toBeNull();
  });

  it('renders a warning for an invalid or unsupported target', () => {
    render(
      <MarkerDetailPanel
        open
        mode="dm"
        state={{
          kind: 'ready',
          data: buildMarkerData({ kind: 'door', ref: 'ref-1' }),
          detail: detail(),
        }}
        portalState={makePortalState({
          target: { v: 1, kind: 'battlemap', id: 'bad-id' },
          resolved: { status: 'invalid' },
        })}
        onClose={() => {}}
        onSave={() => {}}
      />
    );

    expect(
      screen.getByText(/Destination cannot be resolved/)
    ).toBeInTheDocument();
  });

  it('renders self-link message for a self-referencing target', () => {
    render(
      <MarkerDetailPanel
        open
        mode="dm"
        state={{
          kind: 'ready',
          data: buildMarkerData({ kind: 'door', ref: 'ref-1' }),
          detail: detail(),
        }}
        portalState={makePortalState({
          target: { v: 1, kind: 'battlemap', id: 'self-map' },
          resolved: { status: 'self' },
        })}
        onClose={() => {}}
        onSave={() => {}}
      />
    );

    expect(
      screen.getByText('Points to this map (self-link)')
    ).toBeInTheDocument();
  });

  it('does not render destination controls in player mode', () => {
    render(
      <MarkerDetailPanel
        open
        mode="player"
        state={{
          kind: 'ready',
          data: buildMarkerData({ kind: 'door', ref: 'ref-1' }),
          detail: detail(),
        }}
        onClose={() => {}}
      />
    );

    expect(screen.queryByTestId('portal-destination-section')).toBeNull();
    expect(
      screen.queryByRole('combobox', { name: 'Destination type' })
    ).toBeNull();
  });

  it('Task 7: renders no destination section, link, or href even when the underlying detail record carries a portal target (no portalState prop supplied — the player surface never resolves or passes one)', () => {
    render(
      <MarkerDetailPanel
        open
        mode="player"
        state={{
          kind: 'ready',
          data: buildMarkerData({ kind: 'door', ref: 'ref-1' }),
          detail: detail({
            portal: { v: 1, kind: 'battlemap', id: 'SMUGGLED-MAP-ID' },
          }),
        }}
        onClose={() => {}}
      />
    );

    const dialog = screen.getByRole('dialog');
    expect(screen.queryByTestId('portal-destination-section')).toBeNull();
    expect(
      screen.queryByRole('combobox', { name: 'Destination type' })
    ).toBeNull();
    expect(
      screen.queryByRole('link', { name: /open destination/i })
    ).toBeNull();
    // No leak of the target id into any href, text, or attribute.
    expect(dialog.innerHTML).not.toContain('SMUGGLED-MAP-ID');
  });

  it('does not call onSave when clicking "Open destination"', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(
      <MarkerDetailPanel
        open
        mode="dm"
        state={{
          kind: 'ready',
          data: buildMarkerData({ kind: 'door', ref: 'ref-1' }),
          detail: detail(),
        }}
        portalState={makePortalState({
          target: { v: 1, kind: 'battlemap', id: 'map-2' },
          resolved: {
            status: 'ready',
            href: '/dm/campaign/abc/battlemaps/map-2',
            name: 'Cave Map',
          },
        })}
        onClose={() => {}}
        onSave={onSave}
      />
    );

    const link = screen.getByRole('link', { name: /Open destination/ });
    await user.click(link);

    expect(onSave).not.toHaveBeenCalled();
  });

  it('works for all marker kinds, not just doors', () => {
    for (const kind of MARKER_KINDS) {
      const { unmount } = render(
        <MarkerDetailPanel
          open
          mode="dm"
          state={{
            kind: 'ready',
            data: buildMarkerData({ kind, ref: 'ref-1' }),
            detail: detail(),
          }}
          portalState={makePortalState()}
          onClose={() => {}}
          onSave={() => {}}
        />
      );

      expect(
        screen.getByTestId('portal-destination-section')
      ).toBeInTheDocument();
      unmount();
    }
  });

  describe('loot access control', () => {
    function stubPlayersFetch() {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue({ ok: true, json: async () => ({ players: [] }) })
      );
    }

    it('saves lootAccess when the DM locks a container', async () => {
      stubPlayersFetch();
      const user = userEvent.setup();
      const onSave = vi.fn();

      render(
        <MarkerDetailPanel
          open
          mode="dm"
          campaignCode="ABC123"
          state={{
            kind: 'ready',
            data: buildMarkerData({ kind: 'loot', ref: 'ref-1' }),
            detail: detail({ loot: [] }),
          }}
          onClose={() => {}}
          onSave={onSave}
        />
      );

      await user.click(screen.getByRole('button', { name: 'Locked' }));
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ lootAccess: 'locked' })
      );
    });

    it('defaults a container with no stored lootAccess to open', () => {
      stubPlayersFetch();

      render(
        <MarkerDetailPanel
          open
          mode="dm"
          campaignCode="ABC123"
          state={{
            kind: 'ready',
            data: buildMarkerData({ kind: 'loot', ref: 'ref-1' }),
            detail: detail({ loot: [] }),
          }}
          onClose={() => {}}
          onSave={() => {}}
        />
      );

      expect(screen.getByRole('button', { name: 'Open' })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      expect(
        screen.getByText(
          /players can see the contents and claim up to what's left/i
        )
      ).toBeInTheDocument();
    });

    it('persists lootAccess immediately via onPersist, without a Save click', async () => {
      stubPlayersFetch();
      const user = userEvent.setup();
      const onPersist = vi.fn();

      render(
        <MarkerDetailPanel
          open
          mode="dm"
          campaignCode="ABC123"
          state={{
            kind: 'ready',
            data: buildMarkerData({ kind: 'loot', ref: 'ref-1' }),
            detail: detail({ loot: [] }),
          }}
          onClose={() => {}}
          onSave={() => {}}
          onPersist={onPersist}
        />
      );

      await user.click(screen.getByRole('button', { name: 'Locked' }));

      expect(onPersist).toHaveBeenCalledWith(
        expect.objectContaining({ lootAccess: 'locked' })
      );
    });

    it('explains what locking does', async () => {
      stubPlayersFetch();
      const user = userEvent.setup();

      render(
        <MarkerDetailPanel
          open
          mode="dm"
          campaignCode="ABC123"
          state={{
            kind: 'ready',
            data: buildMarkerData({ kind: 'loot', ref: 'ref-1' }),
            detail: detail({ loot: [] }),
          }}
          onClose={() => {}}
          onSave={() => {}}
        />
      );

      await user.click(screen.getByRole('button', { name: 'Locked' }));

      expect(
        screen.getByText(/claims are refused on the server too/i)
      ).toBeInTheDocument();
    });
  });
});

describe('MarkerDetailPanel DM loot editor', () => {
  afterEach(() => {
    useMagicItemLibraryStore.setState({ itemsByCampaign: {} });
  });

  /** Routes the campaign roster request; every other fetch (compendium
   * item lists) gets an empty body. */
  function stubFetch(players: { playerId: string; characterName: string }[]) {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async (url: string) => ({
        ok: true,
        json: async () => (url.endsWith('/players') ? { players } : {}),
      }))
    );
  }

  function lootEntry(id: string, name: string): MarkerLootEntry {
    return {
      id,
      itemKind: 'inventory',
      item: {
        id: `item-${id}`,
        name,
        category: 'treasure',
        quantity: 1,
        tags: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      quantity: 1,
      claimedQuantity: 0,
    };
  }

  function renderLootPanel(
    lootDetail: Partial<MarkerDetail>,
    onSave: (patch: unknown) => void = () => {}
  ) {
    return render(
      <MarkerDetailPanel
        open
        mode="dm"
        campaignCode="ABC123"
        dmId="dm-1"
        state={{
          kind: 'ready',
          data: buildMarkerData({ kind: 'loot', ref: 'ref-1' }),
          detail: detail(lootDetail),
        }}
        onClose={() => {}}
        onSave={onSave}
      />
    );
  }

  it('adds the same library item twice from the add-picker', async () => {
    stubFetch([]);
    const customItem: CustomMagicItem = {
      id: 'custom-1',
      name: 'Ring of Warmth',
      category: 'ring',
      rarity: 'uncommon',
      description: 'Keeps the cold out.',
      properties: [],
      requiresAttunement: true,
      isAttuned: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      campaignCode: 'ABC123',
      tags: [],
    };
    useMagicItemLibraryStore.setState({
      itemsByCampaign: { ABC123: [customItem] },
    });
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderLootPanel({ loot: [] }, onSave);

    const picker = screen.getByRole('combobox', {
      name: 'Add from campaign item library',
    });
    for (let pick = 0; pick < 2; pick += 1) {
      await user.click(picker);
      await user.click(screen.getByRole('option', { name: 'Ring of Warmth' }));
      expect(picker).toHaveTextContent(/^Choose an item…$/);
    }
    await user.click(screen.getByRole('button', { name: 'Save' }));

    const { loot } = onSave.mock.calls[0][0] as { loot: MarkerLootEntry[] };
    expect(loot).toHaveLength(2);
    expect(loot.map(entry => entry.itemKind)).toEqual(['magic', 'magic']);
    expect(loot.map(entry => entry.item.name)).toEqual([
      'Ring of Warmth',
      'Ring of Warmth',
    ]);
  });

  it('keeps recipients per row and gates Give', async () => {
    stubFetch([{ playerId: 'p1', characterName: 'Aria' }]);
    const user = userEvent.setup();
    renderLootPanel({
      loot: [lootEntry('loot-a', 'Rope'), lootEntry('loot-b', 'Lantern')],
    });

    const ropeRecipient = screen.getByRole('combobox', {
      name: 'Recipient for Rope',
    });
    const lanternRecipient = screen.getByRole('combobox', {
      name: 'Recipient for Lantern',
    });
    await user.click(ropeRecipient);
    await user.click(
      await screen.findByRole('option', { name: 'Aria (player)' })
    );

    expect(ropeRecipient).toHaveTextContent(/^Aria \(player\)$/);
    expect(lanternRecipient).toHaveTextContent(/^Give one to…$/);
    const [ropeGive, lanternGive] = screen.getAllByRole('button', {
      name: 'Give',
    });
    expect(ropeGive).toBeEnabled();
    expect(lanternGive).toBeDisabled();
  });

  it('player access is a segmented pair', () => {
    stubFetch([]);
    renderLootPanel({ loot: [], lootAccess: 'locked' });

    const group = screen.getByRole('group', { name: 'Player access' });
    const locked = within(group).getByRole('button', { name: 'Locked' });
    const open = within(group).getByRole('button', { name: 'Open' });
    expect(locked).toHaveAttribute('aria-pressed', 'true');
    expect(open).toHaveAttribute('aria-pressed', 'false');
    expect(locked).toHaveAttribute('data-variant', 'secondary');
    expect(open).toHaveAttribute('data-variant', 'secondary');
  });

  it('lists loot under the Loot contents heading', () => {
    stubFetch([]);
    renderLootPanel({ loot: [lootEntry('loot-a', 'Rope')] });

    const heading = screen.getByRole('heading', {
      name: 'Loot contents',
      level: 4,
    });
    const section = required(heading.closest('section'), 'loot section');
    expect(within(section).getAllByRole('listitem')).toHaveLength(1);
    expect(within(section).getByText('1 of 1 available')).toBeInTheDocument();
  });
});
