import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JoinCampaignDialog } from './JoinCampaignDialog';
import type { PlayerCharacter } from '@/store/playerStore';
import { makeCharacter } from '@/utils/__tests__/test-utils';

const NOW = new Date('2026-01-01T00:00:00.000Z');

function makePlayerCharacter(
  id: string,
  name: string,
  className: string,
  level: number
): PlayerCharacter {
  return {
    id,
    name,
    race: 'Human',
    class: className,
    level,
    createdAt: NOW,
    updatedAt: NOW,
    lastPlayed: NOW,
    characterData: makeCharacter({ name }),
    tags: [],
    isArchived: false,
  };
}

const CHARACTERS = [
  makePlayerCharacter('char-1', 'Mira', 'Fighter', 5),
  makePlayerCharacter('char-2', 'Tam', 'Rogue', 3),
];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('JoinCampaignDialog', () => {
  const fetchMock = vi.fn();
  const onJoin = vi.fn();
  const onOpenChange = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    onJoin.mockReset();
    onOpenChange.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  function renderDialog(preselectedCharacterId?: string) {
    return render(
      <JoinCampaignDialog
        open
        onOpenChange={onOpenChange}
        characters={CHARACTERS}
        onJoin={onJoin}
        preselectedCharacterId={preselectedCharacterId}
      />
    );
  }

  const codeField = () =>
    screen.getByRole('textbox', { name: 'Campaign code' });

  it('is titled Join campaign with one primary and a secondary Cancel', () => {
    renderDialog('char-1');
    expect(
      screen.getByRole('dialog', { name: 'Join campaign' })
    ).toBeInTheDocument();
    const primaries = document.body.querySelectorAll(
      '[data-variant="primary"]'
    );
    expect(primaries).toHaveLength(1);
    expect(primaries[0]).toHaveAccessibleName('Join campaign');
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveAttribute(
      'data-variant',
      'secondary'
    );
  });

  it('sets the code field up for codes', () => {
    renderDialog('char-1');
    const field = codeField();
    expect(field).toHaveAttribute('autocapitalize', 'characters');
    expect(field).toHaveAttribute('autocomplete', 'off');
    expect(field).toHaveAttribute('spellcheck', 'false');
    expect(field).toHaveAttribute('placeholder', 'ABC123');
  });

  it('asks for the code under the code field only', async () => {
    const user = userEvent.setup();
    renderDialog('char-1');
    await user.click(screen.getByRole('button', { name: 'Join campaign' }));
    const field = codeField();
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription('Enter the campaign code.');
    expect(screen.getAllByText('Enter the campaign code.')).toHaveLength(1);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('asks for a character under the Character select', async () => {
    const user = userEvent.setup();
    renderDialog();
    await user.type(codeField(), 'abc123');
    await user.click(screen.getByRole('button', { name: 'Join campaign' }));
    expect(
      screen.getByRole('combobox', { name: 'Character' })
    ).toHaveAccessibleDescription('Choose a character to join with.');
    expect(
      screen.getAllByText('Choose a character to join with.')
    ).toHaveLength(1);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports an unknown code under the code field', async () => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(new Response('{}', { status: 404 }));
    renderDialog('char-1');
    await user.type(codeField(), 'abc123');
    await user.click(screen.getByRole('button', { name: 'Join campaign' }));
    expect(await screen.findByText(/No campaign with that code/)).toBeVisible();
    expect(codeField()).toHaveAccessibleDescription(
      'No campaign with that code. Check it with your DM.'
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('reports a network failure once, as an alert', async () => {
    const user = userEvent.setup();
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    renderDialog('char-1');
    await user.type(codeField(), 'abc123');
    await user.click(screen.getByRole('button', { name: 'Join campaign' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      "Couldn't reach the campaign. Check your connection and try again."
    );
    expect(codeField()).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByText('Failed to fetch')).toBeNull();
  });

  it("passes the join route's message through in the alert", async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(json({ campaign: { campaignName: 'Ashfall' } }))
      .mockResolvedValueOnce(
        json({ error: 'Guest player binding does not match' }, 403)
      );
    renderDialog('char-1');
    await user.type(codeField(), 'abc123');
    await user.click(screen.getByRole('button', { name: 'Join campaign' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Guest player binding does not match'
    );
  });

  it('joins with the upper-cased code and closes', async () => {
    const user = userEvent.setup();
    fetchMock
      .mockResolvedValueOnce(json({ campaign: { campaignName: 'Ashfall' } }))
      .mockResolvedValueOnce(json({}));
    renderDialog('char-1');
    // Case-insensitive on purpose: the label wording is covered elsewhere.
    await user.type(
      screen.getByRole('textbox', { name: /campaign code/i }),
      'abc123{Enter}'
    );
    await vi.waitFor(() => expect(onJoin).toHaveBeenCalled());
    expect(fetchMock.mock.calls[0][0]).toBe('/api/campaign/ABC123');
    expect(onJoin).toHaveBeenCalledWith('ABC123', 'char-1', 'Ashfall');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('posts once when Enter is pressed while joining', async () => {
    const user = userEvent.setup();
    fetchMock.mockReturnValue(new Promise(() => {}));
    renderDialog('char-1');
    await user.type(codeField(), 'ABC123{Enter}{Enter}');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Joining…' })).toBeDisabled();
  });
});
