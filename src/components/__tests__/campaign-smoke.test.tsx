import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from '@testing-library/react';
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

import { PlayerSummaryCard } from '@/components/ui/campaign/PlayerSummaryCard';
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

describe('PlayerSummaryCard', () => {
  it('renders without crashing', () => {
    render(<PlayerSummaryCard player={mockPlayer} />);
  });

  it('displays character name and class', () => {
    render(<PlayerSummaryCard player={mockPlayer} />);
    expect(screen.getAllByText('Thorin').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Fighter').length).toBeGreaterThan(0);
  });

  it('displays HP information', () => {
    render(<PlayerSummaryCard player={mockPlayer} />);
    expect(screen.getAllByText('30 / 44 HP').length).toBeGreaterThan(0);
  });

  it('displays player name', () => {
    render(<PlayerSummaryCard player={mockPlayer} />);
    expect(screen.getAllByText('Alice').length).toBeGreaterThan(0);
  });

  it('displays race', () => {
    render(<PlayerSummaryCard player={mockPlayer} />);
    expect(screen.getAllByText('Dwarf').length).toBeGreaterThan(0);
  });
});

describe('PlayerSummaryCard remove action', () => {
  it('renders remove button when onRemove is provided and calls it without triggering card onClick', () => {
    const onRemove = vi.fn();
    const onClick = vi.fn();
    render(
      <PlayerSummaryCard
        player={mockPlayer}
        onRemove={onRemove}
        onClick={onClick}
      />
    );

    const btn = screen.getByRole('button', {
      name: /remove .* from campaign/i,
    });
    fireEvent.click(btn);

    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('does not render remove button without onRemove', () => {
    render(<PlayerSummaryCard player={mockPlayer} />);
    expect(
      screen.queryByRole('button', { name: /remove .* from campaign/i })
    ).toBeNull();
  });
});

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
  it('renders without crashing when open', () => {
    render(
      <CreateCampaignDialog
        open={true}
        onOpenChange={vi.fn()}
        onCampaignCreated={vi.fn()}
        dmId="dm-1"
      />
    );
  });

  it('displays dialog title and name input', () => {
    render(
      <CreateCampaignDialog
        open={true}
        onOpenChange={vi.fn()}
        onCampaignCreated={vi.fn()}
        dmId="dm-1"
      />
    );
    expect(screen.getAllByText('Create Campaign').length).toBeGreaterThan(0);
    expect(
      screen.getAllByPlaceholderText('e.g. Curse of Strahd').length
    ).toBeGreaterThan(0);
  });

  it('displays campaign name label', () => {
    render(
      <CreateCampaignDialog
        open={true}
        onOpenChange={vi.fn()}
        onCampaignCreated={vi.fn()}
        dmId="dm-1"
      />
    );
    expect(screen.getAllByText('Campaign Name').length).toBeGreaterThan(0);
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
