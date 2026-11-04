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
  it('renders without crashing when open', () => {
    render(
      <SendMessageDialog
        open={true}
        onClose={vi.fn()}
        players={[mockPlayer]}
        campaignCode="ABC123"
        dmId="dm-1"
      />
    );
  });

  it('displays dialog title and recipient info', () => {
    render(
      <SendMessageDialog
        open={true}
        onClose={vi.fn()}
        players={[mockPlayer]}
        campaignCode="ABC123"
        dmId="dm-1"
      />
    );
    expect(
      screen.getAllByText('Send Message to Player').length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText('All players (1)').length).toBeGreaterThan(0);
  });

  it('displays title input', () => {
    render(
      <SendMessageDialog
        open={true}
        onClose={vi.fn()}
        players={[mockPlayer]}
        campaignCode="ABC123"
        dmId="dm-1"
      />
    );
    expect(
      screen.getAllByPlaceholderText('Message title...').length
    ).toBeGreaterThan(0);
  });

  it('displays rich text editor', () => {
    render(
      <SendMessageDialog
        open={true}
        onClose={vi.fn()}
        players={[mockPlayer]}
        campaignCode="ABC123"
        dmId="dm-1"
      />
    );
    expect(screen.getAllByTestId('rich-text-editor').length).toBeGreaterThan(0);
  });
});
