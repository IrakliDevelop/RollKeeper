import { NextRequest, NextResponse } from 'next/server';
import { loadAllBestiary } from '@/utils/bestiaryDataLoader';
import { filterMonsters } from '@/utils/bestiaryFilters';
import { BestiaryFilters } from '@/types/bestiary';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Parse filters from query parameters
    const filters: BestiaryFilters = {
      searchQuery: query,
      sizes: searchParams.get('sizes')?.split(',').filter(Boolean) || [],
      types: searchParams.get('types')?.split(',').filter(Boolean) || [],
      alignments:
        searchParams.get('alignments')?.split(',').filter(Boolean) || [],
      sources: searchParams.get('sources')?.split(',').filter(Boolean) || [],
      crRange: {},
      hasLegendaryActions:
        searchParams.get('hasLegendaryActions') === 'true'
          ? true
          : searchParams.get('hasLegendaryActions') === 'false'
            ? false
            : undefined,
      hasSpellcasting:
        searchParams.get('hasSpellcasting') === 'true'
          ? true
          : searchParams.get('hasSpellcasting') === 'false'
            ? false
            : undefined,
      hasConditionImmunities:
        searchParams.get('hasConditionImmunities') === 'true'
          ? true
          : searchParams.get('hasConditionImmunities') === 'false'
            ? false
            : undefined,
      hasDamageResistances:
        searchParams.get('hasDamageResistances') === 'true'
          ? true
          : searchParams.get('hasDamageResistances') === 'false'
            ? false
            : undefined,
    };

    // Parse CR range
    const crMin = searchParams.get('crMin');
    const crMax = searchParams.get('crMax');
    if (crMin || crMax) {
      filters.crRange = {
        ...(crMin && { min: parseFloat(crMin) }),
        ...(crMax && { max: parseFloat(crMax) }),
      };
    }

    // Load and filter monsters
    const allMonsters = await loadAllBestiary();
    const filteredMonsters = filterMonsters(allMonsters, filters);

    // Apply pagination
    const paginatedMonsters = filteredMonsters.slice(offset, offset + limit);

    return NextResponse.json({
      monsters: paginatedMonsters,
      total: filteredMonsters.length,
      hasMore: offset + limit < filteredMonsters.length,
      filters: filters,
    });
  } catch (error) {
    console.error('Error searching bestiary:', error);
    return NextResponse.json(
      { error: 'Failed to search bestiary data' },
      { status: 500 }
    );
  }
}
