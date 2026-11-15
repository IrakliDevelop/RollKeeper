import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LoreTab } from './LoreTab';
import type { CampaignNPC } from '@/types/encounter';

afterEach(cleanup);

function npcWithLore(loreHtml: string) {
  return { id: 'npc-1', name: 'Mira', loreHtml } as CampaignNPC;
}

describe('LoreTab', () => {
  it('keeps the lore editor formatting', () => {
    const { container } = render(
      <LoreTab
        npc={npcWithLore(
          '<h2>Past</h2><p><strong>Born</strong> in <a target="_blank" rel="noopener noreferrer nofollow" href="https://example.com">Saltmarsh</a>, <span style="color: rgb(255, 0, 0);">hunted</span>.</p>'
        )}
      />
    );
    expect(screen.getByRole('heading', { name: 'Past' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Saltmarsh' })).toHaveAttribute(
      'href',
      'https://example.com'
    );
    expect(container.querySelector('strong')).toHaveTextContent('Born');
    expect(screen.getByText('hunted')).toHaveStyle({ color: 'rgb(255, 0, 0)' });
  });

  it('renders hostile lore as inert text', () => {
    const { container } = render(
      <LoreTab
        npc={npcWithLore(
          '<p>Secret</p><img src=x onerror="alert(1)"><script>alert(2)</script><a href="data:text/html,<script>alert(3)</script>">doc</a>'
        )}
      />
    );
    expect(screen.getByText('Secret')).toBeVisible();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
    expect(screen.getByText('doc')).not.toHaveAttribute('href');
  });
});
