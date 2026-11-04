import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeCharacter } from '@/utils/__tests__/test-utils';
import type { CampaignPlayerData } from '@/types/campaign';
import type { DmMessage } from '@/types/sharedState';

afterEach(cleanup);

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { fill, priority, ...rest } = props as Record<string, unknown>;
    return <img {...rest} />;
  },
}));

vi.mock('@/components/ui/forms/RichTextEditor', () => ({
  default: ({
    content,
    onChange,
  }: {
    content: string;
    onChange: (v: string) => void;
  }) => (
    <textarea
      data-testid="rich-text-editor"
      value={content}
      onChange={e => onChange(e.target.value)}
    />
  ),
}));

import { DmMessageNotification } from '@/components/ui/campaign/DmMessageNotification';
import { CreateCampaignDialog } from '@/components/ui/campaign/CreateCampaignDialog';
import { SendMessageDialog } from '@/components/ui/campaign/SendMessageDialog';

const mockPlayer: CampaignPlayerData = {
  playerId: 'player-1',
  playerName: 'Alice',
  characterId: 'char-1',
  characterName: 'Thorin',
  characterData: makeCharacter({
    name: 'Thorin',
    race: 'Dwarf',
    class: {
      name: 'Fighter',
      isCustom: false,
      spellcaster: 'none',
      hitDie: 10,
    },
    level: 5,
    totalLevel: 5,
    hitPoints: { current: 30, max: 44, temporary: 0, calculationMode: 'auto' },
  }),
  lastSynced: new Date().toISOString(),
};

const mockMessages: DmMessage[] = [
  {
    id: 'msg-1',
    title: 'Quest Update',
    content: '<p>The dragon has been spotted near the mountain.</p>',
    sentAt: new Date().toISOString(),
  },
  {
    id: 'msg-2',
    title: 'Rest Reminder',
    content: '',
    sentAt: new Date().toISOString(),
  },
];

describe('DmMessageNotification', () => {
  it('renders without crashing', () => {
    render(
      <DmMessageNotification
        messages={mockMessages}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
      />
    );
  });

  it('displays message titles', () => {
    render(
      <DmMessageNotification
        messages={mockMessages}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
      />
    );
    expect(screen.getAllByText('Quest Update').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Rest Reminder').length).toBeGreaterThan(0);
  });

  it('calls onDismiss when dismiss button clicked', async () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    const { container } = render(
      <DmMessageNotification
        messages={mockMessages}
        onAccept={vi.fn()}
        onDismiss={onDismiss}
      />
    );
    const dismissButtons = container.querySelectorAll(
      'button[title="Dismiss"]'
    );
    expect(dismissButtons.length).toBeGreaterThan(0);
    fireEvent.click(dismissButtons[0]);
    await vi.advanceTimersByTimeAsync(500);
    expect(onDismiss).toHaveBeenCalledWith('msg-1');
    vi.useRealTimers();
  });

  it('returns null for empty messages', () => {
    const { container } = render(
      <DmMessageNotification
        messages={[]}
        onAccept={vi.fn()}
        onDismiss={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });
});

describe('CreateCampaignDialog', () => {
  afterEach(() => vi.restoreAllMocks());

  const renderDialog = () =>
    render(
      <CreateCampaignDialog
        open={true}
        onOpenChange={vi.fn()}
        onCampaignCreated={vi.fn()}
        dmId="dm-1"
      />
    );

  it('renders the form copy', () => {
    renderDialog();
    expect(
      screen.getByRole('heading', { name: 'Create campaign' })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Campaign name')).toHaveAttribute(
      'placeholder',
      'The Sunken Bell'
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveAttribute(
      'data-variant',
      'outline'
    );
  });

  it('asks for a name before creating', async () => {
    renderDialog();
    await userEvent.click(
      screen.getByRole('button', { name: 'Create campaign' })
    );
    expect(
      await screen.findByText('Enter a campaign name.')
    ).toBeInTheDocument();
  });

  it('never shows server error text', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'dmId and campaignName are required' }),
    } as Response);
    renderDialog();
    await userEvent.type(
      screen.getByLabelText('Campaign name'),
      'The Sunken Bell'
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Create campaign' })
    );
    expect(
      await screen.findByText("The campaign wasn't created. Try again.")
    ).toBeInTheDocument();
    expect(screen.queryByText(/dmId/)).toBeNull();
  });

  it('shows the same message when the request throws', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new Error('socket hang up')
    );
    renderDialog();
    await userEvent.type(
      screen.getByLabelText('Campaign name'),
      'The Sunken Bell'
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Create campaign' })
    );
    expect(
      await screen.findByText("The campaign wasn't created. Try again.")
    ).toBeInTheDocument();
    expect(screen.queryByText(/socket/)).toBeNull();
  });

  it('shows the code to copy after creating', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ code: 'ABC123' }),
    } as Response);
    renderDialog();
    await userEvent.type(
      screen.getByLabelText('Campaign name'),
      'The Sunken Bell'
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Create campaign' })
    );
    expect(
      await screen.findByRole('heading', { name: 'Campaign created' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Copy code ABC123' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Done' })).toHaveAttribute(
      'data-variant',
      'primary'
    );
  });
});

describe('SendMessageDialog', () => {
  afterEach(() => vi.unstubAllGlobals());

  const renderDialog = (props: Record<string, unknown> = {}) =>
    render(
      <SendMessageDialog
        open={true}
        onClose={vi.fn()}
        players={[mockPlayer]}
        campaignCode="ABC123"
        dmId="dm-1"
        {...props}
      />
    );

  it('renders without crashing when open', () => {
    renderDialog();
  });

  it('displays dialog title and recipient info', () => {
    renderDialog();
    expect(
      screen.getByRole('dialog', { name: 'Message all players' })
    ).toBeTruthy();
    expect(screen.getByText('To').tagName).toBe('DT');
    expect(screen.getByText('All players (1)').tagName).toBe('DD');
  });

  it('names the character when sent to one player', () => {
    renderDialog({ targetPlayer: mockPlayer });
    expect(screen.getByRole('dialog', { name: 'Message Thorin' })).toBeTruthy();
    expect(screen.getByText('Thorin (Alice)')).toBeTruthy();
  });

  it('displays title input', () => {
    renderDialog();
    expect(screen.getByLabelText('Title').getAttribute('placeholder')).toBe(
      'The bridge is out'
    );
  });

  it('displays rich text editor', () => {
    renderDialog();
    expect(screen.getAllByTestId('rich-text-editor').length).toBeGreaterThan(0);
    expect(screen.getByText('Message (optional)')).toBeTruthy();
  });

  it('clears the draft when Cancel closes it', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const props = {
      onClose,
      players: [mockPlayer],
      campaignCode: 'ABC123',
      dmId: 'dm-1',
    };
    const { rerender } = render(<SendMessageDialog open {...props} />);
    await user.type(screen.getByLabelText('Title'), 'Bridge');
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    expect(cancel.getAttribute('data-variant')).toBe('outline');
    await user.click(cancel);
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(<SendMessageDialog open={false} {...props} />);
    rerender(<SendMessageDialog open {...props} />);
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('');
  });

  it('shows a fixed error, not the server message', async () => {
    const user = userEvent.setup();
    let release!: (v: unknown) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise(r => {
            release = r;
          })
      )
    );
    renderDialog();
    await user.type(screen.getByLabelText('Title'), 'Bridge');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    expect(
      (screen.getByRole('button', { name: 'Sending…' }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement)
        .disabled
    ).toBe(false);

    release({ ok: false, status: 500, json: async () => ({ error: 'boom' }) });
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe("The message wasn't sent. Try again.");
    expect(alert.className).toContain('text-blood-text');
    expect(screen.queryByText('boom')).toBeNull();
  });
});
