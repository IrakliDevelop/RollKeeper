import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  act,
  render,
  screen,
  cleanup,
  fireEvent,
} from '@testing-library/react';
import { PeerRoster } from '@fieldnotes/core';
import { PresenceControl } from '../PresenceControl';

function playersFetch(ids: string[]) {
  return vi.fn(async () => ({
    ok: true,
    json: async () => ({
      players: ids.map(id => ({
        characterId: id,
        playerName: 'P-' + id,
        characterName: 'C-' + id,
      })),
    }),
  })) as unknown as typeof fetch;
}

describe('PresenceControl', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('lists deduped peers from the live roster, marks unknown players, renders names as text', async () => {
    vi.stubGlobal('fetch', playersFetch(['char-a']));
    const roster = new PeerRoster();
    const onShare = vi.fn();
    const onShow = vi.fn();
    render(
      <PresenceControl
        campaignCode="CAMP01"
        roster={roster}
        cursorSharing={false}
        onCursorSharingChange={onShare}
        showPlayerCursors
        onShowPlayerCursorsChange={onShow}
      />
    );
    act(() => {
      roster.apply('c1', {
        kind: 'awareness',
        id: 'char-a',
        name: 'Aria',
        role: 'player',
        cursor: { x: 1, y: 1 },
      });
      roster.apply('c2', {
        kind: 'awareness',
        id: 'char-b',
        name: '<b>Bad</b>',
        role: 'player',
      });
      roster.apply('c3', {
        kind: 'awareness',
        id: 'display-CAMP01',
        name: 'TV display',
        role: 'display',
      });
      roster.apply('c4', {
        kind: 'awareness',
        id: 'char-a',
        name: 'Aria',
        role: 'player',
      }); // reconnect dup
    });
    expect(
      await screen.findByRole('button', { name: /viewers · 3/i })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /viewers · 3/i }));
    const rows = await screen.findAllByTestId('presence-peer-row');
    expect(rows).toHaveLength(3);
    // Locate rows by their text — never by position: player rows sort by
    // `localeCompare`, and '<b>Bad</b>' sorts BEFORE 'Aria' in Node's ICU.
    const rowWith = (text: string) => {
      const row = rows.find(r => r.textContent?.includes(text));
      if (!row) throw new Error(`no row containing ${text}`);
      return row;
    };
    expect(rowWith('Aria')).not.toHaveTextContent('unverified');
    expect(rowWith('<b>Bad</b>')).toHaveTextContent('unverified'); // literal text, no HTML
    expect(rowWith('TV display')).not.toHaveTextContent('unverified');
    expect(document.querySelector('b')).toBeNull();
    // Role grouping is positional by design (dm → players → display) and is
    // pinned in awarenessPeers.test.ts with explicit fixture names; here only
    // assert the display row comes last.
    expect(rows[2]).toHaveTextContent('TV display');

    fireEvent.click(screen.getByRole('switch', { name: 'Share my cursor' }));
    expect(onShare).toHaveBeenCalledWith(true);
    fireEvent.click(
      screen.getByRole('switch', { name: 'Show player cursors' })
    );
    expect(onShow).toHaveBeenCalledWith(false);

    act(() => {
      roster.remove('c1');
      roster.remove('c4');
    });
    expect(screen.getAllByTestId('presence-peer-row')).toHaveLength(2);
    roster.dispose();
  });

  it('with a null roster shows zero viewers and an empty-state line, switches still work', () => {
    vi.stubGlobal('fetch', playersFetch([]));
    render(
      <PresenceControl
        campaignCode="CAMP01"
        roster={null}
        cursorSharing={false}
        onCursorSharingChange={vi.fn()}
        showPlayerCursors={false}
        onShowPlayerCursorsChange={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /viewers · 0/i }));
    expect(screen.getByText(/no one else is viewing/i)).toBeInTheDocument();
    expect(
      screen.getByRole('switch', { name: 'Share my cursor' })
    ).not.toBeChecked();
    expect(
      screen.getByRole('switch', { name: 'Show player cursors' })
    ).not.toBeChecked();
  });
});
