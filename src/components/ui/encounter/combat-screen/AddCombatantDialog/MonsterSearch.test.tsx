// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MonsterSearch } from './MonsterSearch';
import { createMockProcessedMonster } from '@/test/helpers';

afterEach(cleanup);

describe('MonsterSearch', () => {
  const base = {
    query: 'goblin',
    onQueryChange: vi.fn(),
    results: [],
    total: 0,
    hasMore: false,
    loading: false,
    loadingMore: false,
    loadMoreError: false,
    error: false,
    onRetry: vi.fn(),
    onSelect: vi.fn(),
    onLoadMore: vi.fn(),
    onRetryLoadMore: vi.fn(),
  };

  it('strips bestiary tags from every result-row field', () => {
    const monster = createMockProcessedMonster({
      id: 'goblin',
      name: 'Goblin',
      hp: '7 ({@dice 2d6})',
      ac: '15 ({@item leather armor|phb}, {@item shield|phb})',
      type: 'humanoid',
    });
    render(<MonsterSearch {...base} results={[monster]} />);
    const row = screen.getByRole('button', { name: /Goblin/ });
    expect(row.textContent).toContain('leather armor');
    expect(row.textContent).not.toContain('{@');
  });

  it('announces progress and true no-match, only for a trimmed query', () => {
    const { rerender } = render(<MonsterSearch {...base} query="  " />);
    expect(screen.queryByText(/No creatures match/)).not.toBeInTheDocument();
    rerender(<MonsterSearch {...base} query="goblin" loading />);
    expect(screen.getByRole('status')).toHaveTextContent('Searching…');
    rerender(<MonsterSearch {...base} />);
    expect(screen.getByRole('status')).toHaveTextContent('No creatures match');
  });

  it('returns focus to search when retry replaces the error', () => {
    const { rerender } = render(<MonsterSearch {...base} error />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      "Bestiary didn't load."
    );
    const retry = screen.getByRole('button', { name: 'Retry search' });
    retry.focus();
    fireEvent.click(retry);
    rerender(<MonsterSearch {...base} loading />);
    expect(
      screen.getByRole('textbox', { name: 'Search the bestiary' })
    ).toHaveFocus();
  });

  it('offers a load-more retry without clearing existing results', () => {
    const monster = createMockProcessedMonster({
      id: 'goblin',
      name: 'Goblin',
    });
    render(
      <MonsterSearch
        {...base}
        results={[monster]}
        hasMore
        total={2}
        loadMoreError
        onRetryLoadMore={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /^Goblin/ })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      "More creatures didn\'t load."
    );
    expect(
      screen.getByRole('button', { name: 'Retry load more' })
    ).toBeInTheDocument();
  });

  it('shows a retry instead of a false no-match message when search fails', () => {
    const onRetry = vi.fn();
    render(
      <MonsterSearch
        query="goblin"
        onQueryChange={vi.fn()}
        results={[]}
        total={0}
        hasMore={false}
        loading={false}
        loadingMore={false}
        loadMoreError={false}
        error
        onRetry={onRetry}
        onSelect={vi.fn()}
        onLoadMore={vi.fn()}
        onRetryLoadMore={vi.fn()}
      />
    );
    expect(screen.getByText("Bestiary didn't load.")).toBeInTheDocument();
    expect(screen.queryByText(/No creatures match/)).not.toBeInTheDocument();
    screen.getByRole('button', { name: 'Retry search' }).click();
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
