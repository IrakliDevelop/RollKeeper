/**
 * API client utilities for D&D data fetching
 */

import { ProcessedMonster, BestiaryFilters } from '@/types/bestiary';
import { ProcessedSpell } from '@/types/spells';
import { ProcessedClass } from '@/types/classes';

// Base API configuration
const API_BASE = '/api';

// Generic API response type
interface ApiResponse<T> {
  data?: T;
  error?: string;
  total?: number;
  hasMore?: boolean;
}

/**
 * Generic fetch wrapper with error handling
 */
async function apiRequest<T>(url: string): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { data };
  } catch (error) {
    console.error(`API request failed for ${url}:`, error);
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Fetch all monsters from the bestiary
 */
export async function fetchBestiary(): Promise<ProcessedMonster[]> {
  const result = await apiRequest<{
    monsters: ProcessedMonster[];
    total: number;
  }>(`${API_BASE}/bestiary`);
  return result.data?.monsters || [];
}

/**
 * Search monsters with filters and pagination
 */
export async function searchMonsters(
  query: string = '',
  filters: Partial<BestiaryFilters> = {},
  limit: number = 20,
  offset: number = 0
): Promise<{
  monsters: ProcessedMonster[];
  total: number;
  hasMore: boolean;
}> {
  const params = new URLSearchParams({
    q: query,
    limit: limit.toString(),
    offset: offset.toString(),
  });

  // Add filters to params
  if (filters.sizes?.length) params.set('sizes', filters.sizes.join(','));
  if (filters.types?.length) params.set('types', filters.types.join(','));
  if (filters.alignments?.length)
    params.set('alignments', filters.alignments.join(','));
  if (filters.sources?.length) params.set('sources', filters.sources.join(','));
  if (filters.crRange?.min !== undefined)
    params.set('crMin', filters.crRange.min.toString());
  if (filters.crRange?.max !== undefined)
    params.set('crMax', filters.crRange.max.toString());
  if (filters.hasLegendaryActions !== undefined)
    params.set('hasLegendaryActions', filters.hasLegendaryActions.toString());
  if (filters.hasSpellcasting !== undefined)
    params.set('hasSpellcasting', filters.hasSpellcasting.toString());
  if (filters.hasConditionImmunities !== undefined)
    params.set(
      'hasConditionImmunities',
      filters.hasConditionImmunities.toString()
    );
  if (filters.hasDamageResistances !== undefined)
    params.set('hasDamageResistances', filters.hasDamageResistances.toString());

  const result = await apiRequest<{
    monsters: ProcessedMonster[];
    total: number;
    hasMore: boolean;
  }>(`${API_BASE}/bestiary/search?${params}`);

  return {
    monsters: result.data?.monsters || [],
    total: result.data?.total || 0,
    hasMore: result.data?.hasMore || false,
  };
}

/**
 * Fetch all spells
 */
export async function fetchSpells(): Promise<ProcessedSpell[]> {
  const result = await apiRequest<{ spells: ProcessedSpell[]; total: number }>(
    `${API_BASE}/spells`
  );
  return result.data?.spells || [];
}

/**
 * Fetch all classes
 */
export async function fetchClasses(): Promise<ProcessedClass[]> {
  const result = await apiRequest<{ classes: ProcessedClass[]; total: number }>(
    `${API_BASE}/classes`
  );
  return result.data?.classes || [];
}

/**
 * Get popular monsters (first 50 by name for now)
 * In the future, this could be based on usage analytics
 */
export async function fetchPopularMonsters(): Promise<ProcessedMonster[]> {
  const result = await searchMonsters('', {}, 50, 0);
  return result.monsters;
}
