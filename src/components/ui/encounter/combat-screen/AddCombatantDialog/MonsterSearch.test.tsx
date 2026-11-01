// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MonsterSearch } from './MonsterSearch';

afterEach(cleanup);

describe('MonsterSearch', () => {
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
        error
        onRetry={onRetry}
        onSelect={vi.fn()}
        onLoadMore={vi.fn()}
      />
    );
    expect(screen.getByText("Bestiary didn't load.")).toBeInTheDocument();
    expect(screen.queryByText(/No creatures match/)).not.toBeInTheDocument();
    screen.getByRole('button', { name: 'Retry search' }).click();
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
