import { useState, useEffect, useRef, useCallback } from 'react';

const ITEMS_PER_PAGE = 24;

interface UseInfiniteScrollOptions {
  totalItems: number;
  itemsPerPage?: number;
}

export function useInfiniteScroll({
  totalItems,
  itemsPerPage = ITEMS_PER_PAGE,
}: UseInfiniteScrollOptions) {
  const [displayedCount, setDisplayedCount] = useState(itemsPerPage);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const hasMore = displayedCount < totalItems;

  useEffect(() => {
    setDisplayedCount(itemsPerPage);
  }, [totalItems, itemsPerPage]);

  const loadMore = useCallback(() => {
    if (!hasMore) return;
    setDisplayedCount(prev => Math.min(prev + itemsPerPage, totalItems));
  }, [hasMore, totalItems, itemsPerPage]);

  useEffect(() => {
    const currentRef = loadMoreRef.current;
    if (!currentRef || !hasMore) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) loadMore();
      },
      { threshold: 0.1, rootMargin: '300px' }
    );

    observer.observe(currentRef);
    return () => observer.unobserve(currentRef);
  }, [loadMore, hasMore]);

  return { displayedCount, hasMore, loadMoreRef, loadMore };
}
